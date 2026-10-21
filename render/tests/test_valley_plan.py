"""render/giza/valley_plan.py: the granite hall's plan without bpy, and the statue sockets publish draws from it."""
import importlib.util
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
RENDER = os.path.dirname(HERE)
sys.path.insert(0, RENDER)
from giza import data, valley_plan  # noqa: E402

spec = importlib.util.spec_from_file_location("publish", os.path.join(RENDER, "publish.py"))
publish = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publish)


class ValleyPlan(unittest.TestCase):
    def setUp(self):
        self.r = {x["key"]: x["value"] for x in data.records("khafre-valley-temple.json")}
        self.p = valley_plan.plan()

    def test_it_needs_no_bpy(self):
        self.assertNotIn("bpy", sys.modules)

    def test_the_sockets_step_from_their_records(self):
        n = self.r["khafre_valley_temple.hall.socket.count"]
        self.assertEqual(len(self.p["sockets"]), n)
        steps = [b - a for a, b in zip(self.p["sockets"], self.p["sockets"][1:])]
        for s in steps:
            self.assertAlmostEqual(s, self.r["khafre_valley_temple.hall.socket.pitch"], places=9)

    def test_the_statues_stand_on_the_sockets(self):
        spots = valley_plan.statue_spots(self.p)
        self.assertEqual(len(spots), 23)
        long_hall = spots[:2 * len(self.p["sockets"])]
        self.assertEqual(sorted({round(x, 6) for x, _, _ in long_hall}), sorted(round(x, 6) for x in self.p["sockets"]))
        # one row inside each of the long hall's walls
        self.assertEqual({round(y, 6) for _, y, _ in long_hall}, {round(self.p["y_ls"] + 0.55, 6), round(self.p["y_ln"] - 0.55, 6)})


class SocketOverlay(unittest.TestCase):
    def test_publish_marks_each_statue_spot_on_the_floor(self):
        o = publish.overlays()["valley-sockets"]
        p = valley_plan.plan()
        ticks = [l for l in o["lines"] if l["style"] == "edge"]
        self.assertEqual(len(ticks), 2 * len(p["sockets"]))
        for l in o["lines"]:
            self.assertAlmostEqual(l["from"][2], p["floor"] + 0.02, places=2)
        spots = valley_plan.statue_spots(p)[:len(ticks)]
        for tick, (x, y, _) in zip(ticks, spots):
            self.assertAlmostEqual(tick["from"][0], x, places=2)
            self.assertAlmostEqual((tick["from"][1] + tick["to"][1]) / 2, y, places=2)


if __name__ == "__main__":
    unittest.main()
