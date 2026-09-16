"""
Build the Giza pyramids in Blender from the Seked measurement database.

Run from Blender's Text Editor, or headless:

    blender -b -P blender/generate.py -- --preset canonical --save build/seked.blend --gltf build/seked.glb

Every object is generated from data/; nothing is modelled by hand. Each object
carries custom properties naming the preset and the source of each value, so
the provenance survives inside the .blend file and, as glTF extras, in the GLB. The concavity of the Great
Pyramid is a shape key ("Concavity", 0 = flat faces, 1 = the measured
hollowing), and each pyramid gets an "as built" and a "today" object. The
"today" object is stacked course by course where the database carries the
courses and is the flat truncation at the surviving height where it does not.

Each pyramid whose interior the preset carries records for gets a child
collection of its own, "Interior" for the Great Pyramid and "Interior (label)"
for the rest, holding one object per solid rather than a boolean cut out of the
pyramid, so a section view is a matter of hiding or showing that collection.
Nothing here knows what any interior looks like: seked_data reads the plan out
of the records. The Sphinx is a box: an axis-aligned massing placeholder on a cited position,
standing in for the sculpt, and it says so in a custom property. The plateau arrives as
a hidden "Terrain (GLO-30 context)" grid and a visible "Terrain (ground)" grid, with a
"Terrain (far context)" ring carrying the horizon out past their edge; read their notes
before treating anything near a monument as ground.

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
    GROUND_BLEND_DISTANCE,
    GROUND_FLAT_MARGIN,
    SPHINX_MASSING_NAME,
    SPHINX_MASSING_NOTE,
    course_keys,
    course_levels,
    ground_height,
    massing_geometry,
    footprint_geometry,
    footprint_inputs,
    load_footprints,
    survey_footprints,
    interior_solids,
    interior_structures,
    load_database,
    load_terrain,
    pyramid_geometry,
    pyramid_params,
    resolve,
    site_origin_elevation,
    sphinx_params,
    stepped_pyramid_geometry,
)

STRUCTURES = [("g1", "G1 Khufu"), ("g2", "G2 Khafre"), ("g3", "G3 Menkaure")]
TERRAIN_NAME = "Terrain (GLO-30 context)"
GROUND_NAME = "Terrain (ground)"
FAR_TERRAIN_NAME = "Terrain (far context)"
FAR_TERRAIN_GRID = "giza-glo30-far"
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


def build_today(collection, structure, label, params, provenance, records):
    """
    The pyramid as it stands, as one object named "<label> (today)".

    Where the preset carries course heights, the object is stacked slab by
    slab: a stepped core is what is actually standing there, and it is the
    cheapest thing the model can do that looks like the photographs. It says
    how many courses it is and whose in its own custom properties, so the
    provenance survives in the .blend and in the GLB's extras. Where the
    preset has no courses the object is the flat truncation at the surviving
    height it has always been, with the concavity as a shape key. It is one
    object either way, so nothing downstream has to choose between two models
    of the same pyramid; a structure with neither courses nor a surviving
    height gets no today object at all.
    """
    courses = params["courses"]
    if courses:
        verts, faces = stepped_pyramid_geometry(params["base"], params["height"], courses)
        sources = sorted({records[k]["source"] for k in course_keys(records, structure)})
        top = course_levels(courses)[-1]
        props = dict(provenance)
        props["seked_courses"] = len(courses)
        props["seked_courses_source"] = ", ".join(sources)
        props["seked_courses_top_m"] = float(top)
        obj = make_object(f"{label} (today)", verts, faces, collection, props)
        print(f"{label} (today): {len(courses)} courses from {props['seked_courses_source']}, "
              f"standing {top:.3f} m in {len(verts)} vertices")
        return obj
    if params["height_today"]:
        verts, faces = pyramid_geometry(params["base"], params["height"], truncate_at=params["height_today"], concavity=0.0)
        obj = make_object(f"{label} (today)", verts, faces, collection, provenance)
        add_concavity_shape_key(obj, params["base"], params["height"], params["height_today"], params["concavity"])
        print(f"{label} (today): flat truncation at {params['height_today']} m, the preset carrying no courses")
        return obj
    return None


def interior_collection_name(structure):
    """The Great Pyramid's interior keeps the plain name; the others are labelled."""
    if structure == "g1":
        return INTERIOR_NAME
    return f"{INTERIOR_NAME} ({dict(STRUCTURES).get(structure, structure)})"


def build_interior(parent, preset_id, resolved, placements=None):
    """
    Each pyramid's passages and chambers, one object each in its own "Interior"
    child collection. They are separate solids, not a boolean cut, so the
    section views clip or hide them and a claim can name a point on one.

    Which structures appear is a question for the database: a structure whose
    interior records the preset carries is built, and one whose records are not
    there yet is not mentioned.

    The solids are built in the structure's own frame, origin at its base
    centre, and each object is then given its pyramid's location and rotation
    from `placements`, the same centre offsets, base level and orientation the
    pyramid object carries. Before this, Khafre's and Menkaure's rooms were
    left at the origin, inside the Great Pyramid.
    """
    records = resolved["records"]
    placements = placements or {}
    built = {}
    for structure in interior_structures(resolved["values"]):
        name = interior_collection_name(structure)
        collection = get_child_collection(parent, name)
        solids = interior_solids(resolved["values"], structure)
        for solid in solids:
            sources = sorted({records[k]["source"] for k in solid["keys"] if k in records})
            obj = make_object(solid["name"], solid["verts"], solid["faces"], collection, {
                "seked_preset": preset_id,
                "seked_structure": structure,
                "seked_solid": solid["name"],
                "seked_sources": ", ".join(sources),
                "seked_records": ", ".join(solid["keys"]),
            })
            if structure in placements:
                obj.location, obj.rotation_euler = placements[structure]
        built[structure] = solids
        names = ", ".join(s["name"] for s in solids)
        print(f"{name}: {len(solids)} solids ({names})")
    if not built:
        print(f"no {INTERIOR_NAME}: the preset carries no interior records")
    return built


def build_sphinx(parent, preset_id, resolved):
    """
    The Sphinx as a box, until the sculpt exists.

    It is placed from `sphinx.center.latitude` and `.longitude`, which are a
    commonly cited position and not a survey, and sized from the ARCE survey's
    length, width and height. Nothing about it is a model of the statue, so it
    says so in a custom property rather than only in this comment, and
    check.py reads that property back.
    """
    values, records = resolved["values"], resolved["records"]
    p = sphinx_params(values)
    if p is None:
        print(f"no {SPHINX_MASSING_NAME}: the preset carries no size or position for it")
        return None
    verts, faces = massing_geometry(p)
    keys = ["sphinx.length", "sphinx.width", "sphinx.height", "sphinx.center.latitude", "sphinx.center.longitude"]
    sources = sorted({records[k]["source"] for k in keys if k in records})
    obj = make_object(SPHINX_MASSING_NAME, verts, faces, parent, {
        "seked_preset": preset_id,
        "seked_structure": "sphinx",
        "seked_placeholder": SPHINX_MASSING_NOTE,
        "seked_sources": ", ".join(sources),
        "seked_records": ", ".join(keys),
    })
    print(f"{SPHINX_MASSING_NAME}: {p['length']} x {p['width']} x {p['height']} m at "
          f"({p['offset_east']:.1f}, {p['offset_north']:.1f}), front face east")
    return obj


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
    build_far_context(parent, preset_id, header, elevation)
    return obj


def build_far_context(parent, preset_id, near_header, elevation):
    """
    The coarse ring that carries the horizon out past the near grid.

    The same Copernicus product cut again at twelve kilometres and sixty
    metres, with the same site origin elevation taken off, and drawn only
    where the near grid does not reach: every face the near grid already
    covers is left out, so the two meet along the near grid's outer edge
    rather than lying one on the other and z-fighting. Its vertices are all
    there, the ones under the near grid included, so the mesh is the nx by ny
    its own header describes. Nothing is flattened here: the pyramids are
    inside the near grid.
    """
    header, heights = load_terrain(name=FAR_TERRAIN_GRID)
    nx, ny, spacing = header["nx"], header["ny"], header["spacing"]
    x0, y0 = header["x0"], header["y0"]
    near_spacing = near_header["spacing"]

    # The two grids have to share their sample points, or the ring's inner edge
    # would not sit on the near grid's outer edge. That needs the far spacing to
    # be a whole multiple of the near one and the two origins to be a whole
    # number of far steps apart, so both are checked rather than assumed.
    ratio = spacing / near_spacing
    if abs(ratio - round(ratio)) > 1e-9 or round(ratio) < 1:
        raise ValueError(
            f"{FAR_TERRAIN_GRID} is spaced {spacing} m and the near grid {near_spacing} m, "
            f"a ratio of {ratio}, which is not a whole multiple, so the two share no sample points"
        )
    for axis in ("x", "y"):
        far0, near0 = header[axis + "0"], near_header[axis + "0"]
        steps = (near0 - far0) / spacing
        if abs(steps - round(steps)) > 1e-9:
            raise ValueError(
                f"{FAR_TERRAIN_GRID} starts at {axis}0 = {far0} m and the near grid at {near0} m, "
                f"which is {steps} steps of {spacing} m apart rather than a whole number, so the "
                "grids are offset and their samples do not coincide"
            )

    verts = []
    for j in range(ny):
        y = y0 + j * spacing
        row = j * nx
        for i in range(nx):
            verts.append((x0 + i * spacing, y, heights[row + i] - elevation))

    near_x1 = near_header["x0"] + (near_header["nx"] - 1) * near_spacing
    near_y1 = near_header["y0"] + (near_header["ny"] - 1) * near_spacing
    eps = spacing * 1e-6
    faces, covered = [], 0
    for j in range(ny - 1):
        inside_y = (y0 + j * spacing >= near_header["y0"] - eps
                    and y0 + (j + 1) * spacing <= near_y1 + eps)
        for i in range(nx - 1):
            if (inside_y and x0 + i * spacing >= near_header["x0"] - eps
                    and x0 + (i + 1) * spacing <= near_x1 + eps):
                covered += 1        # the near grid already draws this ground, at its own spacing
                continue
            a = j * nx + i
            # Counter-clockwise seen from above, so the surface faces up.
            faces.append((a, a + 1, a + nx + 1, a + nx))

    obj = make_object(FAR_TERRAIN_NAME, verts, faces, parent, {
        "seked_preset": preset_id,
        "seked_structure": "terrain",
        "seked_site": header["site"],
        "seked_sources": header["source"],
        "seked_terrain_sha256": header["sha256"],
        "seked_terrain_datum": header["verticalDatum"],
        "seked_origin_elevation_m": float(elevation),
        "seked_note": (
            f"The coarse ring past the near grid: the same GLO-30 surface model cut out to "
            f"{abs(x0):.0f} m at {spacing:.0f} m spacing, so the horizon does not stop where the near "
            f"grid does at {near_x1:.0f} m. Its inner edge is the near grid's outer edge sampled at "
            f"{spacing:.0f} m rather than {near_spacing:.0f} m, and every face the near grid already "
            "covers is left out, so the two meet edge to edge instead of overlapping. The monument "
            "footprints are edited here as they are in the near grid, and nothing is flattened: the "
            "pyramids are inside the near grid. Heights are orthometric on EGM2008, less the site "
            "origin elevation from data/sites.json."
        ),
    })
    print(f"{FAR_TERRAIN_NAME}: {nx} x {ny} at {spacing} m out to {abs(x0):.0f} m, "
          f"{len(faces)} faces, {covered} left to the near grid")
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



FOOTPRINT_COLLECTION = "Plateau (Tier 3)"
MASTABA_OBJECT = "Mastaba fields (OSM)"


def build_footprints(parent, preset_id, resolved):
    """
    The plateau's lesser monuments, from data/footprints/giza.json: one object
    per named monument, and the 577 mastabas as a single object, because a
    field of them is one thing to look at and six hundred objects is not.

    Every object says where it came from: the OSM way, the import's source,
    the kind of solid, and the measurement its height was looked up in when
    OSM tagged none. Returns the ids built, so the caller can tell whether the
    Sphinx came from OSM or still needs its box.
    """
    file = load_footprints()
    if file is None:
        print("no footprints: data/footprints/giza.json is missing; run `pnpm run footprints`")
        return set()
    values, records = resolved["values"], resolved["records"]
    coll = get_child_collection(parent, FOOTPRINT_COLLECTION)
    built = set()
    field_verts, field_faces, field_ids = [], [], []
    skipped = []
    # The traced outlines, then the solids built from survey records, some of
    # which (Khafre's causeway) are placed by the traced ones they join.
    for f in file["features"] + survey_footprints(values, file["features"]):
        geometry = footprint_geometry(f, values)
        if geometry is None:
            skipped.append(f["id"])
            continue
        verts, faces = geometry
        inputs = footprint_inputs(f)
        if f["group"] == "mastabas":
            offset = len(field_verts)
            field_verts.extend(verts)
            field_faces.extend(tuple(i + offset for i in face) for face in faces)
            field_ids.append(f["osm"])
            built.add(f["id"])
            continue
        make_object(f["name"], verts, faces, coll, {
            "seked_preset": preset_id,
            "seked_structure": "plateau",
            "seked_footprint": f["id"],
            "seked_group": f["group"],
            "seked_kind": f["kind"],
            "seked_osm_way": f.get("osm", 0),
            "seked_sources": ", ".join(sorted(({file["source"]} if f.get("osm") else set())
                                              | {records[k]["source"] for k in inputs if k in records})),
            "seked_height": "OSM tag" if f.get("height") is not None else ", ".join(footprint_inputs({"heightKey": f.get("heightKey"), "depthKey": f.get("depthKey")})),
        })
        built.add(f["id"])
    if field_verts:
        make_object(MASTABA_OBJECT, field_verts, field_faces, coll, {
            "seked_preset": preset_id,
            "seked_structure": "plateau",
            "seked_footprint": "mastabas",
            "seked_group": "mastabas",
            "seked_kind": "prism",
            "seked_mastaba_count": len(field_ids),
            "seked_sources": ", ".join(sorted({file["source"], records["tier3.mastaba.height"]["source"]})),
            "seked_height": "tier3.mastaba.height",
        })
    reg = file["registration"]
    print(f"{FOOTPRINT_COLLECTION}: {len(built) - len(field_ids)} monuments and {len(field_ids)} mastabas from OSM "
          f"({file['osmBase']}), registered to residuals {reg['residuals']} m; skipped {skipped or 'none'}")
    return built


def build(preset_id):
    db = load_database()
    resolved = resolve(db, preset_id)
    values, records = resolved["values"], resolved["records"]
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    coll = get_collection("Seked")

    placed = []
    placements = {}
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
        placements[structure] = (location, rotation)

        # As built: full height, flat basis with the concavity as a shape key.
        verts, faces = pyramid_geometry(p["base"], p["height"], concavity=0.0)
        built = make_object(f"{label} (as built)", verts, faces, coll, provenance)
        built.location, built.rotation_euler = location, rotation
        add_concavity_shape_key(built, p["base"], p["height"], None, p["concavity"])

        # Today: the pyramid as it stands. Course by course where the database
        # has the courses, because a stack of slabs is what is standing there;
        # a flat truncation at the surviving height where it does not. One
        # object either way, so nothing has to choose between two models of the
        # same pyramid.
        today = build_today(coll, structure, label, p, provenance, records)
        if today is not None:
            today.location, today.rotation_euler = location, rotation
            today.hide_set(True)
            today.hide_render = True

        print(f"{label}: base {p['base']} m, height {p['height']} m, concavity {p['concavity']} m, "
              f"orientation {p['orientation_deg'] * 60:.1f}', at {location}")

    build_interior(coll, preset_id, resolved, placements)
    footprints = build_footprints(coll, preset_id, resolved)
    # The OSM Sphinx supersedes the box: an outline modelled as forepaws, body
    # and head, on the ground it is cut into, against an axis-aligned box on
    # the datum plane forty metres above that ground. The box is still built
    # when the import is missing, because a placeholder is better than nothing.
    if "sphinx.body" not in footprints:
        build_sphinx(coll, preset_id, resolved)
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
