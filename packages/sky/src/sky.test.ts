import { describe, expect, it } from 'vitest';
import { skyEnvironment } from './environment';
import { isCircumpolar, transitAltitude } from './frames';
import { REFRACTION_LIMIT_DEG, altAz, apparentAltitude, enuDirection, transitLst } from './horizon';
import { loadBrightStars, loadNamedStars } from './catalogue';
import { BRIGHT_COLUMNS, BrightCatalogueSchema, expandBrightStars, limitMagnitude, positionAtEpoch, starById } from './stars';
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
  const KEYS = ['ra', 'dec', 'transit.altitude', 'transit.north', 'lower.altitude', 'rise.azimuth', 'set.azimuth', 'rise.lst', 'set.lst'];
  // sky.epoch, sun.obliquity, and a rising and a setting azimuth and sidereal
  // time for each of the equinox and the two solstices.
  const SKY_AND_SUN_KEYS = 2 + 3 * 4;

  it('gives every named star its nine keys, plus the epoch and the sun', () => {
    const env = skyEnvironment({ epoch: -2449, latitudeDeg: GIZA, stars });
    expect(env['sky.epoch']).toBe(-2449);
    for (const star of stars) {
      for (const suffix of KEYS) expect(env[`star.${star.id}.${suffix}`], `star.${star.id}.${suffix}`).toBeTypeOf('number');
    }
    expect(env['sun.obliquity']).toBeTypeOf('number');
    expect(Object.keys(env)).toHaveLength(stars.length * KEYS.length + SKY_AND_SUN_KEYS);
  });

  it('names them so the claim expression parser can read them', () => {
    const env = skyEnvironment({ epoch: -2449, latitudeDeg: GIZA, stars });
    for (const key of Object.keys(env)) expect(key).toMatch(/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$/);
  });

  it('gives a circumpolar star no rising, and Alnitak one south of east', () => {
    const env = skyEnvironment({ epoch: -2449, latitudeDeg: GIZA, stars });
    // Kochab did not touch the horizon from Giza in 2450 BCE; Alnitak's
    // declination was about −4°, so it rose a few degrees south of east.
    expect(env['star.kochab.rise.azimuth']).toBeNaN();
    expect(env['star.kochab.rise.lst']).toBeNaN();
    expect(env['star.alnitak.rise.azimuth'] as number).toBeGreaterThan(90);
    expect(env['star.alnitak.rise.azimuth'] as number).toBeLessThan(110);
    expect(env['star.alnitak.set.azimuth'] as number).toBeCloseTo(360 - (env['star.alnitak.rise.azimuth'] as number), 12);
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

/**
 * The ten named stars as data/stars/named.json had them before the HYG 4.2
 * import: raDeg, decDeg, pmRaMasYr, pmDecMasYr, entered from memory of SIMBAD
 * and Hipparcos values under source hipparcos-1997. They are kept here so the
 * import has something to be measured against, which is the check the plan
 * asked for on a sheet that was typed from memory. `pnpm run stars` prints the
 * same differences when it regenerates the file.
 */
const FROM_MEMORY: Record<string, [number, number, number, number]> = {
  alnitak: [85.18969, -1.94258, 3.19, 2.03],
  alnilam: [84.05334, -1.20192, 1.44, -0.78],
  mintaka: [83.00167, -0.29909, 0.64, -0.69],
  sirius: [101.28716, -16.71612, -546.01, -1223.07],
  thuban: [211.09731, 64.37585, -56.34, 17.21],
  kochab: [222.67636, 74.1555, -32.61, 11.42],
  mizar: [200.98142, 54.92536, 121.23, -22.01],
  regulus: [152.09296, 11.96721, -248.73, 5.59],
  vega: [279.23473, 38.78369, 200.94, 286.23],
  polaris: [37.95456, 89.26411, 44.48, -11.85],
};

/**
 * The four wing stars of Cygnus that claim C7 names. They are deliberately
 * not in FROM_MEMORY: they were never entered from memory at all, but came
 * straight out of the HYG 4.2 import, so there is no remembered value for
 * them to be checked against and nothing below tries to check one.
 */
const CYGNUS = ['fawaris', 'sadr', 'aljanah', 'deneb'];

/** Worst difference actually seen is Mizar at 0.455 arcseconds. */
const POSITION_TOLERANCE_ARCSEC = 0.5;
/** Worst difference actually seen is Mintaka at 1.25 milliarcseconds per year. */
const PROPER_MOTION_TOLERANCE_MAS_YR = 1.5;

/** Great-circle separation between two positions, in arcseconds. */
function separationArcsec(a: { raDeg: number; decDeg: number }, b: { raDeg: number; decDeg: number }): number {
  const d2r = Math.PI / 180;
  const cos =
    Math.sin(a.decDeg * d2r) * Math.sin(b.decDeg * d2r) +
    Math.cos(a.decDeg * d2r) * Math.cos(b.decDeg * d2r) * Math.cos((a.raDeg - b.raDeg) * d2r);
  return (Math.acos(Math.min(1, Math.max(-1, cos))) / d2r) * 3600;
}

describe('the named stars, against the values that were entered from memory', () => {
  const stars = loadNamedStars();
  /** The ten of the catalogue that the remembered sheet has something to say about. */
  const fromMemory = stars.filter((s) => FROM_MEMORY[s.id] !== undefined);

  it('still holds the remembered ten, adds the four Cygnus stars and nothing else, and cites HYG 4.2 throughout', () => {
    const ids = stars.map((s) => s.id);
    for (const id of Object.keys(FROM_MEMORY)) expect(ids, id).toContain(id);
    expect(ids.filter((id) => FROM_MEMORY[id] === undefined).sort()).toEqual([...CYGNUS].sort());
    for (const star of stars) expect(star.source, star.id).toBe('hyg-4.2');
  });

  it(`has every position within ${POSITION_TOLERANCE_ARCSEC}" of the remembered one`, () => {
    for (const star of fromMemory) {
      const [raDeg, decDeg] = FROM_MEMORY[star.id] as [number, number, number, number];
      expect(separationArcsec(star, { raDeg, decDeg }), star.id).toBeLessThan(POSITION_TOLERANCE_ARCSEC);
    }
  });

  it(`has every proper motion within ${PROPER_MOTION_TOLERANCE_MAS_YR} mas/yr of the remembered one`, () => {
    for (const star of fromMemory) {
      const [, , pmRa, pmDec] = FROM_MEMORY[star.id] as [number, number, number, number];
      expect(Math.abs(star.pmRaMasYr - pmRa), `${star.id} pmRA`).toBeLessThan(PROPER_MOTION_TOLERANCE_MAS_YR);
      expect(Math.abs(star.pmDecMasYr - pmDec), `${star.id} pmDec`).toBeLessThan(PROPER_MOTION_TOLERANCE_MAS_YR);
    }
  });

  it('moves no star far enough to matter: the worst is Mintaka, 7.2\" at 2450 BCE and 20.2\" at 10,500 BCE', () => {
    for (const star of fromMemory) {
      const [raDeg, decDeg, pmRa, pmDec] = FROM_MEMORY[star.id] as [number, number, number, number];
      const remembered = { raDeg, decDeg, pmRaMasYr: pmRa, pmDecMasYr: pmDec };
      // Proper motion is what the differences are made of, so they grow with the epoch.
      expect(separationArcsec(positionAtEpoch(star, -2449), positionAtEpoch(remembered, -2449)), star.id).toBeLessThan(10);
      expect(separationArcsec(positionAtEpoch(star, -10499), positionAtEpoch(remembered, -10499)), star.id).toBeLessThan(25);
    }
  });
});

describe('the HYG 4.2 bright catalogue', () => {
  const catalogue = loadBrightStars();
  const stars = expandBrightStars(catalogue);
  const named = loadNamedStars();

  it('validates, cites its source and carries the credit the licence asks for', () => {
    expect(() => BrightCatalogueSchema.parse(catalogue)).not.toThrow();
    expect(catalogue.source).toBe('hyg-4.2');
    expect(catalogue.attribution).toMatch(/CC BY-SA 4\.0/);
    expect(catalogue.columns).toEqual([...BRIGHT_COLUMNS]);
  });

  it('stops at magnitude 6.5 and has no duplicate ids', () => {
    expect(catalogue.magnitudeLimit).toBe(6.5);
    expect(stars.length).toBeGreaterThan(8000);
    for (const star of stars) expect(star.mag, star.id).toBeLessThanOrEqual(6.5);
    expect(new Set(stars.map((s) => s.id)).size).toBe(stars.length);
  });

  it('holds every named star, at exactly the numbers named.json has', () => {
    const byName = new Map(stars.filter((s) => s.name).map((s) => [s.name as string, s]));
    for (const star of named) {
      const bright = byName.get(star.name);
      expect(bright, `${star.name} is missing from hyg-bright.json`).toBeDefined();
      const b = bright as (typeof stars)[number];
      expect(b.raDeg, `${star.id} ra`).toBe(star.raDeg);
      expect(b.decDeg, `${star.id} dec`).toBe(star.decDeg);
      expect(b.pmRaMasYr, `${star.id} pmRA`).toBe(star.pmRaMasYr);
      expect(b.pmDecMasYr, `${star.id} pmDec`).toBe(star.pmDecMasYr);
      expect(b.id).toMatch(/^hip\d+$/);
    }
  });

  it('leaves the sparse columns off the expanded objects rather than nulling them', () => {
    const sirius = stars.find((s) => s.name === 'Sirius') as (typeof stars)[number];
    expect(sirius.bf).toBe('9Alp CMa');
    expect(sirius.parallaxMas).toBeGreaterThan(370);
    expect(sirius.ci).toBeTypeOf('number');
    const anonymous = stars.find((s) => s.name === undefined) as (typeof stars)[number];
    expect(Object.keys(anonymous)).not.toContain('name');
  });

  it('precesses like any other star, putting Sirius well south from Giza in 2450 BCE', () => {
    const sirius = stars.find((s) => s.name === 'Sirius') as (typeof stars)[number];
    const { decDeg } = positionAtEpoch(sirius, -2449);
    expect(transitAltitude(decDeg, 29.979167)).toBeCloseTo(39.6, 0);
  });

  it('cuts to a brighter limit for the browser, keeping the header and the brightest stars', () => {
    const cut = limitMagnitude(catalogue, 4);
    expect(cut.magnitudeLimit).toBe(4);
    expect(cut.source).toBe(catalogue.source);
    expect(cut.stars.length).toBeLessThan(catalogue.stars.length);
    for (const row of cut.stars) expect(row[8]).toBeLessThanOrEqual(4);
    expect(expandBrightStars(cut).some((s) => s.name === 'Thuban')).toBe(true);
    expect(limitMagnitude(catalogue, 99)).toBe(catalogue);
  });
});
