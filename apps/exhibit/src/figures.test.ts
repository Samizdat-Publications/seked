import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDatabase } from '@seked/data';
import { beltPlan, beltPlanSvg, ditchPlan, ditchPlanSvg, isFigure, sphinxPlanData } from './figures';
import { groundEnvironment } from './receipts';
import { skyEnvironment } from '@seked/sky';

const data = join(__dirname, '..', '..', '..', 'data');
const read = (p: string) => JSON.parse(readFileSync(join(data, p), 'utf8'));
const plan = sphinxPlanData(read('footprints/giza.json'), read('measurements/sphinx-enclosure.json'));

describe('the ditch plan', () => {
  it("takes the statue's three outlines and the two margins as the database has them", () => {
    expect(plan.rings).toHaveLength(3);
    expect(plan.north).toMatchObject({ value: 14.12, sigma: 0.57, method: 'scaled from plate', verified: false });
    expect(plan.west).toMatchObject({ value: 4.19, sigma: 0.7, source: 'arce-sphinx-mapping-oc' });
  });
  it('puts the walls the margins away from the statue', () => {
    const p = ditchPlan(plan);
    expect(p.northWall - p.maxY).toBeCloseTo(14.12);
    expect(p.minX - p.westWall).toBeCloseTo(4.19);
    expect(p.northAt).toBeGreaterThan(p.minX);
    expect(p.northAt).toBeLessThan(p.maxX);
  });
  it('labels each margin with its sigma and marks where the visitor stands', () => {
    const svg = ditchPlanSvg(plan, [330, -449]);
    expect(svg).toContain('14.1 ± 0.6 m');
    expect(svg).toContain('4.2 ± 0.7 m');
    expect(svg).toContain('you are here');
  });
  it('refuses data it cannot find', () => {
    expect(() => sphinxPlanData({ features: [] }, read('measurements/sphinx-enclosure.json'))).toThrow();
    expect(() => sphinxPlanData(read('footprints/giza.json'), [])).toThrow();
  });
  it('is a figure the leaves may name', () => {
    expect(isFigure('ditch-plan')).toBe(true);
    expect(isFigure('g1-proportions')).toBe(false);
  });
});

describe('the belt over the pyramids', () => {
  const ground = groundEnvironment(loadDatabase());
  const sky = skyEnvironment({ epoch: -10449, latitudeDeg: ground['g1.center.latitude']!, longitudeDeg: 0 });
  const at = (id: string) => ({ ra: sky[`star.${id}.ra`]!, dec: sky[`star.${id}.dec`]! });
  const plan = beltPlan(ground, { alnitak: at('alnitak'), alnilam: at('alnilam'), mintaka: at('mintaka') })!;
  const deg = (x: number, y: number) => (Math.atan(Math.abs(x) / Math.abs(y)) * 180) / Math.PI;
  it('sets Alnitak on Khufu and Mintaka as far off as Menkaure, unturned, so the two diagonals keep C4 angles', () => {
    const [a, , m] = plan.stars;
    const g3 = plan.pyramids[2]!;
    expect([a!.x, a!.y]).toEqual([0, -0]);
    expect(Math.hypot(m!.x, m!.y)).toBeCloseTo(Math.hypot(g3.x, g3.y), 6);
    expect(deg(g3.x, g3.y)).toBeCloseTo(37 + 51 / 60 + 7 / 3600, 3);   // the script's 37 51 07
    expect(deg(m!.x, m!.y)).toBeCloseTo(50 + 51 / 60 + 40 / 3600, 2);  // and 50 51 40
    // looking south, Mintaka lies south-west of Alnitak, as Menkaure does of Khufu
    expect(m!.x).toBeLessThan(0);
    expect(m!.y).toBeLessThan(0);
    expect(isFigure('belt-plan')).toBe(true);
    expect(beltPlanSvg(plan)).toContain('Menkaure');
  });
  it('waits for the ground', () => {
    expect(beltPlan({}, { alnitak: at('alnitak'), alnilam: at('alnilam'), mintaka: at('mintaka') })).toBeNull();
  });
});
