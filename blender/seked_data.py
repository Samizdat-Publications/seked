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
    """Base, height, today's height, courses, concavity and orientation for one pyramid, or None."""
    base = values.get(f"{structure}.base.side.mean")
    height = values.get(f"{structure}.height.original")
    if base is None or height is None:
        return None
    return {
        "base": base,
        "height": height,
        "height_today": values.get(f"{structure}.height.today"),
        "courses": course_heights(values, structure),
        "concavity": values.get(f"{structure}.concavity", 0.0),
        "orientation_deg": values.get(f"{structure}.orientation", 0.0),
        "offset_east": -values.get(f"{structure}.centre.offset.west", 0.0),
        "offset_north": -values.get(f"{structure}.centre.offset.south", 0.0),
        "offset_up": values.get(f"{structure}.base.elevation.relative", 0.0),
    }


def course_heights(values, structure):
    """
    The course heights a preset carries for one structure, bottom up, in
    metres. Mirrors courseHeights in packages/geometry: the keys are
    `<id>.course.<n>.height` and they are read in numeric order rather than in
    whatever order the resolver put them in.
    """
    prefix, suffix = f"{structure}.course.", ".height"
    numbered = []
    for key, value in values.items():
        if not key.startswith(prefix) or not key.endswith(suffix):
            continue
        middle = key[len(prefix):-len(suffix)]
        if middle.isdigit():
            numbered.append((int(middle), value))
    numbered.sort()
    return [height for _, height in numbered]


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


def _corners(half, z):
    # The same ring as _ring, without the face midpoints: a stepped course is four-sided.
    return [(half, half, z), (-half, half, z), (-half, -half, z), (half, -half, z)]


def course_levels(courses):
    """
    The bed of each course in metres above the base, with the top of the last
    one on the end, so this has one more entry than there are courses and its
    last entry is the height of the pyramid as it stands. Mirrors courseLevels
    in packages/geometry.
    """
    levels = [0.0]
    z = 0.0
    for h in courses:
        z += h
        levels.append(z)
    return levels


def stepped_pyramid_geometry(base, height, courses):
    """
    The pyramid as it stands: one square slab per course, in the project frame
    and wound counter-clockwise seen from outside, as pyramid_geometry's faces
    are. Mirrors steppedPyramidMesh in packages/geometry, which carries the
    reasoning; in short, each course is full width from its bed to its top at
    the casing face line taken at its bed, half * (1 - z / height), the
    casing's own thickness is not in the database and so is ignored, and the
    concavity is left off because it belongs to faces that are gone and is
    about the size of one step.

    Eight vertices a course, the bottom course's bed ring first.
    """
    if not courses:
        raise ValueError("a stepped pyramid needs at least one course")
    half_base = base / 2.0
    verts, faces = [], []
    z = 0.0
    for h in courses:
        if z >= height:
            raise ValueError(f"the courses reach {z:.3f} m, which is the whole {height} m of the pyramid")
        half = half_base * (1.0 - z / height)
        bed = len(verts)
        verts.extend(_corners(half, z))
        verts.extend(_corners(half, z + h))
        for i in range(4):
            j = (i + 1) % 4
            faces.append((bed + i, bed + j, bed + 4 + j, bed + 4 + i))
        z += h
    faces.append((3, 2, 1, 0))                                # base cap, CW from above so it faces down
    for k in range(len(courses) - 1):
        above, following = k * 8 + 4, (k + 1) * 8
        for i in range(4):
            j = (i + 1) % 4
            faces.append((above + i, above + j, following + j, following + i))   # the step's ledge, facing up
    summit = (len(courses) - 1) * 8 + 4
    faces.append((summit, summit + 1, summit + 2, summit + 3))
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


# --- Structures whose plan is discovered from their records ----------------
# Mirrors the second half of packages/geometry/src/interiors.ts. G1's rooms are
# written out above because Petrie stores each of them differently; every other
# structure carries its id on the front of every key and is read rather than
# written, so entering Khafre's or Menkaure's records is enough to make their
# interiors appear. The shapes looked for under "<id>." are:
#
#   passage.<name>.floor.begin.{north,east,up}   floor centre line
#   passage.<name>.floor.end.{north,east,up}     the far end, if measured
#   passage.<name>.length                        else metres along the floor
#   passage.<name>.angle                         and the slope in degrees
#   passage.<name>.direction                     optional bearing, azimuth
#   passage.<name>.{width,height}                rectangular section
#
# A passage that records both ends is drawn between them and its angle, if
# there is one, is provenance. A passage that records only where it begins is
# drawn from length and angle, the slope being positive for a passage that
# rises going away from its beginning, along direction if a record gives one
# and due south otherwise. That is how a published plan states a passage, and
# computing the far end keeps it out of the database.
#
#   chamber.<name>.wall.{north,south}.north      wall positions
#   chamber.<name>.wall.{east,west}.east
#   chamber.<name>.{floor,ceiling}.up            levels
#   chamber.<name>.gable.height                  optional pitched roof
#
# A chamber's three extents are each read on their own, because a survey
# records what it could reach. East to west is both side walls if both were
# located, else one of them and the chamber's length (whole, or the mean of
# length.north and length.south), else centre and that length; north to south
# is the same with the two end walls and width. The vertical is floor.up with
# either ceiling.up or wall.height. A wall bounds its own side, so a length
# hung off wall.west.east runs east and one hung off wall.east.east runs west.
#
# A north coordinate may instead be given as "<point>.from_north_base", a
# distance south of the north base edge, and an east one as
# "<point>.from_east_side", a distance west of the east base edge; both are
# converted here with the half-base. A passage with no floor.begin of its own
# starts at the structure's entrance. An entrance that records a level and an
# east offset but no north coordinate is put on the north face, which is where
# every entrance at Giza is, from "<id>.face.angle" and the half base.
# Anything incomplete is skipped.

INTERIOR_STRUCTURES = ("g1", "g2", "g3")

# A passage shorter than this is a rounding artefact, not a passage.
_MIN_RUN = 1e-6

# The bearing a passage takes when no record gives it one. Every entrance
# passage at Giza runs south into its pyramid from the north face, so a
# published plan that states a length and a slope and nothing else is stating
# a run due south.
_DUE_SOUTH = 180.0


def interior_key_prefix(structure):
    """G1's interior records are unprefixed; every other structure's carry its id."""
    return "" if structure == "g1" else structure + "."


def _number_at(values, key):
    v = values.get(key)
    if v is None or isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
        return None
    return float(v)


# The distance-from-the-casing spelling of each horizontal axis.
_FROM_EDGE = {"north": "from_north_base", "east": "from_east_side"}


def _coordinate(values, base, axis, half):
    """
    One coordinate of a stored point, with the record it came from.

    "<base>.north" is the frame coordinate; "<base>.from_north_base" is the
    same point as a distance south of the north base edge, and
    "<base>.from_east_side" a distance west of the east base edge, so both need
    the half-base to convert. There is no such alternative for up.
    """
    key = base + "." + axis
    direct = _number_at(values, key)
    if direct is not None:
        return (direct, key)
    edge = _FROM_EDGE.get(axis)
    if edge is None or half is None:
        return None
    from_edge = base + "." + edge
    inward = _number_at(values, from_edge)
    return None if inward is None else (half - inward, from_edge)


def _dimension(values, base, sides):
    """
    A measured dimension, whole or as the sides a survey took it on: "length",
    or the mean of "length.north" and "length.south". Whichever sides are
    present are averaged, which is what G1's subterranean chamber does.
    """
    whole = _number_at(values, base)
    if whole is not None:
        return (whole, [base])
    found = [(base + "." + side, _number_at(values, base + "." + side)) for side in sides]
    found = [(k, v) for k, v in found if v is not None]
    if not found:
        return None
    return (sum(v for _, v in found) / len(found), [k for k, _ in found])


def _extent(values, base, axis, half, low, high, size, sides):
    """
    One horizontal extent as (lo, hi, keys): both bounding walls, or one of
    them and the measured dimension, or the centre and the dimension. `high` is
    the north or east wall, `low` the south or west one.
    """
    lo = _coordinate(values, base + "." + low, axis, half)
    hi = _coordinate(values, base + "." + high, axis, half)
    if lo is not None and hi is not None:
        return (min(lo[0], hi[0]), max(lo[0], hi[0]), [hi[1], lo[1]])
    span = _dimension(values, base + "." + size, sides)
    if span is None or span[0] <= 0:
        return None
    if lo is not None:
        return (lo[0], lo[0] + span[0], [lo[1]] + span[1])
    if hi is not None:
        return (hi[0] - span[0], hi[0], [hi[1]] + span[1])
    centre = _coordinate(values, base + ".centre", axis, half)
    if centre is None:
        return None
    return (centre[0] - span[0] / 2.0, centre[0] + span[0] / 2.0, [centre[1]] + span[1])


def _vertical_extent(values, base):
    """The vertical extent: the floor, and either the ceiling or the wall height."""
    floor = _number_at(values, base + ".floor.up")
    if floor is None:
        return None
    ceiling = _number_at(values, base + ".ceiling.up")
    if ceiling is not None and ceiling > floor:
        return (floor, ceiling, [base + ".floor.up", base + ".ceiling.up"])
    walls = _number_at(values, base + ".wall.height")
    if walls is not None and walls > 0:
        return (floor, floor + walls, [base + ".floor.up", base + ".wall.height"])
    return None


def _stored_point(values, base, half):
    """A stored point as (east, north, up), with its records in north, east, up order."""
    north = _coordinate(values, base, "north", half)
    east = _coordinate(values, base, "east", half)
    up = _coordinate(values, base, "up", half)
    if north is None or east is None or up is None:
        return None
    return ((east[0], north[0], up[0]), [north[1], east[1], up[1]])


def _member_names(values, prefix, kind):
    """Every <name> under "<prefix><kind>.", sorted, so the plan comes out of the data."""
    head = prefix + kind + "."
    found = set()
    for key in values:
        if not key.startswith(head):
            continue
        rest = key[len(head):]
        dot = rest.find(".")
        if dot > 0:
            found.add(rest[:dot])
    return sorted(found)


def _half_base(values, structure):
    """
    Half the base, which from_north_base is converted with. buildEnvironment
    derives it on the TypeScript side; here the measured side stands in, since
    the generator resolves the database without that step.
    """
    half = _number_at(values, structure + ".base.half")
    if half is not None:
        return half
    base = _number_at(values, structure + ".base.side.mean")
    return None if base is None else base / 2.0


def _face_north(values, base, structure, half):
    """
    The north coordinate of a point in the pyramid's north face, taken from
    the face instead of read off a record.

    Every entrance at Giza is in the north face, and a face is a plane, so a
    point on it at height up stands up / tan(face angle) south of the north
    base edge: a survey that recorded the threshold's height recorded its plan
    position along with it, and the setback is the face's own geometry rather
    than a second measurement. That makes it a derived quantity, which belongs
    here and not in the database.

    The face angle is the resolved "<id>.face.angle", so it moves with the
    preset, and it is named among the records because it is what does the
    work. The half base converts as it does for from_north_base and goes
    unnamed for the same reason. A preset carrying no face angle, or no base
    to halve, leaves the point unmade and the passage unbuilt, as before.
    """
    up = _number_at(values, base + ".up")
    key = structure + ".face.angle"
    angle = _number_at(values, key)
    if up is None or half is None or angle is None:
        return None
    if angle <= 0 or angle >= 90:
        return None
    return (half - up / math.tan(math.radians(angle)), key)


def _entrance_point(values, base, structure, half):
    """
    An entrance point: the stored point if all three coordinates are recorded,
    and otherwise the same point with its north coordinate taken from the
    north face, which is where every entrance at Giza is.
    """
    stored = _stored_point(values, base, half)
    if stored is not None:
        return stored
    north = _face_north(values, base, structure, half)
    east = _coordinate(values, base, "east", half)
    up = _coordinate(values, base, "up", half)
    if north is None or east is None or up is None:
        return None
    return ((east[0], north[0], up[0]), [north[1], east[1], up[1]])


def _entrance_begin(values, structure, prefix, name, half):
    """Where a passage begins when it records no floor.begin of its own."""
    named = _entrance_point(values, prefix + "entrance." + name + ".floor.begin", structure, half)
    if named is not None:
        return named
    if name == "descending":
        return _entrance_point(values, prefix + "entrance.floor.begin", structure, half)
    return None


def _end_from_run(values, base, start):
    """
    The far end of a passage whose source states it as a run, not as a point.

    "<base>.length" is metres measured along the floor and "<base>.angle" the
    slope in degrees, positive for a passage that rises going away from its
    beginning and negative for one that descends. The bearing is
    "<base>.direction" when a record gives it as an azimuth in degrees, and
    _DUE_SOUTH otherwise. The end point itself is never stored: it is a
    derived quantity, so it is computed here from the three records.
    """
    length = _number_at(values, base + ".length")
    angle = _number_at(values, base + ".angle")
    if length is None or angle is None or length <= 0:
        return None
    keys = [base + ".length", base + ".angle"]
    direction = _number_at(values, base + ".direction")
    if direction is not None:
        keys.append(base + ".direction")
    azimuth = math.radians(_DUE_SOUTH if direction is None else direction)
    slope = math.radians(angle)
    flat = length * math.cos(slope)
    end = (start[0] + flat * math.sin(azimuth),
           start[1] + flat * math.cos(azimuth),
           start[2] + length * math.sin(slope))
    return (end, keys)


def _passage_builder(values, structure, prefix, name, half):
    base = prefix + "passage." + name
    begin = _stored_point(values, base + ".floor.begin", half)
    if begin is None:
        begin = _entrance_begin(values, structure, prefix, name, half)
    width = _number_at(values, base + ".width")
    height = _number_at(values, base + ".height")
    if begin is None or width is None or height is None or width <= 0 or height <= 0:
        return None
    start, start_keys = begin
    # A survey that could reach both ends leaves two points. A published plan
    # states a length along the floor and a slope instead, and the far end is
    # worked out from them rather than written down anywhere.
    stored = _stored_point(values, base + ".floor.end", half)
    end = stored if stored is not None else _end_from_run(values, base, start)
    if end is None:
        return None
    finish, finish_keys = end
    if math.sqrt(sum((finish[i] - start[i]) ** 2 for i in range(3))) < _MIN_RUN:
        return None
    keys = start_keys + finish_keys + [base + ".width", base + ".height"]
    # The recorded slope is not needed to build a passage whose two ends are
    # known, but it is part of the provenance when the database carries it. On
    # the other path it is load-bearing and _end_from_run has already named it.
    if stored is not None and _number_at(values, base + ".angle") is not None:
        keys.append(base + ".angle")
    return (base, keys, lambda v: passage(start, finish, width, height))


def _chamber_builder(values, prefix, name, half):
    base = prefix + "chamber." + name
    north_south = _extent(values, base, "north", half, "wall.south", "wall.north", "width", ("east", "west"))
    east_west = _extent(values, base, "east", half, "wall.west", "wall.east", "length", ("north", "south"))
    up_down = _vertical_extent(values, base)
    if north_south is None or east_west is None or up_down is None:
        return None
    mn = (east_west[0], north_south[0], up_down[0])
    mx = (east_west[1], north_south[1], up_down[1])
    span = (mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2])
    if span[0] <= 0 or span[1] <= 0 or span[2] <= 0:
        return None
    keys = list(north_south[2]) + list(east_west[2]) + list(up_down[2])
    # A gable is optional, and only a ridge above the wall tops is one: it runs
    # along the chamber's longer horizontal axis, which is how every gabled
    # chamber at Giza is roofed, G1's Queen's Chamber included.
    ridge = _number_at(values, base + ".gable.height")
    gable = None
    if ridge is not None and ridge > span[2]:
        keys.append(base + ".gable.height")
        gable = {"ridge_height": ridge, "axis": "x" if span[0] >= span[1] else "y"}
    return (base, keys, lambda v: chamber(mn, mx, gable))


def _discover_builders(values, structure):
    """Passages first and then chambers, each group in name order."""
    prefix = interior_key_prefix(structure)
    half = _half_base(values, structure)
    out = []
    for name in _member_names(values, prefix, "passage"):
        built = _passage_builder(values, structure, prefix, name, half)
        if built is not None:
            out.append(built)
    for name in _member_names(values, prefix, "chamber"):
        built = _chamber_builder(values, prefix, name, half)
        if built is not None:
            out.append(built)
    return out


def _builders_for(values, structure):
    return INTERIOR_BUILDERS if structure == "g1" else _discover_builders(values, structure)


def interior_solids(values, structure="g1"):
    """
    One structure's interior as named solids, built from resolved values.

    Returns a list of {"name", "keys", "verts", "faces", "volume"} in the same
    order as interiorSolids in packages/geometry, skipping any solid whose
    records the preset does not carry: presets differ, and a missing room is
    better than an invented one.
    """
    out = []
    for name, keys, build in _builders_for(values, structure):
        if any(values.get(k) is None for k in keys):
            continue
        verts, faces = build(values)
        out.append({"name": name, "keys": list(keys),
                    "verts": [list(v) for v in verts], "faces": [list(f) for f in faces],
                    "volume": polyhedron_volume(verts, faces)})
    return out


def interior_structures(values, ids=INTERIOR_STRUCTURES):
    """Which of `ids` the resolved values carry an interior for, in the order given."""
    return [i for i in ids
            if any(all(values.get(k) is not None for k in keys)
                   for _, keys, _ in _builders_for(values, i))]


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
    # last line. One entry per structure the preset carries an interior for.
    _preset = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else "canonical"
    _values = resolve(load_database(), _preset)["values"]
    print(json.dumps({_s: interior_solids(_values, _s) for _s in interior_structures(_values)}))


# --- A discovered interior, for the parity test in packages/data ------------
# The pyramid below is invented and its numbers are round. It is here so the
# discovery above can be compared with the TypeScript one before any real
# records for G2 or G3 exist; it reads nothing from data/ and is not a
# measurement of anything.

INTERIOR_DISCOVERY_CASE = {
    "g2.base.half": 100.0,
    "g2.entrance.floor.begin.from_north_base": 20.0,
    "g2.entrance.floor.begin.east": 5.0,
    "g2.entrance.floor.begin.up": 30.0,
    "g2.passage.descending.floor.end.north": 0.0,
    "g2.passage.descending.floor.end.east": 5.0,
    "g2.passage.descending.floor.end.up": 0.0,
    "g2.passage.descending.width": 1.0,
    "g2.passage.descending.height": 2.0,
    "g2.passage.descending.angle": 20.556,
    "g2.passage.horizontal.floor.begin.north": 0.0,
    "g2.passage.horizontal.floor.begin.east": 5.0,
    "g2.passage.horizontal.floor.begin.up": 0.0,
    "g2.passage.horizontal.floor.end.north": -20.0,
    "g2.passage.horizontal.floor.end.east": 5.0,
    "g2.passage.horizontal.floor.end.up": 0.0,
    "g2.passage.horizontal.width": 1.0,
    "g2.passage.horizontal.height": 2.0,
    # A passage stated the way a published plan states one: where it begins, a
    # length along the floor and a slope, with no far end written down. This
    # one takes the default bearing, due south.
    "g2.passage.lower_descending.floor.begin.north": -20.0,
    "g2.passage.lower_descending.floor.begin.east": 5.0,
    "g2.passage.lower_descending.floor.begin.up": 0.0,
    "g2.passage.lower_descending.length": 20.0,
    "g2.passage.lower_descending.angle": -30.0,
    "g2.passage.lower_descending.width": 1.0,
    "g2.passage.lower_descending.height": 2.0,
    # An entrance with a level and an east offset but no north coordinate, put
    # on the north face from the face angle and the half base.
    "g2.face.angle": 50.0,
    "g2.entrance.upper.floor.begin.east": 2.0,
    "g2.entrance.upper.floor.begin.up": 10.0,
    "g2.passage.upper.length": 30.0,
    "g2.passage.upper.angle": -26.0,
    "g2.passage.upper.width": 1.0,
    "g2.passage.upper.height": 2.0,
    # The same, with a recorded bearing that is not due south.
    "g2.passage.well.floor.begin.north": -26.0,
    "g2.passage.well.floor.begin.east": 5.0,
    "g2.passage.well.floor.begin.up": -10.0,
    "g2.passage.well.length": 8.0,
    "g2.passage.well.angle": 0.0,
    "g2.passage.well.direction": 90.0,
    "g2.passage.well.width": 1.0,
    "g2.passage.well.height": 2.0,
    "g2.chamber.burial.wall.north.north": -20.0,
    "g2.chamber.burial.wall.south.north": -26.0,
    "g2.chamber.burial.wall.east.east": 11.0,
    "g2.chamber.burial.wall.west.east": -1.0,
    "g2.chamber.burial.floor.up": 0.0,
    "g2.chamber.burial.ceiling.up": 5.0,
    "g2.chamber.burial.gable.height": 8.0,
    # A second chamber in the other shape a survey records: one located wall,
    # the lengths and widths it was measured on, a floor and a wall height.
    "g2.chamber.rock.wall.west.east": -1.0,
    "g2.chamber.rock.length.north": 12.0,
    "g2.chamber.rock.length.south": 12.4,
    "g2.chamber.rock.centre.from_north_base": 140.0,
    "g2.chamber.rock.width.east": 6.0,
    "g2.chamber.rock.width.west": 6.2,
    "g2.chamber.rock.floor.up": -20.0,
    "g2.chamber.rock.wall.height": 4.0,
}

if __name__ == "__main__" and "--interior-case" in sys.argv:
    # Appended, so the file only ever grows; this is the last line printed.
    print(json.dumps(interior_solids(INTERIOR_DISCOVERY_CASE, "g2")))


# --- The ground under the monuments ----------------------------------------
# Mirrors packages/geometry/src/terrain.ts. GLO-30 is a surface model whose
# editing mask marks the monument footprints, so each pyramid arrives as a
# smooth mound and the sample at the origin is neither the ground under Khufu
# nor the built surface of Khufu. This puts the ground under each footprint at
# the base elevation the survey gives it and blends back into the model beyond
# it. A stand-in until the GPMP contours are entered, and deliberately crude: a
# square footprint ignoring the few arcminutes of orientation, a flat margin,
# and one smoothstep.

# Metres beyond a footprint over which the ground stays at the surveyed base
# level, and the further distance over which that level blends back in.
GROUND_FLAT_MARGIN = 40.0
GROUND_BLEND_DISTANCE = 260.0


def ground_height(x, y, z_surface, pyramids):
    """
    The surface height at one sample with the pyramids' footprints flattened.

    Inside a footprint plus GROUND_FLAT_MARGIN the answer is that pyramid's
    base level outright. Further out the model is pulled down towards the base
    level by a smoothstep reaching the untouched surface at
    GROUND_FLAT_MARGIN + GROUND_BLEND_DISTANCE; where two pyramids both reach a
    sample the lower of the two wins, so no monument is left on a shelf.

    `pyramids` are pyramid_params dicts: base, offset_east, offset_north and
    offset_up.
    """
    z = z_surface
    for p in pyramids:
        d = max(abs(x - p["offset_east"]), abs(y - p["offset_north"])) - p["base"] / 2.0
        if d <= GROUND_FLAT_MARGIN:
            return p["offset_up"]
        if d < GROUND_FLAT_MARGIN + GROUND_BLEND_DISTANCE:
            t = (d - GROUND_FLAT_MARGIN) / GROUND_BLEND_DISTANCE
            s = t * t * (3.0 - 2.0 * t)
            z = min(z, p["offset_up"] + (z_surface - p["offset_up"]) * s)
    return z


# Two pyramids and a set of samples on and between the flat, the blend and the
# untouched model, for the parity test in packages/data. Literal on both sides:
# these are not measurements.
GROUND_CASE_PYRAMIDS = [
    {"base": 230.0, "offset_east": 0.0, "offset_north": 0.0, "offset_up": 0.0},
    {"base": 200.0, "offset_east": -400.0, "offset_north": -500.0, "offset_up": 10.0},
]
GROUND_PROBES = [
    (0.0, 0.0, 62.5), (115.0, 115.0, 62.5), (155.0, 0.0, 62.5), (155.0, 155.0, 62.5),
    (155.001, 0.0, 62.5), (200.0, 0.0, 62.5), (285.0, 0.0, 62.5), (414.0, 0.0, 62.5),
    (415.0, 0.0, 62.5), (500.0, 0.0, 62.5), (-400.0, -500.0, 70.0), (-200.0, -300.0, 70.0),
    (-320.5, -420.25, 66.0), (0.0, -600.0, 58.0), (3000.0, 3000.0, 40.0), (-3000.0, -3000.0, 33.5),
]

if __name__ == "__main__" and "--ground" in sys.argv:
    # Appended, so the file only ever grows; this is the last line printed.
    print(json.dumps([
        {"x": x, "y": y, "surface": z, "ground": ground_height(x, y, z, GROUND_CASE_PYRAMIDS)}
        for x, y, z in GROUND_PROBES
    ]))


# --- Where a structure stands, when the database gives it a coordinate -----
# Mirrors deriveCentreOffsets in packages/geometry/src/environment.ts, and a
# parity test in packages/data pins the two to each other. Petrie triangulated
# G2 and G3 from G1 and those offsets are stored as metres south and west; the
# Sphinx has only a latitude and a longitude, so this turns the second kind
# into the first. The conversion is the flat one claim D1 uses: north is the
# difference in latitude and east the difference in longitude times the cosine
# of the origin's latitude, both scaled by the mean Earth radius. It ignores
# the ellipsoid, which costs under 1.5 m over the 450 m out to the Sphinx
# against the 55 m the cited coordinates themselves are worth. A structure the
# survey already placed keeps the survey's offsets and nothing is derived for
# it.

OFFSET_DIRECTIONS = ("east", "north", "west", "south")


def centre_offsets(values):
    """Derived east and north offsets, in metres, keyed as the environment keys them."""
    lat0 = values.get("g1.center.latitude")
    lon0 = values.get("g1.center.longitude")
    radius = values.get("earth.radius.mean")
    derived = {}
    if lat0 is None or lon0 is None or radius is None:
        return derived
    metres_per_degree = radius * math.pi / 180.0
    for key in list(values):
        if not key.endswith(".center.latitude"):
            continue
        structure = key[: -len(".center.latitude")]
        longitude = values.get(structure + ".center.longitude")
        if longitude is None:
            continue
        if any(values.get("%s.centre.offset.%s" % (structure, d)) is not None for d in OFFSET_DIRECTIONS):
            continue
        derived[structure + ".centre.offset.east"] = (
            (longitude - lon0) * math.cos(lat0 * math.pi / 180.0) * metres_per_degree
        )
        derived[structure + ".centre.offset.north"] = (values[key] - lat0) * metres_per_degree
    return derived


# The Sphinx as a box: the massing placeholder the generator builds until the
# Tier 4 sculpt exists. Length runs east-west and the front face is the east
# one, which is the direction the statue looks. There is no base elevation for
# the Sphinx in the database, so the box sits on the frame's datum plane, the
# Great Pyramid's base level, and its height is a size and not a position.
SPHINX_MASSING_NAME = "Sphinx (massing placeholder)"
SPHINX_MASSING_NOTE = (
    "Placeholder massing, not a model of the Sphinx: an axis-aligned box of the ARCE survey's "
    "length, width and height, centred on a commonly cited latitude and longitude that are "
    "unverified and worth about 55 m, sitting on the frame's datum plane because no base "
    "elevation for the Sphinx is in the database. It stands in for the Tier 4 sculpt over "
    "Lehner's plans. Its front face is the east one."
)


def sphinx_params(values, structure="sphinx"):
    """The massing box's three sizes and its place in the frame, or None."""
    offsets = centre_offsets(values)
    length = values.get(structure + ".length")
    width = values.get(structure + ".width")
    height = values.get(structure + ".height")
    east = offsets.get(structure + ".centre.offset.east")
    north = offsets.get(structure + ".centre.offset.north")
    if None in (length, width, height, east, north):
        return None
    return {
        "length": length,
        "width": width,
        "height": height,
        "offset_east": east,
        "offset_north": north,
    }


def massing_geometry(params):
    """
    Vertices and faces for the massing box, in the project frame: length
    east-west, width north-south, sitting on z = 0. Faces wind
    counter-clockwise seen from outside, as pyramid_geometry's do.
    """
    x0 = params["offset_east"] - params["length"] / 2.0
    x1 = params["offset_east"] + params["length"] / 2.0
    y0 = params["offset_north"] - params["width"] / 2.0
    y1 = params["offset_north"] + params["width"] / 2.0
    z1 = params["height"]
    verts = [
        (x0, y0, 0.0), (x1, y0, 0.0), (x1, y1, 0.0), (x0, y1, 0.0),
        (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1),
    ]
    faces = [
        (3, 2, 1, 0),  # floor, clockwise from above so it faces down
        (4, 5, 6, 7),  # roof
        (0, 1, 5, 4),  # south
        (1, 2, 6, 5),  # east, the face the statue looks out of
        (2, 3, 7, 6),  # north
        (3, 0, 4, 7),  # west
    ]
    return verts, faces


if __name__ == "__main__" and "--offsets" in sys.argv:
    # Appended, so the file only ever grows; this is the last line printed.
    _preset = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else "canonical"
    print(json.dumps(centre_offsets(resolve(load_database(), _preset)["values"])))


# --- The pyramid as it stands, course by course ----------------------------
# stepped_pyramid_geometry needs a structure's courses beside its base and its
# height, which is all pyramid_params already carries, so this is the whole of
# what the generator and the parity test in packages/data ask of it. A
# structure the preset holds no course records for is not mentioned, the same
# way a structure with no interior records is not mentioned.


def stepped_variants(values, structures=("g1", "g2", "g3")):
    """Every stepped pyramid the generator would build, for the parity test in packages/data."""
    out = {}
    for structure in structures:
        p = pyramid_params(values, structure)
        if p is None or not p["courses"]:
            continue
        verts, faces = stepped_pyramid_geometry(p["base"], p["height"], p["courses"])
        out[structure] = {
            "name": "today_stepped",
            "courses": len(p["courses"]),
            "top": course_levels(p["courses"])[-1],
            "verts": verts,
            "faces": [list(f) for f in faces],
            "volume": polyhedron_volume(verts, faces),
        }
    return out


if __name__ == "__main__" and "--courses" in sys.argv:
    # Appended, so the file only ever grows; this is the last line printed.
    _preset = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else "canonical"
    print(json.dumps(stepped_variants(resolve(load_database(), _preset)["values"])))
