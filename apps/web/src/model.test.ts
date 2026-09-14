import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../../scripts/bundle';
import { SPHINX_MASSING_LABEL, buildModel, massingParams, pyramidParams, type Model, type PyramidParams } from './model';

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

describe('the pyramid as it stands', () => {
  const model = buildModel(bundle, 'canonical', null, null);
  const g1 = model.pyramids.find((p) => p.id === 'g1') as PyramidParams;
  const courses = g1.courses as number[];

  it("carries the Great Pyramid's courses, bottom up, and none for the other two", () => {
    expect(courses).toHaveLength(201);
    // Goyon's thickest course is his first, and it is the one at the bottom.
    expect(courses[0]).toBe(1.5);
    expect(Math.max(...courses)).toBe(courses[0]);
    expect(model.pyramids.find((p) => p.id === 'g2')?.courses).toBeUndefined();
    expect(model.pyramids.find((p) => p.id === 'g3')?.courses).toBeUndefined();
  });

  it('stands within a centimetre of the height the database tabulates on its own', () => {
    // Two sources that were never compared until they were both in here:
    // Goyon's 201 courses add up to 138.745 m and Lehner tabulates the
    // surviving height as 138.75 m, five millimetres apart.
    const top = courses.reduce((sum, h) => sum + h, 0);
    expect(top).toBeCloseTo(138.745, 6);
    expect(Math.abs(top - (g1.heightToday as number))).toBeLessThan(0.01);
  });

  it('is left undefined rather than empty for a preset with no courses at all', () => {
    const bare = pyramidParams({ 'g1.base.side.mean': 230.33, 'g1.height.original': 146.59 }, 'g1');
    expect(bare?.courses).toBeUndefined();
    expect(bare?.heightToday).toBeUndefined();
  });
});

describe('the Sphinx massing placeholder', () => {
  const model = buildModel(bundle, 'canonical', null, null);

  it('is a box of the surveyed size at the derived offsets', () => {
    const sphinx = model.massings.find((m) => m.id === 'sphinx');
    expect(sphinx?.label).toBe(SPHINX_MASSING_LABEL);
    expect(sphinx?.length).toBe(model.env['sphinx.length']);
    expect(sphinx?.width).toBe(model.env['sphinx.width']);
    expect(sphinx?.height).toBe(model.env['sphinx.height']);
    // East and south of the Great Pyramid's base centre, a few hundred metres out.
    expect(sphinx?.offsetEast).toBeCloseTo(model.env['sphinx.centre.offset.east'] as number, 12);
    expect(sphinx?.offsetNorth).toBeCloseTo(model.env['sphinx.centre.offset.north'] as number, 12);
    expect(sphinx?.offsetEast as number).toBeGreaterThan(0);
    expect(sphinx?.offsetNorth as number).toBeLessThan(0);
  });

  it('is left out rather than guessed at when a size or a position is missing', () => {
    const full: Record<string, number> = { 'x.length': 1, 'x.width': 2, 'x.height': 3, 'x.centre.offset.east': 4, 'x.centre.offset.north': 5 };
    expect(massingParams(full, 'x', 'X')).toEqual({ id: 'x', label: 'X', length: 1, width: 2, height: 3, offsetEast: 4, offsetNorth: 5 });
    for (const key of Object.keys(full)) {
      const { [key]: _dropped, ...without } = full;
      expect(massingParams(without, 'x', 'X'), `without ${key}`).toBeUndefined();
    }
  });
});
