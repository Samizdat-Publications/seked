import { describe, expect, it } from 'vitest';
import {
  INTERIOR_SOLID_INPUTS,
  buildEnvironment,
  constructionChamberLevels,
  interiorSolidInputs,
  interiorSolids,
  meshVolume,
} from '@seked/geometry';
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
  'kc.shaft.north',
  'kc.shaft.south',
  'qc.shaft.north',
  'qc.shaft.south',
  'chamber.construction_1',
  'chamber.construction_2',
  'chamber.construction_3',
  'chamber.construction_4',
  'chamber.construction_5',
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
    // The chambers of construction go with it: they stand on the King's
    // Chamber roof, and the closing figure is measured from its floor, so
    // without the ceiling there is nothing to take their own heights out of.
    const gone = (name: string) => name === 'kc' || name.startsWith('chamber.construction_');
    expect(Object.keys(built)).toEqual(EXPECTED.filter((name) => !gone(name)));
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

/**
 * The chambers of construction are the one part of the Great Pyramid whose
 * levels are solved rather than stored, so they get their own checks: that the
 * solve closes on the figure it was solved against, that the floors it invents
 * are a thickness a granite beam could be, and that Vyse and Petrie agree
 * about the plan of the chambers they both reached.
 */
describe('the chambers of construction on the canonical preset', () => {
  const stack = constructionChamberLevels(env);
  const inches = (metres: number) => metres / 0.0254;

  it('lands the top of Campbell’s on the height Vyse measured to it', () => {
    expect(stack).toBeDefined();
    const apex = (stack as NonNullable<typeof stack>).chambers[4] as { floor: number; ridge?: number };
    const above = apex.floor + (apex.ridge as number) - (values['kc.floor.elevation'] as number);
    expect(inches(above)).toBeCloseTo(69 * 12 + 3, 6);
  });

  it('shares what is left over into five floors a granite beam could be', () => {
    // Petrie calls the flooring beams "very unequal in depth" and no source
    // measures one, so the even share is the assumption. What it must not be
    // is absurd: a metre and a half to two and a half is the range the beams
    // over the King’s Chamber are drawn at.
    const slab = (stack as NonNullable<typeof stack>).slab;
    expect(slab).toBeGreaterThan(1.5);
    expect(slab).toBeLessThan(2.5);
  });

  it('stacks the five without a gap or an overlap', () => {
    const chambers = (stack as NonNullable<typeof stack>).chambers;
    const slab = (stack as NonNullable<typeof stack>).slab;
    let below = values['kc.ceiling.up'] as number;
    for (const room of chambers) {
      expect(room.floor - below).toBeCloseTo(slab, 9);
      below = room.floor + (room.ridge ?? room.top - room.floor);
    }
  });

  it('roofs only Campbell’s with a gable, on the east-west ridge its slabs need', () => {
    const chambers = (stack as NonNullable<typeof stack>).chambers;
    expect(chambers.slice(0, 4).every((room) => room.ridge === undefined)).toBe(true);
    const top = chambers[4] as { floor: number; top: number; ridge?: number };
    expect(top.ridge).toBeGreaterThan(top.top - top.floor);
    // The ridge runs east and west, so the solid is longer east to west than
    // it is north to south, which is what puts the gable on that axis.
    const mesh = solids['chamber.construction_5'] as Mesh;
    const xs = mesh.positions.filter((_, i) => i % 3 === 0);
    const ys = mesh.positions.filter((_, i) => i % 3 === 1);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(Math.max(...ys) - Math.min(...ys));
  });

  it('takes the plan from Petrie’s walls where he reached them and from Vyse where he did not', () => {
    // Davison’s: Petrie measured all four walls, so none of Vyse’s four
    // figures for it is used, and the two surveys agree to about four inches.
    const inputs = interiorSolidInputs(env)['chamber.construction_1'] as readonly string[];
    expect(inputs).toContain('chamber.construction_1.length.north');
    expect(inputs).not.toContain('chamber.construction_1.length');
    const petrie = ((values['chamber.construction_1.length.north'] as number)
      + (values['chamber.construction_1.length.south'] as number)) / 2;
    expect(Math.abs(inches(petrie) - (38 * 12 + 4))) .toBeLessThan(5);

    // Campbell’s: Petrie could only reach its south wall, and its width he
    // says is "quite undefined", so its width is Vyse’s whole figure.
    const top = interiorSolidInputs(env)['chamber.construction_5'] as readonly string[];
    expect(top).toContain('chamber.construction_5.length.south');
    expect(top).toContain('chamber.construction_5.width');
    expect(top).not.toContain('chamber.construction_5.width.east');
  });

  it('stands the whole stack clear of the King’s Chamber and inside the Pyramid', () => {
    const chambers = (stack as NonNullable<typeof stack>).chambers;
    expect((chambers[0] as { floor: number }).floor).toBeGreaterThan(values['kc.ceiling.up'] as number);
    const apex = chambers[4] as { floor: number; ridge?: number };
    expect(apex.floor + (apex.ridge as number)).toBeLessThan(values['g1.height.original'] as number);
  });
});
