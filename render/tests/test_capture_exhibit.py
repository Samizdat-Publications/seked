"""scripts/capture_exhibit.py: the narration laid under the recording, from the player's log."""
import importlib.util
import os
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
spec = importlib.util.spec_from_file_location("capture_exhibit", os.path.join(REPO, "scripts", "capture_exhibit.py"))
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)

LOG = [
    {"kind": "leaf", "leaf": "ch0-dawn", "at": 10_000},
    {"kind": "span", "leaf": "ch0-dawn", "chapter": 0, "file": "ch0.mp3", "start": 0.2, "end": 6.4, "at": 11_000},
    {"kind": "leaf", "leaf": "ch0-sunrise", "at": 19_000},
    {"kind": "span", "leaf": "ch0-sunrise", "chapter": 0, "file": "ch0.mp3", "start": 6.4, "end": 6.41, "at": 19_500},
    {"kind": "voice", "leaf": "ch0-sunrise", "at": 19_600},
    {"kind": "span", "leaf": "ch1-carved", "chapter": 1, "file": "ch1.mp3", "start": 0.0, "end": 3.0, "at": 25_250},
]


class Plan(unittest.TestCase):
    def test_places_each_heard_span_at_its_time_and_drops_one_cut_off_unheard(self):
        self.assertEqual(c.audio_plan(LOG, 10_000), [("ch0.mp3", 0.2, 6.4, 1.0), ("ch1.mp3", 0.0, 3.0, 15.25)])

    def test_a_span_before_the_origin_starts_at_once(self):
        self.assertEqual(c.audio_plan(LOG, 12_000)[0][3], 0.0)

    def test_stops_where_play_left_the_range(self):
        leaves = ["ch0-dawn", "ch0-sunrise"]
        self.assertEqual(c.stop_time(LOG, leaves, 10_500, 30_000), 30_000)
        log = LOG + [{"kind": "leaf", "leaf": "ch1-carved", "at": 25_000}]
        self.assertEqual(c.stop_time(log, leaves, 10_500, 30_000), 25_000)
        self.assertEqual([p[0] for p in c.audio_plan(log, 10_000, 25_000)], ["ch0.mp3"])

    def test_the_timeline_is_in_seconds_from_the_origin(self):
        rows = c.timeline(LOG, 10_000)
        self.assertEqual([r["at"] for r in rows], [0.0, 1.0, 9.0, 9.5, 9.6, 15.25])
        self.assertEqual(rows[4], {"kind": "voice", "leaf": "ch0-sunrise", "at": 9.6})


class Graph(unittest.TestCase):
    def test_one_input_per_file_each_span_trimmed_and_delayed_over_silence(self):
        plan = c.audio_plan(LOG, 10_000)
        graph, files = c.filter_graph(plan, 20.0)
        self.assertEqual(files, ["ch0.mp3", "ch1.mp3"])
        self.assertIn("aevalsrc=0:channel_layout=stereo:sample_rate=44100:d=20.000[base]", graph)
        self.assertIn("[1:a]atrim=start=0.200:end=6.400,", graph)
        self.assertIn("adelay=delays=1000:all=1[s0]", graph)
        self.assertIn("[2:a]atrim=start=0.000:end=3.000,", graph)
        self.assertIn("adelay=delays=15250:all=1[s1]", graph)
        self.assertTrue(graph.endswith("[base][s0][s1]amix=inputs=3:duration=first:normalize=0:dropout_transition=0[a]"))

    def test_with_nothing_heard_the_sound_is_silence(self):
        graph, files = c.filter_graph([], 5.0)
        self.assertEqual(files, [])
        self.assertTrue(graph.endswith("[base]amix=inputs=1:duration=first:normalize=0:dropout_transition=0[a]"))


class Range(unittest.TestCase):
    IDS = ["ch0-a", "ch0-b", "ch1-a", "ch1-b"]

    def test_defaults_to_the_first_leafs_chapter(self):
        self.assertEqual(c.leaf_range(self.IDS, None, None), ["ch0-a", "ch0-b"])
        self.assertEqual(c.leaf_range(self.IDS, "ch1-a", None), ["ch1-a", "ch1-b"])
        self.assertEqual(c.leaf_range(self.IDS, "ch0-b", "ch1-a"), ["ch0-b", "ch1-a"])

    def test_refuses_an_unknown_or_backward_range(self):
        with self.assertRaises(SystemExit):
            c.leaf_range(self.IDS, "ch9-z", None)
        with self.assertRaises(SystemExit):
            c.leaf_range(self.IDS, "ch1-a", "ch0-a")

    def test_the_real_leaves_load(self):
        ids = c.leaf_ids()
        self.assertTrue(ids[0].startswith("ch0-"))
        self.assertTrue(all(i.startswith("ch0-") for i in c.leaf_range(ids, None, None)))


if __name__ == "__main__":
    unittest.main()
