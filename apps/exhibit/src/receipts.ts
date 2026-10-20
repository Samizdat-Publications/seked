/**
 * A leaf's receipts, computed from the database the way the viewer and the dossier compute them: resolve the
 * preset, build the environment, evaluate each claim the leaf names. Nothing here is a number of its own.
 * Ported from apps/story (retired), which computed a chapter's the same way.
 */
import { evaluateClaim, formatResidual, formatValue, type Claim, type ClaimResult, type ComparisonResult } from '@seked/claims/browser';
import { resolve, type Database } from '@seked/data/browser';
import { buildEnvironment } from '@seked/geometry';

export const DEFAULT_PRESET = 'canonical';

/** The claims `ids` names, evaluated under `presetId`, in the order named; an id with no claim file is skipped. */
export function leafReceipts(db: Database, claims: Claim[], ids: string[], presetId = DEFAULT_PRESET): ClaimResult[] {
  const env = buildEnvironment(resolve(db, presetId).values);
  return ids
    .map((id) => claims.find((c) => c.id === id))
    .filter((c): c is Claim => c !== undefined)
    .map((c) => evaluateClaim(c, env));
}

/** The environment the claims evaluate in under `presetId`: the monuments, from which a sky claim takes its ground. */
export function groundEnvironment(db: Database, presetId = DEFAULT_PRESET): Record<string, number> {
  return buildEnvironment(resolve(db, presetId).values) as Record<string, number>;
}

/**
 * One comparison as the receipt reads it: measured against claimed, the residual and whether it is inside the
 * band, in the dossier's own formats so the page and docs/dossier.md cannot read differently.
 */
export function receiptLine(c: ComparisonResult): string {
  const band = c.toleranceAbs !== undefined ? `±${formatValue(c.toleranceAbs, c.unit ?? '')}` : `±${c.tolerancePct} %`;
  return `${c.label}: ${formatValue(c.value, c.unit ?? '')} against ${formatValue(c.targetValue, c.unit ?? '')}, ` +
    `off by ${formatResidual(c)}, band ${band}: ${c.within ? 'holds' : 'does not hold'}`;
}
