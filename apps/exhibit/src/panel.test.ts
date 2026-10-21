import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readLeaves } from './leaves';
import { chapterReply, inline } from './panel';

const repo = join(__dirname, '..', '..', '..');
const script = readFileSync(join(repo, 'docs', 'script.md'), 'utf8');
const leaves = readLeaves(JSON.parse(readFileSync(join(repo, 'apps', 'exhibit', 'leaves.json'), 'utf8')));

describe('the reply', () => {
  it('is there, spoken and in full, for every chapter the leaves cover', () => {
    for (const ch of new Set(leaves.map((L) => Number(L.reply.slice(2))))) {
      const r = chapterReply(script, ch);
      expect(r.spoken.length, `chapter ${ch}`).toBeGreaterThan(40);
      expect(r.full.length, `chapter ${ch}`).toBeGreaterThan(r.spoken.length);
      expect(r.full).not.toMatch(/\*\*(Spoken reply|Sources)\*\*/);
    }
  });
  it("starts chapter 1's with the order of building", () => {
    expect(chapterReply(script, 1).full).toMatch(/^The strongest answer is the order of building\./);
  });
});

describe('inline', () => {
  it('escapes first, then marks code, bold and italics', () => {
    expect(inline('<b> & `x` **y** *z*')).toBe('&lt;b&gt; &amp; <code>x</code> <strong>y</strong> <em>z</em>');
    expect(inline("Khafre's 2*3")).toBe("Khafre's 2*3");
  });
});
