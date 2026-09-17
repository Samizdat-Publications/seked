import { describe, expect, it } from 'vitest';
import { footprintMesh, type Footprint } from './footprints';
import { meshVolume, type Mesh } from './mesh';
import { CHAPEL_SIZE, mastabaChapelMesh, mastabaMesh, mergeMeshes, RUIN_RANGE, ruinFraction } from './mastaba';

/** Invented outlines, not measurements: a 20 by 44 m tomb, its long axis north. */
const RING: [number, number][] = [[324.71, -55.61], [324.94, -11.77], [303.76, -11.65], [303.53, -55.51]];

const ENV = { 'tier3.mastaba.height': 4, 'tier3.mastaba.batter': 74.84 };

function mastaba(id: string, extra: Partial<Footprint> = {}): Footprint {
  return {
    id, name: 'Mastaba', kind: 'prism', group: 'mastabas',
    heightKey: 'tier3.mastaba.height', batterKey: 'tier3.mastaba.batter',
    base: -3.64, area: 928.76, ring: RING, ...extra,
  };
}

function top(mesh: Mesh): number {
  let z = -Infinity;
  for (let i = 2; i < mesh.positions.length; i += 3) z = Math.max(z, mesh.positions[i] as number);
  return z;
}

function centroidEast(mesh: Mesh): number {
  let sum = 0;
  for (let i = 0; i < mesh.positions.length; i += 3) sum += mesh.positions[i] as number;
  return sum / mesh.vertexCount;
}

function wellFormed(mesh: Mesh): boolean {
  if (mesh.indices.length !== mesh.triangleCount * 3) return false;
  if (mesh.positions.length !== mesh.vertexCount * 3) return false;
  if (![...mesh.positions].every((v) => Number.isFinite(v))) return false;
  return [...mesh.indices].every((i) => Number.isInteger(i) && i >= 0 && i < mesh.vertexCount);
}

describe('mergeMeshes', () => {
  it('moves the later meshes’ indices along and adds up their volumes', () => {
    const box = (x: number): Mesh =>
      footprintMesh(
        { id: 'b', name: 'b', kind: 'prism', group: 't', base: 0, height: 2, area: 1, ring: [[x, 0], [x + 1, 0], [x + 1, 1], [x, 1]] },
        {},
      ) as Mesh;
    const merged = mergeMeshes([box(0), box(10)]);
    expect(wellFormed(merged)).toBe(true);
    expect(merged.vertexCount).toBe(box(0).vertexCount * 2);
    expect(meshVolume(merged)).toBeCloseTo(4, 6);
  });
});

describe('mastabaMesh', () => {
  it('is the same mesh every time for the same footprint id', () => {
    const once = mastabaMesh(mastaba('mastaba.osm_296626517'), ENV, 'ruined') as Mesh;
    const again = mastabaMesh(mastaba('mastaba.osm_296626517'), ENV, 'ruined') as Mesh;
    expect([...once.positions]).toEqual([...again.positions]);
    expect([...once.indices]).toEqual([...again.indices]);
  });

  it('gives two tombs different ruins, each between three and seven tenths', () => {
    const ids = ['mastaba.osm_296626517', 'mastaba.osm_296626518', 'mastaba.osm_296626519', 'mastaba.osm_1'];
    const fractions = ids.map(ruinFraction);
    for (const f of fractions) {
      expect(f).toBeGreaterThanOrEqual(RUIN_RANGE.low);
      expect(f).toBeLessThan(RUIN_RANGE.high);
    }
    expect(new Set(fractions).size).toBe(ids.length);
  });

  it('leaves a ruined tomb below the cased one, and the cased one at the full height', () => {
    const f = mastaba('mastaba.osm_296626517');
    const cased = mastabaMesh(f, ENV, 'cased') as Mesh;
    const ruined = mastabaMesh(f, ENV, 'ruined') as Mesh;
    expect(top(cased)).toBeCloseTo(f.base + 4, 3);
    expect(top(ruined)).toBeLessThan(top(cased));
    expect(top(ruined)).toBeCloseTo(f.base + 4 * ruinFraction(f.id), 3);
  });

  it('puts the chapel on the east side, further east than the tomb itself', () => {
    const f = mastaba('mastaba.osm_296626517');
    const chapel = mastabaChapelMesh(f, ENV) as Mesh;
    const core = footprintMesh(f, ENV) as Mesh;
    expect(centroidEast(chapel)).toBeGreaterThan(centroidEast(core));
    // Its block is the size it says it is, half in and half out of the face.
    expect(meshVolume(chapel)).toBeCloseTo(CHAPEL_SIZE.along * CHAPEL_SIZE.into * CHAPEL_SIZE.up, 3);
    expect(top(chapel)).toBeCloseTo(f.base + CHAPEL_SIZE.up, 3);
  });

  it('builds the cased tomb as core, casing and chapel in one well formed mesh', () => {
    const f = mastaba('mastaba.osm_296626517');
    const cased = mastabaMesh(f, ENV, 'cased') as Mesh;
    const core = footprintMesh(f, ENV) as Mesh;
    const chapel = mastabaChapelMesh(f, ENV) as Mesh;
    expect(wellFormed(cased)).toBe(true);
    expect(cased.vertexCount).toBe(core.vertexCount * 2 + chapel.vertexCount);
    // The casing skin stands over the batter, so the three enclose more than the core alone.
    expect(meshVolume(cased)).toBeGreaterThan(meshVolume(core));
  });

  it('says what it is and which of its dimensions are look choices', () => {
    const f = mastaba('mastaba.osm_296626517');
    expect(mastabaMesh(f, ENV, 'cased')?.label).toContain('Look choices');
    expect(mastabaMesh(f, ENV, 'cased')?.label).toContain('chapel');
    expect(mastabaMesh(f, ENV, 'ruined')?.label).toContain('Look choices');
  });

  it('builds nothing outside the mastaba fields, and nothing without a height', () => {
    expect(mastabaMesh(mastaba('t', { group: 'temples' }), ENV, 'cased')).toBeUndefined();
    expect(mastabaMesh(mastaba('t'), {}, 'cased')).toBeUndefined();
    expect(mastabaMesh(mastaba('t'), {}, 'ruined')).toBeUndefined();
    // A height but no batter is still a tomb, just an unbattered one.
    expect(mastabaMesh(mastaba('t'), { 'tier3.mastaba.height': 4 }, 'cased')).toBeDefined();
  });
});
