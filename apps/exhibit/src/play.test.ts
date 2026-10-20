import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readLeaves } from './leaves';
import {
  chapterStarts, leafFromSearch, scriptChapters, scriptPart, searchWithLeaf, speakingTime, turnAt, turnSeconds, wordTimes,
} from './play';
import { DEG } from './projection';

const repo = join(__dirname, '..', '..', '..');
const script = readFileSync(join(repo, 'docs', 'script.md'), 'utf8');
const leaves = readLeaves(JSON.parse(readFileSync(join(repo, 'apps', 'exhibit', 'leaves.json'), 'utf8')));

describe('the script', () => {
  it('has its ten chapters, titled', () => {
    const ch = scriptChapters(script);
    expect(ch.map((c) => c.n)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(ch[0]?.title).toBe('Cold open');
    expect(ch[1]?.title).toBe('Older than it should be');
  });
  it('gives each chapter its reply and its spoken reply, and nothing past them', () => {
    const reply = scriptPart(script, 1, 'The reply');
    expect(reply.startsWith('The strongest answer is the order of building.')).toBe(true);
    expect(reply).not.toContain('**');
    expect(scriptPart(script, 0, 'Spoken reply')).toBe("Archaeologists answer that the Sphinx was cut from Khafre's quarry about 2500 BCE, and each chapter sets their reasons beside the claim.");
    expect(scriptPart(script, 42, 'The reply')).toBe('');
  });
});

describe('chapterStarts', () => {
  it('finds the first leaf of each chapter', () => {
    const starts = chapterStarts(leaves, scriptChapters(script));
    expect(starts[0]).toEqual({ chapter: { n: 0, title: 'Cold open' }, index: 0 });
    expect(starts[1]?.chapter.title).toBe('Older than it should be');
    expect(leaves[starts[1]!.index]?.chapter).toBe(1);
    expect(leaves[starts[1]!.index - 1]?.chapter).toBe(0);
  });
});

describe('timing without a voice', () => {
  it('takes about 2.5 words a second, a little more at each stop', () => {
    expect(speakingTime('one two three four five')).toBeCloseTo(2);
    expect(speakingTime('one, two.')).toBeCloseTo(0.8 + 0.36);
  });
  it('starts the words in order, the first at 0', () => {
    const t = wordTimes('So how old is the Sphinx?');
    expect(t[0]).toEqual({ word: 'So', at: 0 });
    expect(t.map((w) => w.word).join(' ')).toBe('So how old is the Sphinx?');
    for (let i = 1; i < t.length; i++) expect(t[i]!.at).toBeGreaterThan(t[i - 1]!.at);
  });
});

describe('turns', () => {
  const a = { yaw: 350 * DEG, pitch: 0, fov: 60 * DEG }, b = { yaw: 10 * DEG, pitch: 20 * DEG, fov: 40 * DEG };
  it('starts at the first aim, ends at the second, and goes the short way across north', () => {
    expect(turnAt(a, b, 0).yaw).toBeCloseTo(-10 * DEG);
    expect(turnAt(a, b, 1).yaw).toBeCloseTo(10 * DEG);
    expect(turnAt(a, b, 0.5).yaw).toBeCloseTo(0);
    expect(turnAt(a, b, 0.5).pitch).toBeCloseTo(10 * DEG);
    expect(turnAt(a, b, 2).fov).toBeCloseTo(40 * DEG);
  });
  it('takes longer for a wider swing, within bounds', () => {
    expect(turnSeconds(a, a)).toBeCloseTo(0.9);
    expect(turnSeconds(a, b)).toBeGreaterThan(0.9);
    expect(turnSeconds(a, { ...a, yaw: 170 * DEG })).toBe(2.4);
  });
});

describe('the address', () => {
  it('names a leaf, and falls back to the first', () => {
    expect(leafFromSearch('?leaf=ch1-floor', leaves)).toBe(leaves.findIndex((L) => L.id === 'ch1-floor'));
    expect(leafFromSearch('?leaf=nowhere', leaves)).toBe(0);
    expect(leafFromSearch('', leaves)).toBe(0);
  });
  it('keeps what else it carries', () => {
    expect(searchWithLeaf('?voice=x&leaf=a', 'ch1-floor')).toBe('?voice=x&leaf=ch1-floor');
    expect(searchWithLeaf('', 'ch0-dawn')).toBe('?leaf=ch0-dawn');
  });
});
