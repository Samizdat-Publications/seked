"""Plain-Python checks of the valley's field layout (render/giza/fields.py): python -m unittest discover render/tests"""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from giza import fields  # noqa: E402


class FieldTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.basins, cls.holdings, cls.ids = fields.layout()
        cls.frame = fields.frame()

    def test_the_holdings_tile_the_map_once(self):
        _, _, nu, nv = self.frame
        count = np.zeros((nv, nu), np.int32)
        for i0, i1, j0, j1 in self.holdings:
            count[j0:j1, i0:i1] += 1
        self.assertTrue(np.all(count == 1))

    def test_no_holding_is_narrower_than_the_least(self):
        least = round(fields.LEAST / fields.PIXEL)
        for i0, i1, j0, j1 in self.holdings:
            self.assertGreaterEqual(min(i1 - i0, j1 - j0), least)

    def test_every_holding_lies_in_one_basin(self):
        for i0, i1, j0, j1 in self.holdings[::37]:
            inside = [b for b in self.basins if b[0] <= i0 and i1 <= b[1] and b[2] <= j0 and j1 <= b[3]]
            self.assertEqual(len(inside), 1)

    def test_the_map_puts_the_canals_on_the_basins_edges(self):
        img = fields.raster()
        i0, i1, j0, j1 = self.basins[len(self.basins) // 2]
        self.assertEqual(img[j0 + 5, i0, 2], 0)
        self.assertEqual(img[j0, i0 + 5, 2], 0)
        mid = img[(j0 + j1) // 2, (i0 + i1) // 2, 2]
        want = min(min(i1 - i0, j1 - j0) // 2 * fields.PIXEL, 255 * fields.B_STEP)
        self.assertAlmostEqual(mid * fields.B_STEP, want, delta=fields.PIXEL)

    def test_the_frame_round_trips(self):
        x, y = np.array([500.0, 2000.0]), np.array([-900.0, 1200.0])
        u, v = fields.to_field(x, y)
        x2, y2 = fields.to_world(u, v)
        np.testing.assert_allclose(x2, x, atol=1e-9)
        np.testing.assert_allclose(y2, y, atol=1e-9)

    def test_palms_stand_on_an_edge_or_beside_a_canal(self):
        x, y = fields.palms(np.random.default_rng(3), 0.2, (7.0, 10.0), (430.0, 2600.0, -2000.0, 1500.0))
        self.assertGreater(len(x), 500)
        img = fields.raster()
        u, v = fields.to_field(x, y)
        du, dv = fields.warp(u, v)
        u, v = u + du, v + dv
        u0, v0, nu, nv = self.frame
        i = np.round((u - u0) / fields.PIXEL).astype(int) % nu
        j = np.round((v - v0) / fields.PIXEL).astype(int) % nv
        d_hold = img[j, i, 1] * fields.G_STEP
        d_canal = img[j, i, 2] * fields.B_STEP
        off = np.minimum(d_hold, np.abs(d_canal - (fields.CANAL + 2.2)))
        self.assertLess(np.quantile(off, 0.99), 3.5)


if __name__ == "__main__":
    unittest.main()
