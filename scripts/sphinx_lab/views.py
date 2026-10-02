"""
Clay views of a GLB for an image model to re-sculpt, run inside Blender:

    blender -b --factory-startup -P scripts/sphinx_lab/views.py -- MODEL.glb OUTDIR [--front -y] [--largest]

Writes OUTDIR/<view>.png for side-left, front, back, three-quarter front and three-quarter back,
each the whole statue on a plain light ground under soft light, in a uniform pale matte, so the
proportions are what the image model takes and not the old texture.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src, out = os.path.abspath(argv[0]), os.path.abspath(argv[1])
front = argv[argv.index("--front") + 1] if "--front" in argv else "-y"
os.makedirs(out, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if "--largest" in argv and len(meshes) > 1:
    meshes.sort(key=lambda o: len(o.data.vertices), reverse=True)
    for o in meshes[1:]:
        bpy.data.objects.remove(o)
    meshes = meshes[:1]
clay = bpy.data.materials.new("clay")
clay.use_nodes = True
b = clay.node_tree.nodes["Principled BSDF"]
b.inputs["Base Color"].default_value = (0.62, 0.55, 0.45, 1)
b.inputs["Roughness"].default_value = 0.85
if "--textured" not in argv:
    for o in meshes:
        o.data.materials.clear()
        o.data.materials.append(clay)
dg = bpy.context.evaluated_depsgraph_get()
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
centre, size = (lo + hi) / 2, (hi - lo)
radius = size.length / 2
print("bbox", tuple(round(v, 3) for v in size))

sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.samples = 48
sc.cycles.device = "GPU"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
except Exception:
    pass
sc.render.resolution_x, sc.render.resolution_y = 1536, 1024
sc.view_settings.view_transform = "AgX"
world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.82, 0.82, 0.8, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
sc.world = world
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 3.0
sun.data.angle = math.radians(12)
sun.rotation_euler = (math.radians(50), 0, math.radians(35))
sc.collection.objects.link(sun)
# ground plane, pale, so the statue sits rather than floats
bpy.ops.mesh.primitive_plane_add(size=radius * 12, location=(centre.x, centre.y, lo.z))
g = bpy.context.active_object
gm = bpy.data.materials.new("ground")
gm.use_nodes = True
gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.78, 0.77, 0.74, 1)
g.data.materials.append(gm)

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.lens = 50
sc.collection.objects.link(cam)
sc.camera = cam
# the statue's face direction as an azimuth (radians, from +x anticlockwise)
face = {"-y": -math.pi / 2, "+y": math.pi / 2, "-x": math.pi, "+x": 0.0}[front]
views = {"side": face + math.pi / 2, "front": face, "back": face + math.pi,
         "front34": face + math.radians(40), "back34": face + math.radians(140)}
for name, az in views.items():
    elev = math.radians(12 if name in ("side",) else 18)
    span = max(size.x, size.y) * (1.0 if name == "side" else 1.0) if name in ("side", "front34", "back34")         else max(min(size.x, size.y), size.z) * 3.2
    dist = (span * 0.5) / math.tan(cam.data.angle / 2) + radius * 0.3
    d = Vector((math.cos(az) * math.cos(elev), math.sin(az) * math.cos(elev), math.sin(elev)))
    target = centre + Vector((0, 0, -size.z * 0.1))
    cam.location = target + d * dist
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(out, f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print("wrote", name)
