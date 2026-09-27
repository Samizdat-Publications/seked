"""
The valley's fields as built and in 1800, laid out once so that the ground's shader and
the palms along the dykes draw the same fields. bpy-free.

Look choices all, after the Nile valley seen from the air: long canals run down the
valley and cross canals between them wall it into basins; each basin is split again and
again into holdings of a hectare or so, and each holding is sown in strips along its
length (the strips are the shader's, materials._field_patchwork). Everything is laid in
the field frame, turned ANGLE degrees off north like the palm rows, with every edge on
a PIXEL-metre lattice, so the map the shader reads draws every edge straight at any
distance.

The map is an 8-bit RGB image over the field frame: R, each holding's identity (its low
bit says which way its strips run); G, the distance in metres from the lattice point to
the nearest holding's edge, a tenth of a metre a step; B, the same to the nearest canal,
a fifth of a metre a step. The shader reads R per cell (nearest) and G and B at the
lattice points (linear), which gives the distances exactly, since they are piecewise
linear between lattice points.
"""
import hashlib
import math
import os
import struct
import zlib

import numpy as np

ANGLE = -8.0                                  # the field frame, degrees off north (as the palm rows)
WORLD = (380.0, 4400.0, -5000.0, 3800.0)      # what the map covers in the project frame (x0, x1, y0, y1); it repeats beyond
PIXEL = 2.0                                   # metres a map cell
LONG = (380.0, 820.0)                         # spacing of the long canals down the valley, metres
CROSS = (260.0, 640.0)                        # and of the cross canals in each band between them
HOLDING = (2500.0, 16000.0)                   # a holding's area, square metres, before it is split no further
LEAST = 22.0                                  # no holding narrower than this
CANAL = 2.6                                   # a canal's half-width to its water's edge, metres
G_STEP, B_STEP = 0.1, 0.2                     # metres a step of the map's G and B
# Below this height the valley floor is fields (as built and in 1800; look choice): a couple of metres over the
# flood plain, so the cultivation stops where the ground starts to rise to the desert, abruptly and raggedly.
EDGE = -39.2
SEED = 2560
# The map is read through a gentle warp, so no canal runs ruler-straight for kilometres: a few long sine
# waves, (amplitude m, wavelength m, how much of u and of v they run along, phase), the same here for the
# palms as in the shader (materials._field_patchwork).
WARP_U = [(11.0, 900.0, 0.0, 1.0, 1.3), (3.0, 350.0, 0.5, 0.86, 0.4)]
WARP_V = [(9.0, 1100.0, 1.0, 0.0, 2.1), (3.0, 300.0, 0.9, -0.44, 1.7)]


def warp(u, v):
    """The warp's offsets (du, dv) at field-frame points: the map is read at (u + du, v + dv)."""
    u, v = np.asarray(u, np.float64), np.asarray(v, np.float64)
    out = []
    for terms in (WARP_U, WARP_V):
        d = np.zeros(np.broadcast(u, v).shape)
        for amp, wl, a, b, ph in terms:
            d = d + amp * np.sin(2 * math.pi * (a * u + b * v) / wl + ph)
        out.append(d)
    return out[0], out[1]


def unwarp(qu, qv, rounds=8):
    """The field-frame points whose warped reading is the map point (qu, qv)."""
    u, v = np.array(qu, np.float64), np.array(qv, np.float64)
    for _ in range(rounds):
        du, dv = warp(u, v)
        u, v = qu - du, qv - dv
    return u, v


def _rot():
    a = math.radians(ANGLE)
    return math.cos(a), math.sin(a)


def to_field(x, y):
    """Project frame to field frame (u across the valley, v down it)."""
    ca, sa = _rot()
    x, y = np.asarray(x, np.float64), np.asarray(y, np.float64)
    return x * ca + y * sa, -x * sa + y * ca


def to_world(u, v):
    ca, sa = _rot()
    u, v = np.asarray(u, np.float64), np.asarray(v, np.float64)
    return u * ca - v * sa, u * sa + v * ca


def frame():
    """The map's origin in the field frame and its size in cells: (u0, v0, nu, nv)."""
    x0, x1, y0, y1 = WORLD
    u, v = to_field([x0, x1, x1, x0], [y0, y0, y1, y1])
    u0, v0 = math.floor(u.min() / PIXEL) * PIXEL, math.floor(v.min() / PIXEL) * PIXEL
    nu, nv = int(math.ceil((u.max() - u0) / PIXEL)), int(math.ceil((v.max() - v0) / PIXEL))
    return u0, v0, nu, nv


def _split(rng, lo, hi, spacing):
    """Cut positions from lo to hi at spacings drawn from `spacing`, in whole cells."""
    cuts, t = [lo], lo
    while True:
        t += int(round(rng.uniform(*spacing) / PIXEL))
        if t >= hi - int(spacing[0] / PIXEL / 2):
            break
        cuts.append(t)
    return cuts + [hi]


def layout(seed=SEED):
    """
    The basins and the holdings in cells of the map: two lists of (i0, i1, j0, j1), half-open,
    and each holding's identity byte (odd: strips run down the valley, along v).
    """
    rng = np.random.default_rng(seed)
    _, _, nu, nv = frame()
    basins = []
    cols = _split(rng, 0, nu, LONG)
    for a, b in zip(cols[:-1], cols[1:]):
        rows = _split(rng, 0, nv, CROSS)
        basins += [(a, b, c, d) for c, d in zip(rows[:-1], rows[1:])]
    least = int(round(LEAST / PIXEL))
    holdings = []
    stack = list(basins)
    while stack:
        i0, i1, j0, j1 = stack.pop()
        w, h = i1 - i0, j1 - j0
        area = w * h * PIXEL * PIXEL
        target = rng.uniform(*HOLDING)
        if area <= target or max(w, h) < 2 * least:
            holdings.append((i0, i1, j0, j1))
            continue
        along_u = (w >= h) if rng.random() < 0.8 else (w < h)
        if along_u and w < 2 * least or not along_u and h < 2 * least:
            along_u = not along_u
        n = w if along_u else h
        cut = int(round(n * rng.uniform(0.28, 0.72)))
        cut = min(max(cut, least), n - least)
        if along_u:
            stack += [(i0, i0 + cut, j0, j1), (i0 + cut, i1, j0, j1)]
        else:
            stack += [(i0, i1, j0, j0 + cut), (i0, i1, j0 + cut, j1)]
    ids = []
    for i0, i1, j0, j1 in holdings:
        k = int(rng.integers(1, 128))
        # the strips run along the holding's length, mostly
        down = (j1 - j0) >= (i1 - i0)
        if rng.random() < 0.15:
            down = not down
        ids.append(2 * k + (1 if down else 0))
    return basins, holdings, ids


def _distance(rects, nu, nv, cap):
    """Metres from each lattice point to the nearest edge of the rectangles (which tile the map), capped."""
    D = np.full((nv, nu), cap, np.float32)
    for i0, i1, j0, j1 in rects:
        ii = np.arange(i0, min(i1 + 1, nu))
        jj = np.arange(j0, min(j1 + 1, nv))
        du = np.minimum(ii - i0, i1 - ii).astype(np.float32) * PIXEL
        dv = np.minimum(jj - j0, j1 - jj).astype(np.float32) * PIXEL
        d = np.minimum(du[None, :], dv[:, None])
        D[j0:j0 + len(jj), i0:i0 + len(ii)] = np.minimum(D[j0:j0 + len(jj), i0:i0 + len(ii)], d)
    return D


def raster(seed=SEED):
    """The map as a (nv, nu, 3) uint8 array, row j at v = v0 + j * PIXEL."""
    basins, holdings, ids = layout(seed)
    _, _, nu, nv = frame()
    img = np.zeros((nv, nu, 3), np.uint8)
    for (i0, i1, j0, j1), k in zip(holdings, ids):
        img[j0:j1, i0:i1, 0] = k
    img[..., 1] = np.round(np.minimum(_distance(holdings, nu, nv, 255 * G_STEP), 255 * G_STEP) / G_STEP).astype(np.uint8)
    img[..., 2] = np.round(np.minimum(_distance(basins, nu, nv, 255 * B_STEP), 255 * B_STEP) / B_STEP).astype(np.uint8)
    return img


def _png(path, rgb):
    """A plain RGB PNG, rows top first (the map's last row, highest v, is the image's top)."""
    h, w, _ = rgb.shape
    rows = np.concatenate([np.zeros((h, 1), np.uint8), rgb[::-1].reshape(h, w * 3)], 1)
    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xffffffff)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)))
        f.write(chunk(b"IDAT", zlib.compress(rows.tobytes(), 6)))
        f.write(chunk(b"IEND", b""))


def _key(seed):
    spec = repr((ANGLE, WORLD, PIXEL, LONG, CROSS, HOLDING, LEAST, G_STEP, B_STEP, seed, 2))
    return hashlib.sha1(spec.encode()).hexdigest()[:10]


def map_path(repo, seed=SEED):
    """The map as a PNG under build/fields/, written the first time these settings ask for it."""
    folder = os.path.join(repo, "build", "fields")
    path = os.path.join(folder, f"fields-{_key(seed)}.png")
    if not os.path.exists(path):
        os.makedirs(folder, exist_ok=True)
        tmp = path + ".part"
        _png(tmp, raster(seed))
        os.replace(tmp, path)
    return path


def edges(seed=SEED):
    """
    Every edge once, in the field frame, as (u0, v0, u1, v1, canal): the canals round the basins
    and the dykes between the holdings (each holding's west and south sides, which between them
    are every inner edge once).
    """
    basins, holdings, _ = layout(seed)
    u0, v0, _, _ = frame()
    out = []
    for rects, canal in ((basins, True), (holdings, False)):
        for i0, i1, j0, j1 in rects:
            a, b = u0 + i0 * PIXEL, u0 + i1 * PIXEL
            c, d = v0 + j0 * PIXEL, v0 + j1 * PIXEL
            out.append((a, c, a, d, canal))
            out.append((a, c, b, c, canal))
    return out


def palms(rng, share, spacing, box, canal_share=0.6):
    """
    Palms along the canals (on one bank or the other, a couple of metres back from the water)
    and along some of the dykes between holdings: x and y in the project frame, within `box`.
    """
    xs, ys = [], []
    x0, x1, y0, y1 = box
    for a, c, b, d, canal in edges():
        if rng.random() > (canal_share if canal else share):
            continue
        L = math.hypot(b - a, d - c)
        eu, ev = (b - a) / L, (d - c) / L
        side = (CANAL + 2.2) * (1 if rng.random() < 0.5 else -1) if canal else 0.0
        t = rng.uniform(0.5, 2.0)
        while t < L - 0.5:
            j = rng.normal(0.0, 0.5)
            xs.append(a + eu * t - ev * (side + j))
            ys.append(c + ev * t + eu * (side + j))
            t += rng.uniform(*spacing)
    if not xs:
        return np.zeros(0), np.zeros(0)
    x, y = to_world(*unwarp(np.array(xs), np.array(ys)))
    ok = (x > x0) & (x < x1) & (y > y0) & (y < y1)
    return x[ok], y[ok]
