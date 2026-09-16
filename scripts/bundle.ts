/**
 * Write everything the viewer needs into apps/web/public.
 *
 *     pnpm bundle
 *
 * The loaders here are the Node ones, so the bundle is validated exactly as
 * the dossier's inputs are. What lands in the browser is the database itself,
 * not a rendering of it: sources, sites, structures, presets, every
 * measurement, the normalised claims, the named stars, the bright star
 * catalogue, the terrain header and the footprint import.
 * The viewer resolves presets and evaluates claims for itself.
 *
 * Running it twice writes the same bytes twice.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadClaims } from '@seked/claims';
import { DATA_DIR, REPO_ROOT, TerrainHeaderSchema, loadDatabase, loadFootprints } from '@seked/data';
import { limitMagnitude, loadBrightStars, loadNamedStars } from '@seked/sky';
import type { SekedBundle } from '../apps/web/src/bundle';

export const WEB_PUBLIC = join(REPO_ROOT, 'apps', 'web', 'public');

/** Where the heights land under the site root, and so also inside public/. */
const TERRAIN_DIR = 'terrain';

/**
 * How faint a star has to be before the viewer stops being given it. The
 * catalogue on disk goes to 6.5, which is 8,920 stars and 681 kB of JSON; 6.0
 * is the naked-eye limit under a dark sky, halves the rows, and is already far
 * more than a screen can show. Raise it here and re-run `pnpm bundle`.
 */
export const BUNDLE_MAGNITUDE_LIMIT = 6;

export function buildBundle(dataDir = DATA_DIR): SekedBundle {
  const db = loadDatabase(dataDir);
  const claims = loadClaims(join(dataDir, 'claims'));
  const stars = loadNamedStars(join(dataDir, 'stars', 'named.json'));
  const brightStars = limitMagnitude(loadBrightStars(join(dataDir, 'stars', 'hyg-bright.json')), BUNDLE_MAGNITUDE_LIMIT);
  const header = TerrainHeaderSchema.parse(JSON.parse(readFileSync(join(dataDir, TERRAIN_DIR, 'giza-glo30.json'), 'utf8')));
  return {
    sources: db.sources,
    sites: db.sites,
    structures: db.structures,
    presets: db.presets,
    measurements: db.measurements,
    claims,
    stars,
    brightStars,
    terrain: { header, heights: `${TERRAIN_DIR}/${header.heights}` },
    footprints: loadFootprints(dataDir),
  };
}

export interface WrittenBundle {
  bundle: SekedBundle;
  json: string;
  heights: string;
  bytes: number;
}

/** Write seked.json and copy the heightfield beside it. Idempotent. */
export function writeBundle(outDir = WEB_PUBLIC, dataDir = DATA_DIR): WrittenBundle {
  const bundle = buildBundle(dataDir);
  const json = join(outDir, 'seked.json');
  const text = JSON.stringify(bundle);
  mkdirSync(join(outDir, TERRAIN_DIR), { recursive: true });
  if (!existsSync(json) || readFileSync(json, 'utf8') !== text) writeFileSync(json, text);

  const from = join(dataDir, TERRAIN_DIR, bundle.terrain.header.heights);
  const heights = join(outDir, TERRAIN_DIR, bundle.terrain.header.heights);
  const source = readFileSync(from);
  if (!existsSync(heights) || !source.equals(readFileSync(heights))) copyFileSync(from, heights);

  return { bundle, json, heights, bytes: Buffer.byteLength(text) };
}

function main(): void {
  const written = writeBundle();
  const { bundle } = written;
  console.log(
    `${bundle.measurements.length} measurements, ${bundle.claims.length} claims, ${bundle.presets.length} presets, ` +
      `${bundle.stars.length} named stars and ${bundle.brightStars.stars.length} to magnitude ${bundle.brightStars.magnitudeLimit}`,
  );
  console.log(`wrote ${written.json} (${(written.bytes / 1024).toFixed(0)} kB)`);
  console.log(`wrote ${written.heights} (${bundle.terrain.header.nx} x ${bundle.terrain.header.ny} at ${bundle.terrain.header.spacing} m)`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === pathToFileURL(fileURLToPath(import.meta.url)).href) main();
