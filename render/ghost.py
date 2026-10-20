"""
The lion's head ghosted round the king's: the hero image chapter 2 opens on (docs/plan.html, "The Sphinx,
one master").

    blender -b --factory-startup -P render/ghost.py -- [--out build/preview/ghost.png] [--size 1600x900] [--samples 64]

Two of the master's eras, both from render/giza/sphinx_eras.py and so the same statue: as built (c. 2500
BCE, the king's head carved inside the lion's) drawn as stone, and the long rains (c. 7000 BCE, the lion
before the recarving) drawn round it as a glassy shell, but only its head and mane, the stone the claim
says Khafre's sculptors cut away. A studio still in the master's own frame, not a view of the plateau:
the same figure, lit to read. Both forms are stand-ins and neither is a measurement.
"""
import math
import os
import sys

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from giza import data  # noqa: E402
from giza.sphinx import BLENDER_DIR  # noqa: E402

if BLENDER_DIR not in sys.path:
    sys.path.insert(0, BLENDER_DIR)
import render_standins as rs  # noqa: E402

MODELS = os.path.join(data.REPO, "build", "models")
GHOST_FROM = 0.40      # of the statue's height: the lion's head and mane, drawn as the ghost (a look choice)


def stone(name, colour):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = colour
    bsdf.inputs["Roughness"].default_value = 0.85
    return mat


def ghost():
    """Clear glass with a faint warm tint, and a rim of light where the shell turns away from the camera."""
    mat = bpy.data.materials.new("ghost")
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    clear = nt.nodes.new("ShaderNodeBsdfTransparent")
    clear.inputs["Color"].default_value = (0.99, 0.97, 0.93, 1.0)
    rim = nt.nodes.new("ShaderNodeEmission")
    rim.inputs["Color"].default_value = (1.0, 0.86, 0.62, 1.0)
    rim.inputs["Strength"].default_value = 0.9
    facing = nt.nodes.new("ShaderNodeLayerWeight")
    facing.inputs["Blend"].default_value = 0.12
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(facing.outputs["Facing"], mix.inputs["Fac"])
    nt.links.new(clear.outputs[0], mix.inputs[1])
    nt.links.new(rim.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return mat


def load(era, material):
    mesh = rs.import_model(os.path.join(MODELS, f"sphinx-master-{era}", "model.glb"), f"sphinx {era}")
    mesh.materials.clear()
    mesh.materials.append(material)
    obj = bpy.data.objects.new(mesh.name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def main(argv):
    args = dict(zip(argv[::2], argv[1::2]))
    out = args.get("--out", os.path.join(data.REPO, "build", "preview", "ghost.png"))
    w, h = (int(x) for x in args.get("--size", "1600x900").split("x"))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    built = load("built", stone("built stone", (0.78, 0.70, 0.56, 1.0)))
    lion = load("lion", ghost())
    # Only the lion's head and mane are the ghost: the rest of its body is the built statue's own.
    co = np.array([v.co[:] for v in lion.data.vertices])
    zr = (co[:, 2] - co[:, 2].min()) / np.ptp(co[:, 2])
    head_at = co[np.argmax(co[:, 2])]
    keep = (zr > GHOST_FROM) & (np.abs(co[:, 1] - head_at[1]) < 0.18 * np.ptp(co[:, 1]))
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(lion.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep[v.index]], context="VERTS")
    bm.to_mesh(lion.data)
    bm.free()
    # A floor, a sky and a low sun from the front left, as the morning sun finds the face.
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, co[:, 2].min()))
    sc.objects["Plane"].data.materials.append(stone("floor", (0.62, 0.55, 0.44, 1.0)))
    world = bpy.data.worlds.new("sky")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.16, 0.22, 0.34, 1.0)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.55
    sc.world = world
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 5.5
    sun.angle = math.radians(1.0)
    so = bpy.data.objects.new("sun", sun)
    sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(62), 0.0, math.radians(-35))
    # The camera three-quarters in front, a little below the head, looking up at it.
    cam = bpy.data.cameras.new("camera")
    cam.lens = 70
    co_cam = bpy.data.objects.new("camera", cam)
    sc.collection.objects.link(co_cam)
    sc.camera = co_cam
    from mathutils import Vector
    target = Vector((float(head_at[0]), float(head_at[1]) + 0.02, float(co[:, 2].min() + 0.74 * np.ptp(co[:, 2]))))
    co_cam.location = target + Vector((1.05, -1.45, -0.02))
    co_cam.rotation_euler = (target - co_cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = int(args.get("--samples", 64))
    sc.cycles.use_denoising = True
    sc.cycles.transparent_max_bounces = 16
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.filepath = out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print(f"ghost: {out}")


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
