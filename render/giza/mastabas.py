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

from . import data
from .instancing import Field
from .variants import N_CORE

BATTER = 1.0 / math.tan(math.radians(74.8))
COURSE = 0.5          # look choice: the laid courses of the ruins
RUIN = (0.4, 1.0)     # look choice: what share of its height a mastaba keeps today


def build(state, rng, terrain, coll, mats, lib, log=print):
    bm = bmesh.new()
    blocks = Field()
    today = state == "today"
    for m in data.mastabas():
        L_, W_, yaw = m["length"], m["width"], m["yaw"]
        H_ = m["height"] * (rng.uniform(*RUIN) if today else 1.0)
        zc = float(terrain.surface([m["cx"]], [m["cy"]])[0])
        base_z = min(zc, m["base"] if m["base"] is not None else zc) - 0.6
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
                        blocks.add((m["cx"] + uc * cs - vv * sn, m["cy"] + uc * sn + vv * cs, base_z + zb + hh / 2 + 0.6),
                                   (rng.gauss(0, 0.01), rng.gauss(0, 0.01), ang + rng.gauss(0, 0.02)),
                                   (bl - 0.04, dd, hh), rng.randrange(N_CORE), rng.random(), rng.random())
        # The core (today, inside the laid shell and a little lower) or the dressed form.
        inset = 0.55 if today else 0.0
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
    me.materials.append(mats["mastaba core"] if today else mats["dressed"])
    ob = bpy.data.objects.new("mastabas", me)
    coll.objects.link(ob)
    log(f"mastabas: {len(data.mastabas())} forms, {len(me.polygons):,} faces")
    if today:
        blocks.emit("mastaba blocks", lib["core"], coll, log)
