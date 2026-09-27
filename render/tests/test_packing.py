"""The wall-face packing (render/giza/packing.py): every block inside the face, none overlapping, the face filled."""
import os
import random
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from giza.packing import skyline  # noqa: E402


def overlap(a, b):
    return min(a[1], b[1]) - max(a[0], b[0]) > 1e-6 and min(a[3], b[3]) - max(a[2], b[2]) > 1e-6


class Skyline(unittest.TestCase):
    def check(self, length, height, voids=(), **kw):
        blocks = skyline(length, height, random.Random(3), voids=voids, **kw)
        for s0, s1, z0, z1 in blocks:
            self.assertGreaterEqual(s0, -1e-9)
            self.assertLessEqual(s1, length + 1e-9)
            self.assertGreaterEqual(z0, -1e-9)
            self.assertLessEqual(z1, height + 1e-9)
            self.assertGreater(s1 - s0, 0.0)
            self.assertGreater(z1 - z0, 0.0)
        for i in range(len(blocks)):
            for j in range(i + 1, len(blocks)):
                self.assertFalse(overlap(blocks[i], blocks[j]), (blocks[i], blocks[j]))
        area = sum((s1 - s0) * (z1 - z0) for s0, s1, z0, z1 in blocks)
        empty = sum((b - a) * top for a, b, top in voids)
        self.assertAlmostEqual(area, length * height - empty, places=6)
        return blocks

    def test_fills_a_face(self):
        self.check(37.0, 12.0)

    def test_short_face(self):
        self.check(1.2, 3.0)

    def test_doorway_left_open(self):
        blocks = self.check(40.0, 12.0, voids=[(18.0, 21.0, 5.0)])
        for s0, s1, z0, z1 in blocks:
            self.assertFalse(overlap((s0, s1, z0, z1), (18.0, 21.0, 0.0, 5.0)))

    def test_beds_step(self):
        """Not brickwork: the bed joints stand at many heights, and blocks differ in height."""
        blocks = self.check(60.0, 12.0)
        self.assertGreater(len({round(z0, 3) for _, _, z0, _ in blocks}), 15)
        self.assertGreater(len({round(z1 - z0, 3) for _, _, z0, z1 in blocks}), 15)


if __name__ == "__main__":
    unittest.main()
