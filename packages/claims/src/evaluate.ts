import type { Environment } from '@seked/geometry';
import { evaluate } from './expr';
import type { Claim, Comparison } from './registry';

export interface ComparisonResult extends Comparison {
  value: number;
  targetValue: number;
  /** (value − target) / target, in percent. */
  residualPct: number;
  /** value − target, in the comparison's unit. */
  absolute: number;
  tolerancePct: number;
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
  const residualPct = ((value - targetValue) / targetValue) * 100;
  const tolerancePct = c.tolerance_pct ?? defaultTolerancePct;
  return {
    ...c,
    value,
    targetValue,
    residualPct,
    absolute: value - targetValue,
    tolerancePct,
    within: Math.abs(residualPct) <= tolerancePct,
  };
}

export function evaluateClaim(claim: Claim, env: Environment): ClaimResult {
  const comparisons = claim.status === 'computed'
    ? claim.comparisons.map((c) => evaluateComparison(c, env, claim.tolerance_pct))
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
