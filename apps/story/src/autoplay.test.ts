import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHAPTER_GAP, PARAGRAPH_GAP, WORDS_PER_SECOND, clock, lineAt, replyAt, schedule, timeAt, words } from './autoplay';
import { parseScript } from './script';

const text = readFileSync(join(__dirname, '..', '..', '..', 'docs', 'script.md'), 'utf8');
const chapters = parseScript(text);

describe('the autoplay schedule', () => {
  it('counts each chapter’s words as the script’s running-time table does', () => {
    const table = [...text.matchAll(/^\| (\d)\. [^|]+\| ([\d,]+) \|/gm)].map((m) => [Number(m[1]), Number(m[2]!.replace(',', ''))]);
    expect(table.length).toBe(10);
    for (const [n, count] of table) {
      const c = chapters.find((ch) => ch.n === n)!;
      expect(Math.abs(c.narration.reduce((a, p) => a + words(p), 0) - count!), `chapter ${n}`).toBeLessThanOrEqual(3);
    }
  });

  it('runs at the script’s rate, about sixteen minutes with the spoken replies', () => {
    const s = schedule(chapters.map((c) => ({ n: c.n, paragraphs: c.narration, reply: c.spokenReply })));
    expect(WORDS_PER_SECOND).toBe(2.5);
    expect(s.duration / 60).toBeGreaterThan(14);
    expect(s.duration / 60).toBeLessThan(17);
    expect(s.replies.length).toBe(chapters.filter((c) => c.spokenReply).length);
  });

  it('puts each reply after its chapter’s narration and before the next chapter', () => {
    const s = schedule([{ n: 0, paragraphs: ['one two three four five'], reply: 'a b' }, { n: 1, paragraphs: ['six seven'] }]);
    expect(s.paragraphs[0]).toEqual({ chapter: 0, t0: 0, t1: 2 });
    expect(s.replies[0]!.t0).toBeCloseTo(2 + PARAGRAPH_GAP);
    expect(s.replies[0]!.t1).toBeCloseTo(2.8 + PARAGRAPH_GAP);
    expect(s.paragraphs[1]!.t0).toBeCloseTo(2.8 + PARAGRAPH_GAP + CHAPTER_GAP);
    expect(replyAt(3, s)?.chapter).toBe(0);
    expect(replyAt(1, s)).toBeUndefined();
  });
});

describe('the reading line', () => {
  const s = schedule([{ n: 0, paragraphs: ['one two three four five'], reply: 'a b' }, { n: 1, paragraphs: ['six seven'] }]);
  const boxes: [number, number][] = [[100, 300], [1000, 1100]];

  it('moves through a paragraph as it is spoken', () => {
    expect(lineAt(0, s, boxes)).toBe(100);
    expect(lineAt(1, s, boxes)).toBe(200);
    expect(lineAt(2, s, boxes)).toBe(300);
  });

  it('holds through the reply, then moves to the next paragraph by the time it begins', () => {
    expect(lineAt(s.replies[0]!.t0 + 0.1, s, boxes)).toBe(300);
    expect(lineAt(s.replies[0]!.t1, s, boxes)).toBe(300);
    expect(lineAt(s.paragraphs[1]!.t0, s, boxes)).toBeCloseTo(1000);
    expect(lineAt(s.duration + 5, s, boxes)).toBe(1100);
  });

  it('gives back the time for a place, so play starts where the reader is', () => {
    for (const t of [0, 0.5, 1.7, s.paragraphs[1]!.t0 + 0.3]) expect(timeAt(lineAt(t, s, boxes), s, boxes)).toBeCloseTo(t);
    expect(timeAt(0, s, boxes)).toBe(0);
  });

  it('reads as m:ss', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(61.9)).toBe('1:01');
  });
});
