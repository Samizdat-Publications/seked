import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../../scripts/bundle';
import { buildModel, type Model } from './model';

/**
 * The epoch override is the cubit slider's move applied to time, and the
 * point of the whole sky control: a dated claim evaluated at the year the
 * reader is looking at rather than at the one its author picked. These pin
 * both halves of that, the moving and the not moving.
 */
const bundle = buildBundle();

const thubanShaft = (model: Model) =>
  model.results.get('C2')?.comparisons.find((c) => c.label.includes('Thuban')) as { targetValue: number; absolute: number };

describe('the epoch override', () => {
  it("moves C2's residuals, which is what dragging the sky is for", () => {
    const stated = thubanShaft(buildModel(bundle, 'canonical', null, null));
    const earlier = thubanShaft(buildModel(bundle, 'canonical', null, -2999));
    expect(stated.targetValue).not.toBeCloseTo(earlier.targetValue, 3);
    // Thuban climbed towards the pole through the third millennium, so five
    // and a half centuries earlier it crossed the meridian lower down and the
    // King's Chamber north shaft misses it by more.
    expect(earlier.targetValue).toBeLessThan(stated.targetValue);
    expect(Math.abs(earlier.absolute)).toBeGreaterThan(Math.abs(stated.absolute));
  });

  it('leaves a claim with no epoch of its own exactly where it was', () => {
    const own = buildModel(bundle, 'canonical', null, null);
    const dragged = buildModel(bundle, 'canonical', null, -10449);
    for (const id of ['A1', 'A3', 'B1']) {
      expect(dragged.results.get(id), id).toEqual(own.results.get(id));
    }
  });

  it('records which epoch it used, so the panel can say so', () => {
    expect(buildModel(bundle, 'canonical', null, null).epochOverride).toBeNull();
    expect(buildModel(bundle, 'canonical', null, -9000).epochOverride).toBe(-9000);
  });
});
