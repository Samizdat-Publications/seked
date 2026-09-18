/**
 * The shell's own parts: what it makes of a command line, and the row it
 * prints. The call to the model is not here; that is `proposeClaim`, which has
 * its own tests and its own fake client.
 */
import { describe, expect, it } from 'vitest';
import { evaluateClaim, loadClaims, normaliseClaim, type ClaimFile } from '@seked/claims';
import { loadDatabase, resolve } from '@seked/data';
import { buildEnvironment } from '@seked/geometry';
import { EXAMPLES, type Proposal } from '@seked/runner';
import { dossierRow, header, parse } from './claim';

const env = buildEnvironment(resolve(loadDatabase(), 'canonical').values);

const file: ClaimFile = {
  id: 'P1',
  title: 'The circle in the stone',
  group: 'proportion',
  summary: 'The base perimeter over the original height is two pi.',
  status: 'computed',
  comparisons: [
    { label: 'perimeter over height', formula: 'g1.base.perimeter / g1.height.original', target: '2 * pi', unit: 'ratio' },
  ],
  tolerance_pct: 0.5,
  free_choices: [],
  sources: { for: [], context: [], against: [] },
  origin: 'proposed',
  prose: 'two pi',
};

describe('what the shell makes of a command line', () => {
  it('takes the words as the prose', () => {
    expect(parse(['the', 'perimeter', 'over', 'the', 'height'])).toEqual({
      kind: 'ask',
      prose: 'the perimeter over the height',
      presetId: undefined,
    });
  });

  it("drops pnpm's own separator rather than reading it as a word", () => {
    expect(parse(['--', 'two', 'pi'])).toEqual({ kind: 'ask', prose: 'two pi', presetId: undefined });
    expect(parse(['--', '--examples']).kind).toBe('examples');
  });

  it('takes an example by its number, counted from one', () => {
    const request = parse(['--example', '3']);
    expect(request.kind).toBe('ask');
    if (request.kind !== 'ask') return;
    expect(request.example).toBe(EXAMPLES[2]);
    expect(request.prose).toBe(EXAMPLES[2]?.prose);
  });

  it('takes a preset beside the prose', () => {
    expect(parse(['--preset', 'petrie', 'two', 'pi'])).toEqual({ kind: 'ask', prose: 'two pi', presetId: 'petrie' });
    expect(() => parse(['--preset'])).toThrow(/wants the id of a preset/);
  });

  it('lists the examples, and says how to be used when it is given nothing', () => {
    expect(parse(['--examples']).kind).toBe('examples');
    expect(parse(['--example']).kind).toBe('examples');
    expect(parse([]).kind).toBe('usage');
    expect(parse(['--help']).kind).toBe('usage');
  });

  it('refuses an example that is not there', () => {
    expect(() => parse(['--example', '9'])).toThrow(/there is no example 9/);
  });
});

describe('the row it prints', () => {
  it('is the dossier summary table, one claim wide', () => {
    const result = evaluateClaim(normaliseClaim(file, 'P1.yaml'), env);
    const row = dossierRow(result, 0).split('\n');
    expect(row[0]).toBe('| ID | Claim | Best residual | Worst residual | Within tolerance | Free choices |');
    expect(row[2]).toMatch(/^\| P1 \| The circle in the stone \| [+−][\d.]+ % \| [+−][\d.]+ % \| yes \| 0 \|$/);
  });

  it('says pending rather than a residual for a claim that cannot be computed', () => {
    const pending = normaliseClaim({ ...file, status: 'needs-site', comparisons: [] }, 'P1.yaml');
    const row = dossierRow(evaluateClaim(pending, env), 2).split('\n');
    expect(row[2]).toBe('| P1 | The circle in the stone | - | - | pending (needs-site) | 2 |');
  });

  it('reads the same way a filed claim does', () => {
    const a1 = loadClaims().find((c) => c.id === 'A1');
    expect(a1).toBeDefined();
    const row = dossierRow(evaluateClaim(a1!, env), a1!.free_choices.length).split('\n');
    expect(row[2]).toContain('| A1 | π in the profile |');
  });
});

describe('the header above a proposal', () => {
  const proposal = {
    claim: file,
    normalised: normaliseClaim(file, 'P1.yaml'),
    result: evaluateClaim(normaliseClaim(file, 'P1.yaml'), env),
    repairs: 0,
    usage: { input: 1, output: 1, cacheWrite: 0, cacheRead: 0 },
  } as Proposal;

  it('says the date, the model, and that nobody has read it', () => {
    const lines = header('two pi', undefined, proposal, new Date('2026-09-18T12:00:00Z'));
    expect(lines[0]).toBe('Proposed by the claims runner on 2026-09-18 with claude-opus-5.');
    expect(lines.join('\n')).toContain('data/claims/ and the runner cannot put it there');
    expect(lines.join('\n')).toContain('  two pi');
  });

  it('says when an answer had to be sent back, and which example it was', () => {
    const lines = header('two pi', EXAMPLES[0], { ...proposal, repairs: 1 }, new Date('2026-09-18T12:00:00Z'));
    expect(lines.join('\n')).toContain('was sent back once');
    expect(lines.join('\n')).toContain(`Example "${EXAMPLES[0]?.id}", which stands near ${EXAMPLES[0]?.near}`);
  });
});
