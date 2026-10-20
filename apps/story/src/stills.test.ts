import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inline } from './markdown';
import { parseScript } from './script';
import { REPLY_STILLS, pageSources, splitAtFigures, STILLS, keyFrames, markAnchors, markers, stillFile, stillSource } from './stills';

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

describe('the replies’ pictures', () => {
  it('are committed files the site publishes, each with a page copy of its own', () => {
    const files = new Map<string, string>();
    for (const src of pageSources()) {
      expect(/^(progress|alignments\/img)\//.test(src), src).toBe(true);
      expect(existsSync(stillSource(root, src)), src).toBe(true);
      expect(files.get(stillFile(src)) ?? src, src).toBe(src);
      files.set(stillFile(src), src);
    }
    for (const r of REPLY_STILLS) expect(pageSources()).toContain(r.src);
  });

  it('each follow exactly one paragraph of their chapter’s reply', () => {
    for (const r of REPLY_STILLS) {
      const c = chapters.find((ch) => ch.n === r.chapter);
      expect(c, `chapter ${r.chapter}`).toBeDefined();
      expect(c!.reply.filter((p) => markAnchors(p, [r.anchor]).found.length).length, r.anchor).toBe(1);
    }
  });

  it('are labelled stand-ins and look choices as the stage’s are', () => {
    for (const r of REPLY_STILLS) {
      if (/enclosure-d|sphinx|lion/i.test(r.src)) expect(r.tags, r.src).toContain('stand-in');
      if (/underneath|enclosure-d/.test(r.src)) expect(r.tags, r.src).toContain('look choices');
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

  it('give a live figure its room before the next beat in its paragraph, keeping every word', () => {
    for (const c of chapters) {
      const mine = STILLS.filter((s) => s.chapter === c.n);
      for (const p of c.narration) expect(splitAtFigures(p, mine).join(' ').replace(/\s+/g, ' ')).toBe(p.replace(/\s+/g, ' '));
    }
    // chapter 9's closing paragraph: the strip, then the last beat in a paragraph of its own
    const nine = chapters.find((c) => c.n === 9)!;
    const last = nine.narration[nine.narration.length - 1]!;
    const pieces = splitAtFigures(last, STILLS.filter((s) => s.chapter === 9));
    expect(pieces).toHaveLength(2);
    expect(pieces[1]!.startsWith('Until it is')).toBe(true);
    // a figure whose words open the paragraph counts too: chapter 7's ice curve, then the Younger Dryas, then the map
    const seven = chapters.find((c) => c.n === 7)!;
    const ice = splitAtFigures(seven.narration[0]!, STILLS.filter((s) => s.chapter === 7));
    expect(ice).toHaveLength(3);
    expect(ice[1]!.startsWith('Geologists call it the Younger Dryas.')).toBe(true);
    expect(ice[2]!.startsWith('At Abu Hureyra')).toBe(true);
  });

  it('take a caption only from words the narration says', () => {
    for (const s of STILLS.filter((x) => x.widget === 'caption')) {
      const c = chapters.find((ch) => ch.n === s.chapter)!;
      expect(s.caption, s.anchor).toBeTruthy();
      expect(c.narration.join(' ').toLowerCase()).toContain(s.caption!.toLowerCase());
    }
  });
});
