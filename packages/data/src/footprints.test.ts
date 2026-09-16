import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildEnvironment, footprintInputs, footprintMesh, meshVolume, ringCentroid, surveyFootprints, type Footprint, type Mesh } from '@seked/geometry';
import { REPO_ROOT, loadDatabase, loadFootprints, resolve } from './index';

/**
 * The footprint import against the database it was registered onto. What is
 * checked is what could quietly go wrong: that OSM still agrees with Petrie
 * about where the three pyramids are, that every height a footprint asks the
 * database for is there, that every one of them builds, and that the Python
 * mirror Blender runs builds the same solids.
 */
const db = loadDatabase();
const file = loadFootprints();
const { values } = resolve(db, file.preset);
const env = buildEnvironment(values);
const features = file.features as Footprint[];
const byId = new Map(features.map((f) => [f.id, f]));
const surveyed = surveyFootprints(env, features);
const everything = [...features, ...surveyed];

describe('the footprint import', () => {
  it('cites a source the database knows, and carries its attribution', () => {
    expect(db.sources.some((s) => s.id === file.source)).toBe(true);
    expect(file.attribution).toContain('OpenStreetMap contributors');
  });

  it('registers OSM onto the three surveyed pyramids to within a metre and a half', () => {
    expect(Object.keys(file.registration.residuals).sort()).toEqual(['g1', 'g2', 'g3']);
    for (const [id, r] of Object.entries(file.registration.residuals)) expect(r, id).toBeLessThan(1.5);
    // Petrie oriented his offsets to the pyramids' own mean azimuth, a few
    // arcminutes west of north, and OSM is traced to true north, so a small
    // rotation is expected and a large one would mean a misidentified way.
    expect(Math.abs(file.registration.rotationArcmin)).toBeLessThan(15);
    // No scale is fitted; the one that would have been says OSM and Petrie
    // agree on distances to better than a part in a thousand.
    expect(Math.abs(file.registration.unfittedScale - 1)).toBeLessThan(1e-3);
  });

  it('gives every footprint a unique id', () => {
    expect(byId.size).toBe(features.length);
  });

  it('asks the database only for heights the database has', () => {
    const keys = new Set(db.measurements.map((m) => m.key));
    for (const f of everything) for (const key of footprintInputs(f)) expect(keys.has(key), `${f.id} wants ${key}`).toBe(true);
  });

  it('builds every one of them, each enclosing a positive volume', () => {
    for (const f of everything) {
      const mesh = footprintMesh(f, env);
      expect(mesh, f.id).toBeDefined();
      expect(meshVolume(mesh as Mesh), f.id).toBeGreaterThan(0);
    }
  });

  it('draws the Sphinx as OSM models it: forepaws, a body, and a head that starts eleven metres up', () => {
    const [paws, body, head] = ['sphinx.paws', 'sphinx.body', 'sphinx.head'].map((id) => byId.get(id) as Footprint);
    expect(paws?.height).toBeLessThan(body?.height as number);
    expect(head?.minHeight).toBe(body?.height);
    // The Sphinx is cut down into the plateau: its ground is tens of metres
    // below Khufu's base, which is the check that the bases came off the
    // terrain and not off the frame's datum plane.
    expect(body?.base).toBeLessThan(-30);
  });

  it('never builds the three large pyramids, which the survey builds', () => {
    const osm = new Set(features.map((f) => f.osm));
    for (const way of [4420397, 4420396, 4420398]) expect(osm.has(way)).toBe(false);
  });

  it('puts no mastaba inside the footprint of a large pyramid', () => {
    for (const id of ['g1', 'g2', 'g3']) {
      const half = (values[`${id}.base.side.mean`] as number) / 2;
      const east = -(values[`${id}.centre.offset.west`] ?? 0);
      const north = -(values[`${id}.centre.offset.south`] ?? 0);
      for (const f of features.filter((x) => x.group === 'mastabas')) {
        const inside = f.ring.every(([x, y]) => Math.abs(x - east) < half && Math.abs(y - north) < half);
        expect(inside, `${f.id} inside ${id}`).toBe(false);
      }
    }
  });
});

/**
 * The two solids built from Petrie rather than traced, and the check on the
 * tracing that his trenches make possible: OSM's boat pits east of Khufu,
 * registered only through the three pyramids, against the trench axes he
 * measured in section 29, which nothing was fitted to.
 */
describe('the plateau against Petrie', () => {
  const half = (values['g1.base.side.mean'] as number) / 2;

  it('lays the basalt pavement against Khufu’s east face, two squares of about 1060 inches', () => {
    const pavement = surveyed.find((f) => f.id === 'khufu.basalt_pavement') as Footprint;
    expect(pavement).toBeDefined();
    const xs = pavement.ring.map(([x]) => x);
    const ys = pavement.ring.map(([, y]) => y);
    expect(Math.min(...xs)).toBeGreaterThan(half);
    // "the plan of the basalt pavement seems to be two adjacent squares of
    // about 1,060 inches in the side", section 28.
    const square = 1060 * 0.0254;
    expect((Math.max(...ys) - Math.min(...ys)) / 2).toBeCloseTo(square, -1);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(square, -1);
  });

  it('runs Khafre’s causeway over a quarter of a mile, as Petrie says it is, and climbs to the upper temple', () => {
    const causeway = byId.get('khafre.causeway') as Footprint;
    expect(causeway).toBeDefined();
    const ring = causeway.ring as [number, number][];
    const half = ring.length / 2;
    const [a, b, d] = [ring[0], ring[half - 1], ring[ring.length - 1]] as [number, number][];
    const length = Math.hypot((b as number[])[0] as number - (a as number[])[0]!, (b as number[])[1] as number - (a as number[])[1]!);
    expect(length).toBeGreaterThan(values['khafre.causeway.length.min'] as number);
    // The width was taken from the record when the file was written, so a
    // changed record is caught here until the import is run again.
    const width = Math.hypot((d as number[])[0] as number - (a as number[])[0]!, (d as number[])[1] as number - (a as number[])[1]!);
    expect(width).toBeCloseTo(values['khafre.causeway.width'] as number, 1);
    const bases = causeway.bases as number[];
    expect(bases.length).toBe(ring.length);
    expect(bases[half - 1] as number).toBeGreaterThan((bases[0] as number) + 30);
  });

  it('finds OSM’s boat pits within a few metres of the trench axes Petrie measured, which nothing was fitted to', () => {
    for (const [side, osm] of [['north', 'g1.boat_pit.north_east'], ['south', 'g1.boat_pit.south_east']] as const) {
      const at = (end: string, axis: string) => values[`g1.trench.${side}.axis.${end}.${axis}`] as number;
      const petrie: [number, number] = [
        half + (at('inner', 'beyond_east_base') + at('outer', 'beyond_east_base')) / 2,
        (at('inner', 'north') + at('outer', 'north')) / 2,
      ];
      const [x, y] = ringCentroid((byId.get(osm) as Footprint).ring);
      expect(Math.hypot(x - petrie[0], y - petrie[1]), side).toBeLessThan(5);
    }
  });
});

function python(): string | undefined {
  for (const bin of ['python3', 'python']) {
    try {
      execFileSync(bin, ['--version'], { stdio: 'ignore' });
      return bin;
    } catch {
      /* try the next one */
    }
  }
  return undefined;
}
const py = python();

describe.skipIf(!py)('blender/seked_data.py builds the same footprint solids as @seked/geometry', () => {
  const out = execFileSync(py as string, [join(REPO_ROOT, 'blender', 'seked_data.py'), file.preset, '--footprints'], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  const lines = out.trim().split('\n');
  const theirs = JSON.parse(lines[lines.length - 1] as string) as Record<string, { verts: number[][]; faces: number[][] }>;

  it('builds the same set', () => {
    expect(Object.keys(theirs).sort()).toEqual(everything.map((f) => f.id).sort());
  });

  it('with the same triangles and the same vertices, every one', () => {
    let worst = 0;
    let where = '';
    for (const f of everything) {
      const ours = footprintMesh(f, env) as Mesh;
      const mirror = theirs[f.id] as { verts: number[][]; faces: number[][] };
      expect(mirror.verts.length, `${f.id} vertices`).toBe(ours.vertexCount);
      expect(mirror.faces.flat(), `${f.id} triangles`).toEqual([...ours.indices]);
      for (let i = 0; i < mirror.verts.length; i++) {
        for (let axis = 0; axis < 3; axis++) {
          const d = Math.abs((ours.positions[i * 3 + axis] as number) - ((mirror.verts[i] as number[])[axis] as number));
          if (d > worst) {
            worst = d;
            where = `${f.id} vertex ${i} axis ${axis}`;
          }
        }
      }
    }
    expect(worst, `worst at ${where || 'nowhere'}`).toBeLessThan(1e-3);
  });
});
