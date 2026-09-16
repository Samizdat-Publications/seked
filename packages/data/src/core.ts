/**
 * The part of @seked/data that never touches a disk: the schemas, the types
 * and the preset resolver. The Node entry (`index.ts`) adds the loaders; the
 * browser entry (`browser.ts`) re-exports this module and nothing else, so a
 * viewer can resolve a preset from a bundle without a filesystem.
 */
import { z } from 'zod';

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

/**
 * One monument's outline from the footprint import, already in the project
 * frame and set on the scene's ground. See scripts/footprints.ts for how it
 * got there and packages/geometry/src/footprints.ts for what is built from it.
 */
export const FootprintSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['prism', 'pyramid', 'pit']),
  group: z.string(),
  osm: z.number().int().optional(),
  base: z.number(),
  bases: z.array(z.number()).optional(),
  records: z.array(z.string()).optional(),
  height: z.number().positive().optional(),
  minHeight: z.number().nonnegative().optional(),
  heightKey: z.string().optional(),
  depthKey: z.string().optional(),
  batterKey: z.string().optional(),
  area: z.number().positive(),
  ring: z.array(z.tuple([z.number(), z.number()])).min(3),
});
export type FootprintRecord = z.infer<typeof FootprintSchema>;

/** The footprint import as written: its provenance, the registration fit, and the outlines. */
export const FootprintFileSchema = z.object({
  source: z.string(),
  attribution: z.string(),
  osmBase: z.string(),
  query: z.string(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  preset: z.string(),
  registration: z.object({
    method: z.string(),
    origin: z.object({ latitude: z.number(), longitude: z.number() }),
    rotationArcmin: z.number(),
    translation: z.tuple([z.number(), z.number()]),
    residuals: z.record(z.string(), z.number().nonnegative()),
    unfittedScale: z.number().positive(),
  }),
  features: z.array(FootprintSchema),
});
export type FootprintFile = z.infer<typeof FootprintFileSchema>;

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
