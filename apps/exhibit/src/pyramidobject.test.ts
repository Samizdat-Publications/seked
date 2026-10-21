import { describe, expect, it } from 'vitest';
import { loadDatabase } from '@seked/data';
import { pyramidObject, toThree } from './pyramidobject';
import { groundEnvironment } from './receipts';

describe('the pyramid in the hand', () => {
  const ground = groundEnvironment(loadDatabase());
  const p = pyramidObject(ground)!;
  it("is the survey's base and original height, generated, its apex over the centre", () => {
    expect(p.side).toBe(ground['g1.base.side.mean']);
    expect(p.height).toBe(ground['g1.height.original']);
    const z = Array.from({ length: p.mesh.vertexCount }, (_, i) => p.mesh.positions[3 * i + 2]!);
    expect(Math.max(...z)).toBeCloseTo(p.height, 3);
  });
  it('lays a circle of radius the height on the ground, and cuts the A2 triangle on the south face', () => {
    for (const q of p.circle) expect(Math.hypot(q[0]!, q[1]!)).toBeCloseTo(p.height, 6);
    const [, mid, apex] = p.triangle;
    expect(mid).toEqual([0, -p.side / 2, 0]);
    expect(Math.hypot(mid![1]!, apex![2]!)).toBeCloseTo(ground['g1.apothem']!, 6);
    expect(p.north[1]![1]).toBeGreaterThan(p.height);
  });
  it("turns the project frame into three.js's: up is +Y, north is -Z", () => {
    expect(toThree([1, 2, 3])).toEqual([1, 3, -2]);
    expect(pyramidObject({})).toBeNull();
  });
});
