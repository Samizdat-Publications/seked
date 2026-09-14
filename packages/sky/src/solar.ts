/**
 * Where the sun actually is on a given day, and when the seasons turn.
 *
 * `sun.ts` puts the sun at the equinox and the solstices without a date,
 * because a rising azimuth follows from a declination and the declination at
 * those three moments is fixed by the obliquity. This module is the other
 * half: the sun's longitude on any date, the right ascension and declination
 * that follow from it, the equation of time, and the instant at which each of
 * the four seasonal events falls in a given year.
 *
 * Everything is Meeus, Astronomical Algorithms, 2nd ed. (1998), and
 * deliberately the low-precision path of it: chapter 25's series in the mean
 * anomaly rather than VSOP87, which is good to about 0.01° in longitude, a
 * second of time in the equation of time, and a minute or so in a season's
 * instant. Against the several hours of ΔT at 2450 BCE that is not the term
 * to improve. The apparent longitude carries Meeus's own one-term nutation
 * and his aberration constant (25.8 to 25.10), so what comes out is the
 * apparent place, not the mean one.
 *
 * The obliquity is `obliquityOfDate` from `sun.ts`, which is the Vondrák
 * model the stars use, so the package has one obliquity and the sun's
 * declination at the solstice is the same number the solstice azimuths were
 * built on. What that leaves out is the nutation in obliquity, ±9″, which
 * moves the sun's declination by under an arcsecond and its rising by under
 * two seconds of time.
 *
 * Times are Julian Ephemeris Days, that is Julian Days in TT: turning one
 * into a time of day is `deltaT` and the calendar in `calendar.ts`. Angles
 * are degrees.
 */
import { calendarYearOfEpoch, deltaT, jdToJulianEpoch } from './calendar';
import { normalizeDeg } from './horizon';
import type { Equatorial } from './stars';
import { SUN_STANDARD_ALTITUDE_DEG, hourAngleAtAltitude, obliquityOfDate, type SunEnvironmentOptions } from './sun';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/**
 * The pieces of Meeus chapter 25 that more than one of the functions below
 * needs: the mean longitude, which the equation of time is measured from, and
 * the apparent longitude and the nutation in longitude, which the sun's place
 * is built from. Computing them once is what keeps the equation of time and
 * the declination talking about the same sun.
 */
interface SolarState {
  /** Geometric mean longitude referred to the mean equinox of date, 25.2. */
  meanLongitudeDeg: number;
  /** Apparent longitude: the true longitude with nutation and aberration, 25.10. */
  apparentLongitudeDeg: number;
  /** The nutation in longitude as 25.10 approximates it, in degrees. */
  nutationInLongitudeDeg: number;
}

function solarState(jde: number): SolarState {
  const t = (jde - 2451545.0) / 36525;
  const meanLongitudeDeg = normalizeDeg(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
  const meanAnomalyDeg = normalizeDeg(357.52911 + 35999.05029 * t - 0.0001537 * t * t);
  const m = meanAnomalyDeg * D2R;
  // The equation of the centre, 25.4: the orbit's eccentricity expressed as
  // the difference between where the sun is and where a uniformly moving sun
  // would be. It reaches nearly two degrees.
  const centreDeg =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(m) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * m) +
    0.000289 * Math.sin(3 * m);
  // The longitude of the Moon's ascending node, which is what the nutation
  // in longitude mostly is at this precision.
  const omegaDeg = 125.04 - 1934.136 * t;
  const nutationInLongitudeDeg = -0.00478 * Math.sin(omegaDeg * D2R);
  return {
    meanLongitudeDeg,
    // The −0.00569° is the aberration: the sun is seen where it was when the
    // light left it, twenty arcseconds back along its own motion.
    apparentLongitudeDeg: normalizeDeg(meanLongitudeDeg + centreDeg - 0.00569 + nutationInLongitudeDeg),
    nutationInLongitudeDeg,
  };
}

/** The sun's apparent longitude on the ecliptic of date, in degrees. Meeus 25.10. */
export function solarLongitude(jde: number): number {
  return solarState(jde).apparentLongitudeDeg;
}

/**
 * The sun's apparent right ascension and declination, from the apparent
 * longitude and the obliquity of date. Meeus 25.6 and 25.7, with the sun's
 * ecliptic latitude taken as zero: it never exceeds 1.2″, which is smaller
 * than the longitude this method gets wrong.
 */
export function solarDeclinationAndRa(jde: number): Equatorial {
  const lambda = solarLongitude(jde) * D2R;
  const eps = obliquityOfDate(jdToJulianEpoch(jde)) * D2R;
  return {
    raDeg: normalizeDeg(Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) * R2D),
    decDeg: Math.asin(Math.sin(eps) * Math.sin(lambda)) * R2D,
  };
}

/**
 * The equation of time in minutes: apparent solar time less mean solar time,
 * so a sundial reads ahead of a mean clock when this is positive. Meeus 28.1,
 * which is the definition rather than a fit: the mean sun's longitude less the
 * true sun's right ascension, with the aberration and the nutation that the
 * right ascension carries and the mean sun does not taken back out.
 *
 * It runs between about −14 minutes in February and +16 in early November,
 * and it is the whole of the difference between the time a sundial gives for
 * sunrise and the time a clock does.
 */
export function equationOfTime(jde: number): number {
  const { meanLongitudeDeg, nutationInLongitudeDeg } = solarState(jde);
  const { raDeg } = solarDeclinationAndRa(jde);
  const eps = obliquityOfDate(jdToJulianEpoch(jde)) * D2R;
  const degrees = meanLongitudeDeg - 0.0057183 - raDeg + nutationInLongitudeDeg * Math.cos(eps);
  // Wrapped into ±180 because the mean longitude and the right ascension are
  // each normalised and cross zero on different days. Four minutes to the
  // degree, the Earth's own rate.
  return (normalizeDeg(degrees + 180) - 180) * 4;
}

/** The four moments the sun's longitude is a multiple of 90 degrees. */
export const SEASON_EVENTS = ['march-equinox', 'june-solstice', 'september-equinox', 'december-solstice'] as const;
export type SeasonEvent = (typeof SEASON_EVENTS)[number];

type Quartic = readonly [number, number, number, number, number];

/**
 * Meeus table 27.A: a mean JDE0 for the years −1000 to +1000, in Y = year /
 * 1000. These are the sets this project uses, since every epoch it cares
 * about is older than −1000 and the nearer of the two is this one.
 */
const JDE0_BEFORE_1000: Record<SeasonEvent, Quartic> = {
  'march-equinox': [1721139.29189, 365242.1374, 0.06134, 0.00111, -0.00071],
  'june-solstice': [1721233.25401, 365241.72562, -0.05323, 0.00907, 0.00025],
  'september-equinox': [1721325.70455, 365242.49558, -0.11677, -0.00297, 0.00074],
  'december-solstice': [1721414.39987, 365242.88257, -0.00769, -0.00933, -0.00006],
};

/** Meeus table 27.B: the same for +1000 to +3000, in Y = (year − 2000) / 1000. */
const JDE0_AFTER_1000: Record<SeasonEvent, Quartic> = {
  'march-equinox': [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057],
  'june-solstice': [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.0003],
  'september-equinox': [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078],
  'december-solstice': [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032],
};

/**
 * Meeus table 27.C: the twenty-four periodic terms, amplitude in units of
 * 0.00001 day, argument B + C·T in degrees. They are the planets and the Moon
 * pulling the Earth off the mean instant, and together they come to a little
 * over half a day.
 */
const PERIODIC: readonly (readonly [number, number, number])[] = [
  [485, 324.96, 1934.136],
  [203, 337.23, 32964.467],
  [199, 342.08, 20.186],
  [182, 27.85, 445267.112],
  [156, 73.14, 45036.886],
  [136, 171.52, 22518.443],
  [77, 222.54, 65928.934],
  [74, 296.72, 3034.906],
  [70, 243.58, 9037.513],
  [58, 119.81, 33718.147],
  [52, 297.17, 150.678],
  [50, 21.02, 2281.226],
  [45, 247.54, 29929.562],
  [44, 325.15, 31555.956],
  [29, 60.93, 4443.417],
  [18, 155.12, 67555.328],
  [17, 288.79, 4562.452],
  [16, 198.04, 62894.029],
  [14, 199.76, 31436.921],
  [12, 95.39, 14577.848],
  [12, 287.11, 31931.756],
  [12, 320.81, 34777.259],
  [9, 227.73, 1222.114],
  [8, 15.45, 16859.074],
];

/**
 * The instant of a seasonal event, as a Julian Ephemeris Day. Meeus chapter
 * 27: a quartic for the mean instant, the twenty-four periodic terms, and the
 * division by Δλ that turns a correction in the sun's longitude into one in
 * time by the rate the sun is moving at.
 *
 * Meeus gives the quartics for −1000 to +3000 and this uses the nearer set
 * outside that, which is an extrapolation and says so: the fourth-order term
 * alone is three days at 10,500 BCE. Expect the answer to be good to a minute
 * inside Meeus's range, to some hours at 2450 BCE and to days at 10,500 BCE.
 * That is still far better than ΔT is known at either date, so the calendar
 * day it lands on is the weakest link in the chain and not this.
 */
export function seasonInstant(year: number, event: SeasonEvent): number {
  const before1000 = year < 1000;
  const y = before1000 ? year / 1000 : (year - 2000) / 1000;
  const [a0, a1, a2, a3, a4] = (before1000 ? JDE0_BEFORE_1000 : JDE0_AFTER_1000)[event];
  const jde0 = a0 + y * (a1 + y * (a2 + y * (a3 + y * a4)));
  const t = (jde0 - 2451545.0) / 36525;
  const w = (35999.373 * t - 2.47) * D2R;
  const rateOfLongitude = 1 + 0.0334 * Math.cos(w) + 0.0007 * Math.cos(2 * w);
  let s = 0;
  for (const [amplitude, phaseDeg, rateDegPerCentury] of PERIODIC) {
    s += amplitude * Math.cos((phaseDeg + rateDegPerCentury * t) * D2R);
  }
  return jde0 + (0.00001 * s) / rateOfLongitude;
}

/**
 * The event's own name as the claim language spells identifiers: the four ids
 * with their hyphens turned into underscores. They are `march_equinox` and
 * `june_solstice` rather than the `sun.equinox` and `sun.solstice.summer`
 * that `sunEnvironment` already carries, because those three are named for a
 * northern observer's seasons and these four are named for nothing but the
 * month, which is the only description that survives being read at Giza, in
 * the southern hemisphere, or ten thousand years ago.
 */
const eventKey = (event: SeasonEvent): string => `sun.${event.replace('-', '_')}`;

/**
 * The sun's keys that need a calendar, for the four seasonal events of the
 * epoch's calendar year: `sun.june_solstice.jd`, the instant as a Julian Day
 * in TT; `.equation_of_time` in minutes; and `.rise.local_mean_time` and
 * `.set.local_mean_time` in decimal hours of local mean solar time on the
 * observer's own meridian.
 *
 * Sunrise is the sun's upper limb at `SUN_STANDARD_ALTITUDE_DEG`, the same
 * convention the azimuths in `sun.ts` are on, so the pair say where and when
 * the same event happened. Local apparent time of sunrise is 12h less the
 * hour angle; mean time is that less the equation of time, and it is mean
 * solar time on this meridian and not any civil clock: no time zone, no
 * summer time, and a flat horizon rather than the plateau's own skyline.
 *
 * The declination and the equation of time are read at local mean noon of
 * the day the event falls on where the observer stands, which is what the
 * longitude is for and is not the day it falls on in TT: ΔT alone is sixteen
 * hours at 2450 BCE and five days at 10,500 BCE.
 *
 * A latitude where the sun does not reach the standard altitude that day gets
 * NaN for the two times, as everything else in the package does rather than
 * inventing a number.
 */
export function datedSunEnvironment({ epoch, latitudeDeg, longitudeDeg = 0 }: SunEnvironmentOptions): Record<string, number> {
  const year = calendarYearOfEpoch(epoch);
  const drift = deltaT(year) / 86400;
  const meridian = longitudeDeg / 360;
  const env: Record<string, number> = {};
  for (const event of SEASON_EVENTS) {
    const jde = seasonInstant(year, event);
    const noon = Math.floor(jde - drift + meridian + 0.5) - meridian + drift;
    const minutes = equationOfTime(noon);
    const hourAngleDeg = hourAngleAtAltitude(solarDeclinationAndRa(noon).decDeg, latitudeDeg, SUN_STANDARD_ALTITUDE_DEG);
    const prefix = eventKey(event);
    env[`${prefix}.jd`] = jde;
    env[`${prefix}.equation_of_time`] = minutes;
    env[`${prefix}.rise.local_mean_time`] = 12 - hourAngleDeg / 15 - minutes / 60;
    env[`${prefix}.set.local_mean_time`] = 12 + hourAngleDeg / 15 - minutes / 60;
  }
  return env;
}
