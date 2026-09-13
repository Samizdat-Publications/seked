import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { DATA_DIR } from '@seked/data';

export const GROUPS = {
  proportion: 'A · Proportion and geometry of the Great Pyramid',
  'earth-scale': 'B · Earth and cosmos scale',
  sky: 'C · Sky',
  'site-plan': 'D · Site plan and geodesy',
  construction: 'E · Mass and construction',
} as const;
export type Group = keyof typeof GROUPS;

const Unit = z.enum(['ratio', 'm', 'deg', 'rc', 'in']);

export const ComparisonSchema = z.object({
  label: z.string(),
  formula: z.string(),
  target: z.string(),
  unit: Unit.default('ratio'),
  tolerance_pct: z.number().positive().optional(),
});
export type Comparison = z.infer<typeof ComparisonSchema>;

export const ClaimSchema = z.object({
  id: z.string().regex(/^[A-E]\d+$/),
  title: z.string(),
  group: z.enum(Object.keys(GROUPS) as [Group, ...Group[]]),
  summary: z.string(),
  status: z.enum(['computed', 'needs-sky', 'needs-site']).default('computed'),
  formula: z.string().optional(),
  target: z.string().optional(),
  unit: Unit.optional(),
  comparisons: z.array(ComparisonSchema).optional(),
  tolerance_pct: z.number().positive().default(0.5),
  free_choices: z.array(z.string()).default([]),
  overlay: z.object({ type: z.string(), params: z.record(z.string(), z.unknown()).optional() }).optional(),
  sources: z.object({
    for: z.array(z.string()).default([]),
    context: z.array(z.string()).default([]),
    against: z.array(z.string()).default([]),
  }).default({ for: [], context: [], against: [] }),
  notes: z.string().optional(),
});
export type ClaimFile = z.infer<typeof ClaimSchema>;

/** A claim with its shorthand normalised into `comparisons`. */
export interface Claim extends Omit<ClaimFile, 'formula' | 'target' | 'unit' | 'comparisons'> {
  comparisons: Comparison[];
  file: string;
}

export function normaliseClaim(raw: ClaimFile, file: string): Claim {
  const { formula, target, unit, comparisons, ...rest } = raw;
  let list: Comparison[] = comparisons ?? [];
  if (formula !== undefined || target !== undefined) {
    if (formula === undefined || target === undefined) throw new Error(`${file}: formula and target go together`);
    if (comparisons) throw new Error(`${file}: use either formula/target or comparisons, not both`);
    list = [{ label: raw.title, formula, target, unit: unit ?? 'ratio' }];
  }
  if (rest.status === 'computed' && list.length === 0) throw new Error(`${file}: a computed claim needs a formula or comparisons`);
  return { ...rest, comparisons: list, file };
}

export function loadClaims(dir = join(DATA_DIR, 'claims')): Claim[] {
  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml')).sort();
  const claims = files.map((file) => {
    const raw = ClaimSchema.parse(parseYaml(readFileSync(join(dir, file), 'utf8')));
    return normaliseClaim(raw, file);
  });
  const ids = new Set<string>();
  for (const c of claims) {
    if (ids.has(c.id)) throw new Error(`duplicate claim id ${c.id}`);
    ids.add(c.id);
  }
  return claims.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}
