"""
Read the Seked measurement database from inside Blender (or plain Python).

Standard library only, so it runs in Blender's bundled interpreter. It mirrors
the TypeScript packages closely: `resolve` is packages/data, `pyramid_params`
and `pyramid_geometry` are packages/geometry. A test in packages/data checks
that this resolver and the TypeScript one agree on every value.
"""
from __future__ import annotations

import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA_DIR = os.path.join(ROOT, "data")


def _read(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_database(data_dir=DATA_DIR):
    sources = _read(os.path.join(data_dir, "sources.json"))
    presets = _read(os.path.join(data_dir, "presets.json"))
    measurements = []
    mdir = os.path.join(data_dir, "measurements")
    for name in sorted(os.listdir(mdir)):
        if not name.endswith(".json"):
            continue
        for row in _read(os.path.join(mdir, name)):
            row = dict(row)
            row.setdefault("verified", False)
            row["file"] = name
            measurements.append(row)
    ids = {s["id"] for s in sources}
    for m in measurements:
        if m["source"] not in ids:
            raise ValueError(f'{m["file"]}: {m["key"]} cites unknown source "{m["source"]}"')
    return {"sources": sources, "measurements": measurements, "presets": presets}


def resolve(db, preset_id):
    """One record per key: the earliest source in the preset's list wins."""
    preset = next((p for p in db["presets"] if p["id"] == preset_id), None)
    if preset is None:
        raise ValueError(f'unknown preset "{preset_id}"')
    order = preset["sources"]

    def rank(source):
        return order.index(source) if source in order else len(order)

    records = {}
    for m in db["measurements"]:
        cur = records.get(m["key"])
        if cur is None or rank(m["source"]) < rank(cur["source"]):
            records[m["key"]] = m
    values = {k: r["value"] for k, r in records.items()}
    return {"preset": preset, "records": records, "values": values}


def pyramid_params(values, structure):
    """Base, height, today's height, concavity and orientation for one pyramid, or None."""
    base = values.get(f"{structure}.base.side.mean")
    height = values.get(f"{structure}.height.original")
    if base is None or height is None:
        return None
    return {
        "base": base,
        "height": height,
        "height_today": values.get(f"{structure}.height.today"),
        "concavity": values.get(f"{structure}.concavity", 0.0),
        "orientation_deg": values.get(f"{structure}.orientation", 0.0),
        "offset_east": -values.get(f"{structure}.centre.offset.west", 0.0),
        "offset_north": -values.get(f"{structure}.centre.offset.south", 0.0),
        "offset_up": values.get(f"{structure}.base.elevation.relative", 0.0),
    }


def _ring(half, indent, z):
    # Counter-clockwise from above, starting at the north-east corner. Same order as packages/geometry.
    return [
        (half, half, z), (0.0, half - indent, z), (-half, half, z), (-half + indent, 0.0, z),
        (-half, -half, z), (0.0, -half + indent, z), (half, -half, z), (half - indent, 0.0, z),
    ]


def pyramid_geometry(base, height, truncate_at=None, concavity=0.0):
    """
    Vertices and polygon faces for an eight-sided pyramid in the project frame
    (origin at the base centre, +X east, +Y north, +Z up). Faces wind
    counter-clockwise seen from outside.
    """
    half = base / 2.0
    verts = list(_ring(half, concavity, 0.0))
    faces = []
    truncated = truncate_at is not None and truncate_at < height
    if truncated:
        k = (height - truncate_at) / height
        verts.extend(_ring(half * k, concavity * k, truncate_at))
        for i in range(8):
            j = (i + 1) % 8
            faces.append((i, j, 8 + j, 8 + i))
        faces.append(tuple(8 + i for i in range(8)))          # top cap, CCW from above
    else:
        verts.append((0.0, 0.0, height))
        for i in range(8):
            faces.append((i, (i + 1) % 8, 8))
    faces.append(tuple(range(7, -1, -1)))                     # base cap, CW from above so it faces down
    return verts, faces


def polyhedron_volume(verts, faces):
    """Signed volume from outward-wound polygon faces (fan-triangulated)."""
    total = 0.0
    for face in faces:
        a = verts[face[0]]
        for i in range(1, len(face) - 1):
            b, c = verts[face[i]], verts[face[i + 1]]
            total += (
                a[0] * (b[1] * c[2] - b[2] * c[1])
                - a[1] * (b[0] * c[2] - b[2] * c[0])
                + a[2] * (b[0] * c[1] - b[1] * c[0])
            )
    return total / 6.0


def square_pyramid_volume(base, height):
    return base * base * height / 3.0


# --- Interior solids -------------------------------------------------------
# Mirrors packages/geometry/src/interior.ts. Passages, chambers and corbelled
# galleries are separate objects in the project frame (origin at the Great
# Pyramid's base centre, +X east, +Y north, +Z up, metres), with the same
# vertex order as the TypeScript builders so the two can be compared.

_FLAT = 1e-12
_DEG = math.pi / 180.0


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _section_frame(start, end, height_mode):
    """
    Width is horizontal and square to the axis's horizontal projection; up is
    the direction a section's heights are measured in. A vertical axis has no
    horizontal projection to be square to, so width falls back to east and, in
    perpendicular mode, the heights then run north.
    """
    d = (end[0] - start[0], end[1] - start[1], end[2] - start[2])
    run = math.hypot(d[0], d[1])
    width = (-d[1] / run, d[0] / run, 0.0) if run > _FLAT else (1.0, 0.0, 0.0)
    if height_mode == "vertical":
        if run <= _FLAT:
            raise ValueError("extruded_section: vertical heights need an axis with a horizontal run")
        return width, (0.0, 0.0, 1.0)
    length = math.hypot(d[0], d[1], d[2])
    axis = (d[0] / length, d[1] / length, d[2] / length)
    # (axis, width, up) is right-handed, so up leans with the sloping floor.
    return width, _cross(axis, width)


def extruded_section(start, end, section, height_mode="perpendicular"):
    """
    Extrude a mirrored [half_width, height] cross-section along the straight
    axis from start to end, both points on the floor centre line.

    Vertices are the near-end outline and then the far-end outline, so a
    section of n pairs gives 4n. Within one outline, index k is section pair k
    on the +width side and 2n-1-k is its mirror, which walks counter-clockwise
    in the (width, up) plane. Faces are polygons wound counter-clockwise seen
    from outside: one quad per outline edge, then a ladder of cells between the
    two mirrored halves at each end. The zero-height cells at a corbel step are
    kept rather than skipped, because they are what keeps the end caps
    edge-manifold with the ledge faces; they enclose no volume.
    """
    n = len(section)
    if n < 2:
        raise ValueError("extruded_section: a section needs at least two [half_width, height] pairs")
    for k in range(1, n):
        if section[k][1] < section[k - 1][1]:
            raise ValueError("extruded_section: section heights must not decrease")
    width, up = _section_frame(start, end, height_mode)

    m = 2 * n
    outline = [None] * m
    for k in range(n):
        hw, h = section[k]
        outline[k] = (width[0] * hw + up[0] * h, width[1] * hw + up[1] * h, width[2] * hw + up[2] * h)
        outline[m - 1 - k] = (up[0] * h - width[0] * hw, up[1] * h - width[1] * hw, up[2] * h - width[2] * hw)

    verts = [(start[0] + p[0], start[1] + p[1], start[2] + p[2]) for p in outline]
    verts += [(end[0] + p[0], end[1] + p[1], end[2] + p[2]) for p in outline]

    faces = []
    for k in range(m):
        j = (k + 1) % m
        faces.append((k, j, m + j, m + k))           # wall along outline edge k
    for i in range(n - 1):
        a, b, c, d = i, i + 1, m - 2 - i, m - 1 - i
        faces.append((m + a, m + b, m + c, m + d))   # far cap, faces along the axis
        faces.append((d, c, b, a))                   # near cap, faces back against it
    return verts, faces


def passage(start, end, width, height, height_mode="perpendicular"):
    """A passage of constant rectangular section: extruded_section with two pairs."""
    half = width / 2.0
    return extruded_section(start, end, [(half, 0.0), (half, height)], height_mode)


CORNERS = ("NE", "NW", "SW", "SE")


def chamber(mn, mx, gable=None):
    """
    An axis-aligned chamber from mn to mx, optionally with a pitched roof above
    the wall tops. `gable` is {"ridge_height": metres above the floor, "axis":
    "x" or "y"}, the axis being the horizontal direction the ridge runs along.

    Vertices 0-3 are the floor ring and 4-7 the wall-top ring, both counter-
    clockwise seen from above starting north-east, matching CORNERS; then, when
    gabled, the two ridge ends, east first for a ridge along x and north first
    for one along y.
    """
    x0, y0, z0 = mn
    x1, y1, z1 = mx
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    plan = [(x1, y1), (x0, y1), (x0, y0), (x1, y0)]
    verts = [(x, y, z0) for x, y in plan] + [(x, y, z1) for x, y in plan]

    faces = [(0, 3, 2, 1)]                           # floor, clockwise from above so it faces down
    for i in range(4):
        j = (i + 1) % 4
        faces.append((i, j, 4 + j, 4 + i))           # walls
    if gable is None:
        faces.append((4, 5, 6, 7))                   # flat ceiling, counter-clockwise from above
    else:
        rz = z0 + gable["ridge_height"]
        if gable["axis"] == "x":
            verts += [(x1, cy, rz), (x0, cy, rz)]    # 8 east end, 9 west end
            faces += [(4, 5, 9, 8),                  # north slope
                      (6, 7, 8, 9),                  # south slope
                      (4, 8, 7),                     # east gable end
                      (5, 6, 9)]                     # west gable end
        else:
            verts += [(cx, y1, rz), (cx, y0, rz)]    # 8 north end, 9 south end
            faces += [(7, 4, 8, 9),                  # east slope
                      (5, 6, 9, 8),                  # west slope
                      (4, 5, 8),                     # north gable end
                      (6, 7, 9)]                     # south gable end
    return verts, faces


# The Grand Gallery as a five-step corbel, half-widths narrowing upward.
GALLERY_SECTION = [
    (1.047, 0.00), (1.047, 2.29),
    (0.970, 2.29), (0.970, 2.75),
    (0.893, 2.75), (0.893, 3.21),
    (0.816, 3.21), (0.816, 3.67),
    (0.739, 3.67), (0.739, 4.13),
]


def shape_cases():
    """
    Literal interior solids in metres, for the parity test in packages/data.
    They read nothing from data/: the numbers are here to be identical on both
    sides of the comparison, not to be measurements.
    """
    cases = []

    def add(name, built):
        verts, faces = built
        cases.append({"name": name,
                      "verts": [list(v) for v in verts],
                      "faces": [list(f) for f in faces],
                      "volume": polyhedron_volume(verts, faces)})

    slope = 26.5 * _DEG
    add("sloped_passage", passage(
        (0.0, 24.0, 17.0),
        (0.0, 24.0 - 40.0 * math.cos(slope), 17.0 - 40.0 * math.sin(slope)),
        1.05, 1.20, "perpendicular"))
    add("level_passage", passage((0.0, 0.0, 21.0), (0.0, -38.7, 21.0), 1.05, 1.17, "vertical"))
    add("box_chamber", chamber((-5.235, -2.615, 43.0), (5.235, 2.615, 48.85)))
    walls, ridge = 184.47 * 0.0254, 245.1 * 0.0254
    add("gabled_chamber", chamber((-2.615, -2.875, 21.0), (2.615, 2.875, 21.0 + walls),
                                  {"ridge_height": ridge, "axis": "x"}))
    gallery_slope = 26.2 * _DEG
    add("corbelled_gallery", extruded_section(
        (0.0, 0.0, 22.0),
        (0.0, -46.12 * math.cos(gallery_slope), 22.0 + 46.12 * math.sin(gallery_slope)),
        GALLERY_SECTION, "perpendicular"))
    # Two controls on an oblique bearing, where the width direction and the two
    # height modes are the easiest things to mirror wrongly.
    oblique_start, oblique_end = (-12.5, 18.0, 5.0), (14.0, -9.0, -6.5)
    add("oblique_perpendicular", passage(oblique_start, oblique_end, 1.05, 1.20, "perpendicular"))
    add("oblique_vertical", passage(oblique_start, oblique_end, 1.05, 1.20, "vertical"))
    return cases


def geometry_variants(values, structure):
    """Every mesh the generator builds for one pyramid, for parity tests against packages/geometry."""
    p = pyramid_params(values, structure)
    if p is None:
        return []
    specs = [("as_built_flat", None, 0.0), ("as_built", None, p["concavity"])]
    if p["height_today"]:
        specs += [("today_flat", p["height_today"], 0.0), ("today", p["height_today"], p["concavity"])]
    out = []
    for name, truncate_at, concavity in specs:
        verts, faces = pyramid_geometry(p["base"], p["height"], truncate_at=truncate_at, concavity=concavity)
        out.append({"name": name, "truncate_at": truncate_at, "concavity": concavity, "verts": verts,
                    "faces": [list(f) for f in faces], "volume": polyhedron_volume(verts, faces)})
    return out


if __name__ == "__main__":
    if "--shapes" in sys.argv:
        # Literal interior solids, so this mode works without reading data/.
        print(json.dumps(shape_cases()))
        sys.exit(0)
    preset = sys.argv[1] if len(sys.argv) > 1 else "canonical"
    db = load_database()
    r = resolve(db, preset)
    if "--geometry" in sys.argv:
        print(json.dumps({s: geometry_variants(r["values"], s) for s in ("g1", "g2", "g3")}))
    elif "--check" in sys.argv:
        p = pyramid_params(r["values"], "g1")
        v, f = pyramid_geometry(p["base"], p["height"], concavity=0.0)
        got, want = polyhedron_volume(v, f), square_pyramid_volume(p["base"], p["height"])
        assert abs(got - want) / want < 1e-12, (got, want)
        v, f = pyramid_geometry(p["base"], p["height"], truncate_at=p["height_today"], concavity=p["concavity"])
        assert polyhedron_volume(v, f) < want
        print(f"ok: g1 base {p['base']} m, height {p['height']} m, volume {want:,.0f} m³, {len(v)} verts")
    else:
        print(json.dumps(r["values"], sort_keys=True))


def load_terrain(data_dir=DATA_DIR, name="giza-glo30"):
    """
    The local heightfield cut from the Copernicus GLO-30 DEM by scripts/terrain.py.

    Returns (header, heights): the header dict and a flat list of metres,
    row-major, rows south to north and columns west to east, so the sample at
    column i of row j is heights[j * header["nx"] + i]. Heights are orthometric
    on EGM2008 and include the monuments, edited: see the header's note before
    treating anything near a pyramid as ground.
    """
    import array   # imported here so this function can be appended without touching the imports above

    header = _read(os.path.join(data_dir, "terrain", name + ".json"))
    path = os.path.join(data_dir, "terrain", header["heights"])
    with open(path, "rb") as f:
        raw = f.read()
    count = header["nx"] * header["ny"]
    if header["dtype"] != "float32" or header["layout"] != "row-major":
        raise ValueError(f'{path}: expected row-major float32, got {header["dtype"]} {header["layout"]}')
    if len(raw) != count * 4:
        raise ValueError(f"{path}: {len(raw)} bytes for {count} samples of float32")
    heights = array.array("f")
    heights.frombytes(raw)
    if sys.byteorder != header["byteOrder"].split("-")[0]:
        heights.byteswap()
    return header, list(heights)


def terrain_sample(header, heights, x, y):
    """Height at local east x and north y, in metres, by bilinear interpolation."""
    nx, ny, spacing = header["nx"], header["ny"], header["spacing"]
    fx = (x - header["x0"]) / spacing
    fy = (y - header["y0"]) / spacing
    if not (0.0 <= fx <= nx - 1 and 0.0 <= fy <= ny - 1):
        raise ValueError(f"({x}, {y}) is outside the heightfield")
    ix = min(int(math.floor(fx)), nx - 2)
    iy = min(int(math.floor(fy)), ny - 2)
    tx, ty = fx - ix, fy - iy
    bottom = heights[iy * nx + ix] * (1 - tx) + heights[iy * nx + ix + 1] * tx
    top = heights[(iy + 1) * nx + ix] * (1 - tx) + heights[(iy + 1) * nx + ix + 1] * tx
    return bottom * (1 - ty) + top * ty


# A few fixed points, on and between grid nodes, for the parity test in packages/data.
TERRAIN_PROBES = [
    (0.0, 0.0), (-3000.0, -3000.0), (3000.0, 3000.0), (-3000.0, 3000.0), (3000.0, -3000.0),
    (-334.41, -353.86), (-574.45, -739.19), (1414.21, 1414.21),
    (-1234.5, 987.25), (17.3, -42.8), (625.5, -1375.25), (-2999.75, 2999.75),
]

if __name__ == "__main__" and "--terrain" in sys.argv:
    # Appended rather than folded into the main block above, so this file only ever grows.
    # The block above has already printed the resolved values, so the terrain JSON is the last line.
    _header, _heights = load_terrain()
    print(json.dumps({
        "file": _header["heights"],
        "sha256": _header["sha256"],
        "count": len(_heights),
        "samples": [{"x": x, "y": y, "h": terrain_sample(_header, _heights, x, y)} for x, y in TERRAIN_PROBES],
    }))


# --- The Great Pyramid's interior, wired to the database ------------------
# Mirrors packages/geometry/src/interiors.ts: same solids, same order, same
# vertex order. The shape builders above know only metres; this part names the
# solids and says which records fix each one, so a solid whose records a preset
# does not carry is skipped rather than guessed at.

_SHARED_SECTION = ("passage.descending.width", "passage.descending.height")


def _point_keys(base):
    """The records that fix one stored point."""
    return [base + ".north", base + ".east", base + ".up"]


def _value(values, key):
    v = values.get(key)
    if v is None:
        raise ValueError("interior_solids: %s is not in the environment" % key)
    return v


def _point(values, base):
    """A stored point as (east, north, up), the project frame's x, y, z."""
    return (_value(values, base + ".east"), _value(values, base + ".north"), _value(values, base + ".up"))


def _box(a, b):
    """A box from two opposite corners in any order."""
    return ((min(a[0], b[0]), min(a[1], b[1]), min(a[2], b[2])),
            (max(a[0], b[0]), max(a[1], b[1]), max(a[2], b[2])))


def _gallery_section(values):
    """
    The Grand Gallery's cross-section: the full floor, ramps included,
    narrowing by one lap's overhang at each corbel step up to a roof as wide as
    the floor between the ramps. Section 46 gives the number of laps and the
    20.55 in total overhang but only one lap's height, so the steps are spread
    evenly over gg.height: the widths are measured, the heights are a
    placeholder until the lap levels are entered as records.
    """
    overhang = _value(values, "gg.ramp.width")
    half_floor = _value(values, "gg.floor.width") / 2.0 + overhang
    laps = int(round(_value(values, "gg.corbel.count")))
    bands = laps + 1
    band = _value(values, "gg.height") / bands
    section = []
    for i in range(bands):
        half_width = half_floor - (i * overhang) / laps
        section.append((half_width, i * band))
        section.append((half_width, (i + 1) * band))
    return section


def _build_descending(v):
    # The entrance passage, from the true beginning of its floor in the north
    # face down to the flat end cut in the rock.
    return passage(_point(v, "entrance.floor.begin"), _point(v, "passage.descending.floor.end"),
                   _value(v, "passage.descending.width"), _value(v, "passage.descending.height"))


def _build_subterranean_north(v):
    # Section 37 measures this horizontal passage at about 32 wide and 35.5 to
    # 36.0 high, smaller than the entrance passage, but neither figure is in the
    # database yet, so the entrance passage's section stands in here and below.
    return passage(_point(v, "passage.descending.floor.end"), _point(v, "passage.subterranean_north.end"),
                   _value(v, "passage.descending.width"), _value(v, "passage.descending.height"))


def _build_subterranean_chamber(v):
    # Section 64's level for the large chamber is the roof, not the floor, so
    # the box hangs below the stored centre by section 37's 140 in: the floor
    # was never cut to one plane and runs 140 to 198 in under the roof.
    east, north, roof = _point(v, "chamber.subterranean.centre")
    length = (_value(v, "chamber.subterranean.length.north") + _value(v, "chamber.subterranean.length.south")) / 2.0
    width = (_value(v, "chamber.subterranean.width.east") + _value(v, "chamber.subterranean.width.west")) / 2.0
    height = _value(v, "chamber.subterranean.height")
    return chamber((east - length / 2.0, north - width / 2.0, roof - height),
                   (east + length / 2.0, north + width / 2.0, roof))


def _build_subterranean_south(v):
    # The rough southern drift-way out of the chamber's S. wall.
    return passage(_point(v, "passage.subterranean_south.begin"), _point(v, "passage.subterranean_south.end"),
                   _value(v, "passage.descending.width"), _value(v, "passage.descending.height"))


def _build_ascending(v):
    return passage(_point(v, "passage.ascending.floor.begin"), _point(v, "passage.ascending.floor.end"),
                   _value(v, "passage.ascending.width"), _value(v, "passage.ascending.height"))


def _build_queens_chamber_passage(v):
    # Leaves the floor at the north end of the gallery, on the ascending
    # passage's axis carried through (section 39 takes that axis as parallel to
    # the Pyramid's side), and runs south to the chamber's north wall at the
    # chamber's floor level. Section 38 states the passages of the Pyramid as
    # one section, 41.6 wide by 47 perpendicular, so the entrance passage's
    # width and height are used here.
    east = _value(v, "passage.ascending.floor.begin.east")
    floor = _value(v, "qc.corner.ne.up")
    return passage((east, _value(v, "passage.ascending.floor.end.north"), floor),
                   (east, _value(v, "qc.corner.ne.north"), floor),
                   _value(v, "passage.descending.width"), _value(v, "passage.descending.height"))


def _build_queens_chamber(v):
    # Hung off the north-east floor corner: west by qc.length, south by
    # qc.width, up by the wall height, the gabled ridge running east to west.
    east, north, floor = _point(v, "qc.corner.ne")
    return chamber((east - _value(v, "qc.length"), north - _value(v, "qc.width"), floor),
                   (east, north, floor + _value(v, "qc.wall.height")),
                   {"ridge_height": _value(v, "qc.gable.height"), "axis": "x"})


def _build_gallery(v):
    # From the top of the ascending passage to the virtual south end of the
    # floor: the slope carried on through the great step to the south wall.
    return extruded_section(_point(v, "passage.ascending.floor.end"),
                            _point(v, "gg.floor.virtual_south_end"), _gallery_section(v))


def _build_antechamber(v):
    # Between the two points section 64 stores for it, the north end of the
    # floor and the south end of the roof, with the width centred on the
    # passage axis those two share.
    north = _point(v, "antechamber.floor.north_end")
    south = _point(v, "antechamber.roof.south_end")
    half = _value(v, "antechamber.width") / 2.0
    axis = (north[0] + south[0]) / 2.0
    mn, mx = _box((axis - half, north[1], north[2]), (axis + half, south[1], south[2]))
    return chamber(mn, mx)


def _build_kings_chamber(v):
    # From the four measured wall positions and the two measured levels. Its own
    # kc.length, kc.width and kc.height are Petrie's means of the wall faces and
    # are not used to build it, so the two agree only as well as the survey does.
    mn, mx = _box((_value(v, "kc.wall.west.east"), _value(v, "kc.wall.south.north"), _value(v, "kc.floor.elevation")),
                  (_value(v, "kc.wall.east.east"), _value(v, "kc.wall.north.north"), _value(v, "kc.ceiling.up")))
    return chamber(mn, mx)


# (name, records it is built from, builder), in order from the entrance down and then up.
INTERIOR_BUILDERS = [
    ("passage.descending",
     _point_keys("entrance.floor.begin") + _point_keys("passage.descending.floor.end") + list(_SHARED_SECTION),
     _build_descending),
    ("passage.subterranean_north",
     _point_keys("passage.descending.floor.end") + _point_keys("passage.subterranean_north.end") + list(_SHARED_SECTION),
     _build_subterranean_north),
    ("chamber.subterranean",
     _point_keys("chamber.subterranean.centre") + [
         "chamber.subterranean.length.north", "chamber.subterranean.length.south",
         "chamber.subterranean.width.east", "chamber.subterranean.width.west",
         "chamber.subterranean.height"],
     _build_subterranean_chamber),
    ("passage.subterranean_south",
     _point_keys("passage.subterranean_south.begin") + _point_keys("passage.subterranean_south.end") + list(_SHARED_SECTION),
     _build_subterranean_south),
    ("passage.ascending",
     _point_keys("passage.ascending.floor.begin") + _point_keys("passage.ascending.floor.end")
     + ["passage.ascending.width", "passage.ascending.height"],
     _build_ascending),
    ("passage.queens_chamber",
     ["passage.ascending.floor.begin.east", "passage.ascending.floor.end.north",
      "qc.corner.ne.north", "qc.corner.ne.up"] + list(_SHARED_SECTION),
     _build_queens_chamber_passage),
    ("qc",
     _point_keys("qc.corner.ne") + ["qc.length", "qc.width", "qc.wall.height", "qc.gable.height"],
     _build_queens_chamber),
    ("gg",
     _point_keys("passage.ascending.floor.end") + _point_keys("gg.floor.virtual_south_end")
     + ["gg.floor.width", "gg.ramp.width", "gg.corbel.count", "gg.height"],
     _build_gallery),
    ("antechamber",
     _point_keys("antechamber.floor.north_end") + _point_keys("antechamber.roof.south_end") + ["antechamber.width"],
     _build_antechamber),
    ("kc",
     ["kc.wall.north.north", "kc.wall.south.north", "kc.wall.east.east", "kc.wall.west.east",
      "kc.floor.elevation", "kc.ceiling.up"],
     _build_kings_chamber),
]


def interior_solids(values):
    """
    The Great Pyramid's interior as named solids, built from resolved values.

    Returns a list of {"name", "keys", "verts", "faces", "volume"} in the same
    order as interiorSolids in packages/geometry, skipping any solid whose
    records the preset does not carry: presets differ, and a missing room is
    better than an invented one.
    """
    out = []
    for name, keys, build in INTERIOR_BUILDERS:
        if any(values.get(k) is None for k in keys):
            continue
        verts, faces = build(values)
        out.append({"name": name, "keys": list(keys),
                    "verts": [list(v) for v in verts], "faces": [list(f) for f in faces],
                    "volume": polyhedron_volume(verts, faces)})
    return out


def load_sites(data_dir=DATA_DIR):
    """The site list, so nothing has to assume Giza or its datum."""
    return _read(os.path.join(data_dir, "sites.json"))


def site_origin_elevation(site_id="giza", data_dir=DATA_DIR):
    """Elevation of a site's frame origin above its vertical datum, in metres."""
    for site in load_sites(data_dir):
        if site["id"] == site_id:
            return site["origin"]["elevation"]
    raise ValueError('unknown site "%s"' % site_id)


if __name__ == "__main__" and "--interior" in sys.argv:
    # Appended, like the terrain block, so this file only ever grows. The block
    # above has already printed the resolved values, so the interior JSON is the
    # last line.
    _preset = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else "canonical"
    print(json.dumps(interior_solids(resolve(load_database(), _preset)["values"])))
