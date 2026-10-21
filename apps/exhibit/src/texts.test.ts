import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { degreesToSeked, sekedToDegrees } from '@seked/units';
import { describe, expect, it } from 'vitest';
import { kingListsData, kingListsSvg, rhind56, rhind56Svg, unitFractions } from './texts';

const data = join(__dirname, '..', '..', '..', 'data');
const read = (p: string) => JSON.parse(readFileSync(join(data, p), 'utf8'));
const figures = readdirSync(join(data, 'texts')).filter((f) => f.endsWith('.json')).flatMap((f) => read(`texts/${f}`).figures);
const chronology = read('measurements/chronology.json');
const sources = read('sources.json');

describe('the king lists, counted back from Aha', () => {
  const d = kingListsData(figures, chronology, sources, -10499);
  it('ends every span at the radiocarbon median and starts it the text\'s years before', () => {
    const aha = chronology.find((r: { key: string }) => r.key === 'chronology.aha.accession.median').value;
    for (const s of d.spans) { expect(s.to).toBe(aha); expect(s.to - s.from).toBe(s.years); }
    // the script's arithmetic: about 16,500 BCE for the Followers alone, about 39,700 BCE summed
    expect(1 - d.spans[0]!.from).toBeCloseTo(16500, -2);
    expect(1 - d.spans[1]!.from).toBeCloseTo(39700, -2);
  });
  it('marks the sum as the reader\'s, not the papyrus\'s, and keeps the + x of the damaged totals', () => {
    expect(d.spans.map((s) => s.summed)).toEqual([false, true, false]);
    expect(d.spans[0]!.plusX && d.spans[1]!.plusX).toBe(true);
    expect(d.spans[2]!.plusX).toBe(false);
  });
  it('lets no span land on the epoch line', () => {
    for (const s of d.spans) expect(Math.abs(s.from - d.epoch)).toBeGreaterThan(1000);
    const svg = kingListsSvg(d);
    expect(svg).toContain('10,500 BCE');
    expect(svg).toContain('13,420 + x years');
  });
});

describe('Rhind problem 56', () => {
  it('writes fractions as the scribes did', () => {
    expect(unitFractions(180, 250)).toEqual({ whole: 0, parts: [2, 5, 50] });
    expect(unitFractions(1260, 250)).toEqual({ whole: 5, parts: [25] });
    expect(unitFractions(5500, 1000)).toEqual({ whole: 5, parts: [2] });
  });
  it('works the papyrus\'s answer, 5 1/25 palms, from its base and height', () => {
    const r = rhind56(figures, degreesToSeked(sekedToDegrees(5.5)));
    expect(r.half).toBe(180);
    expect(r.run.parts).toEqual([2, 5, 50]);
    expect(r.seked).toEqual({ whole: 5, parts: [25] });
    expect(r.angle).toBeGreaterThan(r.khufuAngle);
    const svg = rhind56Svg(r);
    expect(svg).toContain('1/2 + 1/5 + 1/50 cubit');
    expect(svg).toContain('5 + 1/25 palms');
    expect(svg).toContain('5 + 1/2 palms');
  });
});
