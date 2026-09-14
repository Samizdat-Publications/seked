import type { Environment } from '@seked/geometry';
import { skyEnvironment } from '@seked/sky/browser';
import { evaluate } from './expr';
import type { Claim, Comparison } from './schema';

export interface ComparisonResult extends Comparison {
  value: number;
  targetValue: number;
  /** (value − target) / target, in percent. */
  residualPct: number;
  /** value − target, in the comparison's unit. */
  absolute: number;
  tolerancePct: number;
  /** Set when the comparison declares tolerance_abs; the fit then ignores the percentage. */
  toleranceAbs?: number;
  within: boolean;
}

export interface ClaimResult {
  id: string;
  title: string;
  group: Claim['group'];
  status: Claim['status'];
  freeChoices: number;
  comparisons: ComparisonResult[];
  /** True when every comparison is within tolerance. Undefined for claims that cannot be computed yet. */
  fits: boolean | undefined;
}

export function evaluateComparison(c: Comparison, env: Environment, defaultTolerancePct: number): ComparisonResult {
  const value = evaluate(c.formula, env);
  const targetValue = evaluate(c.target, env);
  const residualPct = targetValue === 0 ? Number.NaN : ((value - targetValue) / targetValue) * 100;
  const tolerancePct = c.tolerance_pct ?? defaultTolerancePct;
  return {
    ...c,
    value,
    targetValue,
    residualPct,
    absolute: value - targetValue,
    tolerancePct,
    toleranceAbs: c.tolerance_abs,
    within: c.tolerance_abs !== undefined ? Math.abs(value - targetValue) <= c.tolerance_abs : Math.abs(residualPct) <= tolerancePct,
  };
}

/**
 * How badly a comparison misses, on one scale, so that the comparisons of a
 * claim can be ranked against each other. A target of zero has no percentage
 * to give, so a comparison whose residual is not finite is sized by how much
 * of its absolute tolerance it spends, and by the bare miss when it declares
 * no absolute tolerance either. Sizing those at infinity instead would tie
 * every comparison of a claim whose targets are all zero and leave file order
 * to decide which one is the worst.
 */
export function comparisonSize(c: ComparisonResult): number {
  if (Number.isFinite(c.residualPct)) return Math.abs(c.residualPct);
  return c.toleranceAbs === undefined ? Math.abs(c.absolute) : Math.abs(c.absolute) / c.toleranceAbs;
}

/** The comparison of a claim that misses worst, which is how it is graded. */
export function worstComparison(result: ClaimResult): ComparisonResult | undefined {
  return [...result.comparisons].sort((a, b) => comparisonSize(a) - comparisonSize(b)).pop();
}

/**
 * The environment a claim actually evaluates against: the measured and
 * derived keys, plus the stars of the claim's epoch when it has one. The
 * observer is the Great Pyramid's base centre until sites reach the
 * environment; every sky claim so far is watched from Giza.
 */
export function scopeFor(claim: Claim, env: Environment): Environment {
  if (claim.epoch === undefined) return env;
  const latitudeDeg = env['g1.center.latitude'];
  if (latitudeDeg === undefined) throw new Error(`${claim.id} has an epoch but the environment carries no g1.center.latitude`);
  // The longitude is not demanded the way the latitude is. It decides only
  // which local day the dated sun's clock times belong to, no claim names one
  // of those keys yet, and `skyEnvironment` falls back to Greenwich without it.
  return { ...env, ...skyEnvironment({ epoch: claim.epoch, latitudeDeg, longitudeDeg: env['g1.center.longitude'] }) };
}

export function evaluateClaim(claim: Claim, env: Environment): ClaimResult {
  const scope = scopeFor(claim, env);
  const comparisons = claim.status === 'computed'
    ? claim.comparisons.map((c) => evaluateComparison(c, scope, claim.tolerance_pct))
    : [];
  return {
    id: claim.id,
    title: claim.title,
    group: claim.group,
    status: claim.status,
    freeChoices: claim.free_choices.length,
    comparisons,
    fits: claim.status === 'computed' ? comparisons.every((c) => c.within) : undefined,
  };
}
