"""
Where the sun stands at Giza for a moment: a day of the year and a local solar time.

A moment is a season and an hour, not a calendar instant: the walkthrough lights a
station "late on an October afternoon", and the same words hold in 2560 BCE. The
sun's ecliptic longitude for the day comes from the Astronomical Almanac's
low-precision formula (mean longitude plus the equation of centre, good to about
0.01 degree) evaluated in the present calendar; an ancient render keeps that
season and changes only the obliquity, which was 23.98 degrees when Khufu was
built against 23.44 now. The hour angle is the solar time itself, so the equation
of time never enters.

Kept free of bpy so it can be tested with plain Python.
"""
import datetime
import math

LATITUDE_DEG = 29.979167     # the Great Pyramid, data/sites.json
J2000 = datetime.datetime(2000, 1, 1, 12, 0, 0)


def obliquity_deg(year):
    """
    Obliquity of the ecliptic for a (proleptic, astronomical) year, from Laskar's
    1986 series, which holds to about 0.01 degree across ten thousand years either
    side of J2000. Year 0 is 1 BCE; 2560 BCE is year -2559.
    """
    t = (year - 2000.0) / 10000.0
    arcsec = (84381.448 - 4680.93 * t - 1.55 * t ** 2 + 1999.25 * t ** 3 - 51.38 * t ** 4
              - 249.67 * t ** 5 - 39.05 * t ** 6 + 7.12 * t ** 7 + 27.87 * t ** 8
              + 5.79 * t ** 9 + 2.45 * t ** 10)
    return arcsec / 3600.0


def ecliptic_longitude_deg(month, day, calendar_year=2026):
    """The sun's apparent ecliptic longitude at noon on a day, in the present calendar."""
    n = (datetime.datetime(calendar_year, month, day, 12, 0, 0) - J2000).total_seconds() / 86400.0
    L = 280.460 + 0.9856474 * n
    g = math.radians(357.528 + 0.9856003 * n)
    return (L + 1.915 * math.sin(g) + 0.020 * math.sin(2 * g)) % 360.0


def refraction_deg(altitude_deg):
    """Saemundsson's refraction for a geometric altitude, in degrees; nothing below -1 degree."""
    h = altitude_deg
    if h < -1.0:
        return 0.0
    return (1.02 / math.tan(math.radians(h + 10.3 / (h + 5.11)))) / 60.0


def sun_at(month, day, solar_hour, year=2026, latitude_deg=LATITUDE_DEG):
    """
    The sun's apparent altitude and its azimuth (degrees from north through east)
    at a local solar time on a day of the year, for an epoch's obliquity.
    Returns (altitude_deg, azimuth_deg, declination_deg).
    """
    lam = math.radians(ecliptic_longitude_deg(month, day))
    eps = math.radians(obliquity_deg(year))
    dec = math.asin(math.sin(eps) * math.sin(lam))
    phi = math.radians(latitude_deg)
    h = math.radians(15.0 * (solar_hour - 12.0))
    sin_alt = math.sin(phi) * math.sin(dec) + math.cos(phi) * math.cos(dec) * math.cos(h)
    alt = math.degrees(math.asin(max(-1.0, min(1.0, sin_alt))))
    # Azimuth from the south, westward positive, then turned to north-through-east.
    az_south = math.atan2(math.sin(h), math.cos(h) * math.sin(phi) - math.tan(dec) * math.cos(phi))
    az = (math.degrees(az_south) + 180.0) % 360.0
    return alt + refraction_deg(alt), az, math.degrees(dec)


def parse_moment(moment, year=2026):
    """A moment as written in stations.json and shots.json: {"date": "10-20", "solar": 16.86}."""
    month, day = (int(v) for v in moment["date"].split("-"))
    return sun_at(month, day, float(moment["solar"]), year=moment.get("year", year))
