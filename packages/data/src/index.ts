import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const DATA_DIR = join(REPO_ROOT, 'data');

export const SourceSchema = z.object({
  id: z.string(),
  kind: z.enum(['survey', 'reference', 'paper', 'proponent', 'critique']),
  year: z.number().optional(),
  citation: z.string(),
  url: z.string().optional(),
  license: z.string().optional(),
  note: z.string().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

export const MeasurementSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/, 'keys are dotted lower-case identifiers'),
  structure: z.string(),
  quantity: z.enum(['length', 'angle', 'latitude', 'longitude', 'elevation', 'count', 'ratio', 'speed', 'time']),
  value: z.number(),
  unit: z.enum(['m', 'deg', 'count', 'ratio', 'm/s', 'day']),
  sigma: z.number().nonnegative().optional(),
  source: z.string(),
  method: z.string().optional(),
  note: z.string().optional(),
  verified: z.boolean().default(false),
  /** Which site the record belongs to; `units` and `constants` records are site-free. */
  site: z.string().default('giza'),
});
export type Measurement = z.infer<typeof MeasurementSchema> & { file: string; order: number };

export const SiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** The observer's body. The sky package is Earth-only for now; a Martian sky needs its own precession. */
  body: z.enum(['earth', 'mars']),
  datum: z.string(),
  origin: z.object({ latitude: z.number(), longitude: z.number(), elevation: z.number() }),
  frame: z.string(),
  note: z.string().optional(),
});
export type Site = z.infer<typeof SiteSchema>;

/**
 * How we know a structure exists. The viewer renders each tier differently
 * and a claim may reference any tier, so a legendary chamber and an excavated
 * one can share the scene without sharing credibility.
 */
export const EVIDENCE_TIERS = ['excavated', 'instrumented', 'claimed', 'legendary'] as const;
export const StructureSchema = z.object({
  id: z.string(),
  site: z.string(),
  name: z.string(),
  evidence: z.enum(EVIDENCE_TIERS),
  source: z.string().optional(),
  note: z.string().optional(),
});
export type Structure = z.infer<typeof StructureSchema>;

export const PresetSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** Sources in order of preference. Sources not listed rank last, in file order. */
  sources: z.array(z.string()).min(1),
  note: z.string().optional(),
});
export type Preset = z.infer<typeof PresetSchema>;

export interface Database {
  sources: Source[];
  sites: Site[];
  structures: Structure[];
  measurements: Measurement[];
  presets: Preset[];
}

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

export interface Resolved {
  preset: Preset;
  /** The winning record for each key. */
  records: Map<string, Measurement>;
  /** key → value, in the database's units (metres, degrees). */
  values: Record<string, number>;
}

/**
 * Pick one record per key: the one whose source appears earliest in the
 * preset's list. Sources the preset does not mention rank after all listed
 * ones, so a key measured by only one source is never lost.
 */
export function resolve(db: Database, presetId: string): Resolved {
  const preset = db.presets.find((p) => p.id === presetId);
  if (!preset) throw new Error(`unknown preset "${presetId}"`);
  const rank = (source: string): number => {
    const i = preset.sources.indexOf(source);
    return i === -1 ? preset.sources.length : i;
  };
  const records = new Map<string, Measurement>();
  for (const m of db.measurements) {
    const current = records.get(m.key);
    if (!current || rank(m.source) < rank(current.source)) records.set(m.key, m);
  }
  const values: Record<string, number> = {};
  for (const [key, m] of records) values[key] = m.value;
  return { preset, records, values };
}

export function sourceById(db: Database, id: string): Source {
  const s = db.sources.find((x) => x.id === id);
  if (!s) throw new Error(`unknown source "${id}"`);
  return s;
}
