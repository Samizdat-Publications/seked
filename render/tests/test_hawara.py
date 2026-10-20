"""Plain-Python checks of render/giza/hawara.py: python -m unittest discover -s render/tests"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from giza import data, hawara as W  # noqa: E402

INCH = 0.0254


class PetrieTests(unittest.TestCase):
    def test_reproduces_petries_finished_base_and_height(self):
        f = W.figures()
        self.assertAlmostEqual(f["side"] / INCH, 4006.0, places=6)
        self.assertLess(abs(f["height"] / INCH - 2284.0), 1.0)

    def test_the_chip_bed_is_about_one_and_a_half_khufu_bases_and_the_pyramid_smaller_than_menkaure(self):
        r = W.ratios()
        self.assertTrue(1.35 < r["bed_over_khufu_base"] < 1.45, r)
        self.assertLess(r["side_over_menkaure"], 1.0)
        self.assertAlmostEqual(r["side_over_khufu"], 4006 * INCH / 230.33, places=6)


class LayoutTests(unittest.TestCase):
    def test_the_group_lies_south_of_khufu_in_its_own_arrangement(self):
        g = W.laid_on_giza()
        g1 = data.PYRAMIDS["g1"]
        p, (x0, x1, y0, y1) = g["pyramid"], g["bed"]
        self.assertAlmostEqual(g1["cy"] - g1["half"] - (p["cy"] + p["half"]), W.LAYOUT["gap"])
        self.assertAlmostEqual(y1, p["cy"] - p["half"])               # the chip bed south of its pyramid
        self.assertAlmostEqual(x1 - x0, W.figures()["bed_length"])     # long side east-west, as stated
        self.assertAlmostEqual((x0 + x1) / 2, p["cx"])

    def test_the_chip_bed_misses_khafres_pyramid(self):
        x0, x1, y0, y1 = W.laid_on_giza()["bed"]
        g2 = data.PYRAMIDS["g2"]
        self.assertLess(g2["cx"] + g2["half"], x0)


if __name__ == "__main__":
    unittest.main()
