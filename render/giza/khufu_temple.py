"""
Khufu's mortuary temple, on the rock bed of its basalt pavement.

The pavement's four corners are Petrie's (section 28, data/measurements/giza-temples.json,
g1.basalt_pavement.corner.*), measured north of Khufu's east-west axis and east of his
east base. Today the black basalt floor is most of what is left. As built it is the floor
of a court ringed with square granite pillars inside dressed limestone walls; the walls'
height, the pillars' pitch and the temple's reach beyond the pavement are look choices,
after the reconstructions of Lauer and Lehner.
"""
import math

import bpy

from . import data, states
from .instancing import Field
from .nodes import Tree, hexlin
from .variants import N_DRESSED
from .walls import lay_ring

WALL = 2.6          # look choices: wall thickness, height, pillar pitch and side
HEIGHT = 8.0
PILLAR_PITCH = 3.2
PILLAR_SIDE = 1.0


def pavement_corners():
    r = {rec["key"]: rec["value"] for rec in data.records("giza-temples.json")}
    east = data.PYRAMIDS["g1"]["half"]
    out = []
    for c in ("ne", "se", "sw", "nw"):
        out.append((east + r[f"g1.basalt_pavement.corner.{c}.beyond_east_base"], r[f"g1.basalt_pavement.corner.{c}.north"]))
    return out, r["g1.basalt_pavement.thickness"]


def flats(state):
    """The ground levelled under the temple, so the terrain's relief cannot rise through the basalt."""
    if states.spec(state)["pyramids"] not in ("today", "stripped", "dressed"):
        return []
    corners, _ = pavement_corners()
    xs = [c[0] for c in corners]
    ys = [c[1] for c in corners]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    return [(cx, cy, (max(xs) - min(xs)) / 2 + WALL + 4.0, (max(ys) - min(ys)) / 2 + WALL, data.PYRAMIDS["g1"]["base"])]


def basalt_material():
    """
    Khufu's basalt floor: slabs of irregular outline fitted tight, the joints dark hairlines, sand
    blown into them and lying in drifts over the floor, the stone dulled in patches and polished
    by feet elsewhere (look choices; critic round 5 read a regular grid with bright grout as tile).
    """
    mat = bpy.data.materials.new("basalt")
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    slabs = t.node("ShaderNodeTexVoronoi")
    slabs.feature = "DISTANCE_TO_EDGE"
    slabs.inputs["Scale"].default_value = 0.8
    t.link(pos, slabs.inputs["Vector"])
    tone = t.node("ShaderNodeTexVoronoi")
    tone.inputs["Scale"].default_value = 0.8
    t.link(pos, tone.inputs["Vector"])
    joint = t.math("SUBTRACT", 1.0, t.band(slabs.outputs["Distance"], 0.0, 0.006))
    base = t.ramp(tone.outputs["Distance"], [(0.0, hexlin("2c2a27")), (0.6, hexlin("35322e")), (1.0, hexlin("2a2724"))])
    base = t.mix(1.0, base, t.ramp(t.noise(pos, 3.0, 4.0), [(0.3, hexlin("d8d8d8")), (0.7, hexlin("ffffff"))]), "MULTIPLY")
    sand = t.band(t.noise(pos, 0.15, 4.0, 0.6), 0.55, 0.78)
    col = t.mix(t.math("MULTIPLY", sand, 0.55), base, hexlin("a8916c"))
    col = t.mix(t.math("MULTIPLY", joint, 0.7), col, hexlin("1c1a18"))
    t.link(col, bsdf.inputs["Base Color"])
    t.link(t.math("ADD", 0.32, t.math("MULTIPLY", t.math("ADD", sand, t.band(t.noise(pos, 0.5, 2.0), 0.4, 0.7)), 0.3)),
           bsdf.inputs["Roughness"])
    return mat


def build(state, rng, coll, mats, lib, log=print):
    S = states.spec(state)
    if S["pyramids"] not in ("today", "stripped", "dressed"):
        return
    corners, thick = pavement_corners()
    z = data.PYRAMIDS["g1"]["base"]
    verts = [(x, y, z + thick) for x, y in corners] + [(x, y, z - 0.4) for x, y in corners]
    faces = [(0, 1, 2, 3)[::-1], (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    me = bpy.data.meshes.new("Khufu's basalt pavement")
    me.from_pydata(verts, [], faces)
    me.materials.append(basalt_material())
    ob = bpy.data.objects.new("Khufu's basalt pavement", me)
    coll.objects.link(ob)
    if S["pyramids"] != "dressed":
        log("Khufu's mortuary temple: the basalt pavement")
        return
    xs = [c[0] for c in corners]
    ys = [c[1] for c in corners]
    x0, x1, y0, y1 = min(xs) - WALL, max(xs) + WALL + 4.0, min(ys) - WALL, max(ys) + WALL
    ring = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    walls = Field()
    laid = lay_ring(ring, z + thick, HEIGHT, rng, walls, course=1.0, length=2.0, depth=WALL, batter_deg=84.0, miss=0.0,
                    variants=N_DRESSED, openings=[(x1, 0.0, 4.0, 5.0), (x0, 0.0, 6.0, 6.0)], joint=0.02, erosion_jitter=False)
    walls.emit("Khufu's mortuary temple walls", lib["dressed limestone"], coll, log)
    pillars = Field()
    inner = (min(xs) + 3.0, max(xs) - 3.0, min(ys) + 3.0, max(ys) - 3.0)
    n_x = int((inner[1] - inner[0]) / PILLAR_PITCH)
    n_y = int((inner[3] - inner[2]) / PILLAR_PITCH)
    for i in range(n_x + 1):
        for j in range(n_y + 1):
            if 0 < i < n_x and 0 < j < n_y:
                continue          # a colonnade round the court, not a grid across it
            px = inner[0] + i * (inner[1] - inner[0]) / n_x
            py = inner[2] + j * (inner[3] - inner[2]) / n_y
            pillars.add((px, py, z + thick + (HEIGHT - 1.0) / 2), (0.0, 0.0, 0.0), (PILLAR_SIDE, PILLAR_SIDE, HEIGHT - 1.0),
                        rng.randrange(N_DRESSED), rng.random(), 0.0)
    pillars.emit("Khufu's mortuary temple pillars", lib["dressed granite"], coll, log)
    # The colonnade carries granite architraves, and a limestone roof spans from them to the walls, so
    # the court is an open square ringed by a shaded walk (look choices after Lauer's reconstruction).
    top = z + thick + HEIGHT - 1.0
    beam = 1.0
    ax0, ax1, ay0, ay1 = inner[0] - PILLAR_SIDE / 2, inner[1] + PILLAR_SIDE / 2, inner[2] - PILLAR_SIDE / 2, inner[3] + PILLAR_SIDE / 2
    for (cx, cy, sx, sy) in (((ax0 + ax1) / 2, ay0 + PILLAR_SIDE / 2, ax1 - ax0, PILLAR_SIDE),
                             ((ax0 + ax1) / 2, ay1 - PILLAR_SIDE / 2, ax1 - ax0, PILLAR_SIDE),
                             (ax0 + PILLAR_SIDE / 2, (ay0 + ay1) / 2, PILLAR_SIDE, ay1 - ay0),
                             (ax1 - PILLAR_SIDE / 2, (ay0 + ay1) / 2, PILLAR_SIDE, ay1 - ay0)):
        _box("Khufu's mortuary temple architrave", (cx, cy, top + beam / 2), (sx, sy, beam), mats["dressed granite"], coll)
    slab = 0.8
    rz = top + beam + slab / 2
    px0, px1, py0, py1 = min(xs), max(xs), min(ys), max(ys)
    for (cx, cy, sx, sy) in (((px0 + px1) / 2, (py0 + ay0 + PILLAR_SIDE) / 2, px1 - px0, ay0 + PILLAR_SIDE - py0),
                             ((px0 + px1) / 2, (ay1 - PILLAR_SIDE + py1) / 2, px1 - px0, py1 - ay1 + PILLAR_SIDE),
                             ((px0 + ax0 + PILLAR_SIDE) / 2, (ay0 + ay1) / 2, ax0 + PILLAR_SIDE - px0, ay1 - ay0),
                             ((ax1 - PILLAR_SIDE + px1) / 2, (ay0 + ay1) / 2, px1 - ax1 + PILLAR_SIDE, ay1 - ay0)):
        _box("Khufu's mortuary temple roof", (cx, cy, rz), (sx, sy, slab), mats["limestone flat"], coll)
    log(f"Khufu's mortuary temple: {laid} wall blocks and a roofed colonnade round the basalt court")


def _box(name, centre, size, mat, coll):
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    ob.location = centre
    ob.scale = size
    bev = ob.modifiers.new("arris", "BEVEL")
    bev.width = 0.03
    return ob
