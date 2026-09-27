"""
The tracks trodden across the desert as built: from the harbour and the builders' town up
to the pyramids, from the quarry to the work, and off into the desert. Look choices all,
after the braided foot and sledge tracks every aerial photograph of a worked desert shows;
none is a surveyed road. bpy-free.

Each track is a polyline of waypoints in the project frame, drawn as two or three strands
that wander apart and back. They reach the ground's shader (materials.ground) as a map of
the distance to the nearest strand: an 8-bit grey PNG over BOX, 255 on a strand's line and
falling a step every STEP metres.
"""
import hashlib
import math
import os

import numpy as np

from .fields import _png

BOX = (-1500.0, 1000.0, -2200.0, 800.0)       # what the map covers (x0, x1, y0, y1); nothing beyond it
PIXEL = 1.0
STEP = 0.1
# (waypoints, half-width of the main strand in metres), era by era
TRACKS = {
    "built": [
        ([(430.0, -395.0), (330.0, -300.0), (230.0, -190.0), (130.0, -125.0)], 2.2),     # quay to Khufu's south-east corner
        ([(520.0, -800.0), (430.0, -730.0), (300.0, -640.0), (160.0, -520.0), (-60.0, -470.0), (-220.0, -468.0)], 2.4),
        ([(160.0, -520.0), (120.0, -380.0), (40.0, -230.0), (0.0, -130.0)], 2.0),         # quarry to Khufu's south side
        ([(-240.0, -470.0), (-380.0, -560.0), (-470.0, -660.0), (-520.0, -690.0)], 1.6),  # Khafre to Menkaure
        ([(-600.0, -800.0), (-760.0, -1000.0), (-900.0, -1250.0), (-1150.0, -1600.0), (-1450.0, -2150.0)], 1.5),
        ([(560.0, -930.0), (600.0, -1200.0), (640.0, -1500.0), (700.0, -2150.0)], 1.8),   # along the desert's edge, south
        ([(-130.0, 30.0), (-240.0, 60.0), (-420.0, 90.0), (-700.0, 160.0), (-1450.0, 420.0)], 1.4),
        ([(-460.0, -380.0), (-700.0, -420.0), (-1000.0, -520.0), (-1450.0, -700.0)], 1.2),
        ([(130.0, 130.0), (260.0, 300.0), (420.0, 560.0), (560.0, 780.0)], 1.4),           # north, down to the valley
    ],
}


def _wander(pts, seed, amp):
    """The polyline resampled every 4 m and pushed sideways by a few long, slow waves."""
    pts = np.asarray(pts, np.float64)
    seg = np.hypot(*np.diff(pts, axis=0).T)
    s = np.concatenate([[0.0], np.cumsum(seg)])
    t = np.arange(0.0, s[-1] + 0.1, 4.0)
    x, y = np.interp(t, s, pts[:, 0]), np.interp(t, s, pts[:, 1])
    dx, dy = np.gradient(x), np.gradient(y)
    L = np.hypot(dx, dy) + 1e-9
    nx, ny = -dy / L, dx / L
    rng = np.random.default_rng(seed)
    off = np.zeros_like(t)
    for wl in (340.0, 130.0, 47.0):
        off += amp * (wl / 340.0) ** 0.6 * np.sin(2 * math.pi * t / wl + rng.uniform(0, 2 * math.pi))
    off *= np.minimum(1.0, np.minimum(t, t[-1] - t) / 60.0)       # the strands meet at the ends
    return np.stack([x + nx * off, y + ny * off], 1)


def strands(state):
    """Every strand as (points, half-width)."""
    out = []
    for k, (pts, half) in enumerate(TRACKS.get(state, [])):
        out.append((_wander(pts, 100 + k, 3.0), half))
        out.append((_wander(pts, 200 + k, 4.5), half * 0.6))
        if half >= 2.0:
            out.append((_wander(pts, 300 + k, 6.5), half * 0.45))
    return out


def raster(state):
    """(ny, nx) uint8: 255 - distance to the nearest strand's edge in STEP steps, 0 from 25 m out; row j at y0 + j."""
    x0, x1, y0, y1 = BOX
    nx, ny = int((x1 - x0) / PIXEL), int((y1 - y0) / PIXEL)
    D = np.full((ny, nx), 255 * STEP, np.float32)
    reach = 255 * STEP
    for pts, half in strands(state):
        for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
            lo_x, hi_x = min(ax, bx) - half - reach, max(ax, bx) + half + reach
            lo_y, hi_y = min(ay, by) - half - reach, max(ay, by) + half + reach
            i0, i1 = max(0, int((lo_x - x0) / PIXEL)), min(nx, int((hi_x - x0) / PIXEL) + 1)
            j0, j1 = max(0, int((lo_y - y0) / PIXEL)), min(ny, int((hi_y - y0) / PIXEL) + 1)
            if i0 >= i1 or j0 >= j1:
                continue
            X = x0 + (np.arange(i0, i1) + 0.5) * PIXEL
            Y = y0 + (np.arange(j0, j1) + 0.5) * PIXEL
            X, Y = np.meshgrid(X, Y)
            ex, ey = bx - ax, by - ay
            t = np.clip(((X - ax) * ex + (Y - ay) * ey) / (ex * ex + ey * ey + 1e-12), 0.0, 1.0)
            d = np.hypot(X - ax - t * ex, Y - ay - t * ey) - half
            D[j0:j1, i0:i1] = np.minimum(D[j0:j1, i0:i1], np.maximum(d, 0.0))
    return (255 - np.round(D / STEP)).clip(0, 255).astype(np.uint8)


def map_path(repo, state):
    """The era's map as a PNG under build/fields/ (written the first time), or None where it has no tracks."""
    if not TRACKS.get(state):
        return None
    key = hashlib.sha1(repr((BOX, PIXEL, STEP, TRACKS[state], 1)).encode()).hexdigest()[:10]
    folder = os.path.join(repo, "build", "fields")
    path = os.path.join(folder, f"tracks-{state}-{key}.png")
    if not os.path.exists(path):
        os.makedirs(folder, exist_ok=True)
        g = raster(state)
        tmp = path + ".part"
        _png(tmp, np.repeat(g[:, :, None], 3, axis=2))
        os.replace(tmp, path)
    return path
