/**
 * The runner against a fake client. Nothing here reaches the network and
 * nothing here needs a key: the model's answer is canned, and what is under
 * test is what the runner does with it.
 */
import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import type { ClaimFile } from '@seked/claims/browser';
import { loadClaims } from '@seked/claims';
import { loadDatabase } from '@seked/data';
import { runnerContext, type RunnerBundle } from './context';
import {
  ProposalFailed,
  RUNNER_MAX_TOKENS,
  RUNNER_MODEL,
  checkProposal,
  proposeClaim,
  type ProposedClaim,
  type RunnerClient,
} from './propose';

const bundle: RunnerBundle = { ...loadDatabase(), claims: loadClaims() };
const context = runnerContext(bundle);

type Params = Parameters<RunnerClient['messages']['parse']>[0];

interface Fake extends RunnerClient {
  calls: Params[];
}

/** A client that answers from a list and records what it was asked. */
function fakeClient(answers: unknown[]): Fake {
  const calls: Params[] = [];
  let next = 0;
  return {
    calls,
    messages: {
      parse(params: Params) {
        calls.push(params);
        if (next >= answers.length) throw new Error('the fake client was asked for more answers than it has');
        return Promise.resolve({
          parsed_output: answers[next++],
          usage: { input_tokens: 1000 + next, output_tokens: 100 + next },
        });
      },
    },
  };
}

const PI_IN_THE_PROFILE: ProposedClaim = {
  title: 'The circle in the stone',
  group: 'proportion',
  summary: 'The base perimeter over the original height is two pi.',
  status: 'computed',
  epoch: null,
  comparisons: [
    {
      label: 'perimeter over height against two pi',
      formula: 'g1.base.perimeter / g1.height.original',
      target: '2 * pi',
      unit: 'ratio',
      tolerance_pct: null,
      tolerance_abs: null,
    },
  ],
  tolerance_pct: 0.5,
  free_choices: [],
  overlay_type: 'ghost-profile',
  overlay_params: '{"slope":"atan(4 / pi)"}',
  sources: { for: ['hancock-1995'], context: ['petrie-1883'], against: [] },
  notes: null,
};

/** The failure a proposal threw, narrowed, so a test can read what is in it. */
async function failureOf(run: Promise<unknown>): Promise<ProposalFailed> {
  try {
    await run;
  } catch (e) {
    if (e instanceof ProposalFailed) return e;
    throw e;
  }
  throw new Error('the proposal was expected to fail and did not');
}

const withComparison = (claim: ProposedClaim, patch: Partial<ProposedClaim['comparisons'][number]>): ProposedClaim => ({
  ...claim,
  comparisons: [{ ...(claim.comparisons[0] as ProposedClaim['comparisons'][number]), ...patch }],
});

describe('putting prose to the model', () => {
  it('grades a well-formed answer and asks once', async () => {
    const client = fakeClient([PI_IN_THE_PROFILE]);
    const proposal = await proposeClaim('the perimeter over the height is two pi', context, client);

    expect(client.calls).toHaveLength(1);
    expect(proposal.repairs).toBe(0);
    expect(proposal.claim.id).toBe('P1');
    expect(proposal.claim.origin).toBe('proposed');
    expect(proposal.claim.prose).toBe('the perimeter over the height is two pi');
    expect(proposal.claim.overlay).toEqual({ type: 'ghost-profile', params: { slope: 'atan(4 / pi)' } });
    expect(proposal.result.fits).toBe(true);
    expect(proposal.result.comparisons[0]?.value).toBeCloseTo(2 * Math.PI, 2);
    expect(proposal.usage).toEqual({ input: 1001, output: 101 });
  });

  it('asks the model the way the project says to ask it', async () => {
    const client = fakeClient([PI_IN_THE_PROFILE]);
    await proposeClaim('two pi', context, client);
    const call = client.calls[0] as Params;
    expect(call.model).toBe(RUNNER_MODEL);
    expect(RUNNER_MODEL).toBe('claude-opus-5');
    expect(call.max_tokens).toBe(RUNNER_MAX_TOKENS);
    expect(RUNNER_MAX_TOKENS).toBe(16000);
    // Thinking is left at its default, which on this model is adaptive.
    expect(call.thinking).toBeUndefined();
    expect(call.system).toEqual([{ type: 'text', text: context.system, cache_control: { type: 'ephemeral' } }]);
    expect(call.output_config?.format?.type).toBe('json_schema');
  });

  it('repairs an answer that names a key which does not exist', async () => {
    const wrong = withComparison(PI_IN_THE_PROFILE, { formula: 'g1.base.circumference / g1.height.original' });
    const client = fakeClient([wrong, PI_IN_THE_PROFILE]);
    const proposal = await proposeClaim('two pi', context, client);

    expect(client.calls).toHaveLength(2);
    expect(proposal.repairs).toBe(1);
    expect(proposal.usage).toEqual({ input: 2003, output: 203 });

    const second = client.calls[1] as Params;
    const turns = second.messages;
    expect(turns).toHaveLength(2);
    expect(String(turns[1]?.content)).toContain('g1.base.circumference');
    expect(String(turns[1]?.content)).toContain('there is no such key');
    // The first turn is untouched, so the cached prefix and the prose both stand.
    expect(turns[0]?.content).toBe((client.calls[0] as Params).messages[0]?.content);
  });

  it('gives up after one repair and carries both attempts', async () => {
    const wrong = withComparison(PI_IN_THE_PROFILE, { formula: 'g1.base.circumference / g1.height.original' });
    const worse = withComparison(PI_IN_THE_PROFILE, { formula: 'g1.base.circumference / g1.height.imagined' });
    const client = fakeClient([wrong, worse]);

    await expect(proposeClaim('two pi', context, client)).rejects.toBeInstanceOf(ProposalFailed);
    expect(client.calls).toHaveLength(2);

    const failure = await failureOf(proposeClaim('two pi', context, fakeClient([wrong, worse])));
    expect(failure.attempts).toHaveLength(2);
    expect(failure.attempts[0]?.errors.join(' ')).toContain('g1.base.circumference');
    expect(failure.attempts[1]?.errors.join(' ')).toContain('g1.height.imagined');
    expect(failure.claim?.title).toBe('The circle in the stone');
    expect(failure.usage).toEqual({ input: 2003, output: 203 });
    expect(failure.message).toContain('did not check out after 2 attempts');
  });

  it('refuses a sky key in a claim with no epoch, and takes it with one', async () => {
    const undated = withComparison(PI_IN_THE_PROFILE, {
      formula: 'kc.shaft.south.angle',
      target: 'star.alnitak.transit.altitude',
      unit: 'deg',
    });
    const failure = await failureOf(proposeClaim('the shaft points at Alnitak', context, fakeClient([undated, undated])));
    expect(failure.errors.join(' ')).toContain('only exists in a claim with an epoch');

    const dated: ProposedClaim = { ...undated, group: 'sky', epoch: -2449, overlay_type: 'shaft-rays', overlay_params: '{}' };
    const proposal = await proposeClaim('the shaft points at Alnitak', context, fakeClient([dated]));
    expect(proposal.claim.epoch).toBe(-2449);
    expect(proposal.result.comparisons[0]?.targetValue).toBeGreaterThan(0);
  });

  it('numbers a proposal against the ids already taken', async () => {
    const proposal = await proposeClaim('two pi', context, fakeClient([PI_IN_THE_PROFILE]), { taken: ['P1', 'P2'] });
    expect(proposal.claim.id).toBe('P3');
    const named = await proposeClaim('two pi', context, fakeClient([PI_IN_THE_PROFILE]), { id: 'P9' });
    expect(named.claim.id).toBe('P9');
  });

  it('takes a real Anthropic client without a cast', () => {
    const client: RunnerClient = new Anthropic({ apiKey: 'not-a-key' });
    expect(typeof client.messages.parse).toBe('function');
  });
});

describe('the checks a claim file has to pass', () => {
  const file: ClaimFile = {
    id: 'P1',
    title: 'x',
    group: 'proportion',
    summary: 'x',
    status: 'computed',
    comparisons: [{ label: 'x', formula: 'g1.base.perimeter', target: 'g1.height.original', unit: 'm' }],
    tolerance_pct: 0.5,
    free_choices: [],
    sources: { for: [], context: [], against: [] },
    origin: 'proposed',
  };

  it('passes a claim built only of keys that exist', () => {
    const checked = checkProposal({ ...file }, context);
    expect(checked.errors).toEqual([]);
    expect(checked.result?.comparisons).toHaveLength(1);
  });

  it('catches a formula that does not parse', () => {
    const checked = checkProposal({ ...file, comparisons: [{ ...(file.comparisons?.[0] as { label: string; formula: string; target: string; unit: 'm' }), formula: 'g1.base.perimeter /' }] }, context);
    expect(checked.errors.join(' ')).toContain('does not parse');
  });

  it('catches an overlay the viewer does not draw', () => {
    const checked = checkProposal({ ...file, overlay: { type: 'interpretive-dance' } }, context);
    expect(checked.errors.join(' ')).toContain('is not one the viewer draws');
  });

  it('catches a source that is not in the project', () => {
    const checked = checkProposal({ ...file, sources: { for: ['von-daniken-1968'], context: [], against: [] } }, context);
    expect(checked.errors.join(' ')).toContain('not a source in this project');
  });
});
