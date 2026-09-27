"""
Walls laid from blocks along an outline: the temples, and anything else that is a
battered wall of coursed masonry. Courses, block sizes, batter and ruin are look
choices passed in by the caller; the outline and its base level come from data.
"""
import math

import numpy as np
from mathutils import Vector, noise

from .variants import N_CORE


def ccw(ring):
    """The ring counter-clockwise, without a repeated last point."""
    pts = [tuple(p[:2]) for p in ring]
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
    return pts if area > 0 else pts[::-1]


def _dp(points, tol):
    """Douglas-Peucker on an open polyline."""
    if len(points) < 3:
        return list(points)
    (ax, ay), (bx, by) = points[0], points[-1]
    ex, ey = bx - ax, by - ay
    L = math.hypot(ex, ey) or 1e-9
    worst, at = -1.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        d = abs((px - ax) * ey - (py - ay) * ex) / L
        if d > worst:
            worst, at = d, i
    if worst <= tol:
        return [points[0], points[-1]]
    return _dp(points[:at + 1], tol)[:-1] + _dp(points[at:], tol)


def simplify(ring, tol=1.2):
    """A traced outline reduced to its straight runs: OSM draws a straight wall as several segments and jogs."""
    pts = ccw(ring)
    if len(pts) <= 4:
        return pts
    # Split the closed ring at the two points farthest apart and simplify each half.
    far = max(((i, j) for i in range(len(pts)) for j in range(i + 1, len(pts))),
              key=lambda ij: math.hypot(pts[ij[0]][0] - pts[ij[1]][0], pts[ij[0]][1] - pts[ij[1]][1]))
    i, j = far
    a = _dp(pts[i:j + 1], tol)
    b = _dp(pts[j:] + pts[:i + 1], tol)
    out = a[:-1] + b[:-1]
    return ccw(out) if len(out) >= 3 else pts


def lay_ring(ring, base_z, height, rng, field, course=1.1, length=2.2, depth=1.8, batter_deg=82.0,
             ruin=None, miss=0.04, seed=0.0, variants=N_CORE, openings=(), joint=0.05, erosion_jitter=True,
             course_spread=0.0, length_spread=0.35):
    """
    Lay courses round a closed outline, outer faces leaning in at `batter_deg`.
    `ruin` is (low, high): the share of `height` a stretch of wall keeps, varying
    slowly along it; None keeps it whole. `openings` are doorways (x, y, width,
    height): no block is laid across one below its head. `erosion_jitter` is
    weathered masonry: blocks knocked a little askew, with the open bed joints of
    worn stone; without it the courses close to the fine joints of dressed work.
    `course_spread` varies the courses' heights (a lognormal spread; 0 lays them all
    alike) and `length_spread` the blocks' lengths, for work like Khafre's granite,
    whose courses run from under a metre to over two and whose blocks vary as much.
    Returns the blocks laid.
    """
    pts = simplify(ring)
    inset_per_m = 1.0 / math.tan(math.radians(batter_deg))
    n_courses = max(1, int(round(height / course)))
    if course_spread > 0:
        crng = __import__("random").Random(int(seed * 1000) + len(pts))
        hs = [crng.lognormvariate(0.0, course_spread) for _ in range(n_courses)]
        heights = [height * h / sum(hs) for h in hs]
    else:
        heights = [height / n_courses] * n_courses
    bases = [sum(heights[:k]) for k in range(n_courses)]
    laid = 0
    perimeter_s = 0.0
    for i in range(len(pts)):
        ax, ay = pts[i]
        bx, by = pts[(i + 1) % len(pts)]
        ex, ey = bx - ax, by - ay
        L = math.hypot(ex, ey)
        if L < 0.5:
            continue
        dx, dy = ex / L, ey / L
        nx, ny = dy, -dx                           # outward for a counter-clockwise ring
        yaw = math.atan2(ny, nx) - 0.5 * math.pi   # turns a block's +Y onto the outward normal
        # +1 where the corner at an end of this edge is convex (the edge shortens as the wall leans in), -1 where concave.
        (px, py), (qx, qy) = pts[i - 1], pts[(i + 2) % len(pts)]
        turn_in = 1.0 if (ax - px) * ey - (ay - py) * ex > 0 else -1.0
        turn_out = 1.0 if ex * (qy - by) - ey * (qx - bx) > 0 else -1.0
        # Doorways on this edge: (distance along it, half width, head height).
        doors = []
        for ox, oy, ow, oh in openings:
            along = (ox - ax) * dx + (oy - ay) * dy
            across = (ox - ax) * nx + (oy - ay) * ny
            if -1.0 < along < L + 1.0 and abs(across) < 4.0:
                doors.append((along, ow / 2, oh))
        for k in range(n_courses):
            zb, ch = bases[k], heights[k]
            inset = zb * inset_per_m + depth / 2
            # Alternate which wall runs through the corner, course by course; a short run is one block.
            # A battered edge shortens as it rises, the neighbouring faces leaning in with it, so each
            # course starts and stops that much further in; without it the upper courses overhang the corners.
            through = (i + k) % 2 == 0 or L < 3 * depth
            lean = zb * inset_per_m
            s0 = lean * turn_in + (0.0 if through else depth)
            s1 = L - lean * turn_out - (0.0 if through else depth)
            s = s0
            while s < s1 - 0.2:
                bl = min(max(rng.lognormvariate(math.log(length), length_spread), 0.8), length * 2.5)
                if s + bl > s1 - 0.5:
                    bl = s1 - s
                sc = s + bl / 2
                s += bl
                # A block that runs into a doorway below its head is cut back to the jamb, so every course
                # ends at the same line; dropped whole, the courses beside a door ended raggedly and the
                # blocks above a dropped one hung in the air (critic round 11).
                lo, hi = sc - bl / 2, sc + bl / 2
                for a, hw, oh in doors:
                    if zb >= oh or hi <= a - hw or lo >= a + hw:
                        continue
                    if a - hw - lo >= hi - (a + hw):
                        hi = a - hw
                    else:
                        lo = a + hw
                if hi - lo < 0.35:
                    continue
                sc, bl = (lo + hi) / 2, hi - lo
                if ruin is not None:
                    keep = ruin[0] + (ruin[1] - ruin[0]) * (0.5 + 0.5 * noise.noise(Vector(((perimeter_s + sc) * 0.06 + seed, 0.0, 0.0))))
                    if zb + ch > keep * height + 0.01:
                        continue
                    if rng.random() < miss + 0.25 * max(0.0, (zb / height) - 0.5):
                        continue
                elif rng.random() < miss:
                    continue
                cx = ax + dx * sc - nx * inset
                cy = ay + dy * sc - ny * inset
                hh = ch - 0.03 - rng.random() * 0.04 if erosion_jitter else ch - 0.006 - rng.random() * 0.004
                jit = 0.008 if erosion_jitter else 0.0005
                field.add((cx, cy, base_z + zb + hh / 2), (rng.gauss(0, jit), rng.gauss(0, jit), yaw + rng.gauss(0, jit * 2)),
                          (bl - joint, depth * rng.uniform(0.9, 1.1), hh), rng.randrange(variants), rng.random(), rng.random())
                laid += 1
        perimeter_s += L
    return laid


# The fronts of battered blocks lean back by these shares of their depth over their height (variants.block's
# `shear`); a block takes the variant nearest the lean its height and the wall's batter ask for.
SHEARS = (0.0, 0.035, 0.07, 0.105, 0.14, 0.18, 0.22, 0.27, 0.33, 0.4)


def battered_variants(lib, key, material, seeds=2, **block_kw):
    """
    Block variants whose fronts lean back (one set per shear in SHEARS, `seeds` of each), for walls
    laid by lay_masonry with a continuous batter; made once per library and kept in it under `key`.
    """
    if key in lib:
        return lib[key]
    import bpy
    from . import variants
    parent = bpy.data.collections.get("library") or bpy.context.scene.collection
    meshes = [variants.block(900 + 17 * len(lib) + k * seeds + j, shear=s, **block_kw)
              for k, s in enumerate(SHEARS) for j in range(seeds)]
    lib[key] = variants.collection(parent, "v " + key, meshes, material)
    lib[key + " seeds"] = seeds
    return lib[key]


def lay_masonry(ring, base_z, height, rng, field, course=1.3, block=3.0, depth=1.6, batter_deg=82.0, openings=(),
                joint=0.02, course_spread=0.35, block_spread=0.5, min_len=0.7, snap=0.3, seeds=2, tone=None, wear=(0.0, 0.3),
                max_course=2.2):
    """
    Lay a battered wall round a closed outline as the Old Kingdom laid its temples: each face filled by
    packing.skyline, blocks of very different lengths and heights whose beds step along the wall, the
    fronts leaning back with the batter (the variants from battered_variants, chosen by index), the
    joints a hairline. `openings` are doorways (x, y, width, height) as in lay_ring. At a convex
    corner one face runs through and the other stops short against it. `tone` is (low, high) for the
    blocks' tones (all of 0..1 by default); `wear` likewise. Returns the blocks laid.
    """
    from .packing import skyline
    pts = simplify(ring)
    per_m = 1.0 / math.tan(math.radians(batter_deg))
    laid = 0
    for i in range(len(pts)):
        ax, ay = pts[i]
        bx, by = pts[(i + 1) % len(pts)]
        ex, ey = bx - ax, by - ay
        L = math.hypot(ex, ey)
        (px, py), (qx, qy) = pts[i - 1], pts[(i + 2) % len(pts)]
        turn_in = 1.0 if (ax - px) * ey - (ay - py) * ex > 0 else -1.0
        turn_out = 1.0 if ex * (qy - by) - ey * (qx - bx) > 0 else -1.0
        short = depth if turn_out > 0 else 0.0
        run = L - short
        if run < min_len:
            continue
        dx, dy = ex / L, ey / L
        nx, ny = dy, -dx
        yaw = math.atan2(ny, nx) - 0.5 * math.pi
        voids = []
        for ox, oy, ow, oh in openings:
            along = (ox - ax) * dx + (oy - ay) * dy
            across = (ox - ax) * nx + (oy - ay) * ny
            if -1.0 < along < L + 1.0 and abs(across) < 4.0:
                voids.append((along - ow / 2, along + ow / 2, oh))
        for a, b, z0, z1 in skyline(run, height, rng, course=course, block=block, course_spread=course_spread,
                                    block_spread=block_spread, min_len=min_len, snap=snap, max_course=max_course, voids=voids):
            lean = z0 * per_m
            # the faces draw in as they rise: an end at a corner moves along with the face it meets, taken
            # at the block's mid-height, so its square end neither stands proud of the leaning face at its
            # top nor leaves a notch at its foot by more than half the lean across its own height
            mid = (z0 + z1) / 2 * per_m
            if a <= 1e-6:
                a = mid * turn_in
            if b >= run - 1e-6:
                b = run - mid * turn_out
            if b - a < 0.3:
                continue
            hh = z1 - z0 - joint * 0.5
            bl = b - a - joint
            sc = (a + b) / 2
            inset = lean + depth / 2
            cx = ax + dx * sc - nx * inset
            cy = ay + dy * sc - ny * inset
            want = per_m * hh / depth
            level = min(range(len(SHEARS)), key=lambda k: abs(SHEARS[k] - want))
            tn = rng.random() if tone is None else rng.uniform(*tone)
            field.add((cx, cy, base_z + z0 + hh / 2), (0.0, 0.0, yaw), (bl, depth, hh),
                      level * seeds + rng.randrange(seeds), tn, rng.uniform(*wear))
            laid += 1
    return laid


def inset_ring(ring, d):
    """Offset a counter-clockwise ring inward by d (mitred corners), for the core behind a facing."""
    pts = ccw(ring)
    out = []
    n = len(pts)
    for i in range(n):
        p0, p1, p2 = np.array(pts[i - 1]), np.array(pts[i]), np.array(pts[(i + 1) % n])
        e0 = (p1 - p0) / (np.linalg.norm(p1 - p0) + 1e-9)
        e1 = (p2 - p1) / (np.linalg.norm(p2 - p1) + 1e-9)
        n0 = np.array([-e0[1], e0[0]])     # inward for counter-clockwise
        n1 = np.array([-e1[1], e1[0]])
        m = n0 + n1
        m = m / (np.linalg.norm(m) + 1e-9)
        cos = max(0.3, float(np.dot(m, n1)))
        out.append(tuple(p1 + m * d / cos))
    return out
