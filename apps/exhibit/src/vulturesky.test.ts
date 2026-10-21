import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { evaluateClaim, loadClaims } from '@seked/claims';
import { loadDatabase, resolve } from '@seked/data';
import { buildEnvironment } from '@seked/geometry';
import { describe, expect, it } from 'vitest';
import { NIGHTS } from '../../../scripts/nights';
import { buildSkyData } from './skydata';
import { ecliptic, vultureChart, vultureChartSvg } from './vulturesky';

const repo = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(repo, 'data', p), 'utf8');
const yaml = createRequire(join(repo, 'packages', 'claims', 'package.json'))('yaml') as { parse: (s: string) => never };
const claims = readdirSync(join(repo, 'data', 'claims')).filter((f) => f.endsWith('.yaml')).map((f) => yaml.parse(read(`claims/${f}`)));
const data = buildSkyData(JSON.parse(read('sites.json')), JSON.parse(read('stars/hyg-bright.json')), JSON.parse(read('stars/named.json')), claims, JSON.parse(read('stars/figures.json')), NIGHTS);

describe("C8's sky chart", () => {
  const v = vultureChart(data)!;
  it('puts the equinox at 0 and the solstice at 90 of longitude', () => {
    expect(ecliptic(0, 0, 23.4)[0]).toBeCloseTo(0, 9);
    const [lam, beta] = ecliptic(90, 23.4, 23.4);
    expect(lam).toBeCloseTo(90, 9);
    expect(beta).toBeCloseTo(0, 9);
  });
  it("gives the same miss as the claims engine's C8", () => {
    const db = loadDatabase();
    const c8 = loadClaims().find((c) => c.id === 'C8')!;
    const r = evaluateClaim(c8, buildEnvironment(resolve(db, 'canonical').values));
    expect(v.residual).toBeCloseTo(r.comparisons[0]!.absolute, 6);
  });
  it("draws the five constellations the claim's overlay pairs with the animals, and the spout", () => {
    expect(v.figures.map((f) => f.key).sort()).toEqual(['Lib', 'Lup', 'Oph', 'Sco', 'Sgr']);
    expect(v.figures.find((f) => f.key === 'Sgr')!.animal).toBe('the vulture');
    const svg = vultureChartSvg(v);
    expect(svg).toContain('Alnasl, the spout');
    expect(svg).toContain('10,950 BCE');
  });
});
