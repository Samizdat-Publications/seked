/**
 * The hero looks are a table of numbers copied out of `blender/render.py` by
 * hand, which is exactly the kind of thing that goes wrong quietly: a camera
 * inside a pyramid, a target equal to its own position, a moment at hour 25.
 * These check the shape of them rather than the taste.
 */
import { describe, expect, it } from 'vitest';
import { LOOKS, lookById, toWorld, type LookId } from './looks';
import { DAY_MAX, DAY_MIN, HOUR_MAX, HOUR_MIN, MOMENTS } from './view';

describe('LOOKS', () => {
  it('names each look once', () => {
    const ids = LOOKS.map((look) => look.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(lookById(id)?.id).toBe(id);
  });

  it('gives every look a finite camera that is looking at something else', () => {
    for (const look of LOOKS) {
      for (const n of [...look.camera.position, ...look.camera.target]) {
        expect(Number.isFinite(n), look.id).toBe(true);
        // The plateau is a few kilometres across and the far plane is at 40 km.
        expect(Math.abs(n), look.id).toBeLessThan(40000);
      }
      const gap = Math.hypot(
        look.camera.position[0] - look.camera.target[0],
        look.camera.position[1] - look.camera.target[1],
        look.camera.position[2] - look.camera.target[2],
      );
      expect(gap, look.id).toBeGreaterThan(1);
    }
  });

  it('gives every look a moment in range, and one of the named ones', () => {
    for (const look of LOOKS) {
      expect(look.moment.day, look.id).toBeGreaterThanOrEqual(DAY_MIN);
      expect(look.moment.day, look.id).toBeLessThanOrEqual(DAY_MAX);
      expect(look.moment.hour, look.id).toBeGreaterThanOrEqual(HOUR_MIN);
      expect(look.moment.hour, look.id).toBeLessThanOrEqual(HOUR_MAX);
      expect(MOMENTS.some((m) => m.moment === look.moment), look.id).toBe(true);
    }
  });

  it('keeps every camera above the plateau rather than under it', () => {
    // The Great Pyramid's base is z = 0 and the Sphinx's floor is about 40 m
    // below it, so nothing this side of the enclosure sits under -45 m.
    for (const look of LOOKS) expect(look.camera.position[1], look.id).toBeGreaterThan(-45);
  });

  it('turns the project frame into three\'s world frame', () => {
    // East stays east, up becomes three's +Y, and north becomes -Z. The sums
    // are exact, so each axis is checked component by component rather than
    // against an array, which would trip over negative zero.
    const close = (got: readonly number[], want: readonly number[]): void => {
      got.forEach((n, i) => expect(n).toBeCloseTo(want[i] as number, 12));
    };
    close(toWorld([1, 0, 0]), [1, 0, 0]);
    close(toWorld([0, 1, 0]), [0, 0, -1]);
    close(toWorld([0, 0, 1]), [0, 1, 0]);
  });

  it('carries the five stands the renders proved', () => {
    const want: LookId[] = ['dawn', 'panorama', 'harbour', 'akhet', 'night'];
    expect(LOOKS.map((look) => look.id)).toEqual(want);
  });
});
