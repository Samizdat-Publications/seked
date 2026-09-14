import { describe, expect, it } from 'vitest';
import { INTERIOR_SOLID_INPUTS, buildEnvironment, interiorSolids, meshVolume } from '@seked/geometry';
import type { Mesh } from '@seked/geometry';
import { loadDatabase, resolve } from './index';

/**
 * The interior builders live in @seked/geometry, which knows nothing about the
 * database, so their test lives here, where a preset can be resolved. Every
 * number below comes out of `data/`; none is typed in.
 */
const db = loadDatabase();
const { values } = resolve(db, 'canonical');
const env = buildEnvironment(values);
const solids = interiorSolids(env);

/** The Great Pyramid's interior, north to south and then bottom to top. */
const EXPECTED = [
  'passage.descending',
  'passage.subterranean_north',
  'chamber.subterranean',
  'passage.subterranean_south',
  'passage.ascending',
  'passage.queens_chamber',
  'qc',
  'gg',
  'antechamber',
  'kc',
];

/** A closed surface uses every directed edge once, and its neighbour uses the reverse. */
function unpairedEdges(mesh: Mesh): string[] {
  const seen = new Set<string>();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const a = mesh.indices[i + k] as number;
      const b = mesh.indices[i + ((k + 1) % 3)] as number;
      if (seen.has(`${a}>${b}`)) return [`used twice: ${a}>${b}`];
      seen.add(`${a}>${b}`);
    }
  }
  return [...seen].filter((key) => {
    const [a, b] = key.split('>');
    return !seen.has(`${b}>${a}`);
  });
}

describe('interiorSolids on the canonical preset', () => {
  it('builds every solid the preset carries the records for', () => {
    expect(Object.keys(solids)).toEqual(EXPECTED);
  });

  it('encloses a positive volume with every solid', () => {
    for (const [name, solid] of Object.entries(solids)) {
      expect(meshVolume(solid), `${name} volume`).toBeGreaterThan(0);
    }
  });

  it('closes every solid', () => {
    for (const [name, solid] of Object.entries(solids)) {
      expect(unpairedEdges(solid), `${name} edges`).toEqual([]);
    }
  });

  it("matches Petrie's King's Chamber dimensions to within 2 %", () => {
    const want = (values['kc.length'] as number) * (values['kc.width'] as number) * (values['kc.height'] as number);
    const got = meshVolume(solids['kc'] as Mesh);
    expect(Math.abs(got - want) / want).toBeLessThan(0.02);
  });

  it('slopes the descending passage at the measured angle', () => {
    const solid = solids['passage.descending'];
    if (!solid) throw new Error('the descending passage was skipped');
    const from = solid.landmarks['passage.descending.floor.begin'] as [number, number, number];
    const to = solid.landmarks['passage.descending.floor.end'] as [number, number, number];
    const run = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const slope = (Math.atan2(from[2] - to[2], run) * 180) / Math.PI;
    expect(slope).toBeCloseTo(values['passage.descending.angle'] as number, 1);
    expect(Math.abs(slope - (values['passage.descending.angle'] as number))).toBeLessThan(0.1);
  });

  it("puts the Queen's Chamber ridge on the Pyramid's east-west axis", () => {
    const ridge = solids['qc']?.landmarks['qc.ridge.mid'];
    if (!ridge) throw new Error('the Queen’s Chamber was skipped or has no ridge');
    expect(Math.abs(ridge[1])).toBeLessThan(0.1);
  });

  it('prefixes every landmark with the name of its solid', () => {
    for (const [name, solid] of Object.entries(solids)) {
      for (const key of Object.keys(solid.landmarks)) {
        expect(key.startsWith(`${name}.`), `${key} is not prefixed with ${name}`).toBe(true);
      }
    }
  });

  it('names only records that exist in the database', () => {
    const keys = new Set(db.measurements.map((m) => m.key));
    for (const [name, inputs] of Object.entries(INTERIOR_SOLID_INPUTS)) {
      expect(inputs.length, `${name} inputs`).toBeGreaterThan(0);
      for (const key of inputs) expect(keys.has(key), `${name} wants ${key}`).toBe(true);
    }
  });

  it('skips a solid whose inputs a preset does not carry, and keeps the rest', () => {
    const thin = { ...env };
    delete thin['kc.ceiling.up'];
    const built = interiorSolids(thin);
    expect(Object.keys(built)).toEqual(EXPECTED.filter((name) => name !== 'kc'));
  });
});

/**
 * Khafre and Menkaure, whose interiors are discovered from their records
 * rather than written out. Maragioglio and Rinaldi give Khafre's entrance a
 * level and an offset from the axis, his descending corridor a length and a
 * slope, and his crypt a floor and a south wall, which is enough for both.
 * Menkaure's chapter gives his descending corridor a length but no slope;
 * the slope is Perring's, in Vyse's Appendix table, and with it the corridor
 * builds from Petrie's entrance. No source yet gives a level for any of his
 * chambers, so nothing else of his is placed.
 */
describe('the discovered interiors on the canonical preset', () => {
  it("builds Khafre's entrance passage and his burial chamber", () => {
    expect(Object.keys(interiorSolids(env, { structure: 'g2' }))).toEqual([
      'g2.passage.descending',
      'g2.chamber.great',
    ]);
  });

  it("puts Khafre's entrance in the north face at the level Maragioglio and Rinaldi restore", () => {
    const point = interiorSolids(env, { structure: 'g2' })['g2.passage.descending']
      ?.landmarks['g2.passage.descending.floor.begin'] as number[];
    const [east, north, up] = point as [number, number, number];
    const half = env['g2.base.half'] as number;
    const angle = env['g2.face.angle'] as number;
    expect(up).toBeCloseTo(env['g2.entrance.floor.begin.up'] as number, 9);
    expect(east).toBeCloseTo(env['g2.entrance.floor.begin.east'] as number, 9);
    expect(north).toBeCloseTo(half - up / Math.tan((angle * Math.PI) / 180), 9);
    // Inside the base, and well north of the centre.
    expect(north).toBeGreaterThan(0);
    expect(north).toBeLessThan(half);
  });

  it("carries Khafre's descending corridor its recorded length down its recorded slope", () => {
    const solid = interiorSolids(env, { structure: 'g2' })['g2.passage.descending'];
    const [bx, by, bz] = solid?.landmarks['g2.passage.descending.floor.begin'] as [number, number, number];
    const [ex, ey, ez] = solid?.landmarks['g2.passage.descending.floor.end'] as [number, number, number];
    expect(Math.hypot(ex - bx, ey - by, ez - bz)).toBeCloseTo(env['g2.passage.descending.length'] as number, 6);
    // Due south, since no bearing is recorded for it, and falling.
    expect(ex).toBeCloseTo(bx, 6);
    expect(ey).toBeLessThan(by);
    expect(ez).toBeLessThan(0);
  });

  it("builds Menkaure's descending corridor from Petrie's entrance, Maragioglio and Rinaldi's length and Vyse's slope, and nothing else", () => {
    const built = interiorSolids(env, { structure: 'g3' });
    expect(Object.keys(built)).toEqual(['g3.passage.descending']);
    const solid = built['g3.passage.descending'];
    const [bx, by, bz] = solid?.landmarks['g3.passage.descending.floor.begin'] as [number, number, number];
    const [ex, ey, ez] = solid?.landmarks['g3.passage.descending.floor.end'] as [number, number, number];
    const half = env['g3.base.half'] as number;
    const angle = env['g3.face.angle'] as number;
    // The mouth: Petrie's centre of the entrance from the east side, Maragioglio and Rinaldi's sill, on the north face.
    expect(bz).toBeCloseTo(env['g3.entrance.floor.begin.up'] as number, 9);
    expect(bx).toBeCloseTo(half - (env['g3.entrance.floor.begin.from_east_side'] as number), 9);
    expect(by).toBeCloseTo(half - bz / Math.tan((angle * Math.PI) / 180), 9);
    // The run: the recorded length down the recorded slope, due south, ending under the base.
    expect(Math.hypot(ex - bx, ey - by, ez - bz)).toBeCloseTo(env['g3.passage.descending.length'] as number, 6);
    expect(ez - bz).toBeCloseTo((env['g3.passage.descending.length'] as number) * Math.sin(((env['g3.passage.descending.angle'] as number) * Math.PI) / 180), 6);
    expect(env['g3.passage.descending.angle']).toBeLessThan(0);
    expect(ex).toBeCloseTo(bx, 6);
    expect(ey).toBeLessThan(by);
    expect(ez).toBeLessThan(0);
  });
});
