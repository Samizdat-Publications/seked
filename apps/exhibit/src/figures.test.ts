import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDatabase } from '@seked/data';
import { allanRankData, allanRankSvg, beltPlan, beltPlanSvg, ditchPlan, ditchPlanSvg, isFigure, northSquare, northSquareSvg, phiTriangle, phiTriangleSvg, piCircle, piCircleSvg, rankLine, rankP, sphinxPlanData } from './figures';
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

describe('pi in the profile, drawn', () => {
  const ground = groundEnvironment(loadDatabase());
  it("takes A1's two lengths from the database: the perimeter, and the circle of radius the height", () => {
    const c = piCircle(ground)!;
    expect(c.perimeter).toBe(ground['g1.base.perimeter']);
    expect(c.circle).toBeCloseTo(2 * Math.PI * ground['g1.height.original']!, 9);
    expect(c.perimeter / c.height).toBeCloseTo(6.28501, 4);   // the script's A1 receipt
    expect(piCircleSvg(c)).toContain('<circle');
    expect(piCircle({})).toBeNull();
  });
});

describe('true north, drawn', () => {
  const ground = groundEnvironment(loadDatabase());
  it("takes C1's orientation from the database and says how far a side's end strays", () => {
    const n = northSquare(ground)!;
    expect(n.orientation).toBe(ground['g1.orientation']);
    expect(n.orientation * 60).toBeCloseTo(-3.9, 1);   // the script's 3 54 west of north
    expect(n.stray).toBeCloseTo(0.26, 2);             // and its quarter of a metre
    expect(northSquareSvg(n, 120)).toContain('120 times');
    expect(northSquare({})).toBeNull();
  });
});

describe('phi in the face, drawn', () => {
  const ground = groundEnvironment(loadDatabase());
  it("takes A2's triangle from the database", () => {
    const t = phiTriangle(ground)!;
    expect(t.apothem / t.half).toBeCloseTo(1.6187, 4);   // the script's A2 receipt
    expect(Math.hypot(t.half, t.height)).toBeCloseTo(t.apothem, 6);
    expect(phiTriangleSvg(t)).toContain('apothem, 1.6187');
    expect(phiTriangle({})).toBeNull();
  });
});

describe("the 2026 study's rank", () => {
  const d = allanRankData(read('measurements/orion-correlation.json'), read('sources.json'));
  it('is read from its records and cited from its source, unchecked', () => {
    expect(d).toMatchObject({ rank: 1717, of: 695520, source: 'allan-2026', verified: false });
    expect(d.citation).toContain('Journal of Astronomical History and Heritage');
  });
  it("gives the paper's p as the rank over the count, and the short cited line", () => {
    expect(rankP(d)).toBe(0.0025);
    expect(rankLine(d)).toBe('Allan 2026: rank 1,717 of 695,520, p = 0.0025');
    // the spoken words: "the top quarter of one per cent"
    expect(d.rank / d.of).toBeLessThan(0.0025);
  });
  it('marks the best matches at the end of the line, never thinner than a mark can be seen', () => {
    expect(allanRankSvg(d)).toContain('the best 1,717');
    expect(allanRankSvg(d)).toMatch(/x1="288\.0"/);
    expect(isFigure('allan-rank')).toBe(true);
    expect(() => allanRankData([], read('sources.json'))).toThrow(/orion\.allan2026\.shape\.rank/);
  });
});
