import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bore, buildEnvironment, chamber, courseHeights, extrudedSection, groundHeight, interiorSolidInputs, interiorSolids, interiorStructures, meshVolume, passage, pyramidionMesh, pyramidionProfile, pyramidMesh, smallPyramidMesh, smallPyramidProfile, steppedPyramidMesh } from '@seked/geometry';
import type { Footprint, GroundPyramid, Mesh, Point, PyramidionProfile, SectionPair, SmallPyramidProfile, Solid } from '@seked/geometry';
import { loadDatabase, loadFootprints, REPO_ROOT, resolve } from './index';

function python(): string | undefined {
  for (const bin of ['python3', 'python']) {
    try { execFileSync(bin, ['--version'], { stdio: 'ignore' }); return bin; } catch { /* try next */ }
  }
  return undefined;
}
const py = python();

describe.skipIf(!py)('blender/seked_data.py resolves the database exactly like @seked/data', () => {
  const db = loadDatabase();
  for (const preset of db.presets) {
    it(`preset ${preset.id}`, () => {
      const out = execFileSync(py as string, [join(REPO_ROOT, 'blender', 'seked_data.py'), preset.id], { encoding: 'utf8' });
      const theirs = JSON.parse(out) as Record<string, number>;
      expect(theirs).toEqual(resolve(db, preset.id).values);
    });
  }
});

interface PyVariant { name: string; truncate_at: number | null; concavity: number; verts: [number, number, number][]; faces: number[][]; volume: number }

describe.skipIf(!py)('blender/seked_data.py builds the same pyramid as @seked/geometry', () => {
  const db = loadDatabase();
  const { values } = resolve(db, 'canonical');
  const out = execFileSync(py as string, [join(REPO_ROOT, 'blender', 'seked_data.py'), 'canonical', '--geometry'], { encoding: 'utf8' });
  const theirs = JSON.parse(out) as Record<string, PyVariant[]>;
  for (const structure of ['g1', 'g2', 'g3']) {
    it(`${structure}: ring vertices and enclosed volume agree in every variant`, () => {
      const base = values[`${structure}.base.side.mean`] as number;
      const height = values[`${structure}.height.original`] as number;
      const variants = theirs[structure] as PyVariant[];
      expect(variants.length).toBeGreaterThanOrEqual(2);
      for (const v of variants) {
        const ours = pyramidMesh({ base, height, truncateAt: v.truncate_at ?? undefined, concavity: v.concavity });
        // Both generators lay out the base ring as vertices 0..7 and, when truncated, the top ring as 8..15.
        const ringCount = v.truncate_at !== null && v.truncate_at < height ? 16 : 8;
        expect(v.verts.length).toBe(ringCount + (ringCount === 8 ? 1 : 0));
        for (let i = 0; i < ringCount; i++) {
          for (let axis = 0; axis < 3; axis++) {
            expect(ours.positions[i * 3 + axis], `${v.name} vertex ${i} axis ${axis}`).toBeCloseTo((v.verts[i] as number[])[axis] as number, 3);
          }
        }
        const oursVolume = meshVolume(ours);
        expect(Math.abs(oursVolume - v.volume) / v.volume, `${v.name} volume`).toBeLessThan(1e-5);
      }
    });
  }
});

interface PyShape { name: string; verts: [number, number, number][]; faces: number[][]; volume: number }

const DEG = Math.PI / 180;

/** The same five-step corbel as GALLERY_SECTION in blender/seked_data.py. */
const GALLERY_SECTION: SectionPair[] = [
  [1.047, 0.0], [1.047, 2.29],
  [0.97, 2.29], [0.97, 2.75],
  [0.893, 2.75], [0.893, 3.21],
  [0.816, 3.21], [0.816, 3.67],
  [0.739, 3.67], [0.739, 4.13],
];

/**
 * The literal interior solids both sides build, in metres and in the order
 * `shape_cases()` prints them. Nothing here comes from data/: the numbers are
 * here to be identical on both sides, not to be measurements.
 */
function interiorShapes(): Record<string, Solid> {
  const slope = 26.5 * DEG;
  const gallerySlope = 26.2 * DEG;
  const walls = 184.47 * 0.0254;
  const ridge = 245.1 * 0.0254;
  const obliqueFrom: Point = [-12.5, 18, 5];
  const obliqueTo: Point = [14, -9, -6.5];
  return {
    sloped_passage: passage({
      from: [0, 24, 17],
      to: [0, 24 - 40 * Math.cos(slope), 17 - 40 * Math.sin(slope)],
      width: 1.05, height: 1.2, heightMode: 'perpendicular',
    }),
    level_passage: passage({
      from: [0, 0, 21], to: [0, -38.7, 21], width: 1.05, height: 1.17, heightMode: 'vertical',
    }),
    box_chamber: chamber({ min: [-5.235, -2.615, 43], max: [5.235, 2.615, 48.85] }),
    // A chamber turned off the axes, the way the chamber of the niches is.
    turned_chamber: chamber({ min: [-1.4, 0, -16.3], max: [0.5, 5.3, -14.3], turn: { about: [-4.2, -1.1], azimuthDeg: 25 } }),
    gabled_chamber: chamber({
      min: [-2.615, -2.875, 21], max: [2.615, 2.875, 21 + walls],
      gable: { ridgeHeight: ridge, axis: 'x' },
    }),
    corbelled_gallery: extrudedSection({
      from: [0, 0, 22],
      to: [0, -46.12 * Math.cos(gallerySlope), 22 + 46.12 * Math.sin(gallerySlope)],
      section: GALLERY_SECTION, heightMode: 'perpendicular',
    }),
    oblique_perpendicular: passage({
      from: obliqueFrom, to: obliqueTo, width: 1.05, height: 1.2, heightMode: 'perpendicular',
    }),
    oblique_vertical: passage({
      from: obliqueFrom, to: obliqueTo, width: 1.05, height: 1.2, heightMode: 'vertical',
    }),
    // A bore with four legs, the last run to the south face, and one that
    // dog-legs north-west before running to the north face.
    bent_bore_south: bore({
      inlet: [2.5, -13.6, 43.9],
      segments: [
        { length: 1.72, angleDeg: 0, directionDeg: 180 },
        { length: 1.5, angleDeg: 39.2, directionDeg: 180 },
        { length: 3.0, angleDeg: 50.54, directionDeg: 180 },
        { toFace: true, angleDeg: 45, directionDeg: 180 },
      ],
      width: 0.216, height: 0.2235, face: { halfBase: 115.165, faceAngleDeg: 51.8444 },
    }),
    dogleg_bore_north: bore({
      inlet: [4.9, 2.6, 22.2],
      segments: [
        { length: 1.93, angleDeg: 0, directionDeg: 0 },
        { length: 16.07, angleDeg: 39.1167, directionDeg: 0 },
        { length: 8.0, angleDeg: 39.1167, directionDeg: 315 },
        { toFace: true, angleDeg: 39.1167, directionDeg: 0 },
      ],
      width: 0.2032, height: 0.2184, face: { halfBase: 115.165, faceAngleDeg: 51.8444 },
    }),
    // A well: laid about its axis, with vertical legs, and a last leg off the meridian.
    centred_well_bore: bore({
      inlet: [5.02, 40.42, 21.19],
      segments: [
        { length: 7.96, angleDeg: -90, directionDeg: 180 },
        { length: 7.9, angleDeg: -66, directionDeg: 180 },
        { length: 9.72, angleDeg: -64.87, directionDeg: 155.27 },
      ],
      width: 0.71, height: 0.7112, centred: true,
    }),
  };
}

describe.skipIf(!py)('blender/seked_data.py builds the same interior solids as @seked/geometry', () => {
  const out = execFileSync(py as string, [join(REPO_ROOT, 'blender', 'seked_data.py'), '--shapes'], { encoding: 'utf8' });
  const theirs = JSON.parse(out) as PyShape[];
  const ours = interiorShapes();

  it('both sides cover the same cases', () => {
    expect(theirs.map((s) => s.name)).toEqual(Object.keys(ours));
  });

  for (const shape of theirs) {
    it(`${shape.name}: every vertex and the enclosed volume agree`, () => {
      const mine = ours[shape.name] as Solid;
      expect(shape.verts.length, 'vertex count').toBe(mine.vertexCount);
      for (let i = 0; i < shape.verts.length; i++) {
        for (let axis = 0; axis < 3; axis++) {
          // Our positions are float32, so metres agree to well under a millimetre.
          expect(mine.positions[i * 3 + axis], `vertex ${i} axis ${axis}`).toBeCloseTo((shape.verts[i] as number[])[axis] as number, 3);
        }
      }
      const oursVolume = meshVolume(mine);
      expect(Math.abs(oursVolume - shape.volume) / shape.volume, 'volume').toBeLessThan(1e-5);
    });
  }
});

interface PyInterior { name: string; keys: string[]; verts: [number, number, number][]; faces: number[][]; volume: number }

/** The last line of an append-only CLI run, the earlier blocks having printed first. */
function lastLine(out: string): string {
  const lines = out.trim().split(/\r?\n/);
  return lines[lines.length - 1] as string;
}

/** Compare one structure's solids vertex by vertex against the Python build of it. */
function expectSameSolids(theirs: PyInterior[], ours: Record<string, Solid>): void {
  expect(theirs.map((s) => s.name)).toEqual(Object.keys(ours));
  for (const solid of theirs) {
    const mine = ours[solid.name];
    if (!mine) throw new Error(`@seked/geometry skipped ${solid.name}`);
    expect(solid.verts.length, `${solid.name} vertex count`).toBe(mine.vertexCount);
    for (let i = 0; i < solid.verts.length; i++) {
      for (let axis = 0; axis < 3; axis++) {
        // Our positions are float32, so metres agree to well under a millimetre.
        expect(mine.positions[i * 3 + axis], `${solid.name} vertex ${i} axis ${axis}`).toBeCloseTo((solid.verts[i] as number[])[axis] as number, 3);
      }
    }
    const oursVolume = meshVolume(mine);
    // A part in a hundred thousand, or a tenth of a litre: a shaft twenty
    // centimetres across eighty metres from the origin holds a few cubic
    // metres, and float32 at that distance is good to a few micrometres, which
    // on so thin a section is more than a part in a hundred thousand.
    expect(Math.abs(oursVolume - solid.volume), `${solid.name} volume`).toBeLessThan(Math.max(1e-5 * solid.volume, 1e-4));
  }
}

describe.skipIf(!py)('blender/seked_data.py builds the same interiors as @seked/geometry', () => {
  const db = loadDatabase();
  const env = buildEnvironment(resolve(db, 'canonical').values);
  // seked_data.py is append-only, so its first CLI block prints the resolved
  // values and the interior JSON is the last line. It holds one entry per
  // structure the preset carries an interior for, so G2 and G3 join the
  // comparison the moment their records are entered.
  const out = execFileSync(py as string, [join(REPO_ROOT, 'blender', 'seked_data.py'), 'canonical', '--interior'], { encoding: 'utf8' });
  const theirs = JSON.parse(lastLine(out)) as Record<string, PyInterior[]>;

  it('covers the same structures', () => {
    expect(Object.keys(theirs)).toEqual(interiorStructures(env));
    expect(Object.keys(theirs)).toContain('g1');
  });

  for (const [structure, solids] of Object.entries(theirs)) {
    it(`${structure}: the same solids, in the same order, vertex for vertex`, () => {
      if (structure === 'g1') expect(solids.length).toBeGreaterThanOrEqual(10);
      expectSameSolids(solids, interiorSolids(env, { structure }));
      // A discovered interior is placed by its route, branches and turned
      // chambers included, so both sides must also name the same chain.
      if (structure !== 'g1') {
        const inputs = interiorSolidInputs(env, { structure });
        for (const solid of solids) expect(solid.keys, `${solid.name} records`).toEqual(inputs[solid.name]);
      }
    });
  }
});

/**
 * The discovery path, on a pyramid that is not in the database at all. Its
 * numbers are literal on both sides so the two readers can be compared before
 * any real record for G2 or G3 exists; nothing here is a measurement.
 */
const DISCOVERY_CASE: Record<string, number> = {
  'g2.base.half': 100,
  'g2.entrance.floor.begin.from_north_base': 20,
  'g2.entrance.floor.begin.east': 5,
  'g2.entrance.floor.begin.up': 30,
  'g2.passage.descending.floor.end.north': 0,
  'g2.passage.descending.floor.end.east': 5,
  'g2.passage.descending.floor.end.up': 0,
  'g2.passage.descending.width': 1,
  'g2.passage.descending.height': 2,
  'g2.passage.descending.angle': 20.556,
  'g2.passage.horizontal.floor.begin.north': 0,
  'g2.passage.horizontal.floor.begin.east': 5,
  'g2.passage.horizontal.floor.begin.up': 0,
  'g2.passage.horizontal.floor.end.north': -20,
  'g2.passage.horizontal.floor.end.east': 5,
  'g2.passage.horizontal.floor.end.up': 0,
  'g2.passage.horizontal.width': 1,
  'g2.passage.horizontal.height': 2,
  // A passage stated the way a published plan states one: where it begins, a
  // length along the floor and a slope, with no far end written down. This
  // one takes the default bearing, due south.
  'g2.passage.lower_descending.floor.begin.north': -20,
  'g2.passage.lower_descending.floor.begin.east': 5,
  'g2.passage.lower_descending.floor.begin.up': 0,
  'g2.passage.lower_descending.length': 20,
  'g2.passage.lower_descending.angle': -30,
  'g2.passage.lower_descending.width': 1,
  'g2.passage.lower_descending.height': 2,
  // An entrance with a level and an east offset but no north coordinate, put
  // on the north face from the face angle and the half base.
  'g2.face.angle': 50,
  'g2.entrance.upper.floor.begin.east': 2,
  'g2.entrance.upper.floor.begin.up': 10,
  'g2.passage.upper.length': 30,
  'g2.passage.upper.angle': -26,
  'g2.passage.upper.width': 1,
  'g2.passage.upper.height': 2,
  // The same, with a recorded bearing that is not due south.
  'g2.passage.well.floor.begin.north': -26,
  'g2.passage.well.floor.begin.east': 5,
  'g2.passage.well.floor.begin.up': -10,
  'g2.passage.well.length': 8,
  'g2.passage.well.angle': 0,
  'g2.passage.well.direction': 90,
  'g2.passage.well.width': 1,
  'g2.passage.well.height': 2,
  'g2.chamber.burial.wall.north.north': -20,
  'g2.chamber.burial.wall.south.north': -26,
  'g2.chamber.burial.wall.east.east': 11,
  'g2.chamber.burial.wall.west.east': -1,
  'g2.chamber.burial.floor.up': 0,
  'g2.chamber.burial.ceiling.up': 5,
  'g2.chamber.burial.gable.height': 8,
  // A second chamber in the other shape a survey records: one located wall,
  // the lengths and widths it was measured on, a floor and a wall height.
  'g2.chamber.rock.wall.west.east': -1,
  'g2.chamber.rock.length.north': 12,
  'g2.chamber.rock.length.south': 12.4,
  'g2.chamber.rock.centre.from_north_base': 140,
  'g2.chamber.rock.width.east': 6,
  'g2.chamber.rock.width.west': 6.2,
  'g2.chamber.rock.floor.up': -20,
  'g2.chamber.rock.wall.height': 4,
};

describe.skipIf(!py)('blender/seked_data.py discovers a prefixed interior the same way', () => {
  const out = execFileSync(py as string, [join(REPO_ROOT, 'blender', 'seked_data.py'), 'canonical', '--interior-case'], { encoding: 'utf8' });
  const theirs = JSON.parse(lastLine(out)) as PyInterior[];
  const ours = interiorSolids(DISCOVERY_CASE, { structure: 'g2' });

  it('finds the same solids and names the same records for each', () => {
    expect(theirs.map((s) => s.name)).toEqual([
      'g2.passage.descending',
      'g2.passage.horizontal',
      'g2.passage.lower_descending',
      'g2.passage.upper',
      'g2.passage.well',
      'g2.chamber.burial',
      'g2.chamber.rock',
    ]);
    const inputs = interiorSolidInputs(DISCOVERY_CASE, { structure: 'g2' });
    for (const solid of theirs) expect(solid.keys, `${solid.name} records`).toEqual(inputs[solid.name]);
  });

  it('builds them vertex for vertex', () => {
    expectSameSolids(theirs, ours);
  });
});

interface PyGround { x: number; y: number; surface: number; ground: number }

/**
 * The same two pyramids and the same samples as GROUND_CASE_PYRAMIDS and
 * GROUND_PROBES in blender/seked_data.py, literal on both sides so the two
 * flattenings can be compared. They are not measurements: what is being
 * checked is that the .blend, the GLB and the viewer put the ground in the
 * same place, on and between the flat margin, the blend and the untouched
 * surface model.
 */
const GROUND_CASE_PYRAMIDS: GroundPyramid[] = [
  { base: 230, offsetEast: 0, offsetNorth: 0, offsetUp: 0 },
  { base: 200, offsetEast: -400, offsetNorth: -500, offsetUp: 10 },
];

describe.skipIf(!py)('blender/seked_data.py flattens the ground exactly like @seked/geometry', () => {
  const out = execFileSync(py as string, [join(REPO_ROOT, 'blender', 'seked_data.py'), 'canonical', '--ground'], { encoding: 'utf8' });
  const theirs = JSON.parse(lastLine(out)) as PyGround[];

  it('covers the flat footprint, the blend and the surface beyond it', () => {
    expect(theirs.length).toBeGreaterThanOrEqual(12);
    expect(theirs.some((c) => c.ground === 0)).toBe(true);
    expect(theirs.some((c) => c.ground > 0 && c.ground < c.surface)).toBe(true);
    expect(theirs.some((c) => c.ground === c.surface)).toBe(true);
  });

  for (const c of theirs) {
    it(`(${c.x}, ${c.y}) on a ${c.surface} m surface`, () => {
      expect(groundHeight(c.x, c.y, c.surface, GROUND_CASE_PYRAMIDS)).toBeCloseTo(c.ground, 12);
    });
  }
});
/**
 * The other half of the placement: G2 and G3 are where Petrie's triangulation
 * put them, and the Sphinx, the Heliopolis obelisk and the three points of
 * the Delta are where a latitude and a longitude put them. Both readers have
 * to agree about the second kind too, or the .blend, the GLB and the viewer
 * would stand the Sphinx in different places.
 */
describe.skipIf(!py)('blender/seked_data.py derives the same centre offsets as @seked/geometry', () => {
  const db = loadDatabase();
  const out = execFileSync(py as string, [join(REPO_ROOT, 'blender', 'seked_data.py'), 'canonical', '--offsets'], { encoding: 'utf8' });
  const theirs = JSON.parse(lastLine(out)) as Record<string, number>;
  const env = buildEnvironment(resolve(db, 'canonical').values);

  it('derives the same keys', () => {
    expect(Object.keys(theirs).sort()).toEqual([
      'delta.apex.centre.offset.east',
      'delta.apex.centre.offset.north',
      'delta.east.centre.offset.east',
      'delta.east.centre.offset.north',
      'delta.west.centre.offset.east',
      'delta.west.centre.offset.north',
      'g1.centre.offset.east',
      'g1.centre.offset.north',
      'heliopolis.obelisk.centre.offset.east',
      'heliopolis.obelisk.centre.offset.north',
      'sphinx.centre.offset.east',
      'sphinx.centre.offset.north',
    ]);
  });

  it('agrees on every one of them to the micrometre', () => {
    for (const [key, value] of Object.entries(theirs)) expect(env[key], key).toBeCloseTo(value, 6);
  });

  it('leaves the surveyed offsets alone: G2 and G3 keep their south and west', () => {
    expect(theirs['g2.centre.offset.east']).toBeUndefined();
    expect(env['g2.centre.offset.east']).toBeUndefined();
    expect(env['g2.centre.offset.west']).toBe(resolve(db, 'canonical').values['g2.centre.offset.west']);
  });
});

interface PyStepped {
  name: string;
  courses: number;
  top: number;
  verts: [number, number, number][];
  faces: number[][];
  volume: number;
}

/**
 * The stepped pyramid is 1,608 vertices, far too many to name one at a time,
 * so this compares them the way check.py compares the Sphinx's box: the worst
 * difference over the whole stack, in metres. Our positions are float32, so a
 * coordinate 139 m up is only good to about ten micrometres.
 */
describe.skipIf(!py)('blender/seked_data.py stacks the same courses as @seked/geometry', () => {
  const db = loadDatabase();
  const { values } = resolve(db, 'canonical');
  const out = execFileSync(py as string, [join(REPO_ROOT, 'blender', 'seked_data.py'), 'canonical', '--courses'], { encoding: 'utf8' });
  const theirs = JSON.parse(lastLine(out)) as Record<string, PyStepped>;

  it('builds one for every structure the preset carries courses for, and no others', () => {
    expect(Object.keys(theirs)).toEqual(['g1']);
    expect(theirs['g1']?.courses).toBe(courseHeights(values, 'g1').length);
    expect(courseHeights(values, 'g2')).toEqual([]);
  });

  it('g1: the same vertices, the same volume, and a top at the courses added up', () => {
    const stepped = theirs['g1'] as PyStepped;
    const courses = courseHeights(values, 'g1');
    const ours = steppedPyramidMesh({
      base: values['g1.base.side.mean'] as number,
      height: values['g1.height.original'] as number,
      courses,
    });
    expect(stepped.verts.length, 'vertex count').toBe(ours.vertexCount);
    let worst = 0;
    let where = '';
    for (let i = 0; i < stepped.verts.length; i++) {
      for (let axis = 0; axis < 3; axis++) {
        const difference = Math.abs((ours.positions[i * 3 + axis] as number) - ((stepped.verts[i] as number[])[axis] as number));
        if (difference > worst) {
          worst = difference;
          where = `vertex ${i} axis ${axis}`;
        }
      }
    }
    expect(worst, `worst at ${where || 'nowhere'}`).toBeLessThan(1e-3);
    expect(Math.abs(meshVolume(ours) - stepped.volume) / stepped.volume, 'volume').toBeLessThan(1e-5);
    expect(stepped.top).toBeCloseTo(courses.reduce((sum, h) => sum + h, 0), 9);
  });
});


interface PySolid {
  verts: [number, number, number][];
  faces: number[][];
  volume: number;
}

interface PyPyramidion extends PySolid {
  height: number;
  base_side: number;
  face_angle_deg: number;
  apex: [number, number, number];
  angle_measured: boolean;
}

interface PySmallPyramid {
  side: number;
  centre: [number, number];
  angle_deg: number;
  height: number;
  base: number;
  face_angle_deg: number;
  slope_measured: boolean;
  cased?: PySolid;
  stepped?: PySolid;
}

/**
 * The worst difference between our float32 positions and their doubles, in
 * metres, over the first `count` vertices. Our positions are float32, so a
 * coordinate 146 m up is only good to about ten micrometres, which is why
 * nothing here is compared any tighter than a millimetre.
 */
function worstVertex(theirs: readonly number[][], ours: Mesh, count: number): { worst: number; where: string } {
  let worst = 0;
  let where = '';
  for (let i = 0; i < count; i++) {
    for (let axis = 0; axis < 3; axis++) {
      const difference = Math.abs((ours.positions[i * 3 + axis] as number) - ((theirs[i] as number[])[axis] as number));
      if (difference > worst) {
        worst = difference;
        where = `vertex ${i} axis ${axis}`;
      }
    }
  }
  return { worst, where };
}

/** A Blender polygon face list as the triangles packages/geometry emits, fanned the same way. */
function fanned(faces: readonly number[][]): number[] {
  const out: number[] = [];
  for (const face of faces) {
    for (let i = 1; i + 1 < face.length; i++) out.push(face[0] as number, face[i] as number, face[i + 1] as number);
  }
  return out;
}

/**
 * The two state builders Blender draws as well as the viewer: the capstone
 * and the queens' pyramids. Both sides read the same records and the same
 * footprint file, so the only way they can differ is by one of them being
 * changed without the other.
 */
describe.skipIf(!py)('blender/seked_data.py builds the same capstones and small pyramids as @seked/geometry', () => {
  const db = loadDatabase();
  const file = loadFootprints();
  const { values } = resolve(db, file.preset);
  const env = buildEnvironment(values);
  const features = file.features as Footprint[];
  const out = execFileSync(py as string, [join(REPO_ROOT, 'blender', 'seked_data.py'), file.preset, '--builders'], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  const theirs = JSON.parse(lastLine(out)) as {
    pyramidions: Record<string, PyPyramidion>;
    small_pyramids: Record<string, PySmallPyramid>;
  };

  it('builds a capstone for the same structures', () => {
    const ours = ['g1', 'g2', 'g3'].filter((s) => pyramidionMesh(env, s as 'g1') !== undefined);
    expect(Object.keys(theirs.pyramidions).sort()).toEqual(ours.sort());
    expect(ours.length).toBe(3);
  });

  for (const structure of ['g1', 'g2', 'g3'] as const) {
    it(`${structure}: the same capstone numbers, vertices and volume`, () => {
      const mirror = theirs.pyramidions[structure] as PyPyramidion;
      const profile = pyramidionProfile(env, structure) as PyramidionProfile;
      expect(mirror.height).toBeCloseTo(profile.height, 12);
      expect(mirror.base_side).toBeCloseTo(profile.baseSide, 12);
      expect(mirror.face_angle_deg).toBeCloseTo(profile.faceAngleDeg, 12);
      expect(mirror.angle_measured).toBe(profile.angleMeasured);
      for (let axis = 0; axis < 3; axis++) expect(mirror.apex[axis]).toBeCloseTo(profile.apex[axis] as number, 9);
      // Both lay out the base ring as vertices 0 to 7 and the apex as 8;
      // ours carries a base centre after that, theirs closes the base with a
      // single eight-sided face, so only the nine are compared.
      const ours = pyramidionMesh(env, structure) as Mesh;
      const { worst, where } = worstVertex(mirror.verts, ours, 9);
      expect(worst, `worst at ${where || 'nowhere'}`).toBeLessThan(1e-3);
      expect(Math.abs(meshVolume(ours) - mirror.volume) / mirror.volume, 'volume').toBeLessThan(1e-4);
    });
  }

  it('builds a small pyramid for the same footprints', () => {
    const ours = features.filter((f) => smallPyramidProfile(f, env) !== undefined).map((f) => f.id);
    expect(Object.keys(theirs.small_pyramids).sort()).toEqual(ours.sort());
    expect(ours.length).toBeGreaterThan(0);
  });

  it('reads every outline as the same square, and stands it in the same place', () => {
    for (const [id, mirror] of Object.entries(theirs.small_pyramids)) {
      const f = features.find((x) => x.id === id) as Footprint;
      const profile = smallPyramidProfile(f, env) as SmallPyramidProfile;
      expect(mirror.side, id).toBeCloseTo(profile.side, 9);
      expect(mirror.angle_deg, id).toBeCloseTo(profile.angleDeg, 9);
      expect(mirror.height, id).toBeCloseTo(profile.height, 9);
      expect(mirror.base, id).toBeCloseTo(profile.base, 9);
      expect(mirror.face_angle_deg, id).toBeCloseTo(profile.faceAngleDeg, 9);
      expect(mirror.slope_measured, id).toBe(profile.slopeMeasured);
      expect(mirror.centre[0], id).toBeCloseTo(profile.centre[0], 9);
      expect(mirror.centre[1], id).toBeCloseTo(profile.centre[1], 9);
    }
  });

  it('cases every one of them with the same vertices and the same volume', () => {
    for (const [id, mirror] of Object.entries(theirs.small_pyramids)) {
      const f = features.find((x) => x.id === id) as Footprint;
      const ours = smallPyramidMesh(f, env, 'cased') as Mesh;
      expect(mirror.cased, id).toBeDefined();
      const { worst, where } = worstVertex((mirror.cased as PySolid).verts, ours, 9);
      expect(worst, `${id} worst at ${where || 'nowhere'}`).toBeLessThan(1e-3);
      expect(Math.abs(meshVolume(ours) - (mirror.cased as PySolid).volume) / (mirror.cased as PySolid).volume, id).toBeLessThan(1e-4);
    }
  });

  it('steps every one of them the same way, vertex for vertex and triangle for triangle', () => {
    for (const [id, mirror] of Object.entries(theirs.small_pyramids)) {
      const f = features.find((x) => x.id === id) as Footprint;
      const ours = smallPyramidMesh(f, env, 'stepped') as Mesh;
      const stepped = mirror.stepped as PySolid;
      expect(stepped, id).toBeDefined();
      expect(stepped.verts.length, `${id} vertices`).toBe(ours.vertexCount);
      expect(fanned(stepped.faces), `${id} triangles`).toEqual([...ours.indices]);
      const { worst, where } = worstVertex(stepped.verts, ours, ours.vertexCount);
      expect(worst, `${id} worst at ${where || 'nowhere'}`).toBeLessThan(1e-3);
      expect(Math.abs(meshVolume(ours) - stepped.volume) / stepped.volume, id).toBeLessThan(1e-4);
    }
  });
});
