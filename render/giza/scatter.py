"""
What lies on the ground: rubble at the pyramids' feet, stones round the camera, and
people for scale. All of it is a look choice and belongs to the present day.
"""
import math

import numpy as np

from . import data
from .instancing import field
from .pyramids import FACE_ROT


def rubble(rng, terrain, coll, lib, log=print):
    """A skirt of broken stone along every face, densest at the foot."""
    pos, rot, scl, var, tone = [], [], [], [], []
    everything = [data.PYRAMIDS[k] for k in ("g1", "g2", "g3")] + data.QUEENS
    for P in everything:
        big = P["half"] > 40
        n = int(P["half"] * 2 * (26 if big else 18))
        for f in range(4):
            u = np.array([rng.uniform(-P["half"] - 6, P["half"] + 6) for _ in range(n)])
            d = np.array([rng.expovariate(1 / (5.5 if big else 3.5)) for _ in range(n)])
            size = np.array([min(rng.lognormvariate(math.log(0.35), 0.6), 2.2) for _ in range(n)])
            v = P["half"] + d - 0.6
            ca, sa = math.cos(FACE_ROT[f]), math.sin(FACE_ROT[f])
            x = P["cx"] + u * ca - v * sa
            y = P["cy"] + u * sa + v * ca
            z = terrain.surface(x, y)
            for i in range(n):
                s = size[i]
                pos.append((x[i], y[i], z[i] + s * 0.18))
                rot.append((rng.uniform(-0.4, 0.4), rng.uniform(-0.4, 0.4), rng.uniform(0, 6.3)))
                scl.append((s * rng.uniform(0.8, 1.4), s * rng.uniform(0.8, 1.2), s))
                var.append(rng.randrange(12))
                tone.append(rng.random())
    tone = np.array(tone)
    return field("rubble", lib["rock"], np.array(pos), np.array(rot), np.array(scl), np.array(var), tone, tone * 0.5, coll, log)


def stones(centre, terrain, coll, lib, log=print, count=60000, radius=350.0):
    """Stones on the open ground round a camera, thinning with distance; none big at the camera's feet."""
    cx, cy = centre
    g = np.random.default_rng(5)
    r = radius * np.sqrt(g.random(count)) ** 1.6
    a = g.random(count) * 2 * np.pi
    sx, sy = cx + r * np.cos(a), cy + r * np.sin(a)
    ok = np.ones(count, bool)
    for P in [data.PYRAMIDS[k] for k in ("g1", "g2", "g3")] + data.QUEENS:
        ok &= (np.abs(sx - P["cx"]) > P["half"] + 1) | (np.abs(sy - P["cy"]) > P["half"] + 1)
    sx, sy = sx[ok], sy[ok]
    n = len(sx)
    g2 = np.random.default_rng(7)
    size = np.clip(g2.lognormal(np.log(0.09), 0.7, n), 0.02, 0.9)
    size = np.where(np.hypot(sx - cx, sy - cy) < 8.0, np.minimum(size, 0.12), size)
    pos = np.stack([sx, sy, terrain.surface(sx, sy) + size * 0.15], 1)
    rot = np.stack([g2.uniform(-0.5, 0.5, n), g2.uniform(-0.5, 0.5, n), g2.uniform(0, 6.3, n)], 1)
    scl = np.stack([size * g2.uniform(0.8, 1.5, n), size * g2.uniform(0.8, 1.3, n), size], 1)
    tone = g2.random(n)
    return field("stones", lib["rock"], pos, rot, scl, g2.integers(0, 12, n), tone, tone * 0.4, coll, log)


# Where visitors stand: (x, y, half-width, half-depth, how many).
CROWDS = [(0, 128, 70, 40, 60), (120, 30, 20, 60, 60), (60, -125, 60, 30, 60), (-125, -40, 20, 50, 60),
          (215, -60, 15, 80, 60), (150, -250, 60, 40, 60), (-8, -318, 10, 8, 9), (-70, -300, 14, 10, 9),
          (392, -484, 14, 6, 30), (300, -458, 22, 3, 18)]
NEAR_CAMERA = 35.0   # no figure closer than this: at a few metres the stand-in people read as toys


def people(camera_xy, terrain, coll, lib, log=print):
    import random
    rng = random.Random(21)
    pos, rot, scl, var, tone = [], [], [], [], []
    for sx, sy, rx, ry, n in CROWDS:
        for _ in range(n):
            x, y = sx + rng.uniform(-rx, rx), sy + rng.uniform(-ry, ry)
            if abs(x) < 118 and abs(y) < 118:
                continue
            if math.hypot(x - camera_xy[0], y - camera_xy[1]) < NEAR_CAMERA:
                continue
            pos.append([x, y, 0.0])
            rot.append((0, 0, rng.uniform(0, 6.3)))
            s = rng.uniform(0.92, 1.06)
            scl.append((s, s, s))
            var.append(rng.randrange(4))
            tone.append(rng.random())
    pos = np.array(pos)
    pos[:, 2] = terrain.surface(pos[:, 0], pos[:, 1])
    return field("people", lib["people"], pos, np.array(rot), np.array(scl), np.array(var), np.array(tone),
                 np.zeros(len(tone)), coll, log)
