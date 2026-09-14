import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { DATA_DIR } from './index';

/**
 * The heightfield cut from the Copernicus GLO-30 DEM by scripts/terrain.py.
 * The header describes the grid and cites the source; the heights live beside
 * it in a flat binary so the numbers stay out of the JSON.
 */
export const TerrainHeaderSchema = z.object({
  site: z.string(),
  origin: z.object({ latitude: z.number(), longitude: z.number() }),
  frame: z.string(),
  horizontalDatum: z.string(),
  verticalDatum: z.string(),
  /** File name of the binary, beside the header. */
  heights: z.string(),
  dtype: z.literal('float32'),
  byteOrder: z.literal('little-endian'),
  layout: z.literal('row-major'),
  rowOrder: z.literal('south-to-north'),
  columnOrder: z.literal('west-to-east'),
  /** Grid spacing in metres. */
  spacing: z.number().positive(),
  nx: z.number().int().min(2),
  ny: z.number().int().min(2),
  /** East and north coordinate of the first sample, in metres from the origin. */
  x0: z.number(),
  y0: z.number(),
  resampling: z.string(),
  projection: z.string(),
  source: z.string(),
  tiles: z.array(z.string()).min(1),
  script: z.string(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  note: z.string(),
});
export type TerrainHeader = z.infer<typeof TerrainHeaderSchema>;

export interface Terrain {
  header: TerrainHeader;
  /** Row-major, rows south to north, columns west to east. */
  heights: Float32Array;
  /** Height at local east x and north y, in metres, by bilinear interpolation. */
  sample(x: number, y: number): number;
}

const PLATFORM_IS_LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

function readFloat32(path: string, littleEndian: boolean): Float32Array {
  const bytes = readFileSync(path);
  if (bytes.byteLength % 4 !== 0) throw new Error(`${path}: ${bytes.byteLength} bytes is not a whole number of float32s`);
  const out = new Float32Array(bytes.byteLength / 4);
  if (littleEndian === PLATFORM_IS_LITTLE_ENDIAN) {
    // Copy rather than view: a Buffer's byteOffset need not be a multiple of four.
    new Uint8Array(out.buffer).set(bytes);
    return out;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, littleEndian);
  return out;
}

/** Load the local heightfield for one site. Throws if the binary does not match the header. */
export function loadTerrain(dataDir = DATA_DIR, name = 'giza-glo30'): Terrain {
  const dir = join(dataDir, 'terrain');
  const header = TerrainHeaderSchema.parse(JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8')));
  const heights = readFloat32(join(dir, header.heights), header.byteOrder === 'little-endian');
  const expected = header.nx * header.ny;
  if (heights.length !== expected) {
    throw new Error(`${header.heights}: ${heights.length} samples, but the header says ${header.nx} x ${header.ny} = ${expected}`);
  }
  const { nx, ny, x0, y0, spacing } = header;

  const sample = (x: number, y: number): number => {
    const fx = (x - x0) / spacing;
    const fy = (y - y0) / spacing;
    if (!(fx >= 0 && fx <= nx - 1 && fy >= 0 && fy <= ny - 1)) {
      const x1 = x0 + (nx - 1) * spacing;
      const y1 = y0 + (ny - 1) * spacing;
      throw new RangeError(`(${x}, ${y}) is outside the heightfield, which covers ${x0} to ${x1} east and ${y0} to ${y1} north`);
    }
    const ix = Math.min(Math.floor(fx), nx - 2);
    const iy = Math.min(Math.floor(fy), ny - 2);
    const tx = fx - ix;
    const ty = fy - iy;
    const bottom = (heights[iy * nx + ix] as number) * (1 - tx) + (heights[iy * nx + ix + 1] as number) * tx;
    const top = (heights[(iy + 1) * nx + ix] as number) * (1 - tx) + (heights[(iy + 1) * nx + ix + 1] as number) * tx;
    return bottom * (1 - ty) + top * ty;
  };

  return { header, heights, sample };
}
