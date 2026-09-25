"""
The ground. GLO-30 is a surface model with the monuments' footprints edited into
smooth mounds, so every footprint is flattened to its surveyed base level and blended
back into the terrain over 8 to 60 metres. A long swell and a finer relief are added
away from the monuments (look choices), and sand drifts against the big pyramids' feet.

Three meshes: a 4 m grid over the plateau, a 60 m grid out to the horizon, and a 1 m
patch in front of each camera whose surface is displaced for real by adaptive
subdivision. The patch is lifted 5 cm and displaces outward only, so it always
covers the grid beneath it and needs no hole cut per view.
"""
import numpy as np
import bpy

from . import data
from .noise import ValueNoise, smoothstep

NEAR_BOX = (-1950.0, 1750.0, -2150.0, 1750.0)
NEAR_STEP = 4.0
FAR_HALF = 11500.0
FAR_STEP = 60.0
PATCH_HALF = 150.0
PATCH_LIFT = 0.05


class Terrain:
    def __init__(self, state, footprints):
        self.state = state
        self.footprints = footprints
        self.noise = ValueNoise(11, 2400.0)

    def z(self, X, Y, far=False):
        grid = data.FAR if far else data.NEAR
        Z = grid.sample(X, Y) + data.TERRAIN_SHIFT
        keep = np.ones_like(Z)
        drift = np.zeros_like(Z)
        for cx, cy, half, bz in self.footprints:
            d = np.maximum(np.abs(X - cx) - half, np.abs(Y - cy) - half)   # outside the square
            t = smoothstep(8.0, 60.0, d)
            Z = bz * (1 - t) + Z * t
            keep = np.minimum(keep, smoothstep(0.0, 30.0, d) * 0.8 + 0.2)
            if self.state == "today" and half > 40:
                drift += 0.8 * np.exp(-np.maximum(d, 0.0) / 6.0) * (d > -1.0)
        if not far:
            n = self.noise
            Z = Z + keep * (1.1 * n.fbm(X, Y, 90.0, 5, 0.5, key=1) + 0.35 * n.fbm(X, Y, 16.0, 2, 0.5, key=3)) \
                + drift * (0.6 + 0.4 * n.fbm(X, Y, 20.0, 2, key=2))
        return Z

    def surface(self, x, y):
        """Ground height anywhere, from whichever grid covers the point."""
        x = np.asarray(x, np.float32)
        y = np.asarray(y, np.float32)
        inside = (x > NEAR_BOX[0]) & (x < NEAR_BOX[1]) & (y > NEAR_BOX[2]) & (y < NEAR_BOX[3])
        return np.where(inside, self.z(x, y), self.z(x, y, far=True) - 0.8)

    def build(self, coll, material):
        xs = np.arange(NEAR_BOX[0], NEAR_BOX[1] + 0.1, NEAR_STEP, dtype=np.float32)
        ys = np.arange(NEAR_BOX[2], NEAR_BOX[3] + 0.1, NEAR_STEP, dtype=np.float32)
        near = grid_object("ground near", xs, ys, self.z, coll)
        near.data.materials.append(material)
        f = np.arange(-FAR_HALF, FAR_HALF + 0.1, FAR_STEP, dtype=np.float32)
        far = grid_object("ground far", f, f, lambda X, Y: self.z(X, Y, far=True) - 0.8, coll,
                          hole=(NEAR_BOX[0] + 60, NEAR_BOX[1] - 60, NEAR_BOX[2] + 60, NEAR_BOX[3] - 60))
        far.data.materials.append(material)
        return near, far

    def patch(self, centre, coll, material):
        """A displaced square of ground round `centre`, adaptive to 2 px."""
        cx, cy = centre
        xs = np.arange(cx - PATCH_HALF, cx + PATCH_HALF + 0.01, 1.0, dtype=np.float32)
        ys = np.arange(cy - PATCH_HALF, cy + PATCH_HALF + 0.01, 1.0, dtype=np.float32)
        ob = grid_object("ground patch", xs, ys, lambda X, Y: self.z(X, Y) + PATCH_LIFT, coll)
        ob.data.materials.append(material)
        sub = ob.modifiers.new("adaptive", "SUBSURF")
        sub.subdivision_type = "SIMPLE"
        sub.use_adaptive_subdivision = True
        sub.adaptive_space = "PIXEL"
        sub.adaptive_pixel_size = 2.0
        return ob


def grid_object(name, xs, ys, zfun, coll, hole=None):
    """A regular grid mesh, built with numpy; `hole` drops quads inside (x0, x1, y0, y1)."""
    X, Y = np.meshgrid(xs, ys)
    Z = zfun(X, Y).astype(np.float32)
    nx = len(xs)
    co = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1).astype(np.float32)
    ii, jj = np.meshgrid(np.arange(nx - 1), np.arange(len(ys) - 1))
    a = (jj * nx + ii).ravel()
    quads = np.stack([a, a + 1, a + nx + 1, a + nx], 1)
    if hole is not None:
        qx = X[:-1, :-1].ravel() + (xs[1] - xs[0]) / 2
        qy = Y[:-1, :-1].ravel() + (ys[1] - ys[0]) / 2
        quads = quads[~((qx > hole[0]) & (qx < hole[1]) & (qy > hole[2]) & (qy < hole[3]))]
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(co))
    me.vertices.foreach_set("co", co.ravel())
    me.loops.add(len(quads) * 4)
    me.loops.foreach_set("vertex_index", quads.astype(np.int32).ravel())
    me.polygons.add(len(quads))
    me.polygons.foreach_set("loop_start", np.arange(0, len(quads) * 4, 4, dtype=np.int32))
    me.polygons.foreach_set("loop_total", np.full(len(quads), 4, dtype=np.int32))
    me.update(calc_edges=True)
    me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob
