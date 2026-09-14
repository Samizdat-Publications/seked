import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATA_DIR, REPO_ROOT, loadDatabase } from './index';
import { loadTerrain } from './terrain';

const terrain = loadTerrain();
const { header, heights } = terrain;

describe('the Giza heightfield', () => {
  it('matches the dimensions in its header', () => {
    expect(heights.length).toBe(header.nx * header.ny);
    expect([header.nx, header.ny]).toEqual([301, 301]);
    expect(header.spacing).toBe(20);
    expect([header.x0, header.y0]).toEqual([-3000, -3000]);
    expect(header.x0 + (header.nx - 1) * header.spacing).toBe(3000);
    expect(header.y0 + (header.ny - 1) * header.spacing).toBe(3000);
  });

  it('is the binary the header was written for', () => {
    const bytes = readFileSync(join(DATA_DIR, 'terrain', header.heights));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(header.sha256);
    expect(bytes.byteLength).toBe(header.nx * header.ny * 4);
  });

  it('cites a source that exists and names the tiles it was cut from', () => {
    const db = loadDatabase();
    expect(db.sources.map((s) => s.id)).toContain(header.source);
    expect(db.sites.map((s) => s.id)).toContain(header.site);
    expect(header.tiles.every((t) => /^Copernicus_DSM_COG_10_N\d\d_00_E\d{3}_00_DEM\.tif$/.test(t))).toBe(true);
    expect(header.verticalDatum).toBe('EGM2008');
  });

  it('holds finite heights in the range the plateau and the valley can produce', () => {
    let min = Infinity;
    let max = -Infinity;
    for (const h of heights) {
      expect(Number.isFinite(h)).toBe(true);
      if (h < min) min = h;
      if (h > max) max = h;
    }
    // A nodata value or a byte-order mistake would land far outside this band. One sample
    // in the built-up ground north-east of the plateau dips just below sea level.
    expect(min).toBeGreaterThan(-25);
    expect(max).toBeLessThan(300);
  });

  it('falls from the plateau to the valley', () => {
    const d = 2000 / Math.SQRT2;
    expect(terrain.sample(0, 0)).toBeGreaterThan(terrain.sample(d, d) + 50);
    expect(terrain.sample(d, d)).toBeLessThan(40);
  });

  it('puts the origin on the mound the DEM makes of the Great Pyramid', () => {
    // Not the 200 m apex: GLO-30 edits the monuments, and the product's editing mask marks
    // the pyramid footprints, so Khufu arrives as a smoothed mound over a 60 m plateau. The
    // header's note says so, and the ground under the pyramid is a later job for the GPMP
    // contours and the surveyed base elevations.
    const h = terrain.sample(0, 0);
    expect(h).toBeGreaterThan(60);
    expect(h).toBeLessThan(120);
    expect(header.note).toMatch(/GPMP contours/);
  });

  it('interpolates between the samples it stores and refuses to leave the grid', () => {
    const middle = Math.floor(header.nx / 2);
    const x = header.x0 + middle * header.spacing;
    const y = header.y0 + middle * header.spacing;
    expect(terrain.sample(x, y)).toBe(heights[middle * header.nx + middle]);
    const a = heights[middle * header.nx + middle] as number;
    const b = heights[middle * header.nx + middle + 1] as number;
    expect(terrain.sample(x + header.spacing / 2, y)).toBeCloseTo((a + b) / 2, 6);
    expect(() => terrain.sample(3000 + 1e-6, 0)).toThrow(/outside the heightfield/);
    expect(() => terrain.sample(0, -3001)).toThrow(/outside the heightfield/);
  });
});

describe('the coarse grid that carries the horizon past the near one', () => {
  const far = loadTerrain(DATA_DIR, 'giza-glo30-far');

  it('is a twelve kilometre window on the same site, and its header says the same things', () => {
    expect([far.header.nx, far.header.ny]).toEqual([401, 401]);
    expect(far.header.spacing).toBe(60);
    expect([far.header.x0, far.header.y0]).toEqual([-12000, -12000]);
    expect(far.heights.length).toBe(far.header.nx * far.header.ny);
    expect(far.header.site).toBe(header.site);
    expect(far.header.source).toBe(header.source);
    expect(far.header.verticalDatum).toBe('EGM2008');
    const bytes = readFileSync(join(DATA_DIR, 'terrain', far.header.heights));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(far.header.sha256);
  });

  it('shares its sample points with the near grid, which is what lets the two meet edge to edge', () => {
    const ratio = far.header.spacing / header.spacing;
    expect(ratio).toBe(Math.round(ratio));
    expect((header.x0 - far.header.x0) / far.header.spacing).toBe(150);
    expect((header.y0 - far.header.y0) / far.header.spacing).toBe(150);
    const x1 = header.x0 + (header.nx - 1) * header.spacing;
    const y1 = header.y0 + (header.ny - 1) * header.spacing;
    for (const x of [header.x0, x1]) {
      for (const y of [header.y0, y1]) {
        expect(far.sample(x, y), `(${x}, ${y})`).toBeCloseTo(terrain.sample(x, y), 3);
      }
    }
  });

  it('reaches the same plateau and the same valley the near grid does', () => {
    expect(far.sample(0, 0)).toBeCloseTo(terrain.sample(0, 0), 3);
    expect(far.heights.every((h) => Number.isFinite(h) && h > -25 && h < 300)).toBe(true);
    expect(() => far.sample(12000 + 1e-6, 0)).toThrow(/outside the heightfield/);
  });
});

function python(): string | undefined {
  for (const bin of ['python3', 'python']) {
    try { execFileSync(bin, ['--version'], { stdio: 'ignore' }); return bin; } catch { /* try next */ }
  }
  return undefined;
}
const py = python();

interface PySample { x: number; y: number; h: number }
interface PyTerrain { file: string; sha256: string; count: number; samples: PySample[] }

describe.skipIf(!py)('blender/seked_data.py reads the heightfield exactly like @seked/data', () => {
  it('agrees on every probe to a millimetre', () => {
    // seked_data.py is append-only, so its first CLI block prints the resolved values and the
    // terrain JSON is the last line.
    const out = execFileSync(py as string, [join(REPO_ROOT, 'blender', 'seked_data.py'), 'canonical', '--terrain'], { encoding: 'utf8' });
    const lines = out.trim().split(/\r?\n/);
    const theirs = JSON.parse(lines[lines.length - 1] as string) as PyTerrain;
    expect(theirs.file).toBe(header.heights);
    expect(theirs.sha256).toBe(header.sha256);
    expect(theirs.count).toBe(heights.length);
    expect(theirs.samples.length).toBeGreaterThanOrEqual(8);
    for (const s of theirs.samples) {
      expect(terrain.sample(s.x, s.y), `(${s.x}, ${s.y})`).toBeCloseTo(s.h, 3);
    }
  });
});
