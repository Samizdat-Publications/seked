import { describe, expect, it } from 'vitest';
import { skyEnvironment } from './environment';
import { isCircumpolar, transitAltitude } from './frames';
import { REFRACTION_LIMIT_DEG, altAz, apparentAltitude, enuDirection, transitLst } from './horizon';
import { loadNamedStars } from './catalogue';
import { positionAtEpoch, starById } from './stars';
import { ltp, ltpb, ltpecl, ltpequ, precessIcrsToDate } from './vondrak';

const close = (got: number, want: number, tol = 1e-13) => expect(Math.abs(got - want)).toBeLessThan(tol);

describe('Vondrák 2011 long-term precession reproduces the ERFA reference values', () => {
  it('ecliptic pole at J−1500', () => {
    const v = ltpecl(-1500);
    close(v[0], 0.4768625676477096525e-3);
    close(v[1], -0.4052259533091875112);
    close(v[2], 0.9142164401096448012);
  });
  it('equator pole at J−2500', () => {
    const v = ltpequ(-2500);
    close(v[0], -0.3586652560237326659);
    close(v[1], -0.1996978910771128475);
    close(v[2], 0.9118552442250819624);
  });
  it('precession matrix at J1666.666', () => {
    const m = ltp(1666.666);
    close(m[0][0], 0.9967044141159213819);
    close(m[0][1], 0.7437801893193210840e-1);
    close(m[0][2], 0.3237624409345603401e-1);
    close(m[1][0], -0.7437802731819618167e-1);
    close(m[1][1], 0.9972293894454533070);
    close(m[1][2], -0.1205768842723593346e-2);
    close(m[2][0], -0.3237622482766575399e-1);
    close(m[2][1], -0.1206286039697609008e-2);
    close(m[2][2], 0.9994750246704010914);
  });
  it('precession-bias matrix at J1666.666', () => {
    const m = ltpb(1666.666);
    close(m[0][0], 0.9967044167723271851);
    close(m[0][1], 0.7437794731203340345e-1);
    close(m[0][2], 0.3237632684841625547e-1);
    close(m[1][0], -0.7437795663437177152e-1);
    close(m[1][1], 0.9972293947500013666);
    close(m[1][2], -0.1205741865911243235e-2);
    close(m[2][0], -0.3237630543224664992e-1);
    close(m[2][1], -0.1206316791076485295e-2);
    close(m[2][2], 0.9994750220222438819);
  });
  it('is the identity at J2000 apart from the frame bias', () => {
    const p = precessIcrsToDate(85.18969, -1.94258, 2000);
    expect(p.raDeg).toBeCloseTo(85.18969, 4);
    expect(p.decDeg).toBeCloseTo(-1.94258, 4);
  });
});

describe('the sky over Giza, as the claims describe it', () => {
  const stars = loadNamedStars();
  const GIZA = 29.979167;
  it('Thuban sat within half a degree of the pole around 2800 BCE', () => {
    const { decDeg } = positionAtEpoch(starById(stars, 'thuban'), -2799);
    expect(decDeg).toBeGreaterThan(89.5);
  });
  it('Polaris is the pole star today and was not in 2500 BCE', () => {
    expect(positionAtEpoch(starById(stars, 'polaris'), 2026).decDeg).toBeGreaterThan(89);
    expect(positionAtEpoch(starById(stars, 'polaris'), -2499).decDeg).toBeLessThan(70);
  });
  it('Vega was near the pole around 12,000 BCE', () => {
    expect(positionAtEpoch(starById(stars, 'vega'), -11999).decDeg).toBeGreaterThan(84);
  });
  it("Alnitak crossed the meridian near 45° in the mid third millennium BCE, the King's Chamber south shaft angle", () => {
    const { decDeg } = positionAtEpoch(starById(stars, 'alnitak'), -2449);
    expect(Math.abs(transitAltitude(decDeg, GIZA) - 45)).toBeLessThan(1.5);
  });
  it('Kochab was circumpolar from Giza in 2500 BCE', () => {
    expect(isCircumpolar(positionAtEpoch(starById(stars, 'kochab'), -2499).decDeg, GIZA)).toBe(true);
  });
});

describe('the sky flattened into a claim environment', () => {
  const stars = loadNamedStars();
  const GIZA = 29.979167;
  const KEYS = ['ra', 'dec', 'transit.altitude', 'transit.north', 'lower.altitude'];

  it('gives every named star its five keys, plus the epoch', () => {
    const env = skyEnvironment({ epoch: -2449, latitudeDeg: GIZA, stars });
    expect(env['sky.epoch']).toBe(-2449);
    for (const star of stars) {
      for (const suffix of KEYS) expect(env[`star.${star.id}.${suffix}`], `star.${star.id}.${suffix}`).toBeTypeOf('number');
    }
    expect(Object.keys(env)).toHaveLength(stars.length * KEYS.length + 1);
  });

  it('names them so the claim expression parser can read them', () => {
    const env = skyEnvironment({ epoch: -2449, latitudeDeg: GIZA, stars });
    for (const key of Object.keys(env)) expect(key).toMatch(/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$/);
  });

  it("puts Alnitak's transit within a degree of 45° in 2450 BCE, south of the zenith", () => {
    const env = skyEnvironment({ epoch: -2449, latitudeDeg: GIZA, stars });
    expect(Math.abs((env['star.alnitak.transit.altitude'] as number) - 45)).toBeLessThan(1);
    expect(env['star.alnitak.transit.north']).toBe(0);
    expect(env['star.thuban.transit.north']).toBe(1);
  });

  it("puts Thuban's lower culmination within 1.5° of 26.5° in 2170 BCE", () => {
    const env = skyEnvironment({ epoch: -2169, latitudeDeg: GIZA, stars });
    expect(Math.abs((env['star.thuban.lower.altitude'] as number) - 26.5)).toBeLessThan(1.5);
  });

  it('loads the named stars itself when it is not given any', () => {
    const env = skyEnvironment({ epoch: -2449, latitudeDeg: GIZA });
    expect(env['star.kochab.transit.altitude']).toBeCloseTo(skyEnvironment({ epoch: -2449, latitudeDeg: GIZA, stars })['star.kochab.transit.altitude'] as number, 12);
  });
});

describe('the horizon frame the sky dome needs', () => {
  const stars = loadNamedStars();
  const GIZA = 29.979167;

  it('puts a star whose declination equals the latitude in the zenith at transit', () => {
    const raDeg = 123.456;
    const { altDeg } = altAz({ raDeg, decDeg: GIZA, latDeg: GIZA, lstDeg: transitLst(raDeg) });
    expect(altDeg).toBeCloseTo(90, 9);
  });

  it('keeps Polaris within a degree of altitude = latitude at every sidereal time', () => {
    const { raDeg, decDeg } = positionAtEpoch(starById(stars, 'polaris'), 2026);
    for (let lstDeg = 0; lstDeg < 360; lstDeg += 1) {
      const { altDeg } = altAz({ raDeg, decDeg, latDeg: GIZA, lstDeg });
      expect(Math.abs(altDeg - GIZA), `lst ${lstDeg}`).toBeLessThan(1);
    }
  });

  it('reproduces the meridian geometry for Alnitak in 2450 BCE: due south at its transit altitude', () => {
    const { raDeg, decDeg } = positionAtEpoch(starById(stars, 'alnitak'), -2449);
    const { altDeg, azDeg } = altAz({ raDeg, decDeg, latDeg: GIZA, lstDeg: transitLst(raDeg) });
    expect(altDeg).toBeCloseTo(transitAltitude(decDeg, GIZA), 9);
    expect(azDeg).toBeCloseTo(180, 9);
  });

  it('points altitude 0, azimuth 90 straight east in the project frame', () => {
    const [x, y, z] = enuDirection(0, 90);
    expect(x).toBeCloseTo(1, 12);
    expect(y).toBeCloseTo(0, 12);
    expect(z).toBeCloseTo(0, 12);
  });

  it('builds unit vectors whose azimuths run north, east, south, west', () => {
    expect(enuDirection(0, 0)[1]).toBeCloseTo(1, 12);
    expect(enuDirection(0, 180)[1]).toBeCloseTo(-1, 12);
    expect(enuDirection(0, 270)[0]).toBeCloseTo(-1, 12);
    expect(enuDirection(90, 42)[2]).toBeCloseTo(1, 12);
    for (const [alt, az] of [[0, 90], [37, 214], [-8, 350], [89, 12]] as [number, number][]) {
      const v = enuDirection(alt, az);
      expect(Math.hypot(...v)).toBeCloseTo(1, 12);
    }
  });

  it('agrees with enuDirection about where altAz put the star', () => {
    const { raDeg, decDeg } = positionAtEpoch(starById(stars, 'sirius'), -2449);
    const { altDeg, azDeg } = altAz({ raDeg, decDeg, latDeg: GIZA, lstDeg: transitLst(raDeg) });
    const [east, north, up] = enuDirection(altDeg, azDeg);
    expect(Math.abs(east)).toBeLessThan(1e-12); // on the meridian
    expect(north).toBeLessThan(0); // south of the zenith from Giza
    expect(up).toBeCloseTo(Math.sin((transitAltitude(decDeg, GIZA) * Math.PI) / 180), 12);
  });

  it('refracts the horizon by about 34 arcminutes and nothing above 15°', () => {
    expect((apparentAltitude(0) - 0) * 60).toBeGreaterThan(33);
    expect((apparentAltitude(0) - 0) * 60).toBeLessThan(36);
    expect(apparentAltitude(15)).toBe(15);
    expect(apparentAltitude(45)).toBe(45);
    expect(apparentAltitude(90)).toBe(90);
  });

  it('meets the identity continuously at 15° and lifts a star below the horizon', () => {
    expect(apparentAltitude(REFRACTION_LIMIT_DEG - 1e-9)).toBeCloseTo(REFRACTION_LIMIT_DEG, 8);
    expect(apparentAltitude(-0.5)).toBeGreaterThan(-0.5);
    expect(apparentAltitude(-0.5)).toBeLessThan(0.3);
    for (let alt = -1; alt < 20; alt += 0.25) expect(apparentAltitude(alt), `alt ${alt}`).toBeGreaterThanOrEqual(alt);
  });
});
