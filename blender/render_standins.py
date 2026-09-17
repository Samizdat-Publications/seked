"""
Visual stand-ins for structures that are not pyramids, fitted at render time.

CLAUDE.md allows a good free model for anything that is not a pyramid, placed
on that structure's footprint, keeping its licence and source, and marked a
stand-in wherever it is shown; nothing about its form is a measurement. This
module does the placing. The generated .blend and the viewer's GLB never hold a
stand-in: they stay what the database built, and a render adds the models on
top, hiding the OSM solids each one replaces.

The fit uses only the footprint. For each model: cut away what is below
`cut_z` in the model's own units (a plinth), set its `ground_z` on the
outline's base so what is left of the plinth sinks under the sand, decimate to `faces`, take the
principal axis of what is left in plan (with `largest_part_only`, after
dropping every loose part but the biggest) and its length along that axis, and do
the same for the OSM outlines it replaces. The scale is the ratio of the two
lengths, the rotation turns one axis onto the other with the model's `front`
toward the outline named `front_to` from the one named `front_from`, the
midpoints of the two extents coincide, and the model stands on the lowest
base the replaced outlines carry. Its height is then a result, and is printed
beside the height OSM gives, as the check on the scale.
"""
import json
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

from render_materials import bedrock_material, casing_material, core_material
from seked_data import load_footprints

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MANIFEST = os.path.join(HERE, "models.json")
INDEX = os.path.join(ROOT, "build", "models", "index.json")


def principal_axis(points):
    """The unit vector along which 2-D points spread most, from their covariance."""
    n = len(points)
    mx = sum(p[0] for p in points) / n
    my = sum(p[1] for p in points) / n
    sxx = sum((p[0] - mx) ** 2 for p in points) / n
    syy = sum((p[1] - my) ** 2 for p in points) / n
    sxy = sum((p[0] - mx) * (p[1] - my) for p in points) / n
    angle = 0.5 * math.atan2(2.0 * sxy, sxx - syy)
    return Vector((math.cos(angle), math.sin(angle)))


def extent(points, axis):
    """Length along `axis` and the plan midpoint of that extent, with the mean across it."""
    along = [p[0] * axis.x + p[1] * axis.y for p in points]
    normal = Vector((-axis.y, axis.x))
    across = sum(p[0] * normal.x + p[1] * normal.y for p in points) / len(points)
    lo, hi = min(along), max(along)
    mid = axis * ((lo + hi) / 2.0) + normal * across
    return hi - lo, mid


def import_model(path, name, keep_materials=False):
    """The GLB's meshes as one object with its transforms applied, keeping their materials only when asked."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    bm = bmesh.new()
    materials = []
    for obj in meshes:
        part = obj.data.copy()
        part.transform(obj.matrix_world)
        # Material indices are per mesh; shift them onto the combined list.
        offset = len(materials)
        materials.extend(part.materials)
        for poly in part.polygons:
            poly.material_index += offset
        bm.from_mesh(part)
        bpy.data.meshes.remove(part)
    for obj in new:
        bpy.data.objects.remove(obj, do_unlink=True)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.clear()
    if keep_materials:
        for mat in materials:
            mesh.materials.append(mat)
    return mesh


def largest_part(bm):
    """Delete every loose part but the one with the most vertices, after welding the UV seams a GLB splits."""
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    seen, parts = set(), []
    for start in bm.verts:
        if start in seen:
            continue
        seen.add(start)
        stack, part = [start], []
        while stack:
            v = stack.pop()
            part.append(v)
            for e in v.link_edges:
                w = e.other_vert(v)
                if w not in seen:
                    seen.add(w)
                    stack.append(w)
        parts.append(part)
    parts.sort(key=len, reverse=True)
    drop = [v for part in parts[1:] for v in part]
    bmesh.ops.delete(bm, geom=drop, context="VERTS")
    return len(parts) - 1


def cut_and_reduce(mesh, cut_z, faces, largest_only=False):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    if largest_only:
        print(f"  dropped {largest_part(bm)} loose parts")
    if cut_z is not None:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0.0, 0.0, cut_z), plane_no=(0.0, 0.0, 1.0), clear_inner=True)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(mesh.name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    count = len(mesh.polygons)
    if count > faces:
        mod = obj.modifiers.new("reduce", "DECIMATE")
        mod.ratio = faces / count
        with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def fit(obj, model, features):
    """Scale, turn and move the object onto the replaced outlines; returns what was done, for the log."""
    verts = [v.co for v in obj.data.vertices]
    step = max(1, len(verts) // 20000)
    plan = [(v.x, v.y) for v in verts[::step]]
    m_axis = principal_axis(plan)
    front = Vector((0.0, 1.0)) if model["front"].endswith("y") else Vector((1.0, 0.0))
    if model["front"].startswith("-"):
        front = -front
    if model.get("axis_from_front"):
        # A generated model comes squared to its own axes, and scaffolding or rubble can pull its principal axis askew.
        m_axis = front
    elif m_axis.dot(front) < 0:
        m_axis = -m_axis
    m_len, m_mid = extent(plan, m_axis)

    rings = [f for f in features if f["id"] in model["replaces"]]
    points = [tuple(pt) for f in rings for ring in ([f["ring"]] if isinstance(f["ring"][0][0], (int, float)) else f["ring"]) for pt in ring]
    o_axis = principal_axis(points)

    def centroid(fid):
        ring = next(f["ring"] for f in rings if f["id"] == fid)
        ring = ring if isinstance(ring[0][0], (int, float)) else ring[0]
        return Vector((sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)))

    if o_axis.dot(centroid(model["front_to"]) - centroid(model["front_from"])) < 0:
        o_axis = -o_axis
    o_len, o_mid = extent(points, o_axis)

    scale = o_len / m_len
    turn = math.atan2(o_axis.y, o_axis.x) - math.atan2(m_axis.y, m_axis.x)
    base = min(f["base"] for f in rings)
    # The model's ground, where its sculpted sand meets the figure, goes on the
    # outline's base; what the cut left of its plinth below that sinks under the terrain.
    z0 = model.get("ground_z")
    if z0 is None:
        z0 = min(v.z for v in verts)
    rotated_mid = Matrix.Rotation(turn, 2) @ (m_mid * scale)
    obj.data.transform(Matrix.Translation((0.0, 0.0, -z0)))
    obj.scale = (scale, scale, scale)
    obj.rotation_euler = (0.0, 0.0, turn)
    obj.location = (o_mid.x - rotated_mid.x, o_mid.y - rotated_mid.y, base)
    height = max(v.co.z for v in obj.data.vertices) * scale
    tallest = max((f.get("height") or 0) + f["base"] - base for f in rings)
    return {"scale": scale, "turn_deg": math.degrees(turn), "length_m": o_len, "height_m": height, "osm_height_m": tallest}


def chosen(models, state, variants):
    """
    The stand-ins a render shows. A model names the `states` it belongs to (a
    model that names none belongs to every one) and may be a `variant`, such as
    the lion Sphinx, which is shown only when asked for and then instead of the
    ordinary model for the same outlines, and a variant that names a state in
    `default_in` is that state's ordinary model. A retired model is never shown.
    """
    live = [m for m in models if not m.get("retired") and state in m.get("states", [state])]
    groups = {}
    for model in live:
        groups.setdefault(tuple(sorted(model["replaces"])), []).append(model)
    picked = []
    for group in groups.values():
        wanted = [m for m in group if m.get("variant") in variants]
        # A variant can be a state's own default (the Anubis Sphinx in "ancient"),
        # which a render still overrides by asking for another variant.
        default = [m for m in group if state in m.get("default_in", [])] or [m for m in group if not m.get("variant")]
        picked.extend(wanted[:1] if wanted else default[:1])
    return picked


def build_standins(scene, state="today", variants=()):
    """The stand-ins for this state and these variants, fitted and labelled; the OSM solids they replace hidden."""
    if not os.path.exists(INDEX):
        print(f"no {INDEX}: no stand-in models; run python scripts/models.py")
        return []
    index = json.load(open(INDEX, encoding="utf-8"))["models"]
    features = (load_footprints() or {}).get("features", [])
    built = []
    for model in chosen(json.load(open(MANIFEST, encoding="utf-8"))["models"], state, variants):
        entry = index.get(model["id"])
        if entry is None:
            print(f"stand-in {model['id']}: not downloaded; run python scripts/models.py")
            continue
        if not any(f["id"] in model["replaces"] for f in features):
            print(f"stand-in {model['id']}: none of {model['replaces']} is in the footprints, so it has nowhere to stand")
            continue
        path = os.path.join(os.path.dirname(INDEX), entry["file"])
        name = f"{model['name']} (stand-in)"
        # "texture" keeps the model's own surface, which is the point of a painted
        # reconstruction; "casing" is fresh dressed limestone; the default is the
        # weathered, banded core stone a stand-in for today's plateau wants.
        finish = model.get("material", "core")
        obj = cut_and_reduce(import_model(path, name, finish == "texture"), model["cut_z"], model["faces"], model.get("largest_part_only", False))
        done = fit(obj, model, features)
        if finish == "casing":
            obj.data.materials.append(casing_material())
        elif finish != "texture":
            obj.data.materials.append(core_material(True))
        obj["seked_standin"] = model["attribution"]
        obj["seked_license"] = model["license"]
        obj["seked_replaces"] = ", ".join(model["replaces"])
        if model.get("evidence"):
            obj["seked_evidence"] = model["evidence"]
        for other in bpy.data.objects:
            if other.get("seked_footprint") in model["replaces"]:
                other.hide_set(True)
                other.hide_render = True
        print(f"stand-in {name}: {len(obj.data.polygons)} faces, scale {done['scale']:.3f}, turned {done['turn_deg']:.2f} deg, "
              f"{done['length_m']:.1f} m long on {', '.join(model['replaces'])}; stands {done['height_m']:.1f} m against OSM's "
              f"{done['osm_height_m']:.1f} m. {model['license']}: {model['author']}")
        built.append(obj)
    return built


# --- The Sphinx's enclosure ------------------------------------------------
#
# The Sphinx was carved by quarrying the bedrock away around it, and it lies in
# the hollow that left, open to the east where its temple stands. The ground
# grid is GLO-30 at twenty metres, which smooths that hollow away and lets the
# rock to its west rise up its flanks. This cuts the hollow back at render time:
# a box around the OSM outlines of the Sphinx, with a corridor of stated width
# on the north, south and west and open well past the paws to the east, floored
# at the lowest base the outlines carry. The corridor widths are look choices
# read off photographs of the enclosure, not measurements, and are printed as
# such; the walls take the quarried bedrock material. Nothing here changes the .blend or the viewer's ground.

ENCLOSURE_MARGIN_M = {"north": 9.0, "south": 14.0, "west": 12.0, "east": 60.0}
ENCLOSURE_FOOTPRINTS = ("sphinx.body", "sphinx.head", "sphinx.paws")


def cut_enclosure(scene):
    """The hollow the Sphinx lies in, cut out of the ground grid; returns the cutter, or None."""
    features = [f for f in (load_footprints() or {}).get("features", []) if f["id"] in ENCLOSURE_FOOTPRINTS]
    ground = bpy.data.objects.get("Terrain (ground)")
    if not features or ground is None:
        print("enclosure: no Sphinx outlines or no ground grid, so nothing is cut")
        return None
    points = [pt for f in features for pt in (f["ring"] if isinstance(f["ring"][0][0], (int, float)) else f["ring"][0])]
    west = min(p[0] for p in points) - ENCLOSURE_MARGIN_M["west"]
    east = max(p[0] for p in points) + ENCLOSURE_MARGIN_M["east"]
    south = min(p[1] for p in points) - ENCLOSURE_MARGIN_M["south"]
    north = max(p[1] for p in points) + ENCLOSURE_MARGIN_M["north"]
    floor = min(f["base"] for f in features)
    top = floor + 80.0

    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = west if v.co.x < 0 else east
        v.co.y = south if v.co.y < 0 else north
        v.co.z = floor if v.co.z < 0 else top
    mesh = bpy.data.meshes.new("Sphinx enclosure (cutter)")
    bm.to_mesh(mesh)
    bm.free()
    cutter = bpy.data.objects.new(mesh.name, mesh)
    scene.collection.objects.link(cutter)
    cutter.data.materials.append(bedrock_material())
    cutter.hide_render = True
    cutter.hide_set(True)

    mod = ground.modifiers.new("Sphinx enclosure", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    mod.object = cutter
    if hasattr(mod, "material_mode"):
        mod.material_mode = "TRANSFER"
    if not any(m.name == bedrock_material().name for m in ground.data.materials):
        ground.data.materials.append(bedrock_material())
    print(f"enclosure: cut {east - west:.0f} by {north - south:.0f} m to {floor:.2f} m around the Sphinx's outlines, "
          f"corridors {ENCLOSURE_MARGIN_M} m (look choices, not measurements), walls in the quarried bedrock")
    return cutter
