"""
The Sphinx's eras, cut from one master (docs/rethink-2026-10.md, "The Sphinx: one master, subtracted").

    blender -b --factory-startup -P render/giza/sphinx_eras.py -- [--eras first-time,lion] [--master sphinx-master]

The lions used to disagree between eras because each was its own Meshy generation. Now the First Time's
lion (`sphinx-master` in blender/models.json) is the master, and each later Sphinx is made from it here,
so the eras are one statue at different ages:

- **first-time** (c. 10,500 BCE): the master, welded and subdivided once, otherwise untouched.
- **lion** (c. 7000 BCE): the long rains. Each point recedes by the bed it is cut in, by how much it faces
  the sky and by the vertical joints (render/giza/weathering.py: the beds are sourced, the rates look
  choices), and the profile is then rounded, the way rain rounds an arris.
- **built** (c. 2500 BCE): further wear of the same kind. The king's head carved inside the lion's
  is still to come.
- **today**: the same, further again; the restorations and the losses are still to come.

Each era is written to build/models/<master>-<era>/model.glb in the master's own frame, as a "finish" of
the master: sphinx.statue fits it to the footprint exactly as it fits the master, so every era stands in
the same place at the same size. The master's own texture rides along (the vertices move, the UVs stay),
and the render lays the enclosure's bedrock over it as it does for the other lions.

Nothing of the master's form is a measurement, and nor is any era's: they illustrate the claim's account
of how the statue aged.
"""
import json
import os
import sys

import bmesh
import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from giza import data, weathering  # noqa: E402
from giza.sphinx import BLENDER_DIR  # noqa: E402

if BLENDER_DIR not in sys.path:
    sys.path.insert(0, BLENDER_DIR)
import render_standins as rs  # noqa: E402

MODELS = os.path.join(data.REPO, "build", "models")
ERAS = ("first-time", "lion", "built", "today")
# Rounding after the recession: Laplacian passes, more the longer the stone stood (look choices).
ROUNDING = {"first-time": 0, "lion": 3, "built": 4, "today": 6}


def ground_truth():
    """The ARCE height and length the master is scaled to (arce-sphinx-1991, unverified)."""
    rec = {r["key"]: r["value"] for r in data.records("g2-g3-sphinx.json")}
    return rec["sphinx.height"], rec["sphinx.length"]


def welded(path, name):
    """The master's meshes as one welded bmesh: UV seams joined, so a displaced surface cannot crack along them."""
    mesh = rs.import_model(path, name, keep_materials=True)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    return mesh, bm


def derive(bm, era, front="-y"):
    """Wear the welded master `bm` to `era`, in place."""
    height, _ = ground_truth()
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
    bm.normal_update()
    co = np.array([v.co[:] for v in bm.verts])
    nor = np.array([v.normal[:] for v in bm.verts])
    axis = {"x": 0, "y": 1}[front[-1]]
    sign = -1.0 if front.startswith("-") else 1.0
    along = co[:, axis] * sign                       # grows towards the face
    u = (along - along.min()) / np.ptp(along)        # rump 0, forepaws 1
    h = (co[:, 2] - co[:, 2].min()) / np.ptp(co[:, 2])
    scale = height / np.ptp(co[:, 2])                # metres per model unit
    length = np.ptp(along) * scale
    d = weathering.recession(u, h, nor[:, 2], era, height, length) / scale
    moved = co - nor * d[:, None]
    for v, c in zip(bm.verts, moved):
        v.co = c
    for _ in range(ROUNDING[era]):
        bmesh.ops.smooth_vert(bm, verts=bm.verts[:], factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    return float(d.max() * scale), float(np.median(d) * scale)


def write(mesh, bm, path):
    bm.to_mesh(mesh)
    obj = bpy.data.objects.new(mesh.name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for o in bpy.context.scene.objects:
        o.select_set(o is obj)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True)
    bpy.data.objects.remove(obj, do_unlink=True)


def main(argv):
    args = dict(zip(argv[::2], argv[1::2]))
    master = args.get("--master", "sphinx-master")
    eras = args.get("--eras", ",".join(ERAS)).split(",")
    models = {m["id"]: m for m in data.load_json(BLENDER_DIR, "models.json")["models"]}
    model = models[master]
    source = os.path.join(MODELS, master, "model.glb")
    if not os.path.exists(source):
        sys.exit(f"{source} is not on disk: python scripts/models.py finds it")
    for era in eras:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        mesh, bm = welded(source, f"{master} {era}")
        deepest, median = derive(bm, era, model.get("front", "-y"))
        out = os.path.join(MODELS, f"{master}-{era}", "model.glb")
        write(mesh, bm, out)
        bm.free()
        record = {"master": master, "era": era, "deepest_m": round(deepest, 3), "median_m": round(median, 3),
                  "vertices": len(mesh.vertices), "made_by": "render/giza/sphinx_eras.py"}
        with open(os.path.join(os.path.dirname(out), "era.json"), "w", encoding="utf-8") as f:
            json.dump(record, f, indent=2)
        print(f"{master}-{era}: {out}, {len(mesh.vertices)} vertices, deepest {deepest:.2f} m, median {median:.2f} m")


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
