import { loadClaims } from '@seked/claims';
import { loadDatabase, resolve } from '@seked/data';
import { buildEnvironment } from '@seked/geometry';
import { describe, expect, it } from 'vitest';
import { alongSquare, profileOf } from './profile';

const env = buildEnvironment(resolve(loadDatabase(), 'canonical').values);
const p = profileOf(env, loadClaims());

describe("chapter 6's profile", () => {
  it("reads the dossier's A1 and A2", () => {
    // docs/script.md, chapter 6's receipts: 6.28501 against 2π; 1.6187 against φ
    expect(p.a1.value).toBeCloseTo(6.28501, 5);
    expect(p.a1.value).toBeCloseTo(p.perimeter / p.height, 12);
    expect(p.a2[0]!.value).toBeCloseTo(1.6187, 4);
    expect(p.a2[0]!.value).toBeCloseTo(p.apothem / p.half, 12);
  });

  it("reads the dossier's B1 and C1, and the free choices the row counts", () => {
    // chapter 6's receipts: B1 −0.38 % and −0.68 %, 2 free choices; C1 −3′54″ (Dash), none
    expect(p.b1[0]!.residualPct).toBeCloseTo(-0.38, 2);
    expect(p.b1[1]!.residualPct).toBeCloseTo(-0.68, 2);
    expect(p.scale).toBe(43200);
    expect(p.exaggeration).toBe(120);
    expect(p.c1.value * 60).toBeCloseTo(-3.9, 1);
    expect(Object.values(p.claims).map((c) => c.freeChoices)).toEqual([0, 0, 2, 0]);
  });

  it('draws a pyramid whose parts agree: a right triangle, and four sides round', () => {
    expect(Math.hypot(p.half, p.height)).toBeCloseTo(p.apothem, 9);
    expect(p.perimeter).toBeCloseTo(4 * p.side, 9);
    expect(p.half).toBeCloseTo(p.side / 2, 12);
  });

  it('walks the base round from the south-west corner', () => {
    expect(alongSquare(10, 0)).toEqual([-5, -5]);
    expect(alongSquare(10, 10)).toEqual([5, -5]);
    expect(alongSquare(10, 25)).toEqual([0, 5]);
    expect(alongSquare(10, 40)).toEqual([-5, -5]);
  });
});
