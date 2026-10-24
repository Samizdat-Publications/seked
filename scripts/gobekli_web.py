"""
Göbekli Tepe for a web viewer: two light GLBs to orbit round.

    blender -b --factory-startup -P scripts/gobekli_web.py -- OUT_DIR [--faces 300000] [--tex 1024]

- OUT_DIR/gobekli-today.glb: the photogrammetry scan of the main excavation (blender/models.json
  `gobekli-site-rmark`, rmark, CC BY 4.0), its tiles joined, in metres, centred, decimated and its textures shrunk.
- OUT_DIR/gobekli-9500.glb: Enclosure D about 9500 BCE as render/gobekli_built.py builds it from its plan
  (a look reconstruction: pillar places from Haklay and Gopher 2020, carving from the excavators' drawings).

Both stand in metres with +Z up in Blender (the exporter writes glTF's +Y up), their floor at 0.
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(REPO, "render"))
SCAN = os.path.join(REPO, "build", "models", "gobekli-site-rmark")


def join_world(objs, name):
    """The meshes as one object, each in its world transform, their materials kept."""
    bm = bmesh.new()
    mats = []
    for o in objs:
        me = o.data.copy()
        me.transform(o.matrix_world)
        off = len(mats)
        mats.extend(me.materials)
        for p in me.polygons:
            p.material_index += off
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    out = bpy.data.meshes.new(name)
    bm.to_mesh(out)
    bm.free()
    idx = [0] * len(out.polygons)
    out.polygons.foreach_get("material_index", idx)
    out.materials.clear()
    for m in mats:
        out.materials.append(m)
    out.polygons.foreach_set("material_index", idx)
    return out


def shrink_images(size):
    for im in bpy.data.images:
        if im.size[0] > size or im.size[1] > size:
            k = size / max(im.size)
            im.scale(max(1, int(im.size[0] * k)), max(1, int(im.size[1] * k)))
            im.pack()


def plain(obj):
    """The reconstruction's materials as flat colours: their textures are projected in the box mapping, which glTF
    cannot carry (exported they come out as noise). Fresh limestone pillars, warm rubble walls, a bedrock floor."""
    for mat in obj.data.materials:
        b = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        for link in list(b.inputs["Base Color"].links):
            mat.node_tree.links.remove(link)
        for name in ("Normal", "Roughness"):
            for link in list(b.inputs[name].links):
                mat.node_tree.links.remove(link)
        n = mat.name.lower()
        b.inputs["Base Color"].default_value = ((0.50, 0.40, 0.29, 1.0) if "wall" in n else
                                                (0.46, 0.40, 0.32, 1.0) if "floor" in n or "bedrock" in n else
                                                (0.80, 0.73, 0.60, 1.0))
        b.inputs["Roughness"].default_value = 0.9


def centre(obj):
    co = np.empty(len(obj.data.vertices) * 3)
    obj.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    mid = (co.min(0) + co.max(0)) / 2
    obj.data.transform(Matrix.Translation((-mid[0], -mid[1], -co[:, 2].min())))


def decimate(obj, faces):
    n = len(obj.data.polygons)
    if n > faces:
        mod = obj.modifiers.new("dec", "DECIMATE")
        mod.ratio = faces / n
        with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
            bpy.ops.object.modifier_apply(modifier=mod.name)


def export(obj, path):
    for o in bpy.context.scene.objects:
        o.select_set(o is obj)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_image_format="JPEG", export_jpeg_quality=82)
    print(f"wrote {path}: {len(obj.data.polygons):,} faces, {os.path.getsize(path) / 1e6:.1f} MB", flush=True)


def today(out, faces, tex):
    import json
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SCAN, "model-1k.glb"))
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    me = join_world(meshes, "Göbekli Tepe today (scan, rmark, CC BY 4.0)")
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    s = json.load(open(os.path.join(SCAN, "fit.json")))["scale_m_per_unit"]
    me.transform(Matrix.Scale(s, 4))
    obj = bpy.data.objects.new(me.name, me)
    bpy.context.scene.collection.objects.link(obj)
    centre(obj)
    decimate(obj, faces)
    shrink_images(tex)
    export(obj, os.path.join(out, "gobekli-today.glb"))


def built(out, tex):
    import gobekli_built as G
    from giza import enclosure_d as E  # noqa: F401  (gobekli_built reads it)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    coll = bpy.data.collections.new("Enclosure D about 9500 BCE")
    bpy.context.scene.collection.children.link(coll)
    mats = G.materials()
    ring = [p for p in G.pillars() if not p["name"].startswith("central")]
    mid = np.array([np.mean([p["x"] for p in ring]), np.mean([p["y"] for p in ring])])
    G.build(coll, mats, mid)
    G.walls_and_floor(coll, mats)
    bpy.context.view_layer.update()
    objs = [o for o in coll.objects if o.type == "MESH"]
    me = join_world(objs, "Enclosure D about 9500 BCE (reconstruction)")
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    obj = bpy.data.objects.new(me.name, me)
    bpy.context.scene.collection.objects.link(obj)
    centre(obj)
    plain(obj)
    export(obj, os.path.join(out, "gobekli-9500.glb"))


def main(argv):
    out = os.path.abspath(argv[0])
    a = {argv[i]: argv[i + 1] for i in range(1, len(argv) - 1, 2)}
    os.makedirs(out, exist_ok=True)
    built(out, int(a.get("--tex", 1024)))
    today(out, int(a.get("--faces", 300000)), int(a.get("--tex", 1024)))


if __name__ == "__main__":
    main(sys.argv[sys.argv.index("--") + 1:])
