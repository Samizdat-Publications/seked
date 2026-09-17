"""
A whole-plateau reconstruction for the as-built state, registered onto the survey.

The as-built plateau needs what no survey gives: the temples roofed, the
causeways covered, the enclosure walls, the harbour basins, the cased queens'
pyramids and the mastaba streets as they were finished. blender/models.json
names a third-party model of all of that under `reconstructions`; this module
places it at render time and never writes it into the .blend or the viewer.

Registration uses only the three great pyramids, as the footprint import does.
The model's own pyramids are found by the object names the manifest lists, the
centre of each is paired with the centre of this scene's surveyed pyramid, and
a least-squares similarity in plan (scale, turn, shift, no reflection) carries
the model onto the survey, with its heights put on Khufu's base. The fit and its
three residuals are printed. The model's pyramids are then dropped, because the
database's are the ones the claims test, and so are its ground, its rock and
anything the manifest names, such as its Sphinx when a stand-in Sphinx is shown.

The model stood on a ground of its own, so after the fit each kept part is
draped onto this scene's ground: the model's ground height under it is found by
casting down onto the model's own ground meshes, this scene's by casting onto
"Terrain (ground)", and the part is moved by the difference. Small parts move
whole; a part longer than DRAPE_WHOLE_M, such as a causeway, is draped vertex by
vertex so it follows the ground along its length. The model's forms are a
reconstructor's, not measurements, and every part keeps a custom property
saying whose they are.
"""
import json
import math
import os

import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MANIFEST = os.path.join(HERE, "models.json")
MODELS = os.path.join(ROOT, "build", "models")

DRAPE_WHOLE_M = 40.0
DRAPE_LOW_RATIO = 0.15
LABELS = {"g1": "G1 Khufu", "g2": "G2 Khafre", "g3": "G3 Menkaure"}


def reconstructions(state):
    """The manifest's reconstructions that belong to this state."""
    manifest = json.load(open(MANIFEST, encoding="utf-8"))
    return [r for r in manifest.get("reconstructions", []) if not r.get("retired") and state in r.get("states", [])]


def world_bounds(objs):
    points = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return lo, hi


def similarity(src, dst):
    """The least-squares scale, turn and shift carrying 2-D points `src` onto `dst` (Umeyama), and the residuals."""
    n = len(src)
    ms = [sum(p[i] for p in src) / n for i in (0, 1)]
    md = [sum(p[i] for p in dst) / n for i in (0, 1)]
    a = b = ss = 0.0
    for (sx, sy), (dx, dy) in zip(src, dst):
        sx, sy, dx, dy = sx - ms[0], sy - ms[1], dx - md[0], dy - md[1]
        a += sx * dx + sy * dy
        b += sx * dy - sy * dx
        ss += sx * sx + sy * sy
    turn = math.atan2(b, a)
    scale = math.hypot(a, b) / ss
    residuals = []
    for (sx, sy), (dx, dy) in zip(src, dst):
        rx = scale * (math.cos(turn) * (sx - ms[0]) - math.sin(turn) * (sy - ms[1])) + md[0]
        ry = scale * (math.sin(turn) * (sx - ms[0]) + math.cos(turn) * (sy - ms[1])) + md[1]
        residuals.append(math.hypot(rx - dx, ry - dy))
    return scale, turn, ms, md, residuals


def bvh_of(objs):
    """One BVH over several meshes in world space, evaluated so modifiers such as the enclosure cut count."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    verts, polys = [], []
    for obj in objs:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        offset = len(verts)
        verts.extend(obj.matrix_world @ v.co for v in mesh.vertices)
        polys.extend([offset + i for i in p.vertices] for p in mesh.polygons)
        evaluated.to_mesh_clear()
    return BVHTree.FromPolygons(verts, polys) if polys else None


def ground_at(tree, x, y):
    """The highest surface of `tree` under a plan point, or None."""
    if tree is None:
        return None
    hit = tree.ray_cast(Vector((x, y, 5000.0)), Vector((0.0, 0.0, -1.0)))
    return None if hit[0] is None else hit[0].z


def drape(obj, theirs, ours):
    """Move a part from the model's ground onto this scene's: whole if it is small, vertex by vertex if it is long."""
    lo, hi = world_bounds([obj])
    centre = (lo + hi) / 2
    extent = max(hi.x - lo.x, hi.y - lo.y)
    # Only a low, spread-out part (a wall, a causeway, a temple's floor) follows the
    # ground vertex by vertex; anything with height to it, like a queen's pyramid,
    # moves whole so its form is not bent.
    if extent <= DRAPE_WHOLE_M or (hi.z - lo.z) > DRAPE_LOW_RATIO * extent or obj.data.users > 1:
        a, b = ground_at(theirs, centre.x, centre.y), ground_at(ours, centre.x, centre.y)
        if a is not None and b is not None:
            obj.matrix_world = Matrix.Translation((0.0, 0.0, b - a)) @ obj.matrix_world
        return "whole"
    inverse = obj.matrix_world.inverted()
    for v in obj.data.vertices:
        w = obj.matrix_world @ v.co
        a, b = ground_at(theirs, w.x, w.y), ground_at(ours, w.x, w.y)
        if a is not None and b is not None:
            v.co = inverse @ Vector((w.x, w.y, w.z + b - a))
    obj.data.update()
    return "draped"


def build_reconstructions(scene, state, standin_sphinx=True):
    """Every reconstruction for this state, registered, pruned and draped; the plateau's own massings hidden. Returns the parts kept."""
    kept = []
    for recon in reconstructions(state):
        path = os.path.join(MODELS, recon["id"], "model.glb")
        if not os.path.exists(path):
            print(f"reconstruction {recon['id']}: not downloaded; run python scripts/models.py")
            continue
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=path)
        new = [o for o in bpy.data.objects if o not in before]
        meshes = [o for o in new if o.type == "MESH"]

        src, dst, base_src, base_dst = [], [], None, None
        for structure, names in recon["pyramids"].items():
            parts = [bpy.data.objects[n] for n in names if n in bpy.data.objects]
            ours = bpy.data.objects.get(f"{LABELS[structure]} (as built)")
            if not parts or ours is None:
                continue
            lo, hi = world_bounds(parts)
            src.append(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2))
            dst.append((ours.location.x, ours.location.y))
            if structure == "g1":
                base_src, base_dst = lo.z, ours.location.z
        if len(src) < 3 or base_src is None:
            print(f"reconstruction {recon['id']}: its three pyramids were not all found, so it is not placed")
            for o in new:
                bpy.data.objects.remove(o, do_unlink=True)
            continue
        scale, turn, ms, md, residuals = similarity(src, dst)
        fit = (Matrix.Translation((md[0], md[1], base_dst)) @ Matrix.Rotation(turn, 4, "Z") @ Matrix.Scale(scale, 4)
               @ Matrix.Translation((-ms[0], -ms[1], -base_src)))
        for o in new:
            if o.parent is None:
                o.matrix_world = fit @ o.matrix_world
        bpy.context.view_layer.update()

        pyramid_parts = {n for names in recon["pyramids"].values() for n in names}
        ground_materials = set(recon.get("ground_materials", []))
        surface_materials = set(recon.get("surface_materials", []))
        drop_materials = set(recon.get("drop_materials", []))
        drop_prefixes = tuple(recon.get("drop_material_prefixes_with_standin_sphinx", [])) if standin_sphinx else ()
        grounds, parts = [], []
        for o in meshes:
            materials = {m.name for m in o.data.materials if m}
            if o.name in pyramid_parts:
                o.hide_render = True
                continue
            if materials and materials <= ground_materials:
                # Only the model's walked surface is its ground for draping; its plinth
                # sides and rock outcrops are hidden but would lift every cast.
                if materials <= surface_materials:
                    grounds.append(o)
                o.hide_render = True
                continue
            if (materials and materials <= drop_materials) or (drop_prefixes and materials and all(m.startswith(drop_prefixes) for m in materials)):
                o.hide_render = True
                continue
            parts.append(o)

        theirs, ours = bvh_of(grounds), bvh_of([bpy.data.objects["Terrain (ground)"]]) if "Terrain (ground)" in bpy.data.objects else None
        draped = sum(1 for o in parts if drape(o, theirs, ours) == "draped")
        for o in parts:
            o["seked_reconstruction"] = recon["attribution"]
        for o in bpy.data.objects:
            if o.get("seked_structure") == "plateau" and o.get("seked_group") in recon.get("replaces_groups", []):
                o.hide_render = True
                o.hide_set(True)
        print(f"reconstruction {recon['id']}: {scale:.3f} m per unit, turned {math.degrees(turn):.2f} deg, residuals at the three pyramids "
              f"{', '.join(f'{r:.1f}' for r in residuals)} m; kept {len(parts)} of {len(meshes)} parts, {draped} draped vertex by vertex, "
              f"onto this scene's ground; hid the footprint massings of {', '.join(recon.get('replaces_groups', []))}. {recon['attribution']}")
        kept.extend(parts)
    return kept
