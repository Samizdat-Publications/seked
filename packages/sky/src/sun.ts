/**
 * The sun at the equinox and the solstices, without a planetary theory.
 *
 * Two facts do all the work. The first is that the equinox and the solstices
 * are defined by where the sun sits on the equator of date rather than found
 * by integrating an orbit: at the equinox the sun's declination is zero
 * because that is what the equinox is, and at a solstice it stands at the
 * obliquity of date, north in summer and south in winter. The second is that
 * the azimuth at which a body rises or sets depends on its declination, the
 * observer's latitude and the altitude at which the event is called, and on
 * nothing else. So C5 and C6 are the obliquity plus one spherical triangle,
 * and no VSOP87, no ΔT and no calendar appear anywhere.
 *
 * What that leaves out is worth naming. There is no equation of time here, so
 * this module cannot say at what clock time the sun rose; there is no
 * calendar, so it cannot say on which day the solstice of a particular year
 * fell; and it has no idea where the sun is on any other day of the year.
 * None of those changes an azimuth, which is all the claims ask for. What
 * does change an azimuth is the sun's own half degree of width, the
 * refraction of the air and the shape of the local skyline: the first two are
 * in the standard altitude below, and the third is not modelled at all, so
 * every azimuth here is for a flat sea-level horizon. At Giza the plateau's
 * own skyline is the thing to remember before reading any of these numbers to
 * better than about half a degree.
 *
 * The obliquity is taken from the same Vondrák model the stars use, as the
 * angle between the ecliptic pole and the equator pole of date, which is the
 * definition of the obliquity rather than a second model of it.
 *
 * Angles are degrees. Azimuth runs from north through east, matching
 * `horizon`.
 */
import { normalizeDeg } from './horizon';
import { ltpecl, ltpequ, type Vec3 } from './vondrak';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/**
 * The altitude at which a sunrise or a sunset is called: −0.833°, which is
 * 34′ of refraction at the horizon plus the sun's 16′ semidiameter, so the
 * event is the upper limb touching a flat horizon. This is the convention
 * every published sunrise azimuth is on, and the one the akhet claim needs,
 * since what Lehner's photograph shows is a disc and not a centre.
 */
export const SUN_STANDARD_ALTITUDE_DEG = -0.833;

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clamp1 = (x: number): number => Math.min(1, Math.max(-1, x));

/**
 * The obliquity of the ecliptic at a Julian epoch, in degrees: the angle
 * between Vondrák's ecliptic pole and his equator pole of the same date, both
 * of which are already unit vectors in the J2000 mean equatorial frame.
 *
 * At J2000 both series vanish and the answer is the model's own ε₀,
 * 84381.406″ = 23.439279°, the IAU 2006 value. It grows going back: about
 * 23.97° in 2500 BCE and about 24.2° near its long-term maximum around 7500
 * BCE. A test checks the whole range against Laskar's independent polynomial.
 */
export function obliquityOfDate(epj: number): number {
  return Math.acos(clamp1(dot(ltpecl(epj), ltpequ(epj)))) * R2D;
}

/**
 * The hour angle, in degrees and taken positive, at which a body of this
 * declination stands at this altitude for an observer at this latitude. It is
 * the altitude formula, sin h = sin δ sin φ + cos δ cos φ cos H, solved for H.
 *
 * NaN when the body never reaches the altitude: a circumpolar star has no
 * rising and a star below the horizon all day has no setting, and an
 * arbitrary number would be a worse answer than none.
 */
export function hourAngleAtAltitude(decDeg: number, latDeg: number, altDeg: number): number {
  const cosH =
    (Math.sin(altDeg * D2R) - Math.sin(decDeg * D2R) * Math.sin(latDeg * D2R)) /
    (Math.cos(decDeg * D2R) * Math.cos(latDeg * D2R));
  return Math.abs(cosH) > 1 ? Number.NaN : Math.acos(cosH) * R2D;
}

/**
 * The azimuth at which a body of this declination crosses this altitude on
 * the way up. The same spherical triangle solved the other way:
 * cos A = (sin δ − sin h sin φ) / (cos h cos φ). The answer lies between 0
 * and 180 by construction, because a body climbs in the eastern half of the
 * sky; `settingAzimuth` is its mirror image in the north-south line.
 *
 * `altDeg` is the altitude the event is called at: 0 for the geometric
 * horizon, which is what an alignment on a star is usually stated against,
 * and `SUN_STANDARD_ALTITUDE_DEG` for the sun's upper limb. NaN when the
 * altitude is outside the body's daily range.
 */
export function risingAzimuth(decDeg: number, latDeg: number, altDeg = 0): number {
  const cosA =
    (Math.sin(decDeg * D2R) - Math.sin(altDeg * D2R) * Math.sin(latDeg * D2R)) /
    (Math.cos(altDeg * D2R) * Math.cos(latDeg * D2R));
  return Math.abs(cosA) > 1 ? Number.NaN : Math.acos(cosA) * R2D;
}

/** As `risingAzimuth`, on the way down: the same angle reflected into the west. */
export function settingAzimuth(decDeg: number, latDeg: number, altDeg = 0): number {
  const rise = risingAzimuth(decDeg, latDeg, altDeg);
  return Number.isNaN(rise) ? Number.NaN : normalizeDeg(360 - rise);
}

/**
 * The local apparent sidereal time, as an angle, at which a body of this
 * right ascension and declination rises past `altDeg`. Sidereal time is the
 * hour angle of the equinox, and a body's hour angle is that less its right
 * ascension, so the rising sidereal time is α − H with H the positive hour
 * angle above. Two bodies' rising sidereal times can be subtracted directly,
 * which is how C5 asks whether Regulus rose before the sun.
 */
export function risingLst(raDeg: number, decDeg: number, latDeg: number, altDeg = 0): number {
  const h = hourAngleAtAltitude(decDeg, latDeg, altDeg);
  return Number.isNaN(h) ? Number.NaN : normalizeDeg(raDeg - h);
}

/** As `risingLst`, on the way down. */
export function settingLst(raDeg: number, decDeg: number, latDeg: number, altDeg = 0): number {
  const h = hourAngleAtAltitude(decDeg, latDeg, altDeg);
  return Number.isNaN(h) ? Number.NaN : normalizeDeg(raDeg + h);
}

export interface SunEnvironmentOptions {
  /** Julian epoch in astronomical year numbering: 2450 BCE is -2449. */
  epoch: number;
  /** The observer's latitude in degrees, north positive. */
  latitudeDeg: number;
}

/**
 * The three events, as the equinox and the solstices of date define them: the
 * sun's right ascension is 0, 90 and 270 degrees and its declination is 0,
 * +ε and −ε. `equinox` is the vernal one; the autumnal equinox shares its
 * declination and so both its azimuths, and differs only in sidereal time.
 */
const EVENTS: { prefix: string; raDeg: number; decOfObliquity: (eps: number) => number }[] = [
  { prefix: 'sun.equinox', raDeg: 0, decOfObliquity: () => 0 },
  { prefix: 'sun.solstice.summer', raDeg: 90, decOfObliquity: (eps) => eps },
  { prefix: 'sun.solstice.winter', raDeg: 270, decOfObliquity: (eps) => -eps },
];

/**
 * The sun half of the expression environment: `sun.obliquity`, and for each
 * of the three events the azimuth and the sidereal time of its rising and its
 * setting, all for the upper limb at `SUN_STANDARD_ALTITUDE_DEG`.
 *
 * Keys are `sun.equinox.rise.azimuth`, `sun.solstice.summer.set.azimuth` and
 * so on, with `.rise.lst` and `.set.lst` beside each azimuth.
 */
export function sunEnvironment({ epoch, latitudeDeg }: SunEnvironmentOptions): Record<string, number> {
  const obliquity = obliquityOfDate(epoch);
  const env: Record<string, number> = { 'sun.obliquity': obliquity };
  for (const event of EVENTS) {
    const decDeg = event.decOfObliquity(obliquity);
    const alt = SUN_STANDARD_ALTITUDE_DEG;
    env[`${event.prefix}.rise.azimuth`] = risingAzimuth(decDeg, latitudeDeg, alt);
    env[`${event.prefix}.set.azimuth`] = settingAzimuth(decDeg, latitudeDeg, alt);
    env[`${event.prefix}.rise.lst`] = risingLst(event.raDeg, decDeg, latitudeDeg, alt);
    env[`${event.prefix}.set.lst`] = settingLst(event.raDeg, decDeg, latitudeDeg, alt);
  }
  return env;
}
