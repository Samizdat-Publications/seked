"""
Today's Sphinx with the scaffolding's lattice painted out of its texture: the second half of
scripts/sphinx_lab/descaffold.py, which takes the scaffold's geometry off but leaves the lattice it cast and carried
painted into the photographs' texture of the stone behind.

    blender -b --factory-startup -P scripts/sphinx_lab/rebake.py -- [--src c02] [--tag c03] [--set KEY=VALUE ...]

sphinx-today-clean (blender/models.json) is Meshy's model of the same statue from the same photographs with the
scaffolding edited out of them first: its stone where the scaffold stood is clean, but it lost the paws and the face
is coarser, so it does not replace the model. Here both are fitted onto the footprint as the renderer fits them,
and the clean model's colour is baked onto the faces of sphinx-meshy-<src> within REACH of where the scaffold was
(the faces descaffold.py found thin, in build/sphinx-lab/descaffold/voxels.npz), toned to the stone round it and
feathered in. Everything else keeps its own texture. Writes build/models/sphinx-meshy-<tag>/model.glb in the
original's frame. A look choice: the stone painted in is an image model's guess at what the scaffold hid.
"""
import json
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils.kdtree import KDTree

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(REPO, "render"))
sys.path.insert(0, os.path.join(REPO, "blender"))
from giza import data  # noqa: E402
import render_standins as rs  # noqa: E402

MODELS = os.path.join(REPO, "build", "models")
PARAMS = {
    "reach": 1.2,         # m from a scaffold face: the stone whose texture is painted again
    "ray": 4.5,           # m, how far the bake looks for the clean model's surface (the two stand up to 4 m apart)
    "cage": 0.0,          # m, how far out it starts looking (the shell's normals point both ways, so the rays start on it)
    "feather": 8,         # texels over which the new paint gives way to the old
    "samples": 4,
}


def args_of(argv):
    a, sets, i = {}, [], 0
    while i < len(argv):
        if argv[i] == "--set":
            sets.append(argv[i + 1]); i += 2
        elif argv[i].startswith("--"):
            a[argv[i]] = argv[i + 1]; i += 2
        else:
            i += 1
    return a, sets


def box(a, r):
    """A box blur of radius r texels, by cumulative sums (Blender's Python has numpy and nothing else)."""
    for ax in (0, 1):
        c = np.cumsum(np.pad(a, [(r + 1, r) if i == ax else (0, 0) for i in range(2)], mode="edge"), axis=ax)
        a = (np.take(c, range(2 * r + 1, c.shape[ax]), axis=ax) - np.take(c, range(0, c.shape[ax] - 2 * r - 1), axis=ax)) / (2 * r + 1)
    return a


def feathered(m, r):
    """The mask shrunk by r texels and blurred back over them, so the new paint fades in inside its own edge."""
    inner = box(m, r) > 0.999
    return np.clip(box(inner.astype(np.float32), r), 0.0, 1.0) * m


def base_image(obj):
    """The material's base colour image (Meshy's PBR: one material, an image into Base Color)."""
    mat = obj.data.materials[0]
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    node = bsdf.inputs["Base Color"].links[0].from_node
    while node.type != "TEX_IMAGE":
        node = next(i.links[0].from_node for i in node.inputs if i.is_linked)
    return mat, node.image


def main(argv):
    a, sets = args_of(argv)
    P = dict(PARAMS)
    for kv in sets:
        k, v = kv.split("=", 1)
        P[k] = json.loads(v)
    src, tag = a.get("--src", "c02"), a.get("--tag", "c03")
    models = {m["id"]: m for m in json.load(open(os.path.join(REPO, "blender", "models.json"), encoding="utf-8"))["models"]}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene

    # where the scaffold was, in the original's frame (metres a model unit as descaffold.py took them)
    orig = rs.import_model(os.path.join(MODELS, "sphinx-meshy", "model.glb"), "original")
    co = np.empty(len(orig.vertices) * 3)
    orig.vertices.foreach_get("co", co)
    k = json.load(open(os.path.join(REPO, "build", "sphinx-lab", "descaffold", "params.json")))["length"] / np.ptp(co.reshape(-1, 3), axis=0).max()
    cen = np.empty(len(orig.polygons) * 3)
    orig.polygons.foreach_get("center", cen)
    cen = cen.reshape(-1, 3)
    thin = np.load(os.path.join(REPO, "build", "sphinx-lab", "descaffold", "voxels.npz"))["thin"]
    assert len(thin) == len(cen), (len(thin), len(cen))
    scaffold = cen[thin]
    kd = KDTree(len(scaffold))
    for i, c in enumerate(scaffold):
        kd.insert(c, i)
    kd.balance()
    bpy.data.meshes.remove(orig)

    # the model to paint, in its own frame, and the region
    mesh = rs.import_model(os.path.join(MODELS, f"sphinx-meshy-{src}", "model.glb"), "today", keep_materials=True)
    A = bpy.data.objects.new("today", mesh)
    sc.collection.objects.link(A)
    pc = np.empty(len(mesh.polygons) * 3)
    mesh.polygons.foreach_get("center", pc)
    pc = pc.reshape(-1, 3)
    region = np.array([kd.find(c)[2] * k < P["reach"] for c in pc])
    print(f"region: {int(region.sum()):,} of {len(region):,} faces", flush=True)

    # the faces to bake onto, as their own object with the same UVs, fitted with the whole (fit also moves the mesh
    # itself down to its foot, so the copy is taken after it)
    rs.fit(A, models["sphinx-meshy"], data.FOOTPRINTS)
    R = A.copy()
    R.data = mesh.copy()
    sc.collection.objects.link(R)
    bm = bmesh.new()
    bm.from_mesh(R.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not region[f.index]], context="FACES")
    bm.to_mesh(R.data)
    bm.free()
    R.location, R.rotation_euler, R.scale = A.location.copy(), A.rotation_euler.copy(), A.scale.copy()

    # the clean model, fitted as the renderer fits it
    cm = models["sphinx-today-clean"]
    B = rs.cut_and_reduce(rs.import_model(os.path.join(MODELS, "sphinx-today-clean", "model.glb"), "clean", keep_materials=True),
                          cm.get("cut_z"), 600000, cm.get("largest_part_only", False))
    rs.fit(B, cm, data.FOOTPRINTS)
    bpy.context.view_layer.update()

    # bake its colour into a fresh image on the region's UVs
    mat, img = base_image(A)
    w, h = img.size
    target = bpy.data.images.new("baked", w, h, alpha=True, float_buffer=True)
    target.pixels.foreach_set(np.full(w * h * 4, -1.0, np.float32))     # a texel the bake writes is no longer -1
    rmat = mat.copy()
    R.data.materials.clear()
    R.data.materials.append(rmat)
    node = rmat.node_tree.nodes.new("ShaderNodeTexImage")
    node.image = target
    rmat.node_tree.nodes.active = node
    sc.render.engine = "CYCLES"
    sc.cycles.device = "GPU"
    sc.cycles.samples = P["samples"]
    for o in sc.objects:
        o.select_set(o is B)
    R.select_set(True)
    bpy.context.view_layer.objects.active = R
    A.hide_render = True
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, use_selected_to_active=True,
                        cage_extrusion=P["cage"], max_ray_distance=P["ray"], margin=4, use_clear=False)
    new = np.empty(w * h * 4, np.float32)
    target.pixels.foreach_get(new)
    new = new.reshape(h, w, 4)
    old = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(old)
    old = old.reshape(h, w, 4)

    # the region's texels: those the bake reached (only the region's faces were baked onto)
    m = (new[..., 0] >= 0.0).astype(np.float32)
    print(f"baked colour: mean {new[..., :3][m > 0].mean(0) if m.any() else None}", flush=True)
    print(f"texels painted: {int(m.sum()):,} of {w * h:,}", flush=True)
    # toned to the stone it replaces: each channel's mean and spread matched over the region
    sel = m > 0.5
    for c in range(3):
        mu_n, sd_n = new[..., c][sel].mean(), new[..., c][sel].std() + 1e-6
        mu_o, sd_o = old[..., c][sel].mean(), old[..., c][sel].std() + 1e-6
        new[..., c] = (new[..., c] - mu_n) * (sd_o / sd_n) + mu_o
    soft = feathered(m, P["feather"])
    out = old.copy()
    out[..., :3] = old[..., :3] * (1 - soft[..., None]) + np.clip(new[..., :3], 0, 1) * soft[..., None]
    img.pixels.foreach_set(out.ravel())
    img.pack()

    # the painted model back in its own frame
    for o in (R, B):
        bpy.data.objects.remove(o, do_unlink=True)
    A.matrix_world.identity()
    A.hide_render = False
    for o in sc.objects:
        o.select_set(o is A)
    path = os.path.join(MODELS, f"sphinx-meshy-{tag}", "model.glb")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True)
    json.dump({"from": f"sphinx-meshy-{src}", "painted_from": "sphinx-today-clean", "made_by": "scripts/sphinx_lab/rebake.py",
               "params": P, "region_faces": int(region.sum()), "texels": int(m.sum()),
               "note": "the scaffold's lattice painted out with the clean model's stone, toned to the old; a look choice"},
              open(os.path.join(os.path.dirname(path), "record.json"), "w", encoding="utf-8"), indent=1)
    print(f"wrote {path}", flush=True)


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
