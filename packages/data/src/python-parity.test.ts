import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chamber, extrudedSection, meshVolume, passage, pyramidMesh } from '@seked/geometry';
import type { Point, SectionPair, Solid } from '@seked/geometry';
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
