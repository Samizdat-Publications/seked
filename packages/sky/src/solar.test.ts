import { describe, expect, it } from 'vitest';
import { calendarDate, jdToJulianEpoch, julianDay } from './calendar';
import { normalizeDeg } from './horizon';
import { SEASON_EVENTS, equationOfTime, seasonInstant, solarDeclinationAndRa, solarLongitude } from './solar';
import { obliquityOfDate } from './sun';

const D2R = Math.PI / 180;
/** Meeus's worked date through chapters 25 and 28: 1992 October 13.0 TD. */
const MEEUS_JDE = 2448908.5;
const arcsec = (deg: number): number => deg * 3600;

/**
 * Meeus's low-accuracy equation of time, equation 28.3, after Smart: the same
 * quantity built out of the orbit's shape rather than out of the sun's right
 * ascension, so it shares no line of arithmetic with 28.1 beyond the mean
 * longitude and the mean anomaly. Kept here and nowhere else, as the second
 * opinion the package's own answer is measured against. `y` is tan²(ε/2), the
 * obliquity's whole contribution, and the result is in minutes of time.
 */
function smartEquationOfTime(jde: number): number {
  const t = (jde - 2451545.0) / 36525;
  const l0 = (280.46646 + 36000.76983 * t + 0.0003032 * t * t) * D2R;
  const m = (357.52911 + 35999.05029 * t - 0.0001537 * t * t) * D2R;
  const e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
  const y = Math.tan((obliquityOfDate(jdToJulianEpoch(jde)) * D2R) / 2) ** 2;
  const radians =
    y * Math.sin(2 * l0) -
    2 * e * Math.sin(m) +
    4 * e * y * Math.sin(m) * Math.cos(2 * l0) -
    0.5 * y * y * Math.sin(4 * l0) -
    1.25 * e * e * Math.sin(2 * m);
  return (radians / D2R) * 4;
}

describe("the sun's place, against Meeus example 25.a", () => {
  it('puts its apparent longitude within a fifth of an arcsecond of his 199.90895°', () => {
    expect(julianDay(1992, 10, 13.0)).toBe(MEEUS_JDE);
    expect(Math.abs(arcsec(solarLongitude(MEEUS_JDE) - 199.90895))).toBeLessThan(0.2);
  });

  it('gives his right ascension, 13h 13m 31.4s, to a tenth of a second of time', () => {
    const { raDeg } = solarDeclinationAndRa(MEEUS_JDE);
    expect(Math.abs(arcsec(raDeg - 198.38083))).toBeLessThan(0.5);
    expect((raDeg / 15) * 3600).toBeCloseTo(13 * 3600 + 13 * 60 + 31.4, 1);
  });

  it("gives his declination, −7° 47′ 06″, to half an arcsecond", () => {
    const { decDeg } = solarDeclinationAndRa(MEEUS_JDE);
    // The half arcsecond is the nutation in obliquity, which this package
    // leaves out on purpose: the obliquity is the Vondrák one the stars and
    // the solstice azimuths use, and it is a mean obliquity.
    expect(Math.abs(arcsec(decDeg - -7.78507))).toBeLessThan(0.5);
    expect(decDeg).toBeCloseTo(-7.78507, 3);
  });

  it('uses the obliquity the rest of the package uses and no other', () => {
    // At a solstice the sun's declination is the obliquity by definition, so
    // if a second obliquity had crept in this would be the difference.
    for (const year of [2026, -2449]) {
      const jde = seasonInstant(year, 'june-solstice');
      const { decDeg } = solarDeclinationAndRa(jde);
      expect(decDeg, `${year}`).toBeCloseTo(obliquityOfDate(jdToJulianEpoch(jde)), 1);
    }
  });

  it('walks the ecliptic once a year, a degree at a time', () => {
    const jd = julianDay(2026, 1, 1.0);
    expect(normalizeDeg(solarLongitude(jd + 1) - solarLongitude(jd))).toBeCloseTo(1.019, 2);
    expect(normalizeDeg(solarLongitude(jd + 365.2422) - solarLongitude(jd))).toBeLessThan(0.01);
    // Northern declination in the northern summer, southern in the winter.
    expect(solarDeclinationAndRa(julianDay(2026, 6, 21.0)).decDeg).toBeGreaterThan(23);
    expect(solarDeclinationAndRa(julianDay(2026, 12, 21.0)).decDeg).toBeLessThan(-23);
  });
});

describe('the equation of time', () => {
  it("is +13m 42s at Meeus's date, within a second of the +13m 42.6s he prints", () => {
    const minutes = equationOfTime(MEEUS_JDE);
    // The shortfall is the low-accuracy sun itself: chapter 25's series puts
    // the right ascension 0.1″ from the VSOP87 value example 28.a is built on,
    // and a hundredth of a degree of longitude is a second of time here.
    expect(Math.abs(minutes - (13 + 42.6 / 60))).toBeLessThan(1 / 60);
    expect(Math.abs(minutes - smartEquationOfTime(MEEUS_JDE)) * 60).toBeLessThan(1);
  });

  it('agrees with Meeus 28.3 to a few seconds of time, today and in 2450 BCE', () => {
    for (const year of [2026, -2449]) {
      let worst = 0;
      for (let jd = julianDay(year, 1, 1.0); jd < julianDay(year + 1, 1, 1.0); jd += 1) {
        worst = Math.max(worst, Math.abs(equationOfTime(jd) - smartEquationOfTime(jd)));
      }
      expect(worst * 60, `${year}: ${(worst * 60).toFixed(2)} s`).toBeLessThan(5);
    }
  });

  it('reaches −14.2 minutes in mid February and +16.4 in early November', () => {
    let low = { minutes: 99, jd: 0 };
    let high = { minutes: -99, jd: 0 };
    for (let jd = julianDay(2026, 1, 1.0); jd < julianDay(2027, 1, 1.0); jd += 1) {
      const minutes = equationOfTime(jd);
      if (minutes < low.minutes) low = { minutes, jd };
      if (minutes > high.minutes) high = { minutes, jd };
    }
    expect(low.minutes).toBeCloseTo(-14.2, 1);
    expect(calendarDate(low.jd).month).toBe(2);
    expect(calendarDate(low.jd).day).toBeCloseTo(11, 0);
    expect(high.minutes).toBeCloseTo(16.44, 1);
    expect(calendarDate(high.jd).month).toBe(11);
    expect(calendarDate(high.jd).day).toBeCloseTo(3, 0);
  });

  it('crosses zero four times a year, which is the analemma closing on itself', () => {
    const crossings: number[] = [];
    let previous = equationOfTime(julianDay(2026, 1, 1.0));
    for (let jd = julianDay(2026, 1, 2.0); jd < julianDay(2027, 1, 1.0); jd += 1) {
      const minutes = equationOfTime(jd);
      if (previous < 0 !== minutes < 0) crossings.push(calendarDate(jd).month);
      previous = minutes;
    }
    // Mid April, mid June, the start of September and Christmas, as any
    // published analemma has them.
    expect(crossings).toEqual([4, 6, 9, 12]);
  });
});

describe('the instants of the seasons', () => {
  it('reproduces Meeus example 27.a, the June solstice of 1962, to the second', () => {
    const jde = seasonInstant(1962, 'june-solstice');
    expect(Math.abs(jde - 2437837.39245) * 86400).toBeLessThan(1);
    const date = calendarDate(jde);
    expect(date.year).toBe(1962);
    expect(date.month).toBe(6);
    expect(Math.floor(date.day)).toBe(21);
    expect((date.day % 1) * 24).toBeCloseTo(21.42, 1);
  });

  it('puts the 2026 March equinox within five minutes of the published 14h 46m UTC', () => {
    // The almanac figure for 2026 March 20. ΔT is about +69 s in this decade,
    // which the long-term parabola in `calendar.ts` does not know and is not
    // asked: it is spelled out here because a published equinox is in UTC and
    // `seasonInstant` answers in TT.
    const ut = seasonInstant(2026, 'march-equinox') - 69 / 86400;
    expect(Math.abs(ut - julianDay(2026, 3, 20 + (14 + 46 / 60) / 24)) * 1440).toBeLessThan(5);
  });

  it('agrees with chapter 25 about where the sun is at the moment it names', () => {
    // Two independent series: chapter 27's polynomials for the instant and
    // chapter 25's for the longitude. Inside Meeus's range and at 2450 BCE
    // they agree to a couple of arcminutes; at 10,500 BCE both are far outside
    // the range they were fitted over and the gap opens to five degrees, which
    // is five days of the sun's motion and the honest size of that answer.
    for (const year of [2026, 1962, -2449]) {
      SEASON_EVENTS.forEach((event, quarter) => {
        const longitude = solarLongitude(seasonInstant(year, event));
        const off = normalizeDeg(longitude - 90 * quarter + 180) - 180;
        expect(Math.abs(off), `${year} ${event}: ${off.toFixed(4)}°`).toBeLessThan(0.05);
      });
    }
    SEASON_EVENTS.forEach((event, quarter) => {
      const off = normalizeDeg(solarLongitude(seasonInstant(-10499, event)) - 90 * quarter + 180) - 180;
      expect(Math.abs(off), `-10499 ${event}: ${off.toFixed(4)}°`).toBeLessThan(6);
    });
  });

  it('orders the four events and spaces them a season apart', () => {
    const instants = SEASON_EVENTS.map((event) => seasonInstant(2026, event));
    for (let i = 1; i < instants.length; i++) {
      const gap = (instants[i] as number) - (instants[i - 1] as number);
      expect(gap, `${SEASON_EVENTS[i]}`).toBeGreaterThan(88);
      expect(gap, `${SEASON_EVENTS[i]}`).toBeLessThan(95);
    }
    expect(seasonInstant(2027, 'june-solstice') - seasonInstant(2026, 'june-solstice')).toBeCloseTo(365.2422, 1);
  });

  it('puts the June solstice of 2450 BCE in July, where the Julian calendar drifts it to', () => {
    // A calendar year of 365.25 days is 11 minutes longer than the sun's, so
    // the solstice walks forward through the proleptic Julian calendar at
    // about three days a century going back: 1962's June 21 becomes July 15.
    const date = calendarDate(seasonInstant(-2449, 'june-solstice'));
    expect(date.year).toBe(-2449);
    expect(date.month).toBe(7);
    expect(Math.floor(date.day)).toBe(15);
  });
});
