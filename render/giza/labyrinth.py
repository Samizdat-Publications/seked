"""
The Labyrinth at Hawara as one reconstruction draws it: the plan on the cover of the Mataha Expedition's report
(Hawara 2008, version VII, 08.2010), an older reconstruction from Herodotus whose original is not yet traced: not
Kircher's Turris Babel plate (1679, p. 78), which is a different design (docs/to-source.md). bpy-free.

Nobody has found the Labyrinth. Herodotus (II.148) describes twelve roofed courts with their doors facing one
another, six to the north and six to the south, 3,000 rooms, half of them underground, all inside one wall; Petrie
found only its quarried-out foundation, beds of limestone chips about 1000 by 800 feet south of the pyramid
(data/measurements/hawara.json). The plan is therefore a legendary-tier picture: what it looks like if this
reconstruction were built, on the footprint Petrie measured. Nothing in it is a measurement.

What is read off the plan (on a pixel grid, PLAN, the cover image's own pixels, x east, y south): the outer wall with
a gate on each side; a band of meander (Greek-key) corridor all round inside it; an inner wall; a row of small rooms
along its north and south sides and a ring of columns inside it; a north-south avenue between the north and south
gates; and on either side of it six courts, each a colonnaded hall between two rows of rooms facing in across it,
with a dark chapel at the outer end of each row. The plan is stretched to Petrie's chip bed, 1000 feet east-west by
800 north-south (render/giza/hawara.py LAYOUT), about 19 per cent more east-west than north-south, a look choice.
Every height and thickness is a look choice, in LOOK.
"""
import numpy as np

from . import hawara

# The plan, in the cover image's pixels (build/hawara/reference/mataha-2010-cover-labyrinth-plan.webp, 768 x 1024).
PLAN = dict(
    outer=(71, 695, 191, 786),        # the outer wall's outer face: west, east, north, south
    outer_thick=11,                   # its thickness
    inner=(110, 657, 228, 749),       # the inner wall
    rooms_small=((246, 256), (721, 731)),   # the rows of small rooms along the inner wall's north and south sides
    courts_x=((126, 367), (377, 640)),      # the courts west and east of the avenue
    bands=((265, 330), (340, 406), (416, 482), (494, 560), (570, 636), (646, 711)),   # the six rows of courts
    avenue=(367, 377),                # the north-south avenue
    gate_ns=(377, 392),               # the north and south gates' opening, east-west
    gate_ew=(482, 497),               # the west and east gates' opening, north-south
    room_w=12.0,                      # a court's room, east-west
    small_w=9.0,                      # a small room along the inner wall
    col_step=8.0,                     # between columns
    key_period=38.0,                  # the meander's repeat
)

LOOK = dict(
    outer_h=12.0, maze_h=7.0, inner_h=9.0, court_h=7.5, room_h=7.5, small_h=5.0, chapel_h=9.5,
    column_h=7.0, column_r=0.55,
    wall=1.4, partition=0.6,          # thicknesses, metres
    rooms=0.36,                       # each row of rooms takes this share of a court's depth; the hall the rest
    lower=(-12.0, -8.0),              # the legendary lower storey, floor and ceiling below the ground: the depths the
                                      # 2008 expedition's organiser gives for its walls (hawara.mataha.walls.depth)
)


def frame(f=None):
    """Plan pixels to metres in the Hawara frame (render/giza/hawara.py at_hawara): x east, y north."""
    g = hawara.at_hawara(f)
    x0, x1, y0, y1 = g["bed"]
    (px0, px1, py0, py1) = PLAN["outer"]
    sx, sy = (x1 - x0) / (px1 - px0), (y1 - y0) / (py1 - py0)
    return dict(X=lambda px: x0 + (np.asarray(px, float) - px0) * sx, Y=lambda py: y1 - (np.asarray(py, float) - py0) * sy,
                sx=sx, sy=sy, bed=g["bed"], pyramid=g["pyramid"])


def _wall(F, a, b, thick, h, z0=0.0, kind="wall"):
    """A straight wall between plan points a and b (axis-aligned), as a box in metres."""
    (ax, ay), (bx, by) = a, b
    X0, X1 = sorted((float(F["X"](ax)), float(F["X"](bx))))
    Y0, Y1 = sorted((float(F["Y"](ay)), float(F["Y"](by))))
    if X1 - X0 < Y1 - Y0:
        X0, X1 = (X0 + X1) / 2 - thick / 2, (X0 + X1) / 2 + thick / 2
    else:
        Y0, Y1 = (Y0 + Y1) / 2 - thick / 2, (Y0 + Y1) / 2 + thick / 2
    return dict(box=(X0, X1, Y0, Y1, z0, z0 + h), kind=kind)


def _ring(F, x0, x1, y0, y1, thick, h, kind, gaps=()):
    """A rectangle of walls, leaving each gap (side, lo, hi) in plan pixels open."""
    sides = dict(n=((x0, y0), (x1, y0)), s=((x0, y1), (x1, y1)), w=((x0, y0), (x0, y1)), e=((x1, y0), (x1, y1)))
    out = []
    for side, (a, b) in sides.items():
        cuts = sorted((lo, hi) for sd, lo, hi in gaps if sd == side)
        along = 0 if side in "ns" else 1
        start = a[along]
        for lo, hi in cuts + [(b[along], b[along])]:
            if lo > start:
                p, q = list(a), list(b)
                p[along], q[along] = start, lo
                out.append(_wall(F, tuple(p), tuple(q), thick, h, kind=kind))
            start = hi
    return out


def _maze(F):
    """The meander band: walls reaching alternately from its outer and inner faces most of the way across, with a
    hook at each tip, so its corridor winds back and forth like a Greek key."""
    L, o = LOOK, PLAN["outer"]
    t = PLAN["outer_thick"]
    a0 = (o[0] + t, o[1] - t, o[2] + t, o[3] - t)     # the band's outer face
    a1 = PLAN["inner"]                                 # and its inner face
    walls = []
    P = PLAN["key_period"]
    # north and south: teeth across the band, every half period
    for side, (yo, yi) in (("n", (a0[2], a1[2])), ("s", (a0[3], a1[3]))):
        x, k = a1[0] + P / 4, 0
        while x < a1[1] - P / 4:
            if not (side in "ns" and PLAN["gate_ns"][0] - 4 < x < PLAN["gate_ns"][1] + 4):
                frm, to = (yo, yo + 0.72 * (yi - yo)) if k % 2 == 0 else (yi, yi + 0.72 * (yo - yi))
                walls.append(_wall(F, (x, frm), (x, to), L["partition"] * 1.5, L["maze_h"], kind="maze"))
                walls.append(_wall(F, (x, to), (x + P / 4, to), L["partition"] * 1.5, L["maze_h"], kind="maze"))
            x, k = x + P / 2, k + 1
    for side, (xo, xi) in (("w", (a0[0], a1[0])), ("e", (a0[1], a1[1]))):
        y, k = a1[2] + P / 4, 0
        while y < a1[3] - P / 4:
            if not (PLAN["gate_ew"][0] - 4 < y < PLAN["gate_ew"][1] + 4):
                frm, to = (xo, xo + 0.72 * (xi - xo)) if k % 2 == 0 else (xi, xi + 0.72 * (xo - xi))
                walls.append(_wall(F, (frm, y), (to, y), L["partition"] * 1.5, L["maze_h"], kind="maze"))
                walls.append(_wall(F, (to, y), (to, y + P / 4), L["partition"] * 1.5, L["maze_h"], kind="maze"))
            y, k = y + P / 2, k + 1
    # the north and south gates run straight through the band to the avenue
    for yo, yi in ((a0[2], a1[2]), (a0[3], a1[3])):
        for x in PLAN["gate_ns"]:
            walls.append(_wall(F, (x, yo), (x, yi), L["wall"], L["maze_h"], kind="maze"))
    return walls


def _columns(F, x0, x1, y, step):
    xs = np.arange(x0 + step / 2, x1 - step / 4, step)
    return [(float(F["X"](x)), float(F["Y"](y))) for x in xs]


def plan(f=None, look=LOOK):
    """Everything above the ground: walls (box, kind), columns (x, y), chapels (box), and the twelve courts."""
    F = frame(f)
    L, o, i = look, PLAN["outer"], PLAN["inner"]
    t = PLAN["outer_thick"]
    walls, columns, chapels, courts = [], [], [], []
    # the outer wall, its four gates, and gatehouses standing out from it
    gn, ge = PLAN["gate_ns"], PLAN["gate_ew"]
    walls += _ring(F, o[0] + t / 2, o[1] - t / 2, o[2] + t / 2, o[3] - t / 2, t * F["sx"], L["outer_h"], "outer",
                   gaps=(("n", *gn), ("s", *gn), ("w", *ge), ("e", *ge)))
    for side in "nsew":
        if side in "ns":
            y = o[2] if side == "n" else o[3]
            d = -9 if side == "n" else 9
            for x in (gn[0] - 6, gn[1] + 6):
                walls.append(_wall(F, (x, y), (x, y + d), 2 * L["wall"], L["outer_h"] + 2, kind="gate"))
        else:
            x = o[0] if side == "w" else o[1]
            d = -9 if side == "w" else 9
            for y in (ge[0] - 6, ge[1] + 6):
                walls.append(_wall(F, (x, y), (x + d, y), 2 * L["wall"], L["outer_h"] + 2, kind="gate"))
    walls += _maze(F)
    # the inner wall, open only to the avenue north and south: from the west and east gates the way in is the maze
    walls += _ring(F, *i, L["wall"], L["inner_h"], "inner", gaps=(("n", *PLAN["avenue"]), ("s", *PLAN["avenue"])))
    # the small rooms along its north and south sides, either side of the avenue
    for (ya, yb) in PLAN["rooms_small"]:
        back = ya if ya < 400 else yb
        for (xa, xb) in PLAN["courts_x"]:
            walls.append(_wall(F, (xa, back), (xb, back), L["partition"], L["small_h"], kind="room"))
            for x in np.arange(xa, xb + 0.1, PLAN["small_w"]):
                walls.append(_wall(F, (x, ya), (x, yb), L["partition"], L["small_h"], kind="room"))
    # the ring of columns inside the inner wall
    for y in (i[2] + 9, i[3] - 9):
        columns += _columns(F, i[0] + 6, i[1] - 6, y, PLAN["col_step"])
    for x in (i[0] + 8, i[1] - 8):
        for y in np.arange(i[2] + 9 + PLAN["col_step"], i[3] - 9, PLAN["col_step"]):
            columns.append((float(F["X"](x)), float(F["Y"](y))))
    # the twelve courts
    for b, (ya, yb) in enumerate(PLAN["bands"]):
        depth = yb - ya
        r1, r2 = ya + L["rooms"] * depth, yb - L["rooms"] * depth
        for h, (xa, xb) in enumerate(PLAN["courts_x"]):
            inner_x = xb if h == 0 else xa                       # the side on the avenue: the court's door
            mid = (ya + yb) / 2
            walls += _ring(F, xa, xb, ya, yb, L["wall"], L["court_h"], "court",
                           gaps=(("e" if h == 0 else "w", mid - 4, mid + 4),))
            for (ra, rb) in ((ya, r1), (r2, yb)):
                outer_end = xa if h == 0 else xb
                for x in np.arange(xa + PLAN["room_w"], xb - 1, PLAN["room_w"]):
                    walls.append(_wall(F, (x, ra), (x, rb), L["partition"], L["room_h"], kind="room"))
                # the chapel at the row's outer end
                cx0, cx1 = (xa + 1, xa + PLAN["room_w"] - 1) if h == 0 else (xb - PLAN["room_w"] + 1, xb - 1)
                c = (float(F["X"](cx0)), float(F["X"](cx1)), float(F["Y"](rb - 1)), float(F["Y"](ra + 1)))
                chapels.append((min(c[0], c[1]), max(c[0], c[1]), c[2], c[3], 0.0, L["chapel_h"]))
            for y in (ya + 0.43 * depth, ya + 0.57 * depth):
                columns += _columns(F, xa + PLAN["room_w"], xb, y, PLAN["col_step"])
            courts.append(dict(band=b, half="west" if h == 0 else "east",
                               box=(float(F["X"](xa)), float(F["X"](xb)), float(F["Y"](yb)), float(F["Y"](ya))),
                               door=(float(F["X"](inner_x)), float(F["Y"](mid))),
                               rooms=2 * int((xb - xa - PLAN["room_w"]) // PLAN["room_w"])))
    return dict(walls=walls, columns=columns, chapels=chapels, courts=courts, frame=F)


def boxes_mesh(boxes):
    """Boxes (x0, x1, y0, y1, z0, z1) as one mesh: vertices (N, 3) and quad faces (M, 4)."""
    b = np.asarray(boxes, float).reshape(-1, 6)
    x0, x1, y0, y1, z0, z1 = b.T
    corners = np.stack([np.c_[x0, y0, z0], np.c_[x1, y0, z0], np.c_[x1, y1, z0], np.c_[x0, y1, z0],
                        np.c_[x0, y0, z1], np.c_[x1, y0, z1], np.c_[x1, y1, z1], np.c_[x0, y1, z1]], axis=1)
    verts = corners.reshape(-1, 3)
    f = np.array([(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)])
    faces = (f[None, :, :] + 8 * np.arange(len(b))[:, None, None]).reshape(-1, 4)
    return verts, faces
