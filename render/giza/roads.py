"""
Today's roads and car parks on the plateau, from the OpenStreetMap ways the project
already holds (data/footprints/overpass-giza.json).

They are placed with the same registration the monuments were fitted with
(data/footprints/giza.json: a flat frame about OSM's own Great Pyramid, then the least-
squares rotation and translation onto the survey), and draped on the terrain. Widths by
road class are look choices; so is the dusty asphalt. Footpaths and tracks are left to
the ground itself. Context, never evidence.
"""
import io
import json
import math
import os

import bmesh
import bpy
import numpy as np

from . import data, states
from .nodes import Tree, hexlin

WIDTH = {"trunk": 14.0, "trunk_link": 8.0, "primary": 12.0, "primary_link": 7.0, "secondary": 9.0, "secondary_link": 7.0,
         "tertiary": 7.0, "tertiary_link": 6.0, "unclassified": 6.0, "residential": 5.0, "service": 4.5, "pedestrian": 5.0,
         "construction": 6.0}
LIFT = 0.18          # proud of the displaced ground patch near the camera, which rises to 0.17 m
PARK_EDGE = 3.0      # m: a car park's triangles, draped point by point
PARK_LIFT = 0.3      # a car park clear of the patch's ripples: at LIFT only its edges showed through them
EDGE_DROP = 1.0      # m: how far a road's edge may sit from its centre line's height
EARTH_RADIUS_MEAN = 6371008.8


def _frame():
    reg = data.load_json(data.DATA, "footprints", "giza.json")["registration"]
    lat0, lon0 = reg["origin"]["latitude"], reg["origin"]["longitude"]
    theta = math.radians(reg["rotationArcmin"] / 60.0)
    c, s = math.cos(theta), math.sin(theta)
    tx, ty = reg["translation"]
    per_deg = EARTH_RADIUS_MEAN * math.pi / 180.0
    coslat = math.cos(math.radians(lat0))

    def to_frame(lat, lon):
        x = (lon - lon0) * coslat * per_deg
        y = (lat - lat0) * per_deg
        return c * x - s * y + tx, s * x + c * y + ty
    return to_frame


def ways():
    raw = data.load_json(data.DATA, "footprints", "overpass-giza.json")["elements"]
    to_frame = _frame()
    roads, parks = [], []
    for e in raw:
        if e.get("type") != "way" or "geometry" not in e:
            continue
        tags = e.get("tags", {})
        pts = [to_frame(p["lat"], p["lon"]) for p in e["geometry"]]
        if tags.get("highway") in WIDTH:
            roads.append((WIDTH[tags["highway"]], pts))
        elif tags.get("amenity") == "parking" and len(pts) >= 4 and pts[0] == pts[-1]:
            parks.append(pts[:-1])
    return roads, parks


def asphalt_material():
    mat = bpy.data.materials.new("asphalt")
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    geo = t.node("ShaderNodeNewGeometry")
    # Sun-bleached, sand-blown asphalt: grey-tan from any distance, not a black band.
    base = t.ramp(t.noise(geo.outputs["Position"], 0.4, 5.0), [(0.3, hexlin("6a645c")), (0.7, hexlin("7b746a"))])
    dust = t.band(t.noise(geo.outputs["Position"], 0.08, 4.0), 0.35, 0.7)
    col = t.mix(t.math("MULTIPLY", dust, 0.7), base, hexlin("b7a282"))
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.9
    return mat


def _resample(pts, step=4.0):
    out = [pts[0]]
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        L = math.hypot(bx - ax, by - ay)
        n = max(1, int(L / step))
        out += [(ax + (bx - ax) * k / n, ay + (by - ay) * k / n) for k in range(1, n + 1)]
    return np.array(out, dtype=np.float64)


def build(state, terrain, coll, log=print):
    if states.spec(state)["city"] != "city":
        return
    roads, parks = ways()
    mat = asphalt_material()
    bm = bmesh.new()
    total = 0.0
    # No way is paved across the Sphinx's ditch: OSM's lines there are visitors' paths over its floor,
    # and draped on the cut they came out as a slab of asphalt at the statue's paws.
    from .sphinx import enclosure
    ex0, ex1, ey0, ey1, _ = enclosure(state)
    runs = []
    for width, pts in roads:
        line = _resample(pts)
        inside = (line[:, 0] > ex0 - 2) & (line[:, 0] < ex1 + 2) & (line[:, 1] > ey0 - 2) & (line[:, 1] < ey1 + 2)
        start = None
        for i, cut in enumerate(list(inside) + [True]):
            if not cut and start is None:
                start = i
            elif cut and start is not None:
                runs.append((width, line[start:i]))
                start = None
    for width, line in runs:
        if len(line) < 2:
            continue
        d = np.gradient(line, axis=0)
        d /= np.linalg.norm(d, axis=1, keepdims=True) + 1e-9
        nrm = np.stack([-d[:, 1], d[:, 0]], 1)
        rows = [[] for _ in range(len(line))]
        zc = terrain.surface(line[:, 0], line[:, 1])
        # each edge draped on the ground under it: one height at the centre line buried the upper side on a slope;
        # but held within EDGE_DROP of the centre line, or a road along the Sphinx ditch's rim hung one edge down
        # its wall onto the floor (a black strip in the ditch, 26 October)
        for off, dz in ((-width / 2 - 0.4, -0.3), (-width / 2, LIFT), (width / 2, LIFT), (width / 2 + 0.4, -0.3)):
            ex, ey = line[:, 0] + nrm[:, 0] * off, line[:, 1] + nrm[:, 1] * off
            ez = np.clip(terrain.surface(ex, ey), zc - EDGE_DROP, zc + EDGE_DROP)
            for i in range(len(line)):
                rows[i].append(bm.verts.new((float(ex[i]), float(ey[i]), float(ez[i]) + dz)))
        for i in range(len(line) - 1):
            for j in range(3):
                bm.faces.new((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]))
        total += float(np.sum(np.linalg.norm(np.diff(line, axis=0), axis=1)))
    # A car park as one flat polygon at its corners' heights sank under every rise of the ground between them, and
    # showed as a stray grey shape in the sand (ch9-answer): each is cut into triangles under PARK_EDGE metres and
    # every point draped on the ground.
    for ring in parks:
        pk = bmesh.new()
        try:
            pk.faces.new([pk.verts.new((float(p[0]), float(p[1]), 0.0)) for p in ring])
        except ValueError:
            pk.free()
            continue
        bmesh.ops.triangulate(pk, faces=pk.faces[:])
        for _ in range(10):
            long = [e for e in pk.edges if e.calc_length() > PARK_EDGE]
            if not long:
                break
            bmesh.ops.subdivide_edges(pk, edges=long, cuts=1, use_grid_fill=False)
            bmesh.ops.triangulate(pk, faces=pk.faces[:])
        co = np.array([v.co[:2] for v in pk.verts])
        zs = terrain.surface(co[:, 0], co[:, 1])
        new = {v: bm.verts.new((v.co.x, v.co.y, float(z) + PARK_LIFT)) for v, z in zip(pk.verts, zs)}
        for f in pk.faces:
            try:
                bm.faces.new([new[v] for v in f.verts])
            except ValueError:
                pass
        pk.free()
    me = bpy.data.meshes.new("roads")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new("roads", me)
    coll.objects.link(ob)
    log(f"roads: {len(roads)} ways, {total / 1000:.1f} km, {len(parks)} car parks")
