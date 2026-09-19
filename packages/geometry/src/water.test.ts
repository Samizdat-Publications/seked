import { describe, expect, it } from 'vitest';
import { buildEnvironment } from './environment';
import type { Footprint } from './footprints';
import { LOOK, rectangleContains, riverBody, riverLevel, valleyTempleFloor, waterExtent, waterLevel } from './water';

/**
 * Invented outlines, not measurements: two boxes standing in for the valley
 * temples, at the levels and reaches the real footprints roughly have, so the
 * test says what the functions do and nothing about Giza.
 */
function temple(id: string, base: number, ring: [number, number][]): Footprint {
  return { id, name: id, kind: 'prism', group: 'temples', heightKey: 'tier3.temple.height', base, area: 0, ring };
}

const TEMPLES: Footprint[] = [
  // Khafre's valley temple: the more southerly, and the further east by a metre.
  temple('khafre.valley_temple', -42.18, [[370, -517], [415, -517], [415, -470], [370, -470]]),
  // The Sphinx Temple, north of it and a metre short of its east face.
  temple('sphinx.temple', -42.14, [[369, -467], [413, -467], [413, -414], [369, -414]]),
];

const ENV = buildEnvironment({ 'tier3.temple.height': 8 });

describe('the valley temples’ floor', () => {
  it('is the lower of the two footprints’ own bottoms', () => {
    expect(valleyTempleFloor(TEMPLES, ENV)).toBeCloseTo(-42.18, 6);
  });

  it('is undefined without the temples’ footprints', () => {
    expect(valleyTempleFloor([], ENV)).toBeUndefined();
    expect(valleyTempleFloor([TEMPLES[0] as Footprint], ENV)).toBeUndefined();
  });

  it('is undefined where the environment carries no height for them', () => {
    expect(valleyTempleFloor(TEMPLES, buildEnvironment({}))).toBeUndefined();
  });
});

describe('the water level', () => {
  it('stands at the temples’ floor in the built state', () => {
    expect(waterLevel(TEMPLES, ENV, 'built')).toBeCloseTo(-42.18, 6);
  });

  it('stands the flood’s named rise above it in the First Time', () => {
    expect(waterLevel(TEMPLES, ENV, 'ancient')).toBeCloseTo(-42.18 + LOOK.floodRiseMetres, 6);
  });

  it('is undefined in the dry states', () => {
    expect(waterLevel(TEMPLES, ENV, 'stripped')).toBeUndefined();
    expect(waterLevel(TEMPLES, ENV, 'today')).toBeUndefined();
  });

  it('is undefined without the temples’ footprints', () => {
    expect(waterLevel([], ENV, 'built')).toBeUndefined();
    expect(waterLevel([], ENV, 'ancient')).toBeUndefined();
  });
});

describe('the harbour basin', () => {
  const basin = waterExtent(TEMPLES, ENV, 'built');

  it('is a basin cut below its own waterline', () => {
    expect(basin?.kind).toBe('basin');
    expect(basin?.floor).toBeCloseTo((basin?.level as number) - LOOK.basinDepthMetres, 6);
  });

  it('contains both temples’ east faces', () => {
    for (const t of TEMPLES) {
      const east = Math.max(...t.ring.map(([x]) => x));
      for (const [, y] of t.ring) {
        expect(rectangleContains(basin?.outline ?? [], east, y)).toBe(true);
      }
    }
  });

  it('reaches east of them and stands clear north and south', () => {
    const xs = (basin?.outline ?? []).map(([x]) => x);
    const ys = (basin?.outline ?? []).map(([, y]) => y);
    expect(Math.max(...xs)).toBeCloseTo(415 + LOOK.basinReachMetres, 6);
    expect(Math.min(...ys)).toBeCloseTo(-517 - LOOK.basinMarginMetres, 6);
    expect(Math.max(...ys)).toBeCloseTo(-414 + LOOK.basinMarginMetres, 6);
  });

  it('holds no ground west of the temples’ east faces', () => {
    const west = Math.min(...(basin?.outline ?? []).map(([x]) => x));
    // The Sphinx Temple's east face, which is the westernmost of the two.
    expect(west).toBeCloseTo(413, 6);
    expect(rectangleContains(basin?.outline ?? [], 300, -450)).toBe(false);
  });

  it('says in its label that the waterline is the temples’ own and the reach a look choice', () => {
    expect(basin?.label).toContain('Lehner');
    expect(basin?.label).toContain('Look choices');
    expect(basin?.label).toContain('-42.18');
  });
});

describe('the flood plain of the First Time', () => {
  const plain = waterExtent(TEMPLES, ENV, 'ancient');

  it('is a plain with no bed of its own', () => {
    expect(plain?.kind).toBe('plain');
    expect(plain?.floor).toBeCloseTo(plain?.level as number, 6);
  });

  it('lies east of the temples and is carried out to the plain’s reach', () => {
    const xs = (plain?.outline ?? []).map(([x]) => x);
    expect(Math.min(...xs)).toBeCloseTo(413, 6);
    expect(Math.max(...xs)).toBeCloseTo(413 + LOOK.plainReachMetres, 6);
    expect(rectangleContains(plain?.outline ?? [], 300, -450)).toBe(false);
  });

  it('cites the African Humid Period and calls itself a claim', () => {
    expect(plain?.label).toContain('African Humid Period');
    expect(plain?.label).toContain('12,500 to 3,500 BCE');
    expect(plain?.label).toContain('claim');
  });
});

describe('the dry states', () => {
  it('have no water at all', () => {
    expect(waterExtent(TEMPLES, ENV, 'stripped')).toBeUndefined();
    expect(waterExtent(TEMPLES, ENV, 'today')).toBeUndefined();
  });
});

describe('riverLevel', () => {
  /**
   * An invented valley, not a measurement of anything: fields at -36 m with a
   * flat channel five hundred metres wide at -46, which is the shape the real
   * heightfield has east of Giza and the shape the percentile relies on.
   */
  const valley = (x: number): number => (x >= 8000 && x <= 8500 ? -46 : -36);
  const box = { west: 3000, east: 11000, south: -4500, north: 7000 };

  it('lands on the channel and not on the fields', () => {
    expect(riverLevel(valley, box)).toBeCloseTo(-46 + LOOK.riverRiseMetres, 6);
  });

  it('stands the drawn surface clear of the model own water', () => {
    expect(riverLevel(valley, box) - -46).toBeCloseTo(LOOK.riverRiseMetres, 6);
  });

  it('does not move while the channel is wider than the percentile', () => {
    // The channel here is about six per cent of the box, so every percentile
    // inside it gives the same level.
    for (const percentile of [1, 3, 5]) {
      expect(riverLevel(valley, box, 60, percentile), `p${percentile}`).toBeCloseTo(-46 + LOOK.riverRiseMetres, 6);
    }
    // Past the channel's own share it climbs onto the fields, which is the
    // thing the fifth percentile is chosen to be inside.
    expect(riverLevel(valley, box, 60, 30)).toBeCloseTo(-36 + LOOK.riverRiseMetres, 6);
  });

  it('reads whatever the ground says, with nothing typed', () => {
    expect(riverLevel(() => -12, box)).toBeCloseTo(-12 + LOOK.riverRiseMetres, 6);
  });

  it('refuses a box with no samples in it rather than inventing a level', () => {
    expect(() => riverLevel(valley, { west: 100, east: 0, south: 0, north: 0 })).toThrow(/no samples/);
  });
});

describe('riverBody', () => {
  it('is a surface with no bed of its own, like the flood plain', () => {
    const body = riverBody(-45.7);
    expect(body.kind).toBe('river');
    expect(body.floor).toBe(body.level);
    expect(body.level).toBe(-45.7);
  });

  it('covers the valley it was given', () => {
    const box = { west: 3000, east: 11000, south: -4500, north: 7000 };
    const body = riverBody(-45.7, box);
    expect(rectangleContains(body.outline, 8200, 0)).toBe(true);
    expect(rectangleContains(body.outline, 0, 0)).toBe(false);
  });

  it('says it is context, says where its level came from, and names its look choices', () => {
    const label = riverBody(-45.7).label;
    expect(label).toMatch(/Context, not evidence/);
    expect(label).toMatch(/percentile of the valley/);
    expect(label).toMatch(/Look choices/);
    expect(label).toMatch(/-45\.70 m/);
  });
});
