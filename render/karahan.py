"""
Karahan Tepe as object cards: the two scans in blender/models.json (the site from drone video, 333DDD, CC BY; Structure
AB's rock-cut pillar room, Megalithomania, CC BY-NC-SA), each lit by a low sun and framed on a plain backdrop, since a
scan is an island of ground that would float against a sky. Visual stand-ins: nothing of their form is a measurement,
and neither carries a scale of its own, so no card states one.

    blender -b --factory-startup -P render/karahan.py -- --out build/karahan [--size 1280x720] [--samples 128]

Writes <out>/karahan-site.png and <out>/karahan-ab.png. The views (azimuth and elevation of the camera about each
scan's centre, the lens, the sun) are look choices, in VIEWS.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# card: (model id, camera azimuth from +X counter-clockwise, elevation, lens mm, distance in bounding radii,
#        sun azimuth, sun elevation), all look choices
VIEWS = {"karahan-site": ("karahan-site-333ddd", 235.0, 52.0, 40.0, 1.85, 120.0, 32.0),
         "karahan-ab": ("karahan-ab-pit-megalithomania", 250.0, 38.0, 32.0, 1.6, 140.0, 48.0)}
BACKDROP = (0.105, 0.098, 0.090)     # the exhibit's card ground, a warm near-black


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    o = {"out": os.path.join(ROOT, "build", "karahan"), "size": "1280x720", "samples": "128", "only": ""}
    for i in range(0, len(argv) - 1, 2):
        o[argv[i].lstrip("-")] = argv[i + 1]
    return o


def load(model_id):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, "build", "models", model_id, "model.glb"))
    meshes = [o for o in set(bpy.data.objects) - before if o.type == "MESH"]
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return meshes, (lo + hi) / 2, (hi - lo).length / 2


def world(sun_az, sun_el):
    sc = bpy.context.scene
    w = bpy.data.worlds.new("karahan")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "NISHITA" if "NISHITA" in [i.identifier for i in sky.bl_rna.properties["sky_type"].enum_items] else sky.sky_type
    sky.sun_disc = False
    sky.sun_elevation = math.radians(sun_el)
    sky.sun_rotation = math.radians(90.0 - sun_az)
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = 0.35
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 4.2
    sun.data.angle = math.radians(0.6)
    sun.data.color = (1.0, 0.94, 0.84)
    a, e = math.radians(sun_az), math.radians(sun_el)
    sun.rotation_euler = Vector((-math.cos(e) * math.cos(a), -math.cos(e) * math.sin(a), -math.sin(e))).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(sun)


def camera(centre, radius, az, el, lens, dist):
    a, e = math.radians(az), math.radians(el)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.lens = lens
    d = radius * dist * 36.0 / lens
    cam.location = centre + Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e))) * d
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam


def composite(path):
    """The transparent render laid on the backdrop with a soft dark falloff at the edges (PIL is not in Blender)."""
    img = bpy.data.images.load(path)
    w, h = img.size
    px = list(img.pixels)
    for j in range(h):
        for i in range(w):
            k = (j * w + i) * 4
            r, g, b, al = px[k:k + 4]
            vx, vy = (i / w - 0.5) * 1.6, (j / h - 0.5) * 1.6
            v = max(0.0, 1.0 - 0.55 * (vx * vx + vy * vy))
            for c in range(3):
                px[k + c] = px[k + c] + (1.0 - al) * BACKDROP[c] * v
            px[k + 3] = 1.0
    img.pixels[:] = px
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()


def main():
    o = args()
    os.makedirs(o["out"], exist_ok=True)
    W, H = (int(v) for v in o["size"].split("x"))
    for card, (mid, az, el, lens, dist, sun_az, sun_el) in VIEWS.items():
        if o["only"] and card not in o["only"].split(","):
            continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        sc = bpy.context.scene
        sc.render.engine = "CYCLES"
        sc.cycles.samples = int(o["samples"])
        sc.cycles.use_denoising = True
        try:
            prefs = bpy.context.preferences.addons["cycles"].preferences
            prefs.compute_device_type = "OPTIX"
            prefs.get_devices()
            for dev in prefs.devices:
                dev.use = True
            sc.cycles.device = "GPU"
        except Exception:
            pass
        sc.render.resolution_x, sc.render.resolution_y = W, H
        sc.render.film_transparent = True
        sc.view_settings.view_transform = "AgX"
        sc.view_settings.look = "AgX - Medium High Contrast"
        meshes, centre, radius = load(mid)
        world(sun_az, sun_el)
        camera(centre, radius, az, el, lens, dist)
        path = os.path.abspath(os.path.join(o["out"], card + ".png"))
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        composite(path)
        json.dump({"card": card, "model": mid, "view": dict(azimuth=az, elevation=el, lens=lens, distance=dist),
                   "sun": dict(azimuth=sun_az, elevation=sun_el), "stand_in": True,
                   "note": "a scan framed as an object; nothing of its form is a measurement"},
                  open(os.path.join(o["out"], card + ".json"), "w"), indent=1)
        print("wrote", path, flush=True)


main()
