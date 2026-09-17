/**
 * The sun at a day and an hour, which is what a picture needs and a claim
 * does not.
 *
 * `sun.ts` answers where the sun rises at the equinox and the solstices,
 * without a date, because an alignment is a statement about a declination.
 * `solar.ts` adds the sun's place on any instant and the instants the seasons
 * turn on. This module is the last step for the viewer: give it a year, a day
 * of that year and a time on the observer's own clock, and it puts the sun in
 * the sky. Nothing else in the package needs it, and nothing in it is new
 * astronomy: it is the three conversions the other modules already carry,
 * done in order.
 *
 * The clock is local mean solar time on the observer's meridian, which is the
 * clock `datedSunEnvironment` reports sunrise on: no time zone, no summer
 * time, and no civil calendar reform beyond the proleptic Julian one
 * `calendar.ts` keeps.
 *
 * The hour angle comes from the equation of time and not from sidereal time,
 * which is a choice and the one place this file differs from the obvious
 * reading. Mean solar time is the hour angle of the fictitious mean sun, and
 * `equationOfTime` is the package's statement of where that sun is, so
 * subtracting it from the clock and reading the result as an hour angle is
 * the definition rather than a conversion. Going by `greenwichMeanSiderealTime`
 * instead would be the same thing only where the two polynomials it and Meeus
 * 25.2's mean longitude are fitted agree. They agree to a hundredth of a
 * degree at J2000 and drift apart by half a degree at 2450 BCE, both of them
 * being extrapolated four and a half thousand years past their range. Taking
 * the equation of time keeps `sunAt` and `datedSunEnvironment` talking about
 * one sun: asked for the hour that module calls sunrise, this one puts the
 * disc on the horizon, and the test checks exactly that against the sky bake.
 *
 * Angles are degrees, azimuth from north through east, to match `horizon.ts`
 * and the project's +X east, +Y north, +Z up frame.
 */
import { calendarYearOfEpoch, deltaT } from './calendar';
import { altAz, apparentAltitude, normalizeDeg } from './horizon';
import { equationOfTime, seasonInstant, solarDeclinationAndRa } from './solar';
import { SUN_STANDARD_ALTITUDE_DEG } from './sun';

export interface SunPosition {
  /** Azimuth from north through east, degrees in [0, 360). */
  azimuthDeg: number;
  /** Geometric altitude above the horizon, degrees; negative below it. */
  altitudeDeg: number;
  /**
   * The altitude the air lifts the disc to, for a sun that is up. Undefined
   * for a sun below the standard altitude, as in the sky bake: Bennett's
   * formula is about rising and setting and says nothing worth having about a
   * sun tens of degrees down.
   */
  apparentAltitudeDeg: number | undefined;
  /** The instant the place was computed for, as a Julian Ephemeris Day. */
  jde: number;
}

export interface SunAtOptions {
  /** Julian epoch in astronomical year numbering: 2450 BCE is -2449. */
  epoch: number;
  /**
   * Day of the year, 1 to 366, counted so that `EQUINOX_DAY` is the day the
   * March equinox falls on in the epoch's own year. In 2026 that is the
   * calendar's day of the year to within a day; at 10,500 BCE it is still the
   * season, where the calendar's day would be months out.
   */
  day: number;
  /** Local mean solar time in hours, 0 to 24. */
  hour: number;
  /** The observer's latitude in degrees, north positive. */
  latitudeDeg: number;
  /** The observer's longitude in degrees, east positive. */
  longitudeDeg: number;
}

/**
 * The day of the year the March equinox falls on in the modern calendar, and
 * so the day a moment's `day` counts from at every epoch: day 79 is the
 * equinox, day 172 the June solstice, day 355 the December solstice, in
 * 10,500 BCE as in 2026.
 *
 * Why not the calendar: the proleptic Julian year is eleven minutes longer
 * than the tropical one, so its dates drift through the seasons by a day
 * every 128 years, three months by 10,500 BCE, and delta T adds days more.
 * A reader who sets "21 December, 16:00" wants the low December sun, which
 * is a season and not a page of a calendar nobody kept. The epoch's own
 * equinox instant comes from `seasonInstant`, which is extrapolated that far
 * back and says so; the day it lands on is uncertain by days there, which is
 * nothing beside the months the calendar would be out by.
 */
export const EQUINOX_DAY = 79;

/**
 * The Julian Day in UT1 of a day of the year and an hour of local mean solar
 * time. The day counts from the local midnight that begins the March
 * equinox's own day in the epoch's year, and the longitude carries the clock
 * from the observer's meridian back to Greenwich.
 */
export function julianDayOfMoment({ epoch, day, hour, longitudeDeg }: Omit<SunAtOptions, 'latitudeDeg'>): number {
  const year = calendarYearOfEpoch(epoch);
  const meridian = longitudeDeg / 360;
  const equinox = seasonInstant(year, 'march-equinox') - deltaT(year) / 86400;
  const midnight = Math.floor(equinox + meridian + 0.5) - 0.5 - meridian;
  return midnight + (day - EQUINOX_DAY) + hour / 24;
}

/**
 * Where the sun stands over an observer at a Julian epoch, on a day of that
 * epoch's year counted from its March equinox, at an hour of local mean solar
 * time.
 *
 * The sun's own place comes from `solarDeclinationAndRa`, which is Meeus
 * chapter 25 at its low-precision setting: about 0.01 degrees, far inside
 * anything a picture or a reader could tell. What is not inside anything is
 * delta T, which is sixteen hours at 2450 BCE and six days at 10,500 BCE; it
 * is applied, and counting the day from the equinox is what keeps a season a
 * season through it.
 */
export function sunAt(options: SunAtOptions): SunPosition {
  const { epoch, hour, latitudeDeg } = options;
  const jde = julianDayOfMoment(options) + deltaT(calendarYearOfEpoch(epoch)) / 86400;
  const { raDeg, decDeg } = solarDeclinationAndRa(jde);
  // Apparent solar time is the clock plus the equation of time; noon is the
  // sun on the meridian, so the hour angle is the hours either side of it,
  // fifteen degrees to the hour. Sidereal time follows from the sun's own
  // right ascension, which is what `altAz` wants.
  const hourAngleDeg = (hour + equationOfTime(jde) / 60 - 12) * 15;
  const lstDeg = normalizeDeg(raDeg + hourAngleDeg);
  const { altDeg, azDeg } = altAz({ raDeg, decDeg, latDeg: latitudeDeg, lstDeg });
  return {
    azimuthDeg: azDeg,
    altitudeDeg: altDeg,
    apparentAltitudeDeg: altDeg < SUN_STANDARD_ALTITUDE_DEG ? undefined : apparentAltitude(altDeg),
    jde,
  };
}

/**
 * How far the sun has to be down before the sky is dark enough to be called
 * night: civil twilight's six degrees. It is a threshold for a picture, not a
 * measurement, and it is here rather than in the viewer so the viewer and any
 * other reader of the package agree on the word.
 */
export const NIGHT_ALTITUDE_DEG = -6;

/** True when the sun is above the horizon, on the same convention as a published sunrise. */
export function sunIsUp(sun: SunPosition): boolean {
  return sun.altitudeDeg >= SUN_STANDARD_ALTITUDE_DEG;
}
