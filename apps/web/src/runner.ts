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
import type { Claim as RunnerClaim, ClaimFile, ClaimResult } from '@seked/claims/browser';
import type AnthropicClient from '@anthropic-ai/sdk';
import {
  EXAMPLES,
  RUNNER_MODEL,
  ProposalFailed,
  claimToYaml,
  proposeClaim,
  runnerContext,
  type Proposal,
  type ProposeOptions,
  type ProposeStage,
  type RunnerContext,
  type RunnerExample,
} from '@seked/runner/browser';
import type { SekedBundle } from './bundle';
import { useView } from './store';

export { EXAMPLES };
export type { Proposal, ProposeOptions, RunnerContext, RunnerExample };
/** The stages the running line says, as the runner itself reports them. */
export type Stage = ProposeStage;

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
let context: RunnerContext | null = null;

/**
 * The bundle the viewer loaded, handed over by `load.ts` so the runner builds
 * its context out of the same numbers the scene is drawn from rather than
 * fetching them again.
 */
export function holdBundle(bundle: SekedBundle): void {
  held = bundle;
  context = null;
}

/**
 * The model's context, built once and kept. It is every key in the
 * environment, the expression language and the worked examples, which is a
 * large and entirely static thing, so building it per proposal would be
 * wasted work on every key the reader types.
 */
export function proposeContext(): RunnerContext {
  if (context !== null) return context;
  if (held === null) throw new Error('The bundle is not loaded yet, so the model has nothing to be told about.');
  context = runnerContext(held);
  return context;
}

/** Forget the built context. For the tests, and for a reader who reloads nothing. */
export function resetContext(): void {
  held = null;
  context = null;
}

/** The words of the context, for counting its tokens. */
export function contextText(of: RunnerContext): string {
  return of.system;
}

/**
 * How many tokens the model is asked to read before it writes anything. Used
 * by the test that runs only when a key is in the environment; the drawer
 * never calls it, because a reader does not need a token count to ask a
 * question.
 */
export async function countContextTokens(client: AnthropicClient, of: RunnerContext, prose: string): Promise<number> {
  const counted = await client.messages.countTokens({
    model: RUNNER_MODEL,
    system: contextText(of),
    messages: [{ role: 'user', content: prose }],
  });
  return counted.input_tokens;
}

/* ------------------------------------------------------------- the proposal */

/** What the drawer shows when a proposal fails: the errors in plain words, and the last file. */
export interface Failure {
  errors: string[];
  claim: ClaimFile | null;
}

/** A failed proposal, or null for any other kind of trouble. */
export function failedProposal(raised: unknown): Failure | null {
  if (!(raised instanceof ProposalFailed)) return null;
  return { errors: raised.errors, claim: raised.claim };
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
  proposeClaim?: typeof proposeClaim;
  context?: RunnerContext;
}

/** What a finished proposal leaves behind: the claim in the store, and what it cost. */
export interface Proposed {
  claim: RunnerClaim;
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
  const ask = deps.proposeClaim ?? proposeClaim;

  const proposal = await ask(words, of, client, { onStage: say });
  const claim = { ...proposal.normalised, file: proposedPath(proposal.claim.id) };

  const view = useView.getState();
  view.addProposed(claim);
  // `setClaim` is a toggle, so a second proposal under an id already open
  // would shut it rather than show it.
  if (view.claim !== claim.id) view.setClaim(claim.id);

  return { claim, file: proposal.claim, result: proposal.result, repairs: proposal.repairs, usage: proposal.usage };
}

/* ------------------------------------------------------------ the YAML file */

/**
 * The file the reader downloads, which is the one `pnpm claim` would have
 * written: the same emitter in `@seked/runner`, so the shell and the drawer
 * cannot drift into writing two different files for the same proposal.
 */
export function claimYaml(file: ClaimFile, on = new Date()): string {
  return claimToYaml(file, [
    `Proposed ${on.toISOString().slice(0, 10)} by ${RUNNER_MODEL} from the viewer, from these words:`,
    ...(file.prose ?? '').split('\\n').map((line) => `  ${line}`),
    '',
    'Nobody has read this against a source. It is not a record until somebody has:',
    'drop the origin and prose lines, check every figure against the page it cites,',
    'and only then move it into data/claims/ and run pnpm bundle.',
  ]);
}

export function downloadClaim(file: ClaimFile): void {
  const blob = new Blob([claimYaml(file)], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${file.id}.yaml`;
  link.click();
  URL.revokeObjectURL(url);
}
