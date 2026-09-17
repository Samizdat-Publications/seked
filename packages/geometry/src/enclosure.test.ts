import { describe, expect, it } from 'vitest';
import { buildEnvironment } from './environment';
import type { Footprint } from './footprints';
import { meshVolume, type Mesh } from './mesh';
import { causewayRoofMesh, ENCLOSURE_THICKNESS, enclosureWallMesh } from './enclosure';

/** Invented numbers, not measurements: the keys the database does not carry, given values. */
const G1 = { 'g1.base.side.mean': 230, 'g1.height.original': 146 };

function wellFormed(mesh: Mesh): boolean {
  if (mesh.indices.length !== mesh.triangleCount * 3) return false;
  if (mesh.positions.length !== mesh.vertexCount * 3) return false;
  if (![...mesh.positions].every((v) => Number.isFinite(v))) return false;
  return [...mesh.indices].every((i) => Number.isInteger(i) && i >= 0 && i < mesh.vertexCount);
}

function extent(mesh: Mesh, axis: 0 | 1 | 2): [number, number] {
  let low = Infinity;
  let high = -Infinity;
  for (let i = axis; i < mesh.positions.length; i += 3) {
    low = Math.min(low, mesh.positions[i] as number);
    high = Math.max(high, mesh.positions[i] as number);
  }
  return [low, high];
}

/** Two segments of a causeway climbing eastward, as the import writes one. */
const CAUSEWAY: Footprint = {
  id: 'khafre.causeway', name: 'Causeway of Khafre', kind: 'prism', group: 'causeways',
  base: -10, heightKey: 'khafre.causeway.thickness', area: 400,
  ring: [[0, -2], [50, -2], [100, -2], [100, 2], [50, 2], [0, 2]],
  bases: [-10, -5, 0, 0, -5, -10],
};

describe('enclosureWallMesh', () => {
  it('builds nothing while the database names no distance and no height', () => {
    // These are the keys as they stand today: neither is in data/measurements.
    expect(enclosureWallMesh(buildEnvironment(G1), 'g1')).toBeUndefined();
    expect(enclosureWallMesh(buildEnvironment({ ...G1, 'tier3.enclosure.distance': 10 }), 'g1')).toBeUndefined();
    expect(enclosureWallMesh(buildEnvironment({ ...G1, 'tier3.enclosure.height': 8 }), 'g1')).toBeUndefined();
    // And nothing at all for a structure with no base.
    expect(enclosureWallMesh(buildEnvironment({ 'tier3.enclosure.distance': 10, 'tier3.enclosure.height': 8 }), 'g1')).toBeUndefined();
  });

  it('stands the wall off the base edge by the distance the database gives', () => {
    const env = buildEnvironment({ ...G1, 'tier3.enclosure.distance': 10, 'tier3.enclosure.height': 8 });
    const mesh = enclosureWallMesh(env, 'g1') as Mesh;
    expect(wellFormed(mesh)).toBe(true);
    const inner = 115 + 10;
    const outer = inner + ENCLOSURE_THICKNESS;
    expect(extent(mesh, 0)).toEqual([-outer, outer]);
    expect(extent(mesh, 2)).toEqual([0, 8]);
    // The area between two squares, times the height.
    expect(meshVolume(mesh)).toBeCloseTo(((2 * outer) ** 2 - (2 * inner) ** 2) * 8, 1);
  });

  it('prefers the structure’s own records to the plateau-wide ones, and says which it used', () => {
    const env = buildEnvironment({
      ...G1,
      'tier3.enclosure.distance': 10, 'tier3.enclosure.height': 8,
      'g1.enclosure.distance': 20, 'g1.enclosure.height': 9, 'g1.enclosure.thickness': 2,
    });
    const mesh = enclosureWallMesh(env, 'g1') as Mesh;
    expect(extent(mesh, 0)).toEqual([-(115 + 20 + 2), 115 + 20 + 2]);
    expect(extent(mesh, 2)).toEqual([0, 9]);
    expect(mesh).toBeDefined();
    expect(enclosureWallMesh(env, 'g1')?.label).toContain('g1.enclosure.distance');
    expect(enclosureWallMesh(env, 'g1')?.label).toContain('g1.enclosure.thickness');
  });

  it('puts the wall on the structure’s own centre, elevation and orientation', () => {
    const env = buildEnvironment({
      'g2.base.side.mean': 215, 'g2.height.original': 143.5,
      'g2.centre.offset.west': 334.41, 'g2.centre.offset.south': 353.86,
      'g2.base.elevation.relative': 10, 'g2.orientation': 90,
      'tier3.enclosure.distance': 10, 'tier3.enclosure.height': 8,
    });
    const mesh = enclosureWallMesh(env, 'g2') as Mesh;
    const [low, high] = extent(mesh, 0);
    expect((low + high) / 2).toBeCloseTo(-334.41, 3);
    expect(extent(mesh, 2)[0]).toBeCloseTo(10, 3);
    const [northLow, northHigh] = extent(mesh, 1);
    expect((northLow + northHigh) / 2).toBeCloseTo(-353.86, 3);
  });
});

describe('causewayRoofMesh', () => {
  const ENV = { 'khafre.causeway.thickness': 1.5, 'tier3.causeway.corridor.height': 4.5 };

  it('carries the slab over the causeway’s own top, climbing with it', () => {
    const mesh = causewayRoofMesh(buildEnvironment(ENV), [CAUSEWAY]) as Mesh;
    expect(wellFormed(mesh)).toBe(true);
    const lift = 1.5 + 4.5;
    // The causeway's own bases run from -10 up to 0, so the slab runs from
    // -10 + lift to 0 + lift + its own thickness.
    expect(extent(mesh, 2)).toEqual([-10 + lift, 0 + lift + 1.5]);
  });

  it('keeps the causeway’s own plan, and names what it reused', () => {
    const roof = causewayRoofMesh(buildEnvironment(ENV), [CAUSEWAY]);
    expect(extent(roof as Mesh, 0)).toEqual([0, 100]);
    expect(extent(roof as Mesh, 1)).toEqual([-2, 2]);
    expect(roof?.label).toContain('tier3.causeway.corridor.height');
    expect(roof?.label).toContain('khafre.causeway.thickness');
    expect(roof?.label).toContain('Look choices');
  });

  it('builds nothing without the causeway, or without either key', () => {
    expect(causewayRoofMesh(buildEnvironment(ENV), [])).toBeUndefined();
    expect(causewayRoofMesh(buildEnvironment({ 'khafre.causeway.thickness': 1.5 }), [CAUSEWAY])).toBeUndefined();
    expect(causewayRoofMesh(buildEnvironment({ 'tier3.causeway.corridor.height': 4.5 }), [CAUSEWAY])).toBeUndefined();
  });
});
