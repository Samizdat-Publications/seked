import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseScript } from './script';

const root = join(__dirname, '..', '..', '..');
const md = readFileSync(join(root, 'docs', 'script.md'), 'utf8');
const chapters = parseScript(md);
const ch = (n: number) => chapters.find((c) => c.n === n)!;
const sourceIds = new Set((JSON.parse(readFileSync(join(root, 'data', 'sources.json'), 'utf8')) as { id: string }[]).map((s) => s.id));

describe('the script as the page reads it', () => {
  it('has the ten chapters, 0 to 9, in order', () => {
    expect(chapters.map((c) => c.n)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(ch(0).title).toBe('Cold open');
    expect(ch(8).title).toBe('Underneath');
  });

  it('gives every chapter its narration, beats, reply and sources', () => {
    for (const c of chapters) {
      expect(c.narration.length, `chapter ${c.n}`).toBeGreaterThan(0);
      expect(c.beats.length, `chapter ${c.n}`).toBeGreaterThan(0);
      expect(c.reply.length, `chapter ${c.n}`).toBeGreaterThan(0);
      expect(c.sources.length, `chapter ${c.n}`).toBeGreaterThan(0);
    }
  });

  it('anchors each beat to words the narration speaks', () => {
    for (const c of chapters) {
      const spoken = c.narration.join(' ').replace(/[’]/g, "'");
      for (const b of c.beats) {
        expect(spoken, `chapter ${c.n}: "${b.anchor}"`).toContain(b.anchor.replace(/[’]/g, "'"));
      }
    }
  });

  it('cites only sources that are in data/sources.json', () => {
    for (const c of chapters) {
      for (const s of c.sources) expect(sourceIds.has(s), `chapter ${c.n}: ${s}`).toBe(true);
    }
  });

  it("finds the claims a chapter's receipts name", () => {
    expect(ch(2).claims).toEqual(expect.arrayContaining(['C5', 'D4']));
    expect(ch(0).claims).toEqual([]);
  });

  it("keeps chapter 8's draft note apart from its narration", () => {
    expect(ch(8).note).toMatch(/draft/);
    expect(ch(8).narration[0]).not.toMatch(/draft/);
  });

  it('stops at the first heading that is not a chapter', () => {
    expect(ch(9).reply.join(' ')).not.toMatch(/Running time/);
  });
});
