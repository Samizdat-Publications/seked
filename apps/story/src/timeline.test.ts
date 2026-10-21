import { loadClaims } from '@seked/claims';
import { describe, expect, it } from 'vitest';
import { ICE, ICE_SOURCE, iceBetween, toB2k, YOUNGER_DRYAS } from './timeline';
import sources from '../../../data/sources.json';

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const d18o = (old: number, young: number) => mean(iceBetween(old, young).map((p) => p.d18o));

describe("chapter 7's timeline", () => {
  it('rests on imported data and records with sources', () => {
    expect(ICE.length).toBeGreaterThan(2000);
    const ids = new Set((sources as { id: string }[]).map((s) => s.id));
    expect(ids.has(ICE_SOURCE)).toBe(true);
    for (const e of Object.values(YOUNGER_DRYAS)) {
      expect(ids.has(e.source)).toBe(true);
      expect(e.verified).toBe(false);
    }
  });

  it('shows the Younger Dryas as a cold dip between warmer times, in the ice itself', () => {
    const { start, end } = YOUNGER_DRYAS;
    expect(start.age_b2k).toBeGreaterThan(end.age_b2k);
    const inside = d18o(start.age_b2k - 100, end.age_b2k + 100);
    expect(inside).toBeLessThan(d18o(start.age_b2k + 600, start.age_b2k + 100) - 1); // the Allerød before
    expect(inside).toBeLessThan(d18o(end.age_b2k - 100, end.age_b2k - 600) - 1); // the Holocene after
  });

  it("puts C4's and C5's epochs inside the dip", () => {
    for (const id of ['C4', 'C5']) {
      const b2k = toB2k(loadClaims().find((c) => c.id === id)!.epoch!);
      expect(b2k).toBeLessThan(YOUNGER_DRYAS.start.age_b2k);
      expect(b2k).toBeGreaterThan(YOUNGER_DRYAS.end.age_b2k);
    }
  });
});
