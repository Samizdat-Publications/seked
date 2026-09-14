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
import math
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import bpy  # noqa: E402  (only available inside Blender)

from seked_data import (  # noqa: E402
    SPHINX_MASSING_NAME,
    course_heights,
    course_levels,
    interior_solids,
    interior_structures,
    load_database,
    load_terrain,
    massing_geometry,
    pyramid_params,
    resolve,
    sphinx_params,
)

ROOT_NAME = "Seked"
INTERIOR_NAME = "Interior"
# Same labels the generator uses, so the collection names can be recomputed here.
STRUCTURE_LABELS = {"g1": "G1 Khufu", "g2": "G2 Khafre", "g3": "G3 Menkaure"}
TERRAIN_NAME = "Terrain (GLO-30 context)"
GROUND_NAME = "Terrain (ground)"
FAR_TERRAIN_NAME = "Terrain (far context)"
FAR_TERRAIN_GRID = "giza-glo30-far"
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


def cells_covered(far_header, near_header, axis):
    """
    How many of the far grid's cells along one axis lie wholly within the near
    grid's extent, which is how many the generator leaves to the near grid.
    Computed from the two headers, so the expected face count is derived here
    rather than copied from the generator.
    """
    spacing, lo = far_header["spacing"], far_header[axis + "0"]
    near_lo = near_header[axis + "0"]
    near_hi = near_lo + (near_header["n" + axis] - 1) * near_header["spacing"]
    eps = spacing * 1e-6
    return sum(1 for i in range(far_header["n" + axis] - 1)
               if lo + i * spacing >= near_lo - eps and lo + (i + 1) * spacing <= near_hi + eps)


def vertex_at(obj, x, y):
    """The object's vertex nearest a point in the plan, and how far off it is."""
    v = min(obj.data.vertices, key=lambda v: (v.co.x - x) ** 2 + (v.co.y - y) ** 2)
    return v, math.hypot(v.co.x - x, v.co.y - y)


def check_far_terrain(near_terrain):
    """
    The coarse ring that carries the horizon past the near grid: the whole of
    its own grid in vertices, the ring in faces, and the same ground as the
    near grid where the two meet.
    """
    far = bpy.data.objects.get(FAR_TERRAIN_NAME)
    if not check(far is not None, f'"{FAR_TERRAIN_NAME}" is present'):
        return
    check(not far.hide_get() and not far.hide_render, "the far ring is visible and renders")
    far_header, _ = load_terrain(name=FAR_TERRAIN_GRID)
    near_header, _ = load_terrain()
    check(len(far.data.vertices) == far_header["nx"] * far_header["ny"],
          f'the far ring keeps every sample of its {far_header["nx"]} x {far_header["ny"]} grid')
    covered = cells_covered(far_header, near_header, "x") * cells_covered(far_header, near_header, "y")
    want = (far_header["nx"] - 1) * (far_header["ny"] - 1) - covered
    check(len(far.data.polygons) == want,
          f"the far ring is a ring: {len(far.data.polygons)} faces, "
          f"{(far_header['nx'] - 1) * (far_header['ny'] - 1)} less the {covered} the near grid draws")
    if near_terrain is None:
        return
    x1 = near_header["x0"] + (near_header["nx"] - 1) * near_header["spacing"]
    y1 = near_header["y0"] + (near_header["ny"] - 1) * near_header["spacing"]
    worst, where = 0.0, None
    for x in (near_header["x0"], x1):
        for y in (near_header["y0"], y1):
            mine, off_far = vertex_at(far, x, y)
            theirs, off_near = vertex_at(near_terrain, x, y)
            if max(off_far, off_near) > 1e-3:
                check(False, f"both grids have a sample at the near grid's corner ({x:.0f}, {y:.0f})")
                return
            if abs(mine.co.z - theirs.co.z) >= worst:
                worst, where = abs(mine.co.z - theirs.co.z), (x, y)
    check(worst < 1e-3,
          f"the far ring meets the near grid at all four of its corners: worst {worst:.2e} m at {where}")


def interior_collection_name(structure):
    """Mirrors blender/generate.py: the Great Pyramid's keeps the plain name."""
    if structure == "g1":
        return INTERIOR_NAME
    return f"{INTERIOR_NAME} ({STRUCTURE_LABELS.get(structure, structure)})"


def check_today(values):
    """
    The "(today)" object of each pyramid, against what the preset says it
    should be.

    Where the preset carries course heights the object has to be the stepped
    stack the generator builds from them: eight vertices a course, the count
    and the source of the courses stamped on it, and a summit exactly as high
    as the courses add up to. Where it carries none, the flat truncation at
    the surviving height has to be there in its place, two rings of eight.
    Where it carries neither there should be no such object at all.
    """
    for structure, label in STRUCTURE_LABELS.items():
        p = pyramid_params(values, structure)
        if p is None:
            continue
        name = f"{label} (today)"
        obj = bpy.data.objects.get(name)
        courses = p["courses"]
        if not courses and not p["height_today"]:
            check(obj is None, f'no "{name}": the preset gives {structure} neither courses nor a surviving height')
            continue
        if not check(obj is not None, f'"{name}" is present'):
            continue
        top = max(v.co.z for v in obj.data.vertices)
        if not courses:
            check(len(obj.data.vertices) == 16,
                  f'"{name}" is the flat truncation, two rings of eight: {len(obj.data.vertices)} vertices')
            check(abs(top - p["height_today"]) < 1e-3,
                  f'"{name}" is truncated at the surviving height {p["height_today"]} m: top at {top:.3f} m')
            continue
        check(len(obj.data.vertices) == 8 * len(courses),
              f'"{name}" is {len(courses)} courses of eight vertices: {len(obj.data.vertices)} vertices')
        check(obj.get("seked_courses") == len(courses),
              f'"{name}" says how many courses it is: {obj.get("seked_courses")}')
        check(bool(obj.get("seked_courses_source")),
              f'"{name}" names whose courses they are: {obj.get("seked_courses_source") or "nothing"}')
        # Blender stores vertices in single precision, so 139 m is good to about ten micrometres.
        expected = course_levels(course_heights(values, structure))[-1]
        check(abs(top - expected) < 1e-3,
              f'"{name}" stands exactly as high as its courses add up to: {top:.4f} m against {expected:.4f} m')


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

    values = resolve(load_database(), preset)["values"]
    check_today(values)
    structures = interior_structures(values)
    check("g1" in structures, f"the database carries an interior for {structures or 'nothing'}")
    for structure in structures:
        name = interior_collection_name(structure)
        interior = bpy.data.collections.get(name)
        if not check(interior is not None and name in [c.name for c in root.children],
                     f'"{name}" is a child collection of "{ROOT_NAME}"'):
            continue
        expected = [s["name"] for s in interior_solids(values, structure)]
        got = [o.name for o in interior.objects]
        check(sorted(got) == sorted(expected),
              f"{name} holds the {len(expected)} solids the database builds: {sorted(expected)}")
        empty = [o.name for o in interior.objects if len(o.data.polygons) == 0]
        check(not empty, f"every solid in {name} has faces: {empty or 'none empty'}")
        sourceless = [o.name for o in interior.objects if not o.get("seked_sources")]
        check(not sourceless, f"every solid in {name} names its sources: {sourceless or 'none missing'}")
        wrong = [o.name for o in interior.objects if o.get("seked_structure") != structure]
        check(not wrong, f"every solid in {name} is stamped {structure}: {wrong or 'none wrong'}")

    sphinx = sphinx_params(values)
    if check(sphinx is not None, "the database carries the Sphinx's size and position"):
        obj = bpy.data.objects.get(SPHINX_MASSING_NAME)
        if check(obj is not None, f'"{SPHINX_MASSING_NAME}" is present'):
            check(str(obj.get("seked_placeholder", "")).lower().startswith("placeholder"),
                  "the Sphinx box says it is a placeholder and not a model of the statue")
            verts, _ = massing_geometry(sphinx)
            check(len(obj.data.vertices) == 8, f"the Sphinx box is a box: {len(obj.data.vertices)} vertices")
            # Blender stores vertices in single precision, so a coordinate
            # 350 m out is only good to about 30 micrometres.
            got = sorted(tuple(v.co) for v in obj.data.vertices)
            want = sorted(tuple(v) for v in verts)
            worst = max(abs(a - b) for g, w in zip(got, want) for a, b in zip(g, w))
            check(worst < 1e-3, f"the Sphinx box is where seked_data puts it, vertex for vertex: worst {worst:.2e} m")
            # Length east-west, width north-south, and the front face east.
            size = [max(v[i] for v in verts) - min(v[i] for v in verts) for i in range(3)]
            check(abs(size[0] - sphinx["length"]) < 1e-9 and abs(size[1] - sphinx["width"]) < 1e-9
                  and abs(size[2] - sphinx["height"]) < 1e-9,
                  f"the Sphinx box measures length by width by height east-north-up: {[round(v, 2) for v in size]}")

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

    check_far_terrain(terrain)

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
