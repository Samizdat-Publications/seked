"""
The modern city behind the plateau for the present day: Google Open Buildings
outlines reduced to boxes, with the 2.5D Temporal heights (data/footprints/city.json).
Context, never evidence; nothing within about three half-bases of a pyramid is drawn.

On the plateau itself (west of its eastern edge, PLATEAU) a box whose height the raster could not
measure is not drawn at all rather than at the import's look-choice height: there the detections
are mostly tombs, excavation sheds and rock, and at 8 m they stood in the cemeteries as pale
placeholder blocks. Nor is any box drawn that sits on a monument's own footprint
(data/footprints/giza.json), which the scene already builds. Measured buildings on the plateau,
such as the visitor centre at its western entrance, are kept. 590 of 231,988 boxes are left out.
"""
import numpy as np

from . import data
from .instancing import field


# Look choice: the village at the plateau's east foot before the city reached it
# (Nazlet el-Samman and Kafr el-Gebel), drawn as a thinned, lowered subset of today's buildings there.
VILLAGE_BOX = (420.0, 1600.0, -1600.0, 900.0)
PLATEAU = (-1500.0, 480.0, -1300.0, 900.0)       # west, east, south, north: the plateau west of the village


def _on_plateau_unmeasured(x, y):
    """The boxes left out on the plateau: unmeasured ones there, and any on a monument's footprint."""
    measured = data.city_measured()
    w, e, s, n = PLATEAU
    drop = (x > w) & (x < e) & (y > s) & (y < n) & ~measured
    for f in data.FOOTPRINTS:
        r = np.asarray(f["ring"], dtype=float)
        x0, y0 = r[:, 0].min(), r[:, 1].min()
        x1, y1 = r[:, 0].max(), r[:, 1].max()
        drop |= (x > x0 - 4) & (x < x1 + 4) & (y > y0 - 4) & (y < y1 + 4)
    return drop


def village(terrain, coll, lib, log=print):
    x, y, w, d, yaw, h = data.city_boxes().T
    x0, x1, y0, y1 = VILLAGE_BOX
    keep = (x > x0) & (x < x1) & (y > y0) & (y < y1)
    keep &= (np.arange(len(x)) % 4) == 0
    x, y, w, d, yaw = (a[keep] for a in (x, y, w, d, yaw))
    n = len(x)
    g = np.random.default_rng(12)
    pos = np.stack([x, y, terrain.surface(x, y) - 0.3], 1)
    rot = np.stack([np.zeros(n), np.zeros(n), np.radians(yaw)], 1)
    scl = np.stack([np.clip(w, 3, 14), np.clip(d, 3, 14), g.uniform(3.0, 6.5, n)], 1)
    return field("village", lib["mud box"], pos, rot, scl, g.integers(0, 3, n), g.random(n), np.zeros(n), coll, log)


MIN_HEIGHT = 3.0     # a box is drawn at least this tall over the ground, whatever its record says


def _kept(x, y):
    """The boxes build() draws: not the plateau's unmeasured ones, nor any within 3.2 half-bases of a pyramid."""
    keep = ~_on_plateau_unmeasured(x, y)
    for P in (data.PYRAMIDS[k] for k in ("g1", "g2", "g3")):
        keep &= np.hypot(x - P["cx"], y - P["cy"]) > P["half"] * 3.2
    return keep


def roof_at(px, py):
    """
    The drawn building whose box holds the point, for a station on a roof (render/stations.json `roof`): its
    record in data/footprints/city.bin, its roof's height over the ground as build() draws it, and whether the
    2.5D raster measured that height. None when no drawn box holds the point.
    """
    x, y, w, d, yaw, h = data.city_boxes().T
    measured = data.city_measured()
    c, s = np.cos(np.radians(yaw)), np.sin(np.radians(yaw))
    u, v = (px - x) * c + (py - y) * s, -(px - x) * s + (py - y) * c
    hit = np.nonzero(_kept(x, y) & (np.abs(u) <= np.maximum(w, 2) / 2) & (np.abs(v) <= np.maximum(d, 2) / 2))[0]
    if not len(hit):
        return None
    i = int(hit[np.argmax(h[hit])])
    return {"record": i, "height": float(max(h[i], MIN_HEIGHT)), "measured": bool(measured[i])}


def build(terrain, coll, lib, log=print):
    x, y, w, d, yaw, h = data.city_boxes().T
    keep = _kept(x, y)
    x, y, w, d, yaw, h = (a[keep] for a in (x, y, w, d, yaw, h))
    n = len(x)
    pos = np.stack([x, y, terrain.surface(x, y) - 0.5], 1)
    rot = np.stack([np.zeros(n), np.zeros(n), np.radians(yaw)], 1)
    scl = np.stack([np.maximum(w, 2), np.maximum(d, 2), np.maximum(h, MIN_HEIGHT) + 0.5], 1)
    tone = np.random.default_rng(3).random(n).astype(np.float32)
    return field("city", lib["box"], pos, rot, scl, np.zeros(n, np.int32), tone, np.zeros(n), coll, log)
