import { describe, expect, it } from 'vitest';
import { fadeAlpha, type Transition } from './fade';

const at = (t: number, to: Transition['to'] = 'built', from: Transition['from'] = 'today'): Transition => ({ from, to, t });

describe('fadeAlpha', () => {
  it('leaves everything alone when nothing is dissolving', () => {
    expect(fadeAlpha('built', at(1, 'built', null), true)).toBe(1);
    expect(fadeAlpha(undefined, at(1, 'built', null), false)).toBe(1);
  });

  it('brings the stop being arrived at up and takes the one being left out', () => {
    expect(fadeAlpha('built', at(0.25), true)).toBeCloseTo(0.25);
    expect(fadeAlpha('today', at(0.25), true)).toBeCloseTo(0.75);
    expect(fadeAlpha('built', at(0.75), true)).toBeCloseTo(0.75);
    expect(fadeAlpha('today', at(0.75), true)).toBeCloseTo(0.25);
  });

  it('holds a stop the dissolve is neither leaving nor arriving at out of the way', () => {
    // Something left over from a third state is on its way out like the rest.
    expect(fadeAlpha('ancient', at(0.4), true)).toBeCloseTo(0.6);
  });

  it('leaves the fixtures of every state alone while the states dissolve', () => {
    expect(fadeAlpha(undefined, at(0.1), true)).toBe(1);
    expect(fadeAlpha(undefined, at(0.9), true)).toBe(1);
  });

  it('dips the whole scope out and back when nothing says which stop it belongs to', () => {
    expect(fadeAlpha(undefined, at(0), false)).toBeCloseTo(1);
    expect(fadeAlpha(undefined, at(0.25), false)).toBeCloseTo(0.5);
    expect(fadeAlpha(undefined, at(0.5), false)).toBeCloseTo(0);
    expect(fadeAlpha(undefined, at(0.75), false)).toBeCloseTo(0.5);
    expect(fadeAlpha(undefined, at(0.999), false)).toBeCloseTo(0.998);
  });

  it('is back at one on both paths the instant the dissolve ends', () => {
    // The rule that keeps a material from being left stippled: at t = 1 every
    // answer is 1, whether the scope is tagged or not and whatever the stop.
    for (const tagged of [true, false]) {
      for (const stop of ['built', 'today', 'ancient', undefined]) {
        expect(fadeAlpha(stop, at(1, 'built', null), tagged)).toBe(1);
      }
    }
  });
});
