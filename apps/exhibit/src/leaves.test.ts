import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isFigure } from './figures';
import { type Leaf, type RenderStations, cueIndex, drawCue, joinProblems, leafPanorama, readLeaves, stationMoment } from './leaves';

const repo = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const leaves = readLeaves(JSON.parse(read('apps/exhibit/leaves.json')));
const render = JSON.parse(read('render/stations.json')) as RenderStations;
const walk = JSON.parse(read('apps/walk/stations.json')) as { states: { id: string }[]; stations: { id: string; panoramas: Record<string, string> }[] };
const overlays = JSON.parse(read('apps/walk/overlays.json')) as Record<string, unknown>;

/** A chapter's narration in docs/script.md: the paragraphs between its **Narration** and **Beats** lines. */
function narration(chapter: number): string {
  const script = read('docs/script.md');
  const start = script.indexOf(`## ${chapter}. `);
  expect(start).toBeGreaterThanOrEqual(0);
  const body = script.slice(start);
  const from = body.indexOf('**Narration**'), to = body.indexOf('**Beats**');
  return body.slice(body.indexOf('\n', from) + 1, to).trim();
}
const words = (s: string) => s.split(/\s+/).filter(Boolean);

describe('leaves.json', () => {
  it('parses', () => {
    expect(leaves.length).toBeGreaterThan(0);
  });

  it('keeps every word of each chapter it covers, in order, and nothing else', () => {
    const chapters = [...new Set(leaves.map((L) => L.chapter))];
    for (const ch of chapters) {
      const said = leaves.filter((L) => L.chapter === ch).map((L) => L.say).join(' ');
      expect(words(said), `chapter ${ch}`).toEqual(words(narration(ch)));
    }
  });

  it('says one or two sentences a leaf', () => {
    for (const L of leaves) {
      const sentences = L.say.split(/(?<=[.?!])\s+/).filter(Boolean);
      expect(sentences.length, L.id).toBeLessThanOrEqual(2);
    }
  });

  it('keeps its joins clean', () => {
    expect(joinProblems(leaves)).toEqual([]);
  });

  it('stands only at stations, in eras and moments the renderer knows', () => {
    const eras = new Set(walk.states.map((s) => s.id));
    for (const L of leaves) {
      expect(render.stations.some((s) => s.id === L.station), L.id).toBe(true);
      expect(eras.has(L.era), L.id).toBe(true);
      expect(Object.keys(render.moments), L.id).toContain(L.moment);
    }
  });

  it('draws only overlays and figures that exist and cites only claims that exist', () => {
    for (const L of leaves) {
      for (const d of L.draw) {
        const { overlay, word } = drawCue(d);
        if (!isFigure(overlay)) expect(Object.keys(overlays), L.id).toContain(overlay);
        expect(cueIndex(L.say, word), `${L.id}: ${d}`).toBeGreaterThanOrEqual(0);
      }
      for (const r of L.receipts) expect(existsSync(join(repo, 'data', 'claims', `${r}.yaml`)), `${L.id}: ${r}`).toBe(true);
      expect(read('docs/script.md'), L.id).toContain(`## ${L.reply.slice(2)}. `);
    }
  });
});

describe('joinProblems', () => {
  const base: Leaf = {
    id: 'ch1-a', chapter: 1, station: 'sphinx-flank', era: 'today', moment: 'high-noon', view: { yaw: 0, pitch: 0, fov: 60 },
    arrive: 'cut', say: 'A.', draw: [], hold: 1, interact: 'look', receipts: [], reply: 'ch1',
  };
  const next = (o: Partial<Leaf>): Leaf => ({ ...base, id: 'ch1-b', ...o });

  it('wants the first leaf to arrive by cut', () => {
    expect(joinProblems([{ ...base, arrive: 'turn' }])).toHaveLength(1);
  });
  it('wants a flight to keep its era and moment and to go somewhere', () => {
    expect(joinProblems([base, next({ arrive: 'flight', station: 'sphinx-face' })])).toEqual([]);
    expect(joinProblems([base, next({ arrive: 'flight', station: 'sphinx-face', era: 'lion' })])).toHaveLength(1);
    expect(joinProblems([base, next({ arrive: 'flight', station: 'sphinx-face', moment: 'june-dawn' })])).toHaveLength(1);
    expect(joinProblems([base, next({ arrive: 'flight' })])).toHaveLength(1);
  });
  it('wants a wipe to change only the era, and a turn to change nothing but the view', () => {
    expect(joinProblems([base, next({ arrive: 'wipe', era: 'lion' })])).toEqual([]);
    expect(joinProblems([base, next({ arrive: 'wipe' })])).toHaveLength(1);
    expect(joinProblems([base, next({ arrive: 'wipe', era: 'lion', station: 'sphinx' })])).toHaveLength(1);
    expect(joinProblems([base, next({ arrive: 'turn', view: { yaw: 90, pitch: 0, fov: 60 } })])).toEqual([]);
    expect(joinProblems([base, next({ arrive: 'turn', era: 'lion' })])).toHaveLength(1);
  });
  it('catches a repeated id and chapters out of order', () => {
    expect(joinProblems([base, { ...base, arrive: 'turn' }])).toHaveLength(1);
    expect(joinProblems([base, next({ arrive: 'turn', chapter: 0 })])).toHaveLength(1);
  });
});

describe('the panorama a leaf needs', () => {
  it("is the walkthrough's own when the moment is the station's for that era", () => {
    expect(stationMoment(render, 'sphinx-face', 'built')).toBe('equinox-dawn');
    expect(stationMoment(render, 'sphinx-face', 'today')).toBe('sphinx-noon');
    const own = leafPanorama({ station: 'sphinx-face', era: 'built', moment: 'equinox-dawn' }, render);
    expect(own).toBe(walk.stations.find((s) => s.id === 'sphinx-face')?.panoramas.built);
  });
  it('names a new render when it is not', () => {
    expect(leafPanorama({ station: 'sphinx-face', era: 'today', moment: 'equinox-dawn' }, render)).toBe('pano/sphinx-face-today-equinox-dawn.jpg');
    expect(stationMoment(render, 'nowhere', 'today')).toBeNull();
  });
});

describe('draw cues', () => {
  it('reads an overlay with or without the word that cues it', () => {
    expect(drawCue('flank-profile')).toEqual({ overlay: 'flank-profile', word: null });
    expect(drawCue('flank-profile@rolls')).toEqual({ overlay: 'flank-profile', word: 'rolls' });
  });
  it('finds the cued word whatever its case and punctuation', () => {
    const say = 'The profile rolls. Harder beds stand out and softer beds are cut back into deep coves.';
    expect(cueIndex(say, null)).toBe(0);
    expect(cueIndex(say, 'rolls')).toBe(2);
    expect(cueIndex(say, 'coves')).toBe(15);
    expect(cueIndex(say, 'harder')).toBe(3);
    expect(cueIndex(say, 'fissure')).toBe(-1);
  });
  it('refuses a malformed draw entry', () => {
    const raw = JSON.parse(read('apps/exhibit/leaves.json'));
    raw.leaves[0].draw = ['two words'];
    expect(() => readLeaves(raw)).toThrow();
  });
});
