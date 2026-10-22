"""
The Sphinx lab's fixed views of one era's statue, for the modeller critic (scripts/sphinx_lab/critic.py):

    blender -b --factory-startup -P scripts/sphinx_lab/lab_sheet.py -- --state lion --out DIR [--finish lion-c03]
        [--size 1024x640] [--samples 64] [--clay-only]

The statue is placed and finished by the renderer's own code (render/giza/sphinx.py `statue`), so what the
critic sees is what the films show; `--finish` swaps in a candidate written to build/models/<master>-<finish>/
without installing it. Seven views (front, south flank, north flank, three-quarter front, head close, back,
the south flank close on the body's beds), each in the era's material and in a uniform clay, under the same
sun and sky every time, on a plain floor at the ditch's level. Writes DIR/<pass>-<view>.png and the two
sheets DIR/sheet-material.jpg and DIR/sheet-clay.jpg.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(REPO, "render"))
from giza import sphinx, states  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
args = {argv[i]: (argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith("--") else True)
        for i in range(len(argv)) if argv[i].startswith("--")}
state = args.get("--state", "lion")
out = os.path.abspath(args["--out"])
w, h = (int(v) for v in args.get("--size", "1024x640").split("x"))
os.makedirs(out, exist_ok=True)

if args.get("--finish"):
    variant = states.spec(state)["sphinx"]
    model_id, _ = sphinx.MODEL_FOR[variant]
    sphinx.MODEL_FOR[variant] = (model_id, args["--finish"])

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
coll = sc.collection
obj = sphinx.statue(state, coll)
if obj is None:
    sys.exit("no statue")
bpy.context.view_layer.update()
pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
c = (lo + hi) / 2
L, H = hi.x - lo.x, hi.z - lo.z
floor = sphinx.enclosure(state)[4]

# The floor: a plain warm stone, big enough to catch the shadows.
# a hand's breadth over the ditch's floor, as its sand and rubble stand, so the statue's cut foot sits in it
bpy.ops.mesh.primitive_plane_add(size=400, location=(c.x, c.y, floor + 0.15))
ground = bpy.context.active_object
gm = bpy.data.materials.new("lab floor")
gm.use_nodes = True
gb = gm.node_tree.nodes["Principled BSDF"]
gb.inputs["Base Color"].default_value = (0.42, 0.36, 0.28, 1)
gb.inputs["Roughness"].default_value = 0.95
ground.data.materials.append(gm)

# The light: an afternoon sun from the south-west, 35 degrees up, and a pale sky (look choices, fixed).
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy, sun.data.angle = 4.5, math.radians(0.6)
sun.data.color = (1.0, 0.95, 0.86)
az, el = math.radians(225.0), math.radians(35.0)
d = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
sun.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
coll.objects.link(sun)
world = bpy.data.worlds.new("lab sky")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.66, 0.82, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55
sc.world = world

sc.render.engine = "CYCLES"
sc.cycles.device = "GPU"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "OPTIX"
prefs.get_devices()
for dev in prefs.devices:
    dev.use = dev.type != "CPU"
sc.cycles.samples = int(args.get("--samples", 64))
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = w, h
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Medium High Contrast"

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
coll.objects.link(cam)
sc.camera = cam
# the statue faces east (+x), its south flank to -y
head = Vector((hi.x - 0.17 * L, c.y, lo.z + 0.82 * H))
body = Vector((c.x - 0.12 * L, c.y, lo.z + 0.4 * H))
# name: (camera position, target, focal length mm)
VIEWS = {
    "front": (Vector((hi.x + 3.2 * H, c.y, lo.z + 0.5 * H)), Vector((hi.x, c.y, lo.z + 0.5 * H)), 50),
    "south": (Vector((c.x, lo.y - 1.3 * L, lo.z + 0.5 * H)), Vector((c.x, c.y, lo.z + 0.45 * H)), 50),
    "north": (Vector((c.x, hi.y + 1.3 * L, lo.z + 0.5 * H)), Vector((c.x, c.y, lo.z + 0.45 * H)), 50),
    "front34": (Vector((hi.x + 0.75 * L, lo.y - 0.75 * L, lo.z + 1.1 * H)), Vector((c.x + 0.12 * L, c.y, lo.z + 0.35 * H)), 50),
    "head": (head + Vector((0.6 * L, -0.46 * L, 0.04 * H)), head + Vector((0, 0, -0.06 * H)), 85),
    "back": (Vector((lo.x - 3.6 * H, c.y - 1.2 * H, lo.z + 0.9 * H)), Vector((lo.x, c.y, lo.z + 0.45 * H)), 50),
    "beds": (body + Vector((0.0, -0.62 * L, 0.1 * H)), body, 50),
}


def clay():
    m = bpy.data.materials.new("lab clay")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.36, 0.32, 0.27, 1)
    b.inputs["Roughness"].default_value = 0.85
    return m


passes = ["clay"] if args.get("--clay-only") else ["material", "clay"]
clay_mat = clay()
for p in passes:
    bpy.context.view_layer.material_override = clay_mat if p == "clay" else None
    for name, (pos, tgt, lens) in VIEWS.items():
        cam.location = pos
        cam.rotation_euler = (tgt - pos).to_track_quat("-Z", "Y").to_euler()
        cam.data.lens = lens
        cam.data.clip_end = 2000
        sc.render.filepath = os.path.join(out, f"{p}-{name}.png")
        bpy.ops.render.render(write_still=True)
        print("wrote", sc.render.filepath, flush=True)
