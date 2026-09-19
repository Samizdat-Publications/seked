import { describe, expect, it } from 'vitest';
import { footprintInputs, footprintMesh, footprintSpan, mergeCollinear, PIT_LIP, ringCentroid, triangulate, type Footprint } from './footprints';
import type { Mesh } from './mesh';
import { meshVolume } from './mesh';

/**
 * Footprints are tested here on invented outlines whose areas and volumes can
 * be worked out by hand; the real import is tested against the database in
 * packages/data. Nothing below is a measurement of anything.
 */
type Ring = [number, number][];

function footprint(ring: Ring, extra: Partial<Footprint> = {}): Footprint {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i] as [number, number];
    const [x1, y1] = ring[(i + 1) % ring.length] as [number, number];
    area += (x0 * y1 - x1 * y0) / 2;
  }
  return { id: 't', name: 't', kind: 'prism', group: 't', osm: 1, base: 0, area, ring, ...extra };
}

function triangleArea(ring: Ring, tris: number[]): number {
  let total = 0;
  for (let t = 0; t < tris.length; t += 3) {
    const [ax, ay] = ring[tris[t] as number] as [number, number];
    const [bx, by] = ring[tris[t + 1] as number] as [number, number];
    const [cx, cy] = ring[tris[t + 2] as number] as [number, number];
    const a = ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2;
    expect(a).toBeGreaterThanOrEqual(-1e-9);
    total += a;
  }
  return total;
}

/** Every directed edge used once, and its reverse once: a closed, consistently wound surface. */
function closed(mesh: Mesh): boolean {
  const seen = new Map<string, number>();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const a = mesh.indices[i + k] as number;
      const b = mesh.indices[i + ((k + 1) % 3)] as number;
      seen.set(`${a}>${b}`, (seen.get(`${a}>${b}`) ?? 0) + 1);
    }
  }
  for (const [key, count] of seen) {
    const [a, b] = key.split('>');
    if (count !== 1 || seen.get(`${b}>${a}`) !== 1) return false;
  }
  return true;
}

const SQUARE: Ring = [[0, 0], [10, 0], [10, 10], [0, 10]];
/** An L, 30 square metres, with its reflex corner at (2, 2). */
const ELL: Ring = [[0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6]];
/** The square again with a vertex in the middle of its south side. */
const STRAIGHT: Ring = [[0, 0], [5, 0], [10, 0], [10, 10], [0, 10]];

describe('triangulate', () => {
  it('covers a convex outline exactly', () => {
    const tris = triangulate(SQUARE);
    expect(tris.length).toBe(6);
    expect(triangleArea(SQUARE, tris)).toBeCloseTo(100, 9);
  });

  it('covers a concave one without reaching across the notch', () => {
    const tris = triangulate(ELL);
    expect(tris.length).toBe(12);
    expect(triangleArea(ELL, tris)).toBeCloseTo(20, 9);
  });

  it('keeps a vertex in a straight line as a zero-area triangle, so the cap shares every edge', () => {
    const tris = triangulate(STRAIGHT);
    expect(tris.length).toBe(9);
    expect(triangleArea(STRAIGHT, tris)).toBeCloseTo(100, 9);
  });
});

describe('footprintMesh', () => {
  it('carries a prism straight up and closes it', () => {
    const mesh = footprintMesh(footprint(ELL, { height: 3, base: 7 }), {}) as Mesh;
    expect(closed(mesh)).toBe(true);
    expect(meshVolume(mesh)).toBeCloseTo(20 * 3, 6);
    const zs = [...mesh.positions].filter((_, i) => i % 3 === 2);
    expect(Math.min(...zs)).toBe(7);
    expect(Math.max(...zs)).toBe(10);
  });

  it('starts a part off the ground at its minimum height, the way the Sphinx\u2019s head does', () => {
    const mesh = footprintMesh(footprint(SQUARE, { height: 20, minHeight: 11 }), {}) as Mesh;
    expect(meshVolume(mesh)).toBeCloseTo(100 * 9, 6);
  });

  it('raises a pyramid to its centroid at a third of the prism\u2019s volume', () => {
    const mesh = footprintMesh(footprint(SQUARE, { kind: 'pyramid', height: 30 }), {}) as Mesh;
    expect(closed(mesh)).toBe(true);
    expect(meshVolume(mesh)).toBeCloseTo((100 * 30) / 3, 6);
    expect(ringCentroid(SQUARE)).toEqual([5, 5]);
  });

  it('cuts a pit down from the ground, with a lip just proud of it', () => {
    const f = footprint(SQUARE, { kind: 'pit', depthKey: 'pit.depth', base: 2 });
    expect(footprintSpan(f, { 'pit.depth': 6 })).toEqual({ bottom: -4, top: 2 + PIT_LIP });
    expect(meshVolume(footprintMesh(f, { 'pit.depth': 6 }) as Mesh)).toBeCloseTo(100 * (6 + PIT_LIP), 4);
  });

  it('takes a height from the environment when the outline carries none, and names the key', () => {
    const f = footprint(SQUARE, { heightKey: 'temple.height' });
    expect(footprintInputs(f)).toEqual(['temple.height']);
    expect(footprintMesh(f, {})).toBeUndefined();
    expect(meshVolume(footprintMesh(f, { 'temple.height': 4 }) as Mesh)).toBeCloseTo(400, 6);
  });

  it('builds nothing whose top is not above its bottom', () => {
    expect(footprintMesh(footprint(SQUARE, { height: 5, minHeight: 5 }), {})).toBeUndefined();
  });
});

/**
 * `mergeCollinear` exists because an edge is a unit of work: a doorway is cut
 * along one, and OpenStreetMap traces a straight wall as several. Its whole
 * contract is that it changes the ring and not the solid.
 */
describe('mergeCollinear', () => {
  /** A square whose east side is traced as four collinear segments. */
  const JAGGED: [number, number][] = [
    [0, 0], [10, 0], [10, 2.5], [10, 5], [10, 7.5], [10, 10], [0, 10],
  ];

  it('drops a vertex that stands on the line between its neighbours', () => {
    expect(mergeCollinear(JAGGED)).toEqual([[0, 0], [10, 0], [10, 10], [0, 10]]);
  });

  it('keeps a corner, however slight, once it is past the tolerance', () => {
    const bent: [number, number][] = [[0, 0], [10, 0], [10.6, 5], [10, 10], [0, 10]];
    expect(mergeCollinear(bent)).toHaveLength(5);
    // The same bend is a straight line to a looser tolerance.
    // That bend turns by 13.6 degrees, so it takes a tolerance past that.
    expect(mergeCollinear(bent, 20)).toHaveLength(4);
  });

  it('moves no surface, which is the whole of why it is allowed', () => {
    const solid = (ring: readonly [number, number][]) =>
      meshVolume(footprintMesh({ id: 'x', name: 'x', kind: 'prism', group: 'temples', base: 0, height: 4, area: 0, ring: ring as [number, number][] }, {}) as Mesh);
    expect(solid(mergeCollinear(JAGGED) as [number, number][])).toBeCloseTo(solid(JAGGED), 6);
  });

  it('leaves a triangle and a duplicate-free ring alone, and never returns less than a ring', () => {
    const tri: [number, number][] = [[0, 0], [4, 0], [0, 4]];
    expect(mergeCollinear(tri)).toEqual(tri);
    // A ring that is entirely one straight line has no ring in it, so the
    // traced one comes back rather than two points.
    const line: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0]];
    expect(mergeCollinear(line)).toEqual(line);
  });

  it('drops a duplicate vertex, which is a zero-length edge', () => {
    expect(mergeCollinear([[0, 0], [10, 0], [10, 0], [10, 10], [0, 10]])).toEqual([[0, 0], [10, 0], [10, 10], [0, 10]]);
  });
});
