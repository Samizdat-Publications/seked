import { describe, expect, it } from 'vitest';
import { WRITES_PER_SECOND, applyShot, newScratch } from './apply';
import type { Shot } from './types';
import { useView, type ViewStore } from '../store';
import { DEFAULT_VIEW, stateById, type CameraView, type LayerId, type Moment, type Section, type SphinxVariant, type StateId, type Vec3, type View } from '../view';

/**
 * A store that records what a shot writes to it and keeps up with itself, so
 * a test can count the writes and so the reads a shot makes (whether a layer
 * is already on, which stop the timeline is at) see what the shot has just
 * done. The actions are the real store's shape; the fields start at the
 * viewer's own defaults.
 */
interface Calls {
  camera: CameraView[];
  moment: Moment[];
  epoch: (number | null)[];
  lst: number[];
  state: StateId[];
  claim: (string | null)[];
  layers: LayerId[];
  sections: Partial<Section>[];
  sphinx: (SphinxVariant | null)[];
  modes: string[];
}

function fakeStore(over: Partial<View> = {}): { store: ViewStore; calls: Calls } {
  const calls: Calls = { camera: [], moment: [], epoch: [], lst: [], state: [], claim: [], layers: [], sections: [], sphinx: [], modes: [] };
  const store: ViewStore = {
    ...useView.getState(),
    ...DEFAULT_VIEW,
    ...over,
    showCamera: (camera) => {
      calls.camera.push(camera);
      store.camera = camera;
    },
    setCamera: (camera) => {
      calls.camera.push(camera);
      store.camera = camera;
    },
    setMoment: (moment) => {
      const next = { ...store.moment, ...moment };
      calls.moment.push(next);
      store.moment = next;
    },
    setEpoch: (epoch) => {
      calls.epoch.push(epoch);
      store.epoch = epoch;
    },
    setLst: (lst) => {
      calls.lst.push(lst);
      store.lst = lst;
    },
    setState: (state) => {
      calls.state.push(state);
      store.state = state;
    },
    setClaim: (claim) => {
      calls.claim.push(claim);
      store.claim = store.claim === claim ? null : claim;
    },
    toggleLayer: (id) => {
      calls.layers.push(id);
      store.layers = { ...store.layers, [id]: !store.layers[id] };
    },
    setSection: (section) => {
      calls.sections.push(section);
      store.section = { ...store.section, ...section };
    },
    setSphinx: (sphinx) => {
      calls.sphinx.push(sphinx);
      store.sphinx = sphinx;
    },
    setMode: (mode) => {
      calls.modes.push(mode);
      store.mode = mode;
    },
  };
  return { store, calls };
}

const stand = (position: Vec3, target: Vec3): CameraView => ({ position, target });

/** A ten second move, the sun sweeping a day as it goes. */
const move: Shot = {
  id: 'move',
  seconds: 10,
  camera: [
    { at: 0, value: stand([1000, 60, 0], [0, 40, 0]) },
    { at: 10, value: stand([-1000, 60, 0], [0, 40, 0]) },
  ],
  moment: [
    { at: 0, value: { day: 79, hour: 6.5 } },
    { at: 10, value: { day: 79, hour: 18.5 } },
  ],
};

/** Ten seconds of frames at sixty a second, the way the wall clock hands them over. */
function play(shot: Shot, store: ViewStore, seconds = 10, fps = 60, options = {}): void {
  const scratch = newScratch();
  for (let i = 0; i < seconds * fps; i++) applyShot(shot, i / fps, store, scratch, options);
}

describe('applyShot', () => {
  it('moves the camera every frame and the sun twelve times a second', () => {
    const { store, calls } = fakeStore();
    play(move, store);
    expect(calls.camera).toHaveLength(600);
    // One at the shot's start and one every twelfth of a second after it,
    // less the few at either end of the smoothstep where the sun has not yet
    // moved the quarter of a minute that is worth a relight.
    expect(calls.moment.length).toBeLessThanOrEqual(10 * WRITES_PER_SECOND + 1);
    expect(calls.moment.length).toBeGreaterThan(10 * WRITES_PER_SECOND * 0.8);
    // And it is the sun the shot asked for, from dawn to dusk in order.
    const hours = calls.moment.map((m) => m.hour);
    expect(hours[0]).toBeCloseTo(6.5, 6);
    expect(hours[hours.length - 1]).toBeGreaterThan(18);
    for (let i = 1; i < hours.length; i++) expect(hours[i]).toBeGreaterThan(hours[i - 1] as number);
  });

  it("does the shot's one-time settings once, at its start", () => {
    const shot: Shot = {
      ...move,
      claim: 'C2',
      layers: { sky: true, grid: false },
      section: { on: true, axis: 'ns', at: 7.29 },
      sphinx: 'lion',
    };
    const { store, calls } = fakeStore();
    play(shot, store);
    expect(calls.claim).toEqual(['C2']);
    // The grid is on by default and the sky is off, so both are toggled, once.
    expect(calls.layers.sort()).toEqual(['grid', 'sky']);
    expect(calls.sections).toHaveLength(1);
    expect(store.section.on).toBe(true);
    expect(calls.sphinx).toEqual(['lion']);
    expect(calls.modes).toEqual(['orbit']);
  });

  it('changes the timeline at the second the shot names, once, and says so first', () => {
    const shot: Shot = { ...move, state: { to: 'ancient', at: 3, dissolveSeconds: 2.5 } };
    const { store, calls } = fakeStore();
    const announced: number[] = [];
    play(shot, store, 10, 60, { onStateChange: (s: Shot) => announced.push(s.state?.dissolveSeconds ?? 0) });
    expect(calls.state).toEqual(['ancient']);
    expect(announced).toEqual([2.5]);
    expect(store.state).toBe('ancient');
  });

  it("sets a state due at the shot's start as part of the start", () => {
    const shot: Shot = { ...move, state: { to: 'built', at: 0 } };
    const { store, calls } = fakeStore();
    const scratch = newScratch();
    applyShot(shot, 0, store, scratch);
    expect(calls.state).toEqual(['built']);
  });

  it("rolls the epoch and hands it back when it lands on the stop's own", () => {
    const built = stateById('built').epoch;
    const shot: Shot = {
      ...move,
      epoch: [
        { at: 0, value: 2026 },
        { at: 5, value: built, ease: 'linear' },
      ],
    };
    const { store, calls } = fakeStore({ state: 'built' });
    play(shot, store);
    expect(calls.epoch[0]).toBe(2026);
    // Twelve a second over five seconds of rolling, and then one hand-back.
    expect(calls.epoch.length).toBeLessThanOrEqual(5 * WRITES_PER_SECOND + 3);
    expect(calls.epoch.filter((e) => e === null)).toHaveLength(1);
    expect(calls.epoch[calls.epoch.length - 1]).toBe(null);
    expect(store.epoch).toBe(null);
  });

  it('keeps the epoch when the keys do not end where the timeline would', () => {
    const shot: Shot = {
      ...move,
      epoch: [
        { at: 0, value: 2026 },
        { at: 5, value: -10499 },
      ],
    };
    const { store, calls } = fakeStore({ state: 'built' });
    play(shot, store);
    expect(calls.epoch).not.toContain(null);
    expect(store.epoch).toBe(-10499);
  });

  it('holds a named star on the meridian at the epoch the shot has rolled to', () => {
    const asked: number[] = [];
    // Alnitak's right ascension of date, faked: the real one comes from the
    // bundle and moves with the epoch, which is the point of the lookup.
    const meridianLst = (id: string, epoch: number): number | undefined => {
      asked.push(epoch);
      return id === 'alnitak' ? 30 + (epoch + 2449) / 1000 : undefined;
    };
    const shot: Shot = {
      ...move,
      lst: { meridian: 'alnitak' },
      epoch: [
        { at: 0, value: -2449 },
        { at: 10, value: -10499, ease: 'linear' },
      ],
    };
    const { store, calls } = fakeStore({ state: 'built' });
    play(shot, store, 10, 60, { meridianLst });
    expect(asked[0]).toBe(-2449);
    expect(calls.lst.length).toBeGreaterThan(0);
    expect(calls.lst[0]).toBeCloseTo(30, 6);
    // The star's place follows the epoch down and is never asked for an epoch
    // the shot has not written.
    expect(Math.min(...asked)).toBeGreaterThanOrEqual(-10499);
    expect(store.lst).toBeLessThan(30);
  });

  it('starts a shot part way through, which is what a seek does', () => {
    const { store, calls } = fakeStore();
    const scratch = newScratch();
    applyShot(move, 5, store, scratch);
    // The sun at five seconds of a dawn to dusk sweep, not the sun at its
    // first key.
    expect(calls.moment[0]?.hour).toBeCloseTo(12.5, 6);
    expect(calls.camera[0]?.position[0]).toBeCloseTo(0, 6);
  });
});
