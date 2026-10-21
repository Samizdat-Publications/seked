"""render/publish.py's exhibit patches: published with the panorama each registers with, never over a newer one."""
import importlib.util
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
RENDER = os.path.dirname(HERE)
sys.path.insert(0, RENDER)
spec = importlib.util.spec_from_file_location("publish", os.path.join(RENDER, "publish.py"))
publish = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publish)


class ExhibitPatches(unittest.TestCase):
    def setUp(self):
        from PIL import Image
        self.tmp = tempfile.TemporaryDirectory()
        root = self.tmp.name
        self.patch_in, self.pano_in, self.pano_out = (os.path.join(root, d) for d in ("patch-exhibit", "pano", "out"))
        for d in (self.patch_in, self.pano_in):
            os.makedirs(d)
        Image.new("RGB", (8, 4)).save(os.path.join(self.pano_in, "sphinx-today-equinox-dawn.png"))
        os.utime(os.path.join(self.pano_in, "sphinx-today-equinox-dawn.png"), (1000, 1000))

        def patch(name, when, pano="pano/sphinx-today-equinox-dawn.jpg"):
            png = os.path.join(self.patch_in, name + ".png")
            Image.new("RGB", (32, 18)).save(png)
            with open(os.path.join(self.patch_in, name + ".json"), "w", encoding="utf-8") as f:
                json.dump({"camera": [0, 0, 0], "patch": {"yaw": 277, "pitch": 0, "fov": 44.2, "aspect": 16 / 9, "leaf": name, "pano": pano}}, f)
            os.utime(png, (when, when))
        patch("sphinx-today-equinox-dawn-new", 2000)
        patch("sphinx-today-equinox-dawn-old", 500)
        patch("sphinx-lion-equinox-dawn-orphan", 2000, pano="pano/sphinx-lion-equinox-dawn.jpg")

    def tearDown(self):
        self.tmp.cleanup()

    def test_only_a_patch_newer_than_its_panorama_is_published_and_it_names_that_panorama(self):
        out = publish.exhibit_patches(self.patch_in, self.pano_in, self.pano_out)
        self.assertEqual([p["leaf"] for p in out], ["sphinx-today-equinox-dawn-new"])
        p = out[0]
        self.assertEqual(p["src"], "pano/patch/sphinx-today-equinox-dawn-new.jpg")
        self.assertEqual(p["pano"], "pano/sphinx-today-equinox-dawn.jpg")
        self.assertEqual((p["yaw"], p["pitch"], p["fov"]), (277, 0, 44.2))
        self.assertAlmostEqual(p["aspect"], 32 / 18, places=5)
        self.assertTrue(os.path.exists(os.path.join(self.pano_out, "patch", "sphinx-today-equinox-dawn-new.jpg")))


if __name__ == "__main__":
    unittest.main()
