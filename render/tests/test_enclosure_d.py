"""Plain-Python checks of render/giza/enclosure_d.py: python -m unittest discover -s render/tests"""
import math
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from giza import enclosure_d as E  # noqa: E402


class EnclosureDTests(unittest.TestCase):
    def setUp(self):
        self.rec = E.records()
        self.ps = E.pillars(self.rec)

    def test_has_the_pillars_the_paper_counts(self):
        self.assertEqual(len(self.ps), 2 + int(self.rec["pillars.peripheral.count"]))
        central = [p for p in self.ps if p["name"].startswith("central")]
        self.assertEqual(len(central), int(self.rec["pillars.central.count"]))

    def test_central_pillars_stand_their_printed_height_on_their_pedestals(self):
        for p in self.ps[:2]:
            self.assertAlmostEqual(p["height"], self.rec["pillars.central.height"])
            self.assertTrue(0.2 <= p["base"] <= 0.3)
            top = max(v[2] for verts, _ in E.tpillar(p) for v in verts)
            self.assertAlmostEqual(top, p["base"] + p["height"])
        # and they are the tallest stones in the ring
        self.assertGreater(min(p["height"] for p in self.ps[:2]), max(p["height"] for p in self.ps[2:]))

    def test_the_wall_pillars_stand_on_a_ring_round_the_central_pair(self):
        ring = self.ps[2:]
        mx, my = sum(p["x"] for p in ring) / len(ring), sum(p["y"] for p in ring) / len(ring)
        ang = sorted(math.degrees(math.atan2(p["x"] - mx, p["y"] - my)) % 360 for p in ring)
        gaps = [(b - a) for a, b in zip(ang, ang[1:] + [ang[0] + 360])]
        self.assertLess(max(gaps), 90)          # no quarter of the ring is empty
        for p in ring:
            self.assertGreater(math.hypot(p["x"], p["y"]), 3.0)
        # the central pair stand inside the ring, north of its middle, as the plan draws them
        self.assertGreater(min(p["y"] for p in self.ps[:2]) + 0.5, my)

    def test_the_inner_face_spans_about_the_printed_diameter(self):
        w = E.wall(self.rec)
        span = max(E.inner_span(w, 0), E.inner_span(w, 1))
        # "about 14 m", against a plan whose positions carry about half a metre each
        self.assertLess(abs(span - self.rec["diameter.inner.max"]), 1.5, span)
        self.assertAlmostEqual(w["height"], self.rec["wall.height.preserved.min"])

    def test_the_wall_is_a_closed_band_of_quads(self):
        vs, fs = E.wall_mesh(E.wall(self.rec))
        self.assertEqual(len(fs), len(vs))       # four faces a span, four vertices a span
        for f in fs:
            self.assertTrue(all(0 <= i < len(vs) for i in f))

    def test_the_hill_meets_the_wall_at_its_top_and_runs_outward(self):
        w = E.wall(self.rec)
        vs, fs = E.ground_mesh(w)
        n = len(w["outer"])
        self.assertEqual(len(fs), n)
        self.assertTrue(all(v[2] == w["height"] for v in vs))
        self.assertTrue(all(math.hypot(*vs[n + i][:2]) > math.hypot(*vs[i][:2]) for i in range(n)))


    def test_the_orbit_keeps_outside_the_wall_at_eye_height_above_its_top(self):
        w = E.wall(self.rec)
        n = len(w["outer"])
        mx, my = sum(x for x, _ in w["outer"]) / n, sum(y for _, y in w["outer"]) / n
        far = max(math.hypot(x - mx, y - my) for x, y in w["outer"])
        near = min(math.hypot(x - mx, y - my) for x, y in w["outer"])
        for k in range(24):
            o = E.orbit(k / 24, self.rec)
            r = math.hypot(o["eye"][0] - mx, o["eye"][1] - my)
            self.assertGreater(r, near + 1.0)
            self.assertLess(r, far + 5.0)
            self.assertAlmostEqual(o["eye"][2], w["height"] + 1.6)
        self.assertLess(E.orbit(0.0, self.rec)["eye"][1], my)   # it starts in the south

    def test_the_figure_is_as_tall_as_the_look_says_and_stands_on_the_floor(self):
        parts = E.figure_parts(0.0, 0.0, E.LOOK["figure"])
        self.assertAlmostEqual(max(p[4] for p in parts), E.LOOK["figure"])
        self.assertEqual(min(p[3] for p in parts), 0.0)


if __name__ == "__main__":
    unittest.main()
