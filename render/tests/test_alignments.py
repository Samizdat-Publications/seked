"""Plain-Python checks of render/alignments.py's bpy-free parts: python -m unittest discover render/tests"""
import io
import json
import math
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from giza import data  # noqa: E402
from giza.alignments import compose, lines, project  # noqa: E402

BAKE = os.path.join(data.REPO, "build", "sky-bake.json")


def camera(**kw):
    p = dict(type="PERSP", location=[0.0, 0.0, 0.0], matrix=np.eye(3).tolist(), lens=36.0, sensor_width=36.0,
             shift_x=0.0, shift_y=0.0, ortho_scale=100.0, size=[1920, 1080])
    p.update(kw)
    return project.Camera(p)


class ProjectionTests(unittest.TestCase):
    def test_the_axis_lands_on_the_centre_and_a_known_angle_where_the_lens_puts_it(self):
        cam = camera()                                        # looking down -Z, a 36 mm lens on a 36 mm sensor
        u, v = cam.project((0.0, 0.0, -10.0))
        self.assertAlmostEqual(u, 960.0)
        self.assertAlmostEqual(v, 540.0)
        # 45 degrees off the axis is half the sensor width off the centre times two: one full width.
        u, v = cam.project((10.0, 0.0, -10.0))
        self.assertAlmostEqual(u, 960.0 + 1920.0)
        u, v = cam.project((0.0, 5.0, -10.0))
        self.assertAlmostEqual(v, 540.0 - 960.0)
        self.assertIsNone(cam.project((0.0, 0.0, 10.0)))

    def test_a_shift_moves_the_picture_the_other_way(self):
        cam = camera(shift_y=0.1)
        self.assertAlmostEqual(cam.project((0.0, 0.0, -10.0))[1], 540.0 + 192.0)

    def test_a_direction_lands_where_a_far_point_along_it_does(self):
        m = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float).T    # looking north, level, +Z up
        cam = camera(matrix=m.tolist(), location=[5.0, 7.0, 2.0])
        d = project.direction(10.0, 5.0)
        far = cam.project(np.array([5.0, 7.0, 2.0]) + 1.0e6 * d)
        near = cam.project_direction(d)
        self.assertAlmostEqual(far[0], near[0], places=3)
        self.assertAlmostEqual(far[1], near[1], places=3)
        az, alt = project.az_alt(d)
        self.assertAlmostEqual(az, 10.0)
        self.assertAlmostEqual(alt, 5.0)

    def test_orthographic_scale_spans_the_longer_side(self):
        cam = camera(type="ORTHO", location=[0.0, 0.0, 100.0], ortho_scale=1920.0)
        self.assertAlmostEqual(cam.project((100.0, 50.0, 0.0))[0], 960.0 + 100.0)
        self.assertAlmostEqual(cam.project((100.0, 50.0, 0.0))[1], 540.0 - 50.0)


class FitTests(unittest.TestCase):
    def test_a_similarity_is_recovered_exactly(self):
        src = np.array([[1.0, -0.8], [0.0, 0.0], [-1.0, 0.9]])
        a = math.radians(33.0)
        r = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])
        dst = (250.0 * (r @ (src * [-1.0, 1.0]).T)).T + [10.0, -20.0]
        fit = project.fit_similarity(src, dst)
        self.assertTrue(fit["mirror"])
        self.assertAlmostEqual(fit["scale"], 250.0, places=6)
        self.assertAlmostEqual(fit["rotation_deg"], 33.0, places=6)
        self.assertLess(fit["rms"], 1e-9)

    def test_the_belt_fits_the_pyramids_best_laid_as_it_is_seen(self):
        with io.open(BAKE, encoding="utf-8") as f:
            c4 = json.load(f)["alignments"]["c4"]
        src = [[p["x"], p["y"]] for p in c4["pairs"]]
        dst = [[data.PYRAMIDS[p["ground"]]["cx"], data.PYRAMIDS[p["ground"]]["cy"]] for p in c4["pairs"]]
        seen = project.fit_similarity(src, dst)
        plain = project.fit_similarity(src, dst, allow_mirror=False)
        self.assertTrue(seen["mirror"])
        self.assertLess(seen["rms"], plain["rms"])
        # Turned from lying north to south by the gap between the belt's angle and the diagonal's.
        angle = next(c for c in c4["comparisons"] if c["unit"] == "deg")
        turn = (seen["rotation_deg"] + 180.0 + 540.0) % 360.0 - 180.0
        self.assertAlmostEqual(abs(turn), abs(angle["value"] - angle["target"]), delta=1.5)


class ShaftTests(unittest.TestCase):
    def setUp(self):
        self.v = project.resolved()

    def test_every_shaft_runs_out_on_its_measured_slope_and_the_kings_reach_the_face(self):
        half = self.v["g1.base.side.mean"] / 2.0
        cot = 1.0 / math.tan(math.radians(self.v["g1.face.angle"]))
        for base in ("kc.shaft.south", "kc.shaft.north", "qc.shaft.south", "qc.shaft.north"):
            r = project.shaft_route(self.v, base)
            self.assertAlmostEqual(r["angle"], self.v[base + ".angle"], places=6, msg=base)
            self.assertEqual(r["bearing"], 180.0 if base.endswith("south") else 0.0)
            end = r["points"][-1]
            if base.startswith("kc"):
                self.assertTrue(r["exits"])
                self.assertAlmostEqual(abs(end[1]) + end[2] * cot, half, places=6, msg=base)
            else:
                self.assertFalse(r["exits"])
                self.assertLess(abs(end[1]) + end[2] * cot, half)

    def test_the_solved_epochs_are_read_from_docs_shafts(self):
        e = compose.shaft_epochs()
        self.assertIn("Alnitak", e)
        self.assertEqual(len(e["Thuban"]), 2)
        for rows in e.values():
            for text, culmination in rows:
                self.assertRegex(text, r"^\d[\d,]* BCE$")
                self.assertIn(culmination, ("upper", "lower"))


class WordsTests(unittest.TestCase):
    def test_angles_and_years(self):
        self.assertEqual(compose.dm(45.2033), "45°12′")
        self.assertEqual(compose.dm(-12.5647), "−12°34′")
        self.assertEqual(compose.dm(0.004), "0°00′")
        self.assertEqual(compose.year(-10449), "10,450 BCE")
        self.assertEqual(compose.year(-2449), "2450 BCE")
        self.assertEqual(compose.minutes_of(-12.56), "50 minutes")
        self.assertEqual(compose.minutes_of(73.62), "4 h 54 min")


class LinesTests(unittest.TestCase):
    def test_the_figures_are_imported_with_their_source_and_every_star_is_in_the_catalogue(self):
        doc = lines.load()
        self.assertIn("Stellarium", doc["source"])
        self.assertIn("CC BY-SA", doc["licence"])
        cat = data.load_json(data.DATA, "stars", "hyg-bright.json")
        have = {row[0] for row in cat["stars"]}
        for abbr in ("Leo", "Tau", "Ori", "CMa", "UMi", "Dra", "Lyr", "Cen"):
            self.assertIn(abbr, doc["figures"])
            self.assertGreater(len(doc["figures"][abbr]["segments"]), 2)
        for fig in doc["figures"].values():
            for a, b in fig["segments"]:
                self.assertIn(a, have)
                self.assertIn(b, have)


@unittest.skipUnless(os.path.exists(BAKE), "no sky bake: pnpm run sky-bake")
class ViewsTests(unittest.TestCase):
    def test_every_view_stands_under_a_baked_sky_or_a_day_moment(self):
        with io.open(BAKE, encoding="utf-8") as f:
            bake = json.load(f)
        skies = set(bake["nights"]) | set(bake.get("alignments", {}).get("skies", {}))
        views = data.load_json(data.RENDER, "alignments.json")
        for vid, v in views["views"].items():
            if "sky" in v:
                self.assertIn(v["sky"], skies, vid)
            else:
                self.assertIn("moment", v, vid)
            self.assertIn(v["era"], ("first-time", "lion", "built", "stripped", "today"))
        for tag in views["portholes"]["era"]:
            self.assertIn(tag, bake["alignments"]["c2"]["shafts"][0]["at"])


if __name__ == "__main__":
    unittest.main()
