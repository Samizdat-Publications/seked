"""
The claim eras' quay: where the green eras' flood (water.py's LEVELS["flood"], itself a look
choice) stands only 0.4 m under the megalithic temples' platforms, their walls rose straight out
of the water (the critic, 24 October). So the pair stands on a paved terrace at their platform's
level, its edge laid in the same megaliths down into the water.

LOOK CHOICE: no quay is known at Giza in any era, and nothing of its form is a measurement; it
is drawn so the temples meet the water as built things do. Its width and courses are QUAY's.
Free of bpy, so the vegetation and its tests can keep plants off it.
"""
import numpy as np

from . import data, states

# width: metres of paving beyond the temples' outlines; below: the edge's depth from the paving's top;
# kerb: how far the edge's top course stands proud of the paving; course, length, depth: its blocks.
QUAY = dict(width=7.0, below=1.8, kerb=0.08, course=0.9, length=3.0, depth=2.2, slab=(2.2, 1.4, 0.35))


def _hull(points):
    """The convex hull of 2-D points, counter-clockwise (Andrew's monotone chain)."""
    pts = sorted(set(points))
    if len(pts) < 3:
        return pts

    def half(seq):
        out = []
        for p in seq:
            while len(out) >= 2 and ((out[-1][0] - out[-2][0]) * (p[1] - out[-2][1])
                                     - (out[-1][1] - out[-2][1]) * (p[0] - out[-2][0])) <= 0:
                out.pop()
            out.append(p)
        return out

    lower, upper = half(pts), half(reversed(pts))
    return lower[:-1] + upper[:-1]


def _outset(ring, d):
    """A counter-clockwise convex ring pushed out by d, its corners mitred."""
    n = len(ring)
    out = []
    for i in range(n):
        p0, p1, p2 = np.array(ring[i - 1]), np.array(ring[i]), np.array(ring[(i + 1) % n])
        e0 = (p1 - p0) / (np.linalg.norm(p1 - p0) + 1e-9)
        e1 = (p2 - p1) / (np.linalg.norm(p2 - p1) + 1e-9)
        n0, n1 = np.array([e0[1], -e0[0]]), np.array([e1[1], -e1[0]])     # outward for counter-clockwise
        m = n0 + n1
        m = m / (np.linalg.norm(m) + 1e-9)
        out.append(tuple(p1 + m * d / max(0.3, float(np.dot(m, n1)))))
    return out


def _straighten(ring, tol=1.5):
    """Drop hull points that sit within tol of the line through their neighbours (OSM's jogs)."""
    pts = list(ring)
    changed = True
    while changed and len(pts) > 3:
        changed = False
        for i in range(len(pts)):
            a, b, c = np.array(pts[i - 1]), np.array(pts[i]), np.array(pts[(i + 1) % len(pts)])
            e = c - a
            if abs(e[0] * (b - a)[1] - e[1] * (b - a)[0]) / (np.linalg.norm(e) + 1e-9) < tol:
                del pts[i]
                changed = True
                break
    return pts


def _clip_west(ring, x0):
    """The part of a convex ring east of x = x0 (Sutherland-Hodgman against one line)."""
    out = []
    for i in range(len(ring)):
        a, b = ring[i - 1], ring[i]
        if (b[0] >= x0) != (a[0] >= x0):
            t = (x0 - a[0]) / (b[0] - a[0])
            out.append((x0, a[1] + t * (b[1] - a[1])))
        if b[0] >= x0:
            out.append(b)
    return out


def outline(state):
    """(ring, top, temples): the quay's outer edge (counter-clockwise), its paving's top, and the temples' rings; None without one."""
    S = states.spec(state)
    if S.get("water") != "flood" or not S["temple_mode"].startswith("megalithic"):
        return None
    temples = [f for f in data.FOOTPRINTS if f["id"] in S["temples"] and f.get("base") is not None]
    if not temples:
        return None
    hull = _straighten(_hull([tuple(p[:2]) for f in temples for p in f["ring"]]))
    # A shade above the higher platform, so the paving covers both temples' levelled ground.
    top = max(f["base"] for f in temples) + 0.03
    # Only on the three sides the water reaches: on the west the ground rises to the Sphinx's forecourt,
    # so the quay stops at the temples' west faces.
    west = min(p[0] for f in temples for p in f["ring"])
    ring = [(float(x), float(y)) for x, y in _clip_west(_outset(hull, QUAY["width"]), west)]
    return ring, float(top), [f["ring"] for f in temples]


def inside(ring, x, y):
    """Whether (x, y) lies inside a ring (even-odd rule)."""
    hit = False
    n = len(ring)
    for i in range(n):
        (x0, y0), (x1, y1) = ring[i][:2], ring[(i + 1) % n][:2]
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            hit = not hit
    return hit


def slabs(state, rng):
    """The paving's slabs as (x, y, yaw, length, width): rows laid along the quay's longest edge, broken joint."""
    o = outline(state)
    if o is None:
        return []
    ring, _, temples = o
    n = len(ring)
    i = max(range(n), key=lambda k: np.hypot(*np.subtract(ring[(k + 1) % n], ring[k])))
    u = np.subtract(ring[(i + 1) % n], ring[i])
    u = u / np.linalg.norm(u)
    v = np.array([-u[1], u[0]])
    P = np.array(ring)
    s, t = P @ u, P @ v
    L, W, _ = QUAY["slab"]
    edge = QUAY["depth"] * 0.6          # keep the paving behind the edge's top course
    out = []
    row = t.min()
    while row < t.max():
        w = W * rng.uniform(0.85, 1.15)
        c = s.min() - rng.uniform(0.0, L)
        while c < s.max():
            ln = min(max(rng.lognormvariate(np.log(L), 0.3), 0.9), 2.4 * L)
            x, y = (c + ln / 2) * u + (row + w / 2) * v
            if inside(ring, x, y) and not any(inside(r, x, y) for r in temples):
                # behind the edge: the slab's centre at least `edge` in from every side
                if all(np.dot((x, y) - np.array(ring[k]), np.array([-(ring[(k + 1) % n][1] - ring[k][1]),
                       ring[(k + 1) % n][0] - ring[k][0]])) / np.hypot(*np.subtract(ring[(k + 1) % n], ring[k])) > edge
                       for k in range(n)):
                    out.append((float(x), float(y), float(np.arctan2(u[1], u[0])), float(ln), float(w)))
            c += ln
        row += w
    return out
