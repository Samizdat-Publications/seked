"""scripts/exhibit_queue.py: the exhibit's render queue and flights, from its leaves."""
import importlib.util
import math
import os
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
spec = importlib.util.spec_from_file_location("exhibit_queue", os.path.join(REPO, "scripts", "exhibit_queue.py"))
q = importlib.util.module_from_spec(spec)
spec.loader.exec_module(q)


def catmull(points, t):
    """render/build.py's _catmull, without bpy."""
    n = len(points) - 1
    s = min(max(t, 0.0), 1.0) * n
    i = min(int(s), n - 1)
    u = s - i
    p = [points[max(0, min(n, i + k))] for k in (-1, 0, 1, 2)]
    return tuple(0.5 * (2 * p[1][d] + (-p[0][d] + p[2][d]) * u + (2 * p[0][d] - 5 * p[1][d] + 4 * p[2][d] - p[3][d]) * u * u
                        + (-p[0][d] + 3 * p[1][d] - 3 * p[2][d] + p[3][d]) * u ** 3) for d in range(3))


LEAF = {"id": "ch1-a", "station": "sphinx-flank", "era": "today", "moment": "high-noon", "arrive": "cut",
        "view": {"yaw": 285, "pitch": 10, "fov": 70}}


class Panoramas(unittest.TestCase):
    render = q.load("render/stations.json")

    def test_names_the_walkthroughs_own_file_at_the_stations_moment_and_a_new_one_otherwise(self):
        # the same cases leaves.test.ts pins for leafPanorama
        self.assertEqual(q.station_moment(self.render, "sphinx-face", "built"), "equinox-dawn")
        self.assertEqual(q.station_moment(self.render, "sphinx-face", "today"), "sphinx-noon")
        self.assertEqual(q.leaf_panorama({"station": "sphinx-face", "era": "built", "moment": "equinox-dawn"}, self.render), "pano/sphinx-face-built.jpg")
        self.assertEqual(q.leaf_panorama({"station": "sphinx-face", "era": "today", "moment": "equinox-dawn"}, self.render), "pano/sphinx-face-today-equinox-dawn.jpg")
        self.assertIsNone(q.station_moment(self.render, "nowhere", "today"))

    def test_queues_each_missing_panorama_once(self):
        leaves = [dict(LEAF, id="ch1-a"), dict(LEAF, id="ch1-b", arrive="turn"), dict(LEAF, id="ch1-c", era="lion", arrive="wipe", moment="equinox-dawn")]
        out = q.pano_queue(leaves, self.render, lambda p: p == "pano/sphinx-flank-today.jpg")
        self.assertEqual(out, [{"state": "lion", "station": "sphinx-flank", "moment": "equinox-dawn",
                                "out": "build/render/pano/sphinx-flank-lion-equinox-dawn.png", "for": "ch1-c"}])


class Flights(unittest.TestCase):
    a, b = [439.0, -445.0, -29.5], [365.5, -433.0, -38.4]

    def test_lens_gives_the_leafs_vertical_field_in_a_16_by_9_frame(self):
        lens = q.lens_for(70)
        hfov = 2 * math.atan(18 / lens)
        self.assertAlmostEqual(math.degrees(2 * math.atan(math.tan(hfov / 2) * 9 / 16)), 70, places=6)

    def test_the_path_starts_and_ends_on_the_two_cameras_and_climbs_between(self):
        path = q.flight_path(self.a, self.b)
        self.assertEqual(path[0], self.a)
        self.assertEqual(path[-1], self.b)
        top = max(self.a[2], self.b[2]) + q.rise_for(math.dist(self.a[:2], self.b[:2]))
        self.assertAlmostEqual(max(p[2] for p in path), top)
        for t in (0.25, 0.5, 0.75):
            self.assertGreater(catmull(path, t)[2], max(self.a[2], self.b[2]))
        # it comes down onto the leaf steeply: the last tenth of the way drops most of the height
        self.assertGreater(path[-2][2] - self.b[2], 0.5 * (top - self.b[2]))

    def test_rise_is_a_quarter_of_the_way_within_bounds(self):
        self.assertEqual(q.rise_for(10), 8.0)
        self.assertEqual(q.rise_for(100), 25.0)
        self.assertEqual(q.rise_for(1000), 60.0)

    def test_a_flight_ends_on_the_arriving_leafs_view_in_its_era_and_moment(self):
        prev = dict(LEAF, id="ch0-x", station="sphinx", moment="equinox-dawn", view={"yaw": 277, "pitch": 5, "fov": 34})
        leaf = dict(LEAF, id="ch0-y", station="sphinx-face", moment="equinox-dawn", arrive="flight", view={"yaw": 276, "pitch": 16, "fov": 60})
        cams = {"sphinx": self.a, "sphinx-face": self.b}
        f = q.flight(prev, leaf, lambda s, era: cams[s])
        self.assertEqual(f["id"], "ch0-x--ch0-y")
        self.assertEqual(f["out"], "apps/exhibit/flights/ch0-x--ch0-y.mp4")
        self.assertEqual((f["state"], f["moment"], f["fps"] * f["seconds"]), ("today", "equinox-dawn", 90))
        self.assertEqual(f["path"][-1], self.b)
        end = q.ahead(self.b, leaf["view"])
        d = [end[k] - self.b[k] for k in range(3)]
        self.assertAlmostEqual(math.degrees(math.atan2(d[0], d[1])) % 360, 276, places=1)
        self.assertAlmostEqual(math.degrees(math.asin(d[2] / q.LOOK_AHEAD)), 16, places=1)
        self.assertAlmostEqual(f["lens"][1], q.lens_for(60), places=2)

    def test_only_leaves_arriving_by_flight_get_one(self):
        leaves = q.load("apps/exhibit/leaves.json")["leaves"]
        walk = q.load("apps/walk/stations.json")
        made = q.films(leaves, q.walk_cameras(walk))
        self.assertEqual([f["id"].split("--")[1] for f in made], [L["id"] for L in leaves[1:] if L["arrive"] == "flight"])


if __name__ == "__main__":
    unittest.main()
