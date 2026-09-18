/**
 * The propose drawer's work, driven by a fake client and a fake runner.
 *
 * Nothing here touches the network and nothing here carries a key. The one
 * test that does call the API counts tokens and nothing else, and it is
 * skipped unless a key is already in the environment, which is the same rule
 * the CLI reads its key under.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type AnthropicClient from '@anthropic-ai/sdk';
import { normaliseClaim, type ClaimFile } from '@seked/claims/browser';
import { ProposalFailed, claimToYaml } from '@seked/runner/browser';
import type { SekedBundle } from './bundle';
import {
  KEY_NAME,
  claimYaml,
  countContextTokens,
  failureWords,
  forgetReaderKey,
  holdBundle,
  proposeContext,
  proposedPath,
  putToModel,
  readerKey,
  resetContext,
  setReaderKey,
  type Proposal,
  type RunnerContext,
  type Stage,
} from './runner';
import { useView } from './store';

/**
 * The runner stands in, so the context can be counted as it is built. The one
 * test that wants the real package asks for it with `importActual`.
 */
const built = vi.hoisted(() => ({ times: 0 }));
// Only the two calls that would reach the network are faked. Everything else
// is the runner's own: `ProposalFailed` above all, because this module tells a
// failed proposal from any other trouble with `instanceof`, and a second copy
// of that class would make the check a lie that passed.
vi.mock('@seked/runner/browser', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@seked/runner/browser')>()),
  runnerContext: () => {
    built.times += 1;
    return { system: 'the grammar, the keys and the rules' };
  },
  proposeClaim: () => Promise.reject(new Error('the fake runner is never asked for a claim')),
}));

/** Local storage as a browser would have it, since vitest runs in Node. */
function fakeStorage(): Storage {
  const held = new Map<string, string>();
  return {
    get length() {
      return held.size;
    },
    clear: () => held.clear(),
    getItem: (k: string) => held.get(k) ?? null,
    key: (i: number) => [...held.keys()][i] ?? null,
    removeItem: (k: string) => void held.delete(k),
    setItem: (k: string, v: string) => void held.set(k, v),
  } as Storage;
}

/**
 * A claim file of the shape the model is asked for. The numbers are C2's, so
 * the file is a plausible one rather than a placeholder, but nothing here is
 * evaluated: the fake runner stands in for the evaluator as well.
 */
const FILE: ClaimFile = {
  id: 'P1',
  title: 'The King’s Chamber south shaft points at Orion’s belt',
  group: 'sky',
  summary: 'The south shaft of the King’s Chamber is said to point at Alnitak at its culmination in 2450 BCE.',
  status: 'computed',
  epoch: -2449,
  comparisons: [
    { label: 'South shaft against Alnitak', formula: 'kc.shaft.south.angle', target: 'alnitak.altitude', unit: 'deg', tolerance_pct: 0.5 },
  ],
  tolerance_pct: 0.5,
  free_choices: ['The epoch is the proponent’s, not the survey’s.'],
  overlay: { type: 'shaft-rays', params: { shafts: ['kc.south'] } },
  sources: { for: ['hancock1995'], context: [], against: [] },
  origin: 'proposed',
  prose: 'The shafts in the Great Pyramid point at Orion’s belt.',
};

const RESULT = { id: 'P1', status: 'computed', comparisons: [], fits: true } as unknown as Proposal['result'];

/** The claim as the store keeps it, which is what the runner hands back beside the file. */
const NORMALISED = normaliseClaim(FILE, 'build/claims/P1.yaml');

const PROPOSAL: Proposal = {
  claim: FILE,
  normalised: NORMALISED,
  result: RESULT,
  repairs: 0,
  usage: { input: 12345, output: 678 },
};

/** A client the fake runner is handed and never calls. Nothing here has a key. */
const fakeClient = { messages: { parse: vi.fn(), countTokens: vi.fn() } } as unknown as AnthropicClient;

// The runner's context is large and entirely derived; only its words are read
// here, so the rest is stubbed rather than built from a bundle the test would
// otherwise have to load.
const context = { system: 'the grammar, the keys and the rules' } as unknown as RunnerContext;

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage());
  useView.setState({ proposed: [], claim: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the reader’s key', () => {
  it('is kept in this browser under one name, and forgotten on request', () => {
    expect(readerKey()).toBeNull();
    setReaderKey('  a-key-the-reader-typed  ');
    expect(localStorage.getItem(KEY_NAME)).toBe('a-key-the-reader-typed');
    expect(readerKey()).toBe('a-key-the-reader-typed');
    forgetReaderKey();
    expect(readerKey()).toBeNull();
  });

  it('treats an empty field as no key at all rather than as a key of no characters', () => {
    setReaderKey('   ');
    expect(readerKey()).toBeNull();
  });

  it('says nothing when the browser has no storage to keep it in', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(readerKey()).toBeNull();
    expect(() => setReaderKey('a-key')).not.toThrow();
  });
});

describe('putting a claim to the model', () => {
  it('puts what comes back in the store and opens it', async () => {
    const stages: Stage[] = [];
    const proposeClaim = vi.fn(async (prose, of, client, options) => {
      // The runner reports its own stages, so the fake reports the ones a
      // proposal that came right first time would.
      options?.onStage?.('asking');
      options?.onStage?.('checking');
      expect(prose).toBe('The shafts in the Great Pyramid point at Orion’s belt.');
      expect(of).toBe(context);
      expect(client).toBe(fakeClient);
      return PROPOSAL;
    });

    const done = await putToModel(
      '  The shafts in the Great Pyramid point at Orion’s belt.  ',
      (stage) => stages.push(stage),
      { client: fakeClient, context, proposeClaim },
    );

    expect(stages).toEqual(['asking', 'checking']);
    expect(done.usage).toEqual({ input: 12345, output: 678 });
    const view = useView.getState();
    expect(view.proposed.map((c) => c.id)).toEqual(['P1']);
    expect(view.claim).toBe('P1');
    // The shorthand is normalised the way a filed claim's is, and the file it
    // would be written to is under build/, never under data/.
    expect(view.proposed[0]?.comparisons).toHaveLength(1);
    expect(view.proposed[0]?.file).toBe('build/claims/P1.yaml');
    expect(view.proposed[0]?.origin).toBe('proposed');
  });

  it('will not ask with nothing to ask about, or with no key', async () => {
    const proposeClaim = vi.fn();
    await expect(putToModel('   ', () => {}, { client: fakeClient, context, proposeClaim })).rejects.toThrow(/Say what the claim is/);
    await expect(putToModel('a claim', () => {}, { context, proposeClaim })).rejects.toThrow(/key/);
    expect(proposeClaim).not.toHaveBeenCalled();
  });

  it('leaves the store alone when the proposal fails, and says why in plain words', async () => {
    const failed = new ProposalFailed(
      [
        {
          answer: null,
          claim: FILE,
          errors: ['g1.base.souths is not a key in the environment', 'the formula does not parse'],
        },
      ],
      { input: 12345, output: 678 },
    );
    const proposeClaim = vi.fn().mockRejectedValue(failed);

    await expect(putToModel('a claim', () => {}, { client: fakeClient, context, proposeClaim })).rejects.toBe(failed);
    expect(useView.getState().proposed).toHaveLength(0);
    expect(useView.getState().claim).toBeNull();
    expect(failureWords(failed)).toBe("The model's claim did not hold up on 2 counts.");
  });

  it('says a single error as the error itself, and a refused key as a refused key', () => {
    const one = new ProposalFailed(
      [{ answer: null, claim: null, errors: ['alnitak.altitude needs an epoch'] }],
      { input: 1, output: 1 },
    );
    expect(failureWords(one)).toBe("The model's claim did not hold up: alnitak.altitude needs an epoch");
    // Anything else, however much it looks like one, is not a failed proposal.
    expect(failureWords(Object.assign(new Error('no'), { errors: ['looks the part'] }))).toBe('no');
    expect(failureWords(new Error('401 authentication_error'))).toMatch(/key was refused/);
    expect(failureWords(new Error('429 rate_limit_error'))).toMatch(/rate limiting/);
    expect(failureWords(new Error('the network went away'))).toBe('the network went away');
  });
});

describe('the file the reader downloads', () => {
  const yaml = claimYaml(FILE, new Date('2026-09-18T00:00:00Z'));

  it('says where it came from before it says anything else', () => {
    const lines = yaml.split('\n');
    expect(lines[0]).toBe('# Proposed 2026-09-18 by claude-opus-5 from the viewer, from these words:');
    expect(lines[1]).toContain('The shafts in the Great Pyramid point at Orion');
    expect(yaml).toContain('move it into data/claims/');
    expect(yaml).toContain('Nobody has read this against a source');
  });

  it('carries the claim’s own keys, the nested ones included', () => {
    expect(yaml).toContain('id: P1');
    expect(yaml).toContain('group: sky');
    expect(yaml).toContain('epoch: -2449');
    expect(yaml).toContain('origin: proposed');
    expect(yaml).toContain('  - label:');
    expect(yaml).toContain('    formula: kc.shaft.south.angle');
    expect(yaml).toContain('  type: shaft-rays');
    expect(yaml).toContain('  context: []');
  });

  it('is the runner’s own file under a header, so the drawer and the shell write one thing', () => {
    const odd = claimYaml({ ...FILE, title: 'yes', notes: 'a: b', summary: 'plain words' }, new Date('2026-09-18T00:00:00Z'));
    // The body is `claimToYaml`'s and not this module's, which is what keeps
    // `pnpm claim` and the download button from writing two different files
    // for the same proposal. Whether that emitter quotes an awkward word is
    // its own business and its own tests.
    const claim = { ...FILE, title: 'yes', notes: 'a: b', summary: 'plain words' };
    const body = claimToYaml(claim);
    for (const line of body.split(String.fromCharCode(10))) expect(odd).toContain(line);
  });

  it('is written under build, never under data', () => {
    expect(proposedPath('P7')).toBe('build/claims/P7.yaml');
    expect(proposedPath('P7')).not.toContain('data/');
  });
});

describe('the context the model is given', () => {
  it('is built once from the bundle the viewer loaded, and again only when that bundle changes', () => {
    resetContext();
    built.times = 0;
    expect(() => proposeContext()).toThrow(/bundle is not loaded/);

    holdBundle({} as SekedBundle);
    const first = proposeContext();
    expect(proposeContext()).toBe(first);
    expect(built.times).toBe(1);

    // A second bundle is a second context; nothing else rebuilds it.
    holdBundle({} as SekedBundle);
    expect(proposeContext()).not.toBe(first);
    expect(built.times).toBe(2);

    resetContext();
    expect(() => proposeContext()).toThrow(/bundle is not loaded/);
  });
});

/**
 * The one test that spends money, and only a token count of it. It runs when
 * a key is already in the environment and is skipped otherwise, so nobody has
 * to hold a key for the suite to be green, and the key never leaves the
 * environment it was read from.
 */
describe.skipIf(!process.env.ANTHROPIC_API_KEY)('the size of what the model is told', () => {
  it('counts the context’s tokens', async () => {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const { buildBundle } = await import('../../../scripts/bundle');
    const runner = (await vi.importActual('@seked/runner/browser')) as {
      runnerContext(bundle: ReturnType<typeof buildBundle>): RunnerContext;
    };
    const client = new Anthropic();
    const of = runner.runnerContext(buildBundle());
    const tokens = await countContextTokens(client, of, FILE.prose ?? '');
    // Printed so the number can go in the commit message; the plan asks for it.
    console.log(`the runner's context is ${tokens} tokens`);
    expect(tokens).toBeGreaterThan(0);
  });
});
