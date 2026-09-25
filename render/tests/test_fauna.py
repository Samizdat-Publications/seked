"""Plain-Python checks that render/giza/fauna.py, blender/models.json and the terrain agree: python -m unittest discover render/tests"""
import io
import json
import math
import os
import sys
import types
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from giza import data, fauna as F, states  # noqa: E402

# terrain.py and water.py import bpy for building meshes, but their heights and levels are numpy
# and plain numbers: read them with a stand-in bpy, then take it away so no other test sees it.
_stub = "bpy" not in sys.modules
if _stub:
    sys.modules["bpy"] = types.ModuleType("bpy")
try:
    from giza import terrain, water  # noqa: E402,F401
finally:
    if _stub:
        del sys.modules["bpy"]

SAVANNA = {"giraffe", "elephant", "gazelle", "oryx", "addax", "hartebeest", "ostrich", "buffalo", "hippo"}
ANTELOPE = {"gazelle", "oryx", "addax", "hartebeest"}


def ground(era):
    """The scene's terrain for an era (the pyramids flattened, the valley's flood plain), without its temples' flats."""
    feet = [(P["cx"], P["cy"], P["half"], P["base"]) for P in data.PYRAMIDS.values()]
    t = terrain.Terrain(era, feet)
    return lambda x, y: t.z(np.asarray(x, np.float32), np.asarray(y, np.float32))


class FaunaTests(unittest.TestCase):
    def setUp(self):
        with io.open(F.MANIFEST, encoding="utf-8") as f:
            self.manifest = json.load(f)
        self.animals = F.manifest_animals()

    def test_every_variant_comes_from_a_recorded_model(self):
        for name, spec in F.VARIANTS.items():
            mid = spec["model"]
            self.assertIn(mid, F.MODELS, name)
            self.assertIn(mid, self.animals, f"{name}: {mid} is not under `animals` in blender/models.json")
            model = self.animals[mid]
            for key in ("name", "author", "url", "license", "attribution", "why"):
                self.assertTrue(model.get(key), f"{mid} has no {key}")
            self.assertTrue(model.get("sketchfab") or model.get("meshy"), f"{mid} says neither where it downloads nor how it was made")
            if "meshy" in model:
                self.assertLessEqual(len(model["meshy"]["prompt"]), 800, mid)       # Meshy's limit

    def test_every_model_has_a_size_and_a_facing(self):
        for mid, look in F.MODELS.items():
            self.assertTrue(0.8 <= look["height"] <= 5.5, mid)
            turn = look["turn"]
            self.assertTrue(isinstance(turn, (int, float)) or turn in ("axis+x", "axis-x", "axis+y", "axis-y"), mid)

    def test_every_era_holds_the_variants_its_herds_need(self):
        for era, wanted in F.ERAS.items():
            self.assertIn(era, states.STATES)
            for v in wanted:
                self.assertIn(v, F.VARIANTS, era)
            for h in F.herds(era):
                for kind in h.kinds:
                    self.assertIn(kind, F.KINDS, era)
                    self.assertTrue(set(F.KINDS[kind]["variants"]) & set(wanted), f"{era}: no variant of {kind} in its library")

    def test_the_kinds_belong_to_their_eras(self):
        kinds = {era: {k for h in F.herds(era) for k in h.kinds} for era in F.HERDS}
        for era in ("first-time", "lion"):
            self.assertTrue(kinds[era] <= SAVANNA, era)
            for need in ("giraffe", "elephant", "ostrich"):
                self.assertIn(need, kinds[era], era)
            self.assertTrue(kinds[era] & ANTELOPE, era)
        self.assertEqual(kinds["built"], {"cattle", "donkey", "goat"})
        self.assertTrue(kinds["today"] <= {"camel", "horse", "cart"} and {"camel", "horse", "cart"} <= kinds["today"])

    def test_animals_stay_out_of_the_stand_ins(self):
        # render_standins and export_web fit every entry under `models` to a footprint; an animal has none.
        stand_ins = {m["id"] for m in self.manifest["models"]}
        figures = {m["id"] for m in self.manifest.get("figures", [])}
        self.assertFalse(stand_ins & set(self.animals))
        self.assertFalse(figures & set(self.animals))

    def test_herds_are_within_the_near_ground_and_sensible(self):
        x0, x1, y0, y1 = terrain.NEAR_BOX
        for era in F.HERDS:
            for h in F.herds(era):
                self.assertTrue(x0 + 100 < h.x < x1 - 100 and y0 + 100 < h.y < y1 - 100, (era, h))
                self.assertTrue(0 < h.half_w <= 80 and 0 < h.half_d <= 80 and 1 <= h.count <= 30, (era, h))

    def test_every_herd_finds_ground_to_stand_on(self):
        # Most of each herd must stand: out of the water, off the monuments, clear of the stations, on ground not too steep.
        for era in F.HERDS:
            planned = F.plan(era, list(F.ERAS[era]), surface=ground(era))
            self.assertIsNotNone(planned, era)
            pos, rot, scl, var, tone, herd = planned
            for i, h in enumerate(F.herds(era)):
                got = int((herd == i).sum())
                self.assertGreaterEqual(got, math.ceil(0.7 * h.count), f"{era} herd {i} at ({h.x:.0f}, {h.y:.0f}): {got} of {h.count} placed")

    def test_no_animal_stands_in_water_or_on_a_station(self):
        # A kind with a `water` range (the hippopotamus) stands in the shallows, and only there.
        stations = F._stations()
        for era in F.HERDS:
            surface = ground(era)
            names = list(F.ERAS[era])
            pos, rot, scl, var, tone, herd = F.plan(era, names, surface=surface)
            z = surface(pos[:, 0], pos[:, 1])
            swims = np.array([bool(F.KINDS[F._kind_of(names[v])].get("water")) for v in var])
            for level, (x0, x1, y0, y1) in F._water(era):
                inside = (pos[:, 0] > x0) & (pos[:, 0] < x1) & (pos[:, 1] > y0) & (pos[:, 1] < y1)
                self.assertFalse(np.any(inside & (z < level + 0.2) & ~swims), era)
                self.assertTrue(np.all(inside[swims] & (z[swims] < level - 0.3)), era)
            for sx, sy in stations:
                self.assertTrue(np.all(np.hypot(pos[:, 0] - sx, pos[:, 1] - sy) >= F.STATION_CLEAR), (era, sx, sy))

    def test_no_animal_stands_in_a_house(self):
        for era in ("stripped", "today"):
            names = list(F.ERAS[era])
            pos, *_ = F.plan(era, names, surface=ground(era))
            houses = F._buildings(era, [(h.x, h.y) for h in F.herds(era)])
            self.assertFalse(any(F._in_building(x, y, houses, pad=0.0) for x, y, _ in pos), era)

    def test_the_plan_is_repeatable(self):
        a = F.plan("today", list(F.ERAS["today"]), surface=ground("today"))
        b = F.plan("today", list(F.ERAS["today"]), surface=ground("today"))
        for x, y in zip(a, b):
            np.testing.assert_array_equal(x, y)

    def test_an_era_without_animals_has_no_library(self):
        self.assertIsNone(F.library(None, "no-such-era"))
        self.assertEqual(F.herds("no-such-era"), [])


if __name__ == "__main__":
    unittest.main()
