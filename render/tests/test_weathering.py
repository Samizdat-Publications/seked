"""Plain-Python checks of render/giza/weathering.py: python -m unittest discover -s render/tests"""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from giza import weathering as W  # noqa: E402

H, L = 20.2, 73.0     # sphinx.height and sphinx.length (arce-sphinx-1991)


class BedTests(unittest.TestCase):
    def test_member_i_is_thicker_at_the_rump_than_at_the_paws(self):
        # 3 m up is still Member I at the rump (3.70 m thick) but Member II at the paws (about 0.87 m)
        self.assertEqual(W.member([0.0], [3.0 / H], H)[0], "I")
        self.assertTrue(W.member([1.0], [3.0 / H], H)[0].startswith("II"))

    def test_member_ii_has_seven_beds_alternating(self):
        u = np.zeros(400)
        z = np.linspace(W.MEMBER_I_TOP[0] + 0.01, W.MEMBER_III_BASE * H - 0.01, 400)
        beds = W.member(u, z / H, H)
        changes = 1 + int(np.sum(beds[1:] != beds[:-1]))
        self.assertEqual(changes, W.MEMBER_II_BEDS)
        self.assertTrue(set(beds) <= {"II-soft", "II-hard"})

    def test_the_head_is_the_hardest_stone(self):
        self.assertEqual(W.member([0.9], [0.95], H)[0], "III-head")
        self.assertEqual(min(W.ERODIBILITY, key=W.ERODIBILITY.get), "III-head")


class RecessionTests(unittest.TestCase):
    def test_the_first_time_is_untouched(self):
        self.assertTrue((W.recession(np.random.rand(50), np.random.rand(50), np.zeros(50), "first-time", H, L) == 0).all())

    def test_every_era_wears_further_than_the_one_before(self):
        u, h, nz = np.full(1, 0.5), np.full(1, 0.3), np.zeros(1)
        depths = [W.recession(u, h, nz, era, H, L)[0] for era in ("lion", "built", "today")]
        self.assertTrue(depths[0] < depths[1] < depths[2])

    def test_today_wears_on_from_as_built_by_the_difference_and_never_back(self):
        u, h, nz = np.random.rand(200), np.random.rand(200), np.random.uniform(-1, 1, 200)
        more = W.further(u, h, nz, "built", "today", H, L)
        built, today = (W.recession(u, h, nz, era, H, L) for era in ("built", "today"))
        self.assertTrue((more >= 0).all())
        np.testing.assert_allclose(built + more, today)

    def test_the_masonry_cases_the_foot_and_not_the_head(self):
        u = np.array([0.0, 0.0, 1.0, 1.0, 0.9])
        z = np.array([W.MEMBER_I_TOP[0] + 1.0, W.MEMBER_I_TOP[0] + 2.0, 1.0, 3.0, 18.0])
        self.assertEqual(W.masonry(u, z / H, H).tolist(), [True, False, True, False, False])

    def test_a_soft_bed_recedes_further_than_a_hard_one(self):
        z = np.linspace(W.MEMBER_I_TOP[1] + 0.01, W.MEMBER_III_BASE * H - 0.01, 400)
        u = np.full(z.shape, 0.5)
        beds = W.member(u, z / H, H)
        d = W.recession(u, z / H, np.zeros(z.shape), "lion", H, L, seed=1)
        self.assertGreater(np.median(d[beds == "II-soft"]), np.median(d[beds == "II-hard"]))

    def test_the_joints_open_widest_at_the_top_and_spare_the_head(self):
        at = W.joints(L)[2]
        u = np.array([at / L, at / L])
        low, high = W.recession(u, np.array([0.1, 0.55]), np.zeros(2), "lion", H, L)
        plain = W.recession(u + 0.02, np.array([0.1, 0.55]), np.zeros(2), "lion", H, L)
        self.assertGreater(high - plain[1], low - plain[0])
        head = W.recession(np.array([at / L]), np.array([0.9]), np.zeros(1), "lion", H, L)[0]
        self.assertAlmostEqual(head, W.ERA_DEPTH["lion"] * W.ERODIBILITY["III-head"] * W.exposure(0.0))

    def test_an_overhang_wears_less_than_a_flank_and_a_flank_less_than_a_top(self):
        e = W.exposure(np.array([-1.0, 0.0, 1.0]))
        self.assertTrue(e[0] < e[1] < e[2])


if __name__ == "__main__":
    unittest.main()
