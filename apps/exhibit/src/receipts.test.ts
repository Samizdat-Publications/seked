import { loadClaims } from '@seked/claims';
import { loadDatabase } from '@seked/data';
import { describe, expect, it } from 'vitest';
import { leafReceipts, receiptLine } from './receipts';

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
