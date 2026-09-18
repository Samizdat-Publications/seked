import type { ComparisonResult } from '@seked/claims/browser';
import { loadDatabase } from '@seked/data';
import type { Source } from '@seked/data/browser';
import { describe, expect, it } from 'vitest';
import { methodWords, shortTitle, worstIndex } from './ClaimDetail';

const source = (citation: string, year?: number): Source => ({ id: 'x', kind: 'reference', citation, year });

const comparison = (over: Partial<ComparisonResult>): ComparisonResult => ({
  label: 'a',
  formula: 'x',
  target: 'y',
  unit: 'ratio',
  value: 1,
  targetValue: 1,
  residualPct: 0,
  absolute: 0,
  tolerancePct: 0.5,
  within: true,
  ...over,
});

describe('worstIndex', () => {
  it('marks nothing when there is nothing to rank', () => {
    expect(worstIndex([])).toBe(-1);
    expect(worstIndex([comparison({ residualPct: 9 })])).toBe(-1);
  });

  it('marks the comparison that misses worst, whichever way it misses', () => {
    const list = [comparison({ residualPct: 0.2 }), comparison({ residualPct: -3.1 }), comparison({ residualPct: 1 })];
    expect(worstIndex(list)).toBe(1);
  });

  it('ranks a comparison with no percentage by how much of its absolute tolerance it spends', () => {
    const list = [
      comparison({ residualPct: 0.4 }),
      comparison({ residualPct: Number.NaN, absolute: 0.9, toleranceAbs: 1 }),
      comparison({ residualPct: Number.NaN, absolute: 4, toleranceAbs: 1 }),
    ];
    expect(worstIndex(list)).toBe(2);
  });
});

describe('shortTitle', () => {
  it('takes the surname and the year out of a citation', () => {
    expect(shortTitle(source('Petrie, W. M. F. (1883). The Pyramids and Temples of Gizeh. London: Field & Tuer.'))).toBe('Petrie 1883');
    expect(shortTitle(source('Hancock, G. (1995). Fingerprints of the Gods. London: Heinemann.'))).toBe('Hancock 1995');
  });

  it('keeps two authors and shortens three or more', () => {
    expect(shortTitle(source('Bauval, R. & Gilbert, A. (1994). The Orion Mystery. London: Heinemann.'))).toBe('Bauval & Gilbert 1994');
    expect(
      shortTitle(source('Vondrák, J., Capitaine, N. & Wallace, P. (2011). New precession expressions. A&A 534, A22.')),
    ).toBe('Vondrák et al. 2011');
  });

  it('keeps an et al. the citation already has', () => {
    expect(shortTitle(source("Morishima, K. et al. (2017). Discovery of a big void in Khufu's Pyramid. Nature 552."))).toBe(
      'Morishima et al. 2017',
    );
  });

  it('falls back to the first clause when a citation names no author and no year', () => {
    expect(shortTitle(source('Commonly cited WGS84 coordinates of the Great Pyramid (29°58′45″ N, 31°08′03″ E).'))).toBe(
      'Commonly cited WGS84 coordinates of the Great…',
    );
    expect(shortTitle(source('IAU 2012 Resolution B2: the astronomical unit is 149 597 870 700 m exactly.'))).toBe(
      'IAU 2012 Resolution B2',
    );
  });

  it('never invents a co-author out of a citation that opens on a sentence', () => {
    expect(shortTitle(source('Cayce, E. Readings on Atlantis and the Hall of Records under the Sphinx (1930s-40s).'))).toBe('Cayce');
  });

  it('says something for every source the database carries, and nothing very long', () => {
    const db = loadDatabase();
    for (const s of db.sources) {
      const short = shortTitle(s);
      expect(short, s.id).not.toBe('');
      expect(short.length, s.id).toBeLessThanOrEqual(48);
    }
  });
});

describe('methodWords', () => {
  it('leaves out a method that only says the figure was copied off a page', () => {
    expect(methodWords('tabulated')).toBeUndefined();
    expect(methodWords('printed on the plate')).toBeUndefined();
    expect(methodWords(undefined)).toBeUndefined();
  });

  it('says how a number was got when the method is more than a transcription', () => {
    expect(methodWords('tape')).toBe('tape');
    expect(methodWords('scaled from plate')).toBe('scaled from plate');
    expect(methodWords('muon radiography')).toBe('muon radiography');
  });
});
