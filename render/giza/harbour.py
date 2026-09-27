"""
The harbour in front of the valley temples as built: a quay of dressed limestone along
the basin's west edge, and boats on the inundation.

The quay stands on the easternmost of the valley temples' east faces (the old viewer's
stage 7 found the westernmost runs a wall through Khafre's valley temple). Its line,
height and the boats are look choices; so is everything about the boats' form, after
the Old Kingdom's timber hulls with raised papyriform ends, a deck cabin, and a mast
with its sail furled.
"""
import math

import bmesh
import bpy
from mathutils import Vector

from . import data, states
from .instancing import Field
from .variants import N_DRESSED
from .walls import simplify

QUAY_TOP_ABOVE_WATER = 1.2
# The basin the quay faces, dug below the valley floor with sloping banks: the ground here
# stands at -42 to -43 m, only a narrow channel below the water. Its size is a look choice
# after the harbour basins proposed in front of the valley temples (Lehner; Sheisha et al.
# 2022 on the Khufu branch of the Nile).
BASIN = dict(x1=640.0, y0=-600.0, y1=-395.0, floor=-45.6, bank=28.0)
BOATS = [  # (x, y, heading degrees from east, length m)
    (452.0, -468.0, 95.0, 24.0), (470.0, -505.0, 80.0, 18.0), (438.0, -540.0, 110.0, 30.0),
    (542.0, -440.0, 60.0, 16.0), (520.0, -520.0, 100.0, 22.0), (480.0, -575.0, 88.0, 14.0),
]


ROYAL_LENGTH = 20.0     # boats this long are drawn as royal barques after Khufu's ship, when it is on disk
DRAUGHT = 0.05          # the water line over the model's lowest point, as a share of its length: it sinks the museum stand Meshy kept under the keel


def _east_edge():
    xs = []
    for f in data.FOOTPRINTS:
        if f["id"] in ("khafre.valley_temple", "sphinx.temple"):
            xs.append(max(p[0] for p in simplify(f["ring"])))
    return max(xs) + 1.5


def basins(state):
    """The harbour basin for the terrain to dig, in an era that has the harbour."""
    if states.spec(state)["water"] != "harbour":
        return []
    b = BASIN
    return [(_east_edge(), b["x1"], b["y0"], b["y1"], b["floor"], b["bank"])]


def _boat(length, rng):
    """A timber hull with raised ends, a cabin and a mast, as one mesh with three materials."""
    bm = bmesh.new()
    n = 24
    beam = length * 0.18
    depth = length * 0.07
    rings = []
    for i in range(n + 1):
        t = i / n
        x = (t - 0.5) * length
        w = beam * math.sin(math.pi * t) ** 0.65 * 0.5
        sheer = depth * (0.6 + 2.2 * abs(2 * t - 1) ** 3)       # the ends rise
        keel = -depth * 0.7 * math.sin(math.pi * t) ** 0.5
        ring = [bm.verts.new((x, -w, sheer)), bm.verts.new((x, -w * 0.8, keel * 0.6)), bm.verts.new((x, 0.0, keel)),
                bm.verts.new((x, w * 0.8, keel * 0.6)), bm.verts.new((x, w, sheer))]
        rings.append(ring)
    for i in range(n):
        for j in range(4):
            bm.faces.new((rings[i][j], rings[i + 1][j], rings[i + 1][j + 1], rings[i][j + 1]))
    # Deck.
    for i in range(n):
        try:
            bm.faces.new((rings[i][0], rings[i][4], rings[i + 1][4], rings[i + 1][0]))
        except ValueError:
            pass
    hull_faces = len(bm.faces)
    # Cabin amidships, a little aft.
    cab = bmesh.ops.create_cube(bm, size=1.0)
    for v in cab["verts"]:
        v.co = Vector((v.co.x * length * 0.22 - length * 0.08, v.co.y * beam * 0.6, v.co.z * depth * 1.4 + depth * 1.3))
    cabin_faces = len(bm.faces)
    # Mast and yard with the sail furled on it.
    mast = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.12, radius2=0.08, depth=length * 0.45)
    for v in mast["verts"]:
        v.co += Vector((length * 0.08, 0.0, depth + length * 0.225))
    yard = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.35, radius2=0.35, depth=length * 0.32)
    for v in yard["verts"]:
        v.co = Vector((length * 0.08, v.co.z, v.co.x + depth + length * 0.42))
    me = bpy.data.meshes.new("boat")
    bm.to_mesh(me)
    bm.free()
    for k, poly in enumerate(me.polygons):
        poly.material_index = 0 if k < hull_faces else (1 if k < cabin_faces else 2)
    me.shade_smooth()
    return me


def ship_model(log=print):
    """
    The royal barque after Khufu's ship (blender/models.json `props`, generated with Meshy):
    one mesh lying along +X, a metre long, centred, its keel on z = 0, parked out of sight so
    only its copies render. None when it is not on disk (python scripts/meshy.py generate khufu-ship).
    """
    import io
    import json
    import os
    import sys

    import numpy as np
    from mathutils import Matrix

    index_path = os.path.join(data.REPO, "build", "models", "index.json")
    if not os.path.exists(index_path):
        return None
    index = json.load(io.open(index_path, encoding="utf-8"))
    entry = index.get("models", index).get("khufu-ship")
    path = os.path.join(data.REPO, "build", "models", entry["file"]) if entry else None
    if not path or not os.path.exists(path):
        log("harbour: the Khufu ship is not on disk; procedural hulls only")
        return None
    blender_dir = os.path.join(data.REPO, "blender")
    if blender_dir not in sys.path:
        sys.path.insert(0, blender_dir)
    import render_standins as rs   # the old renderer's importer, which runs inside Blender

    obj = rs.cut_and_reduce(rs.import_model(path, "khufu ship", keep_materials=True), None, 90000)
    me = obj.data
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    # Lay its long axis along +X.
    xy = co[:, :2] - co[:, :2].mean(0)
    _, vecs = np.linalg.eigh(np.cov(xy.T))
    ax = vecs[:, 1]
    me.transform(Matrix.Rotation(-math.atan2(ax[1], ax[0]), 4, "Z"))
    me.vertices.foreach_get("co", co.ravel())
    lo, hi = co.min(0), co.max(0)
    length = float(hi[0] - lo[0])
    me.transform(Matrix.Scale(1.0 / length, 4) @ Matrix.Translation((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2])))
    me.update()
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    obj["seked"] = "stand-in: a royal barque after Khufu's ship, generated by Meshy from a photograph of its museum model"
    log(f"harbour: Khufu ship model, {len(me.polygons):,} faces, {(hi[2] - lo[2]) / length:.3f} of its length high")
    return obj


def boat_materials():
    def principled(name, rgb, rough):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        b = mat.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = rgb
        b.inputs["Roughness"].default_value = rough
        return mat
    return (principled("boat hull", (0.19, 0.11, 0.06, 1.0), 0.6), principled("boat cabin", (0.62, 0.52, 0.36, 1.0), 0.8),
            principled("boat mast and sail", (0.78, 0.72, 0.6, 1.0), 0.85))


def _raft(length, width, bundles=7, rings=40, sides=8):
    """A papyrus raft: reed bundles side by side, tapering and rising at both ends, bound every so often."""
    bm = bmesh.new()
    r0 = width / bundles / 2 * 1.08
    for b in range(bundles):
        yoff = (b - (bundles - 1) / 2) * width / bundles
        loops = []
        for i in range(rings + 1):
            s = 2.0 * i / rings - 1.0                        # -1 at the stern, +1 at the bow
            x = s * length / 2
            rad = r0 * (1.0 - 0.75 * abs(s) ** 5) * (1.0 - 0.18 * (abs(yoff) / (width / 2)) ** 2)
            z = 0.55 * abs(s) ** 4 + r0                      # the ends rise out of the water
            y = yoff * (1.0 - 0.55 * abs(s) ** 3)            # and the bundles gather towards them
            loops.append([bm.verts.new((x, y + rad * math.cos(2 * math.pi * k / sides),
                                        z + rad * math.sin(2 * math.pi * k / sides))) for k in range(sides)])
        for i in range(rings):
            for k in range(sides):
                k2 = (k + 1) % sides
                bm.faces.new((loops[i][k], loops[i][k2], loops[i + 1][k2], loops[i + 1][k]))
    me = bpy.data.meshes.new("raft")
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    return me, 2 * r0


def papyrus_material(name="papyrus"):
    """Dry papyrus stems bundled lengthwise, lashed with darker cord every 60 cm."""
    from .nodes import Tree, hexlin
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    tc = t.node("ShaderNodeTexCoord")
    stretch = t.node("ShaderNodeMapping")
    stretch.inputs["Scale"].default_value = (0.15, 9.0, 9.0)          # fibres run along the raft
    t.link(tc.outputs["Object"], stretch.inputs["Vector"])
    col = t.ramp(t.noise(stretch.outputs[0], 6.0, 6.0, 0.7), [(0.25, hexlin("9d8350")), (0.75, hexlin("c9b27a"))])
    band = t.node("ShaderNodeTexWave")
    band.wave_type = "BANDS"
    band.bands_direction = "X"
    band.inputs["Scale"].default_value = 1.0
    band.inputs["Distortion"].default_value = 0.0
    t.link(tc.outputs["Object"], band.inputs["Vector"])
    cord = t.band(band.outputs["Fac"], 0.93, 0.98)
    col = t.mix(cord, col, hexlin("4a3721"))
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.85
    return mat


def float_raft(state, at, spec, coll, log=print, eye=1.55):
    """
    A papyrus raft under a station that stands on open water in this era, lying along the
    heading the station looks; returns the eye's height standing on it, or None where the
    era has no water to float it on. Its form is a look choice, after the reed floats of
    Old Kingdom marsh scenes.
    """
    from .water import LEVELS
    kind = states.spec(state)["water"]
    if not kind:
        return None
    water_z = LEVELS[kind][0]
    length, width = spec.get("length", 5.5), spec.get("width", 1.7)
    me, deck = _raft(length, width)
    me.materials.append(papyrus_material())
    ob = bpy.data.objects.new("raft under the station", me)
    coll.objects.link(ob)
    draught = 0.4 * deck
    ob.location = (at[0], at[1], water_z - draught)
    ob.rotation_euler = (0.0, 0.0, math.radians(spec.get("heading", 180.0)))
    log(f"raft: {length} m of papyrus under the station on the {kind} at {water_z} m")
    return water_z - draught + deck + eye


def build(state, rng, terrain, coll, mats, lib, log=print):
    if states.spec(state)["water"] != "harbour":
        return
    from .water import LEVELS
    water_z = LEVELS["harbour"][0]
    x = _east_edge()
    y0, y1 = -545.0, -400.0
    # The quay: dressed courses from below the water up past it, a stretch at a time along the basin's edge.
    blocks = Field()
    course = 0.9
    top = water_z + QUAY_TOP_ABOVE_WATER
    base = water_z - 2.0
    n = int(round((top - base) / course))
    # Each course breaks joint with the one below (stacked in columns they read as toy bricks).
    for k in range(n):
        yy = y0 - rng.uniform(0.0, 1.2)
        while yy < y1:
            bl = rng.uniform(1.2, 2.6)
            a, b = max(yy, y0), min(yy + bl, y1)
            if b - a > 0.4:
                blocks.add((x + 1.5, (a + b) / 2, base + k * course + course / 2), (0.0, 0.0, -0.5 * math.pi),
                           (b - a - 0.015, 3.0, course - 0.012), rng.randrange(2), rng.random(), rng.random() * 0.3)
            yy += bl
    from . import materials
    from .temples import DRESSED_BLOCK
    from .walls import battered_variants
    # The quay's stone: the temples' dressed limestone, darkened and greened where the inundation stands on
    # it and a band above where it rises and falls, dusty on top (look choices; it read as white toy blocks).
    if "quay stone" not in mats:
        mats["quay stone"] = materials.stone("quay stone", "tura_dressed", rough=0.75, tex_role="core", tex_amt=0.5, sand_tops=0.9,
                                             bump=0.35, wear_amt=0.3, stain=(water_z + 0.45, "5f5a44", 0.8),
                                             contact=dict(reach=1.0, dirt="7d6a4c", amount=0.5, arris=0.015))
    blocks.emit("quay", battered_variants(lib, "quay stone", mats["quay stone"], **DRESSED_BLOCK), coll, log)
    hull, cabin, rig = boat_materials()
    ship = ship_model(log)
    barques = 0
    for bx, by, heading, length in BOATS:
        if ship is not None and length >= ROYAL_LENGTH:
            # The grandest boats moored here are royal barques like Khufu's, drawn a little deep in the water.
            ob = bpy.data.objects.new("royal barque", ship.data)
            coll.objects.link(ob)
            ob.scale = (length, length, length)
            ob.location = (bx, by, water_z - DRAUGHT * length)
            ob["seked"] = ship["seked"]
            barques += 1
        else:
            me = _boat(length, rng)
            for m in (hull, cabin, rig):
                me.materials.append(m)
            ob = bpy.data.objects.new("boat", me)
            coll.objects.link(ob)
            ob.location = (bx, by, water_z + 0.05)
        ob.rotation_euler = (0.0, 0.0, math.radians(heading))
    log(f"harbour: quay at x {x:.0f} from y {y0:.0f} to {y1:.0f}, {len(BOATS)} boats, {barques} of them royal barques")
