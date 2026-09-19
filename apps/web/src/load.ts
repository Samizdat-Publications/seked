/**
 * Fetch what `pnpm bundle` wrote. The JSON is the database; the .f32 beside
 * it is the heightfield, read the way packages/data reads it on disk.
 */
import { setDefaultStars } from '@seked/sky/browser';
import type { SekedBundle } from './bundle';
import { holdBundle } from './runner';

export interface LoadedBundle {
  bundle: SekedBundle;
  /** Row-major, rows south to north, columns west to east, metres. */
  heights: Float32Array;
  /** The same, for the coarse grid that carries the desert out to twelve kilometres. */
  farHeights: Float32Array;
}

const PLATFORM_IS_LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

const url = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

async function get(path: string): Promise<Response> {
  const res = await fetch(url(path));
  if (!res.ok) throw new Error(`${path}: ${res.status} ${res.statusText}. Has \`pnpm bundle\` run?`);
  return res;
}

function float32(buffer: ArrayBuffer, littleEndian: boolean): Float32Array {
  if (littleEndian === PLATFORM_IS_LITTLE_ENDIAN) return new Float32Array(buffer);
  const view = new DataView(buffer);
  const out = new Float32Array(buffer.byteLength / 4);
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, littleEndian);
  return out;
}

export async function loadBundle(): Promise<LoadedBundle> {
  const bundle = (await (await get('seked.json')).json()) as SekedBundle;
  const grid = async ({ header, heights: path }: SekedBundle['terrain']): Promise<Float32Array> => {
    const values = float32(await (await get(path)).arrayBuffer(), header.byteOrder === 'little-endian');
    if (values.length !== header.nx * header.ny) {
      throw new Error(`${path}: ${values.length} samples, but the header says ${header.nx} x ${header.ny}`);
    }
    return values;
  };
  const [heights, farHeights] = await Promise.all([grid(bundle.terrain), grid(bundle.farTerrain)]);
  // Sky claims read their stars from here rather than from a file.
  setDefaultStars(bundle.stars);
  // The claims runner builds the model's context out of this same bundle, so
  // the numbers it is told about are the numbers the scene is drawn from.
  holdBundle(bundle);
  return { bundle, heights, farHeights };
}
