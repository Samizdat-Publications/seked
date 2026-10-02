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

from . import data, states
from .noise import ValueNoise, smoothstep

# Look choice: how much sand has drifted against the big pyramids' feet in each era.
DRIFT = {"today": 0.8, "stripped": 1.7}

# GLO-30 is a surface model: east of the temples it carries the modern town's roofs. Before the
# town, the valley floor was the flood plain, so in the eras without it the low ground there is
# eased to a plain at these heights (look choices): a metre under the claim eras' flood, so it lies
# across the valley with reed islands where the relief lifts the ground; a little above the harbour
# as built and in 1800, so the fields stand dry.
FLOODPLAIN = {"first-time": -43.6, "lion": -43.5, "built": -42.4, "stripped": -42.2}
# The town's taller roofs stand above the easing's reach and were left as mounds a few metres high on
# the plain; in the eras with fields (whose edge is fields.EDGE) they read as sandy islands
# in the crops, so there the plain also takes any ground whose surroundings, sampled on two rings
# ROOF_RINGS metres out, lie at the plain's level (the escarpment's foot keeps its slope: half of its
# ring stands high). The claim's eras keep them, as the reed islands in their flood.
ROOFLESS = ("built", "stripped")
ROOF_RINGS = (70.0, 140.0)
ROOFLESS_FROM = (750.0, 5000.0)    # between these x the valley floor is all plain (the escarpment lies west of it)

NEAR_BOX = (-1950.0, 1750.0, -2150.0, 1750.0)
NEAR_STEP = 4.0
FAR_HALF = 11500.0
FAR_STEP = 60.0
HORIZON = 150000.0         # how far the plain beyond the far grid runs (look choice); the haze covers 30 km of it
PATCH_HALF = 150.0
PATCH_LIFT = 0.05


class Terrain:
    """
    `footprints` are the pyramids' squares (cx, cy, half, base); `flats` the temples'
    platforms (cx, cy, half-x, half-y, z); `cuts` rectangles dug to a floor, like the
    Sphinx's ditch (x0, x1, y0, y1, floor); `rims` the rock the DEM has smoothed away round
    such a ditch (x0, x1, y0, y1, reach, fade from x, fade to x); `basins` water basins dug
    with sloping banks (x0, x1, y0, y1, floor, bank width); `calm` a polyline (the causeway)
    near which the invented relief is held down so nothing pokes through a road.
    """

    def __init__(self, state, footprints, flats=(), cuts=(), calm=None, sand=None, basins=(), rims=()):
        self.state = state
        self.footprints = footprints
        self.flats = list(flats)
        self.cuts = list(cuts)
        self.basins = list(basins)
        self.rims = list(rims)
        self.calm = None if calm is None else np.asarray(calm, np.float64)
        self.noise = ValueNoise(11, 2400.0)
        self.drift = DRIFT.get(state, 0.0)
        self.sand = sand

    def _calm_distance(self, X, Y):
        d = np.full(np.shape(X), 1e9, dtype=np.float64)
        pts = self.calm
        for i in range(len(pts) - 1):
            ax, ay = pts[i]
            bx, by = pts[i + 1]
            ex, ey = bx - ax, by - ay
            L2 = ex * ex + ey * ey
            t = np.clip(((X - ax) * ex + (Y - ay) * ey) / L2, 0.0, 1.0)
            d = np.minimum(d, np.hypot(X - (ax + t * ex), Y - (ay + t * ey)))
        return d

    def z(self, X, Y, far=False):
        grid = data.FAR if far else data.NEAR
        Z = grid.sample(X, Y) + data.TERRAIN_SHIFT
        plain = FLOODPLAIN.get(self.state)
        if plain is not None:
            # East of the temples and below the escarpment, the flood plain instead of the town's roofs.
            m = smoothstep(470.0, 560.0, X) * smoothstep(-33.0, -37.0, Z)
            if self.state in ROOFLESS:
                ring = [grid.sample(X + r * np.cos(a), Y + r * np.sin(a)) + data.TERRAIN_SHIFT
                        for r in ROOF_RINGS for a in np.arange(8) * (np.pi / 4)]
                m = np.maximum(m, smoothstep(470.0, 560.0, X) * smoothstep(-36.5, -39.0, np.median(ring, axis=0)))
                # well out on the valley floor the city is dense enough to fill the rings: there, all of it
                m = np.maximum(m, smoothstep(ROOFLESS_FROM[0], ROOFLESS_FROM[0] + 100.0, X) * smoothstep(ROOFLESS_FROM[1] + 100.0, ROOFLESS_FROM[1], X))
            Z = Z * (1 - m) + plain * m
        keep = np.ones_like(Z)
        drift = np.zeros_like(Z)
        for cx, cy, half, bz in self.footprints:
            d = np.maximum(np.abs(X - cx) - half, np.abs(Y - cy) - half)   # outside the square
            t = smoothstep(8.0, 60.0, d)
            Z = bz * (1 - t) + Z * t
            keep = np.minimum(keep, smoothstep(0.0, 30.0, d) * 0.8 + 0.2)
            if self.drift and half > 40:
                drift += self.drift * np.exp(-np.maximum(d, 0.0) / 6.0) * (d > -1.0)
        for cx, cy, hx, hy, bz in self.flats:
            d = np.maximum(np.abs(X - cx) - hx, np.abs(Y - cy) - hy)
            t = smoothstep(3.0, 25.0, d)
            Z = bz * (1 - t) + Z * t
            keep = np.minimum(keep, smoothstep(0.0, 20.0, d) * 0.85 + 0.15)
        if self.calm is not None and not far:
            keep = np.minimum(keep, smoothstep(6.0, 25.0, self._calm_distance(X, Y)) * 0.9 + 0.1)
        if not far:
            n = self.noise
            Z = Z + keep * (1.1 * n.fbm(X, Y, 90.0, 5, 0.5, key=1) + 0.35 * n.fbm(X, Y, 16.0, 2, 0.5, key=3)) \
                + drift * (0.6 + 0.4 * n.fbm(X, Y, 20.0, 2, key=2))
        for x0, x1, y0, y1, reach, fade0, fade1 in self.rims:
            # The rock round a ditch the DEM has averaged away: the ground is lifted by what the DEM
            # rises between here and `reach` out from the cut's edge, fully near the edge and not at
            # all from `reach` on, faded out eastward from fade0 to fade1. The ditch is cut below.
            qx, qy = np.clip(X, x0, x1), np.clip(Y, y0, y1)
            vx, vy = X - qx, Y - qy
            d = np.hypot(vx, vy)
            s = reach / np.maximum(d, 1e-6)
            lift = grid.sample(qx + vx * s, qy + vy * s) - grid.sample(X, Y)
            w = (d > 0) * (1.0 - smoothstep(reach * 0.5, reach, d)) * (1.0 - smoothstep(fade0, fade1, X))
            Z = Z + w * np.maximum(lift, 0.0)
        for x0, x1, y0, y1, floor, bank in self.basins:
            # Dug below the ground, the quay its west side, sloping banks on the other three.
            inside = np.minimum(np.minimum(x1 - X, Y - y0), y1 - Y)
            cap = floor + np.maximum(0.0, bank - inside) * (4.0 / bank)
            Z = np.where((X >= x0 - 2.0) & (inside > 0.0), np.minimum(Z, cap), Z)
        for x0, x1, y0, y1, floor in self.cuts:
            # A ditch's floor is the level bedrock it was cut to: dug where the ground stands above it
            # and filled where GLO-30's 30 m cells sag below it (by two metres round the Sphinx's paws,
            # which left the statue standing on air), and carried three metres on past its open east
            # side so it meets the temple's floor without a step.
            inside = np.minimum(np.minimum(X - x0, x1 - X), np.minimum(Y - y0, y1 - Y))
            level = floor + 0.02 * self.noise.fbm(X, Y, 8.0, 2, key=4)
            Z = np.where(inside > 0.0, level, Z)
            east = (X >= x1) & (X < x1 + 3.0) & (Y > y0) & (Y < y1)
            Z = np.where(east, np.maximum(Z, level), Z)
        if self.sand is not None and not far:
            s = self.sand
            t = smoothstep(s["x_top"], s["x_bottom"], X)
            fill = s["z_top"] * (1 - t) + s["z_bottom"] * t + 0.6 * self.noise.fbm(X, Y, 25.0, 3, key=5)
            # Fade the drift out past its edges so it meets the ground it lies on.
            edge = np.minimum(np.minimum(X - s["x_west"], s["x_bottom"] + 40.0 - X), np.minimum(Y - s["y0"], s["y1"] - Y))
            w = smoothstep(0.0, s["margin"], edge)
            Z = np.maximum(Z, Z * (1 - w) + fill * w)
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
        # Beyond the far grid, a plain out to HORIZON at the grid's median edge height, tucked two metres
        # under its rim, so an aerial view's horizon is hazed ground rather than the edge of the grid or the
        # sky model's lower half (Blender 5.1's multiple-scattering sky takes no direction to clamp).
        edge = np.concatenate([self.z(f, np.full_like(f, s * FAR_HALF), far=True) for s in (-1, 1)] +
                              [self.z(np.full_like(f, s * FAR_HALF), f, far=True) for s in (-1, 1)])
        zr = float(np.median(edge)) - 2.8
        # Its inner rim follows the grid's own edge, a few metres under it, and rises or falls to the plain
        # over the next few kilometres: at one height all round, the plain stood 28 m over the valley on the
        # north edge, and the rays that passed under its lip met nothing, a black line across aerial views.
        a, m, b = FAR_HALF - 300.0, FAR_HALF + 3000.0, HORIZON
        k = int(round(2 * a / 300.0))
        t = np.linspace(-1.0, 1.0, k + 1, dtype=np.float32)[:-1]
        side = [np.stack([t, -np.ones_like(t)], 1), np.stack([np.ones_like(t), t], 1),
                np.stack([-t, np.ones_like(t)], 1), np.stack([-np.ones_like(t), -t], 1)]
        unit = np.concatenate(side)                        # the square's perimeter, counter-clockwise
        zi = self.z(unit[:, 0] * a, unit[:, 1] * a, far=True) - 0.8 - 2.8
        n = len(unit)
        verts = [(float(u[0] * a), float(u[1] * a), float(z)) for u, z in zip(unit, zi)]
        verts += [(float(u[0] * m), float(u[1] * m), zr) for u in unit]
        verts += [(float(u[0] * b), float(u[1] * b), zr) for u in unit]
        faces = [(r * n + i, (r + 1) * n + i, (r + 1) * n + (i + 1) % n, r * n + (i + 1) % n) for r in (0, 1) for i in range(n)]
        me = bpy.data.meshes.new("ground horizon")
        me.from_pydata(verts, [], faces)
        me.materials.append(material)
        ring = bpy.data.objects.new("ground horizon", me)
        coll.objects.link(ring)
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
