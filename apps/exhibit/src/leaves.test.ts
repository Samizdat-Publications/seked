import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isFigure } from './figures';
import { type Leaf, type RenderStations, cueIndex, drawCue, joinProblems, leafPanorama, readLeaves, stationMoment, withStandIns } from './leaves';

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

  it('wipes only between eras taken from the same camera, so the two pictures register', () => {
    // a published station's cameras as publish recorded them; one not rendered yet, where the renderer will put it
    const cams = (station: string, era: string) => {
      const s = walk.stations.find((x) => x.id === station) as unknown as { camera: number[]; cameras?: Record<string, number[]> } | undefined;
      if (s) return (s.cameras?.[era] ?? s.camera).join();
      const r = render.stations.find((x) => x.id === station) as unknown as Record<string, unknown> & { by_state?: Record<string, Record<string, unknown>> };
      const at = { ...r, ...r.by_state?.[era] };
      return ['x', 'y', 'z', 'eye', 'roof'].map((k) => String(at[k])).join();
    };
    const check = (list: readonly Leaf[]) => list.forEach((L, i) => {
      const prev = list[i - 1];
      if (L.arrive === 'wipe' && prev) expect(cams(L.station, L.era), `${L.id}: ${prev.era} to ${L.era}`).toBe(cams(prev.station, prev.era));
    });
    check(leaves);
    check(withStandIns(leaves, (id) => walk.stations.some((s) => s.id === id)));
  });

  it('stands only at stations, in eras and moments the renderer knows', () => {
    const eras = new Set(walk.states.map((s) => s.id));
    for (const L of leaves) {
      expect(render.stations.some((s) => s.id === L.station), L.id).toBe(true);
      expect(eras.has(L.era), L.id).toBe(true);
      expect(Object.keys(render.moments), L.id).toContain(L.moment);
    }
  });

  it('stands in only at stations the walkthrough has, and only for a station it lacks', () => {
    for (const L of leaves) {
      if (!L.until) continue;
      expect(walk.stations.some((s) => s.id === L.until!.station), L.id).toBe(true);
      expect(L.until.station, L.id).not.toBe(L.station);
    }
    // with every stand-in in place the joins still hold, so tonight's player is as clean as tomorrow's
    expect(joinProblems(withStandIns(leaves, (id) => walk.stations.some((s) => s.id === id)))
      .filter((p) => !p.includes('a flight goes somewhere'))).toEqual([]);
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

  it("draws a sky only on leaves the visitor may turn the sky on, in years that are today's or a claim's epoch", () => {
    const epochOk = (ref: string) => ref === 'today' || /^epoch:\s*-?\d+/m.test(read(`data/claims/${ref}.yaml`));
    for (const L of leaves) {
      if (!L.sky) continue;
      expect(L.interact, L.id).toBe('sky');
      expect(epochOk(L.sky.at), `${L.id}: ${L.sky.at}`).toBe(true);
      if (L.sky.from) expect(epochOk(L.sky.from), `${L.id}: ${L.sky.from}`).toBe(true);
    }
  });
});

describe('withStandIns', () => {
  const L = { id: 'ch0-a', chapter: 0, station: 'roof', era: 'today', moment: 'equinox-dawn', view: { yaw: 284, pitch: 1, fov: 40 },
    arrive: 'cut', say: 'Words.', draw: [], hold: 1, interact: 'look', receipts: [], reply: 'ch0',
    until: { station: 'sphinx', view: { yaw: 277, pitch: -4, fov: 62 } } } as Leaf;
  it('puts a leaf at its stand-in while its station is not published, keeping its words, era and moment', () => {
    const [s] = withStandIns([L], () => false);
    expect([s!.station, s!.view, s!.say, s!.era, s!.moment]).toEqual(['sphinx', L.until!.view, 'Words.', 'today', 'equinox-dawn']);
  });
  it('leaves it alone once the station is published', () => {
    expect(withStandIns([L], (id) => id === 'roof')[0]).toBe(L);
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
  it("is the walkthrough's own at any moment for a station rendered at none (inside, by lamps)", () => {
    expect(stationMoment(render, 'kings-chamber', 'built')).toBeNull();
    expect(leafPanorama({ station: 'kings-chamber', era: 'built', moment: 'night-dark' }, render)).toBe('pano/kings-chamber-built.jpg');
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
