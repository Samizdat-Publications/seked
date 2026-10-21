"""
The valley temple's pillared hall in plan, from Hölscher's Blatt XVII as scaled into data/measurements: its lines,
pillars, slits, statue sockets and where the statues stand. Free of bpy, so render/publish.py can draw the same
sockets over the panoramas that valley_temple.py stands the statues on.
"""
from . import data
from .rings import centroid

TEMPLE = "khafre.valley_temple"
FLOOR_LIFT = 0.1          # the floor stands this far over the ground the footprint is registered to


def _r():
    r = {r["key"]: r["value"] for r in data.records("giza-temples.json")}
    r.update({r["key"]: r["value"] for r in data.records("khafre-valley-temple.json")})
    return r


def plan():
    """
    The hall in the project frame: a dict of its lines (x east, y north, metres) and levels, the
    pillars as (x, y, side) and the slits as (x0, x1, y, side of the wall they open from).
    """
    r = _r()
    f = next(f for f in data.FOOTPRINTS if f["id"] == TEMPLE)
    cx, cy = centroid(f["ring"])                             # the point Hölscher's plate is registered to
    y_mid = cy + r["khafre_valley_temple.hall.pillar.row.north"] - r["khafre_valley_temple.pillar.pitch.north"] / 2
    long_len = (r["khafre.valley.hall.long.length.north"] + r["khafre.valley.hall.long.length.south"]) / 2
    trans_w = (r["khafre.valley.hall.transverse.width.west_band"] + r["khafre.valley.hall.transverse.width.row"]
               + r["khafre.valley.hall.transverse.width.east_band"])
    x_lw = cx + r["khafre_valley_temple.hall.stem.west"]
    x_w = x_lw + long_len
    x_e = x_w + trans_w
    trans_len = (r["khafre.valley.hall.transverse.length.west"] + r["khafre.valley.hall.transverse.length.east"]) / 2
    y_s, y_n = y_mid - trans_len / 2, y_mid + trans_len / 2
    aisles = [r["khafre.valley.hall.long.aisle.south"], r["khafre.valley.hall.long.aisle.middle"],
              r["khafre.valley.hall.long.aisle.north"]]
    side = r["khafre.valley.pillar.side"]
    big = r["khafre.valley.pillar.large.side"]
    long_w = sum(aisles) + 2 * side
    y_ls, y_ln = y_mid - long_w / 2, y_mid + long_w / 2
    pillars = []
    # The single colonnade: six pillars down the transverse hall at the mean gap, the ends taking up the rest.
    x_row = x_w + r["khafre.valley.hall.transverse.width.west_band"] + r["khafre.valley.hall.transverse.width.row"] / 2
    gap = r["khafre.valley.hall.transverse.row.gap"]
    run = 6 * side + 5 * gap
    first = y_mid - run / 2 + side / 2
    for k in range(6):
        pillars.append((x_row, first + k * (side + gap), side))
    # The double colonnade: two rows of four at the mean gap from the west wall, then the large pillar at the junction.
    row_y = [y_ls + aisles[0] + side / 2, y_ls + aisles[0] + side + aisles[1] + side / 2]
    lgap = r["khafre.valley.hall.long.row.gap"]
    long_xs = [x_lw + lgap + side / 2 + k * (side + lgap) for k in range(4)]
    x_big = x_w - big / 2
    for y in row_y:
        pillars += [(x, y, side) for x in long_xs]
        pillars.append((x_big, y, big))
    # The slits, over the bays between the pillars along the long hall's walls.
    edges = [x_lw] + long_xs + [x_big]
    slit = r["khafre.valley.slit.length"]
    slits = []
    for a, b in zip(edges[:-1], edges[1:]):
        c = (a + b) / 2
        slits += [(c - slit / 2, c + slit / 2, y_ls, -1), (c - slit / 2, c + slit / 2, y_ln, 1)]
    sockets = [cx + r["khafre_valley_temple.hall.socket.first.east"] + k * r["khafre_valley_temple.hall.socket.pitch"]
               for k in range(int(r["khafre_valley_temple.hall.socket.count"]))]
    floor = f["base"] + FLOOR_LIFT
    return dict(x_lw=x_lw, x_w=x_w, x_e=x_e, x_row=x_row, y_mid=y_mid, y_s=y_s, y_n=y_n, y_ls=y_ls, y_ln=y_ln,
                row_y=row_y, x_big=x_big, pillars=pillars, slits=slits, sockets=sockets, floor=floor, base=f["base"],
                pillar_h=r["khafre.valley.pillar.height"], single=r["khafre.valley.beam.single.depth"],
                double=r["khafre.valley.beam.double.depth"], ceiling_t=r["khafre.valley.colonnade.height"],
                ceiling_l=r["khafre.valley.pillar.height"] + r["khafre.valley.beam.double.depth"],
                passage_w=r["khafre.valley.hall.transverse.passage.width"], side=side, big=big)


def statue_spots(p=None):
    """
    Where the 23 statues stand, as (x, y, facing degrees from east): fourteen on Hölscher's socket
    rhythm along the long hall's north and south walls, facing across it, and nine along the
    transverse hall's walls (look choice), facing into it.
    """
    p = p or plan()
    spots = []
    off = 0.55
    for x in p["sockets"]:
        spots.append((x, p["y_ls"] + off, 90.0))
        spots.append((x, p["y_ln"] - off, -90.0))
    ym, half_pass = p["y_mid"], p["passage_w"] / 2
    for a, b in ((p["y_s"] + 1.6, ym - half_pass - 1.0), (ym + half_pass + 1.0, p["y_n"] - 1.6)):
        for k in range(2):
            spots.append((p["x_e"] - off, a + (b - a) * k, 180.0))              # the east wall, either side of the passage
    for a, b in ((p["y_s"] + 1.6, p["y_ls"] - 1.2), (p["y_ln"] + 1.2, p["y_n"] - 1.6)):
        for k in range(2):
            spots.append((p["x_w"] + off, a + (b - a) * k, 0.0))                # the west wall, either side of the long hall
    spots.append(((p["x_w"] + p["x_e"]) / 2, p["y_n"] - off, -90.0))           # the north end
    return spots
