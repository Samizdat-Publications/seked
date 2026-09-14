"""
Render a still of the generated scene, headless:

    blender -b build/seked.blend -P blender/render.py -- --out build/hero.png [--view dawn|cutaway] [--width 1600 --height 900 --samples 64]

The default view, "dawn", is the plan's first hero shot: equinox dawn, the
sun low in the east, seen from the north-east so the grazing light picks
out the Great Pyramid's eight faces. "cutaway" makes the Great Pyramid's
casing translucent and looks in from the east, so the passages and chambers
built from Petrie's positions show in place. Materials follow the plan (Tura casing, core
limestone, Aswan granite for the interior, sand for the terrain) and are
created here if the scene has none, so generate.py stays material-free.
"""
import math
import os
import sys

import bpy  # noqa: E402  (only available inside Blender)


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opts = {"out": "build/hero.png", "width": "1600", "height": "900", "samples": "64", "engine": "", "view": "dawn"}
    i = 0
    while i < len(argv):
        key = argv[i].lstrip("-")
        if key in opts and i + 1 < len(argv):
            opts[key] = argv[i + 1]
            i += 2
        else:
            i += 1
    return opts


def material(name, rgb, roughness):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
    return mat


def assign_materials():
    casing = material("Tura casing", (0.86, 0.82, 0.72), 0.55)
    core = material("Core limestone", (0.70, 0.58, 0.40), 0.85)
    granite = material("Aswan granite", (0.45, 0.30, 0.28), 0.6)
    sand = material("Plateau sand", (0.72, 0.62, 0.46), 0.95)
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        name = obj.name
        if name.startswith("Terrain"):
            mat = sand
        elif "(today)" in name:
            mat = core
        elif "(as built)" in name:
            mat = casing
        else:
            mat = granite
        obj.data.materials.clear()
        obj.data.materials.append(mat)


def look_at(obj, target):
    direction = (target - obj.location).normalized()
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


VIEWS = {
    # camera location, look-at target, lens, sun elevation and azimuth in degrees
    "dawn": {"location": (760.0, 700.0, 150.0), "target": (-220.0, -320.0, 60.0), "lens": 45.0, "sun": (6.0, 90.0)},
    "cutaway": {"location": (430.0, 170.0, 130.0), "target": (-15.0, -5.0, 50.0), "lens": 40.0, "sun": (35.0, 135.0)},
}


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


def setup_view(scene, view):
    from mathutils import Vector
    v = VIEWS[view]
    cam_data = bpy.data.cameras.new("Hero camera")
    cam_data.lens = v["lens"]
    cam_data.clip_end = 20000.0
    cam = bpy.data.objects.new("Hero camera", cam_data)
    scene.collection.objects.link(cam)
    cam.location = Vector(v["location"])
    look_at(cam, Vector(v["target"]))
    scene.camera = cam
    if view == "cutaway":
        g1 = bpy.data.objects.get("G1 Khufu (as built)")
        if g1 is not None:
            make_translucent(g1, 0.22)

    sun_data = bpy.data.lights.new("Dawn sun", "SUN")
    sun_data.energy = 5.0
    sun_data.angle = math.radians(0.53)
    sun_data.color = (1.0, 0.86, 0.70)
    sun = bpy.data.objects.new("Dawn sun", sun_data)
    scene.collection.objects.link(sun)
    # Sun on the equinox, 6 degrees up, bearing due east: a track-to rotation
    # pointing the lamp's -Z along the light direction (from the sun towards the ground).
    elevation, azimuth = (math.radians(a) for a in v["sun"])
    light_dir = Vector((-math.cos(elevation) * math.sin(azimuth), -math.cos(elevation) * math.cos(azimuth), -math.sin(elevation)))
    sun.rotation_euler = light_dir.to_track_quat("-Z", "Y").to_euler()

    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg is not None:
        bg.inputs["Color"].default_value = (0.55, 0.66, 0.80, 1.0)
        bg.inputs["Strength"].default_value = 0.6


def choose_engine(scene, requested):
    available = {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
    order = [requested] if requested else []
    order += ["BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES", "BLENDER_WORKBENCH"]
    for engine in order:
        if engine in available:
            scene.render.engine = engine
            return engine
    raise RuntimeError(f"no usable render engine among {sorted(available)}")


def main():
    opts = parse_args()
    scene = bpy.context.scene
    assign_materials()
    for obj in bpy.data.objects:
        if obj.name.startswith("Terrain"):
            ground = obj.name == "Terrain (ground)"
            obj.hide_set(not ground)
            obj.hide_render = not ground
            if ground:
                for poly in obj.data.polygons:
                    poly.use_smooth = True
    if opts["view"] not in VIEWS:
        raise SystemExit(f"unknown view {opts['view']!r}; choose from {sorted(VIEWS)}")
    setup_view(scene, opts["view"])
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
    bpy.ops.render.render(write_still=True)
    print(f"rendered {out} with {engine}, {samples} samples")


if __name__ == "__main__":
    main()
