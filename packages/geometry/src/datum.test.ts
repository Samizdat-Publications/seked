import { DEG } from '@seked/units';
import { describe, expect, it } from 'vitest';
import {
  egypt1907FromWgs84,
  geocentricToGeodetic,
  geodeticToGeocentric,
  shiftDatum,
  wgs84Ellipsoid,
  type Ellipsoid,
  type Geocentric,
  type GeodeticPoint,
} from './datum';

/**
 * The records the datum shift is made of, as data/measurements holds them.
 * A package test cannot resolve a preset, and what is under test here is the
 * arithmetic rather than the database; apps/web/src/overlays.test.ts runs the
 * same shift through the resolved records, so the two could not quietly come
 * to hold different numbers.
 */
const GEODESY: Record<string, number> = {
  'earth.radius.equatorial': 6378137,
  'earth.radius.polar': 6356752.314,
  'ellipsoid.helmert1906.a': 6378200,
  'ellipsoid.helmert1906.inverse_flattening': 298.3,
  'datum.egypt1907.to_wgs84.dx': -130,
  'datum.egypt1907.to_wgs84.dy': 110,
  'datum.egypt1907.to_wgs84.dz': -13,
};

/** The frame's own origin, `g1.center.*`, at the site's origin elevation. */
const GIZA: GeodeticPoint = { latDeg: 29.979167, lonDeg: 31.134167, heightM: 60 };

const WGS84 = wgs84Ellipsoid(GEODESY) as Ellipsoid;
const HELMERT_1906: Ellipsoid = { a: GEODESY['ellipsoid.helmert1906.a'] as number, f: 1 / 298.3 };

/** The translation as EPSG publishes it, which runs from Egypt 1907 to WGS84. */
const TO_WGS84: Geocentric = [-130, 110, -13];

/**
 * The abridged Molodensky formula for the shift in latitude, written out here
 * rather than called, so the module's answer is checked against a second and
 * quite different construction: a series in the translation and in the two
 * ellipsoids' difference, with no geocentric round trip in it at all.
 *
 * Δφ = [−dX sin φ cos λ − dY sin φ sin λ + dZ cos φ + (a Δf + f Δa) sin 2φ] / (M + h),
 * with M the meridional radius of curvature. The numerator is therefore the
 * shift along the meridian in metres, which is the form wanted here.
 */
function molodenskyShiftM(point: GeodeticPoint, from: Ellipsoid, to: Ellipsoid, [dx, dy, dz]: Geocentric): number {
  const phi = point.latDeg * DEG;
  const lambda = point.lonDeg * DEG;
  const da = to.a - from.a;
  const df = to.f - from.f;
  return (
    -dx * Math.sin(phi) * Math.cos(lambda) -
    dy * Math.sin(phi) * Math.sin(lambda) +
    dz * Math.cos(phi) +
    (from.a * df + from.f * da) * Math.sin(2 * phi)
  );
}

/** Metres along the meridian per radian of latitude at this point. */
function meridionalRadiusM(point: GeodeticPoint, ellipsoid: Ellipsoid): number {
  const e2 = 2 * ellipsoid.f - ellipsoid.f * ellipsoid.f;
  const sinLat = Math.sin(point.latDeg * DEG);
  return ellipsoid.a * (1 - e2) / Math.pow(1 - e2 * sinLat * sinLat, 1.5) + point.heightM;
}

describe('geodetic and geocentric', () => {
  it('returns a WGS84 point to itself through the geocentric frame', () => {
    for (const point of [GIZA, { latDeg: 0, lonDeg: 0, heightM: 0 }, { latDeg: -33.86, lonDeg: 151.21, heightM: 812 }]) {
      const back = geocentricToGeodetic(geodeticToGeocentric(point, WGS84), WGS84);
      expect(back.latDeg, `${point.latDeg}`).toBeCloseTo(point.latDeg, 9);
      expect(back.lonDeg, `${point.lonDeg}`).toBeCloseTo(point.lonDeg, 9);
      expect(back.heightM, `${point.heightM}`).toBeCloseTo(point.heightM, 4);
    }
  });

  it('puts the equator and the pole where the two axes are', () => {
    const [x, y, z] = geodeticToGeocentric({ latDeg: 0, lonDeg: 0, heightM: 0 }, WGS84);
    expect(x).toBeCloseTo(WGS84.a, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(0, 6);
    const pole = geodeticToGeocentric({ latDeg: 90, lonDeg: 0, heightM: 0 }, WGS84);
    expect(pole[2]).toBeCloseTo(GEODESY['earth.radius.polar'] as number, 6);
  });
});

describe('the Egypt 1907 datum shift', () => {
  it('takes the frame origin onto Helmert 1906 and back to itself', () => {
    const egypt = egypt1907FromWgs84(GEODESY, GIZA) as GeodeticPoint;
    const back = shiftDatum(egypt, HELMERT_1906, WGS84, TO_WGS84);
    expect(back.latDeg).toBeCloseTo(GIZA.latDeg, 9);
    expect(back.lonDeg).toBeCloseTo(GIZA.lonDeg, 9);
    expect(back.heightM).toBeCloseTo(GIZA.heightM, 4);
  });

  it('moves the base centre 18.4 m south, which abridged Molodensky agrees with', () => {
    const egypt = egypt1907FromWgs84(GEODESY, GIZA) as GeodeticPoint;
    const shiftM = (egypt.latDeg - GIZA.latDeg) * DEG * meridionalRadiusM(GIZA, WGS84);
    expect(shiftM).toBeCloseTo(-18.4, 1);
    // The inverse of the published translation, which is the direction
    // actually applied: WGS84 to Egypt 1907.
    const molodensky = molodenskyShiftM(GIZA, WGS84, HELMERT_1906, [130, -110, 13]);
    expect(Math.abs(shiftM - molodensky)).toBeLessThan(0.5);
  });

  it('says nothing rather than guessing when a preset carries none of the records', () => {
    expect(egypt1907FromWgs84({}, GIZA)).toBeUndefined();
    const { 'datum.egypt1907.to_wgs84.dz': _dz, ...missing } = GEODESY;
    expect(egypt1907FromWgs84(missing, GIZA)).toBeUndefined();
  });
});
