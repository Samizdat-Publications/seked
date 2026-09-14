import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW, SECTION_MAX, SECTION_MIN, SPEED_MAX, decodeView, encodeView, type View } from './view';

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

  it('clamps a cut and a speed from outside their ranges', () => {
    expect(decodeView('?cut=ns,99999,0', PRESETS).section.at).toBe(SECTION_MAX);
    expect(decodeView('?cut=ns,-99999,0', PRESETS).section.at).toBe(SECTION_MIN);
    expect(decodeView('?speed=99999', PRESETS).speed).toBe(SPEED_MAX);
  });

  it('keeps the new layers in the layer list', () => {
    const off = view({ layers: { ...DEFAULT_VIEW.layers, interior: false, ground: false, terrain: true } });
    const decoded = decodeView(encodeView(off), PRESETS);
    expect(decoded.layers.interior).toBe(false);
    expect(decoded.layers.ground).toBe(false);
    expect(decoded.layers.terrain).toBe(true);
  });
});
