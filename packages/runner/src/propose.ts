/**
 * Prose in, a claim file the evaluator can grade out.
 *
 * The runner never computes a number and never writes into `data/claims/`. It
 * asks the model for one claim in a fixed shape, checks that shape against the
 * expression language and the environment's keys, hands it to the same
 * evaluator that grades every filed claim, and, if any of that fails, says
 * exactly what failed and asks once more. What comes back is a file for a
 * person to read; where it lands is the caller's business.
 *
 * The client is an argument so the tests can hand in a fake. A real
 * `new Anthropic(...)` satisfies `RunnerClient` as it stands, which is what
 * the CLI and the viewer's drawer pass.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import {
  ClaimSchema,
  ComparisonSchema,
  evaluateClaim,
  identifiers,
  normaliseClaim,
  type Claim,
  type ClaimFile,
  type ClaimResult,
  type Comparison,
} from '@seked/claims/browser';
import { claimFileOf, nextProposedId } from './claim-file';
import type { RunnerContext } from './context';

/** The model. Nothing else. */
export const RUNNER_MODEL = 'claude-opus-5';
/** Room for a claim with a dozen comparisons and a long note, and no more. */
export const RUNNER_MAX_TOKENS = 16000;

/**
 * The shape the model answers in: a claim file, minus the three fields the
 * runner fills in itself. The id is `P` and the next free number, the origin
 * is always `proposed`, and the prose is what went in. `verified` is not a
 * claim field at all and is never asked for; it belongs to a measurement and
 * only a person who has checked a page against a source may set it.
 *
 * The enums are taken off `ClaimSchema` rather than restated, so a unit or a
 * status added to the register reaches the model without anybody remembering
 * to come here. Everything optional is nullable rather than absent, because a
 * structured output is a strict schema and a missing field is not the same
 * thing as a field that is empty. The overlay is flattened into a type and its
 * parameters as JSON text for the same reason: a claim's overlay parameters
 * are free-form, and free-form has no strict schema.
 */
const ProposedComparisonSchema = ComparisonSchema.omit({ unit: true, tolerance_pct: true, tolerance_abs: true }).extend({
  unit: ComparisonSchema.shape.unit.unwrap(),
  tolerance_pct: z.number().positive().nullable().describe('Percentage of the target this comparison allows, or null to use the claim\'s own.'),
  tolerance_abs: z.number().positive().nullable().describe("Absolute tolerance in this comparison's unit. Required when the target is zero; null otherwise."),
});

export const ProposedClaimSchema = z.object({
  title: z.string().describe('A short name for the claim, as a heading.'),
  group: ClaimSchema.shape.group,
  summary: z.string().describe('A sentence or two saying what is compared with what.'),
  status: ClaimSchema.shape.status.unwrap(),
  epoch: z
    .number()
    .nullable()
    .describe('Julian year in astronomical numbering, so 2450 BCE is -2449. Required to name any star. or sun. key, and null otherwise.'),
  comparisons: z.array(ProposedComparisonSchema).describe('One entry per thing the claim asserts. Empty only when the status is not computed.'),
  tolerance_pct: z.number().positive().describe("The claim's own tolerance, as a percentage of each target."),
  free_choices: z.array(z.string()).describe('One short phrase per decision the claim has to make before its numbers line up.'),
  overlay_type: z.string().nullable().describe('One of the overlay types listed, or null.'),
  overlay_params: z.string().describe('The overlay parameters as a JSON object, or {} when there are none.'),
  sources: z.object({
    for: z.array(z.string()),
    context: z.array(z.string()),
    against: z.array(z.string()),
  }),
  notes: z.string().nullable().describe('Anything a reader needs in order to judge what was filed. Null when there is nothing to say.'),
});
export type ProposedClaim = z.infer<typeof ProposedClaimSchema>;

/** What the runner reads off a reply: the parsed answer and what the call cost. */
export interface ProposalReply {
  parsed_output: unknown;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  };
}

/**
 * The one call the runner makes. A real Anthropic client satisfies this, and
 * so does a fake that returns a canned answer, which is how the tests run
 * without a key and without the network.
 */
export interface RunnerClient {
  messages: {
    parse(params: Anthropic.MessageCreateParamsNonStreaming): Promise<ProposalReply>;
  };
}

export interface TokenUsage {
  /** Uncached input. Small here, because the context is cached and the prose is short. */
  input: number;
  output: number;
  /**
   * Input written to the cache, billed at about 1.25 times the input rate. The
   * context is tens of thousands of tokens and the prose beside it is a few
   * hundred, so leaving these two out of the count understates what a proposal
   * cost by a factor of fifty, which is the opposite of useful.
   */
  cacheWrite: number;
  /** Input served from the cache, billed at about a tenth of the input rate. */
  cacheRead: number;
}

/** One round: what the model answered, what it assembled into, and what was wrong with it. */
export interface ProposalAttempt {
  /** The model's answer, as it arrived. Null when it did not fit the shape at all. */
  answer: ProposedClaim | null;
  /** The file the answer assembles into, where it assembles. */
  claim: ClaimFile | null;
  errors: string[];
}

export interface Proposal {
  /** The file, as it would be written under `build/claims/`. */
  claim: ClaimFile;
  /** The same claim normalised, which is what the store keeps and the evaluator took. */
  normalised: Claim;
  result: ClaimResult;
  /** How many times the runner had to send the errors back. Zero when it came right first time. */
  repairs: number;
  usage: TokenUsage;
}

export class ProposalFailed extends Error {
  readonly attempts: ProposalAttempt[];
  readonly usage: TokenUsage;

  constructor(attempts: ProposalAttempt[], usage: TokenUsage) {
    const last = attempts[attempts.length - 1];
    super(
      `the model's claim did not check out after ${attempts.length} ${attempts.length === 1 ? 'attempt' : 'attempts'}: ` +
        (last?.errors.join('; ') ?? 'no answer'),
    );
    this.name = 'ProposalFailed';
    this.attempts = attempts;
    this.usage = usage;
  }

  /** The last file the model got to, or null if it never got to one. */
  get claim(): ClaimFile | null {
    return this.attempts[this.attempts.length - 1]?.claim ?? null;
  }

  get errors(): string[] {
    return this.attempts[this.attempts.length - 1]?.errors ?? [];
  }
}

/**
 * What the runner is doing, in the order it does it. A caller with a line to
 * keep running says these words to a reader; a caller without one passes no
 * hook and the runner is silent. The runner reports its own stages rather
 * than letting a drawer guess at them, because only the runner knows whether
 * an answer came back whole or had to go round again.
 */
export type ProposeStage = 'asking' | 'checking' | 'repairing once';

export interface ProposeOptions {
  /** Told what the runner is doing as it does it. */
  onStage?: (stage: ProposeStage) => void;
  model?: string;
  maxTokens?: number;
  /** The id to give the claim. Default: `P` and the next number free in the bundle. */
  id?: string;
  /** Ids taken beyond the bundle's, such as the files already under `build/claims/`. */
  taken?: string[];
  /** How many times to send the errors back. Default 1, which is one repair round. */
  repairs?: number;
}

/** A sky key exists only inside a claim with an epoch, so naming one without an epoch is its own error. */
const SKY_PREFIX = /^(?:star|sun|sky)\./;

function comparisonOf(c: ProposedClaim['comparisons'][number]): Comparison {
  const out: Comparison = { label: c.label, formula: c.formula, target: c.target, unit: c.unit };
  if (c.tolerance_pct !== null) out.tolerance_pct = c.tolerance_pct;
  if (c.tolerance_abs !== null) out.tolerance_abs = c.tolerance_abs;
  return out;
}

/**
 * The model's answer as a claim file. Anything that stops it being one is an
 * error rather than a throw, so a whole round's worth of errors can go back in
 * one turn instead of the model being corrected one field at a time.
 */
function assemble(answer: ProposedClaim, id: string, prose: string): { claim: ClaimFile | null; errors: string[] } {
  const errors: string[] = [];
  let params: Record<string, unknown> | undefined;
  if (answer.overlay_type !== null) {
    try {
      const parsed: unknown = JSON.parse(answer.overlay_params || '{}');
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        errors.push(`overlay_params must be a JSON object, and "${answer.overlay_params}" is not one`);
      } else {
        params = parsed as Record<string, unknown>;
      }
    } catch (e) {
      errors.push(`overlay_params is not JSON: ${(e as Error).message}`);
    }
  }

  const raw: Record<string, unknown> = {
    id,
    title: answer.title,
    group: answer.group,
    status: answer.status,
    summary: answer.summary,
    comparisons: answer.comparisons.map(comparisonOf),
    tolerance_pct: answer.tolerance_pct,
    free_choices: answer.free_choices,
    sources: answer.sources,
    origin: 'proposed',
    prose,
  };
  if (answer.epoch !== null) raw['epoch'] = answer.epoch;
  if (answer.notes !== null) raw['notes'] = answer.notes;
  if (answer.overlay_type !== null && params) raw['overlay'] = { type: answer.overlay_type, params };

  const parsed = ClaimSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.push(`${issue.path.join('.') || 'the claim'}: ${issue.message}`);
    return { claim: null, errors };
  }
  return { claim: parsed.data, errors };
}

/**
 * Everything that has to be true of a claim file before the evaluator is asked
 * to grade it: the formulas parse, every name in them exists, a sky key comes
 * with an epoch, the overlay is one the viewer draws, the sources are real, and
 * the evaluation itself does not throw.
 */
export function checkProposal(
  claim: ClaimFile,
  context: RunnerContext,
): { normalised: Claim | null; result: ClaimResult | null; errors: string[] } {
  const errors: string[] = [];
  const known = new Set([...Object.keys(context.env), ...context.skyKeys]);
  const sky = new Set(context.skyKeys);

  let normalised: Claim | null = null;
  try {
    normalised = normaliseClaim(claim, `${claim.id}.yaml`);
  } catch (e) {
    errors.push((e as Error).message);
    return { normalised: null, result: null, errors };
  }

  for (const comparison of normalised.comparisons) {
    for (const [side, expression] of [['formula', comparison.formula], ['target', comparison.target]] as const) {
      let names: string[];
      try {
        names = identifiers(expression);
      } catch (e) {
        errors.push(`"${comparison.label}" has a ${side} that does not parse: ${(e as Error).message}`);
        continue;
      }
      for (const name of names) {
        if (!known.has(name)) {
          errors.push(`"${comparison.label}" names ${name} in its ${side}, and there is no such key`);
          continue;
        }
        if (sky.has(name) && normalised.epoch === undefined) {
          errors.push(`"${comparison.label}" names ${name} in its ${side}, which only exists in a claim with an epoch`);
        }
        if (!sky.has(name) && SKY_PREFIX.test(name) && normalised.epoch === undefined) {
          errors.push(`"${comparison.label}" names ${name} in its ${side}, and the sky is only reachable from a claim with an epoch`);
        }
      }
    }
  }

  if (normalised.overlay) {
    const types = context.overlays.map((o) => o.type);
    if (!types.includes(normalised.overlay.type)) {
      errors.push(`the overlay type "${normalised.overlay.type}" is not one the viewer draws; they are ${types.join(', ')}`);
    }
  }

  const sources = new Set(context.sourceIds);
  for (const kind of ['for', 'context', 'against'] as const) {
    for (const id of normalised.sources[kind]) {
      if (!sources.has(id)) errors.push(`sources.${kind} cites "${id}", which is not a source in this project`);
    }
  }

  if (errors.length > 0) return { normalised, result: null, errors };

  let result: ClaimResult;
  try {
    result = evaluateClaim(normalised, context.env);
  } catch (e) {
    errors.push(`the claim does not evaluate: ${(e as Error).message}`);
    return { normalised, result: null, errors };
  }
  return { normalised, result, errors };
}

function firstTurn(prose: string): string {
  return [
    'Here is what somebody said. Turn it into one claim file.',
    '',
    prose.trim(),
  ].join('\n');
}

function repairTurn(attempt: ProposalAttempt): string {
  return [
    'That claim does not check out. What you answered was:',
    '',
    '```json',
    JSON.stringify(attempt.answer, null, 2),
    '```',
    '',
    'and the checks said:',
    '',
    ...attempt.errors.map((e) => `- ${e}`),
    '',
    'Answer again with the whole claim file, corrected. Do not reach for a key that is not in the list, and do not compute a number to get around a key that is missing: if the number the claim needs is not there, say so in the notes and set the status to needs-site.',
  ].join('\n');
}

/**
 * Put somebody's words to the model and get back a claim the evaluator has
 * already graded. On any failure of the checks the errors go back once; after
 * that the runner gives up and throws `ProposalFailed` carrying every attempt.
 */
export async function proposeClaim(
  prose: string,
  context: RunnerContext,
  client: RunnerClient,
  options: ProposeOptions = {},
): Promise<Proposal> {
  const id = options.id ?? nextProposedId([...context.claimIds, ...(options.taken ?? [])]);
  const rounds = (options.repairs ?? 1) + 1;
  const usage: TokenUsage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
  const attempts: ProposalAttempt[] = [];
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: firstTurn(prose) }];

  const say = options.onStage ?? ((): void => {});

  for (let round = 0; round < rounds; round++) {
    say(round === 0 ? 'asking' : 'repairing once');
    const reply = await client.messages.parse({
      model: options.model ?? RUNNER_MODEL,
      max_tokens: options.maxTokens ?? RUNNER_MAX_TOKENS,
      // The context is the same tens of thousands of tokens every time, so it
      // is cached; the prose and the repair turn come after the breakpoint.
      system: [{ type: 'text', text: context.system, cache_control: { type: 'ephemeral' } }],
      messages,
      output_config: { format: zodOutputFormat(ProposedClaimSchema) },
    });
    usage.input += reply.usage.input_tokens;
    usage.output += reply.usage.output_tokens;
    usage.cacheWrite += reply.usage.cache_creation_input_tokens ?? 0;
    usage.cacheRead += reply.usage.cache_read_input_tokens ?? 0;

    say('checking');
    const answered = ProposedClaimSchema.safeParse(reply.parsed_output);
    if (!answered.success) {
      attempts.push({
        answer: null,
        claim: null,
        errors: answered.error.issues.map((i) => `${i.path.join('.') || 'the answer'}: ${i.message}`),
      });
    } else {
      const assembled = assemble(answered.data, id, prose);
      if (assembled.claim === null) {
        attempts.push({ answer: answered.data, claim: null, errors: assembled.errors });
      } else {
        const checked = checkProposal(assembled.claim, context);
        const errors = [...assembled.errors, ...checked.errors];
        if (errors.length === 0 && checked.normalised && checked.result) {
          return {
            claim: claimFileOf(checked.normalised),
            normalised: checked.normalised,
            result: checked.result,
            repairs: round,
            usage,
          };
        }
        attempts.push({ answer: answered.data, claim: assembled.claim, errors });
      }
    }

    const attempt = attempts[attempts.length - 1] as ProposalAttempt;
    if (round + 1 < rounds) messages.push({ role: 'user', content: repairTurn(attempt) });
  }

  throw new ProposalFailed(attempts, usage);
}
