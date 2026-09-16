import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { FootprintFileSchema, MeasurementSchema, PresetSchema, SiteSchema, SourceSchema, StructureSchema, type Database, type FootprintFile, type Measurement } from './core';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const DATA_DIR = join(REPO_ROOT, 'data');

// The schemas, the types and the preset resolver are browser-safe and live in
// their own module, so `@seked/data/browser` can offer them without node:fs.
export * from './core';

/** Structure ids that are not physical structures and need no registry entry. */
const SITE_FREE_STRUCTURES = new Set(['units', 'constants']);

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Load and validate everything under data/. Throws on any dangling reference. */
export function loadDatabase(dataDir = DATA_DIR): Database {
  const sources = z.array(SourceSchema).parse(readJson(join(dataDir, 'sources.json')));
  const sites = z.array(SiteSchema).parse(readJson(join(dataDir, 'sites.json')));
  const structures = z.array(StructureSchema).parse(readJson(join(dataDir, 'structures.json')));
  const presets = z.array(PresetSchema).parse(readJson(join(dataDir, 'presets.json')));

  const measurements: Measurement[] = [];
  const files = readdirSync(join(dataDir, 'measurements')).filter((f) => f.endsWith('.json')).sort();
  let order = 0;
  for (const file of files) {
    const rows = z.array(MeasurementSchema).parse(readJson(join(dataDir, 'measurements', file)));
    for (const row of rows) measurements.push({ ...row, file, order: order++ });
  }

  const sourceIds = new Set(sources.map((s) => s.id));
  const duplicateSource = sources.find((s, i) => sources.findIndex((t) => t.id === s.id) !== i);
  if (duplicateSource) throw new Error(`duplicate source id ${duplicateSource.id}`);
  for (const m of measurements) {
    if (!sourceIds.has(m.source)) throw new Error(`${m.file}: ${m.key} cites unknown source "${m.source}"`);
  }
  for (const p of presets) {
    for (const s of p.sources) if (!sourceIds.has(s)) throw new Error(`preset ${p.id} lists unknown source "${s}"`);
  }
  const siteIds = new Set(sites.map((s) => s.id));
  const structureIds = new Set(structures.map((s) => s.id));
  for (const st of structures) {
    if (!siteIds.has(st.site)) throw new Error(`structure ${st.id} names unknown site "${st.site}"`);
    if (st.source && !sourceIds.has(st.source)) throw new Error(`structure ${st.id} cites unknown source "${st.source}"`);
  }
  for (const m of measurements) {
    if (SITE_FREE_STRUCTURES.has(m.structure)) continue;
    if (!siteIds.has(m.site)) throw new Error(`${m.file}: ${m.key} names unknown site "${m.site}"`);
    // Measurements may describe sub-elements (kc.*, qc.*) of a registered structure.
    const root = m.structure.split('.')[0] as string;
    if (!structureIds.has(m.structure) && !structureIds.has(root)) {
      throw new Error(`${m.file}: ${m.key} belongs to unregistered structure "${m.structure}" (add it to data/structures.json)`);
    }
  }
  const seen = new Set<string>();
  for (const m of measurements) {
    const k = `${m.key}@${m.source}`;
    if (seen.has(k)) throw new Error(`${m.file}: ${m.key} recorded twice for source ${m.source}`);
    seen.add(k);
  }
  return { sources, sites, structures, measurements, presets };
}

/** The footprint import, validated. Written by `pnpm run footprints`. */
export function loadFootprints(dataDir = DATA_DIR, name = 'giza'): FootprintFile {
  return FootprintFileSchema.parse(JSON.parse(readFileSync(join(dataDir, 'footprints', `${name}.json`), 'utf8')));
}

// The terrain heightfield reader lives in its own module; re-exported so `@seked/data` stays one import.
export * from './terrain';
