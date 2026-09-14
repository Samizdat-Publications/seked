"""
Build the Giza pyramids in Blender from the Seked measurement database.

Run from Blender's Text Editor, or headless:

    blender -b -P blender/generate.py -- --preset canonical --save build/seked.blend --gltf build/seked.glb

Every object is generated from data/; nothing is modelled by hand. Each object
carries custom properties naming the preset and the source of each value, so
the provenance survives inside the .blend file and, as glTF extras, in the GLB. The concavity of the Great
Pyramid is a shape key ("Concavity", 0 = flat faces, 1 = the measured
hollowing), and each pyramid gets an "as built" and a "today" object.

The Great Pyramid's interior is a child collection, "Interior", holding one
object per solid rather than a boolean cut out of the masonry, so a section
view is a matter of hiding or showing that collection. The plateau arrives as
a hidden "Terrain (GLO-30 context)" grid and a visible "Terrain (ground)" grid; read their notes before treating
anything near a monument as ground.

`blender/check.py` asserts what this script produced; run it after a save.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import bpy  # noqa: E402  (only available inside Blender)

from seked_data import (  # noqa: E402
    interior_solids,
    load_database,
    load_terrain,
    pyramid_geometry,
    pyramid_params,
    resolve,
    site_origin_elevation,
)

STRUCTURES = [("g1", "G1 Khufu"), ("g2", "G2 Khafre"), ("g3", "G3 Menkaure")]
TERRAIN_NAME = "Terrain (GLO-30 context)"
GROUND_NAME = "Terrain (ground)"
# Metres beyond a pyramid's footprint over which the ground sits at its surveyed base level,
# and the further distance over which that level blends back into the surface model.
GROUND_FLAT_MARGIN = 40.0
GROUND_BLEND_DISTANCE = 260.0
INTERIOR_NAME = "Interior"


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


def get_child_collection(parent, name):
    """A child collection of `parent`, so the viewer can hide a whole layer at once."""
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
    if coll.name not in parent.children:
        parent.children.link(coll)
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


def build_interior(parent, preset_id, resolved):
    """
    The Great Pyramid's passages and chambers, one object each in an "Interior"
    child collection. They are separate solids, not a boolean cut, so the
    section views clip or hide them and a claim can name a point on one.
    """
    interior = get_child_collection(parent, INTERIOR_NAME)
    records = resolved["records"]
    solids = interior_solids(resolved["values"])
    for solid in solids:
        sources = sorted({records[k]["source"] for k in solid["keys"] if k in records})
        make_object(solid["name"], solid["verts"], solid["faces"], interior, {
            "seked_preset": preset_id,
            "seked_structure": "g1",
            "seked_solid": solid["name"],
            "seked_sources": ", ".join(sources),
            "seked_records": ", ".join(solid["keys"]),
        })
    names = ", ".join(s["name"] for s in solids)
    print(f"{INTERIOR_NAME}: {len(solids)} solids ({names})")
    return solids


def ground_height(x, y, z_surface, pyramids):
    """
    The surface model with each pyramid's footprint (plus a margin) set to the
    pyramid's surveyed base level and blended smoothly back into the model
    beyond it. The square footprint ignores the few arcminutes of orientation.
    """
    z = z_surface
    for p in pyramids:
        d = max(abs(x - p["offset_east"]), abs(y - p["offset_north"])) - p["base"] / 2.0
        if d <= GROUND_FLAT_MARGIN:
            return p["offset_up"]
        if d < GROUND_FLAT_MARGIN + GROUND_BLEND_DISTANCE:
            t = (d - GROUND_FLAT_MARGIN) / GROUND_BLEND_DISTANCE
            s = t * t * (3.0 - 2.0 * t)
            z = min(z, p["offset_up"] + (z_surface - p["offset_up"]) * s)
    return z


def build_terrain(parent, preset_id, pyramids=()):
    """
    The Copernicus GLO-30 heightfield as one grid in the project frame, with
    the site's origin elevation taken off so z is height above the Great
    Pyramid's base. Hidden by default: it is a surface model whose monument
    footprints are edited, so the mound at the origin is neither the ground
    under Khufu nor the built surface of Khufu.
    """
    header, heights = load_terrain()
    elevation = site_origin_elevation(header["site"])
    nx, ny, spacing = header["nx"], header["ny"], header["spacing"]
    x0, y0 = header["x0"], header["y0"]

    verts, ground = [], []
    for j in range(ny):
        y = y0 + j * spacing
        row = j * nx
        for i in range(nx):
            x, z = x0 + i * spacing, heights[row + i] - elevation
            verts.append((x, y, z))
            ground.append((x, y, ground_height(x, y, z, pyramids)))
    faces = []
    for j in range(ny - 1):
        for i in range(nx - 1):
            a = j * nx + i
            # Counter-clockwise seen from above, so the surface faces up.
            faces.append((a, a + 1, a + nx + 1, a + nx))

    obj = make_object(TERRAIN_NAME, verts, faces, parent, {
        "seked_preset": preset_id,
        "seked_structure": "terrain",
        "seked_site": header["site"],
        "seked_sources": header["source"],
        "seked_terrain_sha256": header["sha256"],
        "seked_terrain_datum": header["verticalDatum"],
        "seked_origin_elevation_m": float(elevation),
        "seked_note": (
            "Copernicus GLO-30 is a surface model and its editing mask marks the monument "
            "footprints, so the pyramids arrive as smooth mounds. The sample at the origin is "
            "neither the ground under Khufu nor the built surface of Khufu. Heights are "
            "orthometric on EGM2008, less the site origin elevation from data/sites.json."
        ),
    })
    obj.hide_set(True)
    obj.hide_render = True
    print(f"{TERRAIN_NAME}: {nx} x {ny} at {spacing} m, origin elevation {elevation} m, hidden")
    build_ground(parent, preset_id, header, ground, faces, elevation)
    return obj


def build_ground(parent, preset_id, header, ground, faces, elevation):
    obj = make_object(GROUND_NAME, ground, faces, parent, {
        "seked_preset": preset_id,
        "seked_structure": "terrain",
        "seked_site": header["site"],
        "seked_sources": header["source"],
        "seked_terrain_sha256": header["sha256"],
        "seked_origin_elevation_m": float(elevation),
        "seked_note": (
            "The GLO-30 heightfield with the ground under each pyramid set to its surveyed base "
            f"level within {GROUND_FLAT_MARGIN:.0f} m of the footprint and blended back into the model over "
            f"the next {GROUND_BLEND_DISTANCE:.0f} m. A stand-in until the GPMP contours are entered."
        ),
    })
    print(f"{GROUND_NAME}: footprints flattened to the surveyed base levels")
    return obj


def build(preset_id):
    db = load_database()
    resolved = resolve(db, preset_id)
    values, records = resolved["values"], resolved["records"]
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    coll = get_collection("Seked")

    placed = []
    for structure, label in STRUCTURES:
        p = pyramid_params(values, structure)
        if p is None:
            print(f"skip {structure}: no base or height in preset {preset_id}")
            continue
        placed.append(p)
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

    build_interior(coll, preset_id, resolved)
    build_terrain(coll, preset_id, placed)


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
