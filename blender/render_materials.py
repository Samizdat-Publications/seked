"""
The scene's materials, for `render.py` and `rollback.py`.

Base colour, roughness and a bump and nothing else, as the plan says. They are
built here rather than in `generate.py`, which stays material-free, and are
assigned by what an object is. The only numbers in them that come out of the
database are the course thickness the banded limestone uses and the height of
the granite on the cased faces of Khafre's and Menkaure's pyramids.
"""
import json
import math
import os

import bpy

from seked_data import course_heights, load_database, resolve

# Rec. 709 luminance, for turning a colour into the one number that says how
# bright it is: the plateau's albedo, and the strength of a coloured beam.
LUMINANCE_WEIGHTS = (0.2126, 0.7152, 0.0722)


def luminance(rgb):
    return sum(weight * channel for weight, channel in zip(LUMINANCE_WEIGHTS, rgb))


# The two colours the plateau is mixed from, and what that mixture reflects.
# The sky texture wants a single albedo, for the light bouncing off the ground
# back into the sky and for what it draws below the horizon: past the edge of
# the terrain grid that is what the eye sees, and it had better be the same
# ground.
SAND_COLOURS = ((0.52, 0.44, 0.33), (0.72, 0.63, 0.47))
GROUND_ALBEDO = luminance([(dark + light) / 2.0 for dark, light in zip(*SAND_COLOURS)])

# Petrie counted 203 courses of masonry on the Great Pyramid (section 26, and
# the course table in his plate viii). The count is only used when a preset
# carries no course table of its own: then the banded limestone has nothing
# to know but the mean, the original height over this count. Under every
# preset in the database today the Great Pyramid's own 201 courses are Goyon's
# and are stacked as geometry, so the bands are drawn on nothing of his.
PETRIE_COURSES = 203

# The names the materials go under, so a script can tell which is which.
CORE_NAME = "Core limestone"
BANDED_CORE_NAME = "Core limestone (banded)"
CASING_NAME = "Tura casing"
GRANITE_NAME = "Aswan granite"
SAND_NAME = "Plateau sand"

# Same labels the generator uses, to find a pyramid's "(as built)" object.
STRUCTURE_LABELS = {"g1": "G1 Khufu", "g2": "G2 Khafre", "g3": "G3 Menkaure"}


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


_VALUES = {}


def resolved_values():
    """The scene's preset resolved once, so every material reads the same numbers the meshes were built from."""
    preset = scene_preset()
    if preset not in _VALUES:
        _VALUES[preset] = resolve(load_database(), preset)["values"]
    return _VALUES[preset]


def mean_course_height():
    """
    The thickness the banded limestone repeats at, and a sentence saying where
    it came from. The database's own course table when the preset carries one,
    because a mean of measured courses is better than a count; otherwise the
    original height over Petrie's count. No height is written down here.
    """
    values = resolved_values()
    courses = course_heights(values, "g1")
    if courses:
        return sum(courses) / len(courses), f"the mean of the {len(courses)} courses the database carries for g1"
    height = values.get("g1.height.original")
    if height is None:
        raise SystemExit(f"preset {scene_preset()!r} carries neither courses nor g1.height.original, so the bands have no period")
    return height / PETRIE_COURSES, f"g1.height.original over Petrie's {PETRIE_COURSES}"


def granite_casing_height(structure):
    """How high the granite runs up a pyramid's cased faces, or None where the database records none."""
    return resolved_values().get(f"{structure}.casing.granite.height")


# --- Node helpers ----------------------------------------------------------


def new_material(name):
    """A fresh material with its node tree and its Principled BSDF, or the one already made and nothing to wire."""
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


def mix_colours(tree, factor, dark, light):
    node = tree.nodes.new("ShaderNodeMixRGB")
    node.blend_type = "MIX"
    node.inputs["Color1"].default_value = (*dark, 1.0)
    node.inputs["Color2"].default_value = (*light, 1.0)
    tree.links.new(factor, node.inputs["Fac"])
    return node.outputs["Color"]


def bump(tree, height, strength, distance):
    node = tree.nodes.new("ShaderNodeBump")
    node.inputs["Strength"].default_value = strength
    node.inputs["Distance"].default_value = distance
    tree.links.new(height, node.inputs["Height"])
    return node.outputs["Normal"]


# --- Photographed surfaces --------------------------------------------------
#
# The CC0 texture sets `scripts/textures.py` downloads into build/textures/.
# None of them is a measurement. Each is projected onto an object from its own
# frame by box mapping, so no UVs are needed and a pyramid's grain stays put
# when it is moved, at the real-world tile size Poly Haven states for it. A
# face 230 m wide would show a 2 m tile repeating, so every map is sampled
# twice, at its own size and at an odd multiple of it, and the two are
# blended by a noise tens of metres across. Where the textures have not been
# fetched, each stone falls back to its procedural wiring, so a render never
# fails for want of a download.

TEXTURE_INDEX = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "build", "textures", "index.json")
_TEXTURES = {}


def texture_sets():
    """The fetched texture sets by role, or an empty dict where scripts/textures.py has not been run."""
    if "sets" not in _TEXTURES:
        try:
            with open(TEXTURE_INDEX, encoding="utf-8") as f:
                index = json.load(f)
        except OSError:
            print(f"no {TEXTURE_INDEX}: procedural stone only; run python scripts/textures.py for the photographed surfaces")
            index = {"sets": {}}
        root = os.path.dirname(TEXTURE_INDEX)
        for entry in index["sets"].values():
            entry["paths"] = {kind: os.path.join(root, rel) for kind, rel in entry["files"].items()}
        _TEXTURES["sets"] = index["sets"]
    return _TEXTURES["sets"]


def ramp(tree, value, low, high):
    """A value rescaled so `low` is nought and `high` is one, clamped, which is how a noise becomes a mask."""
    node = tree.nodes.new("ShaderNodeMapRange")
    node.inputs["From Min"].default_value = low
    node.inputs["From Max"].default_value = high
    node.clamp = True
    tree.links.new(value, node.inputs["Value"])
    return node.outputs["Result"]


def scaled(tree, vector, factor, offset=(0.0, 0.0, 0.0)):
    node = tree.nodes.new("ShaderNodeMapping")
    node.inputs["Location"].default_value = offset
    node.inputs["Scale"].default_value = (factor, factor, factor)
    tree.links.new(vector, node.inputs["Vector"])
    return node.outputs["Vector"]


def image_map(tree, vector, path, colour):
    node = tree.nodes.new("ShaderNodeTexImage")
    node.image = bpy.data.images.load(path, check_existing=True)
    node.image.colorspace_settings.name = "sRGB" if colour else "Non-Color"
    node.projection = "BOX"
    node.projection_blend = 0.3
    node.interpolation = "Cubic"
    tree.links.new(vector, node.inputs["Vector"])
    return node.outputs["Color"]


def mix_sockets(tree, factor, a, b, blend="MIX"):
    node = tree.nodes.new("ShaderNodeMixRGB")
    node.blend_type = blend
    tree.links.new(factor, node.inputs["Fac"])
    tree.links.new(a, node.inputs["Color1"])
    tree.links.new(b, node.inputs["Color2"])
    return node.outputs["Color"]


def photographed(tree, vector, role, tile_factor=1.0):
    """
    A texture set's colour, roughness and height for `role`, box-projected at
    its stated tile size times `tile_factor` and at 3.7 times that, blended by
    a noise of about 40 m, or None where the set has not been fetched.
    """
    entry = texture_sets().get(role)
    if entry is None:
        return None
    tile = entry["tile_m"][0] * tile_factor
    near = scaled(tree, vector, 1.0 / tile)
    far = scaled(tree, vector, 1.0 / (tile * 3.7), (0.31, 0.17, 0.53))
    blend = ramp(tree, noise(tree, vector, 0.025, 2.0), 0.35, 0.65)
    out = {}
    for key, kind, colour in (("colour", "Diffuse", True), ("rough", "Rough", False), ("height", "Displacement", False)):
        path = entry["paths"][kind]
        out[key] = mix_sockets(tree, blend, image_map(tree, near, path, colour), image_map(tree, far, path, colour))
    return out


def tinted(tree, colour, tint, amount):
    """A photographed colour pulled toward a stated one: `amount` 0 keeps the photograph, 1 is the tint."""
    node = tree.nodes.new("ShaderNodeMixRGB")
    node.blend_type = "MIX"
    node.inputs["Fac"].default_value = amount
    tree.links.new(colour, node.inputs["Color1"])
    node.inputs["Color2"].default_value = (*tint, 1.0)
    return node.outputs["Color"]


def darken(tree, colour, factor, by):
    """`colour` multiplied toward black by `by` where `factor` is one."""
    scale = tree.nodes.new("ShaderNodeMath")
    scale.operation = "MULTIPLY"
    scale.inputs[1].default_value = by
    tree.links.new(factor, scale.inputs[0])
    node = tree.nodes.new("ShaderNodeMixRGB")
    node.blend_type = "MIX"
    tree.links.new(scale.outputs[0], node.inputs["Fac"])
    tree.links.new(colour, node.inputs["Color1"])
    node.inputs["Color2"].default_value = (0.0, 0.0, 0.0, 1.0)
    return node.outputs["Color"]


def block_cells(tree, vector, size):
    """A value per block-sized cell of stone, so neighbouring blocks differ in tone the way quarried blocks do."""
    node = tree.nodes.new("ShaderNodeTexVoronoi")
    node.feature = "F1"
    node.distance = "CHEBYCHEV"
    node.inputs["Scale"].default_value = 1.0 / size
    node.inputs["Randomness"].default_value = 0.85
    tree.links.new(vector, node.inputs["Vector"])
    return node.outputs["Color"]


def streaks(tree, vector):
    """Weathering that runs down a face: a noise stretched sixteen times along Z, as rain and dust leave it."""
    node = tree.nodes.new("ShaderNodeMapping")
    node.inputs["Scale"].default_value = (1.0, 1.0, 1.0 / 16.0)
    tree.links.new(vector, node.inputs["Vector"])
    return ramp(tree, noise(tree, node.outputs["Vector"], 0.35, 5.0), 0.45, 0.75)


# --- The stones, as wiring onto a Principled BSDF --------------------------


def wire_casing(tree, bsdf, vector, weathered=False):
    """
    Tura limestone: the fine white casing, smooth enough to have been polished,
    with a large-scale variation in roughness so a face catches the light
    unevenly instead of reading as one flat plane. With the photographed set,
    its grain is laid faint under the white; `weathered` adds what four and a
    half thousand years leave on the part that still stands, streaks down the
    face and a greyer tone, and is for a pyramid as it is today.
    """
    maps = photographed(tree, vector, "casing", 1.6)
    if maps is None:
        bsdf.inputs["Base Color"].default_value = (0.88, 0.86, 0.80, 1.0)
        tree.links.new(map_range(tree, noise(tree, vector, 0.04), 0.24, 0.46), bsdf.inputs["Roughness"])
        return
    colour = tinted(tree, maps["colour"], (0.86, 0.83, 0.76), 0.55)
    colour = darken(tree, colour, block_cells(tree, vector, 1.4), 0.10)
    rough = map_range(tree, maps["rough"], 0.30, 0.55)
    if weathered:
        colour = tinted(tree, colour, (0.60, 0.56, 0.48), 0.45)
        colour = darken(tree, colour, streaks(tree, vector), 0.30)
        colour = darken(tree, colour, ramp(tree, noise(tree, vector, 0.05, 4.0), 0.45, 0.7), 0.20)
        rough = map_range(tree, maps["rough"], 0.55, 0.85)
    tree.links.new(colour, bsdf.inputs["Base Color"])
    tree.links.new(rough, bsdf.inputs["Roughness"])
    tree.links.new(bump(tree, maps["height"], 0.10 if not weathered else 0.25, 0.03), bsdf.inputs["Normal"])


def wire_granite(tree, bsdf, vector):
    """
    Aswan granite, the dark red-brown of the King's Chamber: the photographed
    granite's crystal grain pulled toward that colour, or a fine noise where
    the set has not been fetched.
    """
    maps = photographed(tree, vector, "granite")
    if maps is None:
        grain = noise(tree, vector, 14.0, 6.0)
        tree.links.new(mix_colours(tree, grain, (0.20, 0.13, 0.12), (0.38, 0.24, 0.21)), bsdf.inputs["Base Color"])
        tree.links.new(map_range(tree, grain, 0.32, 0.55), bsdf.inputs["Roughness"])
        return
    colour = tinted(tree, maps["colour"], (0.30, 0.18, 0.15), 0.55)
    tree.links.new(colour, bsdf.inputs["Base Color"])
    tree.links.new(map_range(tree, maps["rough"], 0.30, 0.60), bsdf.inputs["Roughness"])
    tree.links.new(bump(tree, maps["height"], 0.15, 0.02), bsdf.inputs["Normal"])


BEDROCK_NAME = "Quarried bedrock"


def bedrock_material():
    """
    The bedrock the quarrymen cut back, for the walls of the Sphinx's enclosure:
    the core limestone's banding, so the walls show the same beds the Sphinx's
    body is carved from, with the photographed quarry face's relief over it.
    """
    mat = bpy.data.materials.get(BEDROCK_NAME)
    if mat is not None:
        return mat
    mat, tree, bsdf = new_material(BEDROCK_NAME)
    vector = object_coordinates(tree)
    wire_core(tree, bsdf, vector, mean_course_height()[0])
    maps = photographed(tree, vector, "bedrock", 3.0)
    if maps is not None:
        # The core's bands and colour, with the quarry face's tool-cut relief laid over them.
        tree.links.new(bump(tree, maps["height"], 0.6, 0.25), bsdf.inputs["Normal"])
    return mat


def wire_core(tree, bsdf, vector, course=None):
    """
    The core masonry: a warmer, coarser limestone, its colour wandering block
    by block and its surface pitted. With a `course` it is also banded, a wave
    texture on the object's own Z whose period is that thickness, taken
    through a narrow ramp so a course reads as a line at its foot rather than
    as a sine wave; the same ramp drives a shallow bump, which is what makes
    the courses visible at all when the sun is grazing. Without one the bands
    are left off, because the object's courses are its geometry.
    """
    maps = photographed(tree, vector, "core", 1.0)
    if maps is None:
        blocks = noise(tree, vector, 0.25, 3.0)
        colour = mix_colours(tree, blocks, (0.55, 0.47, 0.36), (0.66, 0.58, 0.45))
        pits = noise(tree, vector, 3.0, 6.0)
        tree.links.new(map_range(tree, pits, 0.72, 0.95), bsdf.inputs["Roughness"])
    else:
        # The photograph pulled a little toward Giza's own warm grey-tan, one
        # tone per block, and weathered darker down the faces.
        colour = tinted(tree, maps["colour"], (0.50, 0.41, 0.30), 0.40)
        cells = block_cells(tree, vector, 1.3)
        colour = mix_sockets(tree, ramp(tree, noise(tree, vector, 0.9, 1.0), 0.3, 0.7), colour, darken(tree, colour, cells, 0.45))
        # Weathered patches tens of metres across, where the outer blocks have
        # spalled or the dust has settled, so a face is not one even tone.
        colour = darken(tree, colour, ramp(tree, noise(tree, vector, 0.035, 4.0), 0.45, 0.7), 0.30)
        colour = darken(tree, colour, streaks(tree, vector), 0.25)
        pits = maps["height"]
        tree.links.new(map_range(tree, maps["rough"], 0.75, 0.98), bsdf.inputs["Roughness"])
    if course is None:
        tree.links.new(colour, bsdf.inputs["Base Color"])
        tree.links.new(bump(tree, pits, 0.12 if maps is None else 0.45, 0.06 if maps is None else 0.08), bsdf.inputs["Normal"])
        return

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

    shaded = tree.nodes.new("ShaderNodeMixRGB")
    shaded.blend_type = "MIX"
    shaded.inputs["Color1"].default_value = (0.47, 0.40, 0.30, 1.0)   # the shadowed joint
    tree.links.new(colour, shaded.inputs["Color2"])                    # the weathered face of a block
    tree.links.new(joint.outputs["Color"], shaded.inputs["Fac"])
    tree.links.new(shaded.outputs["Color"], bsdf.inputs["Base Color"])
    tree.links.new(bump(tree, joint.outputs["Color"], 0.22, 0.25), bsdf.inputs["Normal"])


def wire_sand(tree, bsdf, vector):
    """
    The plateau: pale, rough, and softly undulating over tens of metres so the
    ground is not a sheet. With the photographed sets, fine sand and ground
    strewn with limestone chips, mixed by a noise about 60 m across, over the
    same long undulation.
    """
    drift = noise(tree, vector, 0.02, 4.0)
    sand, gravel = photographed(tree, vector, "sand", 1.0), photographed(tree, vector, "gravel", 1.0)
    if sand is None or gravel is None:
        tree.links.new(mix_colours(tree, drift, *SAND_COLOURS), bsdf.inputs["Base Color"])
        tree.links.new(map_range(tree, noise(tree, vector, 0.3, 6.0), 0.86, 1.0), bsdf.inputs["Roughness"])
        tree.links.new(bump(tree, drift, 0.25, 1.5), bsdf.inputs["Normal"])
        return
    patches = ramp(tree, noise(tree, vector, 0.016, 3.0), 0.42, 0.62)
    colour = mix_sockets(tree, patches, sand["colour"], gravel["colour"])
    colour = mix_sockets(tree, drift, tinted(tree, colour, SAND_COLOURS[0], 0.35), tinted(tree, colour, SAND_COLOURS[1], 0.35))
    height = mix_sockets(tree, patches, sand["height"], gravel["height"])
    tree.links.new(colour, bsdf.inputs["Base Color"])
    tree.links.new(map_range(tree, mix_sockets(tree, patches, sand["rough"], gravel["rough"]), 0.85, 1.0), bsdf.inputs["Roughness"])
    fine = bump(tree, height, 0.35, 0.05)
    broad = tree.nodes.new("ShaderNodeBump")
    broad.inputs["Strength"].default_value = 0.25
    broad.inputs["Distance"].default_value = 1.5
    tree.links.new(drift, broad.inputs["Height"])
    tree.links.new(fine, broad.inputs["Normal"])
    tree.links.new(broad.outputs["Normal"], bsdf.inputs["Normal"])


# --- The materials ---------------------------------------------------------


def casing_material():
    mat, tree, bsdf = new_material(CASING_NAME)
    if tree is not None:
        wire_casing(tree, bsdf, object_coordinates(tree))
    return mat


def granite_material():
    mat, tree, bsdf = new_material(GRANITE_NAME)
    if tree is not None:
        wire_granite(tree, bsdf, object_coordinates(tree))
    return mat


def core_material(banded=False):
    """Plain for an object whose courses are geometry; banded, at the database's mean course, for one whose are not."""
    mat, tree, bsdf = new_material(BANDED_CORE_NAME if banded else CORE_NAME)
    if tree is None:
        return mat
    course = None
    if banded:
        course, provenance = mean_course_height()
        print(f"{BANDED_CORE_NAME}: courses of {course:.4f} m, {provenance}")
    wire_core(tree, bsdf, object_coordinates(tree), course)
    return mat


def sand_material():
    mat, tree, bsdf = new_material(SAND_NAME)
    if tree is not None:
        wire_sand(tree, bsdf, object_coordinates(tree))
    return mat


def casing_over_granite_material(structure, label, height):
    """
    A cased face that is granite up to `height` above the base and Tura
    limestone above it: Menkaure's lowest sixteen courses (Petrie section 82)
    and the foot of Khafre's (section 68). The object's own Z is height above
    its base, so the switch is a comparison against the record and nothing is
    placed by hand.
    """
    name = f"{CASING_NAME} over {GRANITE_NAME} ({label})"
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat
    mat = bpy.data.materials.new(name)
    tree = node_tree_of(mat)
    tree.nodes.clear()
    out = tree.nodes.new("ShaderNodeOutputMaterial")
    vector = object_coordinates(tree)

    granite = tree.nodes.new("ShaderNodeBsdfPrincipled")
    wire_granite(tree, granite, vector)
    casing = tree.nodes.new("ShaderNodeBsdfPrincipled")
    wire_casing(tree, casing, vector)

    split = tree.nodes.new("ShaderNodeSeparateXYZ")
    tree.links.new(vector, split.inputs["Vector"])
    above = tree.nodes.new("ShaderNodeMath")
    above.operation = "GREATER_THAN"
    above.inputs[1].default_value = height
    tree.links.new(split.outputs["Z"], above.inputs[0])

    mix = tree.nodes.new("ShaderNodeMixShader")
    tree.links.new(above.outputs["Value"], mix.inputs["Fac"])
    tree.links.new(granite.outputs[0], mix.inputs[1])
    tree.links.new(casing.outputs[0], mix.inputs[2])
    tree.links.new(mix.outputs[0], out.inputs["Surface"])
    print(f"{name}: granite to {height:.3f} m above the base, {structure}.casing.granite.height")
    return mat


# --- The casing as it was finished ------------------------------------------
#
# The "(as built)" pyramids as they looked the day the last casing stone was
# dressed: Tura limestone polished to a sheen, laid in courses, with joints so
# fine Petrie measured them in fiftieths of an inch (drawn wider, so a pixel can hold them), and a capstone of the
# pyramid's own slope. The course joints are the database's: the Great
# Pyramid's surveyed courses carried out to the casing's face, and for a
# pyramid without a course table, or above the last surveyed course, the mean
# of those courses. The block lengths along a course, the capstone's height (a
# seked-estimate) and every tone are chosen for the look and are not
# measurements.

JOINT_RESOLUTION = 0.01
BLOCK_LENGTH = 1.7
JOINT_WIDTH = 0.02
CAPSTONE = {"finish": "stone"}


def course_levels_to_apex(structure, height):
    """Course boundaries from the base to the apex: the structure's own courses, then g1's mean course above them."""
    values = resolved_values()
    courses = course_heights(values, structure)
    mean, _ = mean_course_height()
    levels, z = [0.0], 0.0
    for h in courses:
        if z + h >= height:
            break
        z += h
        levels.append(z)
    surveyed = len(levels) - 1
    while z + mean < height:
        z += mean
        levels.append(z)
    return levels, surveyed


def course_image(structure, label, height, capstone_level):
    """
    A one-pixel-wide image up the pyramid's height, a centimetre a pixel: red
    marks a course joint (and the joint under the capstone), green is a number
    drawn per course to stagger its vertical joints, blue the course's index.
    """
    name = f"Seked courses ({label})"
    image = bpy.data.images.get(name)
    if image is not None:
        return image
    levels, surveyed = course_levels_to_apex(structure, height)
    rows = int(math.ceil(height / JOINT_RESOLUTION)) + 1
    image = bpy.data.images.new(name, width=1, height=rows, alpha=False, float_buffer=True)
    # Drawn three centimetres wide: a true joint is a fraction of a millimetre, but a
    # course line that no pixel can hold is no line at all, and the arris of each
    # block catches the light over about that much.
    marks = list(levels[1:]) + ([capstone_level] if capstone_level is not None else [])
    joints = set(int(round(z / JOINT_RESOLUTION)) + d for z in marks for d in (-1, 0, 1))
    pixels = [0.0] * (rows * 4)
    course = 0
    for row in range(rows):
        z = row * JOINT_RESOLUTION
        while course + 1 < len(levels) and z >= levels[course + 1]:
            course += 1
        rand = (math.sin((course + 1) * 12.9898) * 43758.5453) % 1.0
        pixels[row * 4:row * 4 + 4] = [1.0 if row in joints else 0.0, rand, course / max(1, len(levels)), 1.0]
    image.pixels = pixels
    image.pack()
    print(f"{name}: {len(levels) - 1} courses to {height:.3f} m, {surveyed} of them surveyed courses of {structure}, the rest at g1's mean")
    return image


def math_node(tree, operation, a, b=None):
    node = tree.nodes.new("ShaderNodeMath")
    node.operation = operation
    for i, value in enumerate((a, b)):
        if value is None:
            continue
        if isinstance(value, (int, float)):
            node.inputs[i].default_value = value
        else:
            tree.links.new(value, node.inputs[i])
    return node.outputs[0]


def wire_pristine_casing(tree, bsdf, structure, label, vector, normal, height, capstone_level):
    """Polished Tura limestone with its course joints, staggered block joints, a tone per block and the capstone."""
    split = tree.nodes.new("ShaderNodeSeparateXYZ")
    tree.links.new(vector, split.inputs["Vector"])
    z = split.outputs["Z"]

    image = course_image(structure, label, height, capstone_level)
    rows = image.size[1]
    lookup = tree.nodes.new("ShaderNodeCombineXYZ")
    lookup.inputs["X"].default_value = 0.5
    tree.links.new(math_node(tree, "DIVIDE", z, rows * JOINT_RESOLUTION), lookup.inputs["Y"])
    texture = tree.nodes.new("ShaderNodeTexImage")
    texture.image = image
    texture.image.colorspace_settings.name = "Non-Color"
    texture.interpolation = "Closest"
    texture.extension = "EXTEND"
    tree.links.new(lookup.outputs["Vector"], texture.inputs["Vector"])
    course = tree.nodes.new("ShaderNodeSeparateColor")
    tree.links.new(texture.outputs["Color"], course.inputs["Color"])

    # Along the course: x on the north and south faces, y on the east and west.
    n = tree.nodes.new("ShaderNodeSeparateXYZ")
    tree.links.new(normal, n.inputs["Vector"])
    north_south = math_node(tree, "GREATER_THAN", math_node(tree, "ABSOLUTE", n.outputs["Y"]), math_node(tree, "ABSOLUTE", n.outputs["X"]))
    along_face = tree.nodes.new("ShaderNodeMix")
    along_face.data_type = "FLOAT"
    tree.links.new(north_south, along_face.inputs["Factor"])
    tree.links.new(split.outputs["Y"], along_face.inputs["A"])
    tree.links.new(split.outputs["X"], along_face.inputs["B"])
    t = math_node(tree, "DIVIDE", math_node(tree, "ADD", along_face.outputs["Result"], math_node(tree, "MULTIPLY", course.outputs["Green"], 17.3)), BLOCK_LENGTH)
    fraction = math_node(tree, "FRACT", t)
    edge = math_node(tree, "MULTIPLY", math_node(tree, "MINIMUM", fraction, math_node(tree, "SUBTRACT", 1.0, fraction)), BLOCK_LENGTH)
    joint = math_node(tree, "MAXIMUM", course.outputs["Red"], math_node(tree, "LESS_THAN", edge, JOINT_WIDTH))

    block = tree.nodes.new("ShaderNodeCombineXYZ")
    tree.links.new(math_node(tree, "FLOOR", t), block.inputs["X"])
    tree.links.new(math_node(tree, "MULTIPLY", course.outputs["Blue"], 1000.0), block.inputs["Y"])
    tree.links.new(north_south, block.inputs["Z"])
    tone = tree.nodes.new("ShaderNodeTexWhiteNoise")
    tone.noise_dimensions = "3D"
    tree.links.new(block.outputs["Vector"], tone.inputs["Vector"])

    maps = photographed(tree, vector, "casing", 1.6)
    if maps is None:
        colour = mix_colours(tree, noise(tree, vector, 0.04), (0.80, 0.76, 0.67), (0.86, 0.82, 0.73))
    else:
        colour = tinted(tree, maps["colour"], (0.84, 0.79, 0.69), 0.78)
    colour = darken(tree, colour, tone.outputs["Value"], 0.07)
    colour = darken(tree, colour, joint, 0.45)
    capstone = math_node(tree, "GREATER_THAN", z, capstone_level if capstone_level is not None else height + 1.0)

    rough = map_range(tree, noise(tree, vector, 0.03, 3.0), 0.14, 0.26)
    rough = math_node(tree, "MAXIMUM", rough, math_node(tree, "MULTIPLY", joint, 0.7))
    if CAPSTONE["finish"] == "gold":
        gold = tree.nodes.new("ShaderNodeMixRGB")
        gold.blend_type = "MIX"
        tree.links.new(capstone, gold.inputs["Fac"])
        tree.links.new(colour, gold.inputs["Color1"])
        gold.inputs["Color2"].default_value = (1.0, 0.71, 0.29, 1.0)
        colour = gold.outputs["Color"]
        tree.links.new(capstone, bsdf.inputs["Metallic"])
        rough = math_node(tree, "MINIMUM", rough, math_node(tree, "SUBTRACT", 1.0, math_node(tree, "MULTIPLY", capstone, 0.8)))
    tree.links.new(colour, bsdf.inputs["Base Color"])
    tree.links.new(rough, bsdf.inputs["Roughness"])
    bsdf.inputs["Coat Weight"].default_value = 0.12
    bsdf.inputs["Coat Roughness"].default_value = 0.06
    if maps is not None:
        tree.links.new(bump(tree, maps["height"], 0.04, 0.01), bsdf.inputs["Normal"])


def pristine_material(structure, label):
    """The as-built casing for one pyramid: polished Tura limestone over granite where the database has granite."""
    values = resolved_values()
    height = values.get(f"{structure}.height.original")
    capstone = values.get(f"{structure}.pyramidion.height")
    capstone_level = None if capstone is None else height - capstone
    granite_height = granite_casing_height(structure)
    name = f"{CASING_NAME} as finished ({label}, capstone {CAPSTONE['finish']})"
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat
    mat = bpy.data.materials.new(name)
    tree = node_tree_of(mat)
    tree.nodes.clear()
    out = tree.nodes.new("ShaderNodeOutputMaterial")
    coords = tree.nodes.new("ShaderNodeTexCoord")
    vector, normal = coords.outputs["Object"], coords.outputs["Normal"]
    casing = tree.nodes.new("ShaderNodeBsdfPrincipled")
    wire_pristine_casing(tree, casing, structure, label, vector, normal, height, capstone_level)
    surface = casing.outputs[0]
    if granite_height:
        granite = tree.nodes.new("ShaderNodeBsdfPrincipled")
        wire_granite(tree, granite, vector)
        split = tree.nodes.new("ShaderNodeSeparateXYZ")
        tree.links.new(vector, split.inputs["Vector"])
        mix = tree.nodes.new("ShaderNodeMixShader")
        tree.links.new(math_node(tree, "GREATER_THAN", split.outputs["Z"], granite_height), mix.inputs["Fac"])
        tree.links.new(granite.outputs[0], mix.inputs[1])
        tree.links.new(surface, mix.inputs[2])
        surface = mix.outputs[0]
    tree.links.new(surface, out.inputs["Surface"])
    capstone_text = "no capstone record" if capstone is None else f"capstone {capstone:.2f} m ({CAPSTONE['finish']}), {structure}.pyramidion.height"
    print(f"{name}: to {height:.3f} m, {capstone_text}" + (f", granite to {granite_height:.3f} m" if granite_height else ""))
    return mat


def casing_cap_level(structure):
    """
    The level above a pyramid's base where the casing still standing today
    begins, or None: its present height less the depth of casing a source
    says survives under the summit. Only Khafre has one (M&R Parte V, p. 51).
    """
    values = resolved_values()
    top, depth = values.get(f"{structure}.height.today"), values.get(f"{structure}.casing.cap.depth")
    return None if top is None or depth is None else top - depth


def cap_over_core_material(structure, label, level):
    """
    A pyramid as it stands where its casing survives only at the top: the
    banded core below `level` and the casing above it, Khafre's white cap over
    his stepped core. Like the granite, the switch is the object's own Z
    against a number from the database, so nothing is placed by hand.
    """
    name = f"{CASING_NAME} cap over core ({label})"
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat
    course, provenance = mean_course_height()
    mat = bpy.data.materials.new(name)
    tree = node_tree_of(mat)
    tree.nodes.clear()
    out = tree.nodes.new("ShaderNodeOutputMaterial")
    vector = object_coordinates(tree)

    core = tree.nodes.new("ShaderNodeBsdfPrincipled")
    wire_core(tree, core, vector, course)
    casing = tree.nodes.new("ShaderNodeBsdfPrincipled")
    wire_casing(tree, casing, vector, weathered=True)

    split = tree.nodes.new("ShaderNodeSeparateXYZ")
    tree.links.new(vector, split.inputs["Vector"])
    above = tree.nodes.new("ShaderNodeMath")
    above.operation = "GREATER_THAN"
    above.inputs[1].default_value = level
    tree.links.new(split.outputs["Z"], above.inputs[0])

    mix = tree.nodes.new("ShaderNodeMixShader")
    tree.links.new(above.outputs["Value"], mix.inputs["Fac"])
    tree.links.new(core.outputs[0], mix.inputs[1])
    tree.links.new(casing.outputs[0], mix.inputs[2])
    tree.links.new(mix.outputs[0], out.inputs["Surface"])
    print(f"{name}: casing above {level:.3f} m, {structure}.height.today less {structure}.casing.cap.depth; core bands of {course:.4f} m, {provenance}")
    return mat


PIT_NAME = "Rock-cut pit"
BASALT_NAME = "Basalt paving"

# The one footprint that is not limestone: the temple Petrie calls the Granite
# Temple, whose walls and pillars are Aswan granite over a limestone core.
GRANITE_FOOTPRINTS = ("khafre.valley_temple",)


def pit_material():
    """A rock-cut hollow: the bedrock's own colour, dark, because it is in shadow at any hour."""
    mat, tree, bsdf = new_material(PIT_NAME)
    if tree is None:
        return mat
    bsdf.inputs["Base Color"].default_value = (0.09, 0.075, 0.06, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.95
    return mat


def basalt_material():
    """The basalt of Khufu's temple floor: near black, a little glossy where it was sawn and dressed."""
    mat, tree, bsdf = new_material(BASALT_NAME)
    if tree is None:
        return mat
    bsdf.inputs["Base Color"].default_value = (0.035, 0.036, 0.038, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.55
    return mat


def plateau_material(obj, limestone, granite, pit, basalt=None):
    """
    The masses from the footprint import, by what they are rather than by name:
    a pit is dark, the Granite Temple is granite, and everything else is the
    banded limestone the Sphinx's box was, because every one of them is a
    massing whose courses are not geometry.
    """
    if obj.get("seked_kind") == "pit":
        return pit
    if obj.get("seked_footprint") in GRANITE_FOOTPRINTS:
        return granite
    if basalt is not None and obj.get("seked_footprint") == "khufu.basalt_pavement":
        return basalt
    if obj.get("seked_group") == "mastabas":
        return mastaba_material(limestone)
    return limestone


def dress_as_built(state):
    """
    In the built state the plateau's lesser monuments are finished too: the
    queens' pyramids, the mastabas, the temples and the causeways take the same
    dressed Tura limestone as the great pyramids' casing instead of today's
    stripped, stepped core. Granite, basalt and the pits keep their own. Their
    forms stay the massings the footprints give; only the finish changes, and
    that finish is the reconstruction.
    """
    if state != "built":
        return 0
    fine = casing_material()
    values = resolved_values()
    dressed = 0
    for obj in bpy.data.objects:
        if obj.type != "MESH" or obj.get("seked_structure") != "plateau":
            continue
        if obj.get("seked_group") == "temples":
            raise_to(obj, values.get("tier3.temple.height"), values.get("tier3.temple.height.built"), "tier3.temple.height.built")
        if obj.get("seked_group") == "causeways":
            roof_over(obj, values.get("tier3.causeway.corridor.height"))
        if obj.get("seked_kind") == "pit" or obj.get("seked_footprint") in GRANITE_FOOTPRINTS or obj.get("seked_footprint") == "khufu.basalt_pavement":
            continue
        obj.data.materials.clear()
        obj.data.materials.append(fine)
        dressed += 1
    print(f"state built: {dressed} of the plateau's masses dressed in {CASING_NAME}")
    return dressed


def raise_to(obj, today, built, key):
    """A temple massing drawn at the height it was built to: every vertex's height above its base scaled from today's figure to the built one."""
    if not today or not built or obj.get("seked_height") != "tier3.temple.height":
        return
    zs = [v.co.z for v in obj.data.vertices]
    base = min(zs)
    for v in obj.data.vertices:
        v.co.z = base + (v.co.z - base) * built / today
    print(f"state built: {obj.name} raised from {today:g} m to {built:g} m, {key}")


def roof_over(obj, height):
    """The roofed corridor on a causeway: its upward faces carried up by `height`, which closes it into a walled and roofed passage."""
    import bmesh

    if not height:
        return
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    tops = [f for f in bm.faces if f.normal.z > 0.9]
    grown = bmesh.ops.extrude_face_region(bm, geom=tops)
    moved = [e for e in grown["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=moved, vec=(0.0, 0.0, height))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    print(f"state built: {obj.name} roofed over, its corridor {height:g} m high, tier3.causeway.corridor.height")


MASTABA_NAME = "Core limestone (mastaba courses)"


def mastaba_material(fallback):
    """
    The mastaba field's stone, banded at the course height Reisner gives the
    stepped core mastabas of the Western Field rather than the Great Pyramid's,
    so a tomb four metres high reads as a dozen courses and not as six.
    Falls back to the plateau's banded limestone where the preset carries no
    such record.
    """
    mat = bpy.data.materials.get(MASTABA_NAME)
    if mat is not None:
        return mat
    course = resolved_values().get("tier3.mastaba.course.height")
    if course is None:
        return fallback
    mat, tree, bsdf = new_material(MASTABA_NAME)
    wire_core(tree, bsdf, object_coordinates(tree), course)
    print(f"{MASTABA_NAME}: courses of {course:.4f} m, tier3.mastaba.course.height")
    return mat


HYPOTHESIS_NAME = "Seked hypothesis"


def hypothesis_material():
    """
    What a `void.*` solid is made of in a view that is meant to look like a
    photograph. Nobody has stood in either of these, and a photograph of a room
    nobody has entered is a fiction whatever stone it is given, so they are not
    given stone: this is a cool, translucent, faintly lit surface that reads as
    a volume rather than a chamber. The section view has its own answer, an
    outline with no fill at all; this is the same thought in a view that has
    light in it.
    """
    mat, tree, bsdf = new_material(HYPOTHESIS_NAME)
    if tree is None:
        return mat
    bsdf.inputs["Base Color"].default_value = (0.32, 0.48, 0.62, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.35
    bsdf.inputs["Alpha"].default_value = 0.22
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.4
    if "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (0.30, 0.46, 0.60, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 0.6
    for attr, value in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
        if hasattr(mat, attr):
            try:
                setattr(mat, attr, value)
            except TypeError:
                pass
    return mat


def assign_materials():
    """
    Materials over the whole scene, by what an object is. A "(today)" object
    that carries its courses takes the plain core limestone, because its
    courses are its geometry; the Sphinx's box and a flat truncation take the
    banded one, because theirs are not. An "(as built)" pyramid takes the
    casing, over granite where the database says the faces were granite. The
    interior solids are granite, a `void.*` solid is the hypothesis material
    because nobody has stood in it, and the terrain is sand.
    """
    casing = casing_material()
    granite = granite_material()
    hypothesis = hypothesis_material()
    pit = pit_material()
    basalt = basalt_material()
    sand = sand_material()
    core, banded = core_material(False), core_material(True)
    cased = {}
    for structure, label in STRUCTURE_LABELS.items():
        height = granite_casing_height(structure)
        if height:
            cased[f"{label} (as built)"] = casing_over_granite_material(structure, label, height)
        if resolved_values().get(f"{structure}.height.original") is not None:
            cased[f"{label} (as built)"] = pristine_material(structure, label)
        level = casing_cap_level(structure)
        if level is not None:
            cased[f"{label} (today)"] = cap_over_core_material(structure, label, level)

    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        name = obj.name
        if name.startswith("Terrain"):
            mat = sand
        elif name.startswith("Sphinx"):
            mat = banded
        elif "(today)" in name:
            mat = cased.get(name) or (core if obj.get("seked_courses") else banded)
        elif "(as built)" in name:
            mat = cased.get(name, casing)
        elif name.startswith("void."):
            mat = hypothesis
        elif obj.get("seked_structure") == "plateau":
            mat = plateau_material(obj, banded, granite, pit, basalt)
        else:
            mat = granite
        obj.data.materials.clear()
        obj.data.materials.append(mat)


VOID_NAME = "Seked void"
GHOST_NAME = "Seked ghost"
INFERRED_NAME = "Seked inferred void"

# The three values a section is drawn at, as linear scene-referred grey. The
# void is the lightest, the masonry a mid tone, and the backdrop the darkest,
# so a passage reads against the stone and the stone reads against the ground.
# They are chosen, not measured, and that is the point: see `drawing_material`.
VOID_VALUE = 0.95
GHOST_VALUE = 0.42


def drawing_material(name, value, opacity, tint=(1.0, 0.96, 0.90)):
    """
    A surface with a value rather than a lighting response.

    No sun reaches inside a pyramid. A lit interior is a fiction however it is
    lit, and a lamp put in the Grand Gallery to make the render work would be
    the one thing in this scene that was neither measured nor computed. A
    drawing has always answered that by giving each thing a tone instead, so
    that is what this is: an emission at `value`, mixed with a transparent
    shader at `opacity`, and nothing else. It casts no light, takes none, and
    looks the same wherever the camera stands.

    Everything geometric in the frame is still survey, to the vertex. Only the
    ink is a choice, and it is confined to these two numbers.
    """
    mat, tree, bsdf = new_material(name)
    if tree is None:
        return mat
    out = next(n for n in tree.nodes if n.type == "OUTPUT_MATERIAL")
    tree.nodes.remove(bsdf)
    emission = tree.nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (tint[0] * value, tint[1] * value, tint[2] * value, 1.0)
    emission.inputs["Strength"].default_value = 1.0
    if opacity >= 1.0:
        tree.links.new(emission.outputs[0], out.inputs["Surface"])
        return mat
    clear = tree.nodes.new("ShaderNodeBsdfTransparent")
    mix = tree.nodes.new("ShaderNodeMixShader")
    mix.inputs["Fac"].default_value = 1.0 - opacity
    tree.links.new(emission.outputs[0], mix.inputs[1])
    tree.links.new(clear.outputs[0], mix.inputs[2])
    tree.links.new(mix.outputs[0], out.inputs["Surface"])
    return mat


def draw_as_section(structure, casing_opacity):
    """
    Put the scene on the two drawing materials and take everything else out of
    the frame. A section of one pyramid is a picture of that pyramid: only the
    named structure is kept, and of its objects only the "(as built)" shell
    and the interior solids, because the "(today)" stack of courses stands in
    the same place and would read as a second pyramid drawn over the first.

    The shell is the only translucent thing, at `casing_opacity`; the rooms
    and passages are drawn solid, so a passage reads at the same weight
    wherever it lies and however much stone is in front of it. A `void.*`
    solid is the exception and is drawn as an outline with no fill, because a
    shape fitted to a muon deficit should not read like a room with a floor.

    Which objects belong to which structure is the generator's own
    `seked_structure` property, so nothing here parses a name to find out.
    Which of them is an interior solid is the rule `assign_materials` already
    uses, so the two cannot disagree.
    """
    void = drawing_material(VOID_NAME, VOID_VALUE, 1.0)
    ghost = drawing_material(GHOST_NAME, GHOST_VALUE, casing_opacity)
    # A void the muons found is drawn as an outline and nothing else. It has
    # no fill because nobody has stood in it, and a solid tone would put it on
    # the same footing as a room Petrie walked through with a tape.
    inferred = drawing_material(INFERRED_NAME, VOID_VALUE, 0.0)
    kept, hidden, found = 0, 0, 0
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        mine = obj.get("seked_structure") == structure
        shell = "(as built)" in obj.name
        interior = mine and not (shell or "(today)" in obj.name or obj.name.startswith("Sphinx"))
        show = mine and (shell or interior)
        obj.hide_set(not show)
        obj.hide_render = not show
        if not show:
            hidden += 1
            continue
        kept += 1
        if not interior:
            mat = ghost
        elif obj.name.startswith("void."):
            mat, found = inferred, found + 1
        else:
            mat = void
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    print(f"drawing {structure}: {kept} objects kept, {hidden} taken out of the frame; "
          f"masonry at {GHOST_VALUE:.2f} and {casing_opacity:.0%} opaque, the void at {VOID_VALUE:.2f}, "
          f"{found} drawn as outline only, nobody having stood in them")


def make_translucent(obj, alpha):
    """Keep the casing visible as a shell while the interior shows through it."""
    mat = obj.data.materials[0].copy()
    mat.name = f"{mat.name} (translucent)"
    for node in mat.node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            node.inputs["Alpha"].default_value = alpha
    for attr, value in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
        if hasattr(mat, attr):
            try:
                setattr(mat, attr, value)
            except TypeError:
                pass
    if hasattr(mat, "use_backface_culling"):
        mat.use_backface_culling = True
    obj.data.materials[0] = mat
