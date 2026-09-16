import { describe, expect, it } from 'vitest';
import {
  INTERIOR_SOLID_INPUTS,
  buildEnvironment,
  constructionChamberLevels,
  interiorSolidInputs,
  interiorSolids,
  meshVolume,
  runEnd,
  wellRoute,
} from '@seked/geometry';
import type { Mesh, Point } from '@seked/geometry';
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
  'well',
  'chamber.construction_1',
  'chamber.construction_2',
  'chamber.construction_3',
  'chamber.construction_4',
  'chamber.construction_5',
  'void.north_face_corridor',
  'void.big.horizontal',
  'void.big.inclined',
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

  it("builds Menkaure's descending corridor from Petrie's entrance, Maragioglio and Rinaldi's length and Vyse's slope", () => {
    const built = interiorSolids(env, { structure: 'g3' });
    expect(Object.keys(built)).toEqual([
      'g3.passage.descending',
      'g3.passage.first_to_second',
      'g3.passage.foot',
      'g3.passage.portcullis',
      'g3.chamber.first',
      'g3.chamber.second',
    ]);
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
 * Menkaure's apartments are placed by walking them: the chain of distances in
 * Perring's table and Maragioglio and Rinaldi's text, laid end to end from
 * the entrance. Nothing on the way is a stored coordinate, so the checks are
 * what the chain has to agree with: the level Tav. 4 prints for the large
 * chamber's floor, and the doors it enters by.
 */
describe("Menkaure's route on the canonical preset", () => {
  const built = interiorSolids(env, { structure: 'g3' });
  const inputs = interiorSolidInputs(env, { structure: 'g3' });
  const bounds = (name: string) => {
    const p = built[name]?.positions as Float32Array;
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i++) {
      lo[i % 3] = Math.min(lo[i % 3] as number, p[i] as number);
      hi[i % 3] = Math.max(hi[i % 3] as number, p[i] as number);
    }
    return { lo, hi };
  };
  const v = (key: string) => env[key] as number;
  const floorBegin = (name: string) => built[name]?.landmarks[`${name}.floor.begin`] as [number, number, number];
  const floorEnd = (name: string) => built[name]?.landmarks[`${name}.floor.end`] as [number, number, number];

  it('lays each passage from where the member before it ends', () => {
    expect(floorBegin('g3.passage.foot')).toEqual(floorEnd('g3.passage.descending'));
    const first = bounds('g3.chamber.first');
    expect(floorBegin('g3.passage.portcullis')[1]).toBeCloseTo(first.lo[1] as number, 4);
    expect(floorBegin('g3.passage.first_to_second')).toEqual(floorEnd('g3.passage.portcullis'));
  });

  it('enters the antechamber on its north wall through Petrie\u2019s door, which leaves it symmetrical on the corridor', () => {
    const first = bounds('g3.chamber.first');
    const arrival = floorEnd('g3.passage.foot');
    expect(first.hi[1]).toBeCloseTo(arrival[1], 6);
    expect(first.lo[2]).toBeCloseTo(arrival[2], 6);
    // Maragioglio and Rinaldi, p. 39: the antechamber is "simmetrica" on the corridor.
    const middle = ((first.lo[0] as number) + (first.hi[0] as number)) / 2;
    expect(Math.abs(middle - arrival[0])).toBeLessThan(0.05);
  });

  it('puts the large chamber\u2019s floor within a quarter metre of the level Tav. 4 prints for it', () => {
    const second = bounds('g3.chamber.second');
    expect(Math.abs((second.lo[2] as number) - -v('g3.chamber.second.floor.depth'))).toBeLessThan(0.25);
  });

  it('keeps the large chamber\u2019s floor level with the mouth of the corridor into it, as p. 43 says', () => {
    expect(bounds('g3.chamber.second').lo[2]).toBeCloseTo(floorEnd('g3.passage.first_to_second')[2], 5);
  });

  it('never builds from the printed levels, which would make the check circular', () => {
    for (const keys of Object.values(inputs)) expect(keys.some((k) => k.endsWith('.floor.depth'))).toBe(false);
  });

  it('names the whole chain behind a routed chamber', () => {
    const keys = inputs['g3.chamber.second'] as readonly string[];
    for (const k of ['g3.entrance.floor.begin.up', 'g3.passage.descending.length', 'g3.passage.foot.length', 'g3.chamber.first.door.south.from_east_wall', 'g3.passage.portcullis.length', 'g3.passage.first_to_second.angle', 'g3.chamber.second.door.begin.from_east_wall']) {
      expect(keys, k).toContain(k);
    }
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

/**
 * The North Face Corridor is the first solid in the scene that nobody has
 * stood in. Its checks are about where it landed rather than what it
 * measures: the paper places it above the descending corridor, behind the
 * Chevron and just inside the north face, and none of those three is a record.
 */
describe('the voids the muons found, on the canonical preset', () => {
  const mesh = solids['void.north_face_corridor'] as Mesh;
  // The mesh is a Float32Array and the corridor stands ninety metres north of
  // the base centre, so four places is as close as single precision gets
  // there. The records themselves are good to a centimetre at best.

  const axis = (k: number) => {
    const all = mesh.positions.filter((_, i) => i % 3 === k);
    return { lo: Math.min(...all), hi: Math.max(...all) };
  };

  it('measures what Procureur and the others fitted', () => {
    const [east, north, up] = [axis(0), axis(1), axis(2)];
    expect(east.hi - east.lo).toBeCloseTo(values['void.north_face_corridor.length'] as number, 4);
    expect(north.hi - north.lo).toBeCloseTo(values['void.north_face_corridor.width'] as number, 4);
    expect(up.hi - up.lo).toBeCloseTo(values['void.north_face_corridor.height'] as number, 4);
  });

  it('centres it east and west on the descending corridor, as the paper states', () => {
    const east = axis(0);
    expect((east.lo + east.hi) / 2).toBeCloseTo(values['entrance.floor.begin.east'] as number, 4);
  });

  it('sets it back behind the north face by the distance measured to the Chevron', () => {
    const north = axis(1);
    const up = axis(2);
    const half = (values['g1.base.side.mean'] as number) / 2;
    const mid = (up.lo + up.hi) / 2;
    const face = half - mid / Math.tan(((values['g1.face.angle'] as number) * Math.PI) / 180);
    expect(face - north.hi).toBeCloseTo(values['void.north_face_corridor.from_north_face'] as number, 4);
  });

  it('puts it above the entrance and inside the stone, not out in the air', () => {
    const north = axis(1);
    const up = axis(2);
    // Above the entrance Petrie measured, and south of it, because the face
    // leans in going up.
    expect(up.lo).toBeGreaterThan(values['entrance.floor.begin.up'] as number);
    expect(north.hi).toBeLessThan(values['entrance.floor.begin.north'] as number);
    // And inside the pyramid at its own height: the face at the corridor's
    // deepest point is still north of its south end.
    const half = (values['g1.base.side.mean'] as number) / 2;
    expect(north.lo).toBeGreaterThan(-half);
  });

  it('draws it level, the measured slope having zero inside its error bar', () => {
    const slope = values['void.north_face_corridor.slope'] as number;
    const sigma = db.measurements.find((m) => m.key === 'void.north_face_corridor.slope')?.sigma as number;
    expect(Math.abs(slope)).toBeLessThan(sigma);
    const up = axis(2);
    const floors = mesh.positions.filter((_, i) => i % 3 === 2).filter((z) => z < (up.lo + up.hi) / 2);
    expect(Math.max(...floors) - Math.min(...floors)).toBe(0);
  });
});

/**
 * The Big Void is the one solid here whose place appears nowhere in its source
 * as a number. The 2017 paper states four things about it and no coordinates,
 * and the checks below are that those four are what the solid was built from
 * and that what comes out is where the paper says it is: above the Grand
 * Gallery, a section like the Gallery's, and the published distance from the
 * Queen's Chamber floor.
 */
describe('the Big Void on the canonical preset', () => {
  const span = (name: string, k: number) => {
    const mesh = solids[name] as Mesh;
    const all = mesh.positions.filter((_, i) => i % 3 === k);
    return { lo: Math.min(...all), hi: Math.max(...all) };
  };
  const centre = (name: string, k: number) => {
    const { lo, hi } = span(name, k);
    return (lo + hi) / 2;
  };
  const both = ['void.big.horizontal', 'void.big.inclined'];

  it('draws both hypotheses, the paper having resolved neither', () => {
    for (const name of both) expect(solids[name], name).toBeDefined();
    expect(values['void.big.inclination.hypotheses']).toBe(both.length);
  });

  it('puts them on one centre, the hypotheses differing in lie and not in place', () => {
    for (const k of [0, 1, 2]) {
      expect(centre(both[0] as string, k)).toBeCloseTo(centre(both[1] as string, k), 4);
    }
  });

  it('stands that centre the published distance from the Queen’s Chamber floor', () => {
    const near = values['void.big.centre.from_queens_chamber_floor.min'] as number;
    const far = values['void.big.centre.from_queens_chamber_floor.max'] as number;
    const floor = [
      (values['qc.corner.ne.east'] as number) - (values['qc.length'] as number) / 2,
      (values['qc.corner.ne.north'] as number) - (values['qc.width'] as number) / 2,
      values['qc.corner.ne.up'] as number,
    ];
    for (const name of both) {
      const d = Math.hypot(
        centre(name, 0) - (floor[0] as number),
        centre(name, 1) - (floor[1] as number),
        centre(name, 2) - (floor[2] as number),
      );
      expect(d, name).toBeCloseTo((near + far) / 2, 3);
      expect(d).toBeGreaterThan(near);
      expect(d).toBeLessThan(far);
    }
  });

  it('puts it above the Grand Gallery, which is the other thing the paper says', () => {
    const roof = (values['gg.floor.virtual_south_end.up'] as number) + (values['gg.height'] as number);
    // Both hypotheses have their whole length over the Gallery's roof, the
    // inclined one only just, its lower end running close above it.
    for (const name of both) expect(span(name, 2).lo, name).toBeGreaterThanOrEqual(roof - 1);
    // And the level one clears it outright.
    expect(span('void.big.horizontal', 2).lo).toBeGreaterThan(roof);
  });

  it('gives it the Grand Gallery’s own section and the stated minimum length', () => {
    // Volume rather than a bounding box: a tube's volume is its section times
    // its length whichever way it lies, and a bounding box would also be
    // measuring the east and west drift the Grand Gallery's own axis has.
    const width = (values['gg.floor.width'] as number) + 2 * (values['gg.ramp.width'] as number);
    const want = width * (values['gg.height'] as number) * (values['void.big.length.min'] as number);
    for (const name of both) {
      expect(meshVolume(solids[name] as Mesh), name).toBeCloseTo(want, 2);
    }
    // And the level one runs due north and south, so its plan length is the
    // whole of it.
    const north = span('void.big.horizontal', 1);
    expect(north.hi - north.lo).toBeCloseTo(values['void.big.length.min'] as number, 4);
  });

  it('lays the inclined one along the Grand Gallery’s slope and the other level', () => {
    const flat = span('void.big.horizontal', 2);
    expect(flat.hi - flat.lo).toBeCloseTo(values['gg.height'] as number, 4);
    // The sloping one is taller in elevation than its own section, by exactly
    // as much as a 30 m run at the Gallery's angle rises.
    const slope = span('void.big.inclined', 2);
    const rise = (values['void.big.length.min'] as number) * Math.sin(((values['gg.angle'] as number) * Math.PI) / 180);
    expect(slope.hi - slope.lo).toBeGreaterThan(flat.hi - flat.lo);
    expect(slope.hi - slope.lo).toBeCloseTo(rise + (values['gg.height'] as number) * Math.cos(((values['gg.angle'] as number) * Math.PI) / 180), 1);
  });

  it('names nothing it was not given, and no coordinate, because the paper states none', () => {
    const inputs = interiorSolidInputs(env)['void.big.horizontal'] as readonly string[];
    expect(inputs).toContain('void.big.length.min');
    expect(inputs).toContain('void.big.centre.from_queens_chamber_floor.min');
    expect(inputs).toContain('void.big.centre.from_queens_chamber_floor.max');
    expect(inputs.some((k) => k.startsWith('void.big.centre.north') || k.startsWith('void.big.centre.up'))).toBe(false);
    // Everything else it uses belongs to the Gallery or the Queen's Chamber.
    for (const key of inputs) {
      expect(key.startsWith('void.big.') || key.startsWith('gg.') || key.startsWith('qc.') || key.startsWith('passage.ascending.'), key).toBe(true);
    }
  });
});

/**
 * The Grand Gallery's corbelling, which is the one solid in the Great Pyramid
 * whose shape changed when a column of Petrie's was finally entered rather
 * than when a room was added. Section 46's "High on S. End" column gives a lap
 * 33.0 to 34.0 in, and what seven of those leave under them is the vertical
 * wall the corbelling stands on. Before the column was entered the steps were
 * spread evenly over the gallery's height, which made the wall vanish and
 * every lap half as tall again as Petrie measured.
 */
describe('the Grand Gallery on the canonical preset', () => {
  const laps = Math.round(values['gg.corbel.count'] as number);
  const lap = values['gg.corbel.height'] as number;
  const height = values['gg.height'] as number;
  const overhang = values['gg.ramp.width'] as number;
  const halfFloor = (values['gg.floor.width'] as number) / 2 + overhang;

  it('leaves a vertical wall under the laps, and it is a wall and not a rounding', () => {
    const wall = height - laps * lap;
    expect(wall).toBeGreaterThan(2);
    expect(wall).toBeLessThan(height / 2);
  });

  it('builds the section out of that wall and seven measured laps', () => {
    // The gallery is one straight extrusion, so its volume is its section's
    // area times its run. The area is checked against the bands the records
    // describe rather than against a number written down here.
    const axis = (key: string, a: string) => values[`${key}.${a}`] as number;
    const run = Math.hypot(
      axis('gg.floor.virtual_south_end', 'east') - axis('passage.ascending.floor.end', 'east'),
      axis('gg.floor.virtual_south_end', 'north') - axis('passage.ascending.floor.end', 'north'),
      axis('gg.floor.virtual_south_end', 'up') - axis('passage.ascending.floor.end', 'up'),
    );

    let area = 2 * halfFloor * (height - laps * lap);
    for (let i = 1; i <= laps; i++) area += 2 * (halfFloor - (i * overhang) / laps) * lap;
    expect(meshVolume(solids['gg'] as Mesh)).toBeCloseTo(area * run, 2);
  });

  it('narrows to a roof as wide as the floor between the ramps, which is what Petrie says it is', () => {
    // "the space between the ramps (2 cubits), is equal to the space between
    // the walls at the top", section 46.
    expect(2 * (halfFloor - overhang)).toBeCloseTo(values['gg.floor.width'] as number, 9);
    expect(values['gg.roof.width']).toBeCloseTo(values['gg.floor.width'] as number, 9);
  });

  it('puts Smyth\u2019s third lap within a sixth of a metre of where section 46 quotes it', () => {
    // The laps are stacked from the measured heights; Smyth's 166.2 in for the
    // third lap is an independent figure and was not used to build anything.
    // That the two land this close is the check on the whole arrangement.
    const third = height - laps * lap + 2 * lap;
    expect(Math.abs(third - (values['gg.corbel.third.height'] as number))).toBeLessThan(0.17);
  });

  it('names the lap height among its inputs now that a preset carries it', () => {
    expect(interiorSolidInputs(env)['gg']).toContain('gg.corbel.height');
  });
});

/**
 * Gantenbrink measured where the King's Chamber shafts come out on the face,
 * and this project does not build from those figures: the last leg of a shaft
 * runs until it meets the face and the level it arrives at is a result. So the
 * two can be compared, and the comparison is the only end-to-end check the
 * shafts have.
 *
 * One of the four numbers agrees and three do not, and both facts are recorded
 * here rather than only the flattering one. What agrees is the southern
 * shaft's position east, and it agrees because the inlet it starts from
 * stopped being an estimate: the middle of the chamber wall was 2.75 m out,
 * and Gantenbrink's measured inlet puts the computed outlet within 0.16 m of
 * his measured outlet, which is about the half shaft-width his east-wall
 * convention costs. What does not agree is the northern shaft's position,
 * whose westward dog-leg round the Grand Gallery is still two estimates, and
 * both outlet heights, which are high because the legs below the final run are
 * estimates too and because he measured on the present core face while the
 * scene runs to the casing.
 */
describe('the shafts against Gantenbrink\u2019s measured outlets', () => {
  const top = (name: string, k: number) => {
    const mesh = solids[name] as Mesh;
    return Math.max(...mesh.positions.filter((_, i) => i % 3 === k));
  };

  it('brings the southern shaft out where he measured it, east and west', () => {
    const measured = values['kc.shaft.south.outlet.east'] as number;
    expect(Math.abs(top('kc.shaft.south', 0) - measured)).toBeLessThan(0.3);
  });

  it('does not yet bring the northern shaft out where he measured it, its bend being estimated', () => {
    // Held as a fact about the model, not an aspiration: segment 2's length and
    // bearing are both seked-estimate, and until they are measured or solved
    // this shaft cannot land on his figure. If this ever starts passing at a
    // tight tolerance, the estimates have been replaced and the test should be
    // turned round to say so.
    const measured = values['kc.shaft.north.outlet.east'] as number;
    expect(Math.abs(top('kc.shaft.north', 0) - measured)).toBeGreaterThan(1);
  });

  it('runs both shafts out above the level he measured, because it runs them to the casing', () => {
    // He measured "excluding the missing casing", so on the present core face;
    // the scene runs the last leg until it meets the as-built casing, which is
    // further out and therefore higher. Part of the gap is that, and part is
    // the estimated legs below. Bounded so a change either way is noticed.
    for (const side of ['south', 'north']) {
      const gap = top(`kc.shaft.${side}`, 2) - (values[`kc.shaft.${side}.outlet.up`] as number);
      expect(gap, side).toBeGreaterThan(0);
      expect(gap, side).toBeLessThan(4);
    }
  });

  it('never builds a shaft from an outlet record, which would make the check circular', () => {
    for (const side of ['south', 'north']) {
      const inputs = interiorSolidInputs(env)[`kc.shaft.${side}`] as readonly string[];
      expect(inputs.some((k) => k.includes('.outlet.')), side).toBe(false);
    }
  });
});

describe('the well against the plates it is read from', () => {
  const route = wellRoute(env);
  const v = (key: string) => values[key] as number;
  const sigma = (key: string) => db.measurements.find((m) => m.key === key)?.sigma as number;
  const legEnd = (k: number) => route.segments.slice(0, k).reduce<Point>((at, s) => runEnd(at, s.length as number, s.angleDeg, s.directionDeg), route.inlet);

  it('starts under Petrie\u2019s mouth, west of the gallery by the plates\u2019 227 cm, at the Queen\u2019s Chamber floor', () => {
    expect(route.inlet[0]).toBeCloseTo(v('passage.ascending.floor.end.east') - 2.27, 9);
    expect(route.inlet[1]).toBeCloseTo(v('passage.ascending.floor.end.north') - v('well.mouth.from_gallery_north_wall'), 9);
    expect(route.inlet[2]).toBeCloseTo(v('qc.corner.ne.up'), 9);
  });

  it('ends its last leg exactly on the outlet, which is on the descending passage\u2019s west wall', () => {
    const end = legEnd(5);
    for (let i = 0; i < 3; i++) expect(end[i]).toBeCloseTo(route.outlet[i] as number, 9);
    expect(route.outlet[0]).toBeCloseTo(v('passage.descending.floor.end.east') - v('passage.descending.width') / 2, 1);
  });

  it('solves a last leg within a quarter metre of the length the plates print', () => {
    const solved = route.segments[4]?.length as number;
    expect(Math.abs(solved - v('well.segment.5.length'))).toBeLessThan(0.25);
  });

  it('misses the printed last leg in the north-south section by less than the scaled angles allow', () => {
    // The plates' own last leg, 9.50 m at 75 deg laid south from the fourth
    // leg's end, lands this far from the outlet in the section's plane. The
    // allowance is what the two scaled angles' sigmas swing their legs'
    // ends through, plus the half metre the two plates disagree on for where
    // the first leg starts. The east-west part of the miss is not in the
    // section at all, and is what the solved leg's bearing takes up.
    const at = legEnd(4);
    const printed = runEnd(at, v('well.segment.5.length'), v('well.segment.5.angle'), 180);
    const miss = Math.hypot(printed[1] - route.outlet[1], printed[2] - route.outlet[2]);
    const rad = Math.PI / 180;
    const allowance = v('well.segment.2.length') * sigma('well.segment.2.angle') * rad
      + v('well.segment.4.length') * sigma('well.segment.4.angle') * rad + 0.5;
    expect(miss).toBeGreaterThan(0.5);
    expect(miss).toBeLessThan(allowance);
  });

  it('never builds the well from the last leg\u2019s printed figures, which would make the check circular', () => {
    const inputs = interiorSolidInputs(env).well as readonly string[];
    expect(inputs).not.toContain('well.segment.5.length');
    expect(inputs).not.toContain('well.segment.5.angle');
  });
});
