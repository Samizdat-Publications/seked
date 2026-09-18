/**
 * The context is the one place the model is told what exists, so what it says
 * has to be exactly what exists. These tests hold the two ends of that: every
 * key of the environment is named in the prompt, nothing that is not a key is
 * named as one, and the worked examples parse back into the claims they were
 * rendered from.
 */
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { ClaimSchema, GROUPS, evaluate, loadClaims, normaliseClaim, scopeFor } from '@seked/claims';
import { loadDatabase, resolve } from '@seked/data';
import { buildEnvironment } from '@seked/geometry';
import { FUNCTION_NAMES, runnerContext, type RunnerBundle } from './context';

const bundle: RunnerBundle = { ...loadDatabase(), claims: loadClaims() };
const context = runnerContext(bundle);

/** The section of the prompt that lists keys, which is the only place a key is named as one. */
function keySection(): string {
  const from = context.system.indexOf('# The keys');
  const to = context.system.indexOf('# Six filed claims');
  expect(from, 'the prompt has a key section').toBeGreaterThan(-1);
  expect(to, 'the prompt has a worked-examples section').toBeGreaterThan(from);
  return context.system.slice(from, to);
}

const DOTTED = /[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+/g;

describe('the context the model is given', () => {
  it('lists exactly the environment, the sky keys included', () => {
    const expected = new Set([...Object.keys(context.env), ...context.skyKeys]);
    expect(new Set(context.keys.map((k) => k.key))).toEqual(expected);
    expect(context.keys.length).toBe(expected.size);
  });

  it('is the environment the loader builds under the named preset', () => {
    const env = buildEnvironment(resolve(loadDatabase(), context.presetId).values);
    expect(Object.keys(context.env).sort()).toEqual(Object.keys(env).sort());
  });

  it('gives a dated claim its sky and an undated claim none', () => {
    const dated = bundle.claims.find((c) => c.epoch !== undefined);
    expect(dated, 'the register has a dated claim to read the sky keys off').toBeDefined();
    const sky = new Set(context.skyKeys);
    expect(sky.size).toBeGreaterThan(0);
    for (const key of sky) expect(key in context.env, `${key} is a sky key and must not be in the base environment`).toBe(false);
    expect(Object.keys(scopeFor(dated!, context.env)).filter((k) => !(k in context.env)).sort()).toEqual([...sky].sort());
  });

  it('names every key in the prompt', () => {
    const section = keySection();
    const missing = context.keys.map((k) => k.key).filter((key) => !section.includes(key));
    expect(missing).toEqual([]);
  });

  it('names no key that is not in the environment', () => {
    const known = new Set(context.keys.map((k) => k.key));
    // The `### star.thuban` headings name a family, which is a prefix of keys
    // and not a key, so the scan is of the listing lines under them.
    const listed = keySection()
      .split('\n')
      .filter((line) => !line.startsWith('#'))
      .join('\n');
    const named = new Set(listed.match(DOTTED) ?? []);
    expect([...named].filter((key) => !known.has(key))).toEqual([]);
  });

  it('gives every key a unit', () => {
    expect(context.keys.filter((k) => k.unit === 'unknown').map((k) => k.key)).toEqual([]);
  });

  it('names only functions the expression language has', () => {
    // FUNCTIONS is private to packages/claims/src/expr.ts, so the prompt states
    // the list. Evaluating each one is what keeps the statement true.
    for (const fn of FUNCTION_NAMES) {
      const call = fn === 'atan2' ? 'atan2(1, 1)' : `${fn}(1)`;
      expect(() => evaluate(call), `${fn} is named in the prompt`).not.toThrow();
    }
    expect(evaluate('atan(4 / pi)')).toBeCloseTo(51.854, 3);
  });

  it('names every group, every overlay type and every source', () => {
    for (const group of Object.keys(GROUPS)) expect(context.system).toContain(`\`${group}\``);
    for (const overlay of context.overlays) expect(context.system).toContain(`\`${overlay.type}\``);
    for (const id of context.sourceIds) expect(context.system).toContain(`\`${id}\``);
    expect(context.overlays.map((o) => o.type)).toContain('panel');
  });

  it('shows six worked examples that parse back to the claims they came from', () => {
    expect(context.examples.map((e) => e.id)).toEqual(['A1', 'A3', 'B1', 'C2', 'D1', 'D3']);
    for (const example of context.examples) {
      const claim = bundle.claims.find((c) => c.id === example.id);
      expect(claim, `${example.id} is filed`).toBeDefined();
      const parsed = normaliseClaim(ClaimSchema.parse(parseYaml(example.yaml)), claim!.file);
      expect(parsed).toEqual(claim);
      expect(context.system).toContain(example.prose);
      expect(context.system).toContain(example.yaml.trimEnd());
    }
  });

  it('reads the overlay catalogue off the filed claims', () => {
    const ghost = context.overlays.find((o) => o.type === 'ghost-profile');
    expect(ghost?.claims).toContain('A1');
    expect(ghost?.params).toContain('slope');
  });
});
