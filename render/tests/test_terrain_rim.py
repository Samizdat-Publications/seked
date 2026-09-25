"""Plain-Python checks of the rock round the Sphinx's ditch (render/giza/terrain.py `rims`): python -m unittest discover render/tests"""
import os
import sys
import unittest
from unittest import mock

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
# terrain.py and sphinx.py build meshes, which these checks never do: stand Blender's modules in for the
# import only, so the other tests still find them missing.
_stubbed = [n for n in ("bpy", "bmesh", "mathutils") if n not in sys.modules]
for _n in _stubbed:
    sys.modules[_n] = mock.MagicMock()
try:
    from giza import causeway, sphinx  # noqa: E402
    from giza.terrain import Terrain  # noqa: E402
finally:
    for _n in _stubbed:
        del sys.modules[_n]


def grounds(state):
    enc = sphinx.enclosure(state)
    plain = Terrain(state, [], cuts=[enc])
    rim = Terrain(state, [], cuts=[enc], rims=[sphinx.rim(state)])
    return enc, plain, rim


class RimTests(unittest.TestCase):
    def test_the_rim_only_ever_raises_the_ground(self):
        _, plain, rim = grounds("today")
        X, Y = np.meshgrid(np.arange(200.0, 440.0, 3.0), np.arange(-560.0, -330.0, 3.0))
        self.assertTrue(np.all(rim.z(X, Y) >= plain.z(X, Y) - 1e-6))

    def test_the_ditch_floor_is_untouched(self):
        (x0, x1, y0, y1, floor), plain, rim = grounds("today")
        X, Y = np.meshgrid(np.linspace(x0 + 1, x1 - 1, 20), np.linspace(y0 + 1, y1 - 1, 20))
        np.testing.assert_allclose(rim.z(X, Y), plain.z(X, Y), atol=1e-6)

    def test_the_west_wall_stands_over_the_statues_rump(self):
        (x0, x1, y0, y1, floor), _, rim = grounds("today")
        top = rim.z(np.full(9, x0 - 1.5), np.linspace(y0, y1, 9))
        self.assertGreater(top.min() - floor, 9.0)

    def test_the_causeway_and_amenhotep_temple_keep_their_ground(self):
        _, plain, rim = grounds("built")
        line = causeway.centreline()
        self.assertLess(np.abs(rim.z(line[:, 0], line[:, 1]) - plain.z(line[:, 0], line[:, 1])).max(), 0.6)
        X, Y = np.meshgrid(np.linspace(358.0, 392.0, 8), np.linspace(-415.0, -381.0, 8))     # Amenhotep II's temple
        self.assertLess(np.abs(rim.z(X, Y) - plain.z(X, Y)).max(), 0.05)


if __name__ == "__main__":
    unittest.main()
