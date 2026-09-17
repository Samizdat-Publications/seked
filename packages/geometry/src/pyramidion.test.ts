import { describe, expect, it } from 'vitest';
import { buildEnvironment } from './environment';
import { meshVolume, type Mesh } from './mesh';
import { faceAngleDeg, placeMesh, pyramidionMesh, pyramidionProfile, structurePlacement } from './pyramidion';

/**
 * Invented numbers, not measurements: a pyramid of a round base and a round
 * height whose angles can be worked out by hand. The real database is run
 * through these builders in packages/data.
 */
const G1 = {
  'g1.base.side.mean': 230,
  'g1.height.original': 146,
  'g1.pyramidion.height': 1.4,
};

/** The apex of a mesh: the vertex highest up. */
function apex(mesh: Mesh): [number, number, number] {
  let best: [number, number, number] = [0, 0, -Infinity];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const z = mesh.positions[i + 2] as number;
    if (z > best[2]) best = [mesh.positions[i] as number, mesh.positions[i + 1] as number, z];
  }
  return best;
}

/** The angle a face stands at, from the apex and the middle of one base edge. */
function measuredFaceAngleDeg(mesh: Mesh): number {
  const [ax, ay, az] = apex(mesh);
  let lowest = Infinity;
  for (let i = 0; i < mesh.positions.length; i += 3) lowest = Math.min(lowest, mesh.positions[i + 2] as number);
  // The base ring's mid-edge points are the ones nearest the axis.
  let nearest = Infinity;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    if (Math.abs((mesh.positions[i + 2] as number) - lowest) > 1e-6) continue;
    const r = Math.hypot((mesh.positions[i] as number) - ax, (mesh.positions[i + 1] as number) - ay);
    if (r > 1e-6) nearest = Math.min(nearest, r);
  }
  return (Math.atan2(az - lowest, nearest) * 180) / Math.PI;
}

function finite(mesh: Mesh): boolean {
  return [...mesh.positions].every((v) => Number.isFinite(v));
}

/** Every index names a vertex, and there are three of them per triangle. */
function wellFormed(mesh: Mesh): boolean {
  if (mesh.indices.length !== mesh.triangleCount * 3) return false;
  if (mesh.positions.length !== mesh.vertexCount * 3) return false;
  return [...mesh.indices].every((i) => Number.isInteger(i) && i >= 0 && i < mesh.vertexCount);
}

describe('pyramidionMesh', () => {
  it('stands its apex at the structure’s apex', () => {
    const env = buildEnvironment({ ...G1, 'g1.face.angle': 51.8444 });
    const mesh = pyramidionMesh(env, 'g1') as Mesh;
    expect(mesh).toBeDefined();
    const place = structurePlacement(env, 'g1');
    const [x, y, z] = apex(mesh);
    expect(x).toBeCloseTo(place.east, 6);
    expect(y).toBeCloseTo(place.north, 6);
    expect(z).toBeCloseTo(place.up + (G1['g1.height.original'] as number), 3);
  });

  it('takes the structure’s own face angle, measured where the preset has one', () => {
    const env = buildEnvironment({ ...G1, 'g1.face.angle': 51.8444 });
    expect(faceAngleDeg(env, 'g1')).toBe(51.8444);
    const profile = pyramidionProfile(env, 'g1');
    expect(profile?.angleMeasured).toBe(true);
    // The capstone's own geometry: half the base over the height is the
    // cotangent of the angle, to better than a billionth of a degree.
    const fromProfile = (Math.atan2(profile?.height as number, (profile?.baseSide as number) / 2) * 180) / Math.PI;
    expect(Math.abs(fromProfile - 51.8444)).toBeLessThan(1e-9);
    // The mesh keeps that to what float32 positions at 146 m can carry.
    expect(measuredFaceAngleDeg(pyramidionMesh(env, 'g1') as Mesh)).toBeCloseTo(51.8444, 3);
  });

  it('falls back to the angle the environment derives from the base and the height', () => {
    const env = buildEnvironment(G1);
    const derived = env['g1.face.angle.derived'] as number;
    expect(derived).toBeCloseTo((Math.atan2(146, 115) * 180) / Math.PI, 12);
    expect(faceAngleDeg(env, 'g1')).toBe(derived);
    const profile = pyramidionProfile(env, 'g1');
    expect(profile?.angleMeasured).toBe(false);
    const fromProfile = (Math.atan2(profile?.height as number, (profile?.baseSide as number) / 2) * 180) / Math.PI;
    expect(Math.abs(fromProfile - derived)).toBeLessThan(1e-9);
    expect(measuredFaceAngleDeg(pyramidionMesh(env, 'g1') as Mesh)).toBeCloseTo(derived, 3);
  });

  it('places it over a structure that is not at the origin, turned by the structure’s orientation', () => {
    const env = buildEnvironment({
      'g2.base.side.mean': 215,
      'g2.height.original': 143.5,
      'g2.pyramidion.height': 1.4,
      'g2.face.angle': 53.1667,
      'g2.centre.offset.west': 334.41,
      'g2.centre.offset.south': 353.86,
      'g2.base.elevation.relative': 10,
      'g2.orientation': -0.090556,
    });
    const place = structurePlacement(env, 'g2');
    expect(place).toEqual({ east: -334.41, north: -353.86, up: 10, orientationDeg: -0.090556 });
    const [x, y, z] = apex(pyramidionMesh(env, 'g2') as Mesh);
    expect(x).toBeCloseTo(-334.41, 3);
    expect(y).toBeCloseTo(-353.86, 3);
    expect(z).toBeCloseTo(10 + 143.5, 2);
  });

  it('encloses the volume its own base and height give it, and is a well formed mesh', () => {
    const env = buildEnvironment({ ...G1, 'g1.face.angle': 45 });
    const mesh = pyramidionMesh(env, 'g1') as Mesh;
    // At 45 degrees the half base is the height, so the base side is 2.8 m.
    expect(meshVolume(mesh)).toBeCloseTo((2.8 * 2.8 * 1.4) / 3, 3);
    expect(finite(mesh)).toBe(true);
    expect(wellFormed(mesh)).toBe(true);
  });

  it('says what it is and which of its dimensions are look choices', () => {
    const mesh = pyramidionMesh(buildEnvironment({ ...G1, 'g1.face.angle': 51.8444 }), 'g1');
    expect(mesh?.label).toContain('Reconstruction');
    expect(mesh?.label).toContain('g1.pyramidion.height');
    expect(mesh?.label).toContain('Look choices');
  });

  it('builds nothing when the database lacks a record it needs', () => {
    expect(pyramidionMesh(buildEnvironment({}), 'g1')).toBeUndefined();
    // No pyramidion height.
    expect(pyramidionMesh(buildEnvironment({ 'g1.base.side.mean': 230, 'g1.height.original': 146 }), 'g1')).toBeUndefined();
    // No angle, and none derivable without a base.
    expect(pyramidionMesh(buildEnvironment({ 'g1.height.original': 146, 'g1.pyramidion.height': 1.4 }), 'g1')).toBeUndefined();
    // No original height.
    expect(pyramidionMesh(buildEnvironment({ 'g1.pyramidion.height': 1.4, 'g1.face.angle': 51.8 }), 'g1')).toBeUndefined();
    // A capstone taller than the pyramid is not a capstone.
    expect(pyramidionMesh(buildEnvironment({ ...G1, 'g1.height.original': 1, 'g1.face.angle': 51.8 }), 'g1')).toBeUndefined();
  });
});

describe('placeMesh', () => {
  it('turns about the vertical and then moves, leaving the mesh’s topology alone', () => {
    const one: Mesh = {
      positions: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]),
      indices: Uint32Array.from([0, 1, 2]),
      vertexCount: 3,
      triangleCount: 1,
    };
    const moved = placeMesh(one, 10, 20, 30, 90);
    expect(moved.positions[0]).toBeCloseTo(10, 5);
    expect(moved.positions[1]).toBeCloseTo(21, 5);
    expect(moved.positions[2]).toBeCloseTo(30, 5);
    expect(moved.positions[3]).toBeCloseTo(9, 5);
    expect(moved.positions[4]).toBeCloseTo(20, 5);
    expect([...moved.indices]).toEqual([0, 1, 2]);
  });
});
