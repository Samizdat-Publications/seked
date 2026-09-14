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
