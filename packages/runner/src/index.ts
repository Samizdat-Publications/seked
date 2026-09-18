/**
 * The Node entry: the browser-safe runner plus the two things that touch the
 * disk, the key and the file.
 *
 * A proposed claim written from here goes under `build/claims/` and nowhere
 * else. That is a fact about this module rather than a promise about its
 * caller: `writeProposal` takes a claim and not a path, builds the path itself
 * out of `PROPOSED_DIR` and the claim's own id, refuses an id that is not a
 * proposal's, and checks the result is still inside `PROPOSED_DIR` before it
 * opens anything. There is no argument to point it at `data/claims/` with.
 */
import Anthropic from '@anthropic-ai/sdk';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve as resolvePath } from 'node:path';
import type { ClaimFile } from '@seked/claims/browser';
import { REPO_ROOT } from '@seked/data';
import { claimToYaml } from './claim-file';

export * from './browser';

/**
 * The only directory the runner writes a claim into. `build/` is gitignored, so
 * a proposal exists on the machine that asked for it and nowhere else until a
 * person has read it and moved it across.
 */
export const PROPOSED_DIR = join(REPO_ROOT, 'build', 'claims');

/** Where the keys live, beside SKETCHFAB_TOKEN and MESHY_API_KEY. */
export const KEYS_FILE = join(homedir(), '.seked', 'keys.env');

const PROPOSED_ID = /^P\d+$/;

/** The proposals already written, so the next one is numbered past them. */
export function proposedIds(dir = PROPOSED_DIR): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => f.slice(0, -'.yaml'.length))
    .filter((id) => PROPOSED_ID.test(id));
}

/**
 * Write a proposal under `build/claims/`, and return where it went. The header
 * is comment lines above the record: the date, the model and the words the
 * claim was proposed from, none of which belong in the record itself.
 */
export function writeProposal(claim: ClaimFile, header: readonly string[] = []): string {
  if (!PROPOSED_ID.test(claim.id)) {
    throw new Error(`${claim.id} is not a proposal's id, and only a proposal is written from here`);
  }
  if (claim.origin !== 'proposed') {
    throw new Error(`${claim.id} is ${claim.origin}, and only a proposed claim is written from here`);
  }
  const path = resolvePath(join(PROPOSED_DIR, `${claim.id}.yaml`));
  const inside = relative(PROPOSED_DIR, path);
  if (inside.startsWith('..') || inside.includes('/') || inside.includes('\\')) {
    throw new Error(`${path} is outside ${PROPOSED_DIR}, and the runner writes nowhere else`);
  }
  mkdirSync(PROPOSED_DIR, { recursive: true });
  writeFileSync(path, claimToYaml(claim, header));
  return path;
}

/**
 * The key, from the environment or from `~/.seked/keys.env`. It is never
 * printed, never written, and never put anywhere a URL could carry it; what is
 * printed when it is missing is the name of the file it should be in.
 */
export function anthropicKey(env: NodeJS.ProcessEnv = process.env, keysFile = KEYS_FILE): string {
  const fromEnvironment = env['ANTHROPIC_API_KEY'];
  if (fromEnvironment) return fromEnvironment.trim();
  if (existsSync(keysFile)) {
    for (const line of readFileSync(keysFile, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.startsWith('ANTHROPIC_API_KEY=')) {
        const value = trimmed.slice('ANTHROPIC_API_KEY='.length).trim();
        if (value) return value;
      }
    }
  }
  throw new Error(`no Anthropic key: set ANTHROPIC_API_KEY, or put ANTHROPIC_API_KEY=... in ${keysFile}`);
}

/**
 * The client the shell uses, with the key off the environment or the keys
 * file. The viewer builds its own, with the reader's key and the SDK's
 * `dangerouslyAllowBrowser`; this one is for a machine that has the file.
 */
export function shellClient(apiKey: string = anthropicKey()): Anthropic {
  return new Anthropic({ apiKey });
}
