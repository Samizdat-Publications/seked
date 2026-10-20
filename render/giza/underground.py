"""
What is said to lie under Khafre's pyramid, and what is known to. bpy-free: numpy and data/ only.

The claim is the Khafre Project's (data/measurements/g2-sar.json, every record "as claimed"): eight
wells in two north-south rows, wrapped in descending spirals, falling 648 m below the base into two
cubes about 80 m a side, and five "Zed" structures of five levels in the base. The press gives the
wells' diameter as 33 to 39 ft. Nothing else is published: no spacing, no offset, no pitch, no Zed
size, and the tomograms carry no scale bar. Everything in LOOK is therefore a stated look choice,
labelled wherever it is drawn (night decision 29), and changing one changes the picture and never a
receipt. The known rooms come from g2-interior.json. Frame: the project's, +X east, +Y north, +Z up,
with z measured from the Great Pyramid's base, so Khafre's base is at PYRAMIDS["g2"]["base"].
"""
import math

import numpy as np

from . import data

# Where several sources give a key, the first of these that does is used (the canonical preset's order).
PREFER = ("lehner-1997", "maragioglio-rinaldi-1966", "petrie-1883", "khafre-project-2025", "tbs-2025-khafre")

# Look choices: none of these is published by the claimants (night decision 29).
LOOK = dict(
    row_offset=50.0,      # each row's distance east or west of the axis, from the authors' 3D rendering
    well_spacing=22.0,    # north-south, between neighbouring wells in a row, about the centre
    spiral_pitch=24.0,    # metres the path drops in one turn
    spiral_gap=3.0,       # the path's clear distance outside the well's wall
    spiral_width=2.0,     # the path's own width
    cube_under="row",     # each row of four falls into its own cube ("each with four shafts", TBS)
    zed_size=(10.0, 4.0),  # east-west, north-south footprint of one Zed
    zed_spacing=8.0,      # north-south, centre to centre
    zed_level=1.6,        # the height of one of its five levels
    zed_roof=2.4,         # the sloping roof's rise over the top level
    zed_floor=8.0,        # the lowest level's floor, above Khafre's base, clear of the burial chamber
)


def _value(recs, key, prefer=PREFER):
    found = [r for r in recs if r["key"] == key]
    if not found:
        raise KeyError(key)
    rank = {s: i for i, s in enumerate(prefer)}
    return float(min(found, key=lambda r: rank.get(r["source"], len(rank)))["value"])


def claim():
    """The claimed figures, as entered."""
    sar = data.records("g2-sar.json")
    v = lambda k: _value(sar, k)  # noqa: E731
    return dict(
        wells=int(v("g2.sar.wells.count")), rows=int(v("g2.sar.wells.rows")),
        bottom=v("g2.sar.wells.bottom.up"), cubes=int(v("g2.sar.cubes.count")), cube=v("g2.sar.cube.side"),
        zeds=int(v("g2.sar.zeds.count")), zed_levels=int(v("g2.sar.zed.levels")), deep=v("g2.sar.deep.up"),
        diameter=(v("g2.sar.well.diameter.min"), v("g2.sar.well.diameter.max")),
        radar=v("g2.sar.radar.penetration.max"),
    )


def khafre():
    """Khafre's centre and base level in the frame, and its side and original height from the records."""
    P = data.PYRAMIDS["g2"]
    recs = data.records("g2-g3-sphinx.json")
    return dict(cx=P["cx"], cy=P["cy"], base=P["base"],
                side=_value(recs, "g2.base.side.mean"), H=_value(recs, "g2.height.original"))


def wells(c=None, k=None, look=LOOK):
    """Each well: its axis (x, y), top and bottom z, and radius. Two rows, east and west of the axis."""
    c, k = c or claim(), k or khafre()
    per_row = c["wells"] // c["rows"]
    radius = sum(c["diameter"]) / 4        # half the mean of the press's 33 and 39 ft
    out = []
    for r in range(c["rows"]):
        x = k["cx"] + look["row_offset"] * (2 * r - (c["rows"] - 1)) / max(c["rows"] - 1, 1)
        for i in range(per_row):
            y = k["cy"] + look["well_spacing"] * (i - (per_row - 1) / 2)
            out.append(dict(row=r, x=x, y=y, top=k["base"], bottom=k["base"] + c["bottom"], radius=radius))
    return out


def helix(w, look=LOOK, step_deg=10.0):
    """The spiral path round one well, as points from its top to its bottom: (N, 3)."""
    R = w["radius"] + look["spiral_gap"] + look["spiral_width"] / 2
    turns = (w["top"] - w["bottom"]) / look["spiral_pitch"]
    t = np.linspace(0.0, turns * 2 * math.pi, int(math.ceil(turns * 360.0 / step_deg)) + 1)
    z = w["top"] - (w["top"] - w["bottom"]) * t / t[-1]
    return np.stack([w["x"] + R * np.cos(t), w["y"] + R * np.sin(t), z], axis=1)


def cubes(c=None, k=None, look=LOOK):
    """Each cube: centre and side. Its top is the wells' bottom, so it lies wholly below the claimed 648 m."""
    c, k = c or claim(), k or khafre()
    ws = wells(c, k, look)
    out = []
    for r in range(c["cubes"]):
        mine = [w for w in ws if w["row"] == r]
        x = sum(w["x"] for w in mine) / len(mine)
        y = sum(w["y"] for w in mine) / len(mine)
        out.append(dict(x=x, y=y, z=k["base"] + c["bottom"] - c["cube"] / 2, side=c["cube"], wells=len(mine)))
    return out


def zeds(c=None, k=None, look=LOOK):
    """The five Zeds in the base: each a list of level boxes (x0, x1, y0, y1, z0, z1) and a roof rise."""
    c, k = c or claim(), k or khafre()
    ex, ny = look["zed_size"]
    out = []
    for i in range(c["zeds"]):
        y = k["cy"] + look["zed_spacing"] * (i - (c["zeds"] - 1) / 2)
        z0 = k["base"] + look["zed_floor"]
        levels = [(k["cx"] - ex / 2, k["cx"] + ex / 2, y - ny / 2, y + ny / 2,
                   z0 + j * look["zed_level"], z0 + (j + 1) * look["zed_level"]) for j in range(c["zed_levels"])]
        out.append(dict(levels=levels, roof=look["zed_roof"]))
    return out


def stack(depth, H):
    """Khafre's height laid end to end down a depth: the top and bottom z (from 0) of each whole or part."""
    n = depth / H
    whole = int(math.floor(n + 1e-9))
    out = [(-i * H, -(i + 1) * H, 1.0) for i in range(whole)]
    if n - whole > 1e-9:
        out.append((-whole * H, -depth, n - whole))
    return out


def known_rooms(k=None):
    """Khafre's burial chamber and the passages to it, as boxes (x0, x1, y0, y1, z0, z1) from g2-interior.json."""
    k = k or khafre()
    rec = data.records("g2-interior.json")
    v = lambda key: _value(rec, key)  # noqa: E731
    cx, cy, b = k["cx"], k["cy"], k["base"]
    half, cot = k["side"] / 2, (k["side"] / 2) / k["H"]
    floor = v("g2.chamber.great.floor.up")
    x0 = cx + v("g2.chamber.great.wall.west.east")
    y0 = cy + v("g2.chamber.great.wall.south.north")
    chamber = (x0, x0 + v("g2.chamber.great.length.north"), y0, y0 + v("g2.chamber.great.width.east"),
               b + floor, b + floor + v("g2.chamber.great.wall.height"))
    ex, ez = cx + v("g2.entrance.floor.begin.east"), v("g2.entrance.floor.begin.up")
    ey = cy + half - ez * cot                                     # where the entrance meets the north face
    lz = v("g2.passage.horizontal.floor.begin.up")
    run = (ez - lz) / math.tan(math.radians(-v("g2.passage.descending.angle")))
    dw, dh = v("g2.passage.descending.width"), v("g2.passage.descending.height")
    hw, hh = v("g2.passage.horizontal.width"), v("g2.passage.horizontal.height")
    descending = dict(start=(ex, ey, b + ez), end=(ex, ey - run, b + lz), width=dw, height=dh)
    horizontal = (ex - hw / 2, ex + hw / 2, chamber[3], ey - run, b + lz, b + lz + hh)
    return dict(chamber=chamber, descending=descending, horizontal=horizontal)


def khufu_base_msl():
    """Khufu's base above sea level: GLO-30's ground round it (EGM2008), as the scene itself sets it, not typed.

    The plateau slopes and GLO-30 is a surface model, so this is good to a metre or two."""
    return data.ORIGIN_ELEVATION + data.ring_median(0.0, 0.0, 150.0)


def reply_levels(c=None, k=None):
    """The reply's three lines, as z in the frame: radar's reach by the claimant's own figure, the water table, the claim."""
    c, k = c or claim(), k or khafre()
    water = _value(data.records("groundwater.json"), "giza.watertable.elevation")
    return dict(radar=k["base"] - c["radar"], water=water - khufu_base_msl(), claim=k["base"] + c["bottom"])


def receipts(c=None, k=None):
    """The chapter's computed labels: the depth in Khafre's heights, and against the deepest known room."""
    c, k = c or claim(), k or khafre()
    rooms = known_rooms(k)
    deepest = min(rooms["chamber"][4], rooms["horizontal"][4]) - k["base"]
    lv = reply_levels(c, k)
    return dict(heights=-c["bottom"] / k["H"], times_deepest_room=c["bottom"] / deepest,
                deep_heights=-c["deep"] / k["H"], water_below_base=k["base"] - lv["water"],
                below_water=lv["water"] - lv["claim"], times_radar=-c["bottom"] / c["radar"])


# The descent, for chapter 8's sequence: the camera holds one offset from what it looks at and goes straight down with it,
# from Khafre's base to the middle of the claimed cubes under the wells, placed by the geometry from the claim's records.
# The start and the offset are look choices, like the shots in render/underground.py.
DESCENT = dict(top=(0.0, 40.0, 30.0), offset=(-650.0, -380.0, 120.0))


def descent(t, k, c):
    """The descent's shot at `t`, 0 at the base to 1 at the cubes, eased in and out so the scroll starts and stops gently."""
    e = t * t * (3 - 2 * t)
    cs = cubes(c, k)
    bottom = (sum(q["x"] for q in cs) / len(cs) - k["cx"], sum(q["y"] for q in cs) / len(cs) - k["cy"],
              sum(q["z"] for q in cs) / len(cs) - k["base"])
    target = tuple(a + (b - a) * e for a, b in zip(DESCENT["top"], bottom))
    return dict(target=target, location=tuple(a + b for a, b in zip(target, DESCENT["offset"])))
