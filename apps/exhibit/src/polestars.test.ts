import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { plumbLine, poleStars, poleStarsSvg, yearFor } from './polestars';

const root = join(__dirname, '..', '..', '..', 'data');
const named = JSON.parse(readFileSync(join(root, 'stars', 'named.json'), 'utf8')) as { id: string; raDeg: number; decDeg: number; pmRaMasYr: number; pmDecMasYr: number }[];
const mizar = named.find((s) => s.id === 'mizar')!, kochab = named.find((s) => s.id === 'kochab')!;
const GIZA = 29.979;

describe("Spence's plumb line", () => {
  it('is true north in the middle of the third millennium BCE, as Spence found (about 2467 BCE)', () => {
    const y = yearFor(mizar, kochab, GIZA, 'upper', 0)!;
    expect(y).toBeGreaterThan(-2600);
    expect(y).toBeLessThan(-2400);
    // the same year whichever star is above: the line through both passes the pole
    expect(yearFor(mizar, kochab, GIZA, 'lower', 0)!).toBeCloseTo(y, 0);
  });

  it('strays the opposite way in the two configurations, and further the further from that year', () => {
    const near = plumbLine(mizar, kochab, -2450, GIZA), far = plumbLine(mizar, kochab, -2650, GIZA);
    expect(Math.sign(far.upper)).toBe(-Math.sign(far.lower));
    expect(Math.abs(far.upper)).toBeGreaterThan(Math.abs(near.upper));
    expect(far.upper).toBeCloseTo(-far.lower, 2);
  });

  it('reads a turn back as the year that gives it', () => {
    const y = yearFor(mizar, kochab, GIZA, 'upper', -0.065)!;
    expect(plumbLine(mizar, kochab, y, GIZA).upper).toBeCloseTo(-0.065, 6);
  });

  it('gathers the figure: the curve, a year per pyramid and configuration, and the kings with radiocarbon dates', () => {
    const p = poleStars(mizar, kochab, GIZA, [{ king: 'Khufu', orientation: -0.065 }, { king: 'Menkaure', orientation: 0.234167 }],
      [{ king: 'Khufu', earliest: -2628, latest: -2578 }, { king: 'Aha', earliest: -3110, latest: -3044 }])!;
    expect(p.reigns.map((r) => r.king)).toEqual(['Khufu']);
    expect(p.from).toBeLessThanOrEqual(-2628);
    expect(p.curve).toHaveLength(41);
    for (const r of p.readings) expect(r.upper !== null || r.lower !== null).toBe(true);
    const svg = poleStarsSvg(p);
    expect(svg).toContain('Khufu &#8722;3.9&#8242;');
    expect(svg).toContain('Menkaure +14.1&#8242;');
    expect((svg.match(/<circle/g) ?? []).length).toBe(4);
  });
});
