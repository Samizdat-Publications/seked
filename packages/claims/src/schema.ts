/**
 * What a claim file is: the groups, the schema and the normalisation that
 * turns the `formula`/`target` shorthand into a list of comparisons. Reading
 * the files is `./registry`; this module is browser-safe so a viewer can type
 * and render the claims it was handed.
 */
import { z } from 'zod';

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
  /** Absolute tolerance in the comparison's unit, for targets of zero where a percentage is undefined. */
  tolerance_abs: z.number().positive().optional(),
});
export type Comparison = z.infer<typeof ComparisonSchema>;

export const ClaimSchema = z.object({
  id: z.string().regex(/^[A-E]\d+$/),
  title: z.string(),
  group: z.enum(Object.keys(GROUPS) as [Group, ...Group[]]),
  summary: z.string(),
  status: z.enum(['computed', 'needs-sky', 'needs-site']).default('computed'),
  /**
   * Julian epoch the claim is evaluated at, in astronomical year numbering:
   * 2450 BCE is -2449 and 10,450 BCE is -10449. A claim with an epoch gets
   * the star keys of that epoch in its environment; a claim without one
   * never sees the sky.
   */
  epoch: z.number().optional(),
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

