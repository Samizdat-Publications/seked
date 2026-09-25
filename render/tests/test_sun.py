"""Plain-Python checks of render/giza/sun.py: python -m unittest discover render/tests"""
import math
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from giza import sun  # noqa: E402


class SunTests(unittest.TestCase):
    def test_obliquity_now_and_when_khufu_was_built(self):
        self.assertAlmostEqual(sun.obliquity_deg(2000), 23.4393, places=3)
        # 23.98 degrees in the reign of Khufu (Laskar 1986).
        self.assertAlmostEqual(sun.obliquity_deg(-2559), 23.98, delta=0.02)

    def test_equinox_noon_stands_at_the_colatitude(self):
        alt, az, dec = sun.sun_at(3, 20, 12.0)
        self.assertAlmostEqual(dec, 0.0, delta=0.3)
        self.assertAlmostEqual(alt, 90.0 - sun.LATITUDE_DEG + dec, delta=0.05)
        self.assertAlmostEqual(az, 180.0, delta=0.01)

    def test_equinox_sunrise_is_due_east(self):
        # At the equinox the sun rises due east whatever the latitude.
        alt, az, _ = sun.sun_at(3, 20, 6.0)
        self.assertAlmostEqual(az, 90.0, delta=0.2)
        self.assertLess(abs(alt), 1.0)

    def test_afternoon_is_in_the_west(self):
        alt, az, _ = sun.sun_at(10, 20, 16.86)
        self.assertTrue(180.0 < az < 270.0)
        self.assertAlmostEqual(alt, 9.3, delta=0.3)
        self.assertAlmostEqual(az, 252.2, delta=0.5)

    def test_june_solstice_noon_is_nearly_overhead(self):
        alt, _, dec = sun.sun_at(6, 21, 12.0)
        self.assertAlmostEqual(dec, 23.44, delta=0.1)
        self.assertAlmostEqual(alt, 90.0 - sun.LATITUDE_DEG + dec, delta=0.2)

    def test_october_declination_matches_the_almanac(self):
        # The Astronomical Almanac gives about -10.5 degrees on 20 October.
        _, _, dec = sun.sun_at(10, 20, 12.0)
        self.assertAlmostEqual(dec, -10.5, delta=0.25)

    def test_refraction_lifts_the_horizon_by_about_half_a_degree(self):
        self.assertAlmostEqual(sun.refraction_deg(0.0), 0.48, delta=0.03)
        self.assertLess(sun.refraction_deg(45.0), 0.02)


if __name__ == "__main__":
    unittest.main()
