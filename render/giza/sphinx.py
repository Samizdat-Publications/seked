"""
The Great Sphinx and its enclosure.

The statue is a stand-in (blender/models.json): a model generated from photographs,
fitted onto the OSM outline of the body, head and paws by the same code the old
renderer used (blender/render_standins.py: principal axis, length along it, the
outline's base). Nothing of its form is a measurement.

The enclosure is the ditch the quarrymen cut round it. Its floor is at the statue's
base; ARCE's plan (data/measurements/sphinx-enclosure.json) gives how far the floor
reaches north of the statue and west of the rump; the south margin, where the
causeway runs along the ditch, is a look choice. The east side stays open to the
Sphinx Temple, as it is.
"""
import io
import json
import os
import sys

import bpy
import numpy as np

from . import data, states
from .nodes import Tree, hexlin

BLENDER_DIR = os.path.join(data.REPO, "blender")
if BLENDER_DIR not in sys.path:
    sys.path.insert(0, BLENDER_DIR)

# Which stand-in, and which retexture of it, each Sphinx of the sequence is (blender/models.json).
MODEL_FOR = {"anubis": ("sphinx-anubis-fresh", "paint-black2"), "lion": ("sphinx-lion-rain", None),
             "lion-fresh": ("sphinx-lion-first", None), "carved": ("sphinx-built", None),
             "buried": ("sphinx-meshy", None), "excavated": ("sphinx-meshy", None)}
TINTED = {"sphinx-meshy", "sphinx-lion", "sphinx-lion-fresh"}      # generated textures with a pink cast
# The carved Sphinx's generated texture leaves the body paper white under a painted head: the body is
# taken down to the bedrock's warm limestone (a look choice; traces of red ochre survive on it).
WARMED = {"sphinx-carved": (0.9, 0.78, 0.62, 1.0),
          # the First Time's freshly carved lion (sphinx-lion-pristine) renders pale ivory beside the bedrock walls
          "sphinx-lion-pristine": (0.93, 0.87, 0.77, 1.0)}
# Stand-ins whose generated surface reads as cast resin, smooth and one colour: they are given the
# enclosure's own bedrock, its horizontal members and its grain, so statue and ditch read as one rock
# (a look choice; the Sphinx is carved from the plateau's layered limestone).
CARVED = {"sphinx-lion-pristine": 0.3, "sphinx-carved": 0.7, "sphinx-lion-first": 0.9}
# Stand-ins that stand in a wet green world: dark growth in their hollows and the runs of rain below
# them (critic rounds 12 to 15 read the First Time lion as "a resin garden ornament", "orange clay";
# fresh limestone in a humid forest greys and greens in its first years).
DAMP = {"sphinx-lion-pristine": 1.0, "sphinx-lion-first": 0.4}
# Generated textures with brush-stroke striations baked in that read as wood grain: their colour is
# taken most of the way to plain fresh limestone, the carving left to the geometry and the normal map
# (how far, and the stone's colour, are look choices).
FLATTENED = {"sphinx-lion-first": (0.5, (0.86, 0.72, 0.52, 1.0)),
             "sphinx-lion-rain": (0.35, (0.72, 0.62, 0.5, 1.0))}      # its lichen read as black paint
# Generated textures whose colour runs to orange clay (critic round 15): their saturation (a look choice).
DESATURATED = {"sphinx-lion-pristine": 0.7}
# Painted stand-ins whose generated colours come out saturated like plastic: their saturation (a look choice).
WEATHERED_PAINT = {"sphinx-carved": 0.32}
SOUTH_MARGIN = 9.0        # look choice
EAST_EDGE = 367.0         # the Sphinx Temple's west wall stands at x 369
# GLO-30's 30 m cells average the ditch into the rock round it, leaving faces a metre or two high
# where the photographs show the plateau standing well over the statue's rump. The rock round the
# ditch is given the height the DEM has 35 m out, beyond the averaging, carried in to the cut's edge
# (a look choice: the reach, and the fade at the paws, where Amenhotep II's temple stands low).
RIM_REACH = 35.0
RIM_FADE = (340.0, 357.0)


def rim(state="today"):
    """The rock round the ditch for the terrain: (x0, x1, y0, y1, reach, fade from x, fade to x)."""
    x0, x1, y0, y1, _ = enclosure(state)
    return (x0, x1, y0, y1, RIM_REACH) + RIM_FADE


def _records(name):
    return {r["key"]: r["value"] for r in data.records(name)}


def enclosure(state="today"):
    """The ditch as (x0, x1, y0, y1, floor_z); filled to the chest in the buried state."""
    parts = [f for f in data.FOOTPRINTS if f.get("group") == "sphinx"]
    xs = [p[0] for f in parts for p in f["ring"]]
    ys = [p[1] for f in parts for p in f["ring"]]
    margins = _records("sphinx-enclosure.json")
    floor = min(f["base"] for f in parts) - 0.4
    return (min(xs) - margins["sphinx.enclosure.margin.west"], EAST_EDGE,
            min(ys) - SOUTH_MARGIN, max(ys) + margins["sphinx.enclosure.margin.north"], floor)


def statue(state, coll, log=print):
    import render_standins as rs   # the old renderer's importer and fit, which run inside Blender

    models = {m["id"]: m for m in json.load(io.open(os.path.join(BLENDER_DIR, "models.json"), encoding="utf-8"))["models"]}
    index = json.load(io.open(os.path.join(data.REPO, "build", "models", "index.json"), encoding="utf-8"))
    index = index.get("models", index)
    model_id, finish = MODEL_FOR[states.spec(state)["sphinx"]]
    model = models[model_id]
    path = os.path.join(data.REPO, "build", "models", index[model["id"]]["file"])
    surface = (model.get("finishes") or {}).get(finish, {}) if finish else {}
    if finish:
        finished = os.path.join(data.REPO, "build", "models", f"{model['id']}-{finish}", "model.glb")
        if os.path.exists(finished):
            path = finished
        else:
            log(f"sphinx: finish {finish} not on disk; the plain surface")
            surface = {}
    if not os.path.exists(path):
        log(f"sphinx: {path} is not on disk (python scripts/models.py fetches it); no statue")
        return None
    mesh = rs.import_model(path, model["name"], keep_materials=True)
    obj = rs.cut_and_reduce(mesh, model.get("cut_z"), model.get("faces", 300000), model.get("largest_part_only", False))
    done = rs.fit(obj, model, data.FOOTPRINTS)
    # The statue is cut from the bedrock it stands on: set its lowest point on the ditch's floor, where
    # the fit leaves the paws hanging a few tenths of a metre over it (the floor sits under the lowest footprint base).
    bpy.context.view_layer.update()
    lowest = min((obj.matrix_world @ v.co).z for v in obj.data.vertices)
    floor = enclosure(state)[4] + 0.02
    if lowest > floor:
        obj.location.z -= lowest - floor
        log(f"sphinx: set down {lowest - floor:.2f} m onto the ditch's floor")
    if surface.get("gilded"):
        for mat in obj.data.materials:
            if mat is not None:
                rs.add_gilding(mat)
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)
    for mat in obj.data.materials:
        if mat and mat.node_tree:
            tree = mat.node_tree
            for nd in list(tree.nodes):
                if nd.type != "BSDF_PRINCIPLED":
                    continue
                nd.inputs["Roughness"].default_value = 0.9
                base = nd.inputs["Base Color"]
                if model_id in WARMED and base.is_linked:
                    src = base.links[0].from_socket
                    warm = tree.nodes.new("ShaderNodeMixRGB")
                    warm.blend_type = "MULTIPLY"
                    warm.inputs["Fac"].default_value = 1.0
                    warm.inputs["Color2"].default_value = WARMED[model_id]
                    tree.links.new(src, warm.inputs["Color1"])
                    tree.links.new(warm.outputs["Color"], base)
                if model_id in WEATHERED_PAINT and base.is_linked:
                    # paint four hundred years in the sun: chalky and faded, not a toy's gloss
                    src = base.links[0].from_socket
                    fade = tree.nodes.new("ShaderNodeHueSaturation")
                    fade.inputs["Saturation"].default_value = WEATHERED_PAINT[model_id]
                    fade.inputs["Value"].default_value = 0.84
                    fade.inputs["Hue"].default_value = 0.515      # the pink towards the red-brown of ochre
                    tree.links.new(src, fade.inputs["Color"])
                    tree.links.new(fade.outputs["Color"], base)
                if model_id in FLATTENED and base.is_linked:
                    src = base.links[0].from_socket
                    flat = tree.nodes.new("ShaderNodeMixRGB")
                    flat.inputs["Fac"].default_value = FLATTENED[model_id][0]
                    flat.inputs["Color2"].default_value = FLATTENED[model_id][1]
                    tree.links.new(src, flat.inputs["Color1"])
                    tree.links.new(flat.outputs["Color"], base)
                if model_id in CARVED and base.is_linked:
                    _in_bedrock(tree, nd, CARVED[model_id])
                if model_id in DESATURATED and base.is_linked:
                    src = base.links[0].from_socket
                    grey = tree.nodes.new("ShaderNodeHueSaturation")
                    grey.inputs["Saturation"].default_value = DESATURATED[model_id]
                    tree.links.new(src, grey.inputs["Color"])
                    tree.links.new(grey.outputs["Color"], base)
                if model_id in DAMP and base.is_linked:
                    _damp(tree, nd, DAMP[model_id])
                if model_id in TINTED and base.is_linked:
                    src = base.links[0].from_socket
                    hsv = tree.nodes.new("ShaderNodeHueSaturation")
                    hsv.inputs["Hue"].default_value = 0.525
                    hsv.inputs["Saturation"].default_value = 0.85
                    hsv.inputs["Value"].default_value = 0.92
                    tint = tree.nodes.new("ShaderNodeMixRGB")
                    tint.blend_type = "MULTIPLY"
                    tint.inputs["Fac"].default_value = 1.0
                    tint.inputs["Color2"].default_value = (1.0, 0.86, 0.66, 1.0)
                    tree.links.new(src, hsv.inputs["Color"])
                    tree.links.new(hsv.outputs["Color"], tint.inputs["Color1"])
                    tree.links.new(tint.outputs["Color"], base)
    obj["seked"] = "stand-in: " + model["name"]
    log(f"sphinx: {model['id']}{' ' + finish if finish else ''}, {len(obj.data.polygons):,} faces, {done['length_m']:.1f} m long, {done['height_m']:.1f} m high")
    return obj


def _in_bedrock(tree, bsdf, strength=1.0):
    """Multiply the bedrock's members and grain into a stand-in's colour, and bump it with the rock's relief."""
    from .materials import TEX, image
    nodes, links = tree.nodes, tree.links
    base = bsdf.inputs["Base Color"]
    src = base.links[0].from_socket
    geo = nodes.new("ShaderNodeNewGeometry")
    # the members: bands a metre or two thick, a little wavy, from grey-buff to honey
    bands = nodes.new("ShaderNodeMapping")
    bands.inputs["Scale"].default_value = (0.05, 0.05, 1.6)
    links.new(geo.outputs["Position"], bands.inputs["Vector"])
    nz = nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 0.7
    nz.inputs["Detail"].default_value = 3.0
    links.new(bands.outputs[0], nz.inputs["Vector"])
    ramp = nodes.new("ShaderNodeValToRGB")
    lo = 1.0 - 0.38 * strength
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[0].color = 0.3, (lo, lo * 0.9, lo * 0.76, 1.0)
    ramp.color_ramp.elements[1].position, ramp.color_ramp.elements[1].color = 0.7, (1.0, 0.97, 0.9, 1.0)
    links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    # the grain: the bedrock photograph's light and dark, box-projected at its own scale
    sz = TEX["bedrock"]["tile_m"][0]
    mp = nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / sz, 1 / sz, 1 / sz)
    links.new(geo.outputs["Position"], mp.inputs["Vector"])
    im = nodes.new("ShaderNodeTexImage")
    im.image, im.projection, im.projection_blend = image("bedrock", "Diffuse"), "BOX", 0.3
    hm = nodes.new("ShaderNodeTexImage")
    hm.image, hm.projection, hm.projection_blend = image("bedrock", "Displacement", True), "BOX", 0.3
    links.new(mp.outputs[0], im.inputs["Vector"])
    links.new(mp.outputs[0], hm.inputs["Vector"])
    bw = nodes.new("ShaderNodeRGBToBW")
    links.new(im.outputs["Color"], bw.inputs[0])
    gain = nodes.new("ShaderNodeMath")
    gain.operation = "MULTIPLY_ADD"
    gain.inputs[1].default_value, gain.inputs[2].default_value = 1.1, 0.55
    links.new(bw.outputs[0], gain.inputs[0])
    m1 = nodes.new("ShaderNodeMixRGB")
    m1.blend_type, m1.inputs["Fac"].default_value = "MULTIPLY", 1.0
    links.new(src, m1.inputs["Color1"])
    links.new(ramp.outputs["Color"], m1.inputs["Color2"])
    m2 = nodes.new("ShaderNodeMixRGB")
    m2.blend_type, m2.inputs["Fac"].default_value = "MULTIPLY", 1.0
    links.new(m1.outputs["Color"], m2.inputs["Color1"])
    links.new(gain.outputs[0], m2.inputs["Color2"])
    links.new(m2.outputs["Color"], base)
    bmp = nodes.new("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 0.8 * strength
    bmp.inputs["Distance"].default_value = 0.05
    links.new(hm.outputs["Color"], bmp.inputs["Height"])
    normal = bsdf.inputs["Normal"]
    if normal.is_linked:
        links.new(normal.links[0].from_socket, bmp.inputs["Normal"])
    links.new(bmp.outputs["Normal"], normal)


def _damp(tree, bsdf, strength=1.0):
    """Darken a stand-in's hollows towards a green-grey growth and draw the runs of rain down its flanks."""
    nodes, links = tree.nodes, tree.links
    base = bsdf.inputs["Base Color"]
    src = base.links[0].from_socket
    geo = nodes.new("ShaderNodeNewGeometry")
    ao = nodes.new("ShaderNodeAmbientOcclusion")
    ao.samples = 8
    ao.inputs["Distance"].default_value = 3.0
    hollow = nodes.new("ShaderNodeMapRange")          # 1 deep in a hollow, 0 in the open
    hollow.inputs["From Min"].default_value, hollow.inputs["From Max"].default_value = 0.85, 0.35
    links.new(ao.outputs["AO"], hollow.inputs["Value"])
    # the runs: noise drawn out down the fall line, strongest on the steep flanks
    runs_space = nodes.new("ShaderNodeMapping")
    runs_space.inputs["Scale"].default_value = (2.5, 2.5, 0.12)
    links.new(geo.outputs["Position"], runs_space.inputs["Vector"])
    nz = nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 1.4
    nz.inputs["Detail"].default_value = 4.0
    links.new(runs_space.outputs[0], nz.inputs["Vector"])
    runs = nodes.new("ShaderNodeMapRange")
    runs.inputs["From Min"].default_value, runs.inputs["From Max"].default_value = 0.52, 0.68
    links.new(nz.outputs["Fac"], runs.inputs["Value"])
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(geo.outputs["Normal"], sep.inputs[0])
    steep = nodes.new("ShaderNodeMapRange")
    steep.inputs["From Min"].default_value, steep.inputs["From Max"].default_value = 0.8, 0.2
    links.new(sep.outputs["Z"], steep.inputs["Value"])
    streak = nodes.new("ShaderNodeMath")
    streak.operation = "MULTIPLY"
    links.new(runs.outputs[0], streak.inputs[0])
    links.new(steep.outputs[0], streak.inputs[1])
    m1 = nodes.new("ShaderNodeMixRGB")
    m1.blend_type = "MULTIPLY"
    k = nodes.new("ShaderNodeMath")
    k.operation = "MULTIPLY"
    k.inputs[1].default_value = 0.9 * strength
    links.new(hollow.outputs[0], k.inputs[0])
    links.new(k.outputs[0], m1.inputs["Fac"])
    links.new(src, m1.inputs["Color1"])
    m1.inputs["Color2"].default_value = (0.2, 0.22, 0.14, 1.0)
    m2 = nodes.new("ShaderNodeMixRGB")
    m2.blend_type = "MULTIPLY"
    k2 = nodes.new("ShaderNodeMath")
    k2.operation = "MULTIPLY"
    k2.inputs[1].default_value = 0.45 * strength
    links.new(streak.outputs[0], k2.inputs[0])
    links.new(k2.outputs[0], m2.inputs["Fac"])
    links.new(m1.outputs["Color"], m2.inputs["Color1"])
    m2.inputs["Color2"].default_value = (0.55, 0.55, 0.5, 1.0)
    # the growth that settles where rain stands, on the tops, in patches a few metres across
    patch = nodes.new("ShaderNodeTexNoise")
    patch.inputs["Scale"].default_value = 0.6
    patch.inputs["Detail"].default_value = 8.0
    patch.inputs["Roughness"].default_value = 0.65
    links.new(geo.outputs["Position"], patch.inputs["Vector"])
    patchy = nodes.new("ShaderNodeMapRange")
    patchy.inputs["From Min"].default_value, patchy.inputs["From Max"].default_value = 0.45, 0.62
    links.new(patch.outputs["Fac"], patchy.inputs["Value"])
    up = nodes.new("ShaderNodeMapRange")
    up.inputs["From Min"].default_value, up.inputs["From Max"].default_value = 0.3, 0.9
    links.new(sep.outputs["Z"], up.inputs["Value"])
    grow = nodes.new("ShaderNodeMath")
    grow.operation = "MULTIPLY"
    links.new(patchy.outputs[0], grow.inputs[0])
    links.new(up.outputs[0], grow.inputs[1])
    k3 = nodes.new("ShaderNodeMath")
    k3.operation = "MULTIPLY"
    k3.inputs[1].default_value = 0.8 * strength
    links.new(grow.outputs[0], k3.inputs[0])
    m3 = nodes.new("ShaderNodeMixRGB")
    m3.blend_type = "MIX"
    links.new(k3.outputs[0], m3.inputs["Fac"])
    links.new(m2.outputs["Color"], m3.inputs["Color1"])
    m3.inputs["Color2"].default_value = (0.27, 0.3, 0.19, 1.0)
    links.new(m3.outputs["Color"], base)


def bedrock_material():
    """The enclosure's walls: bedrock with the horizontal banding of its limestone members."""
    from .materials import TEX, image
    mat = bpy.data.materials.new("bedrock")
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    sz = TEX["bedrock"]["tile_m"][0]
    mp = t.node("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / sz, 1 / sz, 1 / sz)
    t.link(geo.outputs["Position"], mp.inputs["Vector"])
    im = t.node("ShaderNodeTexImage", image=image("bedrock", "Diffuse"), projection="BOX", projection_blend=0.3)
    hm = t.node("ShaderNodeTexImage", image=image("bedrock", "Displacement", True), projection="BOX", projection_blend=0.3)
    t.link(mp.outputs[0], im.inputs["Vector"])
    t.link(mp.outputs[0], hm.inputs["Vector"])
    bands = t.node("ShaderNodeMapping")
    bands.inputs["Scale"].default_value = (0.05, 0.05, 1.6)
    t.link(geo.outputs["Position"], bands.inputs["Vector"])
    layer = t.ramp(t.noise(bands.outputs[0], 0.7, 3.0), [(0.3, hexlin("8f7556")), (0.5, hexlin("c2a57e")), (0.7, hexlin("a88a64"))])
    bw = t.node("ShaderNodeRGBToBW")
    t.link(im.outputs["Color"], bw.inputs[0])
    col = t.mix(1.0, layer, t.grey(t.math("ADD", t.math("MULTIPLY", bw.outputs[0], 1.8), 0.4)), "MULTIPLY")
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.92
    bmp = t.node("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 0.6
    bmp.inputs["Distance"].default_value = 0.08
    t.link(hm.outputs["Color"], bmp.inputs["Height"])
    t.link(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def walls(terrain, coll, material, state="today"):
    """Cut faces round the ditch's west, north and south sides, from its floor up to the ground outside."""
    x0, x1, y0, y1, floor = enclosure(state)
    runs = [((x0, y0), (x0, y1)), ((x0, y1), (x1, y1)), ((x1, y0), (x0, y0))]   # west, north, south
    # The cut face is not a plane (critic rounds 16 and 17: "a blank tan slab with a straight top edge"):
    # each bed of the rock stands out or is worn back by its own amount, and the face wavers along its
    # run, a little on the day it was cut and deeply after the long rains (metres, look choices).
    relief = {"first-time": 0.3, "built": 0.6}.get(state, 1.0)
    # And the fissures Schoch reads as rain's work: vertical runnels at uneven spacing, cut deepest
    # near the top where the water first ran over the brink. None on the day it was cut; shallow
    # as built (look choices: their spacing, width and depth).
    fissure = {"first-time": 0.0, "built": 0.3}.get(state, 1.0)
    rng = np.random.default_rng(29)
    rows = 18
    # the beds: one value every three rows, eased between, so a bed is a bed and not a zigzag
    knots = rng.uniform(-1.0, 1.0, rows // 3 + 2)
    kx = np.arange(rows + 1) / 3.0
    k0 = np.floor(kx).astype(int)
    kt = (1 - np.cos(np.pi * (kx - k0))) / 2
    beds = knots[k0] * (1 - kt) + knots[k0 + 1] * kt
    step = 0.3
    verts, faces = [], []
    for (ax, ay), (bx, by) in runs:
        length = np.hypot(bx - ax, by - ay)
        n = max(2, int(length / step))
        s_at = np.linspace(0.0, length, n + 1)
        centres, c = [], rng.uniform(0.5, 2.0)
        while c < length:
            centres.append((c, rng.uniform(0.12, 0.3), rng.uniform(0.35, 1.0)))
            c += rng.uniform(1.2, 3.8)
        cut = np.zeros(n + 1)
        for cc, w, depth in centres:
            cut = np.maximum(cut, depth * np.exp(-((s_at - cc) / w) ** 2))
        ts = np.linspace(0.0, 1.0, n + 1)
        px, py = ax + (bx - ax) * ts, ay + (by - ay) * ts
        # The ground just outside the cut, 1.5 m beyond the edge.
        dx, dy = by - ay, -(bx - ax)
        nl = np.hypot(dx, dy)
        ox, oy = -dx / nl * 1.5, -dy / nl * 1.5
        ux, uy = -dx / nl, -dy / nl                  # into the rock
        top = terrain.z(px + ox, py + oy)
        along = np.convolve(rng.uniform(-1.0, 1.0, n + 30), np.ones(30) / 30.0 * 1.8, mode="valid")[:n + 1]
        base = len(verts)
        for i in range(n + 1):
            # sunk just under the ground outside, so no rim of the face stands proud of it
            hi = max(top[i], floor + 0.5) + 0.05
            for r in range(rows + 1):
                f = r / rows
                z = floor - 0.5 + (hi - floor + 0.5) * f
                # recessed only between the foot and the brink, which stay where the cut put them
                d = relief * (0.55 * beds[r] + 0.45 * along[i] + 0.06 * rng.uniform(-1.0, 1.0)) * (0.0 if r in (0, rows) else 1.0)
                d = max(d, -0.2 * relief)
                if 0 < r < rows:
                    d += fissure * cut[i] * (0.35 + 0.65 * f) * min(1.0, (rows - r) / 2.0)
                verts.append((px[i] + ux * d, py[i] + uy * d, z))
        for i in range(n):
            for r in range(rows):
                a = base + (rows + 1) * i + r
                faces.append((a, a + rows + 1, a + rows + 2, a + 1))
    me = bpy.data.meshes.new("sphinx enclosure walls")
    me.from_pydata(verts, [], faces)
    me.shade_smooth()
    me.materials.append(material)
    ob = bpy.data.objects.new("sphinx enclosure walls", me)
    coll.objects.link(ob)
    return ob
