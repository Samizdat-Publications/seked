/**
 * A claim as a file: the normalised claim the viewer and the evaluator carry,
 * turned back into the YAML a person can read and, if they agree with it, move
 * into `data/claims/` by hand. Nothing here writes anything; where the bytes
 * land is `../../scripts/claim.ts`, and it lands them under `build/`.
 *
 * The field order below is the order the filed claims are written in, so a
 * proposal and a filed claim read the same way down the page.
 */
import { stringify } from 'yaml';
import type { Claim, ClaimFile } from '@seked/claims/browser';

const FIELD_ORDER = [
  'id',
  'title',
  'group',
  'status',
  'epoch',
  'summary',
  'formula',
  'target',
  'unit',
  'comparisons',
  'tolerance_pct',
  'free_choices',
  'overlay',
  'sources',
  'notes',
  'origin',
  'prose',
] as const;

/** The file a normalised claim came from, minus the name of that file. */
export function claimFileOf(claim: Claim): ClaimFile {
  const { file: _file, ...rest } = claim;
  return rest;
}

/**
 * The claim as YAML, with an optional header of comment lines above it. The
 * header is where the CLI says the date, the model and the words the claim was
 * proposed from, none of which belong in the record itself.
 */
export function claimToYaml(claim: ClaimFile, header: readonly string[] = []): string {
  const source = claim as unknown as Record<string, unknown>;
  const ordered: Record<string, unknown> = {};
  for (const field of FIELD_ORDER) if (source[field] !== undefined) ordered[field] = source[field];
  for (const field of Object.keys(source)) if (!(field in ordered) && source[field] !== undefined) ordered[field] = source[field];
  const body = stringify(ordered, { lineWidth: 96 });
  if (header.length === 0) return body;
  return `${header.map((line) => (line === '' ? '#' : `# ${line}`)).join('\n')}\n${body}`;
}

/**
 * `P` and the next free number. A proposed claim is numbered against every id
 * already taken: the filed claims of the bundle, and whatever is already in
 * `build/claims/` when the CLI is the caller.
 */
export function nextProposedId(taken: Iterable<string>): string {
  let highest = 0;
  for (const id of taken) {
    const match = /^P(\d+)$/.exec(id);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `P${highest + 1}`;
}
