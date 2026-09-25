"""
The Wall of the Crow (Heit el-Ghurab), the great limestone wall at the plateau's south-east
foot between the necropolis and the pyramid builders' town.

Its line is OpenStreetMap's (data/footprints/giza.json, `wall_of_the_crow`, traced as the
wall's crest), its height tier3.wall_of_the_crow.height. The ten metres of thickness at
the base, the batter, the block sizes and the gateway through its middle, seven metres
high under three lintels, are look choices after Lehner's descriptions. As built it stands
whole; after it, broken along the top with its fill showing. It belongs to the Fourth
Dynasty, so the claim eras do not have it.
"""
import math

import bmesh
import bpy
import numpy as np

from . import data, states
from .instancing import Field
from .walls import lay_ring

THICKNESS = 10.0          # look choices
BATTER_DEG = 78.0
GATE_WIDTH = 2.6
GATE_HEIGHT = 7.0
FACING = 1.8


def centreline():
    f = next(f for f in data.FOOTPRINTS if f["id"] == "wall_of_the_crow")
    pts = [tuple(p[:2]) for p in f["ring"]]
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    return pts


def height():
    return {r["key"]: r["value"] for r in data.records("tier3.json")}["tier3.wall_of_the_crow.height"]


def _offset(line, d):
    """The polyline moved sideways by d (left of its direction), mitred at the joints."""
    p = np.asarray(line, dtype=np.float64)
    out = []
    for i in range(len(p)):
        e0 = p[i] - p[i - 1] if i > 0 else p[1] - p[0]
        e1 = p[i + 1] - p[i] if i < len(p) - 1 else p[-1] - p[-2]
        n0 = np.array([-e0[1], e0[0]]) / np.linalg.norm(e0)
        n1 = np.array([-e1[1], e1[0]]) / np.linalg.norm(e1)
        m = (n0 + n1) / np.linalg.norm(n0 + n1)
        out.append(tuple(p[i] + m * d / max(0.5, float(np.dot(m, n1)))))
    return out


def _at(line, s):
    """The point and the unit direction at distance s along the polyline."""
    for (ax, ay), (bx, by) in zip(line, line[1:]):
        L = math.hypot(bx - ax, by - ay)
        if s <= L:
            return (ax + (bx - ax) * s / L, ay + (by - ay) * s / L), ((bx - ax) / L, (by - ay) / L)
        s -= L
    (ax, ay), (bx, by) = line[-2], line[-1]
    L = math.hypot(bx - ax, by - ay)
    return (bx, by), ((bx - ax) / L, (by - ay) / L)


def _core(line, base, top, half_bottom, half_top, s_cut, cut_half, coll, material):
    """The fill between the facings as a battered prism along the line, open where the gate passes."""
    total = sum(math.hypot(bx - ax, by - ay) for (ax, ay), (bx, by) in zip(line, line[1:]))
    bm = bmesh.new()
    for s0, s1 in ((0.0, s_cut - cut_half), (s_cut + cut_half, total)):
        n = max(2, int((s1 - s0) / 6.0) + 1)
        rings = []
        for i in range(n):
            (x, y), (dx, dy) = _at(line, s0 + (s1 - s0) * i / (n - 1))
            nx, ny = -dy, dx
            rings.append([bm.verts.new((x + nx * w, y + ny * w, z)) for w, z in
                          ((-half_bottom, base), (-half_top, top), (half_top, top), (half_bottom, base))])
        for i in range(n - 1):
            for j in range(3):
                bm.faces.new((rings[i][j], rings[i][j + 1], rings[i + 1][j + 1], rings[i + 1][j]))
        bm.faces.new(rings[0])
        bm.faces.new(list(reversed(rings[-1])))
    me = bpy.data.meshes.new("Wall of the Crow fill")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    ob = bpy.data.objects.new("Wall of the Crow fill", me)
    coll.objects.link(ob)


def build(state, rng, terrain, coll, mats, lib, log=print):
    S = states.spec(state)
    if S["pyramids"] not in ("dressed", "stripped", "today"):
        return
    line = centreline()
    H = height()
    total = sum(math.hypot(bx - ax, by - ay) for (ax, ay), (bx, by) in zip(line, line[1:]))
    xs = np.linspace(line[0][0], line[-1][0], 40)
    ys = np.linspace(line[0][1], line[-1][1], 40)
    base = float(np.min(terrain.surface(xs, ys))) - 0.4
    left, right = _offset(line, THICKNESS / 2), _offset(line, -THICKNESS / 2)
    ring = left + right[::-1]
    (gx, gy), (dx, dy) = _at(line, total / 2)
    nx, ny = -dy, dx
    gates = [(gx + nx * THICKNESS / 2, gy + ny * THICKNESS / 2, GATE_WIDTH, GATE_HEIGHT),
             (gx - nx * THICKNESS / 2, gy - ny * THICKNESS / 2, GATE_WIDTH, GATE_HEIGHT)]
    whole = S["pyramids"] == "dressed"
    blocks = Field()
    laid = lay_ring(ring, base, H, rng, blocks, course=1.0, length=2.6, depth=FACING, batter_deg=BATTER_DEG,
                    ruin=None if whole else (0.6, 1.0), miss=0.0 if whole else 0.05, seed=3.0,
                    openings=gates, joint=0.04, erosion_jitter=not whole)
    blocks.emit("Wall of the Crow", lib["core fresh" if whole else "core"], coll, log)
    inset = math.tan(math.radians(90.0 - BATTER_DEG))
    top = base + (H if whole else 0.6 * H)
    half_bottom = THICKNESS / 2 - FACING
    half_top = half_bottom - (top - base) * inset
    _core(line, base, top - 0.05, half_bottom, half_top, total / 2, GATE_WIDTH / 2, coll, mats["core behind"])
    # Three lintels roof the gateway through the wall's thickness.
    lintels = Field()
    yaw = math.atan2(dy, dx)
    for k in (-1, 0, 1):
        cx, cy = gx + nx * k * THICKNESS / 3, gy + ny * k * THICKNESS / 3
        lintels.add((cx, cy, base + GATE_HEIGHT + 0.55), (0.0, 0.0, yaw), (GATE_WIDTH + 1.6, THICKNESS / 3 - 0.06, 1.1),
                    rng.randrange(4), rng.random(), rng.random() * 0.2)
    lintels.emit("Wall of the Crow lintels", lib["core fresh" if whole else "core"], coll, log)
    log(f"Wall of the Crow: {total:.0f} m long, {H} m high, {laid} facing blocks, the gate {GATE_WIDTH} x {GATE_HEIGHT} m"
        f"{'' if whole else ', broken along its top'}")
