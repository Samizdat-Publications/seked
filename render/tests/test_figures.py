"""Plain-Python checks that render/giza/figures.py and blender/models.json agree: python -m unittest discover render/tests"""
import io
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from giza import figures as F, states  # noqa: E402


class FigureTests(unittest.TestCase):
    def setUp(self):
        with io.open(F.MANIFEST, encoding="utf-8") as f:
            self.manifest = json.load(f)
        self.figures = F.manifest_figures()

    def test_every_era_figure_is_generated_from_a_pinned_prompt(self):
        for era, ids in F.ERAS.items():
            self.assertIn(era, states.STATES)
            for fid in ids:
                spec = self.figures[fid]["meshy"]
                self.assertEqual(spec["endpoint"], "text-to-3d", fid)
                self.assertLessEqual(len(spec["prompt"]), 800, fid)       # Meshy's limit
                self.assertTrue(spec.get("task") and spec.get("sha256"), f"{fid} is not pinned")
                for key in ("license", "attribution", "name"):
                    self.assertTrue(self.figures[fid].get(key), f"{fid} has no {key}")

    def test_every_figure_has_a_natural_height_and_a_turn(self):
        for ids in F.ERAS.values():
            for fid in ids:
                look = F.LOOK[fid]
                self.assertTrue(1.5 <= look["height"] <= 1.9, fid)
                self.assertIn("turn", look)

    def test_the_claims_eras_have_no_figures(self):
        for era in ("first-time", "lion"):
            self.assertIsNone(F.library(None, era))

    def test_figures_stay_out_of_the_stand_ins(self):
        # render_standins and export_web fit every entry under `models` to a footprint; a figure has none.
        stand_ins = {m["id"] for m in self.manifest["models"]}
        self.assertFalse(stand_ins & set(self.figures))


if __name__ == "__main__":
    unittest.main()
