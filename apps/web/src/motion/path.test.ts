import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../../../scripts/bundle';
import { buildModel } from '../model';
import { ARC_DISTANCE_M, MIN_CAMERA_Y, arcPosition, cameraAt, liftOf } from './path';
import type { CameraKey } from './types';
import type { Vec3 } from '../view';

/**
 * The arc exists for one reason: a move across the plateau must go over the
 * pyramids and not through them. So the test asks the database how tall the
 * Great Pyramid is rather than being told, and a crossing at its own height
 * has to clear it.
 */
const bundle = buildBundle();
const model = buildModel(bundle, 'canonical', null, null);
const g1 = model.pyramids.find((p) => p.id === 'g1');
if (!g1) throw new Error('the bundle has no G1 in it');

const stand = (position: Vec3, target: Vec3) => ({ position, target });

describe('cameraAt', () => {
  it('returns a stand exactly, however long the shot runs', () => {
    const only: CameraKey[] = [{ at: 0, value: stand([10, 40, -20], [0, 5, 0]) }];
    expect(cameraAt(only, 0)).toEqual(only[0]?.value);
    expect(cameraAt(only, 12.5)).toEqual(only[0]?.value);
    // A stand below the floor is a stand the shot asked for, and is kept.
    const low: CameraKey[] = [{ at: 0, value: stand([0, 1, 0], [0, 0, -50]) }];
    expect(cameraAt(low, 3).position[1]).toBe(1);
  });

  it('arrives at its keys and holds them at either end of the shot', () => {
    const keys: CameraKey[] = [
      { at: 2, value: stand([1000, 40, 0], [0, 60, 0]) },
      { at: 8, value: stand([-1000, 40, 0], [0, 60, 0]) },
    ];
    expect(cameraAt(keys, 0)).toEqual(keys[0]?.value);
    expect(cameraAt(keys, 2)).toEqual(keys[0]?.value);
    expect(cameraAt(keys, 8)).toEqual(keys[1]?.value);
    expect(cameraAt(keys, 99)).toEqual(keys[1]?.value);
  });

  it('goes over the Great Pyramid rather than through it', () => {
    // Two kilometres of plateau at the height of a low stand, crossed over
    // the origin, which is the Great Pyramid's own base centre.
    const keys: CameraKey[] = [
      { at: 0, value: stand([1000, 40, 0], [0, 60, 0]) },
      { at: 10, value: stand([-1000, 40, 0], [0, 60, 0]) },
    ];
    const half = cameraAt(keys, 5);
    expect(half.position[1]).toBeGreaterThan(g1.height);
    // And it is an arc: every sample in between is above the straight line
    // the two stands share, and the highest of them is at the middle.
    const heights = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => cameraAt(keys, s).position[1]);
    for (const y of heights) expect(y).toBeGreaterThan(40);
    expect(Math.max(...heights)).toBeCloseTo(half.position[1], 9);
  });

  it('keeps the target on its own straight line while the camera swings', () => {
    const keys: CameraKey[] = [
      { at: 0, value: stand([500, 50, 0], [0, 0, 0]) },
      { at: 10, value: stand([-500, 50, 0], [0, 0, 200]) },
    ];
    // Halfway through a smoothstep is halfway along the line.
    expect(cameraAt(keys, 5).target).toEqual([0, 0, 100]);
  });

  it('never takes the path below the floor between two stands above it', () => {
    // Two stands on the plateau either side of the harbour, which is cut well
    // below the datum: the arc must not follow the ground down.
    const keys: CameraKey[] = [
      { at: 0, value: stand([600, 45, -300], [0, 0, 0]) },
      { at: 6, value: stand([300, 8, 500], [0, 0, 0]) },
    ];
    for (let s = 0; s <= 6; s += 0.25) expect(cameraAt(keys, s).position[1]).toBeGreaterThanOrEqual(MIN_CAMERA_Y);
  });
});

describe('the lift', () => {
  it('arcs a crossing and leaves a small adjustment flat', () => {
    const near: Vec3 = [0, 30, 0];
    const short: Vec3 = [ARC_DISTANCE_M - 1, 30, 0];
    const far: Vec3 = [ARC_DISTANCE_M + 1000, 30, 0];
    const key: CameraKey = { at: 1, value: stand(far, [0, 0, 0]) };
    expect(liftOf(key, near, short)).toBe(0);
    expect(liftOf(key, near, far)).toBeGreaterThan(0);
    // What the shot asks for wins over both.
    expect(liftOf({ ...key, lift: 0 }, near, far)).toBe(0);
    expect(liftOf({ ...key, lift: 0.6 }, near, short)).toBe(0.6);
  });

  it('lifts the middle of the arc by half of what it lifts the control point', () => {
    const from: Vec3 = [0, 0, 0];
    const to: Vec3 = [1000, 0, 0];
    // A quadratic Bezier is a quarter, a half and a quarter of its three
    // points at the halfway mark, so the rise there is half the control's.
    expect(arcPosition(from, to, 0.2, 0.5)[1]).toBeCloseTo(0.5 * 0.2 * 1000, 9);
    // With no lift the path is the straight line, and two stands on the datum
    // are the floor themselves, so it is not pushed up off them.
    expect(arcPosition(from, to, 0, 0.5)[1]).toBeCloseTo(0, 9);
    // Two stands above the floor, and a dip between them that it holds out of.
    expect(arcPosition([0, 40, 0], [1000, 40, 0], -0.5, 0.5)[1]).toBeCloseTo(MIN_CAMERA_Y, 9);
  });
});
