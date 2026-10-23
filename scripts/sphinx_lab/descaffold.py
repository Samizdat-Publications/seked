"""
Today's Sphinx without the scaffolding its photographs carried: a candidate for the lab (scripts/sphinx_lab/).

    blender -b --factory-startup -P scripts/sphinx_lab/descaffold.py -- [--tag clean] [--set KEY=VALUE ...]

sphinx-meshy is Meshy's reconstruction from four photographs, and the photographs had restorers' scaffolding on the
south flank, at the rump and on the back, which the model took in as stone-coloured towers fused to the body. The
mesh is split along its texture seams, which is why it looked open; welded, it is watertight. So:

1. the shell, welded, in metres, goes to scripts/sphinx_lab/descaffold_voxels.py (the system Python): it is a
   hollow shell a few centimetres thick (which is why an opening of the mesh itself ate the statue), so there it is
   voxelized, filled into a solid and opened (eroded and grown back by OPEN), which takes off anything thinner than
   about twice that: the scaffold's struts and ladders, not the stone;
2. each face of the textured original lying further than THIN off the opened solid is thin; the thin faces are
   grouped by adjacency and only groups of at least MIN_GROUP faces outside the head go, so the ledges' edges and
   the face's features stay;
3. where they went, the opened solid's surface stands in, set SINK behind the original so their seams do not
   show, and takes its texture from the nearest stone that stayed (a data transfer of the UVs).

Writes build/models/sphinx-meshy-<tag>/model.glb in the original's own frame, so render/giza/sphinx.py fits it as it
fits sphinx-meshy (`MODEL_FOR["excavated"] = ("sphinx-meshy", "<tag>")`), and record.json. Every number is a look
choice; nothing of the form is a measurement.
"""
import json
import math
import os
import subprocess
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
MODELS = os.path.join(REPO, "build", "models")
SOURCE = os.path.join(MODELS, "sphinx-meshy", "model.glb")

PARAMS = {
    "length": 73.0,       # m, the statue's length, to put the model's units into metres (sphinx.py fits it exactly)
    "grid": 0.08,         # m, the voxel
    "open": 0.3,          # m, the opening's radius: struts thinner than about twice this go
    "thin": 0.15,         # m, a face this far from the opened surface was taken off by the opening
    "min_piece": 0.08,    # m3: a piece the opening took off whole is scaffold if at least this big
    "min_group": 400,     # faces: a thin group smaller than this is an edge of the stone, and stays
    "head_keep": 9.0,     # m, nothing within this of the head's top is touched
    "sink": 0.04,         # m, the stand-in surface set behind the original
    "reach": 1.5,         # m, how far from a removed face the stand-in surface is taken
}


def load():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SOURCE)
    obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    assert len(obs) == 1, [o.name for o in obs]
    o = obs[0]
    o.data.transform(o.matrix_world)
    o.matrix_world.identity()
    return o


def main(argv):
    args, sets, i = {}, [], 0
    while i < len(argv):
        if argv[i] == "--set":
            sets.append(argv[i + 1]); i += 2
        elif argv[i].startswith("--"):
            args[argv[i]] = argv[i + 1] if i + 1 < len(argv) else True; i += 2
        else:
            i += 1
    P = dict(PARAMS)
    for kv in sets:
        key, v = kv.split("=", 1)
        P[key] = json.loads(v)
    tag = args.get("--tag", "clean")

    obj = load()
    me = obj.data
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    k = P["length"] / np.ptp(co, axis=0).max()          # metres per model unit
    print(f"source: {len(me.polygons):,} faces, {k:.3f} m a unit", flush=True)

    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    centres = np.array([f.calc_center_median()[:] for f in bm.faces]) * k
    wb = bm.copy()
    wb.transform(Matrix.Scale(k, 4))
    bmesh.ops.remove_doubles(wb, verts=wb.verts, dist=1e-4)
    bmesh.ops.triangulate(wb, faces=wb.faces)
    wb.verts.ensure_lookup_table()
    verts = np.array([v.co[:] for v in wb.verts], np.float32)
    tris = np.array([[v.index for v in f.verts] for f in wb.faces], np.int32)
    wb.free()
    work = os.path.join(REPO, "build", "sphinx-lab", "descaffold")
    os.makedirs(work, exist_ok=True)
    src, dst, prm = (os.path.join(work, n) for n in ("shell.npz", "voxels.npz", "params.json"))
    np.savez(src, verts=verts, tris=tris, centres=centres.astype(np.float32))
    json.dump(P, open(prm, "w", encoding="utf-8"))
    subprocess.run(["python", os.path.join(HERE, "descaffold_voxels.py"), src, dst, prm], check=True)
    vox = np.load(dst)
    top = centres[np.argmax(centres[:, 2])]
    thin = vox["thin"] & (np.linalg.norm(centres - top, axis=1) > P["head_keep"])
    print(f"thin faces: {int(thin.sum()):,}", flush=True)
    # adjacency through welded positions: faces sharing a vertex position
    vco = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", vco)
    _, canon = np.unique(np.round(vco.reshape(-1, 3) * k, 4), axis=0, return_inverse=True)
    canon = canon.ravel()
    by_vert = {}
    thin_idx = np.nonzero(thin)[0]
    for fi in thin_idx:
        for v in bm.faces[fi].verts:
            by_vert.setdefault(canon[v.index], []).append(fi)
    seen, groups = set(), []
    for fi in thin_idx:
        if fi in seen:
            continue
        stack, grp = [fi], []
        seen.add(fi)
        while stack:
            g = stack.pop()
            grp.append(g)
            for v in bm.faces[g].verts:
                for h in by_vert[canon[v.index]]:
                    if h not in seen:
                        seen.add(h)
                        stack.append(h)
        groups.append(grp)
    gone = [f for grp in groups if len(grp) >= P["min_group"] for f in grp]
    sizes = sorted((len(g) for g in groups if len(g) >= P["min_group"]), reverse=True)
    print(f"groups taken off: {len(sizes)} {sizes[:12]}; faces {len(gone):,}", flush=True)
    gone_c = centres[gone]
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in gone], context="FACES")
    bm.to_mesh(me)
    bm.free()

    # 3. the opened solid's surface near what went, set behind the stone that stayed, as the stand-in
    kept = bmesh.new()
    kept.from_mesh(me)
    kept.transform(Matrix.Scale(k, 4))
    tree_kept = BVHTree.FromBMesh(kept)
    kd_gone = KDTree(len(gone_c))
    for n, c in enumerate(gone_c):
        kd_gone.insert(c, n)
    kd_gone.balance()
    pm = bpy.data.meshes.new("stand-in")
    pm.from_pydata(vox["pverts"].tolist(), [], vox["ptris"].tolist())
    pm.validate()
    wbm = bmesh.new()
    wbm.from_mesh(pm)
    bmesh.ops.recalc_face_normals(wbm, faces=wbm.faces)
    drop = []
    for f in wbm.faces:
        c = f.calc_center_median()
        near_gone = len(gone_c) and kd_gone.find(c)[2] < P["reach"]
        stone = tree_kept.find_nearest(c)[3]
        if not near_gone or (stone is not None and stone < P["sink"] * 0.5):
            drop.append(f)
    bmesh.ops.delete(wbm, geom=drop, context="FACES")
    for v in wbm.verts:
        v.co -= v.normal * P["sink"]
    wbm.transform(Matrix.Scale(1.0 / k, 4))
    wbm.to_mesh(pm)
    wbm.free()
    w = bpy.data.objects.new("stand-in", pm)
    bpy.context.scene.collection.objects.link(w)
    print(f"stand-in surface: {len(w.data.polygons):,} faces", flush=True)
    # its texture: the nearest stone's UVs
    w.data.uv_layers.new(name=me.uv_layers[0].name)
    for m in me.materials:
        w.data.materials.append(m)
    dt = w.modifiers.new("uv", "DATA_TRANSFER")
    dt.object = obj
    dt.use_loop_data = True
    dt.data_types_loops = {"UV"}
    dt.loop_mapping = "POLYINTERP_NEAREST"
    bpy.context.view_layer.objects.active = w
    bpy.ops.object.modifier_apply(modifier="uv")
    # one object, the original's frame
    for o in bpy.context.scene.objects:
        o.select_set(o in (obj, w))
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.join()
    out = os.path.join(MODELS, f"sphinx-meshy-{tag}", "model.glb")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    for o in bpy.context.scene.objects:
        o.select_set(o is obj)
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True)
    rec = {"from": "sphinx-meshy", "made_by": "scripts/sphinx_lab/descaffold.py", "params": P,
           "groups_taken_off": sizes, "faces_taken_off": len(gone), "faces": len(obj.data.polygons),
           "note": "the scaffolding in the photographs taken off; every parameter is a look choice"}
    json.dump(rec, open(os.path.join(os.path.dirname(out), "record.json"), "w", encoding="utf-8"), indent=1)
    print(f"wrote {out}", flush=True)


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
