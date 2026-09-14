"""
Render a still of the generated scene, headless:

    blender -b build/seked.blend -P blender/render.py -- --out build/dawn.png [--view dawn|cutaway|akhet|night] [--width 1600 --height 900 --samples 128]

Four views, each one a moment the sky package can date. "dawn" is the plan's
first hero shot: the equinox sun an hour up, seen from the east-north-east, so
the grazing light separates the Great Pyramid's eight faces. "cutaway" makes
the casing translucent and looks in from the east, so the passages and
chambers built from Petrie's positions show in place. "akhet" stands in front
of the Sphinx and watches the summer solstice sun set into the gap between the
Great Pyramid and Khafre's, which is claim C6. "night" turns the sun off and
puts the bright star catalogue on a dome with Alnitak on the meridian.

Not one sun or star position is computed here, and none is typed here. They
come from `build/sky-bake.json`, which `pnpm sky-bake` writes out of
`@seked/sky` and the measurement database; every view names a moment in that
file and this script only converts an altitude and an azimuth into Blender's
conventions. Without the bake the script says so and falls back to the
placeholder angles in VIEWS, which are lighting and not astronomy.

Materials follow the plan, base colour and roughness and a bump and nothing
else (Tura casing, core limestone with its courses, Aswan granite for the
interior, sand for the terrain), and are created here if the scene has none,
so generate.py stays material-free.
"""
import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import bpy  # noqa: E402  (only available inside Blender)

from seked_data import load_database, resolve  # noqa: E402

REPO_ROOT = os.path.dirname(HERE)
SKY_BAKE = os.path.join(REPO_ROOT, "build", "sky-bake.json")

# Rec. 709 luminance, for turning a colour into the one number that says how
# bright it is: the plateau's albedo, and the strength of a coloured beam.
LUMINANCE_WEIGHTS = (0.2126, 0.7152, 0.0722)


def luminance(rgb):
    return sum(weight * channel for weight, channel in zip(LUMINANCE_WEIGHTS, rgb))


# Petrie counted 203 courses of masonry on the Great Pyramid (§26, and the
# course table in his plate viii). The count is his, not the database's: no
# course has a measurement key yet, so the only thing the shader can know is
# the mean, the original height over the count. The real table matters and is
# not entered: the courses thin upward from about a metre and a half at the
# base, and a few conspicuously thick ones interrupt the run. The bands below
# are a uniform course and say nothing about any particular one.
PETRIE_COURSES = 203

# The sun's upper limb touches a flat horizon at -0.833 degrees, refraction
# plus semidiameter, which is the altitude the bake's sunrise and sunset
# moments sit at. At or above it there is still a disc and so a direct beam;
# below it the disc has gone and the lamp is switched off.
BEAM_LIMIT_DEG = -0.9

# The desert air the sky texture and the sun lamp both stand in. Air is the
# Rayleigh atmosphere at its standard density; the dust is thin, because these
# are renders of a clear morning and not of a khamsin; the ozone column is
# below the model's temperate default, which is what a subtropical latitude
# has.
AIR_DENSITY = 1.0
AEROSOL_DENSITY = 0.8
OZONE_DENSITY = 0.75

# The vertical optical depth of the dust at every wavelength. Desert dust is
# coarse enough to scatter greyly, so unlike the Rayleigh term it carries no
# colour of its own; it only takes light out of the beam.
AEROSOL_OPTICAL_DEPTH = 0.08

# The two colours the plateau is mixed from, and what that mixture reflects.
# The sky texture wants a single albedo, for the light bouncing off the ground
# back into the sky and for what it draws below the horizon; the terrain grid
# is only six kilometres across, so past its edge that is what the eye sees,
# and it had better be the same ground.
SAND_COLOURS = ((0.52, 0.44, 0.33), (0.72, 0.63, 0.47))
GROUND_ALBEDO = luminance([(dark + light) / 2.0 for dark, light in zip(*SAND_COLOURS)])

# Representative wavelengths in micrometres for the red, green and blue the
# render works in. Three samples is a crude spectrum, but the only thing asked
# of it is the colour of one light.
BEAM_WAVELENGTHS_UM = (0.610, 0.550, 0.470)

# The irradiance of an unattenuated beam, in the units Blender's sky texture
# works in. Those units are not watts: a white lambertian plane under the
# texture alone, with the sun 12 degrees up, receives about 8.5 of them, where
# the real sky delivers some 60 W/m2, so one of them is about a seventh of a
# watt and the solar constant of 1361 W/m2 is about 190. Measured that way
# rather than guessed, so the lamp and the sky are on one scale and the ratio
# of direct to diffuse light comes out as it is outdoors.
BEAM_AT_ZENITH = 190.0

# The stars are put on a sphere this far out: past every monument and the
# whole terrain grid, and well inside the camera's far clip.
DOME_RADIUS_M = 5000.0

# A star's drawn radius in metres on that sphere, at the bright and the faint
# end of the catalogue. Magnitude drives the emission; the radius only has to
# keep a faint star from falling below a pixel and disappearing into the
# sampling.
STAR_RADIUS_M = (13.0, 2.0)
STAR_MAGNITUDES = (-1.5, 6.5)

# The flux a magnitude-zero star is given, before its radius is divided out of
# it. An exposure choice, and the only one the night view has beyond the
# camera's own.
STAR_FLUX = 3.0

# The names the star attributes go under. "temperature" would be the obvious
# one and is the one name that cannot be used: Cycles reserves it for volume
# shading, and an Attribute node asking a point cloud for it reads back zero
# and every star comes out the red of a blackbody at nothing.
STAR_TEMPERATURE_ATTRIBUTE = "kelvin"
STAR_FLUX_ATTRIBUTE = "starlight"

# Magnitudes run a factor of four hundred across this catalogue, and a linear
# image exposed for the brightest star loses the faintest one entirely. The
# exponent is compressed from the physical 0.4 to this, which makes that range
# a factor of a hundred and twenty. The night view is a picture of the sky and not a
# photometry of it; the compression is said here rather than hidden.
STAR_MAGNITUDE_EXPONENT = 0.32

# Where the akhet view stands relative to the Sphinx: back along the line it
# looks out on, far enough that the whole statue is in the frame with the two
# pyramids beyond it, and high enough to see over its back. A bearing, a
# distance and a height, all of them composition; the point they are measured
# from is the box's own cited position.
SPHINX_STANDOFF = {"bearing_deg": 114.0, "distance_m": 170.0, "height_m": 26.0}


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opts = {"out": "build/hero.png", "width": "1600", "height": "900", "samples": "128", "engine": "", "view": "dawn", "bake": SKY_BAKE}
    i = 0
    while i < len(argv):
        key = argv[i].lstrip("-")
        if key in opts and i + 1 < len(argv):
            opts[key] = argv[i + 1]
            i += 2
        else:
            i += 1
    return opts


def node_tree_of(datablock):
    """Materials and worlds arrive with a node tree in Blender 5; older ones need asking."""
    if getattr(datablock, "node_tree", None) is None:
        datablock.use_nodes = True
    return datablock.node_tree


def scene_preset():
    """The preset generate.py stamped on the objects, so the render resolves the numbers the meshes were built from."""
    for obj in bpy.data.objects:
        preset = obj.get("seked_preset")
        if preset:
            return preset
    return "canonical"


def mean_course_height():
    """
    The mean thickness of a course of the Great Pyramid's masonry: the original
    height out of the database, divided by the number of courses Petrie
    counted. No height is written down here; if the preset's height changes,
    the courses in the render change with it.
    """
    preset = scene_preset()
    values = resolve(load_database(), preset)["values"]
    height = values.get("g1.height.original")
    if height is None:
        raise SystemExit(f"preset {preset!r} carries no g1.height.original, so the courses have no period")
    return height / PETRIE_COURSES


# --- Materials -------------------------------------------------------------


def principled(name):
    """A material with its node tree and its Principled BSDF, or the one already made and nothing to wire."""
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat, None, None
    mat = bpy.data.materials.new(name)
    tree = node_tree_of(mat)
    return mat, tree, tree.nodes.get("Principled BSDF")


def object_coordinates(tree):
    """Texture coordinates in the object's own frame, so a pyramid's grain does not swim when it is moved."""
    coord = tree.nodes.new("ShaderNodeTexCoord")
    return coord.outputs["Object"]


def noise(tree, vector, scale, detail=2.0):
    """One noise texture at a stated scale, which is in metres because the object frame is."""
    node = tree.nodes.new("ShaderNodeTexNoise")
    node.inputs["Scale"].default_value = scale
    node.inputs["Detail"].default_value = detail
    tree.links.new(vector, node.inputs["Vector"])
    return node.outputs["Fac"]


def map_range(tree, value, low, high):
    """A nought-to-one factor spread across a range, which is how a noise becomes a roughness."""
    node = tree.nodes.new("ShaderNodeMapRange")
    node.inputs["To Min"].default_value = low
    node.inputs["To Max"].default_value = high
    tree.links.new(value, node.inputs["Value"])
    return node.outputs["Result"]


def casing_material():
    """
    Tura limestone: the fine white casing, smooth enough to have been polished,
    with a large-scale variation in roughness so a face catches the light
    unevenly instead of reading as one flat plane.
    """
    mat, tree, bsdf = principled("Tura casing")
    if tree is None:
        return mat
    bsdf.inputs["Base Color"].default_value = (0.88, 0.86, 0.80, 1.0)
    vector = object_coordinates(tree)
    tree.links.new(map_range(tree, noise(tree, vector, 0.04), 0.24, 0.46), bsdf.inputs["Roughness"])
    return mat


def core_material():
    """
    The core masonry, and the Sphinx's massing box with it: a warmer, coarser
    limestone, banded into courses of the mean thickness. The bands are a wave
    texture on the object's own Z, whose period is that thickness, taken
    through a narrow ramp so a course reads as a line at its foot rather than
    as a sine wave. The same ramp drives a shallow bump, which is what makes
    the courses visible at all when the sun is grazing.
    """
    mat, tree, bsdf = principled("Core limestone")
    if tree is None:
        return mat
    vector = object_coordinates(tree)
    course = mean_course_height()
    print(f"core limestone: courses of {course:.4f} m, g1.height.original over Petrie's {PETRIE_COURSES}")

    # Blender's banded wave texture runs its sine over 20 * scale * z, so a
    # period of one course is pi / (10 * course). Checked against Blender 5.1
    # by rendering a wall of known height and counting the bands.
    wave = tree.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "Z"
    wave.wave_profile = "SIN"
    wave.inputs["Scale"].default_value = math.pi / (10.0 * course)
    wave.inputs["Distortion"].default_value = 0.35
    wave.inputs["Detail"].default_value = 1.0
    wave.inputs["Detail Scale"].default_value = 0.4
    tree.links.new(vector, wave.inputs["Vector"])

    joint = tree.nodes.new("ShaderNodeValToRGB")
    joint.color_ramp.elements[0].position = 0.0
    joint.color_ramp.elements[1].position = 0.11
    tree.links.new(wave.outputs["Fac"], joint.inputs["Fac"])

    stone = tree.nodes.new("ShaderNodeMixRGB")
    stone.blend_type = "MIX"
    stone.inputs["Color1"].default_value = (0.47, 0.40, 0.30, 1.0)   # the shadowed joint
    stone.inputs["Color2"].default_value = (0.63, 0.55, 0.42, 1.0)   # the weathered face of a block
    tree.links.new(joint.outputs["Color"], stone.inputs["Fac"])
    tree.links.new(stone.outputs["Color"], bsdf.inputs["Base Color"])
    tree.links.new(map_range(tree, noise(tree, vector, 0.5, 6.0), 0.72, 0.95), bsdf.inputs["Roughness"])

    bump = tree.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.22
    bump.inputs["Distance"].default_value = 0.25
    tree.links.new(joint.outputs["Color"], bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def granite_material():
    """Aswan granite, the dark red-brown of the King's Chamber, with a fine noise for its grain."""
    mat, tree, bsdf = principled("Aswan granite")
    if tree is None:
        return mat
    vector = object_coordinates(tree)
    grain = noise(tree, vector, 14.0, 6.0)
    colour = tree.nodes.new("ShaderNodeMixRGB")
    colour.inputs["Color1"].default_value = (0.20, 0.13, 0.12, 1.0)
    colour.inputs["Color2"].default_value = (0.38, 0.24, 0.21, 1.0)
    tree.links.new(grain, colour.inputs["Fac"])
    tree.links.new(colour.outputs["Color"], bsdf.inputs["Base Color"])
    tree.links.new(map_range(tree, grain, 0.32, 0.55), bsdf.inputs["Roughness"])
    return mat


def sand_material():
    """The plateau: pale, rough, and softly undulating over tens of metres so the ground is not a sheet."""
    mat, tree, bsdf = principled("Plateau sand")
    if tree is None:
        return mat
    vector = object_coordinates(tree)
    drift = noise(tree, vector, 0.02, 4.0)
    colour = tree.nodes.new("ShaderNodeMixRGB")
    colour.inputs["Color1"].default_value = (*SAND_COLOURS[0], 1.0)
    colour.inputs["Color2"].default_value = (*SAND_COLOURS[1], 1.0)
    tree.links.new(drift, colour.inputs["Fac"])
    tree.links.new(colour.outputs["Color"], bsdf.inputs["Base Color"])
    tree.links.new(map_range(tree, noise(tree, vector, 0.3, 6.0), 0.86, 1.0), bsdf.inputs["Roughness"])

    bump = tree.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
    bump.inputs["Distance"].default_value = 1.5
    tree.links.new(drift, bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def assign_materials():
    """
    Four materials over the whole scene, by what an object is. The Sphinx's box
    takes the core limestone: the statue is cut out of the plateau's own rock
    and was never cased, and the box is a placeholder for it either way.
    """
    casing = casing_material()
    core = core_material()
    granite = granite_material()
    sand = sand_material()
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        name = obj.name
        if name.startswith("Terrain"):
            mat = sand
        elif name.startswith("Sphinx") or "(today)" in name:
            mat = core
        elif "(as built)" in name:
            mat = casing
        else:
            mat = granite
        obj.data.materials.clear()
        obj.data.materials.append(mat)


def make_translucent(obj, alpha):
    """Keep the casing visible as a shell while the interior shows through it."""
    mat = obj.data.materials[0].copy()
    mat.name = f"{mat.name} (translucent)"
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Alpha"].default_value = alpha
    for attr, value in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
        if hasattr(mat, attr):
            try:
                setattr(mat, attr, value)
            except TypeError:
                pass
    if hasattr(mat, "use_backface_culling"):
        mat.use_backface_culling = True
    obj.data.materials[0] = mat


# --- The sky bake ----------------------------------------------------------


def load_bake(path):
    """The baked sky, or None with a warning loud enough to notice in a log."""
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"WARNING: no sky bake at {path}. Run `pnpm sky-bake` and render again;")
        print("WARNING: falling back to the placeholder angles in VIEWS, which are lighting and not astronomy.")
        return None


def baked_sun(bake, view):
    """
    Where this view's sun is, where it is seen, its azimuth, and a sentence
    saying where all three came from. Azimuth is from north through east, the
    convention `packages/sky/src/horizon.ts` states and the project frame
    follows.

    Both altitudes are the bake's. The geometric one is what a claim is about;
    the apparent one is where the air puts the disc, which at sunset is most of
    a degree higher and is the difference between a picture with a sun in it
    and one without. A sun with no disc to draw is given none, and then the two
    are the same number.
    """
    moment = (bake or {}).get("moments", {}).get(view["moment"])
    if moment is None:
        if bake is not None:
            print(f"WARNING: the sky bake has no moment {view['moment']!r}; falling back to the placeholder angles.")
        altitude, azimuth = view["placeholder_sun"]
        return altitude, altitude, azimuth, "a placeholder in VIEWS, not a computed position"
    sun = moment["sun"]
    altitude = sun["altitudeDeg"]
    provenance = f"{view['moment']} at epoch {moment['epoch']}, from {moment['from']['azimuth']}"
    return altitude, sun.get("apparentAltitudeDeg", altitude), sun["azimuthDeg"], provenance


# --- Sky, sun and stars ----------------------------------------------------


def site_altitude():
    """The observer's height above the sea, off the terrain object where generate.py recorded it."""
    for obj in bpy.data.objects:
        elevation = obj.get("seked_origin_elevation_m")
        if elevation is not None:
            return float(elevation)
    return 0.0


def sky_type():
    """
    Blender 5.1 split what it used to call Nishita into a single-scattering and
    a multiple-scattering model. The multiple-scattering one is the sky to
    render a low sun under, because it is the one that still lights the ground
    when the direct beam is nearly gone; an older Blender is asked for Nishita
    by its old name.
    """
    available = {item.identifier for item in bpy.types.ShaderNodeTexSky.bl_rna.properties["sky_type"].enum_items}
    for name in ("MULTIPLE_SCATTERING", "NISHITA", "SINGLE_SCATTERING", "HOSEK_WILKIE"):
        if name in available:
            return name
    raise RuntimeError(f"no usable sky model among {sorted(available)}")


def sky_node(tree, altitude_deg, azimuth_deg, disc):
    """
    One Sky Texture in the desert air, aimed at the baked sun.

    `sun_rotation` turns the sun about the zenith. An equirectangular probe of
    Blender 5.1 puts the sun in +Y at rotation 0 and in +X at rotation 90, and
    in this project's frame +Y is north and +X is east, so the rotation is the
    azimuth itself, measured from north through east, and needs no conversion
    at all. `sun_elevation` is the altitude, the same way round.
    """
    sky = tree.nodes.new("ShaderNodeTexSky")
    sky.sky_type = sky_type()
    sky.sun_elevation = math.radians(altitude_deg)
    sky.sun_rotation = math.radians(azimuth_deg)
    sky.sun_disc = disc
    sky.altitude = site_altitude()
    sky.air_density = AIR_DENSITY
    sky.aerosol_density = AEROSOL_DENSITY
    sky.ozone_density = OZONE_DENSITY
    sky.ground_albedo = GROUND_ALBEDO
    return sky


def build_world(scene, altitude_deg, azimuth_deg, fill):
    """
    The physical sky, driven by the same sun the lamp is.

    The texture goes in twice. A camera ray sees it with its sun disc, because
    the akhet view is a picture of that disc standing in the gap between two
    pyramids and where it stands is the claim. Every other ray sees the same
    sky without the disc, so the light falling on the stones comes from the
    lamp alone and the sun is not delivered twice. The lamp is hidden from
    camera rays for the same reason, so the sun in the frame is drawn once.

    The drawn disc is at the texture's own radiance, which is the sun's, and
    no exposure that keeps a landscape printable can hold it: it comes out
    white with a warm surround, which is what a photograph of a sun on the
    horizon does too.

    `fill` is a flat term added underneath, for the night view. A moonless
    night sky is not black, and neither the star dome nor a sun tens of degrees
    down will light a pyramid. It stands in for airglow and starlight, and it
    is an exposure decision rather than a light that was computed.
    """
    world = bpy.data.worlds.new("Seked sky")
    scene.world = world
    tree = node_tree_of(world)
    tree.nodes.clear()
    out = tree.nodes.new("ShaderNodeOutputWorld")

    seen = sky_node(tree, altitude_deg, azimuth_deg, True)
    lighting = sky_node(tree, altitude_deg, azimuth_deg, False)
    path = tree.nodes.new("ShaderNodeLightPath")
    disc = tree.nodes.new("ShaderNodeMixRGB")
    tree.links.new(path.outputs["Is Camera Ray"], disc.inputs["Fac"])
    tree.links.new(lighting.outputs[0], disc.inputs["Color1"])
    tree.links.new(seen.outputs[0], disc.inputs["Color2"])

    background = tree.nodes.new("ShaderNodeBackground")
    tree.links.new(disc.outputs["Color"], background.inputs["Color"])
    surface = background.outputs[0]

    if fill > 0.0:
        airglow = tree.nodes.new("ShaderNodeBackground")
        airglow.inputs["Color"].default_value = (0.09, 0.13, 0.26, 1.0)
        airglow.inputs["Strength"].default_value = fill
        add = tree.nodes.new("ShaderNodeAddShader")
        tree.links.new(surface, add.inputs[0])
        tree.links.new(airglow.outputs[0], add.inputs[1])
        surface = add.outputs[0]

    tree.links.new(surface, out.inputs["Surface"])
    return world


def beam(altitude_deg):
    """
    The colour and the strength of the direct beam at this altitude, through
    the same air the sky texture is given.

    Kasten and Young's (1989) relative air mass for the altitude, a Rayleigh
    optical depth per channel from Penndorf's 0.008735 * lambda^-4.08, a grey
    term for the dust, and Beer's law. That is what turns a low sun orange and
    a high one white, and it is why nothing here picks a colour.

    The air mass is taken at the horizon for anything at or below it: the
    formula runs away below zero and a beam that has to bend to arrive is past
    what this approximation is for. A physically extinguished beam at the
    horizon is a few hundredths of a zenith one, which is about right, and it
    is why the akhet view is lit mostly by its sky, as a photograph of a sunset
    is.
    """
    h = max(altitude_deg, 0.0)
    air_mass = 1.0 / (math.sin(math.radians(h)) + 0.50572 * (h + 6.07995) ** -1.6364)
    transmitted = [
        math.exp(-(0.008735 * um ** -4.08 + AEROSOL_OPTICAL_DEPTH * AEROSOL_DENSITY) * air_mass)
        for um in BEAM_WAVELENGTHS_UM
    ]
    brightest = max(transmitted)
    colour = tuple(channel / brightest for channel in transmitted)
    return colour, BEAM_AT_ZENITH * luminance(transmitted), air_mass


def build_sun(scene, altitude_deg, apparent_deg, azimuth_deg):
    """
    The sun lamp, pointed by the baked angles. A sun lamp is a direction, and
    the direction wanted is the one the light travels: from the sun down to the
    ground, which is the negative of the unit vector at that altitude and
    azimuth in the project's east-north-up frame. The lamp's own -Z is aimed
    along it.

    The light arrives along the refracted path, so the lamp hangs at the
    apparent altitude rather than the geometric one. Refraction does not touch
    the azimuth, which is the coordinate the claims are about.

    Returns None when the disc has set, so the night view gets no beam.
    """
    from mathutils import Vector

    if altitude_deg < BEAM_LIMIT_DEG:
        print(f"  sun {altitude_deg:.3f} degrees below the horizon: no direct beam, the sky and the stars are the light")
        return None
    colour, energy, air_mass = beam(apparent_deg)
    data = bpy.data.lights.new("Sun", "SUN")
    data.energy = energy
    data.angle = math.radians(0.53)  # the sun's own width, so a shadow has the penumbra it has
    data.color = colour
    lamp = bpy.data.objects.new("Sun", data)
    scene.collection.objects.link(lamp)

    elevation, azimuth = math.radians(apparent_deg), math.radians(azimuth_deg)
    towards_sun = Vector((math.cos(elevation) * math.sin(azimuth), math.cos(elevation) * math.cos(azimuth), math.sin(elevation)))
    lamp.rotation_euler = (-towards_sun).to_track_quat("-Z", "Y").to_euler()
    # Cycles draws a sun lamp's own disc to camera rays, at a radiance no
    # exposure a landscape is printed at can hold, so it lands as a white hole
    # wherever the sun is. The sky texture's disc is the one that is drawn.
    lamp.visible_camera = False
    print(f"  sun lamp {energy:.4f} W/m2, colour ({colour[0]:.3f}, {colour[1]:.3f}, {colour[2]:.3f}), air mass {air_mass:.2f}")
    return lamp


def blackbody_temperature(colour_index):
    """
    Ballesteros's (2012) effective temperature from a colour index B - V, which
    is what the catalogue carries and what a star's colour is. Clamped at both
    ends, because the formula is fitted over the main sequence and the
    catalogue holds a few stars either side of it.
    """
    denominator = 0.92 * colour_index
    kelvin = 4600.0 * (1.0 / (denominator + 1.7) + 1.0 / (denominator + 0.62))
    return min(max(kelvin, 2000.0), 25000.0)


def starlight_material():
    """
    One emissive material for the whole dome. A star's colour is its own
    temperature and its brightness its own magnitude, both read off point
    attributes, so eight thousand stars are eight thousand different lights and
    still one material on one object.
    """
    mat = bpy.data.materials.new("Starlight")
    tree = node_tree_of(mat)
    tree.nodes.clear()
    out = tree.nodes.new("ShaderNodeOutputMaterial")
    emission = tree.nodes.new("ShaderNodeEmission")

    temperature = tree.nodes.new("ShaderNodeAttribute")
    temperature.attribute_name = STAR_TEMPERATURE_ATTRIBUTE
    blackbody = tree.nodes.new("ShaderNodeBlackbody")
    tree.links.new(temperature.outputs["Fac"], blackbody.inputs["Temperature"])
    tree.links.new(blackbody.outputs["Color"], emission.inputs["Color"])

    radiance = tree.nodes.new("ShaderNodeAttribute")
    radiance.attribute_name = STAR_FLUX_ATTRIBUTE
    tree.links.new(radiance.outputs["Fac"], emission.inputs["Strength"])

    tree.links.new(emission.outputs[0], out.inputs["Surface"])
    return mat


def build_star_dome(scene, bake, centre):
    """
    The bright catalogue as one point cloud. Every star's altitude and azimuth
    was computed in the bake, for the epoch and the sidereal time it names; all
    this does is put each one on a sphere, by the same east-north-up convention
    `enuDirection` uses, and size and colour it from the magnitude and the
    colour index that travelled with it.

    The sphere is centred on `centre`, which is the eye. A star is at infinity
    and a sphere of five kilometres is only standing in for that, so a dome
    centred anywhere else gives every star a parallax of about the offset over
    the radius: from a camera three hundred metres off the origin that is three
    degrees, and Alnitak would not be on the meridian after all. Centred on the
    camera, each star sits at exactly the altitude and azimuth the bake gives
    it.

    Stars below the horizon are dropped rather than buried: the dome is wider
    than the terrain grid, so one under the ground would hang in the air past
    its edge.
    """
    if bake is None:
        print("WARNING: no sky bake, so no stars. The night view will be an empty sky.")
        return None
    stars = bake["stars"]
    column = {name: i for i, name in enumerate(stars["columns"])}
    rows = [row for row in stars["stars"] if row[column["altDeg"]] > 0.0]

    bright_radius, faint_radius = STAR_RADIUS_M
    bright_mag, faint_mag = STAR_MAGNITUDES
    span = faint_mag - bright_mag

    positions, radii, radiance, temperature = [], [], [], []
    for row in rows:
        azimuth = math.radians(row[column["azDeg"]])
        altitude = math.radians(row[column["altDeg"]])
        horizontal = math.cos(altitude)
        positions += [
            DOME_RADIUS_M * horizontal * math.sin(azimuth),
            DOME_RADIUS_M * horizontal * math.cos(azimuth),
            DOME_RADIUS_M * math.sin(altitude),
        ]
        magnitude = row[column["mag"]]
        fraction = min(max((faint_mag - magnitude) / span, 0.0), 1.0)
        radius = faint_radius + (bright_radius - faint_radius) * fraction
        radii.append(radius)
        # Magnitudes are a logarithmic scale of flux. The radius is spread out
        # for legibility rather than physically, so it is divided back out of
        # the radiance and what a star puts into the frame stays its own.
        radiance.append(STAR_FLUX * 10.0 ** (-STAR_MAGNITUDE_EXPONENT * magnitude) / (radius * radius))
        temperature.append(blackbody_temperature(row[column["ci"]]))

    cloud = bpy.data.pointclouds.new("Sky (bright stars)")
    cloud.resize(len(rows))
    cloud.attributes["position"].data.foreach_set("vector", positions)
    radius_attribute = cloud.attributes.get("radius") or cloud.attributes.new("radius", "FLOAT", "POINT")
    radius_attribute.data.foreach_set("value", radii)
    cloud.attributes.new(STAR_FLUX_ATTRIBUTE, "FLOAT", "POINT").data.foreach_set("value", radiance)
    cloud.attributes.new(STAR_TEMPERATURE_ATTRIBUTE, "FLOAT", "POINT").data.foreach_set("value", temperature)
    cloud.materials.append(starlight_material())

    dome = bpy.data.objects.new("Sky (bright stars)", cloud)
    scene.collection.objects.link(dome)
    dome.location = centre
    dome.visible_shadow = False
    dome.update_tag()
    for key, value in (
        ("seked_sky_epoch", stars["epoch"]),
        ("seked_sky_lst_deg", stars["lstDeg"]),
        ("seked_sky_meridian", f"{stars['meridian']['name']} ({stars['meridian']['from']})"),
        ("seked_sources", stars["catalogue"]["source"]),
        ("seked_attribution", stars["catalogue"]["attribution"]),
    ):
        dome[key] = value

    print(
        f"  star dome: {len(rows)} of {stars['catalogue']['count']} above the horizon to magnitude "
        f"{stars['catalogue']['magnitudeLimit']}, epoch {stars['epoch']}, sidereal time {stars['lstDeg']:.3f} deg, "
        f"{stars['meridian']['name']} on the meridian"
    )
    return dome


# --- Views -----------------------------------------------------------------

VIEWS = {
    # Each view names a moment in build/sky-bake.json. `placeholder_sun` is the
    # altitude and azimuth used only when that file is missing, so a render
    # still happens and says it is not the sky. `location` and `target` are in
    # the project frame, metres, +X east, +Y north, +Z up. `exposure` is the
    # camera's, in stops, and is composition rather than physics.
    "dawn": {
        "moment": "equinox-sunrise-plus-hour",
        "location": (700.0, 300.0, 45.0),
        "target": (-60.0, -90.0, 40.0),
        "lens": 55.0,
        "exposure": -4.2,
        "fill": 0.0,
        "placeholder_sun": (6.0, 90.0),
    },
    "cutaway": {
        "moment": "equinox-sunrise-plus-hour",
        "location": (430.0, 170.0, 130.0),
        "target": (-15.0, -5.0, 50.0),
        "lens": 40.0,
        "exposure": -3.5,
        "fill": 0.0,
        "placeholder_sun": (35.0, 135.0),
    },
    "akhet": {
        # Looking at the middle of the gap between the Great Pyramid's
        # south-west corner and Khafre's north-east one, which is C6's own
        # target, from a stand in front of the Sphinx. The camera is taken off
        # the box itself, so it follows the cited coordinates instead of
        # repeating them; the location here is what is used if the Sphinx is
        # not in the scene.
        "moment": "solstice-summer-sunset",
        "location": (503.1, -501.5, 46.2),
        "from_object": "Sphinx (massing placeholder)",
        "target": (-206.4, -132.1, 67.1),
        "lens": 50.0,
        "exposure": -2.0,
        "fill": 0.0,
        "placeholder_sun": (-0.833, 298.0),
    },
    "night": {
        "moment": "alnitak-transit",
        "location": (0.0, 300.0, 45.0),
        "target": (0.0, -200.0, 268.0),
        "lens": 20.0,
        "exposure": 5.5,
        "fill": 0.006,
        "stars": True,
        "placeholder_sun": (-37.0, 262.0),
    },
}


def look_at(obj, target):
    direction = (target - obj.location).normalized()
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def sphinx_viewpoint(name, fallback):
    """
    Where the akhet is photographed from: back along the line the Sphinx looks
    out on, high enough that its back is in the frame with the pyramids beyond
    it. The bearing, the distance and the height are composition; the place
    they are measured from is the box's own cited position, so the viewpoint
    follows those coordinates instead of repeating them.
    """
    from mathutils import Vector

    obj = bpy.data.objects.get(name)
    if obj is None:
        print(f"WARNING: no {name!r} in the scene; standing at the fallback viewpoint instead.")
        return Vector(fallback)
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    centre_east = sum(corner.x for corner in corners) / len(corners)
    centre_north = sum(corner.y for corner in corners) / len(corners)
    top = max(corner.z for corner in corners)
    bearing = math.radians(SPHINX_STANDOFF["bearing_deg"])
    distance = SPHINX_STANDOFF["distance_m"]
    return Vector((
        centre_east + distance * math.sin(bearing),
        centre_north + distance * math.cos(bearing),
        top + SPHINX_STANDOFF["height_m"],
    ))


def setup_view(scene, name, view, bake):
    """The camera, the sun, the sky and, for the night view, the stars. Everything chosen is printed."""
    from mathutils import Vector

    altitude_deg, apparent_deg, azimuth_deg, provenance = baked_sun(bake, view)
    location = sphinx_viewpoint(view["from_object"], view["location"]) if "from_object" in view else Vector(view["location"])
    target = Vector(view["target"])

    cam_data = bpy.data.cameras.new("Hero camera")
    cam_data.lens = view["lens"]
    cam_data.clip_end = 4.0 * DOME_RADIUS_M
    cam = bpy.data.objects.new("Hero camera", cam_data)
    scene.collection.objects.link(cam)
    cam.location = location
    look_at(cam, target)
    scene.camera = cam

    if name == "cutaway":
        g1 = bpy.data.objects.get("G1 Khufu (as built)")
        if g1 is not None:
            make_translucent(g1, 0.15)

    print(f"view {name}: sun altitude {altitude_deg:.3f} deg, seen at {apparent_deg:.3f} deg, azimuth {azimuth_deg:.3f} deg ({provenance})")
    build_world(scene, apparent_deg, azimuth_deg, view.get("fill", 0.0))
    build_sun(scene, altitude_deg, apparent_deg, azimuth_deg)
    if view.get("stars"):
        build_star_dome(scene, bake, location)
    scene.view_settings.exposure = view.get("exposure", 0.0)

    towards = target - location
    bearing = math.degrees(math.atan2(towards.x, towards.y)) % 360.0
    pitch = math.degrees(math.atan2(towards.z, math.hypot(towards.x, towards.y)))
    print(f"  camera at ({location.x:.1f}, {location.y:.1f}, {location.z:.1f}) m looking at ({target.x:.1f}, {target.y:.1f}, {target.z:.1f}) m")
    print(f"  bearing {bearing:.1f} deg, pitch {pitch:+.1f} deg, {view['lens']:.0f} mm, exposure {scene.view_settings.exposure:+.1f} stops")


def show_ground_only():
    """
    Of the three terrain objects the generator writes, render the two that are
    ground: "Terrain (ground)", the near grid flattened under the pyramids, and
    "Terrain (far context)", the coarse ring that carries the horizon out to
    twelve kilometres. The raw GLO-30 grid stays hidden, because it lies under
    the flattened one and turns the monuments into mounds. Both are shaded
    smooth: a grid this coarse is a sampled landscape, not a field of facets.
    """
    shown = ("Terrain (ground)", "Terrain (far context)")
    for obj in bpy.data.objects:
        if not obj.name.startswith("Terrain"):
            continue
        visible = obj.name in shown
        obj.hide_set(not visible)
        obj.hide_render = not visible
        if visible:
            for poly in obj.data.polygons:
                poly.use_smooth = True


def choose_engine(scene, requested):
    """
    Cycles, because the sky texture, the sun's penumbra and eight thousand
    emissive points all want a path tracer. Its identifier is not in the engine
    enum until the add-on registers it, so the assignment is tried rather than
    looked up, and EEVEE is the fallback for a build without it.
    """
    for engine in ([requested] if requested else []) + ["CYCLES", "BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"]:
        try:
            scene.render.engine = engine
        except TypeError:
            continue
        return engine
    raise RuntimeError("no usable render engine")


def main():
    opts = parse_args()
    scene = bpy.context.scene
    if opts["view"] not in VIEWS:
        raise SystemExit(f"unknown view {opts['view']!r}; choose from {sorted(VIEWS)}")
    view = VIEWS[opts["view"]]

    assign_materials()
    show_ground_only()
    setup_view(scene, opts["view"], view, load_bake(opts["bake"]))
    engine = choose_engine(scene, opts["engine"])
    samples = int(opts["samples"])
    if engine.startswith("BLENDER_EEVEE"):
        scene.eevee.taa_render_samples = samples
    elif engine == "CYCLES":
        scene.cycles.samples = samples
        scene.cycles.use_denoising = True
    scene.render.resolution_x = int(opts["width"])
    scene.render.resolution_y = int(opts["height"])
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    out = os.path.abspath(opts["out"])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    scene.render.filepath = out
    started = time.time()
    bpy.ops.render.render(write_still=True)
    elapsed = time.time() - started
    print(f"rendered {out} with {engine}, {samples} samples, in {elapsed:.1f} s ({elapsed / 60:.1f} min)")


if __name__ == "__main__":
    main()
