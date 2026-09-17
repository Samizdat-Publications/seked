import { describe, expect, it } from 'vitest';
import { buildEnvironment } from './environment';
import type { Footprint } from './footprints';
import type { Mesh } from './mesh';
import {
  capMesh, convexHull, cutWallMesh, dilateHull, SPHINX_MARGIN_KEY, SPHINX_RIM_KEY, sphinxTrenchMesh,
} from './trench';

/** Invented outlines, not measurements: three overlapping boxes standing in for the Sphinx. */
function part(id: string, base: number, ring: [number, number][]): Footprint {
  return { id, name: id, kind: 'prism', group: 'sphinx', base, height: 10, area: 0, ring };
}
const SPHINX: Footprint[] = [
  part('sphinx.body', -38.65, [[0, 0], [50, 0], [50, 20], [0, 20]]),
  part('sphinx.paws', -39.71, [[50, 5], [70, 5], [70, 15], [50, 15]]),
  part('sphinx.head', -38.6, [[0, 5], [12, 5], [12, 15], [0, 15]]),
];

function extent(mesh: Mesh, axis: 0 | 1 | 2): [number, number] {
  let low = Infinity;
  let high = -Infinity;
  for (let i = axis; i < mesh.positions.length; i += 3) {
    low = Math.min(low, mesh.positions[i] as number);
    high = Math.max(high, mesh.positions[i] as number);
  }
  return [low, high];
}

function wellFormed(mesh: Mesh): boolean {
  if (mesh.indices.length !== mesh.triangleCount * 3) return false;
  if (mesh.positions.length !== mesh.vertexCount * 3) return false;
  if (![...mesh.positions].every((v) => Number.isFinite(v))) return false;
  return [...mesh.indices].every((i) => Number.isInteger(i) && i >= 0 && i < mesh.vertexCount);
}

describe('convexHull and dilateHull', () => {
  it('takes the hull of overlapping outlines counter-clockwise, dropping the points inside', () => {
    const hull = convexHull(SPHINX.flatMap((f) => f.ring));
    // The head sits wholly inside the body and the paws stick out east, so
    // the hull is six corners and every point of the head is gone.
    expect(hull.length).toBe(6);
    expect(hull.some(([x, y]) => x === 12 && y === 5)).toBe(false);
    let area = 0;
    for (let i = 0; i < hull.length; i++) {
      const [x0, y0] = hull[i] as [number, number];
      const [x1, y1] = hull[(i + 1) % hull.length] as [number, number];
      area += x0 * y1 - x1 * y0;
    }
    expect(area).toBeGreaterThan(0);
  });

  it('pushes a square out by the margin on every side', () => {
    const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const out = dilateHull(square, 2);
    expect(out[0]?.[0]).toBeCloseTo(-2, 9);
    expect(out[0]?.[1]).toBeCloseTo(-2, 9);
    expect(out[2]?.[0]).toBeCloseTo(12, 9);
    expect(out[2]?.[1]).toBeCloseTo(12, 9);
  });
});

describe('capMesh and cutWallMesh', () => {
  it('lays a flat cap at one level and carries a wall between two', () => {
    const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const cap = capMesh(square, -5);
    expect(wellFormed(cap)).toBe(true);
    expect(extent(cap, 2)).toEqual([-5, -5]);
    expect(cap.triangleCount).toBe(2);
    const wall = cutWallMesh(square, -5, 3);
    expect(wellFormed(wall)).toBe(true);
    expect(extent(wall, 2)).toEqual([-5, 3]);
    expect(wall.triangleCount).toBe(8);
  });
});

describe('sphinxTrenchMesh', () => {
  it('builds nothing while neither the database nor the caller gives a margin', () => {
    // The database is the first half of this today: no sphinx.enclosure.margin.
    expect(sphinxTrenchMesh(buildEnvironment({}), SPHINX, { groundLevel: -10 })).toBeUndefined();
  });

  it('builds nothing without a rim, from a record or from the caller', () => {
    expect(sphinxTrenchMesh(buildEnvironment({ [SPHINX_MARGIN_KEY]: 12 }), SPHINX)).toBeUndefined();
  });

  it('builds nothing with no Sphinx footprints, or with a rim below the floor', () => {
    const env = buildEnvironment({ [SPHINX_MARGIN_KEY]: 12 });
    expect(sphinxTrenchMesh(env, [], { groundLevel: -10 })).toBeUndefined();
    expect(sphinxTrenchMesh(env, SPHINX, { groundLevel: -50 })).toBeUndefined();
  });

  it('cuts the floor to the lowest of their bases and the walls up to the ground given', () => {
    const trench = sphinxTrenchMesh(buildEnvironment({ [SPHINX_MARGIN_KEY]: 12 }), SPHINX, { groundLevel: -10 });
    expect(trench).toBeDefined();
    expect(wellFormed(trench?.floor as Mesh)).toBe(true);
    expect(wellFormed(trench?.walls as Mesh)).toBe(true);
    expect(trench?.floorLevel).toBeCloseTo(-39.71, 4);
    expect(extent(trench?.floor as Mesh, 2)[0]).toBeCloseTo(-39.71, 4);
    expect(extent(trench?.floor as Mesh, 2)[1]).toBeCloseTo(-39.71, 4);
    expect(extent(trench?.walls as Mesh, 2)[0]).toBeCloseTo(-39.71, 4);
    expect(extent(trench?.walls as Mesh, 2)[1]).toBeCloseTo(-10, 4);
    // The outline stands the margin clear of the outermost traced point.
    expect(extent(trench?.walls as Mesh, 0)[1]).toBeCloseTo(70 + 12, 3);
    expect(extent(trench?.walls as Mesh, 0)[0]).toBeCloseTo(-12, 3);
  });

  it('hands back the plan it cut, which is what a ground grid has to lose', () => {
    const trench = sphinxTrenchMesh(buildEnvironment({ [SPHINX_MARGIN_KEY]: 12 }), SPHINX, { groundLevel: -10 });
    const outline = trench?.outline as [number, number][];
    expect(outline.length).toBe(6);
    expect(Math.min(...outline.map(([x]) => x))).toBeCloseTo(-12, 3);
    expect(Math.max(...outline.map(([x]) => x))).toBeCloseTo(82, 3);
  });

  it('takes the margin from the caller when the database has none, and says it is a look choice', () => {
    const trench = sphinxTrenchMesh(buildEnvironment({}), SPHINX, { groundLevel: -10, margin: 6 });
    expect(trench).toBeDefined();
    expect(extent(trench?.walls as Mesh, 0)[1]).toBeCloseTo(76, 3);
    expect(trench?.label).toContain('a look choice and not a measurement');
    // A record in the database wins over the caller's, and is named as a record.
    const recorded = sphinxTrenchMesh(buildEnvironment({ [SPHINX_MARGIN_KEY]: 12 }), SPHINX, { groundLevel: -10, margin: 6 });
    expect(extent(recorded?.walls as Mesh, 0)[1]).toBeCloseTo(82, 3);
    expect(recorded?.label).toContain(SPHINX_MARGIN_KEY);
    expect(recorded?.label).not.toContain('a look choice and not a measurement');
  });

  it('gives each wall vertex the height of the ground over it when the ground is a function', () => {
    // A plateau falling one metre every ten eastward, as the real one does
    // from the Sphinx's back to its paws.
    const ground = (x: number): number => -20 - x / 10;
    const trench = sphinxTrenchMesh(buildEnvironment({ [SPHINX_MARGIN_KEY]: 12 }), SPHINX, { groundLevel: ground });
    expect(trench).toBeDefined();
    const tops = extent(trench?.walls as Mesh, 2);
    expect(tops[0]).toBeCloseTo(-39.71, 4);
    // West end at x = -12 is the highest ground; the east end has fallen below
    // the floor and the wall is cut off at it rather than going under it.
    expect(tops[1]).toBeCloseTo(ground(-12), 4);
    const zs = [...(trench?.walls as Mesh).positions.filter((_, i) => i % 3 === 2)];
    expect(Math.min(...zs)).toBeGreaterThanOrEqual(-39.711);
  });

  it('prefers a recorded rim to the one the caller passes, and says which it used', () => {
    const env = buildEnvironment({ [SPHINX_MARGIN_KEY]: 12, [SPHINX_RIM_KEY]: -8 });
    const trench = sphinxTrenchMesh(env, SPHINX, { groundLevel: -10 });
    expect(extent(trench?.walls as Mesh, 2)[1]).toBeCloseTo(-8, 4);
    expect(trench?.label).toContain(SPHINX_RIM_KEY);
  });

  it('says what it is and which of its dimensions are look choices', () => {
    const label = sphinxTrenchMesh(buildEnvironment({ [SPHINX_MARGIN_KEY]: 12 }), SPHINX, { groundLevel: -10 })?.label as string;
    expect(label).toContain('Reconstruction');
    expect(label).toContain(SPHINX_MARGIN_KEY);
    expect(label).toContain('Look choices');
    expect(label).toContain('convex hull');
  });
});
