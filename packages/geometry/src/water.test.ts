import { describe, expect, it } from 'vitest';
import { buildEnvironment } from './environment';
import type { Footprint } from './footprints';
import { LOOK, rectangleContains, valleyTempleFloor, waterExtent, waterLevel } from './water';

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
