import { describe, expect, it, vi } from 'vitest';
import { measureCost, type Steppable } from './frames';

/**
 * `measureCost` is a pure function of something that can be stepped, which is
 * the whole reason it takes a `Steppable` rather than an R3F root: a GPU is
 * not needed to say what the measure does, only something that takes a known
 * time to draw.
 */
function fake(msPerFrame: number, options: { jankOnRun?: number; jankMs?: number } = {}): Steppable & { drawn: number; synced: number } {
  let now = 0;
  const spy = vi.spyOn(performance, 'now').mockImplementation(() => now);
  const self = {
    drawn: 0,
    synced: 0,
    advance: () => {
      self.drawn++;
      now += msPerFrame;
    },
    finish: () => {
      self.synced++;
      if (options.jankOnRun !== undefined && self.synced === options.jankOnRun) now += options.jankMs ?? 0;
      return true;
    },
  };
  void spy;
  return self;
}

describe('what a frame costs to draw', () => {
  it('times the drawing and divides by the frames', () => {
    const root = fake(4);
    const cost = measureCost(root, 50, 3);
    expect(cost.ms).toBeCloseTo(4, 2);
    expect(cost.frames).toBe(50);
    expect(cost.runs).toHaveLength(3);
    vi.restoreAllMocks();
  });

  it('warms up before it starts counting, and does not count the warm-up', () => {
    const root = fake(4);
    measureCost(root, 50, 3);
    // Ten warm-up frames plus three runs of fifty.
    expect(root.drawn).toBe(10 + 150);
    // One sync after the warm-up and one after each run.
    expect(root.synced).toBe(4);
    vi.restoreAllMocks();
  });

  it('gives the median, so one run losing time to a collection is not the answer', () => {
    // The second run is hit by 200 ms of something that is not drawing.
    const root = fake(4, { jankOnRun: 3, jankMs: 200 });
    const cost = measureCost(root, 50, 3);
    expect(cost.ms).toBeCloseTo(4, 2);
    // The spread is kept rather than averaged away, so the jank is visible.
    expect(Math.max(...cost.runs)).toBeGreaterThan(cost.ms);
    vi.restoreAllMocks();
  });

  it('has no ceiling, which is the whole point of it', () => {
    // A scene drawing in a quarter of a millisecond: a frame counter on a
    // 240 Hz screen would call this 240 and call a scene forty times slower
    // 240 as well.
    const fast = measureCost(fake(0.25), 100, 3);
    vi.restoreAllMocks();
    const slow = measureCost(fake(10), 100, 3);
    vi.restoreAllMocks();
    expect(fast.ms).toBeLessThan(slow.ms);
    expect(slow.ms / fast.ms).toBeCloseTo(40, 0);
  });

  it('says whether the sync point was real, because a timer without one stops early', () => {
    expect(measureCost(fake(4), 10, 1).synced).toBe(true);
    vi.restoreAllMocks();
    const unsynced: Steppable = { advance: () => {}, finish: () => false };
    expect(measureCost(unsynced, 10, 1).synced).toBe(false);
  });
});
