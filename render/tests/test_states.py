"""Plain-Python checks of render/giza/states.py: python -m unittest discover -s render/tests"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from giza import data, states  # noqa: E402


class PyramidTests(unittest.TestCase):
    def test_no_pyramid_stands_before_they_were_built(self):
        # The claim as its proponents make it (docs/rethink-2026-10.md): the Sphinx, its temples and the plan
        # in 10,500 BCE, the pyramids c. 2500 BCE to that plan.
        for name in states.ORDER:
            S = states.STATES[name]
            if S["year"] < -2600:
                self.assertIsNone(S["pyramids"], name)
                self.assertIsNone(S["caps"], name)
                self.assertNotIn("gild", S, name)

    def test_how_much_of_a_pyramid_stands_in_each_era(self):
        g1 = data.PYRAMIDS["g1"]
        self.assertEqual(states.pyramid_height(g1, "first-time"), 0.0)
        self.assertEqual(states.pyramid_height(g1, "lion"), 0.0)
        self.assertEqual(states.pyramid_height(g1, "built"), g1["H"])
        self.assertEqual(states.pyramid_height(g1, "stripped"), g1["today"])
        self.assertEqual(states.pyramid_height(g1, "today"), g1["today"])

    def test_the_claim_eras_are_labelled_a_claim(self):
        for name in ("first-time", "lion"):
            self.assertEqual(states.STATES[name]["honesty"], "claim")


if __name__ == "__main__":
    unittest.main()
