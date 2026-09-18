import { describe, expect, it } from 'vitest';
import { ease, lerpAngleDeg, lerpCameraView, lerpMoment, lerpNumber, sample } from './ease';
import type { Key } from './types';
import type { Moment } from '../view';

/**
 * What has to hold about the tweens is that a key list says nothing about the
 * time outside it, that the shaped moves are symmetrical about their middle,
 * and that neither of the two circles in the scene, the clock and the sky,
 * ever goes the long way round when it should not.
 */
describe('ease', () => {
  it('starts at nothing and ends at everything, whichever shape it is', () => {
    for (const kind of ['linear', 'in', 'out', 'inOut'] as const) {
      expect(ease(kind, 0)).toBeCloseTo(0, 12);
      expect(ease(kind, 1)).toBeCloseTo(1, 12);
    }
  });

  it('is halfway through at halfway, and rests at the ends it should rest at', () => {
    expect(ease('inOut', 0.5)).toBeCloseTo(0.5, 12);
    // The smoothstep's halves: `in` is still at the start, `out` at the end,
    // so a shot can leave a stand and arrive at one without a stall between.
    const tiny = 1e-4;
    expect(ease('in', tiny) / tiny).toBeLessThan(0.01);
    expect((1 - ease('out', 1 - tiny)) / tiny).toBeLessThan(0.01);
    expect(ease('in', 1 - tiny)).toBeLessThan(1);
    expect(ease('out', tiny)).toBeGreaterThan(tiny);
  });

  it('clamps outside the move rather than running away', () => {
    expect(ease('inOut', -3)).toBe(0);
    expect(ease('inOut', 4)).toBe(1);
  });
});

describe('sample', () => {
  const keys: Key<number>[] = [
    { at: 2, value: 10 },
    { at: 6, value: 30 },
  ];

  it('holds the first value before the first key and the last after the last', () => {
    expect(sample(keys, 0, lerpNumber)).toBe(10);
    expect(sample(keys, 2, lerpNumber)).toBe(10);
    expect(sample(keys, 6, lerpNumber)).toBe(30);
    expect(sample(keys, 99, lerpNumber)).toBe(30);
  });

  it("eases between two keys with the later key's ease, smoothstep by default", () => {
    expect(sample(keys, 4, lerpNumber)).toBeCloseTo(20, 12);
    const linear: Key<number>[] = [
      { at: 0, value: 0 },
      { at: 4, value: 100 },
    ];
    expect(sample(linear, 1, lerpNumber)).toBeCloseTo(ease('inOut', 0.25) * 100, 12);
    const stated: Key<number>[] = [
      { at: 0, value: 0 },
      { at: 4, value: 100, ease: 'linear' },
    ];
    expect(sample(stated, 1, lerpNumber)).toBeCloseTo(25, 12);
  });

  it('walks past the keys it has gone by', () => {
    const three: Key<number>[] = [
      { at: 0, value: 0 },
      { at: 1, value: 10 },
      { at: 2, value: 20, ease: 'linear' },
    ];
    expect(sample(three, 1.5, lerpNumber)).toBeCloseTo(15, 12);
  });

  it('refuses a key list with nothing in it', () => {
    expect(() => sample([], 0, lerpNumber)).toThrow();
  });
});

describe('the lerps', () => {
  it('takes sidereal time the short way, through zero and not through the far side', () => {
    const seen = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1].map((u) => lerpAngleDeg(350, 10, u));
    // Twenty degrees of sky: every sample is within twenty degrees of zero,
    // which is only true of the way round that passes through it.
    for (const deg of seen) expect(Math.min(deg, 360 - deg)).toBeLessThanOrEqual(20.000001);
    expect(lerpAngleDeg(350, 10, 0.5)).toBeCloseTo(0, 9);
    // And back the other way, which is the same twenty degrees.
    expect(lerpAngleDeg(10, 350, 0.5)).toBeCloseTo(0, 9);
    // A half turn has no short way; whichever side it takes it is a quarter
    // of the way round at the halfway point, and not standing still.
    expect([90, 270]).toContain(Math.round(lerpAngleDeg(0, 180, 0.5)));
  });

  it('sweeps a day the long way round the clock when the day stands still', () => {
    const dawn: Moment = { day: 79, hour: 6.5 };
    const dusk: Moment = { day: 79, hour: 18.5 };
    expect(lerpMoment(dawn, dusk, 0.5).hour).toBeCloseTo(12.5, 9);
    expect(lerpMoment(dawn, dusk, 0.25).hour).toBeCloseTo(9.5, 9);
  });

  it('crosses midnight only when the day crosses with it', () => {
    const late: Moment = { day: 79, hour: 23 };
    const early: Moment = { day: 80, hour: 1 };
    const half = lerpMoment(late, early, 0.5);
    expect(half.hour).toBeCloseTo(0, 9);
    expect(half.day).toBeCloseTo(79.5, 9);
  });

  it('moves a camera position and its target on their own lines', () => {
    const a = { position: [0, 0, 0] as [number, number, number], target: [10, 0, 0] as [number, number, number] };
    const b = { position: [100, 50, 0] as [number, number, number], target: [10, 0, 100] as [number, number, number] };
    const half = lerpCameraView(a, b, 0.5);
    expect(half.position).toEqual([50, 25, 0]);
    expect(half.target).toEqual([10, 0, 50]);
  });
});
