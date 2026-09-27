"""
The 577 mastabas of the eastern and western cemeteries, from their OSM footprints.

Each is a battered core (Reisner's batter of 74.8 degrees, GN I Appendix A), laid
today in courses of blocks that grow ruined towards the top and the corners. As
built (c. 2560 BCE) most stand as Reisner found the core mastabas of the Western
Field: stepped retaining walls of local limestone in courses of about 35 cm, each set
back about ten centimetres (tier3.mastaba.course.height and .batter), the top a fill of
rubble under blown sand; a few carry their finished casing of fine limestone. Which
are cased, each tomb's own course height, and its height within the massing record's
sigma (tier3.mastaba.height: 4 m, sigma 2 m, "3 to 6 m" in Reisner's text) are look
choices, drawn so the cemetery is not a field of identical boxes; so are the sand
drifts against their feet. Heights are the footprint file's, with the present day's
ruin a look choice.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector, noise

from . import data, materials, states
from .instancing import Field
from .variants import N_CORE, block, collection
from .temples import DRESSED_BLOCK
from .walls import battered_variants, lay_masonry, lay_ring

BATTER = 1.0 / math.tan(math.radians(74.8))
COURSE = 0.5          # look choice: the laid courses of the ruins
DRESSED_COURSE = {r["key"]: r["value"] for r in data.records("tier3.json")}["tier3.mastaba.course.height"]   # Reisner: 0.35 m
NICHE = (1.2, 2.6, 1.4)   # look choice: the offering niche in the east face, width, height, depth
RUIN = (0.4, 1.0)     # look choice: what share of its height a mastaba keeps today
# Look choices for the tombs as built: the share cased in fine limestone by c. 2560 BCE (most of the
# Eastern and Western Fields' cores were cased later, or never), the spread of heights about the
# record's 4 m (a lognormal, held to 2.4-7 m, inside its sigma), the spread of course heights about
# Reisner's mean (his nine run from 26 to 39 cm), and the stepped cores' blocks.
CASED_SHARE = 0.3
HEIGHT_SPREAD = (0.28, 2.4, 7.0)
COURSE_RANGE = (0.8, 1.15)
CORE_BLOCK = (0.95, 0.45, 0.8)     # mean length, lognormal spread, depth into the core (metres)
CASED_DEPTH = 0.6                  # how deep the cased tombs' facing blocks run
N_STONE = 10
# The sand the wind has laid against each tomb's foot (look choices): drift height at the face in metres
# (low, high), how far out it runs per metre of height, and the wind it piles against, from the NNW.
DRIFT = (0.2, 1.1)
DRIFT_RUN = 2.8
WIND = (-0.34, 0.94)


def standing_temples(state):
    """The outlines of the temples this era has standing, so no traced tomb is drawn through one."""
    from .temples import outlines
    S = states.spec(state)
    return [t["ring"] for t in outlines() if t["id"] in S["temples"]]


def _inside(x, y, ring):
    c = False
    n = len(ring)
    for i in range(n):
        (x0, y0), (x1, y1) = ring[i], ring[(i + 1) % n]
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            c = not c
    return c


def _stone_variants(lib, mats):
    """The stepped cores' blocks: roughly dressed local limestone, the arrises knocked round, a chip or two off."""
    if "mastaba stone" not in lib:
        import random
        r = random.Random(41)
        parent = bpy.data.collections.get("library") or bpy.context.scene.collection
        lib["mastaba stone"] = collection(parent, "v mastaba stone",
                                          [block(1200 + i, rounding=r.uniform(0.02, 0.04), erosion=0.02, chips=2, cuts=6)
                                           for i in range(N_STONE)], mats["mastaba stone"])
    return lib["mastaba stone"]


def build(state, rng, terrain, coll, mats, lib, log=print):
    mode = states.spec(state)["mastabas"]
    if not mode:
        return
    today = mode in ("ruin", "buried")
    if not today:
        materials.masonry_set(mats)
    temples = standing_temples(state)
    bm = bmesh.new()
    hb_layer = bm.verts.layers.float.new("hb")
    blocks = Field()
    dressed_blocks = Field()
    stones = Field()
    cased_blocks = Field()
    niches, drifts = [], []
    ruin = (0.25, 0.7) if mode == "buried" else RUIN
    sunk = 1.4 if mode == "buried" else 0.6
    skipped = 0
    for m in data.mastabas():
        if any(_inside(m["cx"], m["cy"], ring) for ring in temples):
            skipped += 1
            continue
        L_, W_, yaw = m["length"], m["width"], m["yaw"]
        ca, sa = math.cos(yaw), math.sin(yaw)
        zc = float(terrain.surface([m["cx"]], [m["cy"]])[0])
        cased = False
        if today:
            H_ = m["height"] * rng.uniform(*ruin)
            base_z = min(zc, m["base"] if m["base"] is not None else zc) - sunk
        else:
            # Stand the tomb on the lowest ground under it, so no side of it floats on a slope, and give
            # it its height over the ground at its middle.
            gx = [m["cx"] + x * ca - y * sa for x in (-L_ / 2, 0.0, L_ / 2) for y in (-W_ / 2, 0.0, W_ / 2)]
            gy = [m["cy"] + x * sa + y * ca for x in (-L_ / 2, 0.0, L_ / 2) for y in (-W_ / 2, 0.0, W_ / 2)]
            ground = terrain.surface(gx, gy)
            lo, hi_h = HEIGHT_SPREAD[1], HEIGHT_SPREAD[2]
            H_ = min(max(m["height"] * rng.lognormvariate(0.0, HEIGHT_SPREAD[0]), lo), hi_h)
            # a narrow tomb stays a bench: its battered faces must leave a top at least a third of its width
            H_ = min(H_, (min(L_, W_) / 3.0) / BATTER)
            foot = float(np.min(ground)) - 0.25
            H_ = H_ + (zc - foot)
            base_z = foot - sunk
            cased = rng.random() < CASED_SHARE
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
            ring = [(m["cx"] + x * ca - y * sa, m["cy"] + x * sa + y * ca)
                    for x, y in ((-L_ / 2, -W_ / 2), (L_ / 2, -W_ / 2), (L_ / 2, W_ / 2), (-L_ / 2, W_ / 2))]
            door = _niche_at(m, ca, sa, L_, W_)
            head = min(1.9, H_ - 1.0)
            if cased:
                # The finished casing: fine limestone in courses of about half a metre, blocks of different
                # lengths, the face one continuous batter, the joints hairlines (look choices).
                lay_masonry(ring, foot, H_, rng, cased_blocks, course=0.55, block=1.3, depth=CASED_DEPTH, batter_deg=74.84,
                            openings=[(door[0], door[1], NICHE[0], head)], joint=0.01, course_spread=0.15, block_spread=0.35,
                            min_len=0.6, max_course=1.6, wear=(0.1, 0.6))
            else:
                # The stepped core: Reisner's courses, each set back so a line touching the steps' edges
                # makes his batter, in roughly dressed blocks of the local stone, the joints open.
                course = DRESSED_COURSE * rng.uniform(*COURSE_RANGE)
                lay_ring(ring, foot, H_, rng, stones, course=course, length=CORE_BLOCK[0], depth=CORE_BLOCK[2],
                         batter_deg=74.84, miss=0.0, variants=N_STONE, joint=0.04, erosion_jitter=True, course_spread=0.18,
                         length_spread=CORE_BLOCK[1], openings=[(door[0], door[1], NICHE[0], head)])
            niches.append((door, foot, head))
            drifts.append((m, ca, sa, L_, W_, foot))
        # The core (today, inside the laid shell and a little lower); as built the cased tomb's own solid
        # face, or the stepped core's fill behind its blocks, a little lower than their tops.
        if today:
            inset, lift = 0.55, 0.0
        else:
            # as built the solid runs from `sunk` under the foot, and its batter is measured from the foot
            inset, lift = (CASED_DEPTH if cased else CORE_BLOCK[2]) * 0.7, sunk
        seg_l, seg_w, seg_h = max(2, int(L_ / 1.6)), max(2, int(W_ / 1.6)), max(2, int(H_ / 0.7))
        seed = rng.random() * 100
        top_h = H_ if today else H_ - 0.12
        grid = []
        for j in range(seg_h + 1):
            zz = (top_h + lift) * j / seg_h
            hl, hw = L_ / 2 - BATTER * (zz - lift) - inset, W_ / 2 - BATTER * (zz - lift) - inset
            ring = [(-hl + 2 * hl * i / seg_l, -hw, zz) for i in range(seg_l)] + \
                   [(hl, -hw + 2 * hw * i / seg_w, zz) for i in range(seg_w)] + \
                   [(hl - 2 * hl * i / seg_l, hw, zz) for i in range(seg_l)] + \
                   [(-hl, hw - 2 * hw * i / seg_w, zz) for i in range(seg_w)]
            row = []
            for x, y, zz2 in ring:
                if today and j == seg_h:
                    zz2 += 0.5 * noise.noise(Vector((x * 0.12, y * 0.12 + seed, 3.0))) - 0.25
                r = (0.18 if today else 0.012) * noise.noise(Vector((x * 0.35 + seed, y * 0.35, zz2 * 0.5)))
                v = bm.verts.new((m["cx"] + x * ca - y * sa + r * ca, m["cy"] + x * sa + y * ca + r * sa, base_z + zz2))
                v[hb_layer] = zz2 - lift
                row.append(v)
            grid.append(row)
        n = len(grid[0])
        for j in range(seg_h):
            for i in range(n):
                bm.faces.new((grid[j][i], grid[j][(i + 1) % n], grid[j + 1][(i + 1) % n], grid[j + 1][i]))
        try:
            f = bm.faces.new(grid[-1])
            f.material_index = 0 if today else 1
        except ValueError:
            pass
    me = bpy.data.meshes.new("mastabas")
    bm.to_mesh(me)
    bm.free()
    if today:
        me.materials.append(mats["mastaba core"])
    else:
        # the fill behind the facing blocks (hidden but for a glimpse through a joint), and the sand over every top
        me.materials.append(mats["core behind"])
        me.materials.append(mats["ground"])
    ob = bpy.data.objects.new("mastabas", me)
    coll.objects.link(ob)
    log(f"mastabas: {len(data.mastabas()) - skipped} forms, {len(me.polygons):,} faces"
        + (f"; {skipped} traced inside a standing temple left out" if skipped else ""))
    if today:
        blocks.emit("mastaba blocks", lib["core"], coll, log)
        return
    stones.emit("mastaba cores", _stone_variants(lib, mats), coll, log)
    # the casing blocks' arrises a little worn and chipped, a few decades in the wind (crisp, they read as CG)
    cased_blocks.emit("mastaba casing", battered_variants(lib, "mastaba cased", mats["mastaba cased"], rounding=0.02, erosion=0.01,
                                                          chips=1, cuts=4, smooth=True), coll, log)
    # the niches in the stone they are cut in, which the recess itself shades (a black box read as a hole)
    _niches(niches, coll, mats["core behind"])
    _drifts(drifts, terrain, rng, coll, mats["ground"], log)


def _niche_at(m, ca, sa, L_, W_):
    """The offering place: on the face whose outward normal points most nearly east, a fifth of the way
    from its south end. Returns (x, y) on the face's foot line, its outward normal and the along vector."""
    faces_out = [((L_ / 2, 0.0), (ca, sa)), ((-L_ / 2, 0.0), (-ca, -sa)), ((0.0, W_ / 2), (-sa, ca)), ((0.0, -W_ / 2), (sa, -ca))]
    (fx, fy), (nx, ny) = max(faces_out, key=lambda f: f[1][0])
    along = (-ny, nx)
    run = W_ if abs(fx) > 0 else L_
    sgn = -1.0 if along[1] > 0 else 1.0
    off = sgn * run * 0.3
    px = m["cx"] + fx * ca - fy * sa + along[0] * off
    py = m["cy"] + fx * sa + fy * ca + along[1] * off
    return (px, py, nx, ny, along[0], along[1])


def _niches(niches, coll, material):
    """A dark recess behind the gap the stepped courses leave for the offering place."""
    w, _, dpt = NICHE
    verts, faces = [], []
    for (px, py, nx, ny, ax, ay), z0, h in niches:
        i = len(verts)
        back, front = -0.5, -0.05       # shallow, so it stands in front of the fill behind the courses
        for dz in (0.0, h):
            lean = -BATTER * dz          # the recess leans back with the face it is cut in
            for a, b in ((-1, back), (1, back), (1, front), (-1, front)):
                verts.append((px + ax * a * w / 2 + nx * (b + lean), py + ay * a * w / 2 + ny * (b + lean), z0 + dz))
        faces += [(i, i + 1, i + 2, i + 3), (i + 4, i + 7, i + 6, i + 5), (i, i + 4, i + 5, i + 1), (i + 1, i + 5, i + 6, i + 2),
                  (i + 3, i + 7, i + 4, i)]
    me = bpy.data.meshes.new("mastaba niches")
    me.from_pydata(verts, [], faces)
    me.materials.append(material)
    ob = bpy.data.objects.new("mastaba niches", me)
    coll.objects.link(ob)


def _drifts(drifts, terrain, rng, coll, material, log=print):
    """
    Sand banked against each tomb's foot: a skirt from the face out onto the ground, highest where the
    wind from the north-north-west drives it against a face, rising and falling along it; its outer edge
    tucked under the ground so it grows out of it.
    """
    rings = []
    for m, ca, sa, L_, W_, foot in drifts:
        per = 2 * (L_ + W_)
        k = max(12, int(per / 1.2))
        seed = rng.random() * 100
        pts = []
        for i in range(k):
            s = per * i / k
            # walk the outline: along +x on the south side, +y on the east, -x on the north, -y on the west
            if s < L_:
                x, y, nx, ny = -L_ / 2 + s, -W_ / 2, 0.0, -1.0
            elif s < L_ + W_:
                x, y, nx, ny = L_ / 2, -W_ / 2 + (s - L_), 1.0, 0.0
            elif s < 2 * L_ + W_:
                x, y, nx, ny = L_ / 2 - (s - L_ - W_), W_ / 2, 0.0, 1.0
            else:
                x, y, nx, ny = -L_ / 2, W_ / 2 - (s - 2 * L_ - W_), -1.0, 0.0
            wx, wy = m["cx"] + x * ca - y * sa, m["cy"] + x * sa + y * ca
            ox, oy = nx * ca - ny * sa, nx * sa + ny * ca
            windward = max(0.0, -(ox * WIND[0] + oy * WIND[1]))
            n = 0.5 + 0.5 * noise.noise(Vector((s * 0.25 + seed, seed * 0.3, 0.0)))
            h = DRIFT[0] + (DRIFT[1] - DRIFT[0]) * min(1.0, n * (0.55 + 0.9 * windward))
            # round the corners a little: the drift wraps them rather than stopping square
            pts.append((wx, wy, ox, oy, h))
        rings.append((pts, foot))
    xs, ys = [], []
    for pts, foot in rings:
        for wx, wy, ox, oy, h in pts:
            run = DRIFT_RUN * h + 0.6
            for f in (0.0, 0.35, 1.0):
                xs.append(wx + ox * (run * f - 0.08))
                ys.append(wy + oy * (run * f - 0.08))
    gz = terrain.surface(xs, ys)
    verts, faces = [], []
    q = 0
    for pts, foot in rings:
        k = len(pts)
        start = len(verts)
        for wx, wy, ox, oy, h in pts:
            run = DRIFT_RUN * h + 0.6
            g0, g1, g2 = (float(gz[q + j]) for j in range(3))
            q += 3
            inner = max(g0, foot + 0.25) + h
            verts.append((wx - ox * 0.08, wy - oy * 0.08, inner))
            verts.append((wx + ox * (run * 0.35 - 0.08), wy + oy * (run * 0.35 - 0.08), max(g1, foot) + h * 0.42))
            verts.append((wx + ox * (run - 0.08), wy + oy * (run - 0.08), g2 - 0.12))
        for i in range(k):
            a, b = start + 3 * i, start + 3 * ((i + 1) % k)
            faces.append((a, a + 1, b + 1, b))
            faces.append((a + 1, a + 2, b + 2, b + 1))
    me = bpy.data.meshes.new("mastaba drifts")
    me.from_pydata(verts, [], faces)
    me.shade_smooth()
    me.materials.append(material)
    ob = bpy.data.objects.new("mastaba drifts", me)
    coll.objects.link(ob)
    log(f"mastaba drifts: {len(rings)} skirts of sand, {len(faces):,} faces")
