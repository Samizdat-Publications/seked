"""
Bake the fitted stand-ins into GLBs the web viewer can load.

    blender -b build/seked.blend -P blender/export_web.py -- --out build/web-models
            [--build <dir>] [--only <id>[,<id>...]] [--reconstructions]

Blender keeps the hero stills; this makes it the asset baker as well. A
stand-in in the browser has to stand exactly where the render stands it, so
the fit is done here, once, offline, by the very functions the render uses:
`render_standins.import_model`, `cut_and_reduce` and `fit` are imported, never
copied, so the two pictures cannot drift apart.

Each model is written as one GLB holding three nodes, `lod0`, `lod1` and
`lod2`, decimated to 300k, 60k and 15k faces, all fitted identically, so the
viewer swaps detail by camera distance without moving the statue. Every node
carries a `seked` extra: the manifest entry, with the licence, the
attribution and the evidence tier the honesty rules require to be shown
wherever a stand-in is drawn.

Frame. The scene is +X east, +Y north, +Z up, and the glTF exporter turns the
world Y-up. The LOD nodes hang off an empty turned +90 degrees about X, which
the exporter's turn then undoes, so a vertex in the GLB is the vertex in the
.blend, in metres, in the data frame. The viewer's one
`group rotation={[-Math.PI/2,0,0]}` puts that into three's world.

Surfaces. Every model keeps its own PBR maps (`keep_materials=True`), which is
not quite what a render does: a render may drop a generated texture for the
scene's own photographed limestone, and lays real stone grain over a
`texture+stone` model through a node graph glTF cannot carry. That node work
is a render's, not the web's; the `material` the manifest names travels in the
extras so a later stage can do the equivalent in the viewer's own shaders.

`--reconstructions` adds the whole-plateau reconstruction, one GLB per part
group, placed by `render_reconstruction.build_reconstructions` and never
re-fitted. It is off by default and is not in the viewer's build chain, because
Stage 2 decides what the procedural builders replace; until then a run that
asks for it keeps the reconstruction out of nobody's way.

Standard library plus bpy, and it reads data/ directly, as blender/ scripts do.
"""
import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import bmesh  # noqa: E402  (only available inside Blender)
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import render_materials  # noqa: E402
import render_reconstruction  # noqa: E402
import render_standins  # noqa: E402
from render_reconstruction import build_reconstructions, reconstructions  # noqa: E402
from render_standins import cut_and_reduce, fit, import_model  # noqa: E402
from seked_data import load_footprints  # noqa: E402

# Face budgets for the three levels: the render's own 300k for a statue filling
# the frame, then a tenth of the plateau's width away, then the horizon. Look
# choices, not measurements.
LODS = (("lod0", 300000), ("lod1", 60000), ("lod2", 15000))

# The keys of a manifest entry that travel to the browser. `why` and the whole
# `meshy` block stay behind: they are the record of how a model was made, which
# lives in blender/models.json, not in a 20 MB download.
CARRIED = ("id", "name", "author", "url", "license", "attribution", "evidence", "material", "replaces", "variant", "states", "default_in")


def parse_args(defaults):
    """Blender's own argument split: everything after `--` is ours. Flags are bare, values follow their key."""
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opts = dict(defaults)
    i = 0
    while i < len(argv):
        key = argv[i].lstrip("-")
        if key in opts and isinstance(opts[key], bool):
            opts[key] = True
            i += 1
        elif key in opts and i + 1 < len(argv):
            opts[key] = argv[i + 1]
            i += 2
        else:
            i += 1
    return opts


def empty_the_scene():
    """The .blend is opened for its materials and its settings, not its plateau; nothing of it is exported."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def purge():
    """Drop the meshes, materials and images of the model just written, so seven 4k models fit in memory."""
    if hasattr(bpy.data, "orphans_purge"):
        for _ in range(4):
            if bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True) == 0:
                break


def sources(build_dir):
    """The downloaded and generated GLBs, from the index scripts/models.py writes under the chosen build directory."""
    index = os.path.join(build_dir, "models", "index.json")
    if not os.path.exists(index):
        sys.exit(f"no {index}: run python scripts/models.py (or point --build at a checkout that has one)")
    # render_standins reads the same index to fit at render time; point it at
    # the same build directory so the two never disagree about which GLB is which.
    render_standins.INDEX = index
    render_materials.TEXTURE_INDEX = os.path.join(build_dir, "textures", "index.json")
    return json.load(open(index, encoding="utf-8"))["models"]


def wanted(models, only):
    """The non-retired models, filtered by --only, each with the finishes whose retexture is on disk."""
    ids = [s.strip() for s in only.split(",") if s.strip()] if only else None
    return [m for m in models if not m.get("retired") and (ids is None or m["id"] in ids)]


def entry_for(model, tag, states):
    """The manifest entry a GLB carries into the browser: what it is, whose it is, and when it is shown."""
    entry = {k: model[k] for k in CARRIED if model.get(k) is not None}
    # An empty list is the manifest's "every state", as render_standins.chosen reads it.
    entry["states"] = list(states)
    # A state a plain model has given up to its finish is no longer a state that
    # model is the default of, or the viewer would draw both in the same breath.
    if entry.get("default_in"):
        entry["default_in"] = [s for s in entry["default_in"] if s in states]
    if tag:
        entry["finish"] = tag
        entry["id"] = f"{model['id']}-{tag}"
        why = model.get("finishes", {}).get(tag, {}).get("why")
        if why:
            entry["finish_why"] = why
    entry.setdefault("evidence", "stand-in")
    return entry


def build_lods(model, path, name):
    """Import, cut, decimate and fit once, then two coarser copies of the fitted result; returns the empty and the LOD objects."""
    scene = bpy.context.scene
    features = (load_footprints() or {}).get("features", [])
    if not any(f["id"] in model["replaces"] for f in features):
        print(f"  none of {model['replaces']} is in the footprints, so it has nowhere to stand")
        return None, [], None

    mesh = import_model(path, name, keep_materials=True)
    obj = cut_and_reduce(mesh, model["cut_z"], LODS[0][1], model.get("largest_part_only", False))
    done = fit(obj, model, features)

    # The empty carries the turn that cancels the exporter's own, so the GLB's
    # world space is the data frame. Its children keep the fit exactly.
    root = bpy.data.objects.new(f"{model['id']} (stand-in)", None)
    root.rotation_euler = (math.pi / 2.0, 0.0, 0.0)
    root.empty_display_size = 20.0
    scene.collection.objects.link(root)

    lods = []
    for level, (lod_name, faces) in enumerate(LODS):
        # Level 0 is the fitted object itself; the coarser ones are its own
        # fitted mesh put back through the same reducer, so nothing moves.
        lod = obj if level == 0 else cut_and_reduce(obj.data.copy(), None, faces)
        if level > 0:
            lod.location, lod.rotation_euler, lod.scale = obj.location, obj.rotation_euler, obj.scale
        lod.name = lod_name
        lod.data.name = f"{model['id']}-{lod_name}"
        lod.parent = root
        lods.append(lod)
    return root, lods, done


def write_glb(root, lods, out_path):
    """Export the empty and its LODs alone, with their extras, Y-up as glTF wants."""
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for lod in lods:
        lod.select_set(True)
    bpy.context.view_layer.objects.active = root
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_skins=False,
        export_morph=False,
    )
    return os.path.getsize(out_path)


def export_model(model, source, out_dir, tag, states):
    """One GLB for one model and one finish: fitted, three levels deep, labelled."""
    entry = entry_for(model, tag, states)
    folder = f"{model['id']}-{tag}" if tag else model["id"]
    path = os.path.join(os.path.dirname(source["index"]), folder, "model.glb") if tag else os.path.join(os.path.dirname(source["index"]), source["file"])
    if not os.path.exists(path):
        print(f"{entry['id']}: {path} is not on disk; skipped")
        return None
    started = time.time()
    root, lods, done = build_lods(model, path, entry["name"])
    if root is None:
        return None
    faces = {name: len(lod.data.polygons) for (name, _), lod in zip(LODS, lods)}
    entry["lods"] = [name for name, _ in LODS]
    entry["faces"] = faces
    entry["fit"] = done
    entry["file"] = f"{entry['id']}.glb"
    for lod in lods:
        # Every level carries the whole entry, so whichever one a viewer has
        # drawn can name itself, its licence and its evidence tier on its own.
        try:
            lod["seked"] = entry
        except (TypeError, ValueError):
            lod["seked"] = json.dumps(entry, ensure_ascii=False)
    out_path = os.path.join(out_dir, entry["file"])
    entry["bytes"] = write_glb(root, lods, out_path)
    print(f"{entry['id']}: {entry['bytes'] / 1e6:.1f} MB, faces {faces}, scale {done['scale']:.3f}, "
          f"turned {done['turn_deg']:.2f} deg, {done['length_m']:.1f} m long, stands {done['height_m']:.1f} m "
          f"against OSM's {done['osm_height_m']:.1f} m, in {time.time() - started:.0f} s. {entry['license']}")
    empty_the_scene()
    purge()
    return entry


# --- The reconstruction's parts --------------------------------------------
#
# The whole-plateau reconstruction comes as one model of everything, and the
# viewer wants to stream the temples without the mastabas. The model carries no
# grouping of its own: its parts are called Object_4551 and the like. So a part
# is filed under the group of the footprint its plan centroid stands on, which
# is the same footprint group whose massing the reconstruction hides, and a part
# over no outline at all goes to `plateau`. That is a rule, not a guess about
# what a part is; nothing about any of it is a measurement, and every group
# keeps the model's attribution and the `reconstruction` tier.

RECONSTRUCTION_STATE = "built"


def rings_of(feature):
    """A footprint's rings, whether it was written as one ring or several."""
    ring = feature["ring"]
    return [ring] if isinstance(ring[0][0], (int, float)) else ring


def inside(point, ring):
    """Ray casting: is a plan point inside this ring?"""
    x, y = point
    hit = False
    for i in range(len(ring)):
        ax, ay = ring[i - 1]
        bx, by = ring[i]
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            hit = not hit
    return hit


def group_of(obj, features, groups):
    """The footprint group a reconstruction part stands on, or `plateau` where it stands on none."""
    points = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    centre = (min(p.x for p in points) + max(p.x for p in points)) / 2, (min(p.y for p in points) + max(p.y for p in points)) / 2
    for feature in features:
        if feature.get("group") in groups and any(inside(centre, ring) for ring in rings_of(feature)):
            return feature["group"]
    return "plateau"


def merge_objects(objs, name):
    """Several placed objects as one mesh in world space, keeping their materials, the way import_model merges a GLB's."""
    bm = bmesh.new()
    materials = []
    for obj in objs:
        part = obj.data.copy()
        part.transform(obj.matrix_world)
        offset = len(materials)
        materials.extend(part.materials)
        for poly in part.polygons:
            poly.material_index += offset
        bm.from_mesh(part)
        bpy.data.meshes.remove(part)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.clear()
    for material in materials:
        mesh.materials.append(material)
    return mesh


def export_reconstructions(out_dir):
    """One GLB per part group of each reconstruction, placed by build_reconstructions and never re-fitted."""
    entries = []
    features = (load_footprints() or {}).get("features", [])
    started = time.time()
    # One call places every reconstruction of the state, and each part it keeps
    # carries the attribution of the one it came from, which is how a part is
    # given back to its own reconstruction here.
    placed = build_reconstructions(bpy.context.scene, RECONSTRUCTION_STATE, standin_sphinx=True)
    for recon in reconstructions(RECONSTRUCTION_STATE):
        parts = [o for o in placed if o.get("seked_reconstruction") == recon["attribution"]]
        if not parts:
            continue
        groups = set(recon.get("replaces_groups", []))
        filed = {}
        for obj in parts:
            filed.setdefault(group_of(obj, features, groups), []).append(obj)
        print(f"reconstruction {recon['id']}: {', '.join(f'{k} {len(v)}' for k, v in sorted(filed.items()))}, placed in {time.time() - started:.0f} s")
        for group, objs in sorted(filed.items()):
            entry = {
                "id": f"{recon['id']}-{group}",
                "name": f"{recon['name']}: {group}",
                "author": recon["author"],
                "url": recon["url"],
                "license": recon["license"],
                "attribution": recon["attribution"],
                "evidence": "reconstruction",
                "group": group,
                "replaces": [],
                "states": list(recon.get("states", [])),
            }
            root = bpy.data.objects.new(f"{entry['id']} (reconstruction)", None)
            root.rotation_euler = (math.pi / 2.0, 0.0, 0.0)
            bpy.context.scene.collection.objects.link(root)
            merged = merge_objects(objs, entry["id"])
            lods = []
            for level, (lod_name, faces) in enumerate(LODS):
                lod = cut_and_reduce(merged if level == 0 else merged.copy(), None, faces)
                lod.name = lod_name
                lod.data.name = f"{entry['id']}-{lod_name}"
                lod.parent = root
                lods.append(lod)
            entry["lods"] = [name for name, _ in LODS]
            entry["faces"] = {name: len(lod.data.polygons) for (name, _), lod in zip(LODS, lods)}
            entry["file"] = f"{entry['id']}.glb"
            for lod in lods:
                lod["seked"] = entry
            entry["bytes"] = write_glb(root, lods, os.path.join(out_dir, entry["file"]))
            print(f"  {entry['id']}: {entry['bytes'] / 1e6:.1f} MB, {len(objs)} parts, faces {entry['faces']}")
            entries.append(entry)
            for lod in lods:
                bpy.data.objects.remove(lod, do_unlink=True)
            bpy.data.objects.remove(root, do_unlink=True)
            purge()
    return entries


def main():
    opts = parse_args({"out": os.path.join(ROOT, "build", "web-models"), "build": os.path.join(ROOT, "build"), "only": "", "reconstructions": False})
    out_dir = os.path.abspath(opts["out"])
    index = sources(os.path.abspath(opts["build"]))
    render_reconstruction.MODELS = os.path.join(os.path.abspath(opts["build"]), "models")
    manifest = json.load(open(render_standins.MANIFEST, encoding="utf-8"))

    # The reconstruction is registered onto the survey by this scene's own
    # pyramids and draped onto its ground, so it goes first, while the plateau
    # the .blend was opened for is still standing. The stand-ins want none of it.
    entries = export_reconstructions(out_dir) if opts["reconstructions"] else []
    empty_the_scene()

    for model in wanted(manifest["models"], opts["only"]):
        source = index.get(model["id"])
        if source is None:
            print(f"{model['id']}: not fetched; run python scripts/models.py")
            continue
        source = dict(source, index=os.path.join(os.path.abspath(opts["build"]), "models", "index.json"))
        # A finish is a retexture of the same mesh, and the manifest says which
        # state wears it. That state's plain model is then never shown, so it
        # is cut from the plain GLB's states and the two can never both appear.
        finish_in = model.get("finish_in", {})
        states = model.get("states", [])
        dressed = {}
        for tag in model.get("finishes", {}):
            for state in states:
                if finish_in.get(state) == tag:
                    dressed.setdefault(tag, []).append(state)
        plain = [s for s in states if s not in [s2 for group in dressed.values() for s2 in group]]
        if plain:
            entry = export_model(model, source, out_dir, None, plain)
            if entry:
                entries.append(entry)
        for tag, tag_states in dressed.items():
            entry = export_model(model, source, out_dir, tag, tag_states)
            if entry:
                entries.append(entry)

    os.makedirs(out_dir, exist_ok=True)
    out_index = os.path.join(out_dir, "index.json")
    with open(out_index, "w", encoding="utf-8") as f:
        json.dump({"about": "Fitted stand-ins baked by blender/export_web.py; scripts/web-assets.ts compresses them for the viewer.", "models": entries}, f, indent=2, ensure_ascii=False)
    print(f"wrote {out_index} with {len(entries)} models, {sum(e['bytes'] for e in entries) / 1e6:.1f} MB in all")


if __name__ == "__main__":
    main()
