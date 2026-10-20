import { describe, expect, it } from 'vitest';
import { type HeadsManifest, factorLine } from './objectview';

const m = (least: number | null): HeadsManifest => ({ centre: [0, 0, 0], objects: [], head_scale: { used: 1.17, least }, standin: 'Stand-ins.' });

describe("the object view's account of H1", () => {
  it('gives the least enlargement the fit found, labelled a proposal, with the renders own beside it', () => {
    const s = factorLine(m(1.1625));
    expect(s).toContain('1.16 times');
    expect(s).toContain('a proposal');
    expect(s).toContain('1.17');
  });
  it('says only the look choice when the fit was not run for the export', () => {
    const s = factorLine(m(null));
    expect(s).toContain('look choice');
    expect(s).not.toContain('proposal');
  });
});
