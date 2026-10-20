import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inline } from './markdown';
import { parseScript } from './script';
import { STILLS, keyFrames, markAnchors, markers, stillFile, stillSource } from './stills';

const root = join(__dirname, '..', '..', '..');
const chapters = parseScript(readFileSync(join(root, 'docs', 'script.md'), 'utf8'));
const fold = (s: string) => s.replace(/[’‘]/g, "'");

describe('the stage’s stills', () => {
  it('are committed files in the directories the site publishes', () => {
    for (const s of STILLS) {
      expect(/^(progress|alignments\/img)\//.test(s.src), s.src).toBe(true);
      expect(existsSync(stillSource(root, s.src)), s.src).toBe(true);
    }
  });

  it('have one page copy per file, and no two files share one', () => {
    const files = new Map<string, string>();
    for (const s of STILLS) {
      expect(stillFile(s.src)).toMatch(/^stills\/[\w.-]+\.jpg$/);
      expect(files.get(stillFile(s.src)) ?? s.src, s.src).toBe(s.src);
      files.set(stillFile(s.src), s.src);
    }
  });

  it('each start at one of its chapter’s beats, in the narration’s order', () => {
    for (const c of chapters) {
      const anchors = c.beats.map((b) => fold(b.anchor));
      const mine = STILLS.filter((s) => s.chapter === c.n).map((s) => anchors.indexOf(fold(s.anchor)));
      for (const [k, i] of mine.entries()) expect(i, `chapter ${c.n}, still ${k}`).toBeGreaterThanOrEqual(0);
      expect(mine, `chapter ${c.n}`).toEqual([...mine].sort((a, b) => a - b));
    }
  });

  it('are each marked once in the rendered narration', () => {
    for (const c of chapters) {
      const anchors = STILLS.filter((s) => s.chapter === c.n).map((s) => s.anchor);
      const found = c.narration.flatMap((p) => markAnchors(p, anchors).found);
      expect(found.sort((a, b) => a - b), `chapter ${c.n}`).toEqual(anchors.map((_, i) => i));
    }
  });

  it('label every claim state and every Sphinx stand-in', () => {
    for (const s of STILLS) {
      if (/lion|10,?[45]\d\d|First Time/.test(s.alt) && s.chapter !== 9) expect(s.tags, s.alt).toContain('claim state');
      if (/sphinx|lion/i.test(s.src)) expect(s.tags, s.src).toContain('stand-in');
    }
  });
});

describe('chapter 9’s strip', () => {
  it('holds a key frame for every chapter before the last, in order', () => {
    expect(keyFrames().map((s) => s.chapter)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('beat markers', () => {
  it('survive the Markdown and land before their words', () => {
    const { text } = markAnchors('Look at the *head*. The figure was a lion’s first.', ['figure was a lion\'s', 'Look']);
    const html = markers(inline(text), (i) => `data-i="${i}"`);
    expect(html).toBe('<span class="beat" data-i="1"></span>Look at the <em>head</em>. ' +
      'The <span class="beat" data-i="0"></span>figure was a lion’s first.');
  });
});
