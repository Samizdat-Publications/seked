import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from giza import labyrinth as LB  # noqa: E402


class LabyrinthPlan(unittest.TestCase):
    def setUp(self):
        self.p = LB.plan()

    def test_twelve_courts_six_either_side_of_the_avenue(self):
        courts = self.p["courts"]
        self.assertEqual(len(courts), 12)
        self.assertEqual(sum(c["half"] == "west" for c in courts), 6)
        av = (self.p["frame"]["X"](LB.PLAN["avenue"][0]) + self.p["frame"]["X"](LB.PLAN["avenue"][1])) / 2
        for c in courts:
            x0, x1 = c["box"][:2]
            self.assertTrue(x1 <= av if c["half"] == "west" else x0 >= av)
            # each court's door is on the avenue
            self.assertLess(abs(c["door"][0] - av), 6.0)

    def test_everything_stands_on_petries_chip_bed(self):
        x0, x1, y0, y1 = self.p["frame"]["bed"]
        for w in self.p["walls"]:
            bx0, bx1, by0, by1 = w["box"][:4]
            if w["kind"] == "gate":
                continue                       # the gatehouses stand out from the wall
            self.assertGreaterEqual(bx0, x0 - 2.0)
            self.assertLessEqual(bx1, x1 + 2.0)
            self.assertGreaterEqual(by0, y0 - 2.0)
            self.assertLessEqual(by1, y1 + 2.0)

    def test_the_bed_is_the_pyramids_south_neighbour(self):
        x0, x1, y0, y1 = self.p["frame"]["bed"]
        pyr = self.p["frame"]["pyramid"]
        self.assertAlmostEqual(y1, pyr["cy"] - pyr["half"])
        self.assertAlmostEqual(x1 - x0, 304.8, places=3)
        self.assertAlmostEqual(y1 - y0, 243.84, places=3)

    def test_the_outer_wall_has_four_gates(self):
        outer = [w for w in self.p["walls"] if w["kind"] == "outer"]
        self.assertEqual(len(outer), 8)       # each side in two pieces either side of its gate

    def test_hundreds_of_rooms_and_columns(self):
        self.assertGreater(sum(c["rooms"] for c in self.p["courts"]), 300)
        self.assertGreater(len(self.p["columns"]), 500)
        self.assertEqual(len(self.p["chapels"]), 24)

    def test_boxes_mesh_counts(self):
        v, f = LB.boxes_mesh([(0, 1, 0, 1, 0, 1), (2, 3, 2, 3, 0, 2)])
        self.assertEqual(v.shape, (16, 3))
        self.assertEqual(f.shape, (12, 4))


if __name__ == "__main__":
    unittest.main()
