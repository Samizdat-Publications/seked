import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { meshVolume, pyramidMesh } from '@seked/geometry';
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
