"""
The scene's materials, for `render.py` and `rollback.py`.

Base colour, roughness and a bump and nothing else, as the plan says. They are
built here rather than in `generate.py`, which stays material-free, and are
assigned by what an object is. The only numbers in them that come out of the
database are the course thickness the banded limestone uses and the height of
the granite on the cased faces of Khafre's and Menkaure's pyramids.
"""
import math

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


# --- The stones, as wiring onto a Principled BSDF --------------------------


def wire_casing(tree, bsdf, vector):
    """
    Tura limestone: the fine white casing, smooth enough to have been polished,
    with a large-scale variation in roughness so a face catches the light
    unevenly instead of reading as one flat plane.
    """
    bsdf.inputs["Base Color"].default_value = (0.88, 0.86, 0.80, 1.0)
    tree.links.new(map_range(tree, noise(tree, vector, 0.04), 0.24, 0.46), bsdf.inputs["Roughness"])


def wire_granite(tree, bsdf, vector):
    """Aswan granite, the dark red-brown of the King's Chamber, with a fine noise for its grain."""
    grain = noise(tree, vector, 14.0, 6.0)
    tree.links.new(mix_colours(tree, grain, (0.20, 0.13, 0.12), (0.38, 0.24, 0.21)), bsdf.inputs["Base Color"])
    tree.links.new(map_range(tree, grain, 0.32, 0.55), bsdf.inputs["Roughness"])


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
    blocks = noise(tree, vector, 0.25, 3.0)
    colour = mix_colours(tree, blocks, (0.55, 0.47, 0.36), (0.66, 0.58, 0.45))
    pits = noise(tree, vector, 3.0, 6.0)
    tree.links.new(map_range(tree, pits, 0.72, 0.95), bsdf.inputs["Roughness"])
    if course is None:
        tree.links.new(colour, bsdf.inputs["Base Color"])
        tree.links.new(bump(tree, pits, 0.12, 0.06), bsdf.inputs["Normal"])
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
    """The plateau: pale, rough, and softly undulating over tens of metres so the ground is not a sheet."""
    drift = noise(tree, vector, 0.02, 4.0)
    tree.links.new(mix_colours(tree, drift, *SAND_COLOURS), bsdf.inputs["Base Color"])
    tree.links.new(map_range(tree, noise(tree, vector, 0.3, 6.0), 0.86, 1.0), bsdf.inputs["Roughness"])
    tree.links.new(bump(tree, drift, 0.25, 1.5), bsdf.inputs["Normal"])


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


def assign_materials():
    """
    Materials over the whole scene, by what an object is. A "(today)" object
    that carries its courses takes the plain core limestone, because its
    courses are its geometry; the Sphinx's box and a flat truncation take the
    banded one, because theirs are not. An "(as built)" pyramid takes the
    casing, over granite where the database says the faces were granite. The
    interior solids are granite, the terrain is sand.
    """
    casing = casing_material()
    granite = granite_material()
    sand = sand_material()
    core, banded = core_material(False), core_material(True)
    cased = {}
    for structure, label in STRUCTURE_LABELS.items():
        height = granite_casing_height(structure)
        if height:
            cased[f"{label} (as built)"] = casing_over_granite_material(structure, label, height)

    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        name = obj.name
        if name.startswith("Terrain"):
            mat = sand
        elif name.startswith("Sphinx"):
            mat = banded
        elif "(today)" in name:
            mat = core if obj.get("seked_courses") else banded
        elif "(as built)" in name:
            mat = cased.get(name, casing)
        else:
            mat = granite
        obj.data.materials.clear()
        obj.data.materials.append(mat)


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
