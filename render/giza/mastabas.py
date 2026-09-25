"""
The 577 mastabas of the eastern and western cemeteries, from their OSM footprints.

Each is a battered core (Reisner's batter of 74.8 degrees, GN I Appendix A), laid
today in courses of blocks that grow ruined towards the top and the corners, and
dressed smooth in the ancient states. Heights are the footprint file's, with the
present day's ruin a look choice.
"""
import math

import bmesh
import bpy
from mathutils import Vector, noise

from . import data, states
from .instancing import Field
from .variants import N_CORE, N_DRESSED
from .walls import lay_ring

BATTER = 1.0 / math.tan(math.radians(74.8))
COURSE = 0.5          # look choice: the laid courses of the ruins
DRESSED_COURSE = {r["key"]: r["value"] for r in data.records("tier3.json")}["tier3.mastaba.course.height"]   # Reisner: 0.35 m
NICHE = (1.2, 2.6, 1.4)   # look choice: the offering niche in the east face, width, height, depth
RUIN = (0.4, 1.0)     # look choice: what share of its height a mastaba keeps today


def build(state, rng, terrain, coll, mats, lib, log=print):
    mode = states.spec(state)["mastabas"]
    if not mode:
        return
    bm = bmesh.new()
    blocks = Field()
    dressed_blocks = Field()
    niches = []
    today = mode in ("ruin", "buried")
    ruin = (0.25, 0.7) if mode == "buried" else RUIN
    sunk = 1.4 if mode == "buried" else 0.6
    for m in data.mastabas():
        L_, W_, yaw = m["length"], m["width"], m["yaw"]
        H_ = m["height"] * (rng.uniform(*ruin) if today else 1.0)
        zc = float(terrain.surface([m["cx"]], [m["cy"]])[0])
        base_z = min(zc, m["base"] if m["base"] is not None else zc) - sunk
        ca, sa = math.cos(yaw), math.sin(yaw)
        if today:
            nco = max(1, int(H_ / COURSE))
            for kc in range(nco):
                zb = kc * COURSE
                ins = BATTER * (zb + COURSE)
                for side in range(4):
                    run, out = (L_ / 2 - ins, W_ / 2 - ins) if side % 2 == 0 else (W_ / 2 - ins, L_ / 2 - ins)
                    ang = yaw + side * 0.5 * math.pi
                    cs, sn = math.cos(ang), math.sin(ang)
                    full = (side + kc) % 2 == 0
                    u, u_end = (-run, run) if full else (-(run - 0.8), run - 0.8)
                    while u < u_end - 0.1:
                        bl = min(max(rng.lognormvariate(0.0, 0.3), 0.45), 2.0)
                        if u + bl > u_end - 0.3:
                            bl = u_end - u
                        uc = u + bl / 2
                        u += bl
                        if rng.random() < 0.10 + 0.5 * (kc / nco) ** 2 + 0.3 * math.exp(-(run - abs(uc)) / 1.5):
                            continue
                        dd = rng.uniform(0.7, 0.95)
                        vv = out - dd / 2 + rng.gauss(0, 0.03)
                        hh = COURSE - 0.03 - rng.random() * 0.03
                        blocks.add((m["cx"] + uc * cs - vv * sn, m["cy"] + uc * sn + vv * cs, base_z + zb + hh / 2 + sunk),
                                   (rng.gauss(0, 0.01), rng.gauss(0, 0.01), ang + rng.gauss(0, 0.02)),
                                   (bl - 0.04, dd, hh), rng.randrange(N_CORE), rng.random(), rng.random())
        else:
            # As built: the casing laid in Reisner's courses, and an offering niche near the south end of the east face.
            ring = [(m["cx"] + x * ca - y * sa, m["cy"] + x * sa + y * ca)
                    for x, y in ((-L_ / 2, -W_ / 2), (L_ / 2, -W_ / 2), (L_ / 2, W_ / 2), (-L_ / 2, W_ / 2))]
            lay_ring(ring, base_z + sunk - 0.05, H_, rng, dressed_blocks, course=DRESSED_COURSE, length=1.1, depth=0.7,
                     batter_deg=74.84, miss=0.0, variants=N_DRESSED, joint=0.015, erosion_jitter=False)
            niches.append((m, ca, sa, L_, W_, base_z + sunk))
        # The core (today, inside the laid shell and a little lower) or the fill behind the dressed courses.
        inset = 0.55 if today else 0.6
        seg_l, seg_w, seg_h = max(2, int(L_ / 1.6)), max(2, int(W_ / 1.6)), max(2, int(H_ / 0.7))
        seed = rng.random() * 100
        grid = []
        for j in range(seg_h + 1):
            zz = H_ * j / seg_h
            hl, hw = L_ / 2 - BATTER * zz - inset, W_ / 2 - BATTER * zz - inset
            ring = [(-hl + 2 * hl * i / seg_l, -hw, zz) for i in range(seg_l)] + \
                   [(hl, -hw + 2 * hw * i / seg_w, zz) for i in range(seg_w)] + \
                   [(hl - 2 * hl * i / seg_l, hw, zz) for i in range(seg_l)] + \
                   [(-hl, hw - 2 * hw * i / seg_w, zz) for i in range(seg_w)]
            row = []
            for x, y, zz2 in ring:
                if today and j == seg_h:
                    zz2 += 0.5 * noise.noise(Vector((x * 0.12, y * 0.12 + seed, 3.0))) - 0.25
                r = (0.18 if today else 0.02) * noise.noise(Vector((x * 0.35 + seed, y * 0.35, zz2 * 0.5)))
                row.append(bm.verts.new((m["cx"] + x * ca - y * sa + r * ca, m["cy"] + x * sa + y * ca + r * sa, base_z + zz2)))
            grid.append(row)
        n = len(grid[0])
        for j in range(seg_h):
            for i in range(n):
                bm.faces.new((grid[j][i], grid[j][(i + 1) % n], grid[j + 1][(i + 1) % n], grid[j + 1][i]))
        try:
            bm.faces.new(grid[-1])
        except ValueError:
            pass
    me = bpy.data.meshes.new("mastabas")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mats["mastaba core"] if today else mats["limestone flat"])
    ob = bpy.data.objects.new("mastabas", me)
    coll.objects.link(ob)
    log(f"mastabas: {len(data.mastabas())} forms, {len(me.polygons):,} faces")
    if today:
        blocks.emit("mastaba blocks", lib["core"], coll, log)
    else:
        dressed_blocks.emit("mastaba casing", lib["dressed limestone"], coll, log)
        _niches(niches, coll, mats["dark"])


def _niches(niches, coll, material):
    """A dark recess in the east face of each mastaba, a fifth of the way from its south end."""
    w, h, dpt = NICHE
    verts, faces = [], []
    for m, ca, sa, L_, W_, z0 in niches:
        # The face whose outward normal points most nearly east.
        faces_out = [((L_ / 2, 0.0), (ca, sa)), ((-L_ / 2, 0.0), (-ca, -sa)), ((0.0, W_ / 2), (-sa, ca)), ((0.0, -W_ / 2), (sa, -ca))]
        (fx, fy), (nx, ny) = max(faces_out, key=lambda f: f[1][0])
        along = (-ny, nx) if abs(fx) > 0 else (ca, sa)
        run = W_ if abs(fx) > 0 else L_
        # Towards the south end of that face.
        sgn = -1.0 if along[1] > 0 else 1.0
        off = sgn * run * 0.3
        px = m["cx"] + fx * ca - fy * sa + along[0] * off - nx * (dpt / 2 - 0.2)
        py = m["cy"] + fx * sa + fy * ca + along[1] * off - ny * (dpt / 2 - 0.2)
        i = len(verts)
        for dz in (0.0, h):
            for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                verts.append((px + along[0] * a * w / 2 + nx * b * dpt / 2, py + along[1] * a * w / 2 + ny * b * dpt / 2, z0 + dz))
        faces += [(i, i + 1, i + 2, i + 3), (i + 4, i + 7, i + 6, i + 5), (i, i + 4, i + 5, i + 1), (i + 1, i + 5, i + 6, i + 2),
                  (i + 2, i + 6, i + 7, i + 3), (i + 3, i + 7, i + 4, i)]
    me = bpy.data.meshes.new("mastaba niches")
    me.from_pydata(verts, [], faces)
    me.materials.append(material)
    ob = bpy.data.objects.new("mastaba niches", me)
    coll.objects.link(ob)
