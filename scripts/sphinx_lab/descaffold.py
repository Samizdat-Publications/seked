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

What is installed (24 October, finish `clean`, render/giza/sphinx.py) is candidate c10:

    blender -b --factory-startup -P scripts/sphinx_lab/descaffold.py -- --tag c10 --set open2=0.8 --set zone_pad=3.0
        --set min_piece2=0.01 --set fill=4000

a second, harder opening in zones round the scaffold the first pass finds, and the holes capped in the shell itself
(`fill`). Tried and dropped: the voxel stand-in surface and a solid core (the fill that makes the shell solid also
fills the space the scaffold enclosed against the body, so the stand-in grew blocks there, and a core 12 cm in shows
through a shell 6 cm thick); painting the clean model's stone in by a bake (its colours are not the texture's); a
median filter of the texture (it softened the head). The texture keeps a faint ghost of the lattice.

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
    "open2": 0.0,         # m: a second, harder opening inside the zones round the scaffold found (0: none)
    "zone_pad": 1.5,      # m round the scaffold found: the zones the second opening works in
    "min_piece2": 0.01,   # m3: in the zones, a piece this big that the second opening takes off is scaffold
    "core": 0.0,          # m: a solid core this far inside the stone, seen through any hole (0: none)
    "stray": 0.05,        # of the statue's faces: a loose piece smaller than this is not the statue
    "fill": 0,            # edges: cap holes up to this many edges round instead of the voxel stand-in (0: stand-in)
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


def fill_holes(me, sides):
    """Weld the shell (its UV seams stay in the loops), cap each hole up to `sides` edges round with a fan of
    triangles, and give the caps' corners the UV of the nearest point on the faces that were there before."""
    from mathutils.geometry import barycentric_transform
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    tag = bm.faces.layers.int.new("cap")
    res = bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=sides)
    caps = bmesh.ops.triangulate(bm, faces=res["faces"])["faces"]
    for f in caps:
        f[tag] = 1
    bm.to_mesh(me)
    bm.free()
    capped = np.zeros(len(me.polygons), np.int32)
    me.attributes["cap"].data.foreach_get("value", capped)
    old = [p for p in me.polygons if not capped[p.index]]
    tree = BVHTree.FromPolygons([v.co for v in me.vertices], [p.vertices for p in old])
    uv = me.uv_layers[0].data
    for p in me.polygons:
        if not capped[p.index]:
            continue
        for li in p.loop_indices:
            loc, _, fi, _ = tree.find_nearest(me.vertices[me.loops[li].vertex_index].co)
            if fi is None:
                continue
            sp = old[fi]
            vs = [me.vertices[v].co for v in sp.vertices[:3]]
            uvs = [uv[k].uv.to_3d() for k in list(sp.loop_indices)[:3]]
            uv[li].uv = barycentric_transform(loc, *vs, *uvs).to_2d()
    me.attributes.remove(me.attributes["cap"])
    return int(capped.sum())


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
    # the loose block the model carries beside the statue (blender/models.json): every piece under STRAY of the
    # statue's size goes, here, because the renderer keeps all the pieces of a finish (its stand-in and core are
    # pieces of their own)
    tri = np.array([[canon[v.index] for v in f.verts[:3]] for f in bm.faces], np.int64)
    np.save(os.path.join(work, "faces-canon.npy"), tri)
    lab = subprocess.run(["python", "-c", (
        "import numpy as np, sys; from scipy.sparse import coo_matrix; from scipy.sparse.csgraph import connected_components as cc;"
        "t=np.load(sys.argv[1]); n=int(t.max())+1; e=np.r_[t[:,[0,1]],t[:,[1,2]]];"
        "_,l=cc(coo_matrix((np.ones(len(e)),(e[:,0],e[:,1])),shape=(n,n)),directed=False);"
        "np.save(sys.argv[2], l[t[:,0]])"), os.path.join(work, "faces-canon.npy"), os.path.join(work, "faces-part.npy")],
        check=True)
    part = np.load(os.path.join(work, "faces-part.npy"))
    size = np.bincount(part)
    stray = np.nonzero(size[part] < P["stray"] * size.max())[0]
    print(f"stray pieces taken off: {int((size < P['stray'] * size.max()).sum())}, {len(stray):,} faces", flush=True)
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in sorted(set(gone) | set(stray.tolist()))], context="FACES")
    bm.to_mesh(me)
    bm.free()

    if P["fill"]:
        # 3, as filled holes: the shell welded, every hole it is left with capped where it is, and each cap's corners
        # given the UV of the nearest stone that stayed. One piece, no stand-in surface: the voxel stand-in grew
        # blocks where the scaffold had enclosed space against the body
        n = fill_holes(me, P["fill"])
        print(f"holes filled: {n:,} cap faces", flush=True)
        out = os.path.join(MODELS, f"sphinx-meshy-{tag}", "model.glb")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        for o in bpy.context.scene.objects:
            o.select_set(o is obj)
        bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True)
        json.dump({"from": "sphinx-meshy", "made_by": "scripts/sphinx_lab/descaffold.py", "params": P,
                   "groups_taken_off": sizes, "faces_taken_off": len(gone), "cap_faces": n,
                   "faces": len(obj.data.polygons),
                   "note": "the scaffolding in the photographs taken off, its holes capped; every parameter is a look choice"},
                  open(os.path.join(os.path.dirname(out), "record.json"), "w", encoding="utf-8"), indent=1)
        print(f"wrote {out}", flush=True)
        return

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
        if not near_gone:                       # kept up to the stone's edge: set behind it, it shows only in a gap
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
    # its texture: each corner takes the UV of the nearest point on the stone that stayed, interpolated across that
    # face (a data transfer modifier does the same, but took over an hour on this many faces)
    from mathutils.geometry import barycentric_transform
    w.data.uv_layers.new(name=me.uv_layers[0].name)
    for m in me.materials:
        w.data.materials.append(m)
    tree = BVHTree.FromPolygons([v.co for v in me.vertices], [p.vertices for p in me.polygons])
    src_uv = me.uv_layers[0].data
    dst_uv = w.data.uv_layers[0].data
    polys = me.polygons
    for poly in w.data.polygons:
        for li in poly.loop_indices:
            co = w.data.vertices[w.data.loops[li].vertex_index].co
            loc, _, fi, _ = tree.find_nearest(co)
            if fi is None:
                continue
            sp = polys[fi]
            vs = [me.vertices[v].co for v in sp.vertices[:3]]
            uvs = [src_uv[k].uv.to_3d() for k in list(sp.loop_indices)[:3]]
            dst_uv[li].uv = barycentric_transform(loc, *vs, *uvs).to_2d()
    # the core, in one plain limestone colour (the texture's own mean), facing out
    core = None
    if len(vox["ctris"]):
        cm = bpy.data.meshes.new("core")
        cm.from_pydata((vox["cverts"] / k).tolist(), [], vox["ctris"].tolist())
        cm.validate()
        cb = bmesh.new()
        cb.from_mesh(cm)
        bmesh.ops.recalc_face_normals(cb, faces=cb.faces)
        cb.to_mesh(cm)
        cb.free()
        img = next((n.image for n in me.materials[0].node_tree.nodes if n.type == "TEX_IMAGE" and n.image), None)
        tone = (0.62, 0.48, 0.32, 1.0)
        if img is not None:
            px = np.empty(img.size[0] * img.size[1] * 4, np.float32)
            img.pixels.foreach_get(px)
            px = px.reshape(-1, 4)
            tone = tuple(float(v) for v in np.median(px[px[:, 3] > 0.5][:, :3], axis=0)) + (1.0,)
        stone = bpy.data.materials.new("core stone")
        stone.use_nodes = True
        b = next(n for n in stone.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        b.inputs["Base Color"].default_value = tone
        b.inputs["Roughness"].default_value = 0.9
        cm.materials.append(stone)
        core = bpy.data.objects.new("core", cm)
        bpy.context.scene.collection.objects.link(core)
        mod = core.modifiers.new("dec", "DECIMATE")
        mod.ratio = min(1.0, 150000 / max(1, len(cm.polygons)))
        with bpy.context.temp_override(object=core, active_object=core, selected_objects=[core]):
            bpy.ops.object.modifier_apply(modifier=mod.name)
        print(f"core: {len(core.data.polygons):,} faces, tone {tuple(round(v, 2) for v in tone[:3])}", flush=True)
    # one object, the original's frame
    for o in bpy.context.scene.objects:
        o.select_set(o in (obj, w, core))
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
