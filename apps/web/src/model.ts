/**
 * Everything the viewer derives from the bundle, in one place and with no
 * React in sight. The preset resolver, the environment builder and the claim
 * evaluator are the same functions the dossier runs, so a slider that changes
 * one number re-evaluates every claim the way a regenerated dossier would.
 */
import { evaluateClaim, type Claim, type ClaimResult, type ComparisonResult } from '@seked/claims/browser';
import { resolve, type Database, type Measurement, type Resolved } from '@seked/data/browser';
import { buildEnvironment, type Environment } from '@seked/geometry';
import { databaseOf, type SekedBundle } from './bundle';

export const STRUCTURES = ['g1', 'g2', 'g3'] as const;
export type StructureId = (typeof STRUCTURES)[number];

export const STRUCTURE_LABELS: Record<StructureId, string> = {
  g1: 'G1 Khufu',
  g2: 'G2 Khafre',
  g3: 'G3 Menkaure',
};

/**
 * One pyramid as the database has it, in the project frame: +X east, +Y
 * north, +Z up, metres. The same five values and the same two sign flips as
 * blender/generate.py, so the web and Blender place the monuments alike.
 */
export interface PyramidParams {
  id: StructureId;
  label: string;
  base: number;
  height: number;
  /** Today's truncated height, where the database has one. */
  heightToday: number | undefined;
  /** Inward indent of each face's centre line at the base. */
  concavity: number;
  /** Degrees east of north; a few arcminutes at Giza. */
  orientationDeg: number;
  offsetEast: number;
  offsetNorth: number;
  offsetUp: number;
}

export function pyramidParams(values: Record<string, number>, id: StructureId): PyramidParams | undefined {
  const base = values[`${id}.base.side.mean`];
  const height = values[`${id}.height.original`];
  if (base === undefined || height === undefined) return undefined;
  return {
    id,
    label: STRUCTURE_LABELS[id],
    base,
    height,
    heightToday: values[`${id}.height.today`],
    concavity: values[`${id}.concavity`] ?? 0,
    orientationDeg: values[`${id}.orientation`] ?? 0,
    offsetEast: -(values[`${id}.centre.offset.west`] ?? 0),
    offsetNorth: -(values[`${id}.centre.offset.south`] ?? 0),
    offsetUp: values[`${id}.base.elevation.relative`] ?? 0,
  };
}

export interface Model {
  /** The bundle's own records, in the shape resolve() and sourceById() want. */
  db: Database;
  resolved: Resolved;
  /** The resolved values with the cubit override applied, before derivation. */
  values: Record<string, number>;
  env: Environment;
  pyramids: PyramidParams[];
  results: Map<string, ClaimResult>;
  /** The measured royal cubit under this preset, which the slider starts from. */
  measuredCubit: number;
}

/**
 * Resolve a preset, optionally override the royal cubit, derive the
 * environment and evaluate every claim against it.
 */
export function buildModel(bundle: SekedBundle, presetId: string, cubit: number | null): Model {
  const db = databaseOf(bundle);
  const resolved = resolve(db, presetId);
  const measuredCubit = resolved.values['cubit.royal'] ?? 0.5236;
  const values = cubit === null ? resolved.values : { ...resolved.values, 'cubit.royal': cubit };
  const env = buildEnvironment(values);
  const pyramids = STRUCTURES.map((id) => pyramidParams(values, id)).filter((p): p is PyramidParams => p !== undefined);
  const results = new Map<string, ClaimResult>();
  for (const claim of bundle.claims) results.set(claim.id, evaluateClaimSafely(claim, env));
  return { db, resolved, values, env, pyramids, results, measuredCubit };
}

/**
 * A claim whose formula names a key the preset does not carry throws. That is
 * the right answer for the dossier and the wrong one for a viewer, which
 * should say so in the panel and keep the other sixteen claims on screen.
 */
export interface FailedClaim extends ClaimResult {
  error?: string;
}

function evaluateClaimSafely(claim: Claim, env: Environment): FailedClaim {
  try {
    return evaluateClaim(claim, env);
  } catch (e) {
    return {
      id: claim.id,
      title: claim.title,
      group: claim.group,
      status: claim.status,
      freeChoices: claim.free_choices.length,
      comparisons: [],
      fits: undefined,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

const size = (c: ComparisonResult): number => (Number.isFinite(c.residualPct) ? Math.abs(c.residualPct) : Number.POSITIVE_INFINITY);

/** The comparison that fits worst, which is how the dossier grades a claim. */
export function worstComparison(result: ClaimResult): ComparisonResult | undefined {
  return [...result.comparisons].sort((a, b) => size(a) - size(b)).pop();
}

/** The records behind a claim's formulas, for the detail pane's provenance. */
export function recordsFor(keys: string[], resolved: Resolved): Measurement[] {
  return keys.map((k) => resolved.records.get(k)).filter((m): m is Measurement => m !== undefined);
}
