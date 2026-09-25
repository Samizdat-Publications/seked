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


# Where people stand, era by era: (x, y, half-width, half-depth, how many, floor z or None for the ground).
# Today's are visitors; as built, men unloading on the quay, priests in Khufu's temple court, people
# among the tombs and below Khufu's south side. Every place and number is a look choice.
QUAY_TOP = -43.3 + 1.2        # the harbour's water plus harbour.QUAY_TOP_ABOVE_WATER
CROWDS = {
    "today": [(0, 128, 70, 40, 60, None), (120, 30, 20, 60, 60, None), (60, -125, 60, 30, 60, None),
              (-125, -40, 20, 50, 60, None), (215, -60, 15, 80, 60, None), (150, -250, 60, 40, 60, None),
              (-8, -318, 10, 8, 9, None), (-70, -300, 14, 10, 9, None), (392, -484, 14, 6, 30, None),
              (300, -458, 22, 3, 18, None)],
    "built": [(417.6, -470.0, 0.8, 68.0, 34, QUAY_TOP), (156.0, 0.0, 8.0, 19.0, 14, 0.5),
              (300.0, -120.0, 50.0, 75.0, 18, None), (60.0, -140.0, 40.0, 8.0, 8, None)],
}
NEAR_CAMERA = {True: 7.0, False: 35.0}   # Meshy figures hold up at a few metres; the capsules read as toys


def _inside_mastaba(x, y, pad=0.8):
    for m in data.mastabas():
        c, s = math.cos(-m["yaw"]), math.sin(-m["yaw"])
        lx = (x - m["cx"]) * c - (y - m["cy"]) * s
        ly = (x - m["cx"]) * s + (y - m["cy"]) * c
        if abs(lx) < m["length"] / 2 + pad and abs(ly) < m["width"] / 2 + pad:
            return True
    return False


def people(camera_xy, terrain, coll, lib, log=print, state="today"):
    import random
    rng = random.Random(21)
    near = NEAR_CAMERA[bool(lib.get("figures"))]
    kinds = max(1, len(lib["people"].objects))
    pos, rot, scl, var, tone, floors = [], [], [], [], [], []
    for sx, sy, rx, ry, n, floor in CROWDS.get(state, []):
        for _ in range(n):
            x, y = sx + rng.uniform(-rx, rx), sy + rng.uniform(-ry, ry)
            if floor is None and abs(x) < 118 and abs(y) < 118:
                continue
            if math.hypot(x - camera_xy[0], y - camera_xy[1]) < near:
                continue
            if floor is None and state == "built" and _inside_mastaba(x, y):
                continue
            pos.append([x, y, 0.0])
            floors.append(floor)
            rot.append((0, 0, rng.uniform(0, 6.3)))
            s = rng.uniform(0.94, 1.05)
            scl.append((s if rng.random() < 0.5 else -s, s, s))      # half of them mirrored: twice the figures for free
            var.append(rng.randrange(kinds))
            tone.append(rng.random())
    if not pos:
        return None
    pos = np.array(pos)
    ground = terrain.surface(pos[:, 0], pos[:, 1])
    pos[:, 2] = [g if f is None else f for g, f in zip(ground, floors)]
    return field("people", lib["people"], pos, np.array(rot), np.array(scl), np.array(var), np.array(tone),
                 np.zeros(len(tone)), coll, log)
