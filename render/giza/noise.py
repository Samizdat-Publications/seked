"""Numpy value noise and bicubic sampling. bpy-free."""
import numpy as np


def cubic_weights(t):
    """Catmull-Rom weights for the four samples around a fractional position t in [0, 1)."""
    t2 = t * t
    t3 = t2 * t
    return (-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1.0, -1.5 * t3 + 2.0 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2)


def bicubic(grid, fx, fy):
    """Sample a 2D grid (rows y, columns x) at fractional indices, clamping at the edges."""
    ny, nx = grid.shape
    ix = np.floor(fx).astype(np.int64)
    iy = np.floor(fy).astype(np.int64)
    wx = cubic_weights((fx - ix).astype(np.float32))
    wy = cubic_weights((fy - iy).astype(np.float32))
    out = np.zeros(np.shape(fx), dtype=np.float32)
    for j in range(4):
        yy = np.clip(iy + j - 1, 0, ny - 1)
        row = np.zeros(np.shape(fx), dtype=np.float32)
        for i in range(4):
            xx = np.clip(ix + i - 1, 0, nx - 1)
            row += wx[i] * grid[yy, xx]
        out += wy[j] * row
    return out


class ValueNoise:
    """
    Smooth noise by sampling random lattices bicubically, summed over octaves.
    Deterministic for a seed; `extent` is the half-width in metres the lattices cover.
    """

    def __init__(self, seed, extent):
        self.rng = np.random.default_rng(seed)
        self.extent = extent
        self.cache = {}

    def octave(self, x, y, wavelength, key):
        n = int(2 * self.extent / wavelength) + 5
        k = (key, wavelength)
        if k not in self.cache:
            self.cache[k] = self.rng.standard_normal((n, n)).astype(np.float32)
        g = self.cache[k]
        return bicubic(g, (x + self.extent) / wavelength + 1.5, (y + self.extent) / wavelength + 1.5)

    def fbm(self, x, y, wavelength, octaves, gain=0.5, key=0):
        total = np.zeros(np.shape(x), dtype=np.float32)
        amp, norm = 1.0, 0.0
        for i in range(octaves):
            total += amp * self.octave(x, y, wavelength, (key, i))
            norm += amp
            amp *= gain
            wavelength /= 2.0
        return total / norm


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)
