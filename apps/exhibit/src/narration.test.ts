import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readLeaves } from './leaves';
import { type ChapterRecording, type Recording, leafSpans } from './narration';

const repo = join(__dirname, '..', '..', '..');
const leaves = readLeaves(JSON.parse(readFileSync(join(repo, 'apps', 'exhibit', 'leaves.json'), 'utf8')));

/** A recording of `text` at one character every 0.1 s. */
function fake(text: string): Recording {
  const characters = [...text];
  return { file: 'x.mp3', text, seconds: characters.length / 10, alignment: { characters, start: characters.map((_, i) => i / 10), end: characters.map((_, i) => (i + 1) / 10) } };
}

describe('leafSpans', () => {
  const rec = fake('One two.\n\nThree  four five.');

  it("gives each leaf its stretch of the recording and each word's time inside it", () => {
    const [a, b] = leafSpans(rec, ['One two.', 'Three four five.']);
    expect(a).toEqual({ start: 0, end: 0.8, words: [{ word: 'One', at: 0 }, { word: 'two.', at: 0.4 }] });
    expect(b?.start).toBeCloseTo(1.0);
    expect(b?.end).toBeCloseTo(2.7);
    expect(b?.words.map((w) => w.word)).toEqual(['Three', 'four', 'five.']);
    expect(b?.words[1]?.at).toBeCloseTo(0.7);   // two spaces in the recording's text, one in the leaf's
  });
  it('looks for each leaf after the one before, and gives null for words not recorded', () => {
    expect(leafSpans(fake('Go. Go.'), ['Go.', 'Go.']).map((s) => s?.start)).toEqual([0, 0.4]);
    expect(leafSpans(rec, ['Six.', 'One two.'])).toEqual([null, expect.objectContaining({ start: 0 })]);
    expect(leafSpans(rec, ['Three four five.', 'One two.'])[1]).toBeNull();
  });
});

// The recordings themselves, when this checkout has them (assets/narration, Git LFS).
const recorded = [0, 1].filter((n) => existsSync(join(repo, 'assets', 'narration', `ch${n}.json`)));
describe.runIf(recorded.length > 0)('the recorded chapters', () => {
  it('hold every leaf of their chapter, in order, inside the recording', () => {
    for (const n of recorded) {
      const ch = JSON.parse(readFileSync(join(repo, 'assets', 'narration', `ch${n}.json`), 'utf8')) as ChapterRecording;
      const rec = ch.files.narration!;
      const spans = leafSpans(rec, leaves.filter((L) => L.chapter === n).map((L) => L.say));
      spans.forEach((s, i) => {
        expect(s, `chapter ${n}, leaf ${i}`).not.toBeNull();
        expect(s!.end).toBeGreaterThan(s!.start);
        expect(s!.end).toBeLessThanOrEqual(rec.seconds + 0.01);
        if (i > 0) expect(s!.start).toBeGreaterThanOrEqual(spans[i - 1]!.end);
      });
    }
  });
});
