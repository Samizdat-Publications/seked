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
MODEL_FOR = {"anubis": ("sphinx-anubis-fresh", "paint-black2"), "lion": ("sphinx-lion", None),
             "lion-fresh": ("sphinx-lion-pristine", None), "carved": ("sphinx-carved", None),
             "buried": ("sphinx-meshy", None), "excavated": ("sphinx-meshy", None)}
TINTED = {"sphinx-meshy", "sphinx-lion", "sphinx-lion-fresh"}      # generated textures with a pink cast
# The carved Sphinx's generated texture leaves the body paper white under a painted head: the body is
# taken down to the bedrock's warm limestone (a look choice; traces of red ochre survive on it).
WARMED = {"sphinx-carved": (0.9, 0.78, 0.62, 1.0),
          # the First Time's freshly carved lion (sphinx-lion-pristine) renders pale ivory beside the bedrock walls
          "sphinx-lion-pristine": (0.9, 0.8, 0.66, 1.0)}
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
    verts, faces = [], []
    for (ax, ay), (bx, by) in runs:
        n = max(2, int(np.hypot(bx - ax, by - ay) / 1.0))
        ts = np.linspace(0.0, 1.0, n + 1)
        px, py = ax + (bx - ax) * ts, ay + (by - ay) * ts
        # The ground just outside the cut, 1.5 m beyond the edge.
        dx, dy = by - ay, -(bx - ax)
        nl = np.hypot(dx, dy)
        ox, oy = -dx / nl * 1.5, -dy / nl * 1.5
        top = terrain.z(px + ox, py + oy)
        base = len(verts)
        for i in range(n + 1):
            verts.append((px[i], py[i], floor - 0.5))
            verts.append((px[i], py[i], max(top[i], floor + 0.5) + 0.3))
        for i in range(n):
            a = base + 2 * i
            faces.append((a, a + 2, a + 3, a + 1))
    me = bpy.data.meshes.new("sphinx enclosure walls")
    me.from_pydata(verts, [], faces)
    me.materials.append(material)
    ob = bpy.data.objects.new("sphinx enclosure walls", me)
    coll.objects.link(ob)
    return ob
