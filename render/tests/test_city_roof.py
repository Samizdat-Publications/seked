"""render/giza/city.py's roof_at: a station on a roof stands on a building the scene draws, at its recorded height."""
import json
import os
import sys
import types
import unittest

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
_stub = "bpy" not in sys.modules
if _stub:
    sys.modules["bpy"] = types.ModuleType("bpy")
try:
    from giza import city, data  # noqa: E402
finally:
    if _stub:
        del sys.modules["bpy"]


class RoofTests(unittest.TestCase):
    def test_every_roof_station_stands_on_a_drawn_measured_building(self):
        stations = data.load_json(os.path.join(data.REPO, "render"), "stations.json")["stations"]
        roofs = [s for s in stations if s.get("roof")]
        self.assertTrue(roofs)
        for s in roofs:
            r = city.roof_at(s["x"], s["y"])
            self.assertIsNotNone(r, s["id"])
            self.assertTrue(r["measured"], f"{s['id']}: the roof's height should be measured, not the import's look choice")
            h = float(data.city_boxes()[r["record"], 5])
            self.assertEqual(r["height"], max(h, city.MIN_HEIGHT))

    def test_open_ground_has_no_roof(self):
        self.assertIsNone(city.roof_at(0.0, 0.0))          # Khufu's centre: no box is drawn near a pyramid
        self.assertIsNone(city.roof_at(-2900.0, 6000.0))   # out in the desert north-west


if __name__ == "__main__":
    unittest.main()
