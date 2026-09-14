import { describe, expect, it } from 'vitest';
import { loadDatabase, resolve } from '@seked/data';
import { buildEnvironment } from '@seked/geometry';
import { skyEnvironment } from '@seked/sky';
import { evaluateClaim } from './evaluate';
import { identifiers } from './expr';
import { loadClaims } from './registry';
import { renderDossier } from './dossier';

const db = loadDatabase();
const claims = loadClaims();
const env = buildEnvironment(resolve(db, 'canonical').values);
const LATITUDE = env['g1.center.latitude'] as number;
/** What a claim with an epoch actually evaluates against. */
const scopeFor = (epoch: number | undefined) =>
  epoch === undefined ? env : { ...env, ...skyEnvironment({ epoch, latitudeDeg: LATITUDE }) };
const byId = (id: string) => {
  const c = claims.find((x) => x.id === id);
  if (!c) throw new Error(`no claim ${id}`);
  return evaluateClaim(c, env);
};

describe('registry integrity', () => {
  it('loads every claim file', () => {
    expect(claims.map((c) => c.id)).toEqual(expect.arrayContaining(['A1', 'A2', 'A3', 'B1']));
  });
  it('every formula reads only keys that exist in the environment', () => {
    for (const c of claims) {
      if (c.status !== 'computed') continue;
      const scope = scopeFor(c.epoch);
      for (const cmp of c.comparisons) {
        for (const id of [...identifiers(cmp.formula), ...identifiers(cmp.target)]) {
          expect(scope[id], `${c.id}: ${id}`).toBeTypeOf('number');
        }
      }
    }
  });
  it('every cited source exists', () => {
    const ids = new Set(db.sources.map((s) => s.id));
    for (const c of claims) for (const s of [...c.sources.for, ...c.sources.context, ...c.sources.against]) expect(ids.has(s), `${c.id} cites ${s}`).toBe(true);
  });
});

describe('the classic ratios, from data alone', () => {
  it('A1: perimeter over height is 2π within +0.03 %', () => {
    const r = byId('A1');
    const c = r.comparisons[0]!;
    expect(c.residualPct).toBeGreaterThan(0);
    expect(c.residualPct).toBeLessThan(0.05);
    expect(r.fits).toBe(true);
    expect(r.freeChoices).toBe(0);
  });
  it('A2: apothem over half-base is φ within +0.05 %', () => {
    const r = byId('A2');
    expect(Math.abs(r.comparisons[0]!.residualPct)).toBeLessThan(0.05);
    expect(r.fits).toBe(true);
  });
  it('A3: the three candidate slopes sit inside 2′ of the measured angle', () => {
    const r = byId('A3');
    for (const c of r.comparisons) expect(Math.abs(c.absolute) * 60).toBeLessThan(2);
  });
  it('B1: 1:43,200 lands within 0.4 % and 0.7 %', () => {
    const r = byId('B1');
    const [radius, circumference] = r.comparisons;
    expect(radius!.residualPct).toBeCloseTo(-0.38, 1);
    expect(circumference!.residualPct).toBeCloseTo(-0.68, 1);
    expect(r.freeChoices).toBe(2);
  });
  it('B4: the pyramid inch only works on the socket base', () => {
    const r = byId('B4');
    const [casing, socket] = r.comparisons;
    expect(casing!.within).toBe(false);
    expect(socket!.within).toBe(true);
    expect(r.fits).toBe(false);
  });
});

describe('dossier', () => {
  it('renders every claim and the sensitivity table', () => {
    const md = renderDossier(db, claims, { generatedAt: new Date('2026-09-13') });
    expect(md).toContain('# Seked claims dossier');
    for (const c of claims) expect(md).toContain(`### ${c.id} · ${c.title}`);
    expect(md).toContain('Residual by survey preset');
    expect(md).toContain('| petrie-1883 |');
  });
});

describe('the sky reaches the claims only through an epoch', () => {
  const probe = {
    ...(claims.find((c) => c.id === 'A1') as (typeof claims)[number]),
    id: 'Z1',
    comparisons: [{ label: "Thuban's declination", formula: 'star.thuban.dec', target: '1', unit: 'deg' as const }],
  };

  it('a claim without an epoch gets no star keys at all', () => {
    expect(() => evaluateClaim({ ...probe, epoch: undefined }, env)).toThrow(/unknown identifier "star.thuban.dec"/);
  });

  it('a claim with an epoch reads the stars of that epoch', () => {
    const at2450 = evaluateClaim({ ...probe, epoch: -2449 }, env).comparisons[0]!.value;
    const today = evaluateClaim({ ...probe, epoch: 2000 }, env).comparisons[0]!.value;
    expect(at2450).toBeGreaterThan(85);
    expect(today).toBeLessThan(70);
  });
});
