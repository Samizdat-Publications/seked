import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ditchPlan, ditchPlanSvg, isFigure, sphinxPlanData } from './figures';

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
