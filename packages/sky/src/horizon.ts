/**
 * The horizon frame: equatorial coordinates of date to altitude and azimuth,
 * and altitude and azimuth to the project's east-north-up vectors. This is
 * what the viewer's sky dome needs on top of `frames`, which only knows the
 * meridian.
 *
 * Every angle is in degrees. Azimuth is measured from north through east, so
 * 0 is north, 90 east, 180 south, 270 west, matching the +X east, +Y north,
 * +Z up frame the rest of the project uses.
 *
 * `lstDeg` is local apparent sidereal time expressed as an angle: the hour
 * angle of the equinox of date at the observer's meridian, 15° per sidereal
 * hour. Turning a calendar date into that number needs UT1, ΔT and the
 * equation of the equinoxes, none of which exist yet; they arrive with the
 * Sun step, and until then a caller supplies the sidereal time directly. That
 * is deliberate: a shaft or transit claim is a statement about sidereal time
 * alone, so none of them has to wait for a clock.
 */
import type { Vec3 } from './vondrak';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export interface HorizonInput {
  /** Right ascension of date, degrees. */
  raDeg: number;
  /** Declination of date, degrees. */
  decDeg: number;
  /** Observer's latitude, degrees, north positive. */
  latDeg: number;
  /** Local apparent sidereal time, degrees. See the note at the top of this file. */
  lstDeg: number;
}

export interface Horizontal {
  /** Geometric altitude above the horizon, degrees; negative below it. */
  altDeg: number;
  /** Azimuth from north through east, degrees in [0, 360). */
  azDeg: number;
}

/** Fold an angle into [0, 360). */
export function normalizeDeg(deg: number): number {
  const x = deg % 360;
  return x < 0 ? x + 360 : x;
}

/**
 * Geometric altitude and azimuth. No refraction and no parallax: this is the
 * direction of the star's mean place of date as seen from the centre of a
 * spherical Earth, which is what an alignment claim is about. Apply
 * `apparentAltitude` when the claim is about seeing the star rise or set.
 *
 * At the zenith the azimuth is degenerate and comes back as whatever the
 * arctangent of two vanishing numbers gives; nothing downstream should read
 * it when the altitude is within a hair of 90.
 */
export function altAz({ raDeg, decDeg, latDeg, lstDeg }: HorizonInput): Horizontal {
  const ha = (lstDeg - raDeg) * D2R;
  const dec = decDeg * D2R;
  const lat = latDeg * D2R;
  const sinDec = Math.sin(dec);
  const cosDec = Math.cos(dec);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinAlt = sinDec * sinLat + cosDec * cosLat * Math.cos(ha);
  const altDeg = Math.asin(Math.min(1, Math.max(-1, sinAlt))) * R2D;
  // cos(alt)·sin(az) and cos(alt)·cos(az); the common factor drops out of atan2.
  const east = -cosDec * Math.sin(ha);
  const north = cosLat * sinDec - sinLat * cosDec * Math.cos(ha);
  return { altDeg, azDeg: normalizeDeg(Math.atan2(east, north) * R2D) };
}

/**
 * The unit vector of an altitude and azimuth in the project frame: +X east,
 * +Y north, +Z up. The same frame the measurements, the meshes and Blender
 * use, so a star direction and a shaft direction are directly comparable.
 */
export function enuDirection(altDeg: number, azDeg: number): Vec3 {
  const alt = altDeg * D2R;
  const az = azDeg * D2R;
  const horizontal = Math.cos(alt);
  return [horizontal * Math.sin(az), horizontal * Math.cos(az), Math.sin(alt)];
}

/**
 * The local apparent sidereal time at which a star of this right ascension is
 * on the meridian at upper culmination. It is the right ascension itself: the
 * hour angle is sidereal time minus right ascension, and upper culmination is
 * where that is zero. The function exists so the caller never has to remember
 * which way round the subtraction goes.
 */
export function transitLst(raDeg: number): number {
  return normalizeDeg(raDeg);
}

/** Above this altitude `apparentAltitude` returns its argument unchanged. */
export const REFRACTION_LIMIT_DEG = 15;

/**
 * Bennett's (1982) refraction in arcminutes for a geometric altitude in
 * degrees: R = cot(h + 7.31 / (h + 4.4)). About 34.5′ at the horizon, which
 * is the figure every rising-and-setting convention is built on. The formula
 * is singular near h = −4.4°, so the argument is floored well above that.
 */
function bennettArcmin(altDeg: number): number {
  const h = Math.max(altDeg, -1.5);
  return 1 / Math.tan((h + 7.31 / (h + 4.4)) * D2R);
}

/**
 * Geometric altitude raised by atmospheric refraction, for rising and setting
 * claims. Bennett's formula below `REFRACTION_LIMIT_DEG` and the identity at
 * or above it, with a linear ramp subtracted so the two meet at zero instead
 * of stepping by the 3.6′ Bennett still gives at 15°. The horizon value is
 * untouched by the ramp, so a star whose geometric altitude is 0 comes back
 * about 34.5′ high, and one below the horizon is lifted by rather more.
 *
 * A standard atmosphere is assumed and no local horizon profile is applied.
 * Refraction at the horizon varies by several arcminutes with temperature and
 * pressure, which is worth remembering before anyone reads a claim about a
 * star touching the horizon to better than a tenth of a degree.
 */
export function apparentAltitude(altDeg: number): number {
  if (altDeg >= REFRACTION_LIMIT_DEG) return altDeg;
  const ramp = (Math.max(altDeg, 0) / REFRACTION_LIMIT_DEG) * bennettArcmin(REFRACTION_LIMIT_DEG);
  return altDeg + (bennettArcmin(altDeg) - ramp) / 60;
}
