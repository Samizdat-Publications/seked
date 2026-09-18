/**
 * The claims runner as the viewer holds it: the reader's own key, a client
 * built from it, the context built once out of the bundle already loaded, and
 * the one call that turns prose into a graded claim in the store.
 *
 * Three rules shape this file. The key is the reader's, so it is kept in this
 * browser under one name, sent to `api.anthropic.com` and nowhere else, and
 * never written into the address bar, a log or a test. The claim the model
 * builds is a proposal and not a record, so it goes into the view store and
 * never near `data/claims/`; the reader downloads the file and moves it in by
 * hand after reading it. And the grading is not this module's: the same
 * evaluator that grades every filed claim grades this one, through
 * `@seked/runner`.
 *
 * The drawer in front of it is `ui/Propose.tsx`. The work is here so it can be
 * tested without a renderer, the way the film's run is separate from the film's
 * drawer.
 */
import { normaliseClaim, type Claim, type ClaimFile, type ClaimResult } from '@seked/claims/browser';
import type AnthropicClient from '@anthropic-ai/sdk';
import * as runnerModule from '@seked/runner/browser';
import type { SekedBundle } from './bundle';
import { useView } from './store';

/* ---------------------------------------------------------------- track T */

/*
 * What `@seked/runner/browser` exports, typed here rather than imported.
 *
 * On this branch that package is still the trunk's stub, whose `proposeClaim`
 * rejects with "the claims runner is not here yet", so nothing below would
 * typecheck against it. These are track T's contract as the stage 5 plan
 * states it, and the director reconciles them with the real exports when
 * track T is merged: at that point the whole `RunnerModule` block and the cast
 * under it should come out and the names be imported directly.
 */

/** Everything the model is told: the grammar, the keys, the rules, the worked examples. */
export type RunnerContext = { system?: string } & Record<string, unknown>;

/** What comes back: the file, its grade, how many repairs it took, what it cost. */
export interface Proposal {
  claim: ClaimFile;
  result: ClaimResult;
  repairs: number;
  usage: { input: number; output: number };
}

/** One of the five things a proponent says, ready to be put to the model. */
export interface RunnerExample {
  label?: string;
  prose: string;
  note?: string;
}

/**
 * The stages a proposal passes through, in the order the running line says
 * them. `asking` is set here before the call; the rest arrive from the runner
 * if it reports its own progress, and the line simply stays on `asking` if it
 * does not.
 */
export type Stage = 'asking' | 'checking' | 'repairing once';

export interface ProposeOptions {
  onStage?: (stage: Stage) => void;
}

interface RunnerModule {
  runnerContext(bundle: SekedBundle): RunnerContext;
  proposeClaim(
    prose: string,
    context: RunnerContext,
    client: AnthropicClient,
    options?: ProposeOptions,
  ): Promise<Proposal>;
  /** The error a proposal that could not be repaired throws, carrying the last file and the errors. */
  ProposalFailed?: abstract new (...args: never[]) => Error;
  EXAMPLES?: RunnerExample[];
}

const runner = runnerModule as unknown as RunnerModule;

/** The five examples, or none while the runner is still the stub. */
export const EXAMPLES: RunnerExample[] = runner.EXAMPLES ?? [];

/* ------------------------------------------------------------------ the key */

/**
 * Where the reader's key sits. One name, in this browser's local storage, and
 * nowhere else: not in the address bar, not in the bundle, not in a file. The
 * SDK sends it to `api.anthropic.com` and the viewer never reads it back out
 * for any other purpose.
 */
export const KEY_NAME = 'seked.anthropicKey';

/** Local storage throws rather than returning null in a browser that has shut it off. */
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The key this browser is holding, or null. Never logged and never shown whole. */
export function readerKey(): string | null {
  const held = storage()?.getItem(KEY_NAME) ?? null;
  return held === null || held.trim() === '' ? null : held.trim();
}

/** Keep a key, or forget it when the string is empty. */
export function setReaderKey(key: string): void {
  const store = storage();
  if (store === null) return;
  const trimmed = key.trim();
  if (trimmed === '') store.removeItem(KEY_NAME);
  else store.setItem(KEY_NAME, trimmed);
}

/** The `forget` link. */
export function forgetReaderKey(): void {
  storage()?.removeItem(KEY_NAME);
}

/**
 * The client, with the reader's key.
 *
 * `dangerouslyAllowBrowser` is what the SDK calls running in a page, and the
 * warning behind the name is about shipping somebody else's key to everybody.
 * This key is the reader's own and reaches nothing but the API, which is the
 * case the flag exists for. The SDK itself is fetched only now, so a reader
 * who never opens this drawer never downloads it.
 */
export async function runnerClient(key: string): Promise<AnthropicClient> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
}

/* -------------------------------------------------------------- the context */

let held: SekedBundle | null = null;

/**
 * The bundle the viewer loaded, handed over by `load.ts` so the runner builds
 * its context out of the same numbers the scene is drawn from rather than
 * fetching them again.
 */
export function holdBundle(bundle: SekedBundle): void {
  held = bundle;
}

/**
 * The model's context: every key in the environment, the expression language
 * and the worked examples.
 */
export function proposeContext(): RunnerContext {
  if (held === null) throw new Error('The bundle is not loaded yet, so the model has nothing to be told about.');
  // Track T's runner is what builds this. Until it lands, the package is the
  // trunk's stub and the drawer should say so rather than throw a type error.
  if (typeof runner.runnerContext !== 'function') throw new Error('The claims runner is not in this build of the viewer yet.');
  return runner.runnerContext(held);
}

/* ------------------------------------------------------------- the proposal */

/** What the drawer shows when a proposal fails: the errors in plain words, and the last file. */
export interface Failure {
  errors: string[];
  claim: ClaimFile | null;
}

/**
 * A failed proposal, or null for any other kind of trouble.
 *
 * The runner's own `ProposalFailed` is preferred where the class is exported;
 * the shape check behind it is what keeps this working across the merge, when
 * an error thrown by one copy of the module could otherwise fail an
 * `instanceof` against another.
 */
export function failedProposal(raised: unknown): Failure | null {
  if (typeof raised !== 'object' || raised === null) return null;
  const known = runner.ProposalFailed !== undefined && raised instanceof runner.ProposalFailed;
  const carried = raised as { errors?: unknown; claim?: unknown };
  if (!known && !Array.isArray(carried.errors)) return null;
  const errors = Array.isArray(carried.errors) ? carried.errors.map((e) => String(e)) : [String((raised as Error).message)];
  return { errors, claim: (carried.claim as ClaimFile | undefined) ?? null };
}

/** Anything that went wrong, said the way the drawer says it. */
export function failureWords(raised: unknown): string {
  const failed = failedProposal(raised);
  if (failed !== null) {
    return failed.errors.length === 1
      ? `The model's claim did not hold up: ${failed.errors[0]}`
      : `The model's claim did not hold up on ${failed.errors.length} counts.`;
  }
  const message = raised instanceof Error ? raised.message : String(raised);
  if (/401|authentication|api key/i.test(message)) return 'The key was refused. Check it, or put another one in.';
  if (/429|rate/i.test(message)) return 'The API is rate limiting this key. Wait a moment and ask again.';
  return message;
}

/** Where a proposed claim's file would be written, which is never under `data/`. */
export function proposedPath(id: string): string {
  return `build/claims/${id}.yaml`;
}

/**
 * The runner's parts, injectable so the drawer can be driven by a fake in a
 * test the way `proposeClaim` takes its client as an argument. Left out, they
 * are the real ones.
 */
export interface ProposeDeps {
  client?: AnthropicClient;
  proposeClaim?: RunnerModule['proposeClaim'];
  context?: RunnerContext;
}

/** What a finished proposal leaves behind: the claim in the store, and what it cost. */
export interface Proposed {
  claim: Claim;
  file: ClaimFile;
  result: ClaimResult;
  repairs: number;
  usage: { input: number; output: number };
}

/**
 * Prose in, a graded claim in the store and selected.
 *
 * Nothing here decides whether the claim is any good: the evaluator does that,
 * and a claim that misses by a mile is still a claim and still drawn. What
 * this promises is only that the file parses, that every number in it exists,
 * and that a person can read it before it goes anywhere near `data/`.
 */
export async function putToModel(prose: string, say: (stage: Stage) => void, deps: ProposeDeps = {}): Promise<Proposed> {
  const words = prose.trim();
  if (words === '') throw new Error('Say what the claim is first.');
  const key = readerKey();
  if (key === null && deps.client === undefined) throw new Error('Put your key in first.');

  const client = deps.client ?? (await runnerClient(key as string));
  const of = deps.context ?? proposeContext();
  const ask = deps.proposeClaim ?? runner.proposeClaim;

  say('asking');
  const proposal = await ask(words, of, client, { onStage: say });
  const claim = normaliseClaim(proposal.claim, proposedPath(proposal.claim.id));

  const view = useView.getState();
  view.addProposed(claim);
  // `setClaim` is a toggle, so a second proposal under an id already open
  // would shut it rather than show it.
  if (view.claim !== claim.id) view.setClaim(claim.id);

  return { claim, file: proposal.claim, result: proposal.result, repairs: proposal.repairs, usage: proposal.usage };
}

/* ------------------------------------------------------------ the YAML file */

/** A scalar that needs no quotes: a plain word, number or date, on one line. */
const BARE = /^[A-Za-z0-9][A-Za-z0-9 ._/-]*$/;

function scalar(value: string | number | boolean): string {
  if (typeof value !== 'string') return String(value);
  if (value !== '' && BARE.test(value) && !/^(?:true|false|null|yes|no|on|off)$/i.test(value)) return value;
  return `'${value.replace(/'/g, "''")}'`;
}

/** A block scalar, for the prose and anything else with a line break in it. */
function block(value: string, indent: string): string {
  const lines = value.replace(/\r\n/g, '\n').trimEnd().split('\n');
  return `|-\n${lines.map((line) => `${indent}  ${line}`).join('\n')}`;
}

function emit(value: unknown, indent: string): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const rows = value.map((item) => {
      const inner = emit(item, `${indent}  `);
      // An object or a list of its own opens on a line below; its first row is
      // hoisted onto the dash, and the rest already sit at the right column.
      return `${indent}- ${inner.startsWith('\n') ? inner.slice(indent.length + 3) : inner}`;
    });
    return `\n${rows.join('\n')}`;
  }
  if (typeof value === 'object' && value !== null) {
    const rows = Object.entries(value).filter(([, v]) => v !== undefined);
    if (rows.length === 0) return '{}';
    return `\n${rows.map(([k, v]) => `${indent}${k}:${pad(emit(v, `${indent}  `))}`).join('\n')}`;
  }
  if (typeof value === 'string' && value.includes('\n')) return block(value, indent);
  return scalar(value as string | number | boolean);
}

/** A value that came back as a block starts on its own line; everything else needs a space. */
function pad(emitted: string): string {
  return emitted.startsWith('\n') ? emitted : ` ${emitted}`;
}

/**
 * The claim as the file the CLI would have written: the same keys in the same
 * order, under a header saying when it was proposed, by which model and from
 * whose words. The header is the reason the file cannot be mistaken for one of
 * the filed claims if it ends up in the wrong folder.
 */
export function claimYaml(file: ClaimFile, on = new Date()): string {
  const date = on.toISOString().slice(0, 10);
  const prose = (file.prose ?? '').replace(/\s+/g, ' ').trim();
  const header = [
    `# Proposed by the Seked claims runner on ${date} with claude-opus-5.`,
    `# From: ${prose}`,
    '# Nothing here is verified and no source has been read against it. Read it,',
    '# then move it into data/claims/ by hand if it belongs there.',
    '',
  ];
  const ordered: [string, unknown][] = [
    ['id', file.id],
    ['title', file.title],
    ['group', file.group],
    ['summary', file.summary],
    ['status', file.status],
    ['epoch', file.epoch],
    ['formula', file.formula],
    ['target', file.target],
    ['unit', file.unit],
    ['comparisons', file.comparisons],
    ['tolerance_pct', file.tolerance_pct],
    ['free_choices', file.free_choices],
    ['overlay', file.overlay],
    ['sources', file.sources],
    ['notes', file.notes],
    ['origin', file.origin],
    ['prose', file.prose],
  ];
  const body = ordered
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}:${pad(emit(value, '  '))}`);
  return `${[...header, ...body].join('\n')}\n`;
}

/** Hand the reader the file. Nothing is written anywhere the viewer can reach. */
export function downloadClaim(file: ClaimFile): void {
  const blob = new Blob([claimYaml(file)], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${file.id}.yaml`;
  link.click();
  URL.revokeObjectURL(url);
}
