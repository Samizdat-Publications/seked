/**
 * The claims runner as the viewer holds it. This first part is the reader's
 * own key and the client built from it.
 *
 * The key is the reader's, so it is kept in this browser under one name, sent
 * to `api.anthropic.com` and nowhere else, and never written into the address
 * bar, a log or a test. Nothing else in the viewer reads it, and nothing that
 * leaves this machine carries it.
 *
 * The drawer in front of it is `ui/Propose.tsx`. The work is here so it can be
 * tested without a renderer, the way the film's run is separate from the
 * film's drawer.
 */
import type { ClaimFile, ClaimResult } from '@seked/claims/browser';
import type AnthropicClient from '@anthropic-ai/sdk';
import * as runnerModule from '@seked/runner/browser';
import type { SekedBundle } from './bundle';

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
