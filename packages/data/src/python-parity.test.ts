import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildEnvironment, chamber, extrudedSection, groundHeight, interiorSolidInputs, interiorSolids, interiorStructures, meshVolume, passage, pyramidMesh } from '@seked/geometry';
import type { GroundPyramid, Point, SectionPair, Solid } from '@seked/geometry';
import { loadDatabase, REPO_ROOT, resolve } from './index';

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
    expect(Math.abs(oursVolume - solid.volume) / solid.volume, `${solid.name} volume`).toBeLessThan(1e-5);
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
