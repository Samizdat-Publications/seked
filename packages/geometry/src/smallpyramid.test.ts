import { describe, expect, it } from 'vitest';
import type { Footprint } from './footprints';
import type { Mesh } from './mesh';
import { QUEENS_SLOPE_KEY, RUIN_FRACTION, ringArea, smallPyramidMesh, smallPyramidProfile, squareFit } from './smallpyramid';

/**
 * Invented outlines, not measurements. A queen's pyramid a little out of
 * square, the way a traced one is, and a turned one to check the axis fit.
 */
type Ring = [number, number][];

function footprint(ring: Ring, extra: Partial<Footprint> = {}): Footprint {
  return {
    id: 'g1a', name: "Queen's pyramid G1-a", kind: 'pyramid', group: 'queens',
    base: -0.89, height: 30.25, area: ringArea(ring), ring, ...extra,
  };
}

/** A square of 44 m about (193, -34), one corner pulled half a metre out. */
const TRACED: Ring = [[171.43, -11.73], [171.1, -56.06], [214.43, -56.38], [214.77, -12.05]];
/** An exact square of 40 m, turned 20 degrees, about the origin. */
const TURNED: Ring = (() => {
  const a = (20 * Math.PI) / 180;
  const corners: Ring = [[-20, -20], [20, -20], [20, 20], [-20, 20]];
  return corners.map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)] as [number, number]);
})();

const ENV = { 'tier3.mastaba.course.height': 0.3497 };

/**
 * The area the mesh covers at its lowest level, as the convex hull of the
 * vertices there. A hull, not a wound ring, because the base ring's own
 * centre vertex sits among them and a pyramid's plan is convex anyway.
 */
function baseArea(mesh: Mesh): number {
  let lowest = Infinity;
  for (let i = 2; i < mesh.positions.length; i += 3) lowest = Math.min(lowest, mesh.positions[i] as number);
  const points: [number, number][] = [];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    if (Math.abs((mesh.positions[i + 2] as number) - lowest) > 1e-4) continue;
    points.push([mesh.positions[i] as number, mesh.positions[i + 1] as number]);
  }
  points.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: [number, number][]): [number, number][] => {
    const out: [number, number][] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2] as [number, number], out[out.length - 1] as [number, number], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return ringArea([...half(points), ...half([...points].reverse())]);
}

function highest(mesh: Mesh): number {
  let top = -Infinity;
  for (let i = 2; i < mesh.positions.length; i += 3) top = Math.max(top, mesh.positions[i] as number);
  return top;
}

function wellFormed(mesh: Mesh): boolean {
  if (mesh.indices.length !== mesh.triangleCount * 3) return false;
  if (mesh.positions.length !== mesh.vertexCount * 3) return false;
  if (![...mesh.positions].every((v) => Number.isFinite(v))) return false;
  return [...mesh.indices].every((i) => Number.isInteger(i) && i >= 0 && i < mesh.vertexCount);
}

describe('squareFit', () => {
  it('finds a turned square’s own axis, area and centre', () => {
    const fit = squareFit(TURNED);
    expect(fit?.side).toBeCloseTo(40, 9);
    expect(fit?.centre[0]).toBeCloseTo(0, 9);
    expect(fit?.centre[1]).toBeCloseTo(0, 9);
    // Modulo ninety degrees, 20 degrees folds to -25 in the (-45, 45] window.
    expect(Math.abs(((fit?.angleDeg as number) - 20 + 45) % 90) - 45).toBeCloseTo(0, 9);
  });

  it('reads a traced quadrilateral as the square of its own area', () => {
    const fit = squareFit(TRACED);
    expect((fit?.side as number) ** 2).toBeCloseTo(ringArea(TRACED), 6);
    expect(Math.abs(fit?.angleDeg as number)).toBeLessThan(1);
  });

  it('builds nothing from a degenerate outline', () => {
    expect(squareFit([[0, 0], [1, 1]])).toBeUndefined();
    expect(squareFit([[0, 0], [1, 0], [2, 0]])).toBeUndefined();
  });
});

describe('smallPyramidMesh', () => {
  it('lays a base of the outline’s own area, well within two percent', () => {
    for (const state of ['cased', 'stepped'] as const) {
      const mesh = smallPyramidMesh(footprint(TRACED), ENV, state) as Mesh;
      expect(wellFormed(mesh), state).toBe(true);
      expect(Math.abs(baseArea(mesh) - ringArea(TRACED)) / ringArea(TRACED), state).toBeLessThan(0.02);
    }
  });

  it('stands a cased apex at the footprint’s height over its own base', () => {
    const f = footprint(TRACED);
    const mesh = smallPyramidMesh(f, ENV, 'cased') as Mesh;
    expect(highest(mesh)).toBeCloseTo(f.base + (f.height as number), 3);
  });

  it('never carries a stepped ruin past four fifths of the height', () => {
    const f = footprint(TRACED);
    const mesh = smallPyramidMesh(f, ENV, 'stepped') as Mesh;
    const limit = f.base + RUIN_FRACTION * (f.height as number);
    expect(highest(mesh)).toBeLessThanOrEqual(limit + 1e-3);
    // Within one course of it, so the ruin is not quietly a stump.
    expect(highest(mesh)).toBeGreaterThan(limit - (ENV['tier3.mastaba.course.height'] as number) - 1e-3);
  });

  it('takes a group slope over the tagged height when the database has one', () => {
    const f = footprint(TRACED);
    const plain = smallPyramidProfile(f, ENV);
    expect(plain?.slopeMeasured).toBe(false);
    expect(plain?.height).toBeCloseTo(30.25, 9);
    const sloped = smallPyramidProfile(f, { ...ENV, [QUEENS_SLOPE_KEY]: 51 });
    expect(sloped?.slopeMeasured).toBe(true);
    expect(sloped?.faceAngleDeg).toBe(51);
    expect(sloped?.height).toBeCloseTo(((sloped?.side as number) / 2) * Math.tan((51 * Math.PI) / 180), 9);
  });

  it('turns the square onto the outline’s axis', () => {
    const f = footprint(TURNED, { base: 0, height: 20 });
    const mesh = smallPyramidMesh(f, ENV, 'cased') as Mesh;
    // A corner of the base sits at 20 root two from the centre, at 20 degrees
    // plus a multiple of ninety, which the fit folds onto -25.
    let furthest = 0;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      if (Math.abs(mesh.positions[i + 2] as number) > 1e-4) continue;
      furthest = Math.max(furthest, Math.hypot(mesh.positions[i] as number, mesh.positions[i + 1] as number));
    }
    expect(furthest).toBeCloseTo(20 * Math.SQRT2, 3);
  });

  it('says what it is, and that the mastaba course is a reuse', () => {
    const cased = smallPyramidMesh(footprint(TRACED), ENV, 'cased');
    expect(cased?.label).toContain('Reconstruction');
    expect(cased?.label).toContain('Look choices');
    const stepped = smallPyramidMesh(footprint(TRACED), ENV, 'stepped');
    expect(stepped?.label).toContain('tier3.mastaba.course.height');
    expect(stepped?.label).toContain('reused');
  });

  it('builds nothing outside the queens, and nothing the database cannot feed', () => {
    expect(smallPyramidMesh(footprint(TRACED, { group: 'mastabas' }), ENV, 'cased')).toBeUndefined();
    // No height, tagged or keyed.
    expect(smallPyramidMesh(footprint(TRACED, { height: undefined }), ENV, 'cased')).toBeUndefined();
    // A height key the environment does not carry.
    const keyed = footprint(TRACED, { height: undefined, heightKey: 'tier3.satellite_pyramid.height' });
    expect(smallPyramidMesh(keyed, ENV, 'cased')).toBeUndefined();
    expect(smallPyramidMesh(keyed, { ...ENV, 'tier3.satellite_pyramid.height': 3 }, 'cased')).toBeDefined();
    // No course height, so no stepped core.
    expect(smallPyramidMesh(footprint(TRACED), {}, 'stepped')).toBeUndefined();
    expect(smallPyramidMesh(footprint(TRACED), {}, 'cased')).toBeDefined();
  });
});
