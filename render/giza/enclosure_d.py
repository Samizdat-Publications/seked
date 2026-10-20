"""
Enclosure D at Göbekli Tepe, a labelled stand-in built from its plan (night list, item 19b). bpy-free.

Where each pillar stands, how wide the plan draws it and which way the central pair run are scaled off
Haklay & Gopher 2020, Fig. 1 (`scripts/enclosure_d_plan.py`, records `scaled from plate` in
data/measurements/gobekli.json); the central pillars' height, their pedestals and the wall's preserved
height are printed figures from p. 347 of the same paper. Everything else is a stated look choice, in
LOOK: the wall pillars' height (the paper's 3-4 m is for Layer III's enclosures in general, not D's),
the pillars' thickness and the T's proportions, the wall's thickness and where it runs (a smooth closed
curve through the wall pillars, pushed out so they stand half proud of it), and the wall pillars set
radially, as the plan draws them. No relief is carved: the arms, the belts and the fox are not drawn,
because no measured drawing of them has been read.

The frame is the enclosure's own: x east, y north, metres, from the midpoint of the central pillars,
z up from the bedrock floor.
"""
import math

from . import data

LOOK = dict(
    ring_height=3.5,        # the wall pillars, above the floor: the paper's "3-4 m" for Layer III in general (p. 344)
    thickness_central=0.45,  # each pillar's thickness across its broad faces; not in the paper
    thickness_ring=0.35,
    shaft=0.72,             # the shaft's width as a share of the head's, seen on the broad face
    head=0.24,              # the head's depth as a share of the pillar's height
    wall_thickness=1.0,     # the plan draws 0.7 to 1.1 m on the east and south and a thin line on the west
    wall_out=0.45,          # the wall's centreline outside the pillars' centres, so they stand half proud
    figure=1.7,             # the human figure for scale
    fill_level=2.6,         # how high the fill stands in the still, above the floor: no source checked prints a depth
    slide_from=315.0,       # the bearing the slope slides come from: up the mound, since Clare (2020 §11) puts the special
                            # buildings in its "low-lying southeastern part" and the debris from "higher-lying knolls"
    slide_dip=18.0,         # the slid fill's surface, degrees, falling away from where it came in
    ground_out=30.0,        # the hill's surface outside, drawn level with the wall's top this far out: the enclosure is
                            # sunk into the mound, but the fill around it is not measured here
)

KEY = "gobekli.enclosure_d."


def records():
    return {r["key"][len(KEY):]: float(r["value"]) for r in data.records("gobekli.json") if r["key"].startswith(KEY)}


def pillars(rec=None, look=LOOK):
    """The thirteen pillars: centre, the bearing of the long axis (degrees from north), width, height, base."""
    rec = rec or records()
    ped = (rec["pillars.central.pedestal.height.min"] + rec["pillars.central.pedestal.height.max"]) / 2
    out = []
    for side in ("west", "east"):
        k = "pillar.central_%s." % side
        out.append(dict(name="central " + side, x=rec[k + "east"], y=rec[k + "north"], bearing=rec[k + "axis_bearing"],
                        width=rec[k + "plan_length"], thickness=look["thickness_central"],
                        height=rec["pillars.central.height"], base=ped))
    n = int(rec["pillars.peripheral.count"])
    ring = [(rec["pillar.ring_%02d.east" % i], rec["pillar.ring_%02d.north" % i]) for i in range(1, n + 1)]
    # set radially about the ring's own middle, which lies south of the central pair, as the plan draws them
    mx, my = sum(x for x, _ in ring) / n, sum(y for _, y in ring) / n
    for i, (x, y) in enumerate(ring, 1):
        k = "pillar.ring_%02d." % i
        out.append(dict(name="wall pillar %d" % i, x=x, y=y, bearing=math.degrees(math.atan2(x - mx, y - my)) % 180,
                        width=rec[k + "plan_length"], thickness=look["thickness_ring"], height=look["ring_height"], base=0.0))
    return out


def _box(cx, cy, bearing, along, across, z0, z1):
    """A box `along` long on the bearing and `across` wide, as eight vertices and six faces."""
    b = math.radians(bearing)
    u = (math.sin(b), math.cos(b))         # along the long axis
    v = (math.cos(b), -math.sin(b))        # across it
    vs = []
    for z in (z0, z1):
        for sa, sc in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            vs.append((cx + sa * along / 2 * u[0] + sc * across / 2 * v[0], cy + sa * along / 2 * u[1] + sc * across / 2 * v[1], z))
    fs = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return vs, fs


def tpillar(p, look=LOOK):
    """A plain T: a shaft and a head the full drawn width, the head `head` of the height. Boxes as (verts, faces)."""
    top = p["base"] + p["height"]
    split = top - look["head"] * p["height"]
    parts = [_box(p["x"], p["y"], p["bearing"], p["width"] * look["shaft"], p["thickness"], p["base"], split),
             _box(p["x"], p["y"], p["bearing"], p["width"], p["thickness"], split, top)]
    if p["base"] > 0:
        parts.append(_box(p["x"], p["y"], p["bearing"], p["width"] + 0.3, p["thickness"] + 0.3, 0.0, p["base"]))
    return parts


def _catmull(points, per=12):
    """A closed Catmull-Rom curve through `points`, `per` samples a span."""
    n, out = len(points), []
    for i in range(n):
        p0, p1, p2, p3 = (points[(i + k) % n] for k in (-1, 0, 1, 2))
        for s in range(per):
            t = s / per
            out.append(tuple(0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t ** 3) for j in (0, 1)))
    return out


def wall(rec=None, look=LOOK):
    """The wall's centreline, inner and outer faces (closed lists of (x, y)) and its height above the floor."""
    rec = rec or records()
    ring = [p for p in pillars(rec, look) if p["name"].startswith("wall")]
    ring.sort(key=lambda p: math.atan2(p["x"], p["y"]) % (2 * math.pi))
    # each pillar's point pushed out along the line from the enclosure's centroid
    cx = sum(p["x"] for p in ring) / len(ring)
    cy = sum(p["y"] for p in ring) / len(ring)
    pts = []
    for p in ring:
        d = math.hypot(p["x"] - cx, p["y"] - cy)
        pts.append((p["x"] + (p["x"] - cx) / d * look["wall_out"], p["y"] + (p["y"] - cy) / d * look["wall_out"]))
    line = _catmull(pts)
    # a few passes of neighbour averaging, so the offset faces do not fold where the ring turns sharply (by wall
    # pillar 10 the half-metre offset outran the curve's radius); the line moves a few centimetres, the pillars not at all
    for _ in range(6):
        line = [tuple(0.25 * line[i - 1][j] + 0.5 * line[i][j] + 0.25 * line[(i + 1) % len(line)][j] for j in (0, 1))
                for i in range(len(line))]
    inner, outer = [], []
    n = len(line)
    for i, (x, y) in enumerate(line):
        (ax, ay), (bx, by) = line[i - 1], line[(i + 1) % n]
        tx, ty = bx - ax, by - ay
        L = math.hypot(tx, ty)
        nx, ny = -ty / L, tx / L                     # the outward normal, the curve running clockwise
        h = look["wall_thickness"] / 2
        inner.append((x - nx * h, y - ny * h))
        outer.append((x + nx * h, y + ny * h))
    return dict(line=line, inner=inner, outer=outer, height=rec["wall.height.preserved.min"])


def wall_mesh(w):
    """The wall as one closed band: inner and outer faces, a top and a foot."""
    n = len(w["line"])
    vs = [(x, y, 0.0) for x, y in w["inner"]] + [(x, y, w["height"]) for x, y in w["inner"]]
    vs += [(x, y, 0.0) for x, y in w["outer"]] + [(x, y, w["height"]) for x, y in w["outer"]]
    I0, I1, O0, O1 = 0, n, 2 * n, 3 * n
    fs = []
    for i in range(n):
        j = (i + 1) % n
        fs += [(I0 + i, I0 + j, I1 + j, I1 + i), (O0 + j, O0 + i, O1 + i, O1 + j),
               (I1 + i, I1 + j, O1 + j, O1 + i), (O0 + i, O0 + j, I0 + j, I0 + i)]
    return vs, fs


def ground_mesh(w, look=LOOK):
    """The hill's surface round the enclosure, level with the wall's top: quads from the outer face out along rays."""
    n = len(w["outer"])
    mx = sum(x for x, _ in w["outer"]) / n
    my = sum(y for _, y in w["outer"]) / n
    vs = [(x, y, w["height"]) for x, y in w["outer"]]
    for x, y in w["outer"]:
        d = math.hypot(x - mx, y - my)
        vs.append((mx + (x - mx) / d * look["ground_out"], my + (y - my) / d * look["ground_out"], w["height"]))
    fs = [(i, n + i, n + (i + 1) % n, (i + 1) % n) for i in range(n)]
    return vs, fs


def figure_parts(x, y, height, facing=0.0):
    """A plain standing person, `height` tall: two legs, a body and a head as (x, y, radius, z0, z1) cylinders."""
    h, f = height, math.radians(facing)
    sx, sy = math.cos(f) * 0.1, -math.sin(f) * 0.1      # the legs apart across the facing direction
    return [(x - sx, y - sy, 0.075, 0.0, 0.47 * h), (x + sx, y + sy, 0.075, 0.0, 0.47 * h),
            (x, y, 0.17, 0.46 * h, 0.82 * h), (x, y, 0.055, 0.82 * h, 0.86 * h), (x, y, 0.1, 0.86 * h, h)]


def orbit(t, rec=None, look=LOOK, eye=1.6, out=4.0):
    """The sequence's camera at `t` (0 to 1, once round, clockwise from the south): on the rim `out` metres outside the
    wall, a person's eye height above its top, looking at the middle of the ring a little above the floor."""
    w = wall(rec, look)
    n = len(w["outer"])
    mx = sum(x for x, _ in w["outer"]) / n
    my = sum(y for _, y in w["outer"]) / n
    a = math.pi + 2 * math.pi * t                       # bearing from north, starting due south
    ux, uy = math.sin(a), math.cos(a)
    # the outer face's reach along this bearing, from the nearest of its points in angle
    reach = max(((x - mx) * ux + (y - my) * uy, (x, y)) for x, y in w["outer"]
                if abs(math.atan2(x - mx, y - my) - math.atan2(ux, uy)) % (2 * math.pi) < 0.2
                or abs(math.atan2(x - mx, y - my) - math.atan2(ux, uy)) % (2 * math.pi) > 2 * math.pi - 0.2)[0]
    r = reach + out
    return dict(eye=(mx + ux * r, my + uy * r, w["height"] + eye), at=(mx, my, 1.8))


def fill_mesh(w, level, mode="level", look=LOOK):
    """
    The fill inside the wall, in concentric rings out to the inner face: "level", Schmidt's deliberate backfill,
    a flat surface at `level`; "slide", Clare's slope slides, a surface tilted down from `slide_from` by
    `slide_dip` and standing at `level` in the middle, never below the floor nor above the wall's top.
    """
    n = len(w["inner"])
    mx = sum(x for x, _ in w["inner"]) / n
    my = sum(y for _, y in w["inner"]) / n
    b = math.radians(look["slide_from"])
    ux, uy = math.sin(b), math.cos(b)
    grade = math.tan(math.radians(look["slide_dip"]))

    def z(x, y):
        if mode == "level":
            return level
        return min(w["height"], max(0.0, level + grade * ((x - mx) * ux + (y - my) * uy)))
    rings = 8                                           # concentric rings, so a clamped slope bends smoothly
    vs = [(mx, my, z(mx, my))]
    for k in range(1, rings + 1):
        f = k / rings
        vs += [(mx + (x - mx) * f, my + (y - my) * f, z(mx + (x - mx) * f, my + (y - my) * f)) for x, y in w["inner"]]
    fs = [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)]
    for k in range(1, rings):
        a, b = 1 + (k - 1) * n, 1 + k * n
        fs += [(a + i, b + i, b + (i + 1) % n, a + (i + 1) % n) for i in range(n)]
    return vs, fs


def inner_span(w, axis=0):
    """The inner face's extent along x (axis 0) or y (axis 1), metres."""
    vals = [p[axis] for p in w["inner"]]
    return max(vals) - min(vals)
