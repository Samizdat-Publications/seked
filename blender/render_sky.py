"""
The sky, the sun and the stars, for `render.py` and `rollback.py`.

Not one sun or star position is computed here, and none is typed here. They
come from the files `pnpm sky-bake` writes out of `@seked/sky` and the
measurement database: `build/sky-bake.json` for the four still views, and
`build/sky-rollback.json` with its binary beside it for the cinematic. This
module only converts an altitude and an azimuth into Blender's conventions,
and says where each number came from.
"""
import array
import json
import math
import os
import sys

import bpy

from render_materials import GROUND_ALBEDO, luminance, node_tree_of

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(HERE)
SKY_BAKE = os.path.join(REPO_ROOT, "build", "sky-bake.json")

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
# whole terrain grid, and well inside the camera's far clip. A star is at
# infinity and the sphere only stands in for that; see `build_star_dome` for
# what the radius costs.
DOME_RADIUS_M = 5000.0

# A star's drawn radius in metres on a dome of DOME_RADIUS_M, at the bright
# and the faint end of the catalogue. Magnitude drives the emission; the
# radius only has to keep a faint star from falling below a pixel and
# disappearing into the sampling. A dome of another radius scales them.
STAR_RADIUS_M = (13.0, 2.0)
STAR_MAGNITUDES = (-1.5, 6.5)

# The flux a magnitude-zero star is given, before its radius is divided out of
# it. An exposure choice, and the only one the night view has beyond the
# camera's own and the fill.
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
# a factor of a hundred and twenty. The night view is a picture of the sky and
# not a photometry of it; the compression is said here rather than hidden.
STAR_MAGNITUDE_EXPONENT = 0.32

# What a moonless sky is given, per unit of `fill`: a faint blue, for the
# airglow and the starlight that a sun tens of degrees down does not deliver.
AIRGLOW_COLOUR = (0.09, 0.13, 0.26, 1.0)


# --- The bake ----------------------------------------------------------------


def load_bake(path):
    """The baked sky, or None with a warning loud enough to notice in a log."""
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"WARNING: no sky bake at {path}. Run `pnpm sky-bake` and render again;")
        print("WARNING: falling back to the placeholder angles in VIEWS, which are lighting and not astronomy.")
        return None


def load_rollback(path):
    """
    The cinematic's bake: the header, and the binary of every star's azimuth
    and altitude at every frame. The header says how the binary is laid out
    and the checksum is not repeated here; the file is read as the header
    describes it and its length is checked against the count it states.
    """
    with open(path, encoding="utf-8") as f:
        header = json.load(f)
    binary = os.path.join(os.path.dirname(path), header["positions"]["file"])
    values = array.array("f")
    with open(binary, "rb") as f:
        values.frombytes(f.read())
    if sys.byteorder != "little":
        values.byteswap()
    frames, count = len(header["frames"]), header["catalogue"]["count"]
    expected = frames * count * 2
    if len(values) != expected:
        raise SystemExit(f"{binary} holds {len(values)} numbers, not the {frames} x {count} x 2 the header describes")
    return header, values


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


# --- Sky and sun -------------------------------------------------------------


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

    `fill` is a flat term added underneath, for the night. A moonless night
    sky is not black, and neither the star dome nor a sun tens of degrees
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
        airglow.inputs["Color"].default_value = AIRGLOW_COLOUR
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

    The lamp's colour is the transmitted triple scaled so its brightest
    channel is one, and its strength is the zenith irradiance times that
    brightest channel, so what Blender multiplies out is exactly the zenith
    irradiance times the transmission in every channel. (An earlier version
    scaled the strength by the triple's luminance as well, and so counted the
    beam's own dimming twice.)

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
    return colour, BEAM_AT_ZENITH * brightest, air_mass


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
    print(f"  sun lamp {energy:.4f} on the sky texture's scale, colour ({colour[0]:.3f}, {colour[1]:.3f}, {colour[2]:.3f}), "
          f"luminance {luminance(colour) * energy:.4f}, air mass {air_mass:.2f}")
    return lamp


# --- The stars ---------------------------------------------------------------


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
    mat = bpy.data.materials.get("Starlight")
    if mat is not None:
        return mat
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


def dome_point(azimuth_deg, altitude_deg, radius):
    """A point on a sphere of `radius` at that altitude and azimuth, by the same east-north-up convention `enuDirection` uses."""
    azimuth, altitude = math.radians(azimuth_deg), math.radians(altitude_deg)
    horizontal = math.cos(altitude)
    return (radius * horizontal * math.sin(azimuth), radius * horizontal * math.cos(azimuth), radius * math.sin(altitude))


def star_radius(magnitude, radius):
    """The drawn radius for a magnitude, on a dome of `radius`, between the bright and the faint ends."""
    bright_radius, faint_radius = (r * radius / DOME_RADIUS_M for r in STAR_RADIUS_M)
    bright_mag, faint_mag = STAR_MAGNITUDES
    fraction = min(max((faint_mag - magnitude) / (faint_mag - bright_mag), 0.0), 1.0)
    return faint_radius + (bright_radius - faint_radius) * fraction


def star_radiance(magnitude, radius):
    """
    Magnitudes are a logarithmic scale of flux. The drawn radius is spread out
    for legibility rather than physically, so it is divided back out of the
    radiance and what a star puts into the frame stays its own.
    """
    return STAR_FLUX * 10.0 ** (-STAR_MAGNITUDE_EXPONENT * magnitude) / (radius * radius)


def make_star_cloud(name, magnitudes, colour_indices, radius, provenance):
    """
    A point cloud with one point per star, sized and coloured from the
    magnitude and colour index, at no position yet: `place_stars` puts them
    where a bake says. Stars are never dropped from the cloud; one that is
    below the horizon at some moment is given no radius at that moment.
    """
    count = len(magnitudes)
    cloud = bpy.data.pointclouds.new(name)
    cloud.resize(count)
    radii = [star_radius(m, radius) for m in magnitudes]
    cloud.attributes.new(STAR_FLUX_ATTRIBUTE, "FLOAT", "POINT").data.foreach_set(
        "value", [star_radiance(m, r) for m, r in zip(magnitudes, radii)])
    cloud.attributes.new(STAR_TEMPERATURE_ATTRIBUTE, "FLOAT", "POINT").data.foreach_set(
        "value", [blackbody_temperature(ci) for ci in colour_indices])
    cloud.materials.append(starlight_material())
    dome = bpy.data.objects.new(name, cloud)
    dome.visible_shadow = False
    for key, value in provenance.items():
        dome[key] = value
    return dome, radii


def place_stars(dome, radii, azimuths, altitudes, radius):
    """
    Put every star of the cloud at its altitude and azimuth on a dome of
    `radius` about the object's own origin, and give the ones below the
    horizon no radius, which is how a point cloud hides a point. The dome is
    wider than the terrain, so a star under the ground would otherwise hang in
    the air past its edge.
    """
    positions, drawn = [], []
    for azimuth, altitude, r in zip(azimuths, altitudes, radii):
        positions += dome_point(azimuth, altitude, radius)
        drawn.append(r if altitude > 0.0 else 0.0)
    cloud = dome.data
    cloud.attributes["position"].data.foreach_set("vector", positions)
    attribute = cloud.attributes.get("radius") or cloud.attributes.new("radius", "FLOAT", "POINT")
    attribute.data.foreach_set("value", drawn)
    cloud.update_tag()
    dome.update_tag()
    return sum(1 for r in drawn if r > 0.0)


def build_star_dome(scene, bake, centre):
    """
    The bright catalogue as one point cloud. Every star's altitude and azimuth
    was computed in the bake, for the epoch and the sidereal time it names; all
    this does is put each one on a sphere and size and colour it from the
    magnitude and the colour index that travelled with it.

    The sphere is centred on `centre`, which is the eye. A star is at infinity
    and a sphere of five kilometres is only standing in for that, so a dome
    centred anywhere else gives every star a parallax of about the offset over
    the radius: from a camera three hundred metres off the origin that is three
    degrees, and Alnitak would not be on the meridian after all. Centred on the
    camera, each star sits at exactly the altitude and azimuth the bake gives
    it.
    """
    if bake is None:
        print("WARNING: no sky bake, so no stars. The night view will be an empty sky.")
        return None
    stars = bake["stars"]
    column = {name: i for i, name in enumerate(stars["columns"])}
    rows = stars["stars"]
    dome, radii = make_star_cloud(
        "Sky (bright stars)",
        [row[column["mag"]] for row in rows],
        [row[column["ci"]] for row in rows],
        DOME_RADIUS_M,
        {
            "seked_sky_epoch": stars["epoch"],
            "seked_sky_lst_deg": stars["lstDeg"],
            "seked_sky_meridian": f"{stars['meridian']['name']} ({stars['meridian']['from']})",
            "seked_sources": stars["catalogue"]["source"],
            "seked_attribution": stars["catalogue"]["attribution"],
        },
    )
    scene.collection.objects.link(dome)
    dome.location = centre
    up = place_stars(dome, radii, [row[column["azDeg"]] for row in rows], [row[column["altDeg"]] for row in rows], DOME_RADIUS_M)
    print(
        f"  star dome: {up} of {stars['catalogue']['count']} above the horizon to magnitude "
        f"{stars['catalogue']['magnitudeLimit']}, epoch {stars['epoch']}, sidereal time {stars['lstDeg']:.3f} deg, "
        f"{stars['meridian']['name']} on the meridian"
    )
    return dome
