import { describe, expect, it } from 'vitest';
import { TOUR } from './tour';
import {
  DEFAULT_EPOCH,
  DEFAULT_VIEW,
  EPOCH_MAX,
  EPOCH_MIN,
  SECTION_MAX,
  SECTION_MIN,
  SPEED_MAX,
  decodeView,
  encodeView,
  sceneEpoch,
  type View,
} from './view';

/**
 * A URL is the whole view, so every field a reader can change has to survive
 * the round trip and a hand-edited query string has to fall back field by
 * field rather than throwing the rest of the view away.
 */
const PRESETS = ['canonical', 'petrie'];

const view = (patch: Partial<View>): View => ({ ...DEFAULT_VIEW, ...patch });

describe('encodeView and decodeView', () => {
  it('round-trips the default view', () => {
    expect(decodeView(encodeView(DEFAULT_VIEW), PRESETS)).toEqual(DEFAULT_VIEW);
  });

  it('round-trips the timeline stop and the moment', () => {
    const wanted = view({ state: 'ancient', moment: { day: 79, hour: 7.25 } });
    expect(decodeView(encodeView(wanted), PRESETS)).toEqual(wanted);
    expect(encodeView(wanted)).toContain('state=ancient');
    expect(encodeView(wanted)).toContain('moment=79%2C7.25');
  });

  it('round-trips a claimed Sphinx and leaves it out when it is the state\'s own', () => {
    const wanted = view({ sphinx: 'anubis' });
    expect(decodeView(encodeView(wanted), PRESETS)).toEqual(wanted);
    expect(encodeView(DEFAULT_VIEW)).not.toContain('sphinx=');
    expect(decodeView('?sphinx=griffin', PRESETS).sphinx).toBeNull();
  });

  it('falls back to today and the default moment on nonsense', () => {
    const decoded = decodeView('?state=atlantis&moment=x,y', PRESETS);
    expect(decoded.state).toBe('today');
    expect(decoded.moment).toEqual(DEFAULT_VIEW.moment);
    expect(decodeView('?moment=400,30', PRESETS).moment).toEqual({ day: 366, hour: 24 });
    expect(decodeView('?moment=0,-3', PRESETS).moment).toEqual({ day: 1, hour: 0 });
  });

  it('round-trips a section, a camera mode and a speed', () => {
    const wanted = view({
      mode: 'fly',
      speed: 120,
      section: { on: true, axis: 'ns', at: 7.3, ground: true },
    });
    expect(decodeView(encodeView(wanted), PRESETS)).toEqual(wanted);
  });

  it('round-trips the east-west plane', () => {
    const wanted = view({ section: { on: true, axis: 'ew', at: -212.5, ground: false } });
    expect(decodeView(encodeView(wanted), PRESETS)).toEqual(wanted);
  });

  it('writes the cut as off rather than leaving it out', () => {
    expect(encodeView(DEFAULT_VIEW)).toContain('cut=off');
    expect(decodeView('?cut=off', PRESETS).section).toEqual(DEFAULT_VIEW.section);
  });

  it('falls back on nonsense without losing the rest of the view', () => {
    const decoded = decodeView('?preset=canonical&mode=teleport&speed=banana&cut=sideways,4,1', PRESETS);
    expect(decoded.mode).toBe(DEFAULT_VIEW.mode);
    expect(decoded.speed).toBe(DEFAULT_VIEW.speed);
    expect(decoded.section).toEqual(DEFAULT_VIEW.section);
    expect(decoded.preset).toBe('canonical');
  });

  // A missing key is not a slow camera: `Number(null)` is a finite zero, and
  // a zero speed would clamp to the bottom of the range and stay there.
  it('leaves the speed at its default when the query names no speed', () => {
    expect(decodeView('?preset=canonical', PRESETS).speed).toBe(DEFAULT_VIEW.speed);
  });

  it('clamps a cut and a speed from outside their ranges', () => {
    expect(decodeView('?cut=ns,99999,0', PRESETS).section.at).toBe(SECTION_MAX);
    expect(decodeView('?cut=ns,-99999,0', PRESETS).section.at).toBe(SECTION_MIN);
    expect(decodeView('?speed=99999', PRESETS).speed).toBe(SPEED_MAX);
  });

  it('round-trips an epoch and a sidereal time', () => {
    const wanted = view({ epoch: -10449, lst: 214.25, layers: { ...DEFAULT_VIEW.layers, sky: true } });
    const decoded = decodeView(encodeView(wanted), PRESETS);
    expect(decoded).toEqual(wanted);
    expect(encodeView(wanted)).toContain('epoch=-10449');
    expect(encodeView(wanted)).toContain('lst=214.25');
  });

  it('leaves the epoch out when no epoch is overridden', () => {
    expect(encodeView(DEFAULT_VIEW)).not.toContain('epoch=');
    expect(decodeView('?lst=0', PRESETS).epoch).toBeNull();
  });

  it('clamps an epoch and wraps a sidereal time', () => {
    expect(decodeView('?epoch=-99999', PRESETS).epoch).toBe(EPOCH_MIN);
    expect(decodeView('?epoch=99999', PRESETS).epoch).toBe(EPOCH_MAX);
    expect(decodeView('?lst=370', PRESETS).lst).toBe(10);
    expect(decodeView('?lst=-90', PRESETS).lst).toBe(270);
    expect(decodeView('?epoch=nonsense&lst=nonsense', PRESETS).epoch).toBeNull();
    expect(decodeView('?epoch=nonsense&lst=nonsense', PRESETS).lst).toBe(DEFAULT_VIEW.lst);
  });

  it('keeps the new layers in the layer list', () => {
    const off = view({ layers: { ...DEFAULT_VIEW.layers, interior: false, ground: false, terrain: true } });
    const decoded = decodeView(encodeView(off), PRESETS);
    expect(decoded.layers.interior).toBe(false);
    expect(decoded.layers.ground).toBe(false);
    expect(decoded.layers.terrain).toBe(true);
  });

  it('round-trips a tour step', () => {
    const wanted = view({ tour: 5 });
    expect(decodeView(encodeView(wanted), PRESETS)).toEqual(wanted);
    expect(encodeView(wanted)).toContain('tour=5');
  });

  it('leaves the tour out when no tour is running, and refuses an index with no step', () => {
    expect(encodeView(DEFAULT_VIEW)).not.toContain('tour=');
    expect(decodeView('?lst=0', PRESETS).tour).toBeNull();
    expect(decodeView('?tour=banana', PRESETS).tour).toBeNull();
    expect(decodeView('?tour=1.5', PRESETS).tour).toBeNull();
    expect(decodeView('?tour=-1', PRESETS).tour).toBeNull();
    expect(decodeView(`?tour=${TOUR.length}`, PRESETS).tour).toBeNull();
  });

  it("takes the step's camera only when the URL carries none of its own", () => {
    const step = TOUR[7] as (typeof TOUR)[number];
    expect(decodeView('?tour=7', PRESETS).camera).toEqual(step.camera);
    expect(decodeView('?tour=7&cam=1,2,3,4,5,6', PRESETS).camera).toEqual({ position: [1, 2, 3], target: [4, 5, 6] });
    expect(decodeView('?cam=1,2,3,4,5,6', PRESETS).tour).toBeNull();
  });

  it('carries the sky layer', () => {
    const on = view({ layers: { ...DEFAULT_VIEW.layers, sky: true } });
    expect(encodeView(on)).toContain('sky');
    expect(decodeView(encodeView(on), PRESETS).layers.sky).toBe(true);
    expect(decodeView(encodeView(DEFAULT_VIEW), PRESETS).layers.sky).toBe(false);
  });
});

describe('sceneEpoch', () => {
  it('prefers the override, then the claim, then the default', () => {
    expect(sceneEpoch(-9000, -2449)).toBe(-9000);
    expect(sceneEpoch(null, -2449)).toBe(-2449);
    expect(sceneEpoch(null, undefined)).toBe(DEFAULT_EPOCH);
    expect(sceneEpoch(null, undefined, 2026)).toBe(2026);
    expect(sceneEpoch(null, -2449, 2026)).toBe(-2449);
  });
});
