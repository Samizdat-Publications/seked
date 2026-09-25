"""Plain-Python checks of render/giza/vegetation.py's masks and scatter: python -m unittest discover render/tests"""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from giza import data, vegetation as V  # noqa: E402

FLOOD = [(-42.6, (416.0, 11500.0, -11500.0, 11500.0))]     # render/giza/water.py's LEVELS["flood"]
HEIGHTS = {"date-palm": [11.6, 14.5, 17.2, 20.5], "doum-palm": [9.4, 11.5, 13.8], "acacia": [3.7, 3.3], "tree": [5.0],
           "shrub": [1.7, 1.2, 1.2, 1.2], "bush": [1.4, 1.2, 1.9], "papyrus": [3.3, 3.3, 3.3], "reed": [2.6, 2.6, 2.6],
           "tussock": [0.8, 0.9, 1.0, 1.1], "grass": [0.3] * 4 + [0.55] * 4 + [1.0] * 2}


class Ground:
    """The GLO-30 surface with the pyramids' squares, as the scene's Terrain gives it, without the invented relief."""

    def __init__(self, state):
        self.footprints = [(P["cx"], P["cy"], P["half"], P["base"]) for P in data.PYRAMIDS.values()]
        self.cuts = []

    def z(self, X, Y, far=False):
        return (data.FAR if far else data.NEAR).sample(X, Y) + data.TERRAIN_SHIFT

    def surface(self, x, y):
        return self.z(np.asarray(x, np.float32), np.asarray(y, np.float32))


def planted(state, box, water=()):
    g = Ground(state)
    grid = V.near_grid(state, g, box=box, water=list(water))
    return grid, V.plan(state, g, HEIGHTS, grid=grid, far=V.far_grid(state, g, water=list(water)), box=box)


class VegetationTests(unittest.TestCase):
    def test_the_desert_eras_plant_nothing_on_the_plateau(self):
        box = (-400.0, 900.0, -700.0, 100.0)
        for state in ("built", "stripped", "today"):
            grid, plan = planted(state, box)
            for kind, (pos, *_) in plan.items():
                z = grid.at(grid.Z, pos[:, 0], pos[:, 1])
                self.assertFalse((z > -25.0).any(), f"{state}: {kind} on the plateau")

    def test_nothing_stands_on_a_pyramid_or_its_apron(self):
        grid, plan = planted("first-time", (-560.0, -100.0, -600.0, -100.0))
        self.assertIn("tussock", plan)
        for kind, (pos, *_) in plan.items():
            for P in data.PYRAMIDS.values():
                d = np.hypot(np.maximum(np.abs(pos[:, 0] - P["cx"]) - P["half"], 0.0),
                             np.maximum(np.abs(pos[:, 1] - P["cy"]) - P["half"], 0.0))
                # 2.5 m of slack: the masks live on the 4 m nodes and are interpolated between them
                self.assertTrue((d > V.APRON["pyramid"] + V.KINDS[kind]["margin"] - 2.5).all(), f"{kind} at {d.min():.1f} m")

    def test_the_lion_is_barer_than_the_first_time(self):
        box = (-1100.0, -500.0, -300.0, 300.0)
        green, _ = planted("first-time", box)
        dry, _ = planted("lion", box)
        plateau = green.lowland < 0.5
        self.assertLess(dry.cover[plateau].mean(), green.cover[plateau].mean() - 0.15)

    def test_papyrus_stands_on_the_shore(self):
        grid, plan = planted("first-time", (600.0, 1100.0, -600.0, -100.0), FLOOD)
        pos = plan["papyrus"][0]
        z = grid.at(grid.Z, pos[:, 0], pos[:, 1])
        level = FLOOD[0][0]
        self.assertGreater(len(z), 100)
        self.assertTrue(((z > level - 0.5) & (z < level + 0.85)).all())

    def test_tufts_thin_with_distance_and_stop_at_the_radius(self):
        grid = V.near_grid("first-time", Ground("first-time"), box=(-900.0, -500.0, 100.0, 500.0), water=[])
        x, y, *_ = V.near_plan("first-time", grid, (-700.0, 300.0), HEIGHTS["grass"])
        r = np.hypot(x + 700.0, y - 300.0)
        near = (r < 20).sum() / (np.pi * 20 ** 2)
        far = ((r > 80) & (r < 100)).sum() / (np.pi * (100 ** 2 - 80 ** 2))
        self.assertGreater(near, 5 * far)
        self.assertLess(r.max(), V.NEAR_RADIUS)

    def test_an_unknown_era_grows_nothing(self):
        self.assertEqual(V.recipe("atlantis")["plants"], [])
        self.assertIsNone(V.recipe("atlantis")["near"])
        self.assertEqual(V.ground_tint("today")[1], 0.0)
        self.assertGreater(V.ground_tint("first-time")[1], 0.0)


if __name__ == "__main__":
    unittest.main()
