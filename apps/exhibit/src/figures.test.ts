import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDatabase } from '@seked/data';
import { allanRankData, allanRankSvg, beltPlan, beltPlanSvg, ditchPlan, ditchPlanSvg, earthScale, earthScaleSvg, jointClaimSvg, luminescenceData, luminescenceSvg, radiocarbonData, radiocarbonSvg, corridorData, corridorSvg, khafreDepths, khafreDepthsSvg, shortCite, yearText, isFigure, northSquare, northSquareSvg, phiTriangle, phiTriangleSvg, piCircle, piCircleSvg, rankLine, rankP, sphinxPlanData } from './figures';
import { groundEnvironment } from './receipts';
import { skyEnvironment } from '@seked/sky';
import { loadClaims } from '@seked/claims';

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

describe('the Earth at 1 : 43,200', () => {
  const ground = groundEnvironment(loadDatabase());
  const claim = loadClaims().find((c) => c.id === 'B1')!;
  it("grows the profile by B1's own factor, its height near the polar radius", () => {
    const e = earthScale(ground, Number(claim.overlay?.params?.scale))!;
    expect(e.scale).toBe(43200);
    expect(e.height / e.polar - 1).toBeGreaterThan(-0.01);
    expect(e.height / e.polar - 1).toBeLessThan(0.01);
    expect(e.half).toBeCloseTo(ground['g1.base.half']! * 43200, 3);
    expect(earthScaleSvg(e)).toContain('height &#215; 43,200');
  });
  it('draws nothing without the monuments or a factor', () => {
    expect(earthScale({}, 43200)).toBeNull();
    expect(earthScale(ground, NaN)).toBeNull();
  });
});

describe("the temples' luminescence dates", () => {
  const d = luminescenceData(read('measurements/luminescence.json'), read('structures.json'), read('sources.json'));
  it('are the three records, oldest first, named by temple, stone and sample, and unchecked', () => {
    expect(d.dates.map((x) => x.sample)).toEqual(['VT1', 'ST2', 'VT9a']);
    expect(d.dates[1]).toMatchObject({ temple: 'Sphinx Temple', stone: 'limestone', sigma: 220, verified: false });
    expect(yearText(d.dates[1]!.year)).toBe('2220 BCE');   // the reply's words
  });
  it('label the axis in round years and cite the paper short', () => {
    const svg = luminescenceSvg(d);
    expect(svg).toContain('4000 BCE');
    expect(svg).toContain('3060 BCE &#177; 470');
    expect(svg).not.toContain('4001 BCE');
    expect(shortCite(d.citation)).toBe('Liritzis and Vafiadou (2015)');
  });
});

describe('the radiocarbon accessions', () => {
  const d = radiocarbonData(read('measurements/chronology.json'), read('sources.json'));
  it('are the five kings, first king first, each a 95 per cent range, unchecked', () => {
    expect(d.reigns.map((r) => r.king)).toEqual(['Aha', 'Djoser', 'Khufu', 'Khafre', 'Unas']);
    expect(yearText(d.reigns[0]!.median!)).toBe('3085 BCE');   // the script's anchor for the king lists
    expect(d.reigns.every((r) => r.earliest < r.latest && !r.verified)).toBe(true);
    expect(d.reigns[1]!.median).toBeUndefined();
  });
  it('labels each range as the page writes years and cites both papers short', () => {
    const svg = radiocarbonSvg(d);
    expect(svg).toContain('3218 to 3035 BCE');
    expect(svg).toContain('2450 to 2363 BCE');
    expect(svg).toContain('3000 BCE');
    expect(svg).not.toContain('3001 BCE');
    expect(Object.keys(d.citations).sort()).toEqual(['bronk-ramsey-2010', 'dee-2013']);
    expect(shortCite(d.citations['dee-2013']!)).toBe('Dee and others (2013)');
    expect(shortCite(d.citations['bronk-ramsey-2010']!)).toBe('Bronk Ramsey and others (2010)');
  });
  it('refuses an accession with only one end', () => {
    expect(() => radiocarbonData([{ key: 'chronology.aha.accession.earliest', value: -3217, source: 'dee-2013' }], read('sources.json'))).toThrow(/start or an end/);
  });
});

describe("Khafre's depths", () => {
  const env = groundEnvironment(loadDatabase());
  const d = khafreDepths(env)!;
  it('reads the pyramid, its rooms and the claimed wells from the environment', () => {
    expect(d).toMatchObject({ bottom: -648, rooms: -3, wells: 8, rows: 2, cubes: 2, cube: 80, osiris: 30, paw: 5 });
    expect(-d.bottom / d.height).toBeCloseTo(4.5, 0);   // "four and a half times the pyramid's height"
    expect(khafreDepths({})).toBeNull();
  });
  it('draws one row of wells to the depth, the chambers at their foot and the heights counted down', () => {
    const svg = khafreDepthsSvg(d);
    expect(svg.match(/class="claimed"/g)).toHaveLength(5);   // four wells and the paw cavity
    expect(svg).toContain('Osiris Shaft 30 m');
    expect(svg.match(/class="claimed-box"/g)).toHaveLength(2);
    expect(svg).toContain(`${(648 / d.height).toFixed(2)}</text>`);
  });
  it('leaves out the Osiris Shaft and the paw cavity where their depths are not records', () => {
    const { osiris: _o, paw: _p, ...rest } = d;
    const svg = khafreDepthsSvg(rest);
    expect(svg).not.toContain('Osiris');
    expect(svg.match(/class="claimed"/g)).toHaveLength(4);
  });
});

describe('the north-face corridor', () => {
  const d = corridorData(read('measurements/g1-voids.json'), read('sources.json'));
  it("runs north to south as the paper's length, each figure with its sigma, checked", () => {
    expect(d.along).toEqual({ value: 9.06, sigma: 0.07 });
    expect(d.across).toEqual({ value: 2.02, sigma: 0.06 });
    expect(d.verified).toBe(true);
  });
  it('draws the box to scale and writes every figure with its error bar', () => {
    const svg = corridorSvg(d);
    const box = /<rect class="wall draw-on" x="([\d.]+)" y="[\d.]+" width="([\d.]+)" height="([\d.]+)"/.exec(svg)!;
    expect(Number(box[2]) / Number(box[3])).toBeCloseTo(9.06 / 2.18, 1);
    for (const t of ['9.06 &#177; 0.07 m', '2.18 &#177; 0.17 m', '0.84 &#177; 0.05 m', '20.0 &#177; 0.5 m']) expect(svg).toContain(t);
  });
});

describe("West and Schoch's joint", () => {
  it("draws the same worn profile on the core and on the granite's back, and is named a figure", () => {
    const svg = jointClaimSvg();
    const paths = [...svg.matchAll(/class="wall draw-on[^"]*" d="([^"]+)"/g)].map((m) => m[1]!);
    expect(paths).toHaveLength(2);
    const xs = (d: string) => [...d.matchAll(/[ML] ([\d.]+)/g)].map((m) => Number(m[1]));
    const gaps = xs(paths[0]!).map((x, i) => x - xs(paths[1]!)[i]!);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.11);   // one profile, shifted: they fit
    expect(isFigure('joint-claim')).toBe(true);
  });
});
