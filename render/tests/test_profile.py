"""Plain-Python checks of render/giza/profile.py: python -m unittest discover -s render/tests"""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from giza import profile as P  # noqa: E402


def head(points=40000, seed=3):
    """A bust whose face looks along +x: (fwd, across, z). Its front, by height: the chest 2.0 at the foot,
    the throat 1.0 at z 3, the chin's underside at z 4, the chin 2.6, the lips 2.4 at z 5, the nose 3.0 at z 6,
    the brow 2.5 at z 7, and the crown at z 10, rounding back to 0."""
    rng = np.random.default_rng(seed)
    z = rng.uniform(0.0, 10.0, points)
    across = rng.uniform(-2.0, 2.0, points)
    knots_z = [0.0, 3.0, 3.9, 4.1, 4.5, 5.0, 6.0, 7.0, 9.0, 10.0]
    knots_f = [2.0, 1.0, 1.2, 2.5, 2.6, 2.4, 3.0, 2.5, 1.5, 0.0]
    front = np.interp(z, knots_z, knots_f)
    fwd = front - rng.uniform(0.0, 3.0, points) * (rng.random(points) > 0.2)   # most points behind the front
    return fwd, across, z


class ChinToCrownTests(unittest.TestCase):
    def test_finds_the_chin_and_the_crown(self):
        chin, crown = P.chin_to_crown(*head())
        self.assertAlmostEqual(crown, 10.0, delta=0.01)
        self.assertAlmostEqual(chin, 4.0, delta=0.2)

    def test_scales_with_the_head(self):
        fwd, across, z = head()
        chin, crown = P.chin_to_crown(fwd * 2.5, across * 2.5, z * 2.5 + 7.0)
        self.assertAlmostEqual(crown - chin, 2.5 * 6.0, delta=0.5)

    def test_the_sides_of_the_head_do_not_count(self):
        fwd, across, z = head()
        # a lappet far out to the side, standing well forward at the throat's height
        side = (np.abs(across) > 1.6) & (z > 2.5) & (z < 3.5)
        fwd = np.where(side, 2.8, fwd)
        chin, _ = P.chin_to_crown(fwd, across, z)
        self.assertAlmostEqual(chin, 4.0, delta=0.2)


if __name__ == "__main__":
    unittest.main()
