import { describe, expect, it } from 'vitest';
import { buildEnvironment } from './environment';
import {
  INTERIOR_SOLID_INPUTS,
  interiorKeyPrefix,
  interiorSolidInputs,
  interiorSolids,
  interiorStructures,
} from './interiors';
import type { Mesh } from './mesh';
import { meshVolume } from './mesh';

/**
 * The Great Pyramid's interior is tested against the real database in
 * packages/data, where a preset can be resolved. What is tested here is the
 * other half: that a structure whose records simply exist, under its own id,
 * builds without a line of code naming its rooms.
 *
 * The pyramid below is invented. Its numbers are round so the volumes can be
 * worked out by hand, and it is called g2 only because `buildEnvironment`
 * derives `g2.base.half` for it, which is what `from_north_base` is converted
 * with. Nothing here is a measurement of Khafre's.
 */
const SYNTHETIC: Record<string, number> = {
  'g2.base.side.mean': 200,
  'g2.height.original': 120,

  // An entrance in the north face, 20 m south of the north base edge, so 80 m
  // north of the base centre once the half-base is taken off.
  'g2.entrance.floor.begin.from_north_base': 20,
  'g2.entrance.floor.begin.east': 5,
  'g2.entrance.floor.begin.up': 30,

  // A descending passage with no floor.begin of its own: it starts at the
  // entrance, as G1's does.
  'g2.passage.descending.floor.end.north': 0,
  'g2.passage.descending.floor.end.east': 5,
  'g2.passage.descending.floor.end.up': 0,
  'g2.passage.descending.width': 1,
  'g2.passage.descending.height': 2,
  'g2.passage.descending.angle': 20.556,

  // A level passage carrying on to the chamber's north wall.
  'g2.passage.horizontal.floor.begin.north': 0,
  'g2.passage.horizontal.floor.begin.east': 5,
  'g2.passage.horizontal.floor.begin.up': 0,
  'g2.passage.horizontal.floor.end.north': -20,
  'g2.passage.horizontal.floor.end.east': 5,
  'g2.passage.horizontal.floor.end.up': 0,
  'g2.passage.horizontal.width': 1,
  'g2.passage.horizontal.height': 2,

  // One chamber, 12 m east to west by 6 m north to south, walls 5 m high.
  'g2.chamber.burial.wall.north.north': -20,
  'g2.chamber.burial.wall.south.north': -26,
  'g2.chamber.burial.wall.east.east': 11,
  'g2.chamber.burial.wall.west.east': -1,
  'g2.chamber.burial.floor.up': 0,
  'g2.chamber.burial.ceiling.up': 5,
};

const env = buildEnvironment(SYNTHETIC);
const g2 = { structure: 'g2' };

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

function without(...keys: string[]): Record<string, number> {
  const thin = { ...SYNTHETIC };
  for (const key of keys) delete thin[key];
  return buildEnvironment(thin);
}

describe('interiorKeyPrefix', () => {
  it('leaves the Great Pyramid unprefixed and gives every other structure its id', () => {
    expect(interiorKeyPrefix('g1')).toBe('');
    expect(interiorKeyPrefix('g2')).toBe('g2.');
    expect(interiorKeyPrefix('g3')).toBe('g3.');
  });
});

describe('interiorSolids on a structure discovered from its records', () => {
  const solids = interiorSolids(env, g2);

  it('finds the passages and the chamber without being told the plan', () => {
    expect(Object.keys(solids)).toEqual([
      'g2.passage.descending',
      'g2.passage.horizontal',
      'g2.chamber.burial',
    ]);
  });

  it('reads a north coordinate given as a distance south of the north base edge', () => {
    // 20 m south of a north base edge 100 m from the centre is y = +80.
    const begin = solids['g2.passage.descending']?.landmarks['g2.passage.descending.floor.begin'];
    expect(begin).toEqual([5, 80, 30]);
  });

  it('starts a descending passage that records no beginning at the entrance', () => {
    const end = solids['g2.passage.descending']?.landmarks['g2.passage.descending.floor.end'];
    expect(end).toEqual([5, 0, 0]);
  });

  it('encloses the volume its section and its run come to', () => {
    // Heights are perpendicular to the floor, so a passage is its section area
    // times the slant length: 1 x 2 over sqrt(80^2 + 30^2).
    expect(meshVolume(solids['g2.passage.descending'] as Mesh)).toBeCloseTo(2 * Math.hypot(80, 30), 2);
    expect(meshVolume(solids['g2.passage.horizontal'] as Mesh)).toBeCloseTo(40, 2);
    expect(meshVolume(solids['g2.chamber.burial'] as Mesh)).toBeCloseTo(12 * 6 * 5, 2);
  });

  it('closes every solid', () => {
    for (const [name, solid] of Object.entries(solids)) {
      expect(unpairedEdges(solid), `${name} edges`).toEqual([]);
    }
  });

  it('prefixes every landmark with the name of its solid', () => {
    for (const [name, solid] of Object.entries(solids)) {
      for (const key of Object.keys(solid.landmarks)) {
        expect(key.startsWith(`${name}.`), `${key} is not prefixed with ${name}`).toBe(true);
      }
    }
  });

  it('names the records each solid was built from, the recorded slope included', () => {
    const inputs = interiorSolidInputs(env, g2);
    expect(inputs['g2.passage.descending']).toEqual([
      'g2.entrance.floor.begin.from_north_base',
      'g2.entrance.floor.begin.east',
      'g2.entrance.floor.begin.up',
      'g2.passage.descending.floor.end.north',
      'g2.passage.descending.floor.end.east',
      'g2.passage.descending.floor.end.up',
      'g2.passage.descending.width',
      'g2.passage.descending.height',
      'g2.passage.descending.angle',
    ]);
    expect(inputs['g2.chamber.burial']).toEqual([
      'g2.chamber.burial.wall.north.north',
      'g2.chamber.burial.wall.south.north',
      'g2.chamber.burial.wall.east.east',
      'g2.chamber.burial.wall.west.east',
      'g2.chamber.burial.floor.up',
      'g2.chamber.burial.ceiling.up',
    ]);
    for (const keys of Object.values(inputs)) {
      for (const key of keys) expect(Number.isFinite(env[key]), `${key} is in the environment`).toBe(true);
    }
  });

  it('skips an incomplete solid and keeps the rest', () => {
    expect(Object.keys(interiorSolids(without('g2.passage.horizontal.width'), g2))).toEqual([
      'g2.passage.descending',
      'g2.chamber.burial',
    ]);
    expect(Object.keys(interiorSolids(without('g2.chamber.burial.ceiling.up'), g2))).toEqual([
      'g2.passage.descending',
      'g2.passage.horizontal',
    ]);
    // Without the half-base there is nothing to convert from_north_base with,
    // so the entrance is unknown and the descending passage goes with it.
    expect(Object.keys(interiorSolids(without('g2.base.side.mean'), g2))).toEqual([
      'g2.passage.horizontal',
      'g2.chamber.burial',
    ]);
  });

  it('skips a passage whose two ends are the same point', () => {
    const flat = { ...SYNTHETIC, 'g2.passage.horizontal.floor.end.north': 0 };
    expect(Object.keys(interiorSolids(buildEnvironment(flat), g2))).not.toContain('g2.passage.horizontal');
  });
});

/**
 * The second way a passage arrives. A survey that could reach both ends
 * leaves two points; a published plan states where the passage begins, how
 * long its floor is and how steeply it falls, and the far end is worked out
 * rather than written down. The pyramid below is invented and its numbers are
 * round; nothing here is a measurement of anything.
 */
describe('a passage recorded as a length along its floor and a slope', () => {
  const RUN: Record<string, number> = {
    'g3.base.side.mean': 200,
    'g3.height.original': 120,

    // A descending passage with no floor.end: 100 m of floor falling 30
    // degrees from a beginning 60 m above the base, taking the default
    // bearing. Due south of a beginning at y = +80 that lands at
    // y = 80 - 100 cos 30 and z = 60 - 100 sin 30.
    'g3.entrance.floor.begin.north': 80,
    'g3.entrance.floor.begin.east': 0,
    'g3.entrance.floor.begin.up': 60,
    'g3.passage.descending.length': 100,
    'g3.passage.descending.angle': -30,
    'g3.passage.descending.width': 1,
    'g3.passage.descending.height': 2,

    // A level passage with a recorded bearing, running due east instead.
    'g3.passage.side.floor.begin.north': 0,
    'g3.passage.side.floor.begin.east': 0,
    'g3.passage.side.floor.begin.up': 10,
    'g3.passage.side.length': 40,
    'g3.passage.side.angle': 0,
    'g3.passage.side.direction': 90,
    'g3.passage.side.width': 1,
    'g3.passage.side.height': 2,
  };
  const run = buildEnvironment(RUN);
  const g3 = { structure: 'g3' };

  it('lays the far end out due south and down the slope', () => {
    const end = interiorSolids(run, g3)['g3.passage.descending']?.landmarks['g3.passage.descending.floor.end'];
    expect(end?.[0]).toBeCloseTo(0, 9);
    expect(end?.[1]).toBeCloseTo(80 - 100 * Math.cos(Math.PI / 6), 9);
    expect(end?.[2]).toBeCloseTo(60 - 100 * 0.5, 9);
  });

  it('follows a recorded bearing when there is one', () => {
    const end = interiorSolids(run, g3)['g3.passage.side']?.landmarks['g3.passage.side.floor.end'];
    expect(end?.[0]).toBeCloseTo(40, 9);
    expect(end?.[1]).toBeCloseTo(0, 9);
    expect(end?.[2]).toBeCloseTo(10, 9);
  });

  it('encloses the section times the length, the length being along the floor', () => {
    expect(meshVolume(interiorSolids(run, g3)['g3.passage.descending'] as Mesh)).toBeCloseTo(2 * 100, 3);
    expect(meshVolume(interiorSolids(run, g3)['g3.passage.side'] as Mesh)).toBeCloseTo(2 * 40, 3);
  });

  it('names the length, the slope and the bearing among the records it used', () => {
    const inputs = interiorSolidInputs(run, g3);
    expect(inputs['g3.passage.descending']).toEqual([
      'g3.entrance.floor.begin.north',
      'g3.entrance.floor.begin.east',
      'g3.entrance.floor.begin.up',
      'g3.passage.descending.length',
      'g3.passage.descending.angle',
      'g3.passage.descending.width',
      'g3.passage.descending.height',
    ]);
    expect(inputs['g3.passage.side']).toEqual([
      'g3.passage.side.floor.begin.north',
      'g3.passage.side.floor.begin.east',
      'g3.passage.side.floor.begin.up',
      'g3.passage.side.length',
      'g3.passage.side.angle',
      'g3.passage.side.direction',
      'g3.passage.side.width',
      'g3.passage.side.height',
    ]);
  });

  it('prefers the two measured ends when the database carries them', () => {
    const both = buildEnvironment({
      ...RUN,
      'g3.passage.side.floor.end.north': 0,
      'g3.passage.side.floor.end.east': -25,
      'g3.passage.side.floor.end.up': 10,
    });
    const end = interiorSolids(both, g3)['g3.passage.side']?.landmarks['g3.passage.side.floor.end'];
    expect(end).toEqual([-25, 0, 10]);
    // The slope falls back to provenance, and the length and bearing are not
    // read at all, because nothing was computed from them.
    expect(interiorSolidInputs(both, g3)['g3.passage.side']).toEqual([
      'g3.passage.side.floor.begin.north',
      'g3.passage.side.floor.begin.east',
      'g3.passage.side.floor.begin.up',
      'g3.passage.side.floor.end.north',
      'g3.passage.side.floor.end.east',
      'g3.passage.side.floor.end.up',
      'g3.passage.side.width',
      'g3.passage.side.height',
      'g3.passage.side.angle',
    ]);
  });

  it('skips a passage that records a slope but no length', () => {
    const thin = { ...RUN };
    delete thin['g3.passage.descending.length'];
    expect(Object.keys(interiorSolids(buildEnvironment(thin), g3))).toEqual(['g3.passage.side']);
  });

  it('skips a passage whose recorded length is zero', () => {
    const flat = buildEnvironment({ ...RUN, 'g3.passage.side.length': 0 });
    expect(Object.keys(interiorSolids(flat, g3))).toEqual(['g3.passage.descending']);
  });
});

/**
 * An entrance that records its level and its offset from the axis but not how
 * far south of the base edge it stands. It is in the north face, and the face
 * is a plane, so the setback is the face's own geometry. The pyramid below is
 * invented: a 200 m base and a 50 degree face, chosen so the arithmetic can be
 * followed by eye.
 */
describe('an entrance placed on the north face', () => {
  const FACE: Record<string, number> = {
    'g2.base.side.mean': 200,
    'g2.height.original': 120,
    'g2.face.angle': 50,

    'g2.entrance.floor.begin.east': 3,
    'g2.entrance.floor.begin.up': 10,
    'g2.passage.descending.length': 50,
    'g2.passage.descending.angle': -26,
    'g2.passage.descending.width': 1,
    'g2.passage.descending.height': 2,
  };
  const face = buildEnvironment(FACE);
  const g2face = { structure: 'g2' };
  const setback = 100 - 10 / Math.tan((50 * Math.PI) / 180);

  it('stands the entrance back from the base edge by its height over the face slope', () => {
    const begin = interiorSolids(face, g2face)['g2.passage.descending']?.landmarks['g2.passage.descending.floor.begin'];
    expect(begin?.[0]).toBeCloseTo(3, 9);
    expect(begin?.[1]).toBeCloseTo(setback, 9);
    expect(begin?.[2]).toBeCloseTo(10, 9);
  });

  it('names the face angle as the record that placed it', () => {
    expect(interiorSolidInputs(face, g2face)['g2.passage.descending']).toEqual([
      'g2.face.angle',
      'g2.entrance.floor.begin.east',
      'g2.entrance.floor.begin.up',
      'g2.passage.descending.length',
      'g2.passage.descending.angle',
      'g2.passage.descending.width',
      'g2.passage.descending.height',
    ]);
  });

  it('prefers a recorded north coordinate over the face', () => {
    const recorded = buildEnvironment({ ...FACE, 'g2.entrance.floor.begin.from_north_base': 4 });
    const begin = interiorSolids(recorded, g2face)['g2.passage.descending']?.landmarks['g2.passage.descending.floor.begin'];
    expect(begin?.[1]).toBeCloseTo(96, 9);
    expect(interiorSolidInputs(recorded, g2face)['g2.passage.descending']?.[0]).toBe('g2.entrance.floor.begin.from_north_base');
  });

  it('leaves the passage unbuilt when the preset carries no face angle', () => {
    const angleless = { ...FACE };
    delete angleless['g2.face.angle'];
    expect(Object.keys(interiorSolids(buildEnvironment(angleless), g2face))).toEqual([]);
  });

  it('leaves it unbuilt when there is no base to halve either', () => {
    const baseless = { ...FACE };
    delete baseless['g2.base.side.mean'];
    expect(Object.keys(interiorSolids(buildEnvironment(baseless), g2face))).toEqual([]);
  });
});

describe('a discovered chamber roof', () => {
  const gabled = (ridgeHeight: number): Record<string, number> =>
    buildEnvironment({ ...SYNTHETIC, 'g2.chamber.burial.gable.height': ridgeHeight });

  it('pitches the ridge along the chambers longer horizontal axis', () => {
    const solid = interiorSolids(gabled(8), g2)['g2.chamber.burial'];
    expect(solid?.landmarks['g2.chamber.burial.ridge.mid']).toEqual([5, -23, 8]);
    // The box plus a prism of the same plan, half as tall as the pitch.
    expect(meshVolume(solid as Mesh)).toBeCloseTo(12 * 6 * 5 + (12 * 6 * 3) / 2, 2);
  });

  it('turns the ridge the other way when the chamber is longer north to south', () => {
    const deep = buildEnvironment({
      ...SYNTHETIC,
      'g2.chamber.burial.wall.south.north': -40,
      'g2.chamber.burial.gable.height': 8,
    });
    const solid = interiorSolids(deep, g2)['g2.chamber.burial'];
    expect(solid?.landmarks['g2.chamber.burial.ridge.mid']).toEqual([5, -30, 8]);
    expect(meshVolume(solid as Mesh)).toBeCloseTo(12 * 20 * 5 + (12 * 20 * 3) / 2, 1);
  });

  it('is flat when the recorded ridge does not clear the wall tops', () => {
    const solid = interiorSolids(gabled(5), g2)['g2.chamber.burial'];
    expect(solid?.landmarks['g2.chamber.burial.ridge.mid']).toBeUndefined();
    expect(interiorSolidInputs(gabled(5), g2)['g2.chamber.burial']).not.toContain('g2.chamber.burial.gable.height');
  });
});

describe('the Great Pyramid stays hand-written', () => {
  it('reads none of another structure records', () => {
    expect(interiorSolids(env)).toEqual({});
    expect(interiorSolids(env, { structure: 'g1' })).toEqual({});
  });

  it('keeps its own list of inputs whether or not a preset carries them', () => {
    expect(Object.keys(INTERIOR_SOLID_INPUTS)).toEqual([
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
    ]);
    // A room's inputs are fixed; a shaft's start with the fixed ones and go
    // on with however many legs the environment carries.
    const inputs = interiorSolidInputs(env);
    for (const [name, fixed] of Object.entries(INTERIOR_SOLID_INPUTS)) {
      if (name.includes('.shaft.')) expect(inputs[name]?.slice(0, fixed.length)).toEqual(fixed);
      else expect(inputs[name]).toEqual(fixed);
    }
  });
});

/**
 * Petrie does not record a chamber the same way twice: sometimes both walls
 * are located, sometimes one wall and the length he measured along each side,
 * sometimes only a centre. The three extents are read one at a time so any
 * mixture of those works, and a wall bounds its own side, so a length hung off
 * the west wall runs east.
 */
describe('the shapes a chamber can be recorded in', () => {
  const chamber = (fields: Record<string, number>): Record<string, number> => {
    const thin = { ...SYNTHETIC };
    for (const key of Object.keys(thin)) if (key.startsWith('g2.chamber.')) delete thin[key];
    return buildEnvironment({ ...thin, ...fields });
  };
  const built = (fields: Record<string, number>) => interiorSolids(chamber(fields), g2)['g2.chamber.burial'];

  it('hangs the measured length east of a located west wall', () => {
    const solid = built({
      'g2.chamber.burial.wall.west.east': -1,
      'g2.chamber.burial.length.north': 12,
      'g2.chamber.burial.length.south': 12.4,
      'g2.chamber.burial.wall.north.north': -20,
      'g2.chamber.burial.wall.south.north': -26,
      'g2.chamber.burial.floor.up': 0,
      'g2.chamber.burial.wall.height': 5,
    });
    // The mean of the two measured lengths, running east from the west wall.
    expect(solid?.landmarks['g2.chamber.burial.corner.NE.floor']).toEqual([11.2, -20, 0]);
    expect(solid?.landmarks['g2.chamber.burial.corner.SW.floor']).toEqual([-1, -26, 0]);
    expect(meshVolume(solid as Mesh)).toBeCloseTo(12.2 * 6 * 5, 2);
  });

  it('hangs it west of a located east wall instead', () => {
    const solid = built({
      'g2.chamber.burial.wall.east.east': 11,
      'g2.chamber.burial.length': 12,
      'g2.chamber.burial.wall.north.north': -20,
      'g2.chamber.burial.width': 6,
      'g2.chamber.burial.floor.up': 0,
      'g2.chamber.burial.ceiling.up': 5,
    });
    expect(solid?.landmarks['g2.chamber.burial.corner.NE.floor']).toEqual([11, -20, 0]);
    expect(solid?.landmarks['g2.chamber.burial.corner.SW.floor']).toEqual([-1, -26, 0]);
  });

  it('centres the dimensions on a recorded centre, from the casing or not', () => {
    const solid = built({
      'g2.chamber.burial.centre.east': 5,
      'g2.chamber.burial.centre.from_north_base': 123,
      'g2.chamber.burial.length': 12,
      'g2.chamber.burial.width': 6,
      'g2.chamber.burial.floor.up': 0,
      'g2.chamber.burial.wall.height': 5,
    });
    // 123 m south of a north base edge 100 m from the centre is y = -23.
    expect(solid?.landmarks['g2.chamber.burial.floor.centre']).toEqual([5, -23, 0]);
    expect(solid?.landmarks['g2.chamber.burial.corner.NE.floor']).toEqual([11, -20, 0]);
  });

  it('reads an east coordinate given as a distance west of the east base edge', () => {
    const solid = built({
      'g2.chamber.burial.wall.east.from_east_side': 89,
      'g2.chamber.burial.length': 12,
      'g2.chamber.burial.centre.north': -23,
      'g2.chamber.burial.width': 6,
      'g2.chamber.burial.floor.up': 0,
      'g2.chamber.burial.wall.height': 5,
    });
    // 89 m west of an east base edge 100 m from the centre is x = +11.
    expect(solid?.landmarks['g2.chamber.burial.corner.NE.floor']).toEqual([11, -20, 0]);
  });

  it('takes the wall height when there is no ceiling level', () => {
    const withCeiling = built({
      'g2.chamber.burial.centre.east': 5,
      'g2.chamber.burial.centre.north': -23,
      'g2.chamber.burial.length': 12,
      'g2.chamber.burial.width': 6,
      'g2.chamber.burial.floor.up': 40,
      'g2.chamber.burial.ceiling.up': 45,
      'g2.chamber.burial.wall.height': 99,
    });
    // A measured ceiling wins: the wall height is Petrie's mean, not a level.
    expect(withCeiling?.landmarks['g2.chamber.burial.corner.NE.ceiling']).toEqual([11, -20, 45]);
  });

  it('skips a chamber with dimensions but nothing to place them on', () => {
    expect(
      interiorSolids(
        chamber({
          'g2.chamber.burial.length': 12,
          'g2.chamber.burial.width': 6,
          'g2.chamber.burial.floor.up': 0,
          'g2.chamber.burial.wall.height': 5,
        }),
        g2,
      )['g2.chamber.burial'],
    ).toBeUndefined();
  });

  it('skips a chamber with a place but no vertical extent', () => {
    expect(
      interiorSolids(
        chamber({
          'g2.chamber.burial.centre.east': 5,
          'g2.chamber.burial.centre.north': -23,
          'g2.chamber.burial.length': 12,
          'g2.chamber.burial.width': 6,
          'g2.chamber.burial.ceiling.up': 5,
        }),
        g2,
      )['g2.chamber.burial'],
    ).toBeUndefined();
  });
});

describe('interiorStructures', () => {
  it('reports only the structures the environment can actually build', () => {
    expect(interiorStructures(env)).toEqual(['g2']);
    expect(interiorStructures(env, ['g3'])).toEqual([]);
    expect(interiorStructures(buildEnvironment({}))).toEqual([]);
  });
});
