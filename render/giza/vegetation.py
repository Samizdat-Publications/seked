"""
Vegetation by era, every plant of it instanced.

The First Time (c. 10,500 BCE) and the lion (c. 7000 BCE) are the claim's green eras:
the African Humid Period, which is real climate science, drawn as a savanna over the
plateau and a lush valley below it, the lion's drier than the First Time's. As built
(c. 2560 BCE) the plateau is desert and the valley east of the temples carries palm
groves, rows of palms on the field edges and a few palms by the harbour; by 1800 CE and
today only a few palms stand in the valley and the village. What grows where, how
densely and how tall is a look choice throughout, named in STATES and KINDS; nothing
here is a measurement, and nothing here is evidence.

Two passes. `build(state, terrain, coll, rng, log)` scatters the era over the whole
scene once: trees and palms out to REACH, bushes, papyrus and reeds on the era's
shorelines, and sparse grass tussocks over the near grid. `near_camera(state, terrain,
coll, camera_xy, log)` adds dense small tufts within NEAR_RADIUS of a camera, per view,
so the state-wide grass can stay sparse.

The plants come from a library prepared once into build/vegetation/plants.blend by
`prepare()` (`blender -b --factory-startup -P render/giza/vegetation.py -- prepare`);
render/vegetation.json names each asset's source, author, licence, height and
triangles. `build()` prepares the library in a child Blender when it is missing.

Grass on the ground: `ground_tint(state)` is the colour the grass gives the ground from
a distance and how strongly it covers it; `tint_ground(material, state)` mixes that
colour into a ground material through the same cover map the grass is scattered by, so
a bare patch in the grass is bare in the ground as well.

    blender -b --factory-startup -P render/giza/vegetation.py -- prepare
    blender -b --factory-startup -P render/giza/vegetation.py -- sheet
    blender -b --factory-startup -P render/giza/vegetation.py -- test --view savanna
    blender -b --factory-startup -P render/giza/vegetation.py -- count --state first-time
"""
import json
import math
import os
import random
import subprocess
import sys
import time

import numpy as np

if __name__ == "__main__" and not __package__:
    # Run as a script inside Blender (see _main): make the package importable and join it.
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    __package__ = "giza"

from . import data, states  # noqa: E402
from .noise import ValueNoise, smoothstep  # noqa: E402

try:
    import bpy
except ImportError:          # the masks and the scatter are numpy, and are tested without Blender
    bpy = None

LIBRARY = os.path.join(data.REPO, "build", "vegetation", "plants.blend")
INDEX = os.path.join(data.REPO, "build", "vegetation", "index.json")
MANIFEST = os.path.join(data.RENDER, "vegetation.json")
PROPS = os.path.join(data.REPO, "build", "props")
PARKED = (0.0, 0.0, -20000.0)      # where the originals wait, as variants.PARKED

# Where trees and palms are scattered beyond the near grid: out to the Nile's plane (x 5200)
# and about four kilometres round the plateau, thinning with distance (FAR_FALLOFF). A look choice.
REACH = (-3500.0, 5100.0, -4500.0, 4000.0)
FAR_STEP = 40.0
FAR_FALLOFF = 2600.0
NEAR_RADIUS = 120.0                # how far round a camera `near_camera` lays its dense tufts
# The tussocks thin from full strength a kilometre from Khufu to none at 1.8 km, where the ground's
# tint alone carries the grass: every station is within about a kilometre, and a third of a
# million tussocks is most of the vegetation's memory. A look choice.
GRASS_REACH = (1000.0, 1800.0)

# LOOK CHOICES, every one. `sink`: how far the base goes into the ground, metres; `tilt`: the
# sigma of the lean, radians; `xy`: the range of the sideways stretch against the height;
# `margin`: metres kept clear of the era's monuments (beyond their aprons, APRON).
KINDS = {
    "date-palm": dict(sink=0.3, tilt=0.05, xy=(0.95, 1.05), margin=10.0),
    "doum-palm": dict(sink=0.25, tilt=0.04, xy=(0.9, 1.1), margin=10.0),
    "acacia": dict(sink=0.2, tilt=0.03, xy=(0.9, 1.2), margin=10.0),
    "tree": dict(sink=0.2, tilt=0.03, xy=(0.9, 1.15), margin=10.0),
    "shrub": dict(sink=0.06, tilt=0.1, xy=(0.8, 1.25), margin=3.0),
    "bush": dict(sink=0.08, tilt=0.06, xy=(0.8, 1.3), margin=3.0),
    "tussock": dict(sink=0.05, tilt=0.12, xy=(0.8, 1.25), margin=1.0),
    "grass": dict(sink=0.02, tilt=0.14, xy=(0.8, 1.3), margin=0.0),
    "papyrus": dict(sink=0.12, tilt=0.07, xy=(0.8, 1.2), margin=2.0),
    "reed": dict(sink=0.12, tilt=0.07, xy=(0.8, 1.2), margin=2.0),
}

# Bare ground kept round each kind of monument before any plant's own margin: a pavement's
# width round the pyramids, a metre or three round the rest. Look choices.
APRON = {"pyramid": 8.0, "precinct": 2.0, "queen": 3.0, "temple": 3.0, "sphinx": 1.0, "cut": 1.0, "mastaba": 1.5,
         "causeway": 2.0, "road": 2.0}

# LOOK CHOICES: each era's planting. `cover` is the grass cover by zone (0..1) with the share
# of it left bare in patches of about `wavelength` metres; `tint` the two colours the grass
# gives the ground from afar, how strongly, and the soil's hue where the grass is thin (see
# tint_ground); `near` the tufts round a camera (per square
# metre at the camera, falling off over `falloff` metres) and their dryness. Each plant entry:
# `zone` (plateau, lowland, valley, shore, village or box), `per_ha` plants a hectare where the
# zone is full, or `count` plants in all, or `rows` along field edges; `clump` (wavelength,
# share of the ground) gathers them into groves; `hollows` keeps them to the plateau's low
# ground; `grass` follows the grass cover; `within` (full, none) thins them with distance from
# Khufu; `far` carries them out to REACH; `avoid` keeps them off the buildings of the village
# or the city.
STATES = {
    "first-time": dict(
        cover=dict(plateau=0.85, lowland=1.0, bare=0.15, wavelength=70.0),
        tint=dict(grass=("707c3c", "8b8d4e"), strength=0.8, soil=("8e7654", "a08966")),
        near=dict(per_m2=18.0, falloff=32.0, dry=(0.0, 0.3)),
        plants=[
            dict(kind="acacia", zone="plateau", per_ha=1.3, height=(4.5, 9.5), clump=(220.0, 0.45), far=True),
            dict(kind="doum-palm", zone="plateau", per_ha=0.12, height=(8.0, 12.0), hollows=True, far=True),
            dict(kind="date-palm", zone="plateau", per_ha=0.05, height=(10.0, 15.0), hollows=True, far=True),
            dict(kind="bush", zone="plateau", per_ha=9.0, height=(0.7, 1.9), clump=(110.0, 0.5)),
            dict(kind="shrub", zone="plateau", per_ha=2.0, height=(0.9, 1.7)),
            dict(kind="tussock", zone="plateau", per_ha=250.0, height=(0.45, 0.95), grass=True, dry=(0.15, 0.55), within=GRASS_REACH),
            dict(kind="date-palm", zone="lowland", per_ha=8.0, height=(11.0, 19.0), clump=(300.0, 0.55), far=True),
            dict(kind="doum-palm", zone="lowland", per_ha=4.0, height=(8.0, 14.0), clump=(260.0, 0.4), far=True),
            dict(kind="tree", zone="lowland", per_ha=2.5, height=(6.0, 11.0), far=True),
            dict(kind="acacia", zone="lowland", per_ha=0.8, height=(5.0, 9.5), far=True),
            dict(kind="bush", zone="lowland", per_ha=18.0, height=(0.8, 2.0)),
            dict(kind="tussock", zone="lowland", per_ha=420.0, height=(0.5, 1.0), grass=True, dry=(0.0, 0.3), within=GRASS_REACH),
            dict(kind="papyrus", zone="shore", per_ha=1400.0, height=(2.2, 3.8)),
            dict(kind="reed", zone="shore", per_ha=1100.0, height=(1.8, 2.9)),
        ]),
    "lion": dict(
        cover=dict(plateau=0.6, lowland=0.9, bare=0.45, wavelength=45.0),
        tint=dict(grass=("8a8752", "a39b67"), strength=0.7, soil=("a38c64", "b39c74")),
        near=dict(per_m2=9.0, falloff=28.0, dry=(0.4, 0.95)),
        plants=[
            dict(kind="acacia", zone="plateau", per_ha=0.45, height=(4.0, 8.5), clump=(260.0, 0.35), far=True),
            dict(kind="doum-palm", zone="plateau", per_ha=0.02, height=(8.0, 11.0), hollows=True),
            dict(kind="bush", zone="plateau", per_ha=4.0, height=(0.6, 1.6), clump=(110.0, 0.4)),
            dict(kind="shrub", zone="plateau", per_ha=5.0, height=(0.7, 1.6)),
            dict(kind="tussock", zone="plateau", per_ha=150.0, height=(0.4, 0.85), grass=True, dry=(0.45, 0.95), within=GRASS_REACH),
            dict(kind="date-palm", zone="lowland", per_ha=6.0, height=(11.0, 19.0), clump=(300.0, 0.5), far=True),
            dict(kind="doum-palm", zone="lowland", per_ha=3.0, height=(8.0, 14.0), clump=(260.0, 0.4), far=True),
            dict(kind="tree", zone="lowland", per_ha=1.8, height=(6.0, 10.0), far=True),
            dict(kind="acacia", zone="lowland", per_ha=0.7, height=(5.0, 9.0), far=True),
            dict(kind="bush", zone="lowland", per_ha=14.0, height=(0.8, 2.0)),
            dict(kind="tussock", zone="lowland", per_ha=330.0, height=(0.5, 1.0), grass=True, dry=(0.2, 0.6), within=GRASS_REACH),
            dict(kind="papyrus", zone="shore", per_ha=1200.0, height=(2.2, 3.6)),
            dict(kind="reed", zone="shore", per_ha=1000.0, height=(1.8, 2.8)),
        ]),
    "built": dict(
        cover=dict(valley=0.9, bare=0.2, wavelength=50.0),
        tint=None,
        near=dict(per_m2=10.0, falloff=30.0, dry=(0.0, 0.25)),
        plants=[
            dict(kind="date-palm", zone="valley", per_ha=4.0, height=(10.0, 18.0), clump=(250.0, 0.35), far=True),
            dict(kind="date-palm", zone="valley", height=(9.0, 16.0),
                 rows=dict(field=(60.0, 140.0), spacing=(7.0, 10.0), share=0.3, angle=-8.0, box=(430.0, 2600.0, -2000.0, 1500.0))),
            dict(kind="date-palm", zone="box", box=(420.0, 520.0, -560.0, -380.0), count=22, height=(10.0, 16.0)),
            dict(kind="tree", zone="valley", per_ha=0.6, height=(6.0, 10.0), far=True),
            dict(kind="acacia", zone="valley", per_ha=0.3, height=(5.0, 8.0), far=True),
            dict(kind="doum-palm", zone="valley", per_ha=0.2, height=(8.0, 13.0), far=True),
            dict(kind="bush", zone="valley", per_ha=3.0, height=(0.8, 1.8)),
            dict(kind="papyrus", zone="shore", per_ha=600.0, height=(2.0, 3.4)),
            dict(kind="reed", zone="shore", per_ha=900.0, height=(1.8, 2.8)),
        ]),
    "stripped": dict(
        cover=dict(valley=0.7, bare=0.3, wavelength=50.0),
        tint=None,
        near=dict(per_m2=8.0, falloff=28.0, dry=(0.1, 0.5)),
        plants=[
            dict(kind="date-palm", zone="valley", per_ha=2.0, height=(10.0, 19.0), clump=(220.0, 0.3),
                 box=(430.0, 2800.0, -2200.0, 1800.0), far=True),
            dict(kind="date-palm", zone="valley", height=(10.0, 18.0),
                 rows=dict(field=(70.0, 160.0), spacing=(8.0, 12.0), share=0.15, angle=-8.0, box=(430.0, 2600.0, -2000.0, 1500.0))),
            dict(kind="date-palm", zone="village", per_ha=5.0, height=(10.0, 19.0), avoid="village"),
            dict(kind="tree", zone="valley", per_ha=0.3, height=(6.0, 10.0)),
        ]),
    "today": dict(
        cover=None, tint=None, near=None,
        plants=[
            dict(kind="date-palm", zone="valley", per_ha=0.35, height=(10.0, 18.0), box=(430.0, 2000.0, -1500.0, 800.0),
                 avoid="city"),
        ]),
}

GRASS_MIX = (0.4, 0.45, 0.15)      # near a camera: shares of short, medium and tall seeded tufts (a look choice)

NOTHING = dict(cover=None, tint=None, near=None, plants=[])
_CACHE = {}
_NOISE = {}


def recipe(state):
    """The era's planting; an era this file does not know grows nothing (and says so once)."""
    if state not in STATES:
        if ("unknown", state) not in _CACHE:
            _CACHE[("unknown", state)] = True
            print(f"vegetation: no planting for era {state!r} (the eras are {', '.join(STATES)}); nothing grows")
        return NOTHING
    return STATES[state]


# ---------------------------------------------------------------------------------------
# Numpy: the grid, the masks, the scatter. No Blender here, so the tests run without it.
# ---------------------------------------------------------------------------------------

def _near_box():
    """The near grid's box and step, terrain.py's own when Blender can import it."""
    try:
        from .terrain import NEAR_BOX, NEAR_STEP
        return NEAR_BOX, NEAR_STEP
    except ImportError:
        return (-1950.0, 1750.0, -2150.0, 1750.0), 4.0


def _patch_lift():
    try:
        from .terrain import PATCH_LIFT
        return PATCH_LIFT
    except ImportError:
        return 0.05


def _noise(seed, extent):
    key = (seed, extent)
    if key not in _NOISE:
        _NOISE[key] = ValueNoise(seed, extent)
    return _NOISE[key]


def water_levels(state):
    """The era's open water as [(level, (x0, x1, y0, y1))]: render/giza/water.py's own numbers."""
    kind = states.spec(state)["water"]
    if not kind:
        return []
    try:
        from . import water
    except ImportError:      # outside Blender water.py cannot load; the tests pass the water themselves
        return []
    return [water.LEVELS[kind]]


def _ring_distance(pts, x, y):
    """Distance from each point to a closed polygon, zero inside it."""
    d = np.full(x.shape, np.inf)
    inside = np.zeros(x.shape, bool)
    n = len(pts)
    for k in range(n):
        ax, ay = pts[k]
        bx, by = pts[(k + 1) % n]
        ex, ey = bx - ax, by - ay
        L2 = ex * ex + ey * ey
        if L2 > 0:
            t = np.clip(((x - ax) * ex + (y - ay) * ey) / L2, 0.0, 1.0)
            d = np.minimum(d, np.hypot(x - ax - t * ex, y - ay - t * ey))
        if ay != by:
            crosses = (ay > y) != (by > y)
            xi = ax + (y - ay) * ex / (by - ay)
            inside ^= crosses & (x < xi)
    return np.where(inside, 0.0, d)


def shapes(state, terrain=None):
    """
    Everything standing on the ground in this era, as (kind, geometry, apron): the pyramid
    squares the terrain was flattened under, its cuts (the Sphinx's ditch), and the temples,
    the Sphinx, the mastabas, the tombs, pits and walls and the causeway where the era has them.
    """
    S = states.spec(state)
    out = []
    squares = getattr(terrain, "footprints", None)
    if squares is None:
        squares = [(P["cx"], P["cy"], P["half"]) for P in data.PYRAMIDS.values()]
        if S["queens"]:
            squares += [(q["cx"], q["cy"], q["half"]) for q in data.QUEENS]
    for sq in squares:
        P = next((P for P in data.PYRAMIDS.values() if abs(P["cx"] - sq[0]) < 1 and abs(P["cy"] - sq[1]) < 1), None)
        key = "queen" if sq[2] <= 40 else "precinct" if P is not None and sq[2] > P["half"] + 5 else "pyramid"
        out.append(("square", (sq[0], sq[1], sq[2]), APRON[key]))
    for c in getattr(terrain, "cuts", None) or ():
        out.append(("rect", tuple(c[:4]), APRON["cut"]))
    from . import town            # the builders' town, as built: nothing grows through its houses
    for box in town.extents(state):
        out.append(("rect", box, APRON["temple"]))
    for f in data.FOOTPRINTS:
        g = f.get("group")
        if g == "temples" and f["id"] in S["temples"]:
            key = "temple"
        elif g == "sphinx":
            key = "sphinx"
        elif g in ("mastabas", "tombs", "pits", "walls") and S["mastabas"]:
            key = "mastaba"
        elif g == "causeways" and S["causeway"]:
            key = "causeway"
        else:
            continue
        out.append(("ring", f["ring"], APRON[key]))
    return out


def keepout(state, terrain, X, Y, dmax=40.0):
    """Metres from each node to the nearest monument's apron (negative inside), capped at dmax."""
    D = np.full(X.shape, dmax, np.float32)
    xs, ys = X[0], Y[:, 0]
    for kind, geo, apron in shapes(state, terrain):
        if kind == "square":
            cx, cy, h = geo
            box = (cx - h, cx + h, cy - h, cy + h)
        elif kind == "rect":
            box = geo
        else:
            pts = np.asarray(geo, np.float64)
            box = (pts[:, 0].min(), pts[:, 0].max(), pts[:, 1].min(), pts[:, 1].max())
        reach = dmax + apron
        i0, i1 = np.searchsorted(xs, box[0] - reach), np.searchsorted(xs, box[1] + reach)
        j0, j1 = np.searchsorted(ys, box[2] - reach), np.searchsorted(ys, box[3] + reach)
        if i0 >= i1 or j0 >= j1:
            continue
        x, y = X[j0:j1, i0:i1], Y[j0:j1, i0:i1]
        if kind == "square":
            d = np.hypot(np.maximum(np.abs(x - cx) - h, 0.0), np.maximum(np.abs(y - cy) - h, 0.0))
        elif kind == "rect":
            d = np.hypot(np.maximum(np.maximum(box[0] - x, x - box[1]), 0.0), np.maximum(np.maximum(box[2] - y, y - box[3]), 0.0))
        else:
            d = _ring_distance(pts, x, y)
        D[j0:j1, i0:i1] = np.minimum(D[j0:j1, i0:i1], d - apron)
    return D


def _wet(X, Y, Z, water):
    """Dry land (1) and the shore band from 0.45 m under each water plane to 0.8 m above it."""
    dry = np.ones(Z.shape, np.float32)
    shore = np.zeros(Z.shape, np.float32)
    for level, (x0, x1, y0, y1) in water:
        inside = (X > x0) & (X < x1) & (Y > y0) & (Y < y1)
        dry = np.where(inside, np.minimum(dry, smoothstep(level + 0.1, level + 0.6, Z)), dry)
        band = smoothstep(level - 0.45, level - 0.1, Z) * smoothstep(level + 0.8, level + 0.35, Z)
        shore = np.where(inside, np.maximum(shore, band), shore)
    return dry.astype(np.float32), shore.astype(np.float32)


def _box_blur(Z, r):
    P = np.pad(Z.astype(np.float64), r, mode="edge")
    S = np.pad(P.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    k = 2 * r + 1
    return (S[k:, k:] - S[:-k, k:] - S[k:, :-k] + S[:-k, :-k]) / (k * k)


class Grid:
    """
    Every field the scatter reads, on one lattice of nodes: the ground's height, low ground,
    the green valley the ground shader paints (materials.ground's own mask), dry land and
    shore for the era's water, the distance to the monuments, the grass cover.
    `near` grids are the terrain's 4 m nodes; the far grid is coarse and has no monuments.
    """

    def __init__(self, state, terrain, xs, ys, Z, water=None, near=True):
        self.state, self.terrain, self.near = state, terrain, near
        self.xs, self.ys = np.asarray(xs, np.float64), np.asarray(ys, np.float64)
        self.Z = np.asarray(Z, np.float32)
        self.step = float(self.xs[1] - self.xs[0])
        self.X, self.Y = np.meshgrid(self.xs, self.ys)
        self.water = water_levels(state) if water is None else water
        Z = self.Z
        self.lowland = smoothstep(-26.0, -32.0, Z).astype(np.float32)
        self.valley = (smoothstep(-26.0, -31.0, Z) * smoothstep(430.0, 520.0, self.X)).astype(np.float32)
        self.dry, self.shore = _wet(self.X, self.Y, Z, self.water)
        if near:
            self.distance = keepout(state, terrain, self.X, self.Y)
        else:
            self.distance = np.full(Z.shape, 1e3, np.float32)
        r = max(1, int(round(120.0 / self.step)))
        self.hollows = smoothstep(-0.5, -3.0, Z - _box_blur(Z, r)).astype(np.float32)
        self.cover = self._cover() if near else np.zeros(Z.shape, np.float32)
        self.tint = (self.cover * (1.0 - self.valley)).astype(np.float32)

    def _cover(self):
        """Grass cover, 0..1: the era's cover by zone, bare patches, kept off monuments and water."""
        C = recipe(self.state)["cover"]
        if not C:
            return np.zeros(self.Z.shape, np.float32)
        base = C.get("plateau", 0.0) * (1.0 - self.lowland) + C.get("lowland", 0.0) * self.lowland + C.get("valley", 0.0) * self.valley
        keep = 1.0
        if C.get("bare", 0.0) > 0:
            n = _noise(31, 2400.0).fbm(self.X, self.Y, C["wavelength"], 3, key=1)
            lo, hi = np.quantile(n.ravel()[::7], [max(C["bare"] - 0.06, 0.0), min(C["bare"] + 0.06, 1.0)])
            keep = smoothstep(lo, hi, n)
        vary = 0.8 + 0.4 * np.clip(0.5 + _noise(37, 2400.0).fbm(self.X, self.Y, 18.0, 2, key=2), 0.0, 1.0)
        return (np.clip(base * keep * vary, 0.0, 1.0) * smoothstep(0.0, 2.0, self.distance) * self.dry).astype(np.float32)

    def clear(self, margin):
        return smoothstep(margin, margin + 2.0, self.distance)

    def zone(self, name, box=None):
        if name == "plateau":
            m = (1.0 - self.lowland) * self.dry
        elif name == "lowland":
            m = self.lowland * self.dry
        elif name == "valley":
            m = self.valley * self.dry
        elif name == "village":
            m = self.valley * self.dry
            box = box or _village_box()
        elif name == "shore":
            m = self.shore.copy()
        elif name == "box":
            m = self.dry.copy()
        else:
            raise KeyError(f"no zone {name!r}")
        if box is not None:
            m = m * ((self.X > box[0]) & (self.X < box[1]) & (self.Y > box[2]) & (self.Y < box[3]))
        return m

    def clump(self, wavelength, share, seed=0):
        """1 in groves covering about `share` of the ground, 0 between them."""
        n = _noise(41 + seed, 6000.0).fbm(self.X, self.Y, wavelength, 3, key=int(wavelength))
        q = _clump_threshold(wavelength, share, seed)
        return smoothstep(q - 0.08, q + 0.08, n)

    def _bilinear(self, F, i, j, u, v):
        return (F[j, i] * (1 - u) * (1 - v) + F[j, i + 1] * u * (1 - v) + F[j + 1, i] * (1 - u) * v + F[j + 1, i + 1] * u * v)

    def at(self, F, x, y):
        """Bilinear sample of a node field at points; outside the grid, the nearest edge node."""
        fx = np.clip((np.asarray(x, np.float64) - self.xs[0]) / self.step, 0.0, len(self.xs) - 1.000001)
        fy = np.clip((np.asarray(y, np.float64) - self.ys[0]) / self.step, 0.0, len(self.ys) - 1.000001)
        i, j = fx.astype(np.int64), fy.astype(np.int64)
        return self._bilinear(F, i, j, fx - i, fy - j)

    def inside(self, x, y):
        return (x >= self.xs[0]) & (x <= self.xs[-1]) & (y >= self.ys[0]) & (y <= self.ys[-1])

    def scatter(self, density, rng):
        """
        Points at `density` per square metre (a node field): drawn cell by cell at the cell's
        highest corner, then each kept by the density at its own spot, so a margin or a
        shoreline is held to within centimetres and not to the cell. Heights off the grid.
        """
        density = np.maximum(density, 0.0)
        peak = np.maximum(np.maximum(density[:-1, :-1], density[1:, :-1]), np.maximum(density[:-1, 1:], density[1:, 1:]))
        n = rng.poisson(peak * self.step ** 2)
        j, i = np.nonzero(n)
        k = n[j, i]
        j, i = np.repeat(j, k), np.repeat(i, k)
        u, v = rng.random(len(i)), rng.random(len(i))
        keep = rng.random(len(i)) * peak[j, i] < self._bilinear(density, i, j, u, v)
        j, i, u, v = j[keep], i[keep], u[keep], v[keep]
        return self.xs[i] + u * self.step, self.ys[j] + v * self.step, self._bilinear(self.Z, i, j, u, v)

    def choose(self, weight, count, rng):
        """Exactly `count` points, one per cell, cells chosen by weight."""
        w = 0.25 * (weight[:-1, :-1] + weight[1:, :-1] + weight[:-1, 1:] + weight[1:, 1:])
        flat = np.maximum(w.ravel(), 0.0)
        if flat.sum() <= 0:
            return np.zeros(0), np.zeros(0), np.zeros(0)
        cells = rng.choice(flat.size, size=min(count, int((flat > 0).sum())), replace=False, p=flat / flat.sum())
        j, i = np.unravel_index(cells, w.shape)
        u, v = rng.random(len(i)), rng.random(len(i))
        return self.xs[i] + u * self.step, self.ys[j] + v * self.step, self._bilinear(self.Z, i, j, u, v)


def _clump_threshold(wavelength, share, seed):
    """The noise level above which `share` of the ground lies, measured once over the reach."""
    key = ("clump", wavelength, share, seed)
    if key not in _CACHE:
        g = np.random.default_rng(99)
        x = g.uniform(REACH[0], REACH[1], 20000)
        y = g.uniform(REACH[2], REACH[3], 20000)
        n = _noise(41 + seed, 6000.0).fbm(x, y, wavelength, 3, key=int(wavelength))
        _CACHE[key] = float(np.quantile(n, 1.0 - share))
    return _CACHE[key]


def _village_box():
    try:
        from .city import VILLAGE_BOX
        return VILLAGE_BOX
    except ImportError:
        return (420.0, 1600.0, -1600.0, 900.0)


def _mesh_grid(name):
    """The (xs, ys, Z) of a grid mesh in the scene laid row by row as terrain.grid_object lays it, or None."""
    if bpy is None:
        return None
    ob = bpy.data.objects.get(name)
    if ob is None or ob.type != "MESH" or len(ob.data.vertices) < 4:
        return None
    co = np.empty(len(ob.data.vertices) * 3, np.float32)
    ob.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3) @ np.array(ob.matrix_world, np.float32)[:3, :3].T + np.array(ob.matrix_world, np.float32)[:3, 3]
    drops = np.nonzero(np.diff(co[:, 0]) < 0)[0]
    nx = int(drops[0]) + 1 if len(drops) else len(co)
    if nx < 2 or len(co) % nx:
        return None
    G = co.reshape(-1, nx, 3)
    xs, ys = G[0, :, 0], G[:, 0, 1]
    if not (np.allclose(G[:, :, 0], xs[None, :], atol=1e-2) and np.allclose(G[:, :, 1], ys[:, None], atol=1e-2)):
        return None
    return xs.astype(np.float64), ys.astype(np.float64), G[:, :, 2]


def near_grid(state, terrain, box=None, water=None):
    """
    The near grid for an era: the terrain's own 4 m nodes, read off the scene's "ground near"
    mesh when it is there (so every plant stands on the surface that is rendered), else
    computed with terrain.z. `box` (x0, x1, y0, y1) keeps to part of it, snapped to the nodes.
    """
    nb, step = _near_box()
    got = _mesh_grid("ground near") if box is None else None
    if got is not None:
        xs, ys, Z = got
    else:
        b = nb if box is None else box
        x0 = nb[0] + math.floor((max(b[0], nb[0]) - nb[0]) / step) * step
        y0 = nb[2] + math.floor((max(b[2], nb[2]) - nb[2]) / step) * step
        xs = np.arange(x0, min(b[1], nb[1]) + 0.1, step)
        ys = np.arange(y0, min(b[3], nb[3]) + 0.1, step)
        X, Y = np.meshgrid(xs.astype(np.float32), ys.astype(np.float32))
        Z = terrain.z(X, Y) if hasattr(terrain, "z") else terrain.surface(X, Y)
    return Grid(state, terrain, xs, ys, Z, water=water, near=True)


def far_grid(state, terrain, water=None):
    xs = np.arange(REACH[0], REACH[1] + 0.1, FAR_STEP)
    ys = np.arange(REACH[2], REACH[3] + 0.1, FAR_STEP)
    X, Y = np.meshgrid(xs.astype(np.float32), ys.astype(np.float32))
    return Grid(state, terrain, xs, ys, terrain.surface(X, Y), water=water, near=False)


def _far_surface(terrain, x, y):
    """Heights as the far ground mesh draws them: its 60 m nodes, interpolated."""
    try:
        from .terrain import FAR_HALF, FAR_STEP as MESH_STEP
    except ImportError:
        return terrain.surface(x, y)
    fx, fy = (x + FAR_HALF) / MESH_STEP, (y + FAR_HALF) / MESH_STEP
    i, j = np.floor(fx), np.floor(fy)
    u, v = fx - i, fy - j
    xa, ya = i * MESH_STEP - FAR_HALF, j * MESH_STEP - FAR_HALF
    z = lambda xx, yy: terrain.z(np.asarray(xx, np.float32), np.asarray(yy, np.float32), far=True) - 0.8
    return (z(xa, ya) * (1 - u) * (1 - v) + z(xa + MESH_STEP, ya) * u * (1 - v)
            + z(xa, ya + MESH_STEP) * (1 - u) * v + z(xa + MESH_STEP, ya + MESH_STEP) * u * v)


def _off_roads(x, y):
    """False for points on today's roads and car parks (render/giza/roads.py's own ways), with an apron."""
    ok = np.ones(len(x), bool)
    try:
        from . import roads
        ways, parks = roads.ways()
    except (ImportError, OSError, KeyError):
        return ok
    for width, pts in ways:
        pts = np.asarray(pts, np.float64)
        for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
            ex, ey = bx - ax, by - ay
            L2 = max(ex * ex + ey * ey, 1e-9)
            t = np.clip(((x - ax) * ex + (y - ay) * ey) / L2, 0.0, 1.0)
            ok &= np.hypot(x - ax - t * ex, y - ay - t * ey) > width / 2 + APRON["road"]
    for ring in parks:
        ok &= _ring_distance(np.asarray(ring, np.float64), x, y) > APRON["road"]
    return ok


def _outside_buildings(x, y, which, margin=2.5):
    """False for points on or within `margin` of a building of the village or the city (and today's roads)."""
    boxes = data.city_boxes()
    if which == "village":
        b = _village_box()
        keep = (boxes[:, 0] > b[0]) & (boxes[:, 0] < b[1]) & (boxes[:, 1] > b[2]) & (boxes[:, 1] < b[3])
        boxes = boxes[keep]
    cell = 40.0
    buckets = {}
    for k, (bx, by) in enumerate(boxes[:, :2]):
        buckets.setdefault((int(bx // cell), int(by // cell)), []).append(k)
    ok = np.ones(len(x), bool)
    for p in range(len(x)):
        ci, cj = int(x[p] // cell), int(y[p] // cell)
        for key in ((ci + a, cj + b) for a in (-1, 0, 1) for b in (-1, 0, 1)):
            for k in buckets.get(key, ()):
                bx, by, w, d, yaw = boxes[k, :5]
                c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
                dx, dy = x[p] - bx, y[p] - by
                if abs(dx * c + dy * s) < w / 2 + margin and abs(-dx * s + dy * c) < d / 2 + margin:
                    ok[p] = False
                    break
            if not ok[p]:
                break
    if which == "city":
        ok &= _off_roads(x, y)
    return ok


def _rows(grid, far, entry, kind, rng):
    """Palms along some of the field edges of a rotated grid of fields: the valley's field boundaries."""
    R = entry["rows"]
    a = math.radians(R["angle"])
    ca, sa = math.cos(a), math.sin(a)
    x0, x1, y0, y1 = R["box"]
    cx, cy = [x0, x1, x1, x0], [y0, y0, y1, y1]
    us = [px * ca + py * sa for px, py in zip(cx, cy)]
    vs = [-px * sa + py * ca for px, py in zip(cx, cy)]

    def lines(lo, hi):
        out, t = [], lo
        while t < hi:
            out.append(t)
            t += rng.uniform(*R["field"])
        return out + [hi]

    ul, vl = lines(min(us), max(us)), lines(min(vs), max(vs))
    pu, pv = [], []
    for fixed, others, along_u in ((ul, vl, False), (vl, ul, True)):
        for f in fixed:
            for k in range(len(others) - 1):
                if rng.random() > R["share"]:
                    continue
                t = others[k] + rng.uniform(0.5, 2.0)
                while t < others[k + 1] - 0.5:
                    j = rng.normal(0.0, 0.6)
                    if along_u:
                        pu.append(t)
                        pv.append(f + j)
                    else:
                        pu.append(f + j)
                        pv.append(t)
                    t += rng.uniform(*R["spacing"])
    pu, pv = np.array(pu), np.array(pv)
    x, y = pu * ca - pv * sa, pu * sa + pv * ca
    margin = KINDS[kind]["margin"]
    keep = np.zeros(len(x), bool)
    z = np.zeros(len(x))
    ins = grid.inside(x, y)
    m = grid.zone(entry["zone"]) * grid.clear(margin)
    keep[ins] = grid.at(m, x[ins], y[ins]) > 0.5
    z[ins] = grid.at(grid.Z, x[ins], y[ins])
    if far is not None:
        out = ~ins & far.inside(x, y)
        keep[out] = far.at(far.zone(entry["zone"]), x[out], y[out]) > 0.5
        z[out] = _far_surface(grid.terrain, x[out], y[out])
    return x[keep], y[keep], z[keep]


def _entry_points(grid, far, entry, rng, box=None):
    """Where one planting entry puts its plants: x, y and the ground's height under each."""
    kind = entry["kind"]
    if "rows" in entry:
        x, y, z = _rows(grid, far, entry, kind, rng)
    else:
        m = grid.zone(entry["zone"], entry.get("box")) * grid.clear(KINDS[kind]["margin"])
        if entry.get("clump"):
            m = m * grid.clump(*entry["clump"])
        if entry.get("hollows"):
            m = m * grid.hollows
        if entry.get("grass"):
            m = m * grid.cover
        if entry.get("within"):
            m = m * smoothstep(entry["within"][1], entry["within"][0], np.hypot(grid.X, grid.Y))
        if "count" in entry:
            x, y, z = grid.choose(m, entry["count"], rng)
        else:
            x, y, z = grid.scatter(m * (entry["per_ha"] / 1e4), rng)
        if entry.get("far") and far is not None:
            mf = far.zone(entry["zone"], entry.get("box"))
            if entry.get("clump"):
                mf = mf * far.clump(*entry["clump"])
            if entry.get("hollows"):
                mf = mf * far.hollows
            r = np.hypot(far.X, far.Y)
            mf = mf * np.minimum(1.0, (FAR_FALLOFF / np.maximum(r, 1.0)) ** 1.2) * ~grid.inside(far.X, far.Y)
            fx, fy, _ = far.scatter(mf * (entry["per_ha"] / 1e4), rng)
            fx, fy = fx[~grid.inside(fx, fy)], fy[~grid.inside(fx, fy)]
            x, y = np.concatenate([x, fx]), np.concatenate([y, fy])
            z = np.concatenate([z, _far_surface(grid.terrain, fx, fy)])
    if entry["zone"] == "shore" and len(x):
        # the band is narrower than a cell on a steep bank, so each point is held to it by its own height
        ok = np.zeros(len(x), bool)
        for level, (x0, x1, y0, y1) in grid.water:
            ok |= (x > x0) & (x < x1) & (y > y0) & (y < y1) & (z > level - 0.45) & (z < level + 0.8)
        x, y, z = x[ok], y[ok], z[ok]
    if entry.get("avoid") and len(x):
        ok = _outside_buildings(x, y, entry["avoid"])
        x, y, z = x[ok], y[ok], z[ok]
    if box is not None and len(x):
        ok = (x > box[0]) & (x < box[1]) & (y > box[2]) & (y < box[3])
        x, y, z = x[ok], y[ok], z[ok]
    return x, y, z


def instances(kind, x, y, z, height, heights, rng, dry=(0.0, 0.3)):
    """
    Point attributes for plants of one kind: which variant (the palm built nearest the height
    wanted, or any), the scale that gives the height wanted, a lean, a turn, `tone` (colour
    variety) and `wear` (dryness, 0 green to 1 straw).
    """
    K = KINDS[kind]
    n = len(x)
    H = np.asarray(heights, np.float64)
    h = rng.uniform(height[0], height[1], n)
    if kind in ("date-palm", "doum-palm") and len(H) > 1:
        order = np.argsort(np.abs(H[None, :] - h[:, None]), axis=1)
        var = np.where(rng.random(n) < 0.65, order[:, 0], order[:, 1])
    else:
        var = rng.integers(0, len(H), n)
    s = h / H[var]
    xy = rng.uniform(K["xy"][0], K["xy"][1], n)
    scl = np.stack([s * xy, s * xy * rng.uniform(0.92, 1.08, n), s], 1)
    rot = np.stack([rng.normal(0.0, K["tilt"], n), rng.normal(0.0, K["tilt"], n), rng.uniform(0.0, 2 * math.pi, n)], 1)
    pos = np.stack([x, y, z - K["sink"]], 1)
    patchy = np.clip(0.5 + _noise(53, 6000.0).fbm(x, y, 40.0, 2, key=5), 0.0, 1.0) if n else np.zeros(0)
    wear = np.clip(rng.uniform(dry[0], dry[1], n) + 0.3 * (patchy - 0.5), 0.0, 1.0)
    return pos, rot, scl, var.astype(np.int32), rng.random(n), wear


def plan(state, terrain, lib_heights, grid=None, far=None, box=None, seed=0):
    """
    The whole era's planting as {kind: (pos, rot, scl, var, tone, wear)}, with no Blender:
    `lib_heights` is {kind: [native height of each variant]}.
    """
    R = recipe(state)
    grid = grid or near_grid(state, terrain, box)
    if far is None and any(e.get("far") for e in R["plants"]):
        far = far_grid(state, terrain, water=grid.water)
    rng = np.random.default_rng(1009 + seed + sum(map(ord, state)))
    out = {}
    for e in R["plants"]:
        kind = e["kind"]
        if kind not in lib_heights:
            continue
        x, y, z = _entry_points(grid, far, e, rng, box)
        if not len(x):
            continue
        attrs = instances(kind, x, y, z, e["height"], lib_heights[kind], rng, e.get("dry", _dry(kind)))
        if kind in out:
            out[kind] = tuple(np.concatenate([a, b]) for a, b in zip(out[kind], attrs))
        else:
            out[kind] = attrs
    return out


def _dry(kind):
    return {"shrub": (0.3, 0.9), "acacia": (0.0, 0.45)}.get(kind, (0.0, 0.3))


def near_plan(state, grid, camera_xy, grass_heights, seed=0):
    """
    Dense tufts round a camera, cell by cell on a 1 m lattice: the era's density at the camera,
    falling off with distance to nothing at NEAR_RADIUS, times the grass cover. Returns
    (x, y, var, scale, tone, wear) with no heights.
    """
    N = recipe(state).get("near")
    if not N:
        return None
    cx, cy = camera_xy
    rng = np.random.default_rng(int(abs(cx) * 7 + abs(cy) * 13) % (2 ** 31) + seed)
    xs = np.arange(cx - NEAR_RADIUS, cx + NEAR_RADIUS, 1.0) + 0.5
    ys = np.arange(cy - NEAR_RADIUS, cy + NEAR_RADIUS, 1.0) + 0.5
    X, Y = np.meshgrid(xs, ys)
    r = np.hypot(X - cx, Y - cy)
    d = N["per_m2"] * np.exp(-r / N["falloff"]) * smoothstep(NEAR_RADIUS, 0.6 * NEAR_RADIUS, r)
    d = d * grid.at(grid.cover, X, Y) * grid.inside(X, Y)
    n = rng.poisson(d)
    j, i = np.nonzero(n)
    k = n[j, i]
    j, i = np.repeat(j, k), np.repeat(i, k)
    x = xs[i] - 0.5 + rng.random(len(i))
    y = ys[j] - 0.5 + rng.random(len(i))
    H = np.asarray(grass_heights, np.float64)
    groups = np.array_split(np.argsort(H), 3)
    pick = rng.choice(3, size=len(x), p=np.asarray(GRASS_MIX) / sum(GRASS_MIX))
    var = np.array([groups[g][rng.integers(0, len(groups[g]))] for g in pick], np.int32) if len(x) else np.zeros(0, np.int32)
    rr = np.hypot(x - cx, y - cy)
    scale = rng.uniform(0.8, 1.3, len(x)) * (1.0 + rr / 220.0)
    patchy = np.clip(0.5 + _noise(59, 2400.0).fbm(x, y, 25.0, 2, key=6), 0.0, 1.0) if len(x) else np.zeros(0)
    wear = np.clip(rng.uniform(N["dry"][0], N["dry"][1], len(x)) + 0.35 * (patchy - 0.5), 0.0, 1.0)
    return x, y, var, scale, rng.random(len(x)), wear


# ---------------------------------------------------------------------------------------
# Blender: the library, the passes, the ground tint.
# ---------------------------------------------------------------------------------------

def library(parent=None, log=print, kinds=None):
    """
    The plant variants of `kinds` (all when None), appended from build/vegetation/plants.blend
    into a collection "vegetation library" and parked below the world, as variants.py parks
    its originals. Only what is asked for is appended, and what is already there is kept: a
    parked original is still in the scene, so every kind loaded costs its meshes whether or
    not the era plants it. Returns {kind: (collection, [native height of each variant, in
    Collection Info's order])}.
    """
    have = {k: v for k, v in (_CACHE.get("lib") or {}).items() if bpy.data.collections.get(v[0]) is not None}
    holder = bpy.data.collections.get(_CACHE.get("holder", ""))
    if holder is None:
        have = {}
    if not os.path.exists(LIBRARY):
        _prepare_in_child(log)
    with bpy.data.libraries.load(LIBRARY, link=False) as (src, dst):
        names = [n for n in src.collections if n.startswith("veg ") and n[4:] not in have and (kinds is None or n[4:] in kinds)]
        dst.collections = names
    if dst.collections:
        if holder is None:
            holder = bpy.data.collections.new("vegetation library")
            (parent or bpy.context.scene.collection).children.link(holder)
            _CACHE["holder"] = holder.name
        for c in dst.collections:
            holder.children.link(c)
            obs = sorted(c.objects, key=lambda o: o.name)     # Collection Info takes its children by name
            for o in obs:
                o.location = PARKED
            have[c.name[4:].split(".")[0]] = (c.name, [float(o.get("height", 1.0)) for o in obs])
        log(f"vegetation library: {', '.join(f'{k} ({len(h)})' for k, (c, h) in sorted(have.items()))}")
    _CACHE["lib"] = have
    return {k: (bpy.data.collections[name], h) for k, (name, h) in have.items() if kinds is None or k in kinds}


def _prepare_in_child(log=print):
    """Prepare the library in a child Blender, so the scene being built is not reset."""
    here = os.path.abspath(__file__)
    log(f"vegetation: preparing {LIBRARY} in a child Blender (about two minutes, once)")
    subprocess.run([bpy.app.binary_path, "-b", "--factory-startup", "-P", here, "--", "prepare"], check=True)


def _grid_for(state, terrain, box=None, log=print, around=None):
    """The era's near grid, cached; `around` (x, y) takes a cached grid that covers NEAR_RADIUS round it."""
    key = (state, id(terrain), box)
    got = _CACHE.get("grid")
    if got is not None and got[0] == key:
        return got[1]
    if got is not None and around is not None and got[0][:2] == key[:2]:
        g = got[1]
        x, y = around
        if g.xs[0] <= x - NEAR_RADIUS and g.xs[-1] >= x + NEAR_RADIUS and g.ys[0] <= y - NEAR_RADIUS and g.ys[-1] >= y + NEAR_RADIUS:
            return g
    t = time.time()
    grid = near_grid(state, terrain, box)
    _CACHE["grid"] = (key, grid)
    log(f"vegetation grid {grid.Z.shape[1]} x {grid.Z.shape[0]} nodes in {time.time() - t:.1f}s")
    return grid


def build(state, terrain, coll, rng=None, log=print, camera_xy=None, box=None):
    """
    Scatter the era's plants over the scene, into `coll`. `rng` is accepted for the scene's
    calling convention and not used: the vegetation seeds itself, so it does not move when
    another layer draws more or fewer random numbers. `camera_xy` also lays the tufts round
    that camera (`near_camera`); `box` (x0, x1, y0, y1) keeps the whole pass inside a box,
    for tests. Returns the point-cloud objects.
    """
    from .instancing import field
    t0 = time.time()
    R = recipe(state)
    if not R["plants"] and not R["near"] and camera_xy is None:
        return []
    _CACHE.pop("grid", None)          # a new scene may reuse an old terrain's id; never trust a grid across builds
    grid = _grid_for(state, terrain, box, log)
    _fill_cover_image(state, grid)
    obs = []
    if R["plants"]:
        lib = library(coll, log, kinds={e["kind"] for e in R["plants"]} | ({"grass"} if R["near"] else set()))
        heights = {k: h for k, (c, h) in lib.items()}
        planned = plan(state, terrain, heights, grid=grid, box=box)
        for kind, (pos, rot, scl, var, tone, wear) in planned.items():
            obs.append(field(f"veg {kind}", lib[kind][0], pos, rot, scl, var, tone, wear, coll, log))
        total = sum(len(v[0]) for v in planned.values())
        log(f"vegetation {state}: {total:,} plants in {time.time() - t0:.1f}s")
    if camera_xy is not None:
        ob = near_camera(state, terrain, coll, camera_xy, log)
        if ob is not None:
            obs.append(ob)
    return obs


def near_camera(state, terrain, coll, camera_xy, log=print):
    """
    Dense small tufts of grass within NEAR_RADIUS of a camera, into `coll` (the per-view
    collection), where the era's grass cover allows them. Inside the displaced ground patch
    the tufts stand on its lifted surface; elsewhere a few centimetres into the near grid.
    Returns the point cloud, or None where nothing grows.
    """
    from .instancing import field
    if not recipe(state).get("near"):
        return None
    t0 = time.time()
    lib = library(None, log, kinds={"grass"})
    grid = _grid_for(state, terrain, None, log, around=camera_xy)
    coll_grass, heights = lib["grass"]
    got = near_plan(state, grid, camera_xy, heights)
    if got is None or not len(got[0]):
        return None
    x, y, var, scale, tone, wear = got
    z = grid.at(grid.Z, x, y) - 0.03
    patch = next((o for o in (coll.objects if coll else ()) if o.name.startswith("ground patch")), None)
    if patch is not None and hasattr(terrain, "z"):
        xs = [(patch.matrix_world @ v.co).x for v in (patch.data.vertices[0], patch.data.vertices[-1])]
        ys = [(patch.matrix_world @ v.co).y for v in (patch.data.vertices[0], patch.data.vertices[-1])]
        on = (x > min(xs)) & (x < max(xs)) & (y > min(ys)) & (y < max(ys))
        if on.any():
            # on the patch's undisplaced surface: its displacement (outward only, up to 0.12 m) buries the foot
            z[on] = terrain.z(x[on].astype(np.float32), y[on].astype(np.float32)) + _patch_lift() + 0.01
    n = len(x)
    g = np.random.default_rng(n)
    K = KINDS["grass"]
    xy = g.uniform(K["xy"][0], K["xy"][1], n)
    pos = np.stack([x, y, z - K["sink"]], 1)
    rot = np.stack([g.normal(0.0, K["tilt"], n), g.normal(0.0, K["tilt"], n), g.uniform(0.0, 2 * math.pi, n)], 1)
    scl = np.stack([scale * xy, scale * xy, scale], 1)
    ob = field("veg grass near camera", coll_grass, pos, rot, scl, var, tone, wear, coll, log)
    log(f"vegetation near ({camera_xy[0]:.0f}, {camera_xy[1]:.0f}): {n:,} tufts in {time.time() - t0:.1f}s")
    return ob


# --- The ground tint ---------------------------------------------------------------------

def ground_tint(state):
    """
    The colour the era's grass gives the ground from a distance, as linear RGBA, and how
    strongly it covers the ground where the cover is full: ((r, g, b, 1), strength), with
    strength 0 in the eras where nothing grows on the plateau. A look choice.
    """
    from .nodes import hexlin
    T = recipe(state).get("tint")
    if not T:
        return (0.0, 0.0, 0.0, 1.0), 0.0
    ca, cb = (hexlin(c) for c in T["grass"])
    return tuple((p + q) / 2 for p, q in zip(ca[:3], cb[:3])) + (1.0,), T["strength"]


def _cover_image(state):
    name = f"vegetation cover {state}"
    img = bpy.data.images.get(name)
    if img is None:
        img = bpy.data.images.new(name, 1, 1, alpha=True, float_buffer=False)
        img.colorspace_settings.name = "Non-Color"
        img.pixels.foreach_set(np.zeros(4, np.float32))
    return img


def _fill_cover_image(state, grid):
    """The grid's tint cover into the era's cover image (R), alpha 1 inside it; the node group follows its extent."""
    if bpy is None or not recipe(state).get("tint"):
        return
    img = _cover_image(state)
    ny, nx = grid.tint.shape
    if tuple(img.size) != (nx, ny):
        img.scale(nx, ny)
    px = np.zeros((ny, nx, 4), np.float32)
    px[:, :, 0] = grid.tint
    px[:, :, 1] = grid.cover
    px[:, :, 3] = 1.0
    img.pixels.foreach_set(px.ravel())
    img.update()
    ng = bpy.data.node_groups.get(f"vegetation cover {state}")
    if ng is not None:
        _cover_space(ng, grid.xs, grid.ys)


def _cover_space(ng, xs, ys):
    step = xs[1] - xs[0]
    W, H = len(xs) * step, len(ys) * step
    mp = ng.nodes["cover space"]
    mp.inputs["Location"].default_value = (-(xs[0] - step / 2) / W, -(ys[0] - step / 2) / H, 0.0)
    mp.inputs["Scale"].default_value = (1.0 / W, 1.0 / H, 1.0)


def cover_group(state):
    """
    A shader node group "vegetation cover <era>" with three outputs: Cover (0..1, where the
    grass grows, from the cover image over the near grid and the era's plateau cover beyond
    it, broken up at a few metres), Color (the grass's colour from afar, drifting between the
    era's two tint colours) and Soil (the bare ground's colour between the grass).
    """
    import types
    from .nodes import Tree, hexlin
    name = f"vegetation cover {state}"
    ng = bpy.data.node_groups.get(name)
    if ng is not None:
        return ng
    ng = bpy.data.node_groups.new(name, "ShaderNodeTree")
    ng.interface.new_socket("Cover", in_out="OUTPUT", socket_type="NodeSocketFloat")
    ng.interface.new_socket("Color", in_out="OUTPUT", socket_type="NodeSocketColor")
    ng.interface.new_socket("Soil", in_out="OUTPUT", socket_type="NodeSocketColor")
    t = Tree(types.SimpleNamespace(node_tree=ng))
    out = t.node("NodeGroupOutput")
    geo = t.node("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    mp = t.node("ShaderNodeMapping")
    mp.name = "cover space"
    t.link(pos, mp.inputs["Vector"])
    im = t.node("ShaderNodeTexImage", image=_cover_image(state), interpolation="Linear", extension="CLIP")
    t.link(mp.outputs[0], im.inputs["Vector"])
    sep_c = t.node("ShaderNodeSeparateColor")
    t.link(im.outputs["Color"], sep_c.inputs[0])
    C = recipe(state)["cover"] or {}
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(pos, sep.inputs[0])
    low = t.band(t.math("MULTIPLY", sep.outputs["Z"], -1.0), 26.0, 32.0)
    valley = t.math("MULTIPLY", t.band(t.math("MULTIPLY", sep.outputs["Z"], -1.0), 26.0, 31.0), t.band(sep.outputs["X"], 430.0, 520.0))
    beyond = t.math("ADD", t.math("MULTIPLY", t.math("SUBTRACT", 1.0, low), C.get("plateau", 0.0)), t.math("MULTIPLY", low, C.get("lowland", 0.0)))
    beyond = t.math("MULTIPLY", beyond, t.math("SUBTRACT", 1.0, valley))
    cover = t.node("ShaderNodeMix", data_type="FLOAT")
    t.link(im.outputs["Alpha"], cover.inputs["Factor"])
    t.link(beyond, cover.inputs["A"])
    t.link(sep_c.outputs["Red"], cover.inputs["B"])
    broken = t.math("MULTIPLY", cover.outputs["Result"], t.math("ADD", t.math("MULTIPLY", t.noise(pos, 0.35, 3.0), 0.9), 0.55), clamp=True)
    t.link(broken, out.inputs["Cover"])
    T = recipe(state).get("tint") or dict(grass=("808080", "808080"), soil=("808080", "808080"))
    drift = t.noise(pos, 0.012, 3.0)
    t.link(t.ramp(drift, [(0.38, hexlin(T["grass"][0])), (0.62, hexlin(T["grass"][1]))]), out.inputs["Color"])
    t.link(t.ramp(t.noise(pos, 0.03, 3.0), [(0.35, hexlin(T["soil"][0])), (0.65, hexlin(T["soil"][1]))]), out.inputs["Soil"])
    nb, step = _near_box()
    xs = np.arange(nb[0], nb[1] + 0.1, step)
    ys = np.arange(nb[2], nb[3] + 0.1, step)
    _cover_space(ng, xs, ys)
    return ng


SOIL_STRENGTH = 0.85   # how far the bare ground between the grass takes the soil's hue (a look choice)


def tint_ground(material, state, soil=True):
    """
    Put the era's grass into a ground material through the cover map: where the grass is
    thin the ground takes the soil's hue (a COLOR blend, so the ground's own grain stays),
    and over it the grass's colour is mixed by cover times the era's strength. Call it on
    "ground" and "ground displaced" once the materials exist, before or after `build` (build
    fills the map). `soil=False` leaves the ground's own palette under the grass. Returns the
    grass mix node, or None in eras with no grass on the plateau.
    """
    rgba, strength = ground_tint(state)
    if strength <= 0 or material is None or material.node_tree is None:
        return None
    nt = material.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        return None
    sock = bsdf.inputs["Base Color"]
    src = sock.links[0].from_socket if sock.is_linked else None
    grp = nt.nodes.new("ShaderNodeGroup")
    grp.node_tree = cover_group(state)
    made = [grp]
    if soil:
        bare = nt.nodes.new("ShaderNodeMath")
        bare.operation = "MULTIPLY"
        bare.use_clamp = True
        inv = nt.nodes.new("ShaderNodeMath")
        inv.operation = "SUBTRACT"
        inv.inputs[0].default_value = 1.0
        nt.links.new(grp.outputs["Cover"], inv.inputs[1])
        nt.links.new(inv.outputs[0], bare.inputs[0])
        bare.inputs[1].default_value = SOIL_STRENGTH
        hue = nt.nodes.new("ShaderNodeMixRGB")
        hue.blend_type = "COLOR"
        nt.links.new(bare.outputs[0], hue.inputs["Fac"])
        if src is not None:
            nt.links.new(src, hue.inputs["Color1"])
        else:
            hue.inputs["Color1"].default_value = sock.default_value
        nt.links.new(grp.outputs["Soil"], hue.inputs["Color2"])
        src = hue.outputs["Color"]
        made += [inv, bare, hue]
    fac = nt.nodes.new("ShaderNodeMath")
    fac.operation = "MULTIPLY"
    fac.inputs[1].default_value = strength
    nt.links.new(grp.outputs["Cover"], fac.inputs[0])
    mix = nt.nodes.new("ShaderNodeMixRGB")
    nt.links.new(fac.outputs[0], mix.inputs["Fac"])
    if src is not None:
        nt.links.new(src, mix.inputs["Color1"])
    else:
        mix.inputs["Color1"].default_value = sock.default_value
    nt.links.new(grp.outputs["Color"], mix.inputs["Color2"])
    nt.links.new(mix.outputs["Color"], sock)
    x = bsdf.location.x
    for k, nd in enumerate(made + [fac, mix]):
        nd.location = (x - 1400 + 200 * k, bsdf.location.y - 400)
    return mix


# ---------------------------------------------------------------------------------------
# The library: generated plants, the Poly Haven tree and shrub, their materials. Runs in its
# own Blender (`prepare`), since it starts from factory settings.
# ---------------------------------------------------------------------------------------

class _Builder:
    """Polygons with a UV per corner, a material slot per face and float attributes per vertex."""

    def __init__(self, attrs=("leaf", "dead")):
        self.co, self.faces, self.uv, self.mat = [], [], [], []
        self.attrs = {a: [] for a in attrs}

    def vert(self, p, **a):
        self.co.append((p[0], p[1], p[2]))
        for k, lst in self.attrs.items():
            lst.append(a.get(k, 0.0))
        return len(self.co) - 1

    def face(self, idx, uv, mat=0):
        self.faces.append(tuple(idx))
        self.uv.extend(uv)
        self.mat.append(mat)

    def mesh(self, name, materials):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.co, [], self.faces)
        layer = me.uv_layers.new(name="UVMap")
        layer.data.foreach_set("uv", np.asarray(self.uv, np.float32).ravel())
        me.polygons.foreach_set("material_index", np.asarray(self.mat, np.int32))
        for k, vals in self.attrs.items():
            at = me.attributes.new(k, "FLOAT", "POINT")
            at.data.foreach_set("value", np.asarray(vals, np.float32))
        for m in materials:
            me.materials.append(m)
        me.update()
        me.shade_smooth()
        return me


def _blade(b, root, yaw, length, width, lean, curl, twist=0.0, segs=4, taper=0.55, mat=0, **attrs):
    """
    A blade or leaf as a strip from `root`: `lean` is its angle from the vertical at the root
    and `curl` how much further it bends by the tip (radians), towards `yaw`; parallel-sided
    to `taper` of its length, then narrowing to a point. Returns its centreline.
    """
    from mathutils import Vector
    cy, sy = math.cos(yaw), math.sin(yaw)
    p = Vector(root)
    line, rows = [], []
    for i in range(segs + 1):
        t = i / segs
        th = lean + curl * t * t
        tw = yaw + 0.5 * math.pi + twist * t
        side = Vector((math.cos(tw), math.sin(tw), 0.0))
        w = width if t <= taper else width * (1.0 - t) / (1.0 - taper)
        line.append(p.copy())
        if i == segs or w < 1e-5:
            rows.append((b.vert(p, **attrs),))
        else:
            h = side * (0.5 * w)
            rows.append((b.vert(p - h, **attrs), b.vert(p + h, **attrs)))
        p = p + Vector((math.sin(th) * cy, math.sin(th) * sy, math.cos(th))) * (length / segs)
    for i in range(segs):
        a, c = rows[i], rows[i + 1]
        t0, t1 = i / segs, (i + 1) / segs
        if len(a) == 1:
            break
        if len(c) == 2:
            b.face((a[0], a[1], c[1], c[0]), [(0, t0), (1, t0), (1, t1), (0, t1)], mat)
        else:
            b.face((a[0], a[1], c[0]), [(0, t0), (1, t0), (0.5, t1)], mat)
    return line


def _along(line, t):
    f = min(max(t, 0.0), 1.0) * (len(line) - 1)
    i = min(int(f), len(line) - 2)
    return line[i].lerp(line[i + 1], f - i)


def _tube(b, pts, radii, sides, mat=0, v_scale=1.0, **attrs):
    """A tube along a polyline; u runs round it, v along it in metres times v_scale."""
    from mathutils import Vector
    n = len(pts)
    T = [(pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized() for i in range(n)]
    N = T[0].cross(Vector((0.0, 0.0, 1.0)) if abs(T[0].z) < 0.9 else Vector((1.0, 0.0, 0.0))).normalized()
    rings, s = [], 0.0
    for i in range(n):
        if i:
            s += (pts[i] - pts[i - 1]).length
            N = N - T[i] * N.dot(T[i])
            N = N.normalized() if N.length > 1e-6 else T[i].orthogonal().normalized()
        B = T[i].cross(N)
        rings.append(([b.vert(pts[i] + (N * math.cos(2 * math.pi * k / sides) + B * math.sin(2 * math.pi * k / sides)) * radii[i], **attrs)
                       for k in range(sides)], s * v_scale))
    for i in range(n - 1):
        (r0, s0), (r1, s1) = rings[i], rings[i + 1]
        for k in range(sides):
            k1 = (k + 1) % sides
            u0, u1 = k / sides, (k + 1) / sides
            b.face((r0[k], r0[k1], r1[k1], r1[k]), [(u0, s0), (u1, s0), (u1, s1), (u0, s1)], mat)


def grass_tuft(seed, blades, height, spread, lean, curl, stalks=0, dead=0.0):
    """A tuft or a tussock of blades, a share of them dead, with `stalks` seed heads over it."""
    rnd = random.Random(seed)
    b = _Builder(("blade", "dead", "stalk"))
    for _ in range(blades):
        r = spread * math.sqrt(rnd.random())
        a = rnd.uniform(0.0, 2.0 * math.pi)
        out = r / spread if spread else 0.0
        _blade(b, (r * math.cos(a), r * math.sin(a), 0.0), a + rnd.gauss(0.0, 0.5), height * rnd.uniform(0.45, 1.0),
               rnd.uniform(0.005, 0.011) * (height / 0.5) ** 0.3, lean * (0.2 + 0.8 * out) + abs(rnd.gauss(0.0, 0.1)),
               curl * rnd.uniform(0.3, 1.2) * (0.4 + out), rnd.gauss(0.0, 0.6), 5,
               blade=rnd.random(), dead=1.0 if rnd.random() < dead else 0.0)
    for _ in range(stalks):
        r = spread * 0.6 * math.sqrt(rnd.random())
        a = rnd.uniform(0.0, 2.0 * math.pi)
        line = _blade(b, (r * math.cos(a), r * math.sin(a), 0.0), a, height * rnd.uniform(1.1, 1.45), 0.0028,
                      rnd.uniform(0.03, 0.2), rnd.uniform(0.05, 0.3), 0.0, 6, taper=0.97, stalk=1.0, blade=rnd.random())
        for k in range(10):
            _blade(b, _along(line, 0.72 + 0.26 * k / 9), rnd.uniform(0.0, 2 * math.pi), rnd.uniform(0.03, 0.06), 0.0035,
                   rnd.uniform(0.4, 0.9), 0.3, 0.0, 2, taper=0.5, stalk=1.0, blade=rnd.random())
    return b


def _frond(b, rnd, base, az, el, length, droop, v_angle, leaf, dead, pinnae=55, pin_len=0.46, mat=1):
    """
    A date palm's frond: a rachis arching under its own weight, two ranks of leaflets held
    in a V along it, longest in the middle. Real leaflets, so no alpha and no transparent
    bounces: the Sketchfab palm's alpha-card fronds were left behind for that reason.
    """
    from mathutils import Vector
    segs = 12
    ca, sa = math.cos(az), math.sin(az)
    pts, tans = [], []
    p = Vector(base)
    for i in range(segs + 1):
        t = i / segs
        e = el - droop * t ** 1.6
        d = Vector((math.cos(e) * ca, math.cos(e) * sa, math.sin(e)))
        pts.append(p.copy())
        tans.append(d)
        p = p + d * (length / segs)
    side = Vector((-sa, ca, 0.0))
    rows = []
    for i, q in enumerate(pts):
        w = 0.045 * (1 - i / segs) + 0.008
        rows.append((b.vert(q - side * w / 2, leaf=leaf, dead=dead), b.vert(q + side * w / 2, leaf=leaf, dead=dead)))
    for i in range(segs):
        a, c = rows[i], rows[i + 1]
        b.face((a[0], a[1], c[1], c[0]), [(0, i / segs), (0.05, i / segs), (0.05, (i + 1) / segs), (0, (i + 1) / segs)], mat)
    up = Vector((0.0, 0.0, 1.0))
    for k in range(pinnae):
        t = min(max(0.08 + 0.92 * (k + rnd.uniform(-0.3, 0.3)) / pinnae, 0.0), 0.999)
        f = t * segs
        i = int(f)
        q = pts[i].lerp(pts[i + 1], f - i)
        d = tans[i].lerp(tans[i + 1], f - i).normalized()
        s = d.cross(up)
        s = s.normalized() if s.length > 1e-4 else side.copy()
        n = s.cross(d)
        L = pin_len * (math.sin(math.pi * min(t * 1.08, 1.0)) ** 0.6) * rnd.uniform(0.85, 1.1)
        for sg in (-1.0, 1.0):
            beta = v_angle + rnd.gauss(0.0, 0.08)
            dp = (s * (sg * math.cos(beta)) + n * math.sin(beta) + d * 0.55).normalized()
            wv = d - dp * d.dot(dp)
            wv = wv.normalized() * 0.034
            p1 = q + dp * (0.45 * L) - up * (0.02 * L)
            p2 = q + dp * L - up * (0.08 * L)
            v0 = b.vert(q - wv * 0.3, leaf=leaf, dead=dead)
            v1 = b.vert(q + wv * 0.3, leaf=leaf, dead=dead)
            v2 = b.vert(p1 + wv * 0.5, leaf=leaf, dead=dead)
            v3 = b.vert(p1 - wv * 0.5, leaf=leaf, dead=dead)
            v4 = b.vert(p2, leaf=leaf, dead=dead)
            b.face((v0, v1, v2, v3), [(0.2, 0.1), (0.8, 0.1), (1.0, 0.5), (0.0, 0.5)], mat)
            b.face((v3, v2, v4), [(0.0, 0.5), (1.0, 0.5), (0.5, 1.0)], mat)


def date_palm(seed, height, skirt):
    """
    A date palm (Phoenix dactylifera) `height` metres to the tips of its youngest fronds:
    a slightly leaning trunk swollen at the foot and under the crown, fifty to sixty-five
    live fronds on a golden-angle spiral from upright to drooping, and `skirt` dead ones
    hanging against the trunk. Slots: 0 bark, 1 fronds. Proportions are a look choice.
    """
    from mathutils import Vector
    rnd = random.Random(seed)
    b = _Builder()
    crown = height - 1.5
    lean = Vector((rnd.gauss(0.0, 0.035), rnd.gauss(0.0, 0.035), 0.0))
    n = max(8, int(crown / 0.45))
    pts, radii = [], []
    for i in range(n + 1):
        t = i / n
        pts.append(Vector((0.0, 0.0, crown * t)) + lean * (crown * t * t))
        radii.append(0.2 + 0.11 * (1 - t) ** 4 + 0.07 * smoothstep(0.9, 1.0, t))
    _tube(b, pts, radii, 10, mat=0, v_scale=1.0 / (2 * math.pi * 0.22))
    top = pts[-1]
    live = rnd.randint(58, 72)
    for i in range(live):
        age = i / (live - 1)
        az = i * 2.39996 + rnd.gauss(0.0, 0.12)
        el = math.radians(80 - 110 * age ** 0.8) + rnd.gauss(0.0, 0.06)
        base = top + Vector((math.cos(az), math.sin(az), 0.0)) * (0.1 + 0.2 * age) - Vector((0.0, 0.0, 1.0 * age))
        length = rnd.uniform(3.1, 4.3) * (0.5 + 0.5 * min(1.0, (i + 1) / 7))
        droop = (0.2 + 0.8 * math.cos(el)) * rnd.uniform(0.6, 1.1)
        _frond(b, rnd, base, az, el, length, droop, math.radians(38 - 18 * age), leaf=rnd.random(), dead=0.0)
    for i in range(skirt):
        az = rnd.uniform(0.0, 2 * math.pi)
        base = top + Vector((math.cos(az), math.sin(az), 0.0)) * 0.25 - Vector((0.0, 0.0, 1.1 + 0.4 * rnd.random()))
        _frond(b, rnd, base, az, math.radians(rnd.uniform(-88, -62)), rnd.uniform(2.6, 3.6), 0.05, math.radians(-25),
               leaf=rnd.random(), dead=1.0)
    return b


def _fan(b, rnd, c, d, R, leaf, dead, spread=math.radians(230), folds=18, mat=1):
    """
    A doum palm's fan leaf at the end of its petiole: pleated, drooping at the rim, split
    into pointed segments over its outer third. `d` is the way the petiole runs on into it.
    """
    from mathutils import Matrix, Vector
    up = Vector((0.0, 0.0, 1.0))
    s = d.cross(up)
    s = s.normalized() if s.length > 1e-3 else Vector((1.0, 0.0, 0.0))
    s = Matrix.Rotation(rnd.gauss(0.0, 0.35), 3, d) @ s
    n = s.cross(d)
    radii = (0.12, 0.42, 0.7)
    rows, dirs = [], []
    for k in range(folds + 1):
        phi = -spread / 2 + spread * k / folds
        r_dir = d * math.cos(phi) + s * math.sin(phi)
        pleat = 0.05 * R * (1.0 if k % 2 == 0 else -1.0)
        rows.append([b.vert(c + r_dir * (R * f) + n * (pleat * f) - up * (0.28 * R * f * f), leaf=leaf, dead=dead) for f in radii])
        dirs.append(r_dir)
    centre = b.vert(c, leaf=leaf, dead=dead)
    for k in range(folds):
        a, e = rows[k], rows[k + 1]
        u0, u1 = k / folds, (k + 1) / folds
        b.face((centre, a[0], e[0]), [(0.5, 0.0), (u0, radii[0]), (u1, radii[0])], mat)
        for j in range(2):
            b.face((a[j], e[j], e[j + 1], a[j + 1]), [(u0, radii[j]), (u1, radii[j]), (u1, radii[j + 1]), (u0, radii[j + 1])], mat)
        if k % 2 == 0:
            tip_r = R * rnd.uniform(0.9, 1.1)
            md = (dirs[k] + dirs[k + 1]).normalized()
            tip = b.vert(c + md * tip_r - up * (0.28 * R) - up * 0.05 * R, leaf=leaf, dead=dead)
            b.face((a[2], e[2], tip), [(u0, radii[2]), (u1, radii[2]), ((u0 + u1) / 2, 1.0)], mat)


def _doum_crown(b, rnd, tip):
    from mathutils import Vector
    n = rnd.randint(16, 22)
    for k in range(n):
        f = (k + rnd.random()) / n
        el = math.radians(80 - 105 * f)
        az = k * 2.39996 + rnd.gauss(0.0, 0.2)
        d = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
        pl = rnd.uniform(0.8, 1.25)
        end = tip + d * pl - Vector((0.0, 0.0, 0.12 * pl * math.cos(el)))
        _blade_between(b, tip, end, 0.035, leaf=f, dead=0.0)
        _fan(b, rnd, end, (end - tip).normalized(), rnd.uniform(0.7, 1.0), leaf=rnd.random(), dead=0.0)
    for k in range(rnd.randint(3, 6)):
        az = rnd.uniform(0.0, 2 * math.pi)
        el = math.radians(rnd.uniform(-85, -55))
        d = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
        end = tip + d * rnd.uniform(0.6, 1.0)
        _blade_between(b, tip, end, 0.03, leaf=0.5, dead=1.0)
        _fan(b, rnd, end, d, rnd.uniform(0.5, 0.8), leaf=rnd.random(), dead=1.0, spread=math.radians(100), folds=8)


def _blade_between(b, p0, p1, width, mat=1, **attrs):
    """A flat strip from p0 to p1: a petiole."""
    from mathutils import Vector
    d = (p1 - p0)
    s = d.cross(Vector((0.0, 0.0, 1.0)))
    s = s.normalized() * (width / 2) if s.length > 1e-6 else Vector((width / 2, 0.0, 0.0))
    m = p0.lerp(p1, 0.5) + Vector((0.0, 0.0, 0.04 * d.length))
    r = [(b.vert(q - s, **attrs), b.vert(q + s, **attrs)) for q in (p0, m, p1)]
    for i in range(2):
        b.face((r[i][0], r[i][1], r[i + 1][1], r[i + 1][0]), [(0, i / 2), (0.05, i / 2), (0.05, (i + 1) / 2), (0, (i + 1) / 2)], mat)


def doum_palm(seed, height, forks):
    """
    A doum palm (Hyphaene thebaica) about `height` metres tall: a trunk that forks `forks`
    times into two, each last branch ending in a round crown of fan leaves with a few dead
    ones hanging under it. Slots: 0 bark, 1 leaves. The branching is a look choice.
    """
    from mathutils import Matrix, Vector
    rnd = random.Random(seed)
    b = _Builder()
    L0 = height * rnd.uniform(0.36, 0.46)
    Lc = (height - L0 - 1.6) / max(forks, 1)
    stack = [(Vector((0.0, 0.0, 0.0)), Vector((rnd.gauss(0.0, 0.04), rnd.gauss(0.0, 0.04), 1.0)).normalized(), L0, 0.2, 0)]
    crowns = []
    while stack:
        p, d, L, r, depth = stack.pop()
        end = p + d * L
        wob = d.orthogonal().normalized() * rnd.gauss(0.0, 0.04 * L)
        _tube(b, [p, p.lerp(end, 0.5) + wob, end], [r, r * 0.95, r * 0.88], 8, mat=0, v_scale=1.0)
        if depth < forks:
            axis = d.cross(Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), 0.0))).normalized()
            for sg in (-1.0, 1.0):
                nd = Matrix.Rotation(sg * math.radians(rnd.uniform(20, 32)), 3, axis) @ d
                nd = (nd + Vector((0.0, 0.0, 0.15))).normalized()
                stack.append((end, nd, Lc / max(nd.z, 0.3) * rnd.uniform(0.85, 1.1), r * 0.82, depth + 1))
        else:
            crowns.append(end)
    for tip in crowns:
        _doum_crown(b, rnd, tip)
    return b


def papyrus(seed, stems=22, height=3.0):
    """A clump of papyrus (Cyperus papyrus): triangular stems, each topped by a mop of fine rays. Slots: 0 stems, 1 rays."""
    from mathutils import Vector
    rnd = random.Random(seed)
    b = _Builder()
    for _ in range(stems):
        r, a = 0.3 * math.sqrt(rnd.random()), rnd.uniform(0.0, 2 * math.pi)
        base = Vector((r * math.cos(a), r * math.sin(a), 0.0))
        h = height * rnd.uniform(0.6, 1.0)
        lean = Vector((math.cos(a), math.sin(a), 0.0)) * rnd.uniform(0.03, 0.2)
        pts = [base + Vector((0.0, 0.0, h * t)) + lean * (h * t * t) for t in (0.0, 0.2, 0.4, 0.6, 0.8, 1.0)]
        _tube(b, pts, [0.016, 0.014, 0.012, 0.01, 0.008, 0.007], 3, mat=0, leaf=rnd.random())
        top = pts[-1]
        for _ in range(rnd.randint(90, 120)):
            el = math.radians(rnd.uniform(-25, 88))
            _blade(b, top, rnd.uniform(0.0, 2 * math.pi), rnd.uniform(0.28, 0.46) * (h / height) ** 0.5, 0.006,
                   0.5 * math.pi - el, 0.45, 0.0, 3, taper=0.6, mat=1, leaf=rnd.random())
    return b


def reed(seed, culms=36, height=2.5):
    """A clump of reeds (Phragmites): culms with arching leaves and a plume leaning with the wind. Slots: 0 culms, 1 leaves."""
    from mathutils import Vector
    rnd = random.Random(seed)
    b = _Builder()
    wind = rnd.uniform(0.0, 2 * math.pi)
    for _ in range(culms):
        r, a = 0.35 * math.sqrt(rnd.random()), rnd.uniform(0.0, 2 * math.pi)
        base = Vector((r * math.cos(a), r * math.sin(a), 0.0))
        h = height * rnd.uniform(0.65, 1.0)
        lean = Vector((math.cos(a), math.sin(a), 0.0)) * rnd.uniform(0.02, 0.12)
        pts = [base + Vector((0.0, 0.0, h * t)) + lean * (h * t * t) for t in (0.0, 0.2, 0.4, 0.6, 0.8, 1.0)]
        _tube(b, pts, [0.007, 0.0065, 0.006, 0.0055, 0.005, 0.004], 4, mat=0, leaf=rnd.random())
        yaw = rnd.uniform(0.0, 2 * math.pi)
        for k in range(rnd.randint(6, 9)):
            t = 0.12 + 0.7 * k / 8
            _blade(b, _along(pts, t), yaw + k * math.pi + rnd.gauss(0.0, 0.3), rnd.uniform(0.3, 0.45), 0.018,
                   rnd.uniform(0.6, 1.0), rnd.uniform(0.8, 1.3), 0.0, 4, taper=0.5, mat=1, leaf=rnd.random())
        for k in range(12):
            _blade(b, _along(pts, 0.9 + 0.1 * k / 11), wind + rnd.gauss(0.0, 0.5), rnd.uniform(0.12, 0.22), 0.006,
                   rnd.uniform(0.3, 0.8), 0.8, 0.0, 3, taper=0.5, mat=1, leaf=rnd.random(), dead=0.7)
    return b


def _leaf_quad(b, p, n, u, length, width, mat=1, **attrs):
    """A leaf as a flat diamond at p, facing n, pointing along u."""
    w = n.cross(u)
    if w.length < 1e-6:
        w = u.orthogonal()
    w = w.normalized() * (width / 2)
    q = [b.vert(p, **attrs), b.vert(p + u * (0.4 * length) + w, **attrs), b.vert(p + u * length, **attrs),
         b.vert(p + u * (0.4 * length) - w, **attrs)]
    b.face(q, [(0.5, 0.0), (1.0, 0.4), (0.5, 1.0), (0.0, 0.4)], mat)


def bush(seed, height, width, twigs=40, leaves=60):
    """
    A leafy bush `height` tall and `width` across: stems from a few crowns at the foot out to
    twig ends in the canopy's outer shell, each twig end carrying a cluster of small leaves.
    Slots: 0 stems, 1 leaves. A generic savanna shrub, not any one species.
    """
    from mathutils import Vector
    rnd = random.Random(seed)
    b = _Builder()
    rx, rz, cz = width / 2, height / 2, height * 0.52
    mains = [Vector((rnd.gauss(0.0, 0.05 * width), rnd.gauss(0.0, 0.05 * width), 0.0)) for _ in range(rnd.randint(4, 7))]
    size = (height * width) ** 0.5
    for _ in range(twigs):
        u = rnd.uniform(-0.3, 1.0)
        a = rnd.uniform(0.0, 2 * math.pi)
        rr = math.sqrt(max(0.0, 1.0 - u * u))
        f = rnd.uniform(0.6, 0.92)
        tip = Vector((rx * rr * math.cos(a) * f, rx * rr * math.sin(a) * f, max(cz + rz * u * f, 0.18 * height)))
        root = mains[rnd.randrange(len(mains))]
        mid = root.lerp(tip, 0.5) + Vector((rnd.gauss(0, 0.05), rnd.gauss(0, 0.05), 0.12 * height))
        _tube(b, [root, mid, tip], [0.011 * size, 0.007 * size, 0.003 * size], 3, mat=0, leaf=rnd.random())
        out = (tip - Vector((0.0, 0.0, cz * 0.6))).normalized()
        cluster = 0.21 * size
        for _ in range(leaves):
            off = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1)))
            p = tip + off.normalized() * cluster * rnd.random() ** 0.5
            n = (out + Vector((0.0, 0.0, 0.6)) + Vector((rnd.gauss(0, 0.6), rnd.gauss(0, 0.6), rnd.gauss(0, 0.6)))).normalized()
            uu = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1)))
            uu = (uu - n * uu.dot(n))
            if uu.length < 1e-6:
                continue
            L = rnd.uniform(0.06, 0.1) * size ** 0.3
            _leaf_quad(b, p, n, uu.normalized(), L, L * 0.45, leaf=rnd.random())
    return b


# --- Materials -------------------------------------------------------------------------

def _gattr(t, name):
    """A per-vertex attribute of the variant being shaded."""
    return t.node("ShaderNodeAttribute", attribute_type="GEOMETRY", attribute_name=name).outputs["Fac"]


def _uv(t):
    uv = t.node("ShaderNodeUVMap")
    uv.uv_map = "UVMap"
    sep = t.node("ShaderNodeSeparateXYZ")
    t.link(uv.outputs["UV"], sep.inputs[0])
    return sep.outputs["X"], sep.outputs["Y"]


def _vary(t, col, tone, hue=0.035, sat=0.15, val=0.22):
    """Colour variety between instances: hue, saturation and value each off a different digit of the tone."""
    hsv = t.node("ShaderNodeHueSaturation")
    t.link(t.math("ADD", t.math("MULTIPLY", tone, 2 * hue), 0.5 - hue), hsv.inputs["Hue"])
    t.link(t.math("ADD", t.math("MULTIPLY", t.math("FRACT", t.math("MULTIPLY", tone, 7.31)), 2 * sat), 1 - sat), hsv.inputs["Saturation"])
    t.link(t.math("ADD", t.math("MULTIPLY", t.math("FRACT", t.math("MULTIPLY", tone, 13.7)), 2 * val), 1 - val), hsv.inputs["Value"])
    t.link(col, hsv.inputs["Color"])
    return hsv.outputs["Color"]


def _leaf_shader(t, col, rough=0.5, spec=0.3, translucent=0.3, normal=None):
    """Principled for the light off a leaf, mixed with a translucent BSDF for the light through it."""
    from .nodes import hexlin
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = spec
    if normal is not None:
        t.link(normal, bsdf.inputs["Normal"])
    if translucent <= 0:
        t.link(bsdf.outputs[0], out.inputs["Surface"])
        return
    tr = t.node("ShaderNodeBsdfTranslucent")
    t.link(t.mix(0.35, col, hexlin("a8c04a")), tr.inputs["Color"])
    mix = t.node("ShaderNodeMixShader")
    mix.inputs["Fac"].default_value = translucent
    t.link(bsdf.outputs[0], mix.inputs[1])
    t.link(tr.outputs[0], mix.inputs[2])
    t.link(mix.outputs[0], out.inputs["Surface"])


def _grass_material():
    """Blades green to straw: `wear` (per tuft) and each blade's own draw decide how dry; roots dark, tips pale."""
    from .nodes import Tree, hexlin
    mat = bpy.data.materials.new("veg grass")
    t = Tree(mat)
    tone, wear = t.attr("tone"), t.attr("wear")
    blade, dead, stalk = _gattr(t, "blade"), _gattr(t, "dead"), _gattr(t, "stalk")
    _, v = _uv(t)
    green = t.ramp(tone, [(0.0, hexlin("4c6829")), (0.5, hexlin("627b33")), (1.0, hexlin("78893d"))])
    straw = t.ramp(blade, [(0.0, hexlin("a08d5c")), (0.5, hexlin("bba877")), (1.0, hexlin("8c7a50"))])
    dry = t.math("ADD", t.math("ADD", wear, t.math("MULTIPLY", t.math("SUBTRACT", blade, 0.5), 0.5)),
                 t.math("ADD", dead, t.math("MULTIPLY", stalk, 0.6)), clamp=True)
    col = t.mix(dry, green, straw)
    col = t.mix(1.0, col, t.grey(t.math("ADD", t.math("MULTIPLY", v, 0.5), 0.5)), "MULTIPLY")
    col = t.mix(t.math("MULTIPLY", t.math("MULTIPLY", v, v), 0.3), col, hexlin("d8d0a2"))
    _leaf_shader(t, col, rough=0.55, spec=0.25, translucent=0.3)
    return mat


def _foliage_material(name, live, dead, rough=0.5, translucent=0.25, tips=None, spec=0.3):
    """Leaves off the per-leaf draw (`leaf`), dead ones straw, yellowing with `wear`, varied by `tone`."""
    from .nodes import Tree, hexlin
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    tone, wear = t.attr("tone"), t.attr("wear")
    leaf, isdead = _gattr(t, "leaf"), _gattr(t, "dead")
    n = len(live)
    col = t.ramp(leaf, [(k / max(n - 1, 1), hexlin(c)) for k, c in enumerate(live)])
    dcol = t.ramp(leaf, [(k / max(len(dead) - 1, 1), hexlin(c)) for k, c in enumerate(dead)])
    col = t.mix(t.math("ADD", isdead, t.math("MULTIPLY", wear, 0.45), clamp=True), col, dcol)
    if tips:
        _, v = _uv(t)
        col = t.mix(t.math("MULTIPLY", t.math("MULTIPLY", v, v), 0.45), col, hexlin(tips))
    _leaf_shader(t, _vary(t, col, tone), rough=rough, spec=spec, translucent=translucent)
    return mat


def _plain_material(name, colours, rough=0.85):
    from .nodes import Tree, hexlin
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    col = t.ramp(t.attr("tone"), [(k / max(len(colours) - 1, 1), hexlin(c)) for k, c in enumerate(colours)])
    _leaf_shader(t, col, rough=rough, spec=0.2, translucent=0.0)
    return mat


def _doum_bark():
    """Grey-brown with the rings the fallen leaves leave, every 12 cm or so; procedural."""
    from .nodes import Tree, hexlin
    mat = bpy.data.materials.new("veg doum bark")
    t = Tree(mat)
    geo = t.node("ShaderNodeNewGeometry")
    _, v = _uv(t)
    rings = t.math("POWER", t.math("ABSOLUTE", t.math("SINE", t.math("MULTIPLY", v, 2 * math.pi * 8.0))), 6.0)
    col = t.ramp(t.noise(geo.outputs["Position"], 3.0, 4.0), [(0.3, hexlin("5d5042")), (0.7, hexlin("786756"))])
    col = t.mix(t.math("MULTIPLY", rings, 0.45), col, hexlin("3b3129"))
    col = _vary(t, col, t.attr("tone"), hue=0.01, sat=0.1, val=0.15)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    t.link(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.9
    bmp = t.node("ShaderNodeBump")
    bmp.inputs["Strength"].default_value = 0.4
    bmp.inputs["Distance"].default_value = 0.01
    t.link(t.math("SUBTRACT", 1.0, rings), bmp.inputs["Height"])
    t.link(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    return mat


def _textured_material(name, diffuse, normal=None, rough=0.8, translucent=0.0, mapping=None, dry="a39c5c", normal_strength=1.0, tint=None):
    """A photographed texture by UV, varied by `tone` and yellowed by `wear`."""
    from .nodes import Tree, hexlin
    mat = bpy.data.materials.new(name)
    t = Tree(mat)
    uv = t.node("ShaderNodeUVMap")
    uv.uv_map = "UVMap"
    vec = uv.outputs["UV"]
    if mapping is not None:
        mp = t.node("ShaderNodeMapping")
        mp.inputs["Location"].default_value, mp.inputs["Rotation"].default_value, mp.inputs["Scale"].default_value = mapping
        t.link(vec, mp.inputs["Vector"])
        vec = mp.outputs[0]
    im = t.node("ShaderNodeTexImage", image=diffuse)
    t.link(vec, im.inputs["Vector"])
    col = t.mix(t.math("MULTIPLY", t.attr("wear"), 0.5), im.outputs["Color"], hexlin(dry), "MULTIPLY") if translucent > 0 \
        else im.outputs["Color"]
    if tint:
        col = t.mix(1.0, col, hexlin(tint), "MULTIPLY")
    col = _vary(t, col, t.attr("tone"))
    nrm = None
    if normal is not None:
        ni = t.node("ShaderNodeTexImage", image=normal)
        t.link(vec, ni.inputs["Vector"])
        nm = t.node("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = normal_strength
        t.link(ni.outputs["Color"], nm.inputs["Color"])
        nrm = nm.outputs["Normal"]
    _leaf_shader(t, col, rough=rough, spec=0.3, translucent=translucent, normal=nrm)
    return mat


def _image(path, size=None, noncolor=False):
    """A texture from disk, halved to `size` when bigger, packed into the library."""
    img = bpy.data.images.load(path, check_existing=True)
    if noncolor:
        img.colorspace_settings.name = "Non-Color"
    if size and max(img.size) > size:
        img.scale(size, size)
    img.pack()
    return img


def _materials():
    """The library's materials. Every colour here is a look choice."""
    return {
        "grass": _grass_material(),
        "palm frond": _foliage_material("veg palm frond", ("56693f", "6a7c4a", "7b8a56"), ("8f7852", "a8916a"), rough=0.42, translucent=0.22, spec=0.4),
        "doum frond": _foliage_material("veg doum frond", ("6a7f45", "7b8f4d", "8b9c57"), ("99825a", "b09a70"), rough=0.62, translucent=0.25, spec=0.2),
        "papyrus stem": _foliage_material("veg papyrus stem", ("5b7630", "6a8636"), ("8a7c52", "a0906a"), rough=0.45, translucent=0.15),
        "papyrus": _foliage_material("veg papyrus", ("5e7a30", "718f38", "88a444"), ("9a8a5a", "b0a070"), rough=0.5, translucent=0.3, tips="a4b857"),
        "reed stem": _foliage_material("veg reed stem", ("7f8450", "93935c"), ("a08c64", "b5a078"), rough=0.5, translucent=0.1),
        "reed": _foliage_material("veg reed", ("6a7c42", "7d8c4c", "8e9a58"), ("7d6652", "967c60"), rough=0.55, translucent=0.3),
        "bush leaf": _foliage_material("veg bush leaf", ("42532a", "566832", "6a7a3a"), ("8a8450", "9c9058"), rough=0.5, translucent=0.25),
        "twig": _plain_material("veg twig", ("4f4236", "625244", "574a3e")),
        "doum bark": _doum_bark(),
    }


# --- Downloaded models -------------------------------------------------------------------

def _import(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def _submesh(me, index):
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != index], context="FACES")
    for f in bm.faces:
        f.material_index = 0
    out = bpy.data.meshes.new(f"{me.name} part {index}")
    bm.to_mesh(out)
    bm.free()
    return out


def _decimate(me, ratio):
    if ratio >= 0.999:
        return me
    ob = bpy.data.objects.new("decimating", me)
    bpy.context.scene.collection.objects.link(ob)
    mod = ob.modifiers.new("decimate", "DECIMATE")
    mod.ratio = ratio
    out = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob)
    return out


def _join(parts, name, materials):
    """
    One mesh of the parts, part k on material slot k. The slots are set after the join and
    after the materials are appended: each append resets them, and so does clearing slots.
    """
    import bmesh
    bm = bmesh.new()
    for me in parts:
        bm.from_mesh(me)
    out = bpy.data.meshes.new(name)
    bm.to_mesh(out)
    bm.free()
    for m in materials:
        out.materials.append(m)
    out.polygons.foreach_set("material_index", np.repeat(np.arange(len(parts), dtype=np.int32), [len(me.polygons) for me in parts]))
    out.update()
    return out


def _first_last(values, groups):
    """For each group (0..k-1), the index of its smallest and of its largest value."""
    order = np.lexsort((values, groups))
    g = groups[order]
    first = np.r_[0, np.nonzero(np.diff(g))[0] + 1]
    last = np.r_[first[1:] - 1, len(order) - 1]
    return order[first], order[last]


def _leaf_hexagons(me, slot, name):
    """
    Each leaf of one material slot as a hexagon through six of its own vertices: its foot and
    tip in the texture, and its widest points below and above the middle. The hexagon lies
    inside the leaf's outline in the model and in the texture alike, so it never shows the
    black round the leaves in the atlas and needs no alpha: 4 triangles a leaf, not 24. The
    atlas's leaves stand upright (tip at the top of each), which is what makes foot and tip
    the least and greatest v.
    """
    n = len(me.polygons)
    mi, ls, lt = (np.empty(n, np.int32) for _ in range(3))
    me.polygons.foreach_get("material_index", mi)
    me.polygons.foreach_get("loop_start", ls)
    me.polygons.foreach_get("loop_total", lt)
    lv = np.empty(len(me.loops), np.int32)
    me.loops.foreach_get("vertex_index", lv)
    uv = np.empty(len(me.loops) * 2, np.float32)
    me.uv_layers[0].data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    sel = np.nonzero((mi == slot) & (lt == 3))[0]
    loops = ls[sel][:, None] + np.arange(3)[None, :]
    tri = lv[loops]
    vuv = np.zeros((len(co), 2), np.float32)
    vuv[tri.ravel()] = uv[loops.ravel()]
    lab = np.arange(len(co))
    for _ in range(100):
        m = np.minimum(np.minimum(lab[tri[:, 0]], lab[tri[:, 1]]), lab[tri[:, 2]])
        new = lab.copy()
        for k in range(3):
            np.minimum.at(new, tri[:, k], m)
        new = new[new]
        if np.array_equal(new, lab):
            break
        lab = new
    verts = np.unique(tri)
    _, isl = np.unique(lab[verts], return_inverse=True)
    u, v = vuv[verts, 0], vuv[verts, 1]
    foot, tip = _first_last(v, isl)
    vmin, vmax = v[foot], v[tip]
    below = v < (0.5 * (vmin + vmax))[isl]
    big = 1e9
    ll, _ = _first_last(np.where(below, u, big), isl)
    _, rl = _first_last(np.where(below, u, -big), isl)
    lu, _ = _first_last(np.where(~below, u, big), isl)
    _, ru = _first_last(np.where(~below, u, -big), isl)
    ring = np.stack([foot, rl, ru, tip, lu, ll], 1)
    idx = verts[ring]
    k = len(idx)
    out = bpy.data.meshes.new(name)
    out.vertices.add(k * 6)
    out.vertices.foreach_set("co", co[idx.ravel()].ravel())
    out.loops.add(k * 6)
    out.loops.foreach_set("vertex_index", np.arange(k * 6, dtype=np.int32))
    out.polygons.add(k)
    out.polygons.foreach_set("loop_start", np.arange(0, k * 6, 6, dtype=np.int32))
    out.polygons.foreach_set("loop_total", np.full(k, 6, np.int32))
    out.update(calc_edges=True)
    layer = out.uv_layers.new(name="UVMap")
    layer.data.foreach_set("uv", vuv[idx.ravel()].ravel())
    out.update()
    return out


def _grounded(me):
    """Stand a mesh on z = 0 with its foot's centre over the origin."""
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    z0 = co[:, 2].min()
    foot = co[co[:, 2] < z0 + 0.03 * (co[:, 2].max() - z0)]
    co -= np.array([foot[:, 0].mean(), foot[:, 1].mean(), z0], np.float32)
    me.vertices.foreach_set("co", co.ravel())
    me.update()
    return me


def _flatten(me, name, crown_from, squash, widen):
    """An umbrella of a crown: squashed from `crown_from` up and widened by `widen`; the trunk below is kept."""
    out = me.copy()
    out.name = name
    co = np.empty(len(out.vertices) * 3, np.float32)
    out.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    z = co[:, 2].copy()
    w = smoothstep(crown_from, crown_from + 1.0, z)
    co[:, 2] = np.where(z > crown_from, crown_from + (z - crown_from) * squash, z)
    co[:, 0] *= 1.0 + widen * w
    co[:, 1] *= 1.0 + widen * w
    out.vertices.foreach_set("co", co.ravel())
    out.update()
    return out


# LOOK CHOICES: what share of the island tree's triangles the trunk and the branches keep (the leaves
# become hexagons, _leaf_hexagons), and the acacia's crown.
ISLAND_KEEP = (0.5, None, 0.18)
ACACIA_CROWN = dict(crown_from=2.1, squash=0.55, widen=0.32)


def _island_trees(log=print):
    """Poly Haven's island_tree_01, decimated, as the valley's tree and, crown flattened, the savanna's acacia."""
    from mathutils import Matrix
    tex = os.path.join(PROPS, "island-tree", "textures")
    obs = _import(os.path.join(PROPS, "island-tree", "model.gltf"))
    ob = next(o for o in obs if o.type == "MESH")
    me = ob.data
    me.transform(ob.matrix_world)
    ob.matrix_world = Matrix.Identity(4)
    mapping = None
    for m in me.materials:
        for nd in (m.node_tree.nodes if m and m.node_tree else ()):
            if nd.type == "MAPPING" and "branches" in m.name:
                mapping = tuple(tuple(nd.inputs[k].default_value) for k in ("Location", "Rotation", "Scale"))
    mats = [
        _textured_material("veg tree bark", _image(os.path.join(tex, "island_tree_01_diff_2k.jpg"), 1024),
                           _image(os.path.join(tex, "island_tree_01_nor_gl_2k.jpg"), 1024, True), rough=0.85),
        _textured_material("veg tree leaf", _image(os.path.join(tex, "island_tree_01_leaves_diff_2k.jpg"), 1024), rough=0.55,
                           translucent=0.3),
        _textured_material("veg tree twig", _image(os.path.join(tex, "island_tree_01_branches_diff_2k.jpg"), 1024), rough=0.85,
                           mapping=mapping),
    ]
    t = time.time()
    parts = [_decimate(_submesh(me, 0), ISLAND_KEEP[0]), _leaf_hexagons(me, 1, "island tree leaves"),
             _decimate(_submesh(me, 2), ISLAND_KEEP[2])]
    tree = _grounded(_join(parts, "island tree", mats))
    tree.shade_smooth()
    log(f"island tree reduced in {time.time() - t:.0f}s")
    acacia = _flatten(tree, "acacia", **ACACIA_CROWN)
    acacia2 = _flatten(tree, "acacia wide", ACACIA_CROWN["crown_from"] - 0.3, ACACIA_CROWN["squash"] * 0.85, ACACIA_CROWN["widen"] * 1.4)
    for o in obs:
        bpy.data.objects.remove(o)
    return tree, [acacia, acacia2]


def _shrubs():
    """Poly Haven's shrub_02, its four bushes, each stood on its own foot."""
    tex = os.path.join(PROPS, "shrub", "textures")
    obs = _import(os.path.join(PROPS, "shrub", "model.gltf"))
    mat = _textured_material("veg shrub", _image(os.path.join(tex, "shrub_02_diff_2k.jpg"), 1024),
                             _image(os.path.join(tex, "shrub_02_nor_gl_2k.jpg"), 1024, True), rough=0.6, translucent=0.25)
    out = []
    for o in sorted((o for o in obs if o.type == "MESH"), key=lambda o: o.name):
        me = _grounded(o.data.copy())
        me.materials.clear()
        me.materials.append(mat)
        out.append(me)
    for o in obs:
        bpy.data.objects.remove(o)
    return out


def _palm_bark():
    """The Sketchfab date palm's bark and normal map, on the generated trunk."""
    obs = _import(os.path.join(PROPS, "date-palm", "model.glb"))
    diff = norm = None
    for o in obs:
        for m in (o.data.materials if o.type == "MESH" else ()):
            if m and m.name.startswith("Tree_0Mat"):
                for nd in m.node_tree.nodes:
                    if nd.type != "TEX_IMAGE" or nd.image is None:
                        continue
                    if any(l.to_socket.name == "Base Color" for l in nd.outputs["Color"].links):
                        diff = nd.image
                    if any(l.to_node.type == "NORMAL_MAP" for l in nd.outputs["Color"].links):
                        norm = nd.image
    for o in obs:
        bpy.data.objects.remove(o)
    for img in (diff, norm):
        if img is not None and img.packed_file is None:
            img.pack()
    if diff is None:
        return _plain_material("veg palm bark", ("8a7658", "9c8666", "7a6850"))
    return _textured_material("veg palm bark", diff, norm, rough=0.9, normal_strength=0.8, tint="a39684")


def _tris(me):
    return int(sum(len(p.vertices) - 2 for p in me.polygons))


def prepare(log=print):
    """
    Build the plant library into build/vegetation/plants.blend: the generated grasses, palms,
    bushes, papyrus and reeds, the Poly Haven tree (as acacia and as tree) and shrubs, each
    kind a collection "veg <kind>" of variants "veg <kind> NN" parked below the world, each
    variant carrying its native height (custom property "height"). Writes the measured heights
    and triangle counts into render/vegetation.json and build/vegetation/index.json.
    """
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    os.makedirs(os.path.dirname(LIBRARY), exist_ok=True)
    M = _materials()
    M["palm bark"] = _palm_bark()
    sets = {}
    g = [grass_tuft(10 + i, 34, 0.3 + 0.02 * i, 0.06, 0.35, 0.5, dead=0.08) for i in range(4)]
    g += [grass_tuft(20 + i, 50, 0.52 + 0.03 * i, 0.08, 0.3, 0.7, dead=0.1) for i in range(4)]
    g += [grass_tuft(30 + i, 40, 0.68 + 0.06 * i, 0.08, 0.3, 0.8, stalks=7, dead=0.15) for i in range(2)]
    sets["grass"] = [x.mesh(f"grass {i}", [M["grass"]]) for i, x in enumerate(g)]
    sets["tussock"] = [grass_tuft(40 + i, 120 + 10 * i, 0.62 + 0.08 * i, 0.15 + 0.02 * i, 0.45, 1.0, stalks=4, dead=0.2)
                       .mesh(f"tussock {i}", [M["grass"]]) for i in range(4)]
    sets["date-palm"] = [date_palm(50 + i, h, sk).mesh(f"date palm {h:.0f} m", [M["palm bark"], M["palm frond"]])
                         for i, (h, sk) in enumerate(((10.0, 6), (13.0, 0), (16.0, 10), (19.0, 3)))]
    sets["doum-palm"] = [doum_palm(60 + i, h, f).mesh(f"doum palm {h:.0f} m", [M["doum bark"], M["doum frond"]])
                         for i, (h, f) in enumerate(((9.0, 1), (11.5, 2), (13.5, 2)))]
    sets["papyrus"] = [papyrus(70 + i, 18 + 4 * i, 3.0).mesh(f"papyrus {i}", [M["papyrus stem"], M["papyrus"]]) for i in range(3)]
    sets["reed"] = [reed(80 + i, 30 + 6 * i, 2.5).mesh(f"reed {i}", [M["reed stem"], M["reed"]]) for i in range(3)]
    sets["bush"] = [bush(90 + i, h, w).mesh(f"bush {i}", [M["twig"], M["bush leaf"]])
                    for i, (h, w) in enumerate(((1.3, 1.6), (1.0, 2.2), (1.9, 1.5)))]
    log(f"generated plants in {time.time() - t0:.0f}s")
    tree, acacias = _island_trees(log)
    sets["tree"] = [tree]
    sets["acacia"] = acacias
    sets["shrub"] = _shrubs()
    colls, info = set(), {}
    for kind, meshes in sets.items():
        c = bpy.data.collections.new(f"veg {kind}")
        info[kind] = []
        for i, me in enumerate(meshes):
            ob = bpy.data.objects.new(f"veg {kind} {i:02d}", me)
            ob.location = PARKED
            h = round(float(max(v.co.z for v in me.vertices)), 2)
            ob["height"] = h
            c.objects.link(ob)
            info[kind].append({"height_m": h, "triangles": _tris(me)})
        colls.add(c)
    bpy.data.libraries.write(LIBRARY, colls, fake_user=True, compress=True)
    _write_manifest(info, time.time() - t0)
    log(f"wrote {LIBRARY} ({os.path.getsize(LIBRARY) / 1e6:.1f} MB) in {time.time() - t0:.0f}s")
    return info


def _write_manifest(info, seconds):
    """The measured heights and triangles into render/vegetation.json (its prose kept) and build/vegetation/index.json."""
    if os.path.exists(MANIFEST):
        with open(MANIFEST, encoding="utf-8") as f:
            manifest = json.load(f)
        for a in manifest["assets"]:
            got = info.get(a["id"])
            if got:
                a["variants"] = got
        manifest.setdefault("library", {})["prepared_in_s"] = round(seconds)
        with open(MANIFEST, "w", encoding="utf-8", newline="\n") as f:
            f.write(_dumps(manifest) + "\n")
    os.makedirs(os.path.dirname(INDEX), exist_ok=True)
    with open(INDEX, "w", encoding="utf-8", newline="\n") as f:
        json.dump({"library": LIBRARY, "kinds": info}, f, indent=1)


def _dumps(value, indent=0):
    """json.dumps with short leaf objects kept on one line, as scripts/props.py writes its manifest."""
    pad, inner = "  " * indent, "  " * (indent + 1)
    if isinstance(value, dict):
        if value and all(not isinstance(v, (dict, list)) for v in value.values()) and len(json.dumps(value)) < 90:
            return json.dumps(value, ensure_ascii=False)
        if not value:
            return "{}"
        body = ",\n".join(f"{inner}{json.dumps(k, ensure_ascii=False)}: {_dumps(v, indent + 1)}" for k, v in value.items())
        return f"{{\n{body}\n{pad}}}"
    if isinstance(value, list):
        if all(not isinstance(v, (dict, list)) for v in value):
            return json.dumps(value, ensure_ascii=False)
        body = ",\n".join(f"{inner}{_dumps(v, indent + 1)}" for v in value)
        return f"[\n{body}\n{pad}]"
    return json.dumps(value, ensure_ascii=False)


# ---------------------------------------------------------------------------------------
# Script entry: prepare the library, draw a contact sheet of it, render a test view, count.
# ---------------------------------------------------------------------------------------

# Test views (look choices, not stations): the savanna north-west of Khafre looking down into
# the low ground; the same meadow from knee height; a palm grove in the valley east of the
# temples as built; the lion's drier plateau.
VIEWS = {
    "savanna": dict(state="first-time", camera=(-700.0, 285.0, 1.7), target=(-640.0, 760.0, 2.0), lens=30.0,
                    box=(-1150.0, -250.0, 150.0, 1100.0), ground=(-900.0, -500.0, 200.0, 600.0), moment="golden-west"),
    "meadow": dict(state="first-time", camera=(-655.0, 260.0, 0.85), target=(-600.0, 330.0, 0.2), lens=28.0,
                   box=(-1000.0, -300.0, 150.0, 800.0), ground=(-820.0, -480.0, 200.0, 540.0), moment="golden-west"),
    "grove": dict(state="built", camera=(560.0, -250.0, 1.7), target=(900.0, -330.0, 4.0), lens=35.0,
                  box=(430.0, 1500.0, -800.0, 250.0), ground=(480.0, 900.0, -500.0, -80.0), moment="golden-west"),
    "lion": dict(state="lion", camera=(-700.0, 285.0, 1.7), target=(-640.0, 760.0, 2.0), lens=30.0,
                 box=(-1150.0, -250.0, 150.0, 1100.0), ground=(-900.0, -500.0, 200.0, 600.0), moment="golden-west"),
}


def _opts(argv):
    o, it = {}, iter(argv)
    for k in it:
        o[k.lstrip("-")] = next(it, "1")
    return o


def _reset():
    from . import instancing, materials
    bpy.ops.wm.read_factory_settings(use_empty=True)
    materials._IMAGES.clear()
    instancing._GROUP = None
    _CACHE.clear()


SHEETS = {
    "palms": ["date-palm", "doum-palm"],
    "trees": ["tree", "acacia"],
    "shrubs": ["shrub", "bush"],
    "water": ["papyrus", "reed"],
    "grass": ["tussock", "grass"],
}


def _sheet(opts):
    """The variants of a group of kinds side by side (SHEETS), in the scene's own light, for looking at the library."""
    from mathutils import Vector
    from . import materials, renderer
    from .nodes import Tree, hexlin
    from .sky import Sky
    group = opts.get("group", "palms")
    _reset()
    scene = bpy.context.scene
    lib = library(None)
    x, top = 0.0, 0.0
    for kind in SHEETS[group]:
        c, hs = lib[kind]
        for i, (o, h) in enumerate(zip(sorted(c.objects, key=lambda o: o.name), hs)):
            inst = bpy.data.objects.new(f"show {o.name}", o.data)
            scene.collection.objects.link(inst)
            w = max(h * 0.42, 0.35)
            inst.location = (x + w, 0.0, 0.0)
            inst.rotation_euler = (0.0, 0.0, 0.7 * i)
            x += 2 * w + 0.2 * h
            top = max(top, h)
        x += 0.1 * top
    me = bpy.data.meshes.new("floor")
    s = 40 * max(x, top)
    me.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
    mat = bpy.data.materials.new("floor")
    t = Tree(mat)
    out = t.node("ShaderNodeOutputMaterial")
    bsdf = t.node("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = hexlin("a38c6c")
    bsdf.inputs["Roughness"].default_value = 0.95
    t.link(bsdf.outputs[0], out.inputs["Surface"])
    me.materials.append(mat)
    scene.collection.objects.link(bpy.data.objects.new("floor", me))
    sky = Sky(scene, haze=0.0)
    sky.set_sun(float(opts.get("sun", 30.0)), 235.0)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.lens = 50.0
    cam.data.clip_end = 1e5
    aim = Vector((x / 2, 0.0, top * 0.45))
    d = max(x * 1.45, top * 2.4)
    cam.location = aim + Vector((0.0, -d, top * 0.12))
    cam.rotation_euler = (aim - cam.location).to_track_quat("-Z", "Y").to_euler()
    renderer.gpu(scene)
    renderer.configure(scene)
    out = os.path.abspath(opts.get("out", os.path.join(data.REPO, "build", "vegetation", f"sheet-{group}.png")))
    renderer.render(scene, out, int(opts.get("w", 1600)), int(opts.get("h", 700)), int(opts.get("samples", 32)))
    print("sheet", out)


def _ground_mesh(terrain, box, step, coll, material, hole=None):
    from .terrain import grid_object
    xs = np.arange(box[0], box[1] + 0.01, step, dtype=np.float32)
    ys = np.arange(box[2], box[3] + 0.01, step, dtype=np.float32)
    ob = grid_object("test ground", xs, ys, lambda X, Y: terrain.z(X, Y), coll, hole=hole)
    ob.data.materials.append(material)
    return ob


def _test(opts):
    """A small standalone scene: a few hundred metres of ground, the era's plants, a sun and sky."""
    from . import cameras, materials, renderer, sun, water
    from .sky import Sky
    from .terrain import Terrain
    t0 = time.time()
    log = lambda *a: print(f"[{time.time() - t0:6.1f}s]", *a, flush=True)
    name = opts.get("view", "savanna")
    V = VIEWS[name]
    state = opts.get("state", V["state"])
    _reset()
    scene = bpy.context.scene
    world = bpy.data.collections.new("world")
    scene.collection.children.link(world)
    per_view = bpy.data.collections.new("this view")
    scene.collection.children.link(per_view)
    S = states.spec(state)
    squares = [(P["cx"], P["cy"], P["half"], P["base"]) for P in data.PYRAMIDS.values()]
    if S["queens"]:
        squares += [(q["cx"], q["cy"], q["half"], q["base"]) for q in data.QUEENS]
    terrain = Terrain(state, squares)
    ground = materials.ground(state)
    ground_d = materials.ground(state, displace=True)
    tint_ground(ground, state)
    tint_ground(ground_d, state)
    gb = V["ground"]
    nb, step = _near_box()
    snap = lambda v, o: o + round((v - o) / step) * step
    gbox = (snap(gb[0], nb[0]), snap(gb[1], nb[0]), snap(gb[2], nb[2]), snap(gb[3], nb[2]))
    _ground_mesh(terrain, gbox, step, world, ground)
    outer = (gbox[0] - 2400, gbox[1] + 2400, gbox[2] - 2400, gbox[3] + 2400)
    _ground_mesh(terrain, outer, 16.0, world, ground, hole=(gbox[0] + 8, gbox[1] - 8, gbox[2] + 8, gbox[3] - 8)).location.z = -0.05
    water.build(state, world, {"water": materials.water()}, log)
    cx, cy, eye = V["camera"]
    terrain.patch((cx, cy), per_view, ground_d)
    log("ground")
    build(state, terrain, world, log=log, box=V["box"])
    near_camera(state, terrain, per_view, (cx, cy), log)
    sky = Sky(scene, coll=world)
    stations, _ = data.views()
    alt, az, _ = sun.parse_moment(stations["moments"][V["moment"]], S["year"])
    sky.set_sun(alt, az)
    cam = cameras.make(scene)
    cz = float(terrain.z(np.float32([cx]), np.float32([cy]))[0]) + eye
    tx, ty, tz = V["target"]
    tz = float(terrain.z(np.float32([tx]), np.float32([ty]))[0]) + tz
    cameras.frame(cam, (cx, cy, cz), (tx, ty, tz), V["lens"])
    renderer.gpu(scene, log)
    renderer.configure(scene)
    log("built")
    w, h = (int(v) for v in opts.get("size", "960x540").split("x"))
    out = os.path.abspath(opts.get("out", os.path.join(data.REPO, "build", "vegetation", f"test-{name}-{state}.png")))
    t = time.time()
    renderer.render(scene, out, w, h, int(opts.get("samples", 32)))
    log(f"rendered {out} in {time.time() - t:.0f}s")


def _count(opts):
    """The whole era's planting without the rest of the plateau: counts and times, and optionally a tiny render."""
    from . import cameras, renderer
    from .sky import Sky
    from .terrain import Terrain
    t0 = time.time()
    log = lambda *a: print(f"[{time.time() - t0:6.1f}s]", *a, flush=True)
    state = opts.get("state", "first-time")
    _reset()
    scene = bpy.context.scene
    world = bpy.data.collections.new("world")
    scene.collection.children.link(world)
    S = states.spec(state)
    squares = [(P["cx"], P["cy"], P["half"], P["base"]) for P in data.PYRAMIDS.values()]
    if S["queens"]:
        squares += [(q["cx"], q["cy"], q["half"], q["base"]) for q in data.QUEENS]
    terrain = Terrain(state, squares)
    build(state, terrain, world, log=log)
    near_camera(state, terrain, world, (-30.0, -360.0), log)
    log("planted")
    if opts.get("render"):
        sky = Sky(scene, coll=world)
        sky.set_sun(20.0, 250.0)
        cam = cameras.make(scene)
        cameras.station(cam, (-30.0, -360.0, 20.0))
        renderer.gpu(scene, log)
        renderer.configure(scene)
        t = time.time()
        renderer.render(scene, os.path.join(data.REPO, "build", "vegetation", f"count-{state}.png"), 512, 256, 4)
        log(f"tiny render in {time.time() - t:.0f}s")


def _main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    cmd = argv[0] if argv else "prepare"
    opts = _opts(argv[1:])
    if cmd == "prepare":
        prepare()
    elif cmd == "sheet":
        _sheet(opts)
    elif cmd == "test":
        _test(opts)
    elif cmd == "count":
        _count(opts)
    else:
        raise SystemExit(f"unknown command {cmd!r}: prepare, sheet, test or count")


if __name__ == "__main__":
    _main()
