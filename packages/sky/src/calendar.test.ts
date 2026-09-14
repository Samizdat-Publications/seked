import { describe, expect, it } from 'vitest';
import { normalizeDeg } from './horizon';
import {
  GREGORIAN_START_JD,
  calendarDate,
  calendarYearOfEpoch,
  deltaT,
  greenwichMeanSiderealTime,
  jdToJulianEpoch,
  julianDay,
  julianEpochToJd,
  localMeanTimeOfLst,
} from './calendar';

/** The longitude of the Great Pyramid's base centre, from data/sites.json. */
const GIZA_LONGITUDE = 31.134167;

describe("the Julian Day, against Meeus's worked examples", () => {
  it('turns his three examples into the Julian Days he prints', () => {
    // Meeus, Astronomical Algorithms, 2nd ed., chapter 7: Sputnik 1's launch
    // in the Gregorian calendar, a fourth-century date in the Julian one, and
    // the zero of the count itself.
    expect(julianDay(1957, 10, 4.81)).toBeCloseTo(2436116.31, 6);
    expect(julianDay(333, 1, 27.5)).toBe(1842713.0);
    expect(julianDay(-4712, 1, 1.5)).toBe(0);
  });

  it('reproduces the rest of his table 7.A, ancient dates included', () => {
    const table: [number, number, number, number][] = [
      [2000, 1, 1.5, 2451545.0],
      [1987, 1, 27.0, 2446822.5],
      [1987, 4, 10.0, 2446895.5],
      [1900, 1, 1.0, 2415020.5],
      [837, 4, 10.3, 2026871.8],
      [-1000, 7, 12.5, 1356001.0],
      [-1000, 2, 29.0, 1355866.5],
      [-1001, 8, 17.9, 1355671.4],
    ];
    for (const [year, month, day, jd] of table) {
      expect(julianDay(year, month, day), `${year}-${month}-${day}`).toBeCloseTo(jd, 6);
    }
  });

  it('puts J2000 where its definition puts it, 2000 January 1.5 = JD 2451545.0', () => {
    expect(julianDay(2000, 1, 1.5)).toBe(2451545.0);
    expect(julianEpochToJd(2000)).toBe(2451545.0);
    expect(jdToJulianEpoch(2451545.0)).toBe(2000);
  });

  it('closes the ten days of 1582 without a gap in the count', () => {
    // 1582 October 4 in the Julian calendar was followed by October 15 in the
    // Gregorian: eleven days apart on the page, one day apart in the sky.
    expect(julianDay(1582, 10, 4.0)).toBe(2299159.5);
    expect(julianDay(1582, 10, 15.0)).toBe(GREGORIAN_START_JD);
    expect(julianDay(1582, 10, 15.0) - julianDay(1582, 10, 4.0)).toBe(1);
  });
});

describe('the calendar date back out of a Julian Day', () => {
  it("inverts Meeus's examples", () => {
    expect(calendarDate(2436116.31)).toEqual({ year: 1957, month: 10, day: expect.closeTo(4.81, 6) });
    expect(calendarDate(1842713.0)).toEqual({ year: 333, month: 1, day: 27.5 });
    expect(calendarDate(0)).toEqual({ year: -4712, month: 1, day: 1.5 });
  });

  it('switches calendars on the same instant `julianDay` switches on', () => {
    expect(calendarDate(GREGORIAN_START_JD)).toEqual({ year: 1582, month: 10, day: 15 });
    expect(calendarDate(GREGORIAN_START_JD - 1)).toEqual({ year: 1582, month: 10, day: 4 });
  });

  it('round trips a spread of dates, the ancient ones included', () => {
    const dates: [number, number, number][] = [
      [-10499, 6, 21.25],
      [-10499, 12, 31.75],
      [-4712, 1, 1.5],
      [-2449, 7, 5.5],
      [-2450, 12, 19.25],
      [-1000, 2, 29.0],
      [0, 1, 1.0],
      [837, 4, 10.3],
      [1582, 10, 4.0],
      [1582, 10, 15.0],
      [1957, 10, 4.81],
      [2026, 3, 20.6],
    ];
    for (const [year, month, day] of dates) {
      const back = calendarDate(julianDay(year, month, day));
      expect(back.year, `${year}-${month}-${day}`).toBe(year);
      expect(back.month, `${year}-${month}-${day}`).toBe(month);
      expect(back.day, `${year}-${month}-${day}`).toBeCloseTo(day, 6);
    }
  });

  it('round trips every Julian Day of a year of the third millennium BCE', () => {
    const start = julianDay(-2449, 1, 1.0);
    for (let jd = start; jd < start + 365; jd += 1) {
      const { year, month, day } = calendarDate(jd);
      expect(julianDay(year, month, day), `JD ${jd}`).toBe(jd);
    }
  });
});

describe('the Julian epoch the rest of the package counts in', () => {
  it('is 365.25 days long and round trips', () => {
    expect(julianEpochToJd(2001) - julianEpochToJd(2000)).toBeCloseTo(365.25, 9);
    for (const epj of [-10499, -2449, 0, 1987.5, 2026]) {
      expect(jdToJulianEpoch(julianEpochToJd(epj)), `${epj}`).toBeCloseTo(epj, 9);
    }
  });

  it('starts a fortnight before the calendar year of the same number in 2450 BCE', () => {
    // The drift between a year of exactly 365.25 days and a calendar whose
    // years start on whole days: J−2449.0 is −2450 December 19, not −2449
    // January 1, which is why the year is read from the middle of the epoch.
    expect(calendarDate(julianEpochToJd(-2449))).toEqual({ year: -2450, month: 12, day: 19.25 });
    expect(calendarYearOfEpoch(-2449)).toBe(-2449);
    expect(calendarYearOfEpoch(-10499)).toBe(-10499);
    expect(calendarYearOfEpoch(2000)).toBe(2000);
    expect(calendarYearOfEpoch(2026)).toBe(2026);
  });
});

describe('ΔT, the drift of the Earth from uniform time', () => {
  it('is the vertex of the Stephenson, Morrison and Hohenkerk parabola in 1825', () => {
    expect(deltaT(1825)).toBe(-320);
  });

  it('is 16h 24m at 2450 BCE and 5.71 days at 10,500 BCE', () => {
    expect(deltaT(-2449)).toBeCloseTo(59047.997, 3);
    expect(deltaT(-2449) / 3600).toBeCloseTo(16.4022, 4);
    expect(deltaT(-10499)).toBeCloseTo(493293.172, 3);
    expect(deltaT(-10499) / 86400).toBeCloseTo(5.7094, 4);
  });

  it('is symmetric about 1825 and grows without limit either way', () => {
    expect(deltaT(1825 + 900)).toBeCloseTo(deltaT(1825 - 900), 9);
    expect(deltaT(-10499)).toBeGreaterThan(deltaT(-2449));
    expect(deltaT(-2449)).toBeGreaterThan(deltaT(1825));
  });

  it('is the wrong tool inside the tabulated centuries, by about four minutes in 2026', () => {
    // The observed value is near +69 s. The parabola is the long-term one and
    // says −189: no clock time this package quotes is in this range.
    expect(deltaT(2026)).toBeCloseTo(-188.7, 1);
    expect(Math.abs(deltaT(2026) - 69)).toBeGreaterThan(240);
  });
});

describe('sidereal time as a clock', () => {
  it("reproduces Meeus example 12.a: 1987 April 10 at 0h UT is 13h 10m 46.3668s", () => {
    const gmst = greenwichMeanSiderealTime(julianDay(1987, 4, 10.0));
    expect(gmst).toBeCloseTo(197.693195, 6);
    const seconds = (gmst / 15) * 3600;
    expect(seconds).toBeCloseTo(13 * 3600 + 10 * 60 + 46.3668, 3);
  });

  it('is 18h 41m 50.55s at J2000, the constant term of the polynomial', () => {
    expect(greenwichMeanSiderealTime(2451545.0)).toBeCloseTo(280.46061837, 8);
    expect((greenwichMeanSiderealTime(2451545.0) / 15) * 3600).toBeCloseTo(18 * 3600 + 41 * 60 + 50.548, 2);
  });

  it('gains the extra turn a year of orbit adds: 360.9856° a day', () => {
    for (const jd of [2451545.0, 826547.75, 2446895.5]) {
      const gained = normalizeDeg(greenwichMeanSiderealTime(jd + 1) - greenwichMeanSiderealTime(jd));
      expect(gained, `JD ${jd}`).toBeCloseTo(0.98564736629, 5);
    }
    expect(greenwichMeanSiderealTime(2451545.0)).toBeGreaterThanOrEqual(0);
    expect(greenwichMeanSiderealTime(2451545.0)).toBeLessThan(360);
  });

  it('finds the time of day a sidereal time falls at, and is its own inverse', () => {
    const jd0 = julianDay(1987, 4, 10.0);
    // 0h UT is where Meeus's own sidereal time belongs, on the Greenwich meridian.
    expect(localMeanTimeOfLst(greenwichMeanSiderealTime(jd0), 0, jd0)).toBeCloseTo(0, 9);
    for (const lonDeg of [0, GIZA_LONGITUDE, -75]) {
      for (const lstDeg of [0, 47.5, 197.693195, 312]) {
        const lmt = localMeanTimeOfLst(lstDeg, lonDeg, jd0);
        const ut = lmt - lonDeg / 15;
        expect(ut, `lon ${lonDeg}, lst ${lstDeg}`).toBeGreaterThanOrEqual(0);
        expect(ut, `lon ${lonDeg}, lst ${lstDeg}`).toBeLessThan(24);
        const at = greenwichMeanSiderealTime(jd0 + ut / 24) + lonDeg;
        // Wrapped into ±180 so an answer a hair short of a full turn reads as
        // the small error it is rather than as 360 degrees.
        expect(normalizeDeg(at - lstDeg + 180) - 180, `lon ${lonDeg}, lst ${lstDeg}`).toBeCloseTo(0, 6);
      }
    }
  });

  it("puts Giza's meridian two hours and five minutes ahead of Greenwich", () => {
    const jd0 = julianDay(1987, 4, 10.0);
    const gmst = greenwichMeanSiderealTime(jd0);
    expect(localMeanTimeOfLst(gmst + GIZA_LONGITUDE, GIZA_LONGITUDE, jd0)).toBeCloseTo(GIZA_LONGITUDE / 15, 9);
    expect(GIZA_LONGITUDE / 15).toBeCloseTo(2.0756, 4);
  });
});
