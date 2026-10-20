import { loadClaims } from '@seked/claims';
import { loadDatabase, resolve } from '@seked/data';
import { buildEnvironment } from '@seked/geometry';
import { describe, expect, it } from 'vitest';
import { alongSquare, profileOf } from './profile';

const env = buildEnvironment(resolve(loadDatabase(), 'canonical').values);
const claim = (id: string) => loadClaims().find((c) => c.id === id)!;
const p = profileOf(env, claim('A1'), claim('A2'));

describe("chapter 6's profile", () => {
  it("reads the dossier's A1 and A2", () => {
    // docs/script.md, chapter 6's receipts: 6.28501 against 2π; 1.6187 against φ
    expect(p.a1.value).toBeCloseTo(6.28501, 5);
    expect(p.a1.value).toBeCloseTo(p.perimeter / p.height, 12);
    expect(p.a2[0]!.value).toBeCloseTo(1.6187, 4);
    expect(p.a2[0]!.value).toBeCloseTo(p.apothem / p.half, 12);
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
