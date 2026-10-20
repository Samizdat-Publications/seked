"""
The Sphinx's eras, cut from one master (docs/rethink-2026-10.md, "The Sphinx: one master, subtracted").

    blender -b --factory-startup -P render/giza/sphinx_eras.py -- [--eras first-time,lion] [--master sphinx-master]

The lions used to disagree between eras because each was its own Meshy generation. Now the First Time's
lion (`sphinx-master` in blender/models.json) is the master, and each later Sphinx is made from it here,
so the eras are one statue at different ages:

- **first-time** (c. 10,500 BCE): the master, welded, lengthened and subdivided once, otherwise untouched.
  Lengthened because the image model drew a shorter lion than the monument (2.5 : 1 against the ARCE
  3.6 : 1, `sphinx.length` over `sphinx.height`): the flank and the forelegs are stretched along the body
  and the haunch, the head and the paws are left as drawn, as the lion before it was lengthened in 2D
  (a look choice; where the zones fall is read off the mesh's own height profile).
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
# How the length the master lacks is shared between the flank and the forelegs (look choices).
STRETCH_SHARE = {"flank": 0.8, "forelegs": 0.2}     # about 2.7 and 1.4 times, near the old lion's 2D stretch


def zones(u, h):
    """Where the flank and the forelegs lie along the body, read off the height profile: the head is the
    profile's peak; the flank is the run behind it where the back stays level; the forelegs run from where
    the profile drops in front of the head to the paws, the last eighth."""
    bins = np.linspace(0.0, 1.0, 81)
    top = np.array([h[(u >= a) & (u < b)].max() if ((u >= a) & (u < b)).any() else 0.0 for a, b in zip(bins[:-1], bins[1:])])
    mid = (bins[:-1] + bins[1:]) / 2
    head = mid[np.argmax(top)]
    back = np.median(top[(mid > 0.1) & (mid < head - 0.2)])
    level = (top > 0.95 * back) & (top < 1.06 * back) & (mid < head)
    ahead = mid[(mid > head) & (top < 0.35)]
    return {"flank": (mid[level].min() + 0.03, mid[level].max() - 0.03),
            "forelegs": ((ahead.min() if len(ahead) else head + 0.1) + 0.01, 0.875)}


def lengthen(co, axis, sign, ratio):
    """Stretch the flank and the forelegs along the body until its length is `ratio` times its height."""
    along = co[:, axis] * sign
    a0, span = along.min(), np.ptp(along)
    u = (along - a0) / span
    h = (co[:, 2] - co[:, 2].min()) / np.ptp(co[:, 2])
    extra = ratio * np.ptp(co[:, 2]) - span
    if extra <= 0:
        return co, {}
    z = zones(u, h)
    shift = np.zeros(len(u))
    for name, (lo, hi) in z.items():
        k = 1.0 + STRETCH_SHARE[name] * extra / ((hi - lo) * span)
        # inside the zone a point moves by how far into it it lies; past it, by the whole stretch
        shift += (k - 1.0) * np.clip(u - lo, 0.0, hi - lo) * span
    out = co.copy()
    out[:, axis] = (along + shift) * sign
    return out, {name: (round(lo, 3), round(hi, 3)) for name, (lo, hi) in z.items()}


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
    """Lengthen the welded master `bm` to the ARCE proportions and wear it to `era`, in place."""
    height, length_arce = ground_truth()
    axis = {"x": 0, "y": 1}[front[-1]]
    sign = -1.0 if front.startswith("-") else 1.0
    co = np.array([v.co[:] for v in bm.verts])
    co, stretched = lengthen(co, axis, sign, length_arce / height)
    for v, c in zip(bm.verts, co):
        v.co = c
    print(f"lengthened to {length_arce / height:.2f} : 1 through {stretched}")
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=1, use_grid_fill=True)
    bm.normal_update()
    co = np.array([v.co[:] for v in bm.verts])
    nor = np.array([v.normal[:] for v in bm.verts])
    along = co[:, axis] * sign                       # grows towards the face
    u = (along - along.min()) / np.ptp(along)        # rump 0, forepaws 1
    h = (co[:, 2] - co[:, 2].min()) / np.ptp(co[:, 2])
    scale = height / np.ptp(co[:, 2])                # metres per model unit
    length = np.ptp(along) * scale
    d = weathering.recession(u, h, nor[:, 2], era, height, length) / scale
    if d.any():
        d, nor = held(bm, co, nor, d)
    moved = co - nor * d[:, None]
    for v, c in zip(bm.verts, moved):
        v.co = c
    for _ in range(ROUNDING[era]):
        bmesh.ops.smooth_vert(bm, verts=bm.verts[:], factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    return float(d.max() * scale), float(np.median(d) * scale)


# A point may recede by at most this share of the stone behind it, so a nose, a lappet's edge or a toe wears
# thinner rather than folding through itself (a look choice); and the recession and the normals are averaged
# over this many rings of neighbours, so neighbouring points move together.
THIN = 0.3
SPREAD = 3


def held(bm, co, nor, d):
    """The recession `d`, capped by the thickness of the stone behind each point and smoothed over the mesh,
    and the normals it is applied along, smoothed the same way."""
    from mathutils.bvhtree import BVHTree
    tree = BVHTree.FromBMesh(bm)
    thick = np.full(len(co), np.inf)
    for i, v in enumerate(bm.verts):
        if d[i] > 0:
            hit = tree.ray_cast(v.co - v.normal * 1e-5, -v.normal)
            if hit[0] is not None:
                thick[i] = hit[3]
    d = np.minimum(d, THIN * thick)
    edges = np.array([(e.verts[0].index, e.verts[1].index) for e in bm.edges])
    degree = np.bincount(edges.ravel(), minlength=len(co)).astype(float)
    for _ in range(SPREAD):
        total = np.zeros(len(co)); vec = np.zeros_like(nor)
        np.add.at(total, edges[:, 0], d[edges[:, 1]]); np.add.at(total, edges[:, 1], d[edges[:, 0]])
        np.add.at(vec, edges[:, 0], nor[edges[:, 1]]); np.add.at(vec, edges[:, 1], nor[edges[:, 0]])
        d = 0.5 * d + 0.5 * total / np.maximum(degree, 1.0)
        nor = 0.5 * nor + 0.5 * vec / np.maximum(degree, 1.0)[:, None]
        nor /= np.maximum(np.linalg.norm(nor, axis=1), 1e-9)[:, None]
    return np.minimum(d, THIN * thick), nor


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
