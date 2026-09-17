/**
 * The viewer's stand-ins, from the GLBs Blender bakes.
 *
 *     pnpm web-assets            # reads build/web-models, writes apps/web/public/models
 *     SEKED_BUILD=<dir> pnpm web-assets
 *
 * `blender/export_web.py` does the fitting and hands over honest but heavy
 * files: three levels of detail and 4k PBR maps, a few tens of megabytes each.
 * This is the other half of the baker. Each one goes through gltf-transform:
 * dedup and prune what the export left over, weld the vertices a GLB splits
 * along its UV seams, resize every texture to 2048 and encode it as WebP, then
 * compress the geometry with meshopt, which the viewer decodes with three's own
 * decoder.
 *
 * Nothing here moves a vertex in the frame: the fit is the render's and is
 * already baked in. Quantisation rounds positions to about five millimetres
 * over a seventy-five metre statue, which is three orders below the metre the
 * OSM registration is good to.
 *
 * No file may pass 20 MB, because Cloudflare Pages refuses anything over
 * 25 MiB; one that does is encoded again at 1024, and if it still will not fit
 * this stops and names it rather than shipping a site that cannot be deployed.
 *
 * The outputs are generated and gitignored, and the viewer draws no stand-in at
 * all where they are missing, so this exits quietly when Blender has not run.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, textureCompress, weld } from '@gltf-transform/functions';
import { REPO_ROOT } from '@seked/data';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

/** The build directory to read the baked GLBs from; another checkout's, when a worktree has none of its own. */
const BUILD = process.env.SEKED_BUILD ?? join(REPO_ROOT, 'build');
const SOURCE = join(BUILD, 'web-models');
const OUT = join(REPO_ROOT, 'apps', 'web', 'public', 'models');

/** Cloudflare Pages refuses a file over 25 MiB; 20 MB leaves room and is the plan's limit. */
const LIMIT_BYTES = 20_000_000;

/** Texture sizes to try, largest first. 2048 is the spec's; 1024 is the retry for a file that will not fit. */
const SIZES = [2048, 1024] as const;

/** What `blender/export_web.py` writes beside the GLBs. Only the fields the viewer or this script reads are named. */
interface BakedEntry {
  id: string;
  name: string;
  file: string;
  bytes: number;
  states: string[];
  variant?: string;
  default_in?: string[];
  evidence?: string;
  finish?: string;
  material?: string;
  replaces: string[];
  author?: string;
  url?: string;
  license: string;
  attribution: string;
  lods: string[];
  faces?: Record<string, number>;
  fit?: Record<string, number>;
}

/** One line of apps/web/public/models/manifest.json. */
interface WebEntry extends BakedEntry {
  sha256: string;
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

/** Everything but the texture size is the same on every pass, so the two attempts differ in one number only. */
async function compress(bytes: Uint8Array, size: number): Promise<Uint8Array> {
  const doc = await io.readBinary(bytes);
  await doc.transform(
    dedup(),
    // The frame empty carries no mesh and every LOD node carries the manifest
    // entry, so leaves and extras are both kept whatever else goes.
    prune({ keepLeaves: true, keepExtras: true }),
    weld(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size] }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  return io.writeBinary(doc);
}

async function main(): Promise<void> {
  const index = join(SOURCE, 'index.json');
  if (!existsSync(index)) {
    console.log(`web-assets: no ${index}; the viewer will show no stand-ins (run blender/export_web.py first)`);
    return;
  }
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;

  const baked = (JSON.parse(readFileSync(index, 'utf8')) as { models: BakedEntry[] }).models;
  // A model dropped from the manifest must not linger in public/, where the
  // viewer would go on fetching it from an older manifest in a reader's cache.
  if (existsSync(OUT)) for (const f of readdirSync(OUT)) rmSync(join(OUT, f), { recursive: true });
  mkdirSync(OUT, { recursive: true });

  const manifest: WebEntry[] = [];
  const oversize: string[] = [];
  for (const entry of baked) {
    const source = join(SOURCE, entry.file);
    if (!existsSync(source)) {
      console.log(`${entry.id}: no ${source}; skipped`);
      continue;
    }
    const before = readFileSync(source);
    let out: Uint8Array | undefined;
    let used = 0;
    for (const size of SIZES) {
      out = await compress(before, size);
      used = size;
      if (out.byteLength <= LIMIT_BYTES) break;
      console.log(`${entry.id}: ${(out.byteLength / 1e6).toFixed(1)} MB at ${size} px is over the ${LIMIT_BYTES / 1e6} MB limit`);
    }
    if (!out) continue;
    if (out.byteLength > LIMIT_BYTES) {
      oversize.push(`${entry.id} (${(out.byteLength / 1e6).toFixed(1)} MB)`);
      continue;
    }
    writeFileSync(join(OUT, entry.file), out);
    manifest.push({ ...entry, bytes: out.byteLength, sha256: createHash('sha256').update(out).digest('hex') });
    console.log(`${entry.id}: ${(before.byteLength / 1e6).toFixed(1)} MB to ${(out.byteLength / 1e6).toFixed(1)} MB, textures at ${used} px`);
  }

  writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${join(OUT, 'manifest.json')} with ${manifest.length} models, ${(manifest.reduce((a, m) => a + m.bytes, 0) / 1e6).toFixed(1)} MB in all`);
  if (oversize.length > 0) {
    throw new Error(`these stand-ins are still over ${LIMIT_BYTES / 1e6} MB at ${SIZES[SIZES.length - 1]} px and cannot be served: ${oversize.join(', ')}`);
  }
}

await main();
