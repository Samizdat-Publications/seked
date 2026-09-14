/**
 * The calendar the rest of the sky package does without: Julian Days, the
 * proleptic Julian and Gregorian calendars, ΔT, and sidereal time as a clock
 * rather than as an angle.
 *
 * `sun.ts` needs none of this, because an azimuth depends on a declination
 * and not on a date. Everything that has a date needs all of it: to say that
 * the solstice of an epoch fell on a particular morning is to name a calendar,
 * to turn the instant from the uniform time astronomy computes in into the
 * rotation time the Earth actually kept, and to reckon the result from the
 * observer's own meridian. Those are three separate conversions and they are
 * kept separate here.
 *
 * The calendar is the one an ancient date is conventionally quoted in: the
 * Julian calendar up to 1582 October 4 and the Gregorian from 1582 October 15,
 * with no gap in the Julian Day between them, and astronomical year numbering
 * throughout, so there is a year 0 and 2450 BCE is −2449. Before the Julian
 * calendar existed in 45 BCE the dates are proleptic: they are a way of
 * labelling a Julian Day and not a claim about what any Egyptian wrote.
 *
 * Algorithms are from Meeus, Astronomical Algorithms, 2nd ed. (1998): chapter
 * 7 for the Julian Day and its inverse, chapter 12 for sidereal time. ΔT is
 * the long-term parabola of Stephenson, Morrison & Hohenkerk (2016), which is
 * the only one of the three that is a model rather than a definition.
 *
 * Units are days for Julian Days, degrees for angles and hours for clock
 * times, decimal in each case.
 */
import { normalizeDeg } from './horizon';

/**
 * A date in whichever calendar the Julian Day falls in, with the day of the
 * month carrying the time as its fraction: 4.81 is the 4th at 19h 26m.
 */
export interface CalendarDate {
  /** Astronomical year numbering: there is a year 0, and 2450 BCE is −2449. */
  year: number;
  /** 1 for January through 12 for December. */
  month: number;
  /** Day of the month, fractional. */
  day: number;
}

/**
 * The Julian Day of the first Gregorian day, 1582 October 15, which followed
 * 1582 October 4 in the Julian calendar. `calendarDate` switches calendars
 * here and `julianDay` switches on the same instant stated as a date.
 */
export const GREGORIAN_START_JD = 2299160.5;

/**
 * The Julian Day of a date, with the day fractional. Meeus chapter 7: the
 * Gregorian calendar from 1582 October 15 and the Julian calendar before it,
 * which is what makes 1582 October 4.0 and October 15.0 eleven days apart in
 * the calendar and one day apart in the Julian Day.
 *
 * A Julian Day begins at noon, so a date ending in .0 lands on a half: 2000
 * January 1.5 is JD 2451545.0 exactly, which is the definition of J2000.
 */
export function julianDay(year: number, month: number, day: number): number {
  const y = month > 2 ? year : year - 1;
  const m = month > 2 ? month : month + 12;
  const gregorian = year > 1582 || (year === 1582 && (month > 10 || (month === 10 && day >= 15)));
  const a = Math.floor(y / 100);
  const b = gregorian ? 2 - a + Math.floor(a / 4) : 0;
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

/**
 * The inverse of `julianDay`, Meeus chapter 7. Every floor here is a floor
 * and not a truncation, which is the whole of what the algorithm needs to
 * keep working for the negative years the epochs of this project live in.
 */
export function calendarDate(jd: number): CalendarDate {
  const shifted = jd + 0.5;
  const z = Math.floor(shifted);
  const fraction = shifted - z;
  let a = z;
  if (jd >= GREGORIAN_START_JD) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e) + fraction;
  const month = e < 14 ? e - 1 : e - 13;
  return { year: month > 2 ? c - 4716 : c - 4715, month, day };
}

/**
 * The Julian Day of a Julian epoch, which is the unit the stars, the
 * precession model and every claim's `epoch` are stated in: a year of exactly
 * 365.25 days counted from J2000.0 = JD 2451545.0.
 */
export function julianEpochToJd(epj: number): number {
  return 2451545.0 + (epj - 2000) * 365.25;
}

/** The inverse of `julianEpochToJd`. */
export function jdToJulianEpoch(jd: number): number {
  return 2000 + (jd - 2451545.0) / 365.25;
}

/**
 * The calendar year a Julian epoch falls in.
 *
 * The two ways of counting years have drifted apart: a Julian epoch is
 * 365.25 days long to the second, while the calendar the dates are quoted in
 * starts each year on a whole day, so J−2449.0 lands on −2450 December 19
 * rather than on −2449 January 1. Reading the year from the middle of the
 * epoch's own year instead of from its first instant puts it beyond the
 * fortnight the two disagree about, and the seasons of that year, which is
 * what anything asks this for, all fall well inside it.
 */
export function calendarYearOfEpoch(epj: number): number {
  return calendarDate(julianEpochToJd(epj + 0.5)).year;
}

/**
 * ΔT = TT − UT1 in seconds: how far the Earth's rotation has drifted from
 * uniform time, and so how far a computed instant has to be shifted before it
 * can be called a time of day.
 *
 * This is the long-term parabola of Stephenson, Morrison & Hohenkerk (2016),
 * Proc. R. Soc. A 472, 20160404, ΔT = −320 + 32.5 t² with t in centuries from
 * 1825, which is what their spline reduces to outside the eclipse record and
 * the right tool for the epochs this project is about: about 16 hours at 2450
 * BCE and nearly six days at 10,500 BCE, both of them far larger than any
 * error in the parabola itself.
 *
 * Inside the last four centuries, where ΔT is tabulated from observation
 * rather than modelled, the parabola is off by up to a couple of minutes: it
 * gives −189 s for 2026 against the observed +69 s. Nothing here needs better.
 * A clock time in the last four centuries is not what this package is for.
 */
export function deltaT(year: number): number {
  const t = (year - 1825) / 100;
  return -320 + 32.5 * t * t;
}

/**
 * Greenwich mean sidereal time as an angle in degrees, for a Julian Day in
 * UT1. Meeus equation 12.4: the polynomial that carries both the Earth's
 * rotation and the precession of the equinox the rotation is measured
 * against, which is why it is not simply linear in the day.
 */
export function greenwichMeanSiderealTime(jdUt1: number): number {
  const d = jdUt1 - 2451545.0;
  const t = d / 36525;
  return normalizeDeg(280.46061837 + 360.98564736629 * d + t * t * (0.000387933 - t / 38710000));
}

/**
 * Sidereal days per mean solar day: the sky turns through 360° of hour angle
 * in slightly less than a day of the clock, and the difference over a year is
 * the one extra turn the orbit adds.
 */
const SIDEREAL_DAYS_PER_SOLAR_DAY = 1.00273790935;

/**
 * The local mean time, in hours, at which the local sidereal time at
 * longitude `lonDeg` (east positive) next reaches `lstDeg`, searching forward
 * from the start of the UT1 day `jd0`.
 *
 * This is what turns `risingLst` in `sun.ts` into a clock: a star's rising is
 * a statement about sidereal time, and the sidereal time of a meridian is
 * Greenwich's plus the longitude, so the answer is how long the sky takes to
 * turn from where it stood at 0h UT to where the star wants it, at the
 * sidereal rate, read on the observer's own meridian.
 *
 * The hours are not wrapped into a day. The UT part of them is, by
 * construction, between 0 and 24; adding the longitude can carry the local
 * reading past midnight at either end, and saying so is more useful than
 * hiding which day the instant belongs to.
 */
export function localMeanTimeOfLst(lstDeg: number, lonDeg: number, jd0: number): number {
  const turn = normalizeDeg(lstDeg - (greenwichMeanSiderealTime(jd0) + lonDeg));
  return turn / 15 / SIDEREAL_DAYS_PER_SOLAR_DAY + lonDeg / 15;
}
