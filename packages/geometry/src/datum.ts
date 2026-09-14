/**
 * What a latitude is worth once you say which ellipsoid it was measured
 * against, and what it costs to change your mind.
 *
 * A geodetic latitude is not a fact about the ground on its own. It is the
 * angle between the equatorial plane and the normal to a chosen ellipsoid at
 * a chosen origin, so the same stone carries a different latitude under each
 * datum. Egypt's own triangulation ran on Old Egyptian 1907, on the Helmert
 * 1906 ellipsoid; the coordinates everyone now quotes are WGS84. B3 rests on
 * the seventh decimal place of one latitude, and its third free choice is
 * exactly this, so the difference has to be a number the viewer computes and
 * not a caveat in a note.
 *
 * The method is the plain one and the only one the published parameters
 * support: geodetic to geocentric on the first ellipsoid, three metres of
 * translation, geocentric back to geodetic on the second. Everything here is
 * pure arithmetic in metres and degrees; the translation and both ellipsoids
 * come out of the measurement database, so no constant of geodesy is typed
 * into this file.
 */
import { DEG } from '@seked/units';
import type { Environment } from './environment';

/** An ellipsoid as the two numbers the conversions need. */
export interface Ellipsoid {
  /** Semi-major axis, metres. */
  a: number;
  /** Flattening, (a − b) / a. */
  f: number;
}

/** A place on an ellipsoid: degrees, degrees, and metres above its surface. */
export interface GeodeticPoint {
  latDeg: number;
  lonDeg: number;
  heightM: number;
}

/** Earth-centred, earth-fixed X, Y and Z, metres. */
export type Geocentric = [number, number, number];

/** First eccentricity squared, which is the form every formula below wants. */
const eccentricitySquared = (f: number): number => 2 * f - f * f;

/** Radius of curvature in the prime vertical at this latitude, metres. */
const primeVertical = (a: number, e2: number, sinLat: number): number => a / Math.sqrt(1 - e2 * sinLat * sinLat);

export function geodeticToGeocentric({ latDeg, lonDeg, heightM }: GeodeticPoint, ellipsoid: Ellipsoid): Geocentric {
  const e2 = eccentricitySquared(ellipsoid.f);
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const n = primeVertical(ellipsoid.a, e2, sinLat);
  return [
    (n + heightM) * cosLat * Math.cos(lon),
    (n + heightM) * cosLat * Math.sin(lon),
    (n * (1 - e2) + heightM) * sinLat,
  ];
}

/**
 * The way back, which has no closed form in the usual elementary functions
 * and is done by the standard iteration instead. It converges in three or
 * four passes at any latitude on Earth, because the correction term is of
 * the order of the flattening.
 */
export function geocentricToGeodetic([x, y, z]: Geocentric, ellipsoid: Ellipsoid): GeodeticPoint {
  const e2 = eccentricitySquared(ellipsoid.f);
  const p = Math.hypot(x, y);
  let lat = Math.atan2(z, p * (1 - e2));
  // The cap is a guard and nothing more: the loop leaves on its own well
  // inside it, and a point that somehow did not converge should still return.
  for (let i = 0; i < 100; i++) {
    const radius = primeVertical(ellipsoid.a, e2, Math.sin(lat));
    const next = Math.atan2(z + e2 * radius * Math.sin(lat), p);
    const moved = Math.abs(next - lat);
    lat = next;
    if (moved < 1e-12) break;
  }
  const n = primeVertical(ellipsoid.a, e2, Math.sin(lat));
  // On the axis there is no p to divide by, and the height is the distance
  // along it less the semi-minor axis.
  const heightM = p > 1e-9 ? p / Math.cos(lat) - n : Math.abs(z) - ellipsoid.a * (1 - ellipsoid.f);
  return { latDeg: lat / DEG, lonDeg: Math.atan2(y, x) / DEG, heightM };
}

/**
 * The same place under another datum: onto the geocentric frame of the
 * ellipsoid it is quoted on, the three-parameter translation, and off again
 * onto the other one. The translation is added as given, so the caller says
 * which way it runs.
 */
export function shiftDatum(
  point: GeodeticPoint,
  from: Ellipsoid,
  to: Ellipsoid,
  [dx, dy, dz]: Geocentric,
): GeodeticPoint {
  const [x, y, z] = geodeticToGeocentric(point, from);
  return geocentricToGeodetic([x + dx, y + dy, z + dz], to);
}

/**
 * WGS84 as the database holds it: the equatorial radius is the semi-major
 * axis and the polar radius the semi-minor, so the flattening follows from
 * the two records rather than being stored a third time.
 */
export function wgs84Ellipsoid(env: Environment): Ellipsoid | undefined {
  const a = env['earth.radius.equatorial'];
  const b = env['earth.radius.polar'];
  return a === undefined || b === undefined ? undefined : { a, f: 1 - b / a };
}

/**
 * A WGS84 coordinate read back onto Old Egyptian 1907, the datum Egypt's own
 * survey of the plateau ran on.
 *
 * EPSG 1148 publishes the translation in the other direction, from Egypt 1907
 * to WGS84, so the way back subtracts it. Returns nothing when any of the
 * records is missing, which is a preset that cannot answer the question
 * rather than an error.
 */
export function egypt1907FromWgs84(env: Environment, point: GeodeticPoint): GeodeticPoint | undefined {
  const wgs84 = wgs84Ellipsoid(env);
  const a = env['ellipsoid.helmert1906.a'];
  const inverseFlattening = env['ellipsoid.helmert1906.inverse_flattening'];
  const dx = env['datum.egypt1907.to_wgs84.dx'];
  const dy = env['datum.egypt1907.to_wgs84.dy'];
  const dz = env['datum.egypt1907.to_wgs84.dz'];
  if (!wgs84 || a === undefined || inverseFlattening === undefined) return undefined;
  if (dx === undefined || dy === undefined || dz === undefined) return undefined;
  return shiftDatum(point, wgs84, { a, f: 1 / inverseFlattening }, [-dx, -dy, -dz]);
}
