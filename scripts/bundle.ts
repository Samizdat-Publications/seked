/**
 * Write everything the viewer needs into apps/web/public.
 *
 *     pnpm bundle
 *
 * The loaders here are the Node ones, so the bundle is validated exactly as
 * the dossier's inputs are. What lands in the browser is the database itself,
 * not a rendering of it: sources, sites, structures, presets, every
 * measurement, the normalised claims, the named stars, the bright star
 * catalogue, both terrain headers and the footprint import.
 * The viewer resolves presets and evaluates claims for itself.
 *
 * Running it twice writes the same bytes twice.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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
 * Where the city lands. It is context rather than database, and six and a
 * half megabytes of it, so it is copied beside the terrain and fetched when
 * the viewer wants it instead of being folded into seked.json.
 */
const CITY_DIR = 'city';

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
  const terrainHeader = (name: string) =>
    TerrainHeaderSchema.parse(JSON.parse(readFileSync(join(dataDir, TERRAIN_DIR, `${name}.json`), 'utf8')));
  const header = terrainHeader('giza-glo30');
  const farHeader = terrainHeader('giza-glo30-far');
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
    farTerrain: { header: farHeader, heights: `${TERRAIN_DIR}/${farHeader.heights}` },
    footprints: loadFootprints(dataDir),
  };
}

export interface WrittenBundle {
  bundle: SekedBundle;
  json: string;
  heights: string;
  farHeights: string;
  /** The city's header and its boxes, copied as they are. */
  city: string[];
  bytes: number;
}

/** Write seked.json and copy the heightfield beside it. Idempotent. */
export function writeBundle(outDir = WEB_PUBLIC, dataDir = DATA_DIR): WrittenBundle {
  const bundle = buildBundle(dataDir);
  const json = join(outDir, 'seked.json');
  const text = JSON.stringify(bundle);
  mkdirSync(join(outDir, TERRAIN_DIR), { recursive: true });
  if (!existsSync(json) || readFileSync(json, 'utf8') !== text) writeFileSync(json, text);

  const copyHeights = (name: string): string => {
    const from = join(dataDir, TERRAIN_DIR, name);
    const into = join(outDir, TERRAIN_DIR, name);
    const source = readFileSync(from);
    if (!existsSync(into) || !source.equals(readFileSync(into))) copyFileSync(from, into);
    return into;
  };
  const heights = copyHeights(bundle.terrain.header.heights);
  const farHeights = copyHeights(bundle.farTerrain.header.heights);

  mkdirSync(join(outDir, CITY_DIR), { recursive: true });
  const city = ['city.json', 'city.bin'].map((name) => {
    const into = join(outDir, CITY_DIR, name);
    const bytes = readFileSync(join(dataDir, 'footprints', name));
    if (!existsSync(into) || !bytes.equals(readFileSync(into))) writeFileSync(into, bytes);
    return into;
  });

  return { bundle, json, heights, farHeights, city, bytes: Buffer.byteLength(text) };
}

function main(): void {
  const written = writeBundle();
  const { bundle } = written;
  console.log(
    `${bundle.measurements.length} measurements, ${bundle.claims.length} claims, ${bundle.presets.length} presets, ` +
      `${bundle.stars.length} named stars and ${bundle.brightStars.stars.length} to magnitude ${bundle.brightStars.magnitudeLimit}`,
  );
  console.log(`wrote ${written.json} (${(written.bytes / 1024).toFixed(0)} kB)`);
  for (const [path, h] of [[written.heights, bundle.terrain.header], [written.farHeights, bundle.farTerrain.header]] as const) {
    console.log(`wrote ${path} (${h.nx} x ${h.ny} at ${h.spacing} m)`);
  }
  for (const path of written.city) console.log(`wrote ${path} (${(statSync(path).size / 1024).toFixed(0)} kB)`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === pathToFileURL(fileURLToPath(import.meta.url)).href) main();
