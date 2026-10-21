"""render/export_heads.py's crop, centre and manifest: the ghosted head is cut round the king's head footprint and
says where it came from, without Blender."""
import json
import os
import sys
import tempfile
import types
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
_stub = "bpy" not in sys.modules
if _stub:
    sys.modules["bpy"] = types.ModuleType("bpy")
try:
    import export_heads as eh  # noqa: E402
    from giza import data  # noqa: E402
finally:
    if _stub:
        del sys.modules["bpy"]


class CropTests(unittest.TestCase):
    def test_the_box_holds_the_head_footprint_and_the_body_width(self):
        box = eh.crop_box()
        head = eh.footprint("sphinx.head")
        body = eh.footprint("sphinx.body")
        for x, y in head["ring"]:
            self.assertTrue(box["x0"] < x < box["x1"] and box["y0"] < y < box["y1"])
        self.assertLess(box["y0"], min(p[1] for p in body["ring"]))
        self.assertGreater(box["y1"], max(p[1] for p in body["ring"]))
        self.assertLess(box["z0"], head["base"] + head["minHeight"])
        self.assertGreater(box["z1"], head["base"] + head["height"])

    def test_the_centre_is_inside_the_box(self):
        box = eh.crop_box()
        c = eh.centre_of(box)
        self.assertTrue(box["x0"] < c[0] < box["x1"] and box["y0"] < c[1] < box["y1"] and box["z0"] < c[2] < box["z1"])


class ManifestTests(unittest.TestCase):
    def test_the_head_scale_is_read_from_the_solve_never_typed(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "headscale.json")
            self.assertIsNone(eh.head_scale(1.17, path)["least"])
            with open(path, "w", encoding="utf-8") as f:
                json.dump({"least_head_scale": 1.1625}, f)
            s = eh.head_scale(1.17, path)
            self.assertEqual((s["used"], s["least"]), (1.17, 1.1625))

    def test_the_manifest_names_both_heads_their_roles_and_the_stand_in_caveat(self):
        box = eh.crop_box()
        m = eh.manifest(box, eh.centre_of(box), eh.head_scale(1.17, "nowhere.json"), {"king": "sphinx-built", "lion": "sphinx-master"})
        self.assertEqual([(o["id"], o["role"], o["file"]) for o in m["objects"]],
                         [("king", "solid", "head-king.glb"), ("lion", "ghost", "head-lion.glb")])
        self.assertIn("stand-in", m["standin"])
        self.assertEqual(m["head_scale"]["target"], "sphinx.head.height")
        self.assertTrue(os.path.isdir(os.path.dirname(eh.OUT)))
        self.assertTrue(eh.OUT.startswith(data.REPO))


if __name__ == "__main__":
    unittest.main()
