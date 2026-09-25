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
             ruin=None, miss=0.04, seed=0.0, variants=N_CORE, openings=(), joint=0.05, erosion_jitter=True):
    """
    Lay courses round a closed outline, outer faces leaning in at `batter_deg`.
    `ruin` is (low, high): the share of `height` a stretch of wall keeps, varying
    slowly along it; None keeps it whole. `openings` are doorways (x, y, width,
    height): no block is laid across one below its head. `erosion_jitter` is
    weathered masonry: blocks knocked a little askew, with the open bed joints of
    worn stone; without it the courses close to the fine joints of dressed work.
    Returns the blocks laid.
    """
    pts = simplify(ring)
    inset_per_m = 1.0 / math.tan(math.radians(batter_deg))
    n_courses = max(1, int(round(height / course)))
    ch = height / n_courses
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
            zb = k * ch
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
                bl = min(max(rng.lognormvariate(math.log(length), 0.35), 0.8), length * 2.5)
                if s + bl > s1 - 0.5:
                    bl = s1 - s
                sc = s + bl / 2
                s += bl
                if any(abs(sc - a) < hw + bl / 2 - 0.05 and zb < oh for a, hw, oh in doors):
                    continue
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
