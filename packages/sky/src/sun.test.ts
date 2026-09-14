import { describe, expect, it } from 'vitest';
import { altAz, normalizeDeg } from './horizon';
import {
  SUN_STANDARD_ALTITUDE_DEG,
  hourAngleAtAltitude,
  obliquityOfDate,
  risingAzimuth,
  risingLst,
  settingAzimuth,
  settingLst,
  sunEnvironment,
} from './sun';

const GIZA = 29.979167;

/**
 * The obliquity at J2000 as the IAU 2006 precession-nutation model has it,
 * ε₀ = 84381.406″ (Hilton et al. 2006; IERS Conventions 2010, table 1.1). It
 * is the constant `vondrak.ts` builds its ecliptic pole on, so the angle
 * between the two poles at t = 0 has to come back as exactly this.
 */
const EPS0_ARCSEC = 84381.406;

/**
 * Laskar (1986), as printed in Meeus, Astronomical Algorithms, 2nd ed.,
 * equation 22.3: the obliquity in arcseconds for U = centuries/100 from
 * J2000, good to about 0.01″ over ±1000 years of J2000 and a few arcseconds
 * out to ±10,000. A second, independent model, kept here and nowhere else,
 * so the Vondrák-derived obliquity is checked against something that is not
 * itself Vondrák.
 */
function laskarObliquityDeg(epj: number): number {
  const u = (epj - 2000) / 10000;
  const c = [
    -4680.93, -1.55, 1999.25, -51.38, -249.67, -39.05, 7.12, 27.87, 5.79, 2.45,
  ];
  let arcsec = 23 * 3600 + 26 * 60 + 21.448;
  let power = u;
  for (const k of c) {
    arcsec += k * power;
    power *= u;
  }
  return arcsec / 3600;
}

describe('the obliquity of date, from the angle between the two Vondrák poles', () => {
  it('is the IAU 2006 obliquity at J2000, to the last digit of the constant', () => {
    // The two series vanish at t = 0, so this is the constant itself, less
    // the microarcsecond an arccosine costs in double precision.
    expect(obliquityOfDate(2000) * 3600).toBeCloseTo(EPS0_ARCSEC, 4);
    expect(obliquityOfDate(2000)).toBeCloseTo(23.4392794, 7);
  });

  it('is about 23.44 degrees today and between 23.93 and 24.0 near 2500 BCE', () => {
    expect(obliquityOfDate(2026)).toBeGreaterThan(23.43);
    expect(obliquityOfDate(2026)).toBeLessThan(23.45);
    const then = obliquityOfDate(-2499);
    expect(then).toBeGreaterThan(23.93);
    expect(then).toBeLessThan(24.0);
  });

  it("agrees with Laskar's polynomial within 20 arcseconds from 4500 BCE to now", () => {
    for (let epj = -4500; epj <= 2000; epj += 250) {
      const difference = Math.abs(obliquityOfDate(epj) - laskarObliquityDeg(epj)) * 3600;
      expect(difference, `epoch ${epj}: ${difference.toFixed(2)}"`).toBeLessThan(20);
    }
  });

  it('was near its long-term maximum, about 24.2 degrees, around 7500 BCE', () => {
    const max = obliquityOfDate(-7529);
    expect(max).toBeGreaterThan(24.1);
    expect(max).toBeLessThan(24.3);
    expect(max).toBeGreaterThan(obliquityOfDate(-2499));
  });
});

describe('where a body of a given declination crosses the horizon', () => {
  it('rises due east and sets due west on the equator of date, at every latitude', () => {
    for (const lat of [0, 29.979167, -45, 60]) {
      expect(risingAzimuth(0, lat, 0), `lat ${lat}`).toBeCloseTo(90, 12);
      expect(settingAzimuth(0, lat, 0), `lat ${lat}`).toBeCloseTo(270, 12);
    }
  });

  it('puts a northern declination north of east and a southern one south of it', () => {
    expect(risingAzimuth(20, GIZA, 0)).toBeLessThan(90);
    expect(risingAzimuth(-20, GIZA, 0)).toBeGreaterThan(90);
    // The two are mirror images in the east-west line, which is the symmetry
    // the whole construction rests on.
    expect(risingAzimuth(-20, GIZA, 0)).toBeCloseTo(180 - risingAzimuth(20, GIZA, 0), 12);
    expect(settingAzimuth(20, GIZA, 0)).toBeCloseTo(360 - risingAzimuth(20, GIZA, 0), 12);
  });

  it('has nothing to say about a body that never reaches the altitude', () => {
    // Circumpolar from Giza: it never touches the horizon at all.
    expect(risingAzimuth(75, GIZA, 0)).toBeNaN();
    expect(settingAzimuth(75, GIZA, 0)).toBeNaN();
    expect(hourAngleAtAltitude(75, GIZA, 0)).toBeNaN();
    // Never rises: the same answer from the other side.
    expect(risingAzimuth(-75, GIZA, 0)).toBeNaN();
    expect(risingLst(123, -75, GIZA, 0)).toBeNaN();
    expect(settingLst(123, -75, GIZA, 0)).toBeNaN();
  });

  it('agrees with the horizon frame: at the rising sidereal time the body is there', () => {
    for (const [dec, alt] of [[0, 0], [12, 0], [-9.4, 0], [23.9, SUN_STANDARD_ALTITUDE_DEG], [-23.9, SUN_STANDARD_ALTITUDE_DEG]] as [number, number][]) {
      const raDeg = 137.5;
      const rise = altAz({ raDeg, decDeg: dec, latDeg: GIZA, lstDeg: risingLst(raDeg, dec, GIZA, alt) });
      expect(rise.altDeg, `dec ${dec} rise altitude`).toBeCloseTo(alt, 9);
      expect(rise.azDeg, `dec ${dec} rise azimuth`).toBeCloseTo(risingAzimuth(dec, GIZA, alt), 9);
      const set = altAz({ raDeg, decDeg: dec, latDeg: GIZA, lstDeg: settingLst(raDeg, dec, GIZA, alt) });
      expect(set.altDeg, `dec ${dec} set altitude`).toBeCloseTo(alt, 9);
      expect(set.azDeg, `dec ${dec} set azimuth`).toBeCloseTo(settingAzimuth(dec, GIZA, alt), 9);
    }
  });

  it('rises before it transits and sets after, by the same hour angle', () => {
    const raDeg = 40;
    const h = hourAngleAtAltitude(10, GIZA, 0);
    expect(h).toBeGreaterThan(0);
    expect(risingLst(raDeg, 10, GIZA, 0)).toBeCloseTo(normalizeDeg(raDeg - h), 12);
    expect(settingLst(raDeg, 10, GIZA, 0)).toBeCloseTo(normalizeDeg(raDeg + h), 12);
  });
});

describe('the sun at the equinox and the solstices', () => {
  const env = sunEnvironment({ epoch: -2499, latitudeDeg: GIZA });

  it('carries the obliquity and the six azimuths the claims name', () => {
    expect(env['sun.obliquity']).toBeCloseTo(obliquityOfDate(-2499), 12);
    for (const key of [
      'sun.equinox.rise.azimuth',
      'sun.equinox.set.azimuth',
      'sun.solstice.summer.rise.azimuth',
      'sun.solstice.summer.set.azimuth',
      'sun.solstice.winter.rise.azimuth',
      'sun.solstice.winter.set.azimuth',
    ]) {
      expect(env[key], key).toBeTypeOf('number');
      expect(Number.isFinite(env[key] as number), key).toBe(true);
    }
  });

  it('puts the equinox sunrise a little north of east, which is the upper limb', () => {
    // Declination zero would rise at exactly 90 on the geometric horizon; the
    // −0.833° the limb is called at moves it about half a degree north.
    const rise = env['sun.equinox.rise.azimuth'] as number;
    expect(rise).toBeLessThan(90);
    expect(90 - rise).toBeGreaterThan(0.3);
    expect(90 - rise).toBeLessThan(0.8);
    expect(env['sun.equinox.set.azimuth']).toBeCloseTo(360 - rise, 12);
  });

  it('swings the solstices symmetrically about the equinox, summer north of it', () => {
    const summer = env['sun.solstice.summer.rise.azimuth'] as number;
    const winter = env['sun.solstice.winter.rise.azimuth'] as number;
    const equinox = env['sun.equinox.rise.azimuth'] as number;
    expect(summer).toBeLessThan(equinox);
    expect(winter).toBeGreaterThan(equinox);
    // The symmetry is exact in the cosine rather than in the angle, because
    // cos A is linear in sin δ and the two solstice declinations cancel. In
    // the angle itself the −0.833° the limb is called at leaves about 8′.
    const cos = (deg: number): number => Math.cos((deg * Math.PI) / 180);
    expect(cos(summer) + cos(winter)).toBeCloseTo(2 * cos(equinox), 12);
    expect(Math.abs(summer + winter - 2 * equinox)).toBeLessThan(0.2);
    expect(env['sun.solstice.summer.set.azimuth']).toBeCloseTo(360 - summer, 12);
  });

  it('sets the summer solstice sun north-west of Giza, around 298 degrees in 2500 BCE', () => {
    const set = env['sun.solstice.summer.set.azimuth'] as number;
    expect(set).toBeGreaterThan(297);
    expect(set).toBeLessThan(300);
  });

  it('moves the solstice azimuths out with the obliquity: 2500 BCE is wider than today', () => {
    const now = sunEnvironment({ epoch: 2000, latitudeDeg: GIZA });
    expect(env['sun.solstice.summer.rise.azimuth'] as number).toBeLessThan(now['sun.solstice.summer.rise.azimuth'] as number);
    expect(env['sun.solstice.winter.rise.azimuth'] as number).toBeGreaterThan(now['sun.solstice.winter.rise.azimuth'] as number);
  });

  it('names the sidereal time of each event, the equinox sunrise from right ascension zero', () => {
    // The vernal equinox sun is at right ascension 0 by definition, so its
    // rising sidereal time is its rising hour angle and nothing else.
    const h = hourAngleAtAltitude(0, GIZA, SUN_STANDARD_ALTITUDE_DEG);
    expect(env['sun.equinox.rise.lst']).toBeCloseTo(normalizeDeg(-h), 12);
    expect(env['sun.equinox.set.lst']).toBeCloseTo(h, 12);
    expect(env['sun.solstice.summer.rise.lst']).toBeCloseTo(
      risingLst(90, env['sun.obliquity'] as number, GIZA, SUN_STANDARD_ALTITUDE_DEG),
      12,
    );
  });

  it('names every key so the claim expression parser can read it', () => {
    for (const key of Object.keys(env)) expect(key).toMatch(/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$/);
  });
});
