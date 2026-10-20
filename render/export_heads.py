"""
The ghosted head, for the exhibit's first object in the hand (chapter 2, "Here the king's head sits inside the
lion's"; docs/exhibit-build.md E14): the king's head of the as-built Sphinx, solid, and the First Time lion's head
round it, to be drawn translucent, each cut out of its statue and exported small for the browser.

    blender -b --factory-startup -P render/export_heads.py

Writes apps/exhibit/objects/head-king.glb, head-lion.glb and heads.json. Run it on the laptop, where the stand-ins
and the master's eras are on disk (python scripts/models.py; blender ... -P render/giza/sphinx_eras.py).

Both statues are placed exactly as the renders place them: render/giza/sphinx.py's `statue` fits each to the
Sphinx's footprint (the as-built era takes `sphinx-built`, the First Time the master's `first-time` finish, whose
lion head is enlarged by HEAD_SCALE about the head's foot). So the two heads register with each other as they do
in the panoramas, and nothing here moves either. Both are visual stand-ins; nothing of their form is a
measurement, and heads.json says so. The enlargement the head fit needed (H1's number, a proposal in
docs/claims-proposed.md) is read from what `sphinx_eras.py --solve-head` wrote, never typed here.

The crop box and the size limits are look choices (CROP, FACES, TEXTURE_PX), written into heads.json.
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from giza import data  # noqa: E402

OUT = os.path.join(data.REPO, "apps", "exhibit", "objects")
HEADSCALE = os.path.join(data.REPO, "build", "models", "sphinx-master-headscale.json")
# Look choices: how far round the king's head footprint the cut reaches (metres: aft for the lion's mane, fore
# for its face, either side), and from how far under the head's own base it starts.
CROP = {"aft": 8.0, "fore": 4.0, "side": 2.0, "below": 3.0}
FACES = 60000          # each head decimated to about this many faces
TEXTURE_PX = 1024      # and its textures to at most this size
OBJECTS = (
    # (id, era the statue is taken from, role in the view)
    ("king", "built", "solid"),
    ("lion", "first-time", "ghost"),
)


def footprint(fid, footprints=None):
    f = next((f for f in (footprints or data.FOOTPRINTS) if f["id"] == fid), None)
    if f is None:
        raise SystemExit(f"export_heads: data/footprints/giza.json has no {fid}")
    return f


def crop_box(footprints=None, crop=CROP):
    """The box the heads are cut from, in project metres: round the king's head footprint, across the body's width,
    from under the head's base (its footprint's minHeight above the base) to the sky."""
    head, body = footprint("sphinx.head", footprints), footprint("sphinx.body", footprints)
    hx = [p[0] for p in head["ring"]]
    by = [p[1] for p in body["ring"]]
    z0 = head["base"] + head.get("minHeight", 0.0) - crop["below"]
    return {"x0": min(hx) - crop["aft"], "x1": max(hx) + crop["fore"], "y0": min(by) - crop["side"], "y1": max(by) + crop["side"],
            "z0": z0, "z1": head["base"] + head["height"] + 10.0}


def centre_of(box, footprints=None):
    """What the view turns about: the middle of the king's head footprint, at the middle of the head's height."""
    head = footprint("sphinx.head", footprints)
    hx = [p[0] for p in head["ring"]]
    hy = [p[1] for p in head["ring"]]
    z = head["base"] + (head.get("minHeight", 0.0) + head["height"]) / 2
    return [round((min(hx) + max(hx)) / 2, 3), round((min(hy) + max(hy)) / 2, 3), round(z, 3)]


def head_scale(used, path=HEADSCALE):
    """The enlargement: the one the renders use, and the least the head fit found, if the solve has been run here."""
    least = None
    if os.path.exists(path):
        with io.open(path, encoding="utf-8") as f:
            least = json.load(f).get("least_head_scale")
    return {"used": used, "least": least, "made_by": "render/giza/sphinx_eras.py --solve-head", "target": "sphinx.head.height"}


def manifest(box, centre, scale, models):
    return {
        "about": "The ghosted head for the exhibit's object in the hand: the as-built king's head, solid, inside the First "
                 "Time lion's head, drawn translucent. Written by render/export_heads.py; read by apps/exhibit.",
        "frame": "glTF's: metres, +x east, +y up, -z north, centred on `centre` (project metres: +x east, +y north, +z up)",
        "centre": centre,
        "crop": {"box": {k: round(v, 3) for k, v in box.items()}, "look_choices": CROP, "faces": FACES, "texture_px": TEXTURE_PX},
        "objects": [{"id": i, "file": f"head-{i}.glb", "era": era, "role": role, "model": models.get(i)} for i, era, role in OBJECTS],
        "head_scale": scale,
        "standin": "Both heads are visual stand-ins (Meshy models), cut from the statues as the renders fit them to the "
                   "Sphinx's footprint. Nothing of their form is a measurement; the enlargement is read off the two stand-ins.",
    }


def main():
    import bmesh
    import bpy
    from giza import sphinx, sphinx_eras, states

    bpy.ops.wm.read_factory_settings(use_empty=True)
    coll = bpy.data.collections.new("heads")
    bpy.context.scene.collection.children.link(coll)
    box = crop_box()
    centre = centre_of(box)
    os.makedirs(OUT, exist_ok=True)
    models = {}
    for oid, era, _ in OBJECTS:
        obj = sphinx.statue(era, coll)
        if obj is None:
            raise SystemExit(f"export_heads: no statue for {era} (see the message above)")
        models[oid] = sphinx.MODEL_FOR[states.spec(era)["sphinx"]][0]
        # into the project frame, then everything outside the box away
        obj.data.transform(obj.matrix_world)
        obj.matrix_world.identity()
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        out = [v for v in bm.verts if not (box["x0"] <= v.co.x <= box["x1"] and box["y0"] <= v.co.y <= box["y1"] and box["z0"] <= v.co.z <= box["z1"])]
        bmesh.ops.delete(bm, geom=out, context="VERTS")
        for v in bm.verts:
            v.co.x -= centre[0]
            v.co.y -= centre[1]
            v.co.z -= centre[2]
        bm.to_mesh(obj.data)
        bm.free()
        faces = len(obj.data.polygons)
        if faces > FACES:
            mod = obj.modifiers.new("decimate", "DECIMATE")
            mod.ratio = FACES / faces
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.modifier_apply(modifier=mod.name)
        for mat in obj.data.materials:
            for node in (mat.node_tree.nodes if mat and mat.use_nodes else []):
                img = getattr(node, "image", None)
                if img is not None and max(img.size) > TEXTURE_PX:
                    k = TEXTURE_PX / max(img.size)
                    img.scale(max(1, int(img.size[0] * k)), max(1, int(img.size[1] * k)))
        for o in bpy.context.scene.objects:
            o.select_set(o is obj)
        path = os.path.join(OUT, f"head-{oid}.glb")
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True,
                                  export_apply=True, export_image_format="JPEG")
        print(f"export_heads: {path}, {len(obj.data.polygons)} faces")
        obj.hide_set(True)
    with io.open(os.path.join(OUT, "heads.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest(box, centre, head_scale(sphinx_eras.HEAD_SCALE), models), f, indent=1, ensure_ascii=False)
        f.write("\n")
    print(f"export_heads: {os.path.join(OUT, 'heads.json')}")


if __name__ == "__main__":
    main()
