import { describe, expect, it } from 'vitest';
import { WELLS_SPREAD, khafreWells } from './wells';

const env: Record<string, number> = {
  'g2.centre.offset.west': 334.41, 'g2.centre.offset.south': 353.86, 'g2.base.elevation.relative': 10,
  'g2.base.side.mean': 215.25, 'g2.sar.wells.bottom.up': -648, 'g2.sar.wells.count': 8, 'g2.sar.wells.rows': 2,
};

describe("the claimed wells in the scene", () => {
  const o = khafreWells(env)!;
  const wells = o.lines.filter((l) => l.style === 'dash') as { from: number[]; to: number[] }[];
  it('draws each well from the base down to the claimed depth, in rows under the centre', () => {
    expect(wells).toHaveLength(8);
    for (const w of wells) {
      expect(w.from[2]).toBe(10);
      expect(w.to[2]).toBe(10 - 648);
      expect(w.to[0]).toBe(w.from[0]);
      expect(Math.abs(w.from[0]! + 334.41)).toBeLessThanOrEqual(WELLS_SPREAD * 215.25 / 2 + 1e-9);
      expect(Math.abs(w.from[1]! + 353.86)).toBeLessThan(215.25 / 2);
    }
    expect(new Set(wells.map((w) => w.from[1])).size).toBe(2);
  });
  it("outlines Khafre's base faintly and says the wells are a claim placed by choice", () => {
    expect(o.lines.filter((l) => l.style === 'faint')).toHaveLength(4);
    expect(o.labels[0]!.text).toContain('8 wells');
    expect(o.labels[0]!.sub).toContain('648 m');
    expect(o.labels[0]!.sub).toContain('look choice');
  });
  it('waits for every record', () => {
    const { ['g2.sar.wells.rows']: _, ...less } = env;
    expect(khafreWells(less)).toBeNull();
  });
});
