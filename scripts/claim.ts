/**
 * A claim from the shell: somebody's words in, a claim file under `build/` out.
 *
 *     pnpm claim -- "the base perimeter over the height is two pi"
 *     pnpm claim -- --example 1
 *     pnpm claim -- --examples
 *     pnpm claim -- --preset petrie "..."
 *
 * It builds the model's context from the loader, reads the key from the
 * environment or from `~/.seked/keys.env`, puts the prose to `claude-opus-5`,
 * and writes `build/claims/P<n>.yaml` with a header saying when it was asked,
 * what it was asked with and what was said to it. It never writes under
 * `data/`: the only writer it can reach is `writeProposal`, which builds its
 * own path and takes none.
 *
 * What it prints is the dossier's summary row for the claim, so a proposal
 * reads in the same line the filed claims read in, and what the call cost. The
 * dossier's renderer itself is not called on a one-claim list, because it
 * filters proposed claims out by design and would print nothing; the row is
 * built here from the dossier's own exported formatters instead.
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { comparisonSize, formatResidual, loadClaims, type ClaimResult, type ComparisonResult } from '@seked/claims';
import { loadDatabase } from '@seked/data';
import {
  EXAMPLES,
  ProposalFailed,
  RUNNER_MODEL,
  anthropicKey,
  exampleAt,
  proposeClaim,
  proposedIds,
  runnerContext,
  shellClient,
  writeProposal,
  type Proposal,
  type RunnerExample,
} from '@seked/runner';

export type Request =
  | { kind: 'ask'; prose: string; example?: RunnerExample; presetId?: string }
  | { kind: 'examples' }
  | { kind: 'usage' };

const USAGE = [
  'pnpm claim -- "what somebody said"',
  'pnpm claim -- --example N        put example N to the model',
  'pnpm claim -- --examples         list the examples',
  'pnpm claim -- --preset ID "..."  resolve the numbers under another survey preset',
].join('\n');

export function parse(argv: string[]): Request {
  const words: string[] = [];
  let example: RunnerExample | undefined;
  let presetId: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    // `pnpm claim -- "..."` hands the separator through as an argument of its
    // own, and it is not part of what anybody said.
    if (arg === '--') continue;
    if (arg === '--examples') return { kind: 'examples' };
    if (arg === '--help' || arg === '-h') return { kind: 'usage' };
    if (arg === '--example') {
      const next = argv[++i];
      if (next === undefined) return { kind: 'examples' };
      example = exampleAt(Number(next));
      continue;
    }
    if (arg === '--preset') {
      presetId = argv[++i];
      if (presetId === undefined) throw new Error('--preset wants the id of a preset');
      continue;
    }
    words.push(arg);
  }
  if (example) return { kind: 'ask', prose: example.prose, example, presetId };
  const prose = words.join(' ').trim();
  if (!prose) return { kind: 'usage' };
  return { kind: 'ask', prose, presetId };
}

function listExamples(): void {
  console.log('Five things a proponent says. Put one to the model with --example N.\n');
  EXAMPLES.forEach((example, i) => {
    console.log(`${i + 1}. ${example.title} (nearest filed claim: ${example.near})`);
    console.log(`   ${example.prose}`);
    console.log(`   Expect: ${example.expect}\n`);
  });
}

/** The row this claim would have in the dossier's summary table. */
export function dossierRow(result: ClaimResult, freeChoices: number): string {
  const head = [
    '| ID | Claim | Best residual | Worst residual | Within tolerance | Free choices |',
    '|---|---|---:|---:|:---:|:---:|',
  ];
  if (result.status !== 'computed') {
    return [...head, `| ${result.id} | ${result.title} | - | - | pending (${result.status}) | ${freeChoices} |`].join('\n');
  }
  const sorted = [...result.comparisons].sort((a, b) => comparisonSize(a) - comparisonSize(b));
  const best = sorted[0] as ComparisonResult;
  const worst = sorted[sorted.length - 1] as ComparisonResult;
  return [
    ...head,
    `| ${result.id} | ${result.title} | ${formatResidual(best)} | ${formatResidual(worst)} | ${result.fits ? 'yes' : 'no'} | ${freeChoices} |`,
  ].join('\n');
}

export function header(prose: string, example: RunnerExample | undefined, proposal: Proposal, when: Date): string[] {
  const lines = [
    `Proposed by the claims runner on ${when.toISOString().slice(0, 10)} with ${RUNNER_MODEL}.`,
    'Nothing here has been checked against a source by anybody. It is not in',
    'data/claims/ and the runner cannot put it there; a person reads it first',
    'and moves it across by hand, or does not.',
    '',
  ];
  if (example) lines.push(`Example "${example.id}", which stands near ${example.near}.`, '');
  if (proposal.repairs > 0) lines.push('The first answer did not check out and was sent back once.', '');
  lines.push('The words it was proposed from:', '');
  for (const line of prose.split('\n')) lines.push(`  ${line}`);
  return lines;
}

const tokens = (n: number): string => n.toLocaleString('en-US');

async function main(): Promise<number> {
  const request = parse(process.argv.slice(2));
  if (request.kind === 'examples') {
    listExamples();
    return 0;
  }
  if (request.kind === 'usage') {
    console.log(USAGE);
    return 1;
  }

  const context = runnerContext(
    { ...loadDatabase(), claims: loadClaims() },
    request.presetId === undefined ? {} : { presetId: request.presetId },
  );
  const client = shellClient(anthropicKey());

  if (request.example) console.log(`${request.example.title}, which stands near ${request.example.near}.\n`);
  console.log(`> ${request.prose}\n`);
  console.log(
    `asking ${RUNNER_MODEL}, with ${tokens(context.keys.length)} keys and ${context.examples.length} worked examples in front of it ...\n`,
  );

  const when = new Date();
  try {
    const proposal = await proposeClaim(request.prose, context, client, { taken: proposedIds() });
    const path = writeProposal(proposal.claim, header(request.prose, request.example, proposal, when));

    console.log(dossierRow(proposal.result, proposal.claim.free_choices.length));
    console.log('');
    if (proposal.claim.epoch !== undefined) console.log(`  epoch ${proposal.claim.epoch}`);
    for (const c of proposal.result.comparisons) {
      console.log(`  ${c.label}: \`${c.formula}\` against \`${c.target}\` gives ${formatResidual(c)}, ${c.within ? 'within' : 'outside'} tolerance`);
    }
    for (const choice of proposal.claim.free_choices) console.log(`  free choice: ${choice}`);
    console.log('');
    console.log(`wrote ${path}`);
    console.log(
      `${proposal.repairs === 0 ? 'one call' : `${proposal.repairs + 1} calls, one of them a repair`}: ` +
        `${tokens(proposal.usage.input)} tokens in, ${tokens(proposal.usage.output)} out`,
    );
    return 0;
  } catch (e) {
    if (e instanceof ProposalFailed) {
      console.error(`${e.message}\n`);
      e.attempts.forEach((attempt, i) => {
        console.error(`attempt ${i + 1}${attempt.claim ? `, titled "${attempt.claim.title}"` : ', which did not assemble into a claim'}:`);
        for (const error of attempt.errors) console.error(`  - ${error}`);
      });
      console.error(`\n${tokens(e.usage.input)} tokens in, ${tokens(e.usage.output)} out. Nothing was written.`);
      return 1;
    }
    throw e;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === pathToFileURL(fileURLToPath(import.meta.url)).href) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (e: unknown) => {
      console.error((e as Error).message);
      process.exitCode = 1;
    },
  );
}
