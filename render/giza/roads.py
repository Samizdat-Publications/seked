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
    for width, pts in roads:
        line = _resample(pts)
        if len(line) < 2:
            continue
        d = np.gradient(line, axis=0)
        d /= np.linalg.norm(d, axis=1, keepdims=True) + 1e-9
        nrm = np.stack([-d[:, 1], d[:, 0]], 1)
        z = terrain.surface(line[:, 0], line[:, 1])
        rows = []
        for i in range(len(line)):
            row = []
            for off, dz in ((-width / 2 - 0.4, -0.3), (-width / 2, LIFT), (width / 2, LIFT), (width / 2 + 0.4, -0.3)):
                row.append(bm.verts.new((line[i, 0] + nrm[i, 0] * off, line[i, 1] + nrm[i, 1] * off, z[i] + dz)))
            rows.append(row)
        for i in range(len(line) - 1):
            for j in range(3):
                bm.faces.new((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]))
        total += float(np.sum(np.linalg.norm(np.diff(line, axis=0), axis=1)))
    for ring in parks:
        xs = np.array([p[0] for p in ring])
        ys = np.array([p[1] for p in ring])
        zs = terrain.surface(xs, ys)
        vs = [bm.verts.new((x, y, float(zz) + LIFT)) for x, y, zz in zip(xs, ys, zs)]
        try:
            bm.faces.new(vs)
        except ValueError:
            pass
    me = bpy.data.meshes.new("roads")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new("roads", me)
    coll.objects.link(ob)
    log(f"roads: {len(roads)} ways, {total / 1000:.1f} km, {len(parks)} car parks")
