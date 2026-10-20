"""Plain-Python checks of render/giza/ghost.py: python -m unittest discover -s render/tests"""
import math
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from giza import ghost as G  # noqa: E402

TARGET = (0.1, -1.2, 0.8)


class GhostOrbitTests(unittest.TestCase):
    def test_passes_through_the_still(self):
        c = G.arc(G.still_t(), TARGET)
        for got, at, off in zip(c["eye"], TARGET, G.LOOK["still_offset"]):
            self.assertAlmostEqual(got - at, off, places=9)

    def test_keeps_its_distance_and_height(self):
        r = math.hypot(*G.LOOK["still_offset"][:2])
        for i in range(11):
            c = G.arc(i / 10, TARGET)
            self.assertAlmostEqual(math.hypot(c["eye"][0] - TARGET[0], c["eye"][1] - TARGET[1]), r, places=9)
            self.assertAlmostEqual(c["eye"][2] - TARGET[2], G.LOOK["still_offset"][2], places=9)
            self.assertEqual(c["at"], TARGET)

    def test_swings_through_the_face(self):
        mid = G.arc(0.5, TARGET)["eye"]
        self.assertAlmostEqual(mid[0], TARGET[0], places=9)
        self.assertLess(mid[1], TARGET[1])          # in front of the face, which looks along -y
        self.assertLess(G.arc(0, TARGET)["eye"][0], TARGET[0])
        self.assertGreater(G.arc(1, TARGET)["eye"][0], TARGET[0])


if __name__ == "__main__":
    unittest.main()
