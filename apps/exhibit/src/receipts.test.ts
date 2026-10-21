import { loadClaims } from '@seked/claims';
import { loadDatabase } from '@seked/data';
import { describe, expect, it } from 'vitest';
import { TIER_WORDS, claimEvidence, leafReceipts, receiptLine } from './receipts';

const db = loadDatabase();
const claims = loadClaims();

describe("a leaf's receipts", () => {
  it("computes chapter 2's claims as the script states them", () => {
    const [c5, d4] = leafReceipts(db, claims, ['C5', 'D4']);
    expect(c5?.id).toBe('C5');
    expect(c5?.fits).toBe(false); // the script: Regulus rises ten degrees off due east, twice the band
    expect(d4?.fits).toBe(true); // the script: all three temple axes hold
  });

  it('skips an id with no claim file, such as a proposal', () => {
    expect(leafReceipts(db, claims, ['H1', 'C5']).map((r) => r.id)).toEqual(['C5']);
  });

  it('writes a comparison as measured against claimed, with its verdict', () => {
    const [c5] = leafReceipts(db, claims, ['C5']);
    const line = receiptLine(c5!.comparisons[0]!);
    expect(line).toMatch(/^Regulus's rising azimuth against due east: 100°14′0\d″ against 90°00′00″/);
    expect(line).toMatch(/does not hold$/);
  });
});

describe("how far a claim's evidence has got", () => {
  const claim = (id: string) => claims.find((c) => c.id === id)!;
  it('follows a derived quantity back to its records and names the structures they belong to', () => {
    const e = claimEvidence(db, claim('A1'))!;
    expect(e.tier).toBe('excavated');
    expect(e.words).toBe(TIER_WORDS.excavated);
    expect(e.structures).toEqual(['Great Pyramid of Khufu']);
  });
  it('takes the weakest tier among the inputs', () => {
    const tiers = new Set(claims.map((c) => claimEvidence(db, c)?.tier));
    expect([...tiers].every((t) => t === undefined || t in TIER_WORDS)).toBe(true);
    const fake = { ...claim('A1'), comparisons: [{ ...claim('A1').comparisons[0]!, formula: 'g1.base.perimeter + g2.sar.wells.bottom.up' }] };
    expect(claimEvidence(db, fake)!.tier).toBe('claimed');
  });
});

describe('what a reported structure would change', () => {
  it('is said only of structures reported but not yet published or replicated, never of a dug one', () => {
    const said = db.structures.filter((s) => s.if_it_held);
    expect(said.map((s) => s.id)).toEqual(expect.arrayContaining(['g2.sar-shafts', 'sphinx.paw-cavity', 'hawara.mataha-walls']));
    for (const s of said) expect(s.evidence, s.id).toBe('claimed');
  });
});
