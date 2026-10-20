"""Plain-Python checks of render/giza/underground.py: python -m unittest discover -s render/tests"""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from giza import underground as U  # noqa: E402

C, K = U.claim(), U.khafre()


class ClaimTests(unittest.TestCase):
    def test_reads_the_claim_as_entered(self):
        self.assertEqual((C["wells"], C["rows"], C["cubes"], C["zeds"], C["zed_levels"]), (8, 2, 2, 5, 5))
        self.assertEqual((C["bottom"], C["cube"], C["deep"]), (-648.0, 80.0, -2000.0))

    def test_the_wells_stand_in_two_north_south_rows_inside_the_footprint(self):
        ws = U.wells()
        self.assertEqual(len(ws), 8)
        rows = {}
        for w in ws:
            rows.setdefault(w["row"], []).append(w)
        self.assertEqual(len(rows), 2)
        for row in rows.values():
            self.assertEqual(len({round(w["x"], 6) for w in row}), 1)      # one x per row: the row runs north-south
            self.assertEqual(len({round(w["y"], 6) for w in row}), 4)
        for w in ws:
            self.assertLess(abs(w["x"] - K["cx"]) + w["radius"], K["side"] / 2)
            self.assertLess(abs(w["y"] - K["cy"]) + w["radius"], K["side"] / 2)

    def test_the_wells_fall_648_m_below_the_base_at_the_press_diameter(self):
        for w in U.wells():
            self.assertAlmostEqual(w["top"] - w["bottom"], 648.0)
            self.assertEqual(w["top"], K["base"])
            self.assertTrue(C["diameter"][0] <= 2 * w["radius"] <= C["diameter"][1])

    def test_each_cube_takes_four_wells_and_hangs_from_their_feet(self):
        ws, cs = U.wells(), U.cubes()
        self.assertEqual(len(cs), 2)
        for c in cs:
            self.assertEqual(c["side"], 80.0)
            self.assertAlmostEqual(c["z"] + c["side"] / 2, K["base"] - 648.0)
            inside = [w for w in ws if abs(w["x"] - c["x"]) + w["radius"] <= 40 and abs(w["y"] - c["y"]) + w["radius"] <= 40]
            self.assertEqual(len(inside), 4)

    def test_the_cubes_do_not_overlap(self):
        a, b = U.cubes()
        self.assertGreater(max(abs(a["x"] - b["x"]), abs(a["y"] - b["y"])), a["side"])

    def test_the_spiral_descends_at_its_pitch_and_keeps_clear_of_the_well(self):
        w = U.wells()[0]
        h = U.helix(w)
        self.assertAlmostEqual(h[0, 2], w["top"])
        self.assertAlmostEqual(h[-1, 2], w["bottom"])
        self.assertTrue((np.diff(h[:, 2]) < 0).all())
        r = np.hypot(h[:, 0] - w["x"], h[:, 1] - w["y"])
        self.assertTrue(np.allclose(r, w["radius"] + U.LOOK["spiral_gap"] + U.LOOK["spiral_width"] / 2))
        turns = 648.0 / U.LOOK["spiral_pitch"]
        angle = np.unwrap(np.arctan2(h[:, 1] - w["y"], h[:, 0] - w["x"]))
        self.assertAlmostEqual((angle[-1] - angle[0]) / (2 * np.pi), turns, places=6)

    def test_five_zeds_of_five_levels_sit_in_the_pyramid_above_the_burial_chamber(self):
        zs, room = U.zeds(), U.known_rooms()["chamber"]
        self.assertEqual(len(zs), 5)
        for z in zs:
            self.assertEqual(len(z["levels"]), 5)
            lo = z["levels"][0][4]
            top = z["levels"][-1][5] + z["roof"]
            self.assertGreater(lo, room[5])
            self.assertLess(top - K["base"], K["H"])


class ScaleTests(unittest.TestCase):
    def test_the_claimed_depth_is_four_and_a_half_khafres(self):
        parts = U.stack(648.0, K["H"])
        self.assertEqual([p[2] for p in parts[:4]], [1.0] * 4)
        self.assertAlmostEqual(parts[-1][2], 648.0 / K["H"] - 4)
        self.assertAlmostEqual(parts[-1][1], -648.0)
        self.assertAlmostEqual(U.receipts()["heights"], 648.0 / 143.5)

    def test_an_exact_multiple_has_no_sliver(self):
        self.assertEqual(len(U.stack(3 * 100.0, 100.0)), 3)


class KnownRoomTests(unittest.TestCase):
    def test_the_burial_chamber_is_three_metres_down_and_the_claim_216_times_deeper(self):
        room = U.known_rooms()["chamber"]
        self.assertAlmostEqual(room[4] - K["base"], -3.0)
        self.assertAlmostEqual(room[1] - room[0], 14.17066, places=4)
        self.assertAlmostEqual(U.receipts()["times_deepest_room"], 216.0)

    def test_the_descending_passage_meets_the_horizontal_one(self):
        r = U.known_rooms()
        d, h = r["descending"], r["horizontal"]
        self.assertAlmostEqual(d["end"][2], h[4])
        self.assertAlmostEqual(d["end"][1], h[3])
        self.assertLess(h[2], h[3])
        slope = (d["start"][2] - d["end"][2]) / (d["start"][1] - d["end"][1])
        self.assertAlmostEqual(np.degrees(np.arctan(slope)), 26.633333, places=4)


if __name__ == "__main__":
    unittest.main()
