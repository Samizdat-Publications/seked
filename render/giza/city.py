"""
The modern city behind the plateau for the present day: Google Open Buildings
outlines reduced to boxes, with the 2.5D Temporal heights (data/footprints/city.json).
Context, never evidence; nothing within about three half-bases of a pyramid is drawn.
"""
import numpy as np

from . import data
from .instancing import field


def build(terrain, coll, lib, log=print):
    x, y, w, d, yaw, h = data.city_boxes().T
    keep = np.ones(len(x), bool)
    for P in (data.PYRAMIDS[k] for k in ("g1", "g2", "g3")):
        keep &= np.hypot(x - P["cx"], y - P["cy"]) > P["half"] * 3.2
    x, y, w, d, yaw, h = (a[keep] for a in (x, y, w, d, yaw, h))
    n = len(x)
    pos = np.stack([x, y, terrain.surface(x, y) - 0.5], 1)
    rot = np.stack([np.zeros(n), np.zeros(n), np.radians(yaw)], 1)
    scl = np.stack([np.maximum(w, 2), np.maximum(d, 2), np.maximum(h, 3) + 0.5], 1)
    tone = np.random.default_rng(3).random(n).astype(np.float32)
    return field("city", lib["box"], pos, rot, scl, np.zeros(n, np.int32), tone, np.zeros(n), coll, log)
