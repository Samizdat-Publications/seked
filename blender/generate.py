"""
Build the Giza pyramids in Blender from the Seked measurement database.

Run from Blender's Text Editor, or headless:

    blender -b -P blender/generate.py -- --preset canonical --save build/seked.blend --gltf build/seked.glb

Every object is generated from data/; nothing is modelled by hand. Each object
carries custom properties naming the preset and the source of each value, so
the provenance survives inside the .blend file and, as glTF extras, in the GLB. The concavity of the Great
Pyramid is a shape key ("Concavity", 0 = flat faces, 1 = the measured
hollowing), and each pyramid gets an "as built" and a "today" object.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import bpy  # noqa: E402  (only available inside Blender)

from seked_data import load_database, pyramid_geometry, pyramid_params, resolve  # noqa: E402

STRUCTURES = [("g1", "G1 Khufu"), ("g2", "G2 Khafre"), ("g3", "G3 Menkaure")]


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opts = {"preset": "canonical", "save": None, "gltf": None}
    i = 0
    while i < len(argv):
        key = argv[i].lstrip("-")
        if key in opts and i + 1 < len(argv):
            opts[key] = argv[i + 1]
            i += 2
        else:
            i += 1
    return opts


def get_collection(name):
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(coll)
    return coll


def make_object(name, verts, faces, collection, props):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    for k, v in props.items():
        obj[k] = v
    collection.objects.link(obj)
    return obj


def add_concavity_shape_key(obj, base, height, truncate_at, concavity):
    """Basis is the flat pyramid; the 'Concavity' key holds the measured hollowing."""
    if not concavity:
        return
    obj.shape_key_add(name="Basis", from_mix=False)
    key = obj.shape_key_add(name="Concavity", from_mix=False)
    hollow_verts, _ = pyramid_geometry(base, height, truncate_at=truncate_at, concavity=concavity)
    for i, co in enumerate(hollow_verts):
        key.data[i].co = co
    key.value = 1.0


def build(preset_id):
    db = load_database()
    resolved = resolve(db, preset_id)
    values, records = resolved["values"], resolved["records"]
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    coll = get_collection("Seked")

    for structure, label in STRUCTURES:
        p = pyramid_params(values, structure)
        if p is None:
            print(f"skip {structure}: no base or height in preset {preset_id}")
            continue
        provenance = {
            "seked_preset": preset_id,
            "seked_structure": structure,
            "seked_base_source": records[f"{structure}.base.side.mean"]["source"],
            "seked_height_source": records[f"{structure}.height.original"]["source"],
        }
        location = (p["offset_east"], p["offset_north"], p["offset_up"])
        rotation = (0.0, 0.0, math.radians(p["orientation_deg"]))

        # As built: full height, flat basis with the concavity as a shape key.
        verts, faces = pyramid_geometry(p["base"], p["height"], concavity=0.0)
        built = make_object(f"{label} (as built)", verts, faces, coll, provenance)
        built.location, built.rotation_euler = location, rotation
        add_concavity_shape_key(built, p["base"], p["height"], None, p["concavity"])

        # Today: truncated at the surviving height, if the database has one.
        if p["height_today"]:
            verts, faces = pyramid_geometry(p["base"], p["height"], truncate_at=p["height_today"], concavity=0.0)
            today = make_object(f"{label} (today)", verts, faces, coll, provenance)
            today.location, today.rotation_euler = location, rotation
            add_concavity_shape_key(today, p["base"], p["height"], p["height_today"], p["concavity"])
            today.hide_set(True)
            today.hide_render = True

        print(f"{label}: base {p['base']} m, height {p['height']} m, concavity {p['concavity']} m, "
              f"orientation {p['orientation_deg'] * 60:.1f}', at {location}")


def main():
    opts = parse_args()
    if bpy.app.background and not bpy.data.filepath:
        # Headless with no .blend on the command line: Blender has loaded its
        # startup file (a cube, a light and a camera) before running us. Start
        # from an empty file so the saved scene and the glTF hold nothing the
        # database did not generate.
        bpy.ops.wm.read_homefile(use_empty=True)
    build(opts["preset"])
    if opts["save"]:
        path = os.path.abspath(opts["save"])
        os.makedirs(os.path.dirname(path), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=path)
        print(f"saved {path}")
    if opts["gltf"]:
        path = os.path.abspath(opts["gltf"])
        os.makedirs(os.path.dirname(path), exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, export_apply=False, export_extras=True)
        print(f"exported {path}")


if __name__ == "__main__":
    main()
