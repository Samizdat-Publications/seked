"""
Assert that a generated .blend, and the GLB beside it, hold what
blender/generate.py says they hold.

    blender -b build/seked.blend -P blender/check.py
    blender -b build/seked.blend -P blender/check.py -- --gltf build/seked.glb

Every check is against the database, not against a remembered number: the
expected interior solids come from seked_data.interior_solids for the preset
stamped on the objects, and the terrain's size comes from the heightfield
header. The GLB is parsed with the standard library, so nothing has to be
imported back into Blender to see what was exported.

Exits 0 and prints one line per check, or prints every failure and exits 1.
"""
import json
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import bpy  # noqa: E402  (only available inside Blender)

from seked_data import interior_solids, load_database, load_terrain, resolve  # noqa: E402

ROOT_NAME = "Seked"
INTERIOR_NAME = "Interior"
TERRAIN_NAME = "Terrain (GLO-30 context)"
GROUND_NAME = "Terrain (ground)"
CONCAVITY = "Concavity"

failures = []
checks = 0


def check(condition, message):
    global checks
    checks += 1
    if condition:
        print(f"ok   {message}")
    else:
        print(f"FAIL {message}")
        failures.append(message)
    return bool(condition)


def gltf_path():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if "--gltf" in argv:
        i = argv.index("--gltf")
        if i + 1 < len(argv):
            return os.path.abspath(argv[i + 1])
    return os.path.splitext(bpy.data.filepath)[0] + ".glb"


def read_gltf_json(path):
    """The JSON chunk of a binary glTF, without importing anything."""
    with open(path, "rb") as f:
        raw = f.read()
    magic, version, total = struct.unpack_from("<4sII", raw, 0)
    if magic != b"glTF":
        raise ValueError(f"{path} is not a GLB: magic {magic!r}")
    if version != 2:
        raise ValueError(f"{path} is glTF {version}, expected 2")
    if total != len(raw):
        raise ValueError(f"{path} says {total} bytes but is {len(raw)}")
    length, kind = struct.unpack_from("<II", raw, 12)
    if kind != 0x4E4F534A:
        raise ValueError(f"{path}: first chunk is not JSON")
    return json.loads(raw[20:20 + length].decode("utf-8"))


def collection_tree(coll):
    """Every object under a collection and its children."""
    out = list(coll.objects)
    for child in coll.children:
        out.extend(collection_tree(child))
    return out


def main():
    scene = bpy.context.scene
    print(f"checking {bpy.data.filepath}")

    root = bpy.data.collections.get(ROOT_NAME)
    if not check(root is not None, f'the "{ROOT_NAME}" collection exists'):
        return finish()
    check([c.name for c in scene.collection.children] == [ROOT_NAME],
          f'the scene holds "{ROOT_NAME}" and nothing else')
    check(len(scene.collection.objects) == 0, "no objects sit loose in the scene collection")

    generated = collection_tree(root)
    check(len(generated) == len(bpy.data.objects),
          f"every object is generated: {len(bpy.data.objects)} in the file, {len(generated)} under {ROOT_NAME}")
    leftovers = [o.name for o in bpy.data.objects if o.type != "MESH"]
    check(not leftovers, f"no startup camera, light or other leftovers: {leftovers or 'none'}")

    missing = [o.name for o in bpy.data.objects if "seked_preset" not in o.keys() or "seked_structure" not in o.keys()]
    check(not missing, f"every object carries its provenance: {missing or 'none missing'}")
    presets = sorted({o.get("seked_preset") for o in bpy.data.objects})
    check(len(presets) == 1, f"one preset built the whole file: {presets}")
    preset = presets[0] if presets else "canonical"

    interior = bpy.data.collections.get(INTERIOR_NAME)
    if check(interior is not None and INTERIOR_NAME in [c.name for c in root.children],
             f'"{INTERIOR_NAME}" is a child collection of "{ROOT_NAME}"'):
        expected = [s["name"] for s in interior_solids(resolve(load_database(), preset)["values"])]
        got = [o.name for o in interior.objects]
        check(sorted(got) == sorted(expected),
              f"the interior holds the {len(expected)} solids the database builds: {sorted(expected)}")
        empty = [o.name for o in interior.objects if len(o.data.polygons) == 0]
        check(not empty, f"every interior solid has faces: {empty or 'none empty'}")
        sourceless = [o.name for o in interior.objects if not o.get("seked_sources")]
        check(not sourceless, f"every interior solid names its sources: {sourceless or 'none missing'}")

    terrain = bpy.data.objects.get(TERRAIN_NAME)
    if check(terrain is not None, f'"{TERRAIN_NAME}" is present'):
        check(terrain.hide_get() or terrain.hide_viewport, "the terrain is hidden in the viewport")
        header, _ = load_terrain()
        check(len(terrain.data.vertices) == header["nx"] * header["ny"],
              f'the terrain is the {header["nx"]} x {header["ny"]} heightfield')
        check("edited" in str(terrain.get("seked_note", "")) or "editing mask" in str(terrain.get("seked_note", "")),
              "the terrain says its monument footprints are edited")

    path = gltf_path()
    ground = bpy.data.objects.get(GROUND_NAME)
    if check(ground is not None, f'"{GROUND_NAME}" is present'):
        check(not ground.hide_get() and not ground.hide_render, "the ground is visible and renders")
        check(terrain is not None and len(ground.data.vertices) == len(terrain.data.vertices),
              "the ground has the same grid as the context terrain")
        nearest = min(ground.data.vertices, key=lambda v: v.co.x * v.co.x + v.co.y * v.co.y)
        check(abs(nearest.co.z) < 1e-6, f"the ground under the Great Pyramid sits at its base level: z = {nearest.co.z:.6f}")

    if check(os.path.exists(path), f"the GLB is beside the .blend: {path}"):
        gltf = read_gltf_json(path)
        meshes = {m.get("name"): m for m in gltf.get("meshes", [])}
        check(len(meshes) == len(bpy.data.objects),
              f"the GLB holds every object: {len(meshes)} meshes for {len(bpy.data.objects)} objects")
        hollowed = [o.name for o in bpy.data.objects if o.data.shape_keys and CONCAVITY in o.data.shape_keys.key_blocks]
        check(bool(hollowed), f"something in the .blend carries the {CONCAVITY} shape key: {hollowed}")
        for name in hollowed:
            mesh = meshes.get(name, {})
            targets = [len(p.get("targets", [])) for p in mesh.get("primitives", [])]
            names = (mesh.get("extras") or {}).get("targetNames", [])
            check(all(t == 1 for t in targets) and names == [CONCAVITY],
                  f'"{name}" keeps its {CONCAVITY} morph target in the GLB: targets {targets}, names {names}')
        nodes = gltf.get("nodes", [])
        bare = [n.get("name") for n in nodes if "seked_preset" not in (n.get("extras") or {})]
        check(not bare, f"every GLB node keeps its provenance extras: {bare or 'none bare'}")

    return finish()


def finish():
    if failures:
        print(f"\ncheck.py: {len(failures)} of {checks} checks failed")
        for f in failures:
            print(f"  - {f}")
        sys.exit(1)
    print(f"\ncheck.py: {checks} checks passed")


if __name__ == "__main__":
    main()
