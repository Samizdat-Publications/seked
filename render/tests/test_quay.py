import os
import random
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from giza import quay  # noqa: E402


class QuayTests(unittest.TestCase):
    def test_only_the_flooded_claim_eras_have_one(self):
        self.assertIsNotNone(quay.outline("first-time"))
        self.assertIsNotNone(quay.outline("lion"))
        for state in ("built", "today"):
            self.assertIsNone(quay.outline(state), state)

    def test_it_runs_round_both_temples_at_their_level(self):
        ring, top, temples = quay.outline("first-time")
        self.assertEqual(len(temples), 2)
        for r in temples:
            for x, y in r:
                self.assertTrue(quay.inside(ring, x, y))
        bases = [f["base"] for f in quay.data.FOOTPRINTS if f["ring"] in temples]
        self.assertTrue(0.0 < top - max(bases) < 0.1)

    def test_no_slab_is_laid_inside_a_temple(self):
        _, _, temples = quay.outline("first-time")
        laid = quay.slabs("first-time", random.Random(1))
        self.assertGreater(len(laid), 300)
        for x, y, *_ in laid:
            self.assertFalse(any(quay.inside(r, x, y) for r in temples))


if __name__ == "__main__":
    unittest.main()
