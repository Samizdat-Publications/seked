/**
 * A leaf's receipts, computed from the database the way the viewer and the dossier compute them: resolve the
 * preset, build the environment, evaluate each claim the leaf names. Nothing here is a number of its own.
 * Ported from apps/story (retired), which computed a chapter's the same way.
 */
import { evaluateClaim, formatResidual, formatValue, identifiers, type Claim, type ClaimResult, type ComparisonResult } from '@seked/claims/browser';
import { resolve, type Database } from '@seked/data/browser';
import { buildEnvironment, recordsBehind } from '@seked/geometry';

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

/** How far each evidence tier has got, in plain words (the plan's tone rule), weakest first. */
export const TIERS = ['legendary', 'claimed', 'instrumented', 'excavated'] as const;
export const TIER_WORDS: Record<(typeof TIERS)[number], string> = {
  legendary: 'told, never found',
  claimed: 'reported, not yet published or replicated',
  instrumented: 'measured by an instrument and published',
  excavated: 'dug and dated',
};

/**
 * What a claim stands on: the structures behind the records its comparisons read, and the weakest of their tiers. A
 * claim is only as far along as its least certain input. Null when it reads no registered structure (a sky claim's
 * stars, say).
 */
export function claimEvidence(db: Database, claim: Claim, presetId = DEFAULT_PRESET):
  { tier: (typeof TIERS)[number]; words: string; structures: string[] } | null {
  const r = resolve(db, presetId);
  const keys = new Set<string>();
  const add = (key: string, depth = 0): void => {
    if (r.records.has(key)) { keys.add(key); return; }
    if (depth < 4) for (const k of recordsBehind(key, r.values)) add(k, depth + 1);
  };
  for (const c of claim.comparisons) for (const src of [c.formula, c.target]) if (src) for (const id of identifiers(src)) add(id);
  const ids = [...new Set([...keys].map((k) => r.records.get(k)!.structure))];
  const found = ids.map((id) => db.structures.find((s) => s.id === id)).filter((s) => s?.evidence);
  if (!found.length) return null;
  const tier = TIERS[Math.min(...found.map((s) => TIERS.indexOf(s!.evidence as (typeof TIERS)[number])))]!;
  return { tier, words: TIER_WORDS[tier], structures: found.map((s) => s!.name ?? s!.id) };
}
