import { describe, expect, it } from 'vitest';
import { calendarDate, calendarYearOfEpoch, deltaT, jdToJulianEpoch, julianDay } from './calendar';
import { normalizeDeg } from './horizon';
import { SEASON_EVENTS, datedSunEnvironment, equationOfTime, seasonInstant, solarDeclinationAndRa, solarLongitude } from './solar';
import { obliquityOfDate } from './sun';

const D2R = Math.PI / 180;
/** Meeus's worked date through chapters 25 and 28: 1992 October 13.0 TD. */
const MEEUS_JDE = 2448908.5;
const arcsec = (deg: number): number => deg * 3600;
/** The Great Pyramid's base centre, from data/sites.json. */
const GIZA_LATITUDE = 29.979167;
const GIZA_LONGITUDE = 31.134167;

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
    // the solstice walks forward through the proleptic Julian calendar going
    // back, by about 0.78 of a day a century, which is one day in 128 years.
    // In that calendar the solstice of 1962 falls on 8 June and the solstice
    // of 2450 BCE on 15 July, about 36 days over the 44 centuries between
    // them. `calendarDate` reports dates after 1582 in the Gregorian calendar,
    // where the first of those two is 21 June, so it is only the older date
    // this test can ask it for.
    const date = calendarDate(seasonInstant(-2449, 'june-solstice'));
    expect(date.year).toBe(-2449);
    expect(date.month).toBe(7);
    expect(Math.floor(date.day)).toBe(15);
  });
});

describe('the dated sun in the claim environment', () => {
  const giza = { latitudeDeg: GIZA_LATITUDE, longitudeDeg: GIZA_LONGITUDE };
  const env = datedSunEnvironment({ epoch: -2449, ...giza });

  it('gives each of the four events four keys the expression parser can read', () => {
    expect(Object.keys(env)).toHaveLength(SEASON_EVENTS.length * 4);
    for (const key of Object.keys(env)) expect(key).toMatch(/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$/);
    for (const event of ['march_equinox', 'june_solstice', 'september_equinox', 'december_solstice']) {
      for (const suffix of ['jd', 'equation_of_time', 'rise.local_mean_time', 'set.local_mean_time']) {
        expect(env[`sun.${event}.${suffix}`], `sun.${event}.${suffix}`).toBeTypeOf('number');
      }
    }
  });

  it("dates the events in the epoch's calendar year and nothing else", () => {
    expect(calendarYearOfEpoch(-2449)).toBe(-2449);
    for (const event of SEASON_EVENTS) {
      expect(env[`sun.${event.replace('-', '_')}.jd`], event).toBe(seasonInstant(-2449, event));
    }
  });

  it('puts the June solstice of 2450 BCE on 14 July at Giza, sunrise 04:49 and sunset 18:56', () => {
    // The instant is 15 July in TT; sixteen hours of ΔT and two of longitude
    // put it on the evening of the 14th where the observer stands.
    const local = calendarDate((env['sun.june_solstice.jd'] as number) - deltaT(-2449) / 86400 + GIZA_LONGITUDE / 360);
    expect(local.year).toBe(-2449);
    expect(local.month).toBe(7);
    expect(Math.floor(local.day)).toBe(14);
    expect((local.day % 1) * 24).toBeCloseTo(17.55, 1);
    expect((env['sun.june_solstice.rise.local_mean_time'] as number) * 60).toBeCloseTo(4 * 60 + 48.6, 0);
    expect((env['sun.june_solstice.set.local_mean_time'] as number) * 60).toBeCloseTo(18 * 60 + 56.0, 0);
  });

  it('hangs sunrise and sunset symmetrically about noon, displaced by the equation of time', () => {
    for (const event of SEASON_EVENTS) {
      const prefix = `sun.${event.replace('-', '_')}`;
      const rise = env[`${prefix}.rise.local_mean_time`] as number;
      const set = env[`${prefix}.set.local_mean_time`] as number;
      const minutes = env[`${prefix}.equation_of_time`] as number;
      expect(Math.abs(minutes), event).toBeLessThan(17);
      expect(rise + set, event).toBeCloseTo(24 - (2 * minutes) / 60, 9);
    }
  });

  it('makes the June solstice the longest day at Giza and the December one the shortest', () => {
    const length = (event: string): number =>
      (env[`sun.${event}.set.local_mean_time`] as number) - (env[`sun.${event}.rise.local_mean_time`] as number);
    expect(length('june_solstice')).toBeCloseTo(14.13, 1);
    expect(length('december_solstice')).toBeCloseTo(10.16, 1);
    // The equinoxes give a little over twelve hours, not exactly twelve: the
    // event called is the upper limb on a refracted horizon, half a degree
    // before and after the centre would cross it.
    expect(length('march_equinox')).toBeGreaterThan(12);
    expect(length('march_equinox')).toBeLessThan(12.25);
    expect(length('september_equinox')).toBeCloseTo(length('march_equinox'), 1);
  });

  it('moves with the longitude, because local noon is a different instant on another meridian', () => {
    const greenwich = datedSunEnvironment({ epoch: -2449, latitudeDeg: GIZA_LATITUDE });
    for (const event of SEASON_EVENTS) {
      const prefix = `sun.${event.replace('-', '_')}`;
      // The instant is in TT and belongs to no meridian.
      expect(greenwich[`${prefix}.jd`], event).toBe(env[`${prefix}.jd`]);
      const moved = Math.abs((greenwich[`${prefix}.rise.local_mean_time`] as number) - (env[`${prefix}.rise.local_mean_time`] as number));
      expect(moved, event).toBeGreaterThan(0);
      expect(moved * 60, event).toBeLessThan(1);
    }
    // Far enough round and the event falls on another local day altogether,
    // which is a whole day of the sun's motion rather than two hours of it.
    const antipodes = datedSunEnvironment({ epoch: 2026, latitudeDeg: GIZA_LATITUDE, longitudeDeg: 179 });
    const here = datedSunEnvironment({ epoch: 2026, latitudeDeg: GIZA_LATITUDE });
    const apart = Math.abs((antipodes['sun.december_solstice.equation_of_time'] as number) - (here['sun.december_solstice.equation_of_time'] as number));
    expect(apart).toBeGreaterThan(0.1);
  });

  it('has nothing to say where the sun does not rise or set that day', () => {
    const svalbard = datedSunEnvironment({ epoch: 2026, latitudeDeg: 78, longitudeDeg: 15 });
    expect(svalbard['sun.june_solstice.rise.local_mean_time']).toBeNaN();
    expect(svalbard['sun.december_solstice.set.local_mean_time']).toBeNaN();
    expect(Number.isNaN(svalbard['sun.march_equinox.rise.local_mean_time'])).toBe(false);
  });

  it('carries 10,500 BCE too, five days of ΔT and all', () => {
    const ancient = datedSunEnvironment({ epoch: -10499, ...giza });
    expect(deltaT(-10499) / 86400).toBeCloseTo(5.709, 3);
    const local = calendarDate((ancient['sun.june_solstice.jd'] as number) - deltaT(-10499) / 86400 + GIZA_LONGITUDE / 360);
    // Late August in the proleptic Julian calendar, which is where a quartic
    // fitted between 1000 BCE and 1000 CE puts it eight thousand years early.
    expect(local.year).toBe(-10499);
    expect(local.month).toBe(8);
    expect(ancient['sun.june_solstice.rise.local_mean_time'] as number).toBeCloseTo(4.95, 1);
  });
});
