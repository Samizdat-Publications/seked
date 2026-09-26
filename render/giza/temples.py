"""
The temples: Khafre's valley temple and mortuary temple, the Sphinx Temple, and
Menkaure's two, on their OSM outlines at their registered base levels.

Today each is a megalithic ruin: courses of local limestone core blocks, standing to
a height that varies along the wall (look choices in HEIGHT_TODAY), the robbed
casing gone. As built each stands to 12 m (data/measurements/pristine.json,
tier3.temple.height.built) with a flat roof, cased as data/materials.json says:
red granite on Khafre's valley temple and the Sphinx Temple, white Mokattam
limestone on Khafre's mortuary temple, mud brick on Menkaure's.
"""
import math

import bpy
import numpy as np

from . import data, states
from .instancing import Field
from .walls import ccw, inset_ring, lay_ring, simplify
from .variants import N_DRESSED

TEMPLES = ["khafre.valley_temple", "sphinx.temple", "khafre.mortuary_temple", "menkaure.mortuary_temple",
           "menkaure.valley_temple"]
# Look choices: (low, high) share of the built height each keeps today, and the built height's own source.
HEIGHT_BUILT = 12.0
HEIGHT_TODAY = {"khafre.valley_temple": (0.45, 0.75), "sphinx.temple": (0.2, 0.45), "khafre.mortuary_temple": (0.15, 0.35),
                "menkaure.mortuary_temple": (0.1, 0.25), "menkaure.valley_temple": (0.08, 0.2)}
CASING = {"khafre.valley_temple": "granite", "sphinx.temple": "granite", "khafre.mortuary_temple": "limestone",
          "menkaure.mortuary_temple": "mudbrick", "menkaure.valley_temple": "mudbrick"}


def outlines(terrain_z=None):
    out = []
    for f in data.FOOTPRINTS:
        if f["id"] not in TEMPLES:
            continue
        ring = simplify(f["ring"])
        base = f.get("base")
        if (base is None or base == 0) and terrain_z is not None:
            xs = np.array([p[0] for p in ring])
            ys = np.array([p[1] for p in ring])
            base = float(np.median(terrain_z(xs, ys)))
        out.append(dict(id=f["id"], ring=ring, base=base))
    return out


def flats(state="today"):
    """Platforms the terrain levels to: (cx, cy, half-x, half-y, z) per temple the state has, with a registered base."""
    S = states.spec(state)
    lift = 2.5 if S["temple_mode"] == "buried" else 0.0     # look choice: the sand in the courts by 1800
    res = []
    for f in data.FOOTPRINTS:
        if f["id"] in S["temples"] and f.get("base"):
            xs = [p[0] for p in f["ring"]]
            ys = [p[1] for p in f["ring"]]
            res.append(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (max(xs) - min(xs)) / 2, (max(ys) - min(ys)) / 2, f["base"] + lift))
    return res


def _slab(ring, z0, z1, coll, name, material):
    """A solid prism over a ring: the core fill today, the whole mass and roof as built."""
    n = len(ring)
    verts = [(x, y, z0) for x, y in ring] + [(x, y, z1) for x, y in ring]
    faces = [tuple(range(n))[::-1], tuple(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def _battered_shell(ring, z0, height, coll, name, material, batter_deg=82.0):
    """The dressed outer face as built: the ring drawn in towards the top, and a flat roof."""
    inset = height / math.tan(math.radians(batter_deg))
    top = inset_ring(ring, inset)
    n = len(ring)
    verts = [(x, y, z0) for x, y in ring] + [(x, y, z0 + height) for x, y in top]
    faces = [tuple(range(n))[::-1], tuple(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.materials.append(material)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    bev = ob.modifiers.new("arris", "BEVEL")
    bev.width = 0.04
    bev.segments = 2
    return ob


DOOR_HEAD = 5.0      # look choice: the height of a doorway's lintel


def centroid(ring):
    """A ring's area centroid, the point Hölscher's plate is registered to (the vertices' mean leans towards where they crowd)."""
    a = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        c = x0 * y1 - x1 * y0
        a += c
        cx += (x0 + x1) * c
        cy += (y0 + y1) * c
    return cx / (3.0 * a), cy / (3.0 * a)


def doorways(t):
    """The valley temple's two east entrances, read off Hoelscher's Blatt XVII."""
    if t["id"] != "khafre.valley_temple":
        return []
    r = {rec["key"]: rec["value"] for rec in data.records("khafre-valley-temple.json")}
    xs = [p[0] for p in t["ring"]]
    cx, cy = centroid(t["ring"])
    east = max(xs)
    return [(east, cy + r["khafre_valley_temple.entrance.north.centre.north"], r["khafre_valley_temple.entrance.north.width"], DOOR_HEAD),
            (east, cy + r["khafre_valley_temple.entrance.south.centre.north"], r["khafre_valley_temple.entrance.south.width"], DOOR_HEAD)]


def _mouths(doors, base, coll, material):
    """A dark vestibule behind each doorway."""
    for x, y, w, h in doors:
        verts = [(x - 7.0, y - w / 2, base), (x - 0.3, y - w / 2, base), (x - 0.3, y + w / 2, base), (x - 7.0, y + w / 2, base)]
        verts += [(vx, vy, base + h) for vx, vy, _ in verts]
        faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (3, 2, 6, 7), (0, 3, 7, 4)]
        me = bpy.data.meshes.new("doorway")
        me.from_pydata(verts, [], faces)
        me.materials.append(material)
        ob = bpy.data.objects.new("doorway", me)
        coll.objects.link(ob)


def build(state, rng, terrain, coll, mats, lib, log=print):
    S = states.spec(state)
    mode = S["temple_mode"]
    core_blocks, granite_blocks, lime_blocks, fresh_blocks = Field(), Field(), Field(), Field()
    for t in outlines(terrain.z):
        if t["id"] not in S["temples"]:
            continue
        ring, base = t["ring"], t["base"]
        doors = doorways(t)
        if mode.startswith("megalithic"):
            # The claim's temples: megalithic limestone walls standing whole, roofed with slabs of the same stone.
            target = fresh_blocks if mode == "megalithic" else core_blocks
            laid = lay_ring(ring, base, HEIGHT_BUILT, rng, target, course=1.6, length=3.4, depth=2.4, miss=0.0 if mode == "megalithic" else 0.03,
                            openings=doors)
            lean = HEIGHT_BUILT / math.tan(math.radians(82.0))
            _slab(inset_ring(ring, 2.4 + lean + 0.2), base - 0.3, base + HEIGHT_BUILT - 0.05, coll, t["id"] + " core", mats["core behind"])
            _slab(inset_ring(ring, lean + 0.1), base + HEIGHT_BUILT - 0.05, base + HEIGHT_BUILT + 0.6, coll, t["id"] + " roof",
                  mats["core behind"])
            log(f"{t['id']}: {laid} megalithic blocks ({mode})")
        elif mode in ("ruin", "buried"):
            lo, hi = HEIGHT_TODAY[t["id"]]
            laid = lay_ring(ring, base, HEIGHT_BUILT * hi, rng, core_blocks, course=1.15, length=2.4, depth=2.0,
                            ruin=(lo / hi, 1.0), miss=0.05, seed=rng.random() * 100, openings=doors)
            _slab(inset_ring(ring, 1.8), base - 0.3, base + HEIGHT_BUILT * lo * 0.8, coll, t["id"] + " core", mats["core behind"])
            log(f"{t['id']}: {laid} blocks, ruined to {lo * HEIGHT_BUILT:.1f}-{hi * HEIGHT_BUILT:.1f} m")
        else:
            casing = CASING[t["id"]]
            if casing == "mudbrick":
                _battered_shell(ring, base - 0.3, HEIGHT_BUILT + 0.3, coll, t["id"], mats["mudbrick"])
            else:
                target = granite_blocks if casing == "granite" else lime_blocks
                # granite laid as Khafre's masons laid it, courses and blocks of very different sizes (a look
                # choice after the photographs); the limestone temples in more even courses
                spread = (0.35, 0.6) if casing == "granite" else (0.12, 0.35)
                laid = lay_ring(ring, base, HEIGHT_BUILT, rng, target, course=1.3, length=3.0, depth=1.6, miss=0.0,
                                variants=N_DRESSED, openings=doors, joint=0.025, erosion_jitter=False,
                                course_spread=spread[0], length_spread=spread[1], seed=len(t["id"]) * 0.37)
                lean = HEIGHT_BUILT / math.tan(math.radians(82.0))
                _slab(inset_ring(ring, 1.6 + lean + 0.2), base - 0.3, base + HEIGHT_BUILT - 0.05, coll, t["id"] + " core", mats["core behind"])
                _slab(inset_ring(ring, lean + 0.05), base + HEIGHT_BUILT - 0.05, base + HEIGHT_BUILT + 0.35, coll, t["id"] + " roof", mats["pavement"])
                log(f"{t['id']}: {laid} dressed {casing} blocks to {HEIGHT_BUILT:.0f} m")
        _mouths(doors, base, coll, mats["dark"])
    core_blocks.emit("temple blocks", lib["core"], coll, log)
    fresh_blocks.emit("temple megaliths", lib["core fresh"], coll, log)
    granite_blocks.emit("temple granite", lib["dressed granite"], coll, log)
    lime_blocks.emit("temple limestone", lib["dressed limestone"], coll, log)
