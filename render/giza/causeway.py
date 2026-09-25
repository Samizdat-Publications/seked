"""
Khafre's causeway, from the valley temple up to the mortuary temple.

The line is OSM's outline (data/footprints/giza.json, khafre.causeway), reduced to a
centreline by binning its points along its long axis; the width is Petrie's 4.572 m
(section 95, data/measurements/giza-temples.json). Today it is a ramp of rubble and
broken paving with a few blocks of its walls; as built it is a roofed corridor of
white limestone (data/materials.json), 4.5 m high inside
(data/measurements/pristine.json, tier3.causeway.corridor.height).
"""
import math

import bmesh
import bpy
import numpy as np

from . import data, states
from .instancing import Field
from .variants import N_CORE, N_DRESSED

WIDTH = {r["key"]: r["value"] for r in data.records("giza-temples.json")}["khafre.causeway.width"]
CORRIDOR = 4.5
WALL = 1.4          # look choice: the corridor walls' thickness
RAMP = 0.6          # look choice: how proud of the ground the ramp stands today


def centreline(step=6.0):
    f = next(f for f in data.FOOTPRINTS if f["id"] == "khafre.causeway")
    pts = np.array(f["ring"], dtype=np.float64)
    c = pts.mean(0)
    _, vecs = np.linalg.eigh(np.cov((pts - c).T))
    ax = vecs[:, 1]
    t = (pts - c) @ ax
    lo, hi = t.min(), t.max()
    line = []
    for s in np.arange(lo, hi + 0.01, step):
        near = np.abs(t - s) < step
        if near.sum() >= 2:
            line.append(pts[near].mean(0))
    line = np.array(line)
    # Smooth the binning's jitter.
    if len(line) > 4:
        k = np.array([0.25, 0.5, 0.25])
        line[1:-1, 0] = np.convolve(line[:, 0], k, mode="valid")
        line[1:-1, 1] = np.convolve(line[:, 1], k, mode="valid")
    return line


def _frames(line):
    d = np.gradient(line, axis=0)
    d /= np.linalg.norm(d, axis=1, keepdims=True)
    n = np.stack([-d[:, 1], d[:, 0]], 1)    # left of the line
    return d, n


def build(state, rng, terrain, coll, mats, lib, log=print):
    mode = states.spec(state)["causeway"]
    if not mode:
        return None
    line = centreline()
    d, n = _frames(line)
    z = terrain.z(line[:, 0], line[:, 1])
    today = mode == "ruin"
    bm = bmesh.new()
    half = WIDTH / 2
    # The road: a strip with sloped shoulders, draped on the ground.
    prof = [(-half - 2.5, -0.6), (-half, RAMP), (half, RAMP), (half + 2.5, -0.6)] if today else \
           [(-half - WALL, -0.4), (-half - WALL, 0.3), (half + WALL, 0.3), (half + WALL, -0.4)]
    rows = []
    for i in range(len(line)):
        rows.append([bm.verts.new((line[i, 0] + n[i, 0] * o, line[i, 1] + n[i, 1] * o, z[i] + h)) for o, h in prof])
    for i in range(len(line) - 1):
        for j in range(len(prof) - 1):
            bm.faces.new((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]))
    me = bpy.data.meshes.new("khafre causeway")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mats["core behind"] if today else mats["dressed"])
    ob = bpy.data.objects.new("khafre causeway", me)
    coll.objects.link(ob)
    if today:
        # What is left of its walls: a broken line of blocks along each edge.
        blocks = Field()
        s_total = 0.0
        for i in range(len(line) - 1):
            seg = np.linalg.norm(line[i + 1] - line[i])
            s = 0.0
            while s < seg:
                bl = rng.uniform(1.0, 2.2)
                for side in (-1, 1):
                    if rng.random() < 0.45:
                        continue
                    t = (s + bl / 2) / seg
                    p = line[i] + (line[i + 1] - line[i]) * t
                    zz = z[i] + (z[i + 1] - z[i]) * t
                    off = side * (half + 0.5)
                    hh = rng.uniform(0.5, 1.1)
                    yaw = math.atan2(d[i, 1], d[i, 0])
                    blocks.add((p[0] + n[i, 0] * off, p[1] + n[i, 1] * off, zz + RAMP + hh / 2 - 0.2),
                               (rng.gauss(0, 0.03), rng.gauss(0, 0.03), yaw + rng.gauss(0, 0.05)),
                               (bl - 0.08, 1.0, hh), rng.randrange(N_CORE), rng.random(), rng.random())
                s += bl
            s_total += seg
        blocks.emit("causeway blocks", lib["core"], coll, log)
        log(f"causeway: {s_total:.0f} m of ramp")
    else:
        # The corridor: dressed limestone walls laid in courses that step up the slope, roofed with
        # slabs laid across it, as the covered causeways of the Old Kingdom were.
        blocks, slabs = Field(), Field()
        course = 0.9
        n_courses = int(round((CORRIDOR + 0.3) / course))
        for i in range(len(line) - 1):
            p0, p1 = line[i], line[i + 1]
            seg = float(np.linalg.norm(p1 - p0))
            yaw = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
            s = 0.0
            while s < seg - 0.1:
                bl = min(rng.uniform(1.0, 1.8), seg - s)
                t = (s + bl / 2) / seg
                p = p0 + (p1 - p0) * t
                zz = z[i] + (z[i + 1] - z[i]) * t
                for side in (-1, 1):
                    off = side * (half + WALL / 2)
                    for k in range(n_courses):
                        hh = course - 0.02
                        blocks.add((p[0] + n[i, 0] * off, p[1] + n[i, 1] * off, zz + 0.3 + k * course + hh / 2),
                                   (0.0, 0.0, yaw + (0.0 if side > 0 else math.pi)), (bl - 0.02, WALL, hh),
                                   rng.randrange(N_DRESSED), rng.random(), rng.random() * 0.1)
                s += bl
            # Roof slabs across the corridor, one every metre or so.
            s = 0.0
            while s < seg - 0.1:
                w = min(rng.uniform(0.9, 1.3), seg - s)
                t = (s + w / 2) / seg
                p = p0 + (p1 - p0) * t
                zz = z[i] + (z[i + 1] - z[i]) * t
                slabs.add((p[0], p[1], zz + 0.3 + n_courses * course + 0.4), (0.0, 0.0, yaw),
                          (w - 0.02, WIDTH + 2 * WALL + 0.3, 0.8), rng.randrange(N_DRESSED), rng.random(), rng.random() * 0.1)
                s += w
        blocks.emit("causeway corridor walls", lib["dressed limestone"], coll, log)
        slabs.emit("causeway corridor roof", lib["dressed limestone"], coll, log)
        log(f"causeway: corridor {CORRIDOR} m high, laid in blocks, on {len(line)} stations")
    return line
