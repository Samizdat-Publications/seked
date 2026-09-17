import { pyramidMesh } from '@seked/geometry';
import { describe, expect, it } from 'vitest';
import { pyramidPart } from './geometry';

/**
 * Invented numbers, not measurements: a pyramid of a round base and a round
 * height, so what the cut leaves can be worked out by hand. What has to hold
 * is that the part above a level stands on the same faces as the whole
 * pyramid, because a cap of casing drawn a hand's breadth outside the core it
 * caps would be a lie about the one thing this cut is for.
 */
const WHOLE = { base: 200, height: 100 };

/** The extent of a mesh along one axis. */
function span(positions: Float32Array, axis: number): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = axis; i < positions.length; i += 3) {
    lo = Math.min(lo, positions[i] as number);
    hi = Math.max(hi, positions[i] as number);
  }
  return [lo, hi];
}

describe('pyramidPart', () => {
  it('leaves the pyramid whole when no level is asked for', () => {
    expect(pyramidPart(WHOLE).positions).toEqual(pyramidMesh(WHOLE).positions);
  });

  it('cuts the bottom off and keeps the faces where they were', () => {
    const part = pyramidPart({ ...WHOLE, fromHeight: 60 });
    expect(span(part.positions, 2)).toEqual([60, 100]);
    // At 60 m up a pyramid 100 m high on a 200 m base is 80 m across, so the
    // cut ring is at 40 m from the axis and the part still points at the same
    // apex.
    expect(span(part.positions, 0)).toEqual([-40, 40]);
    expect(span(part.positions, 1)).toEqual([-40, 40]);
  });

  it('keeps a truncated top truncated', () => {
    const part = pyramidPart({ ...WHOLE, fromHeight: 60, truncateAt: 90 });
    expect(span(part.positions, 2)).toEqual([60, 90]);
    expect(span(part.positions, 0)).toEqual([-40, 40]);
  });

  it('shrinks the concavity with the base, so the hollowing stays the same face', () => {
    const part = pyramidPart({ ...WHOLE, fromHeight: 50, concavity: 4 });
    // Half the way up, the base ring is half as wide and its indent half as
    // deep: the mid-face point is at 50 less 2 rather than at 50 less 4.
    const east = Math.max(...[...part.positions].filter((_, i) => i % 3 === 0));
    expect(east).toBeCloseTo(50, 5);
    let midFace = Infinity;
    for (let i = 0; i < part.positions.length; i += 3) {
      if (Math.abs((part.positions[i + 2] as number) - 50) > 1e-6) continue;
      if (Math.abs(part.positions[i + 1] as number) > 1e-6) continue;
      // The ring's centre is on that line too, and it is not a face point.
      if (Math.abs(part.positions[i] as number) < 1e-6) continue;
      midFace = Math.min(midFace, Math.abs(part.positions[i] as number));
    }
    expect(midFace).toBeCloseTo(48, 5);
  });

  it('ignores a level that is not inside the pyramid', () => {
    for (const fromHeight of [0, -10, 100, 140]) {
      expect(pyramidPart({ ...WHOLE, fromHeight }).positions).toEqual(pyramidMesh(WHOLE).positions);
    }
  });
});
