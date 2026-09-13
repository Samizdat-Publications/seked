import { describe, expect, it } from 'vitest';
import { evaluate, identifiers, parse } from './expr';

describe('expression language', () => {
  it('respects precedence and associativity', () => {
    expect(evaluate('1 + 2 * 3')).toBe(7);
    expect(evaluate('(1 + 2) * 3')).toBe(9);
    expect(evaluate('2 ^ 3 ^ 2')).toBe(512);
    expect(evaluate('-2 ^ 2')).toBe(-4);
    expect(evaluate('2 ^ -1')).toBe(0.5);
    expect(evaluate('10 - 4 - 3')).toBe(3);
    expect(evaluate('12 / 4 / 3')).toBe(1);
  });
  it('resolves dotted identifiers and constants', () => {
    expect(evaluate('g1.base.perimeter / g1.height.original', { 'g1.base.perimeter': 921.32, 'g1.height.original': 146.59 })).toBeCloseTo(6.285, 3);
    expect(evaluate('2 * pi')).toBeCloseTo(6.283185, 6);
    expect(evaluate('phi ^ 2 / 5')).toBeCloseTo(0.523607, 6);
  });
  it('does trigonometry in degrees', () => {
    expect(evaluate('atan(7 / 5.5)')).toBeCloseTo(51.8428, 4);
    expect(evaluate('atan(4 / pi)')).toBeCloseTo(51.8540, 4);
    expect(evaluate('atan(sqrt(phi))')).toBeCloseTo(51.8273, 4);
    expect(evaluate('tan(45)')).toBeCloseTo(1, 12);
    expect(evaluate('atan2(1, 1)')).toBe(45);
  });
  it('lists the identifiers a formula reads', () => {
    expect(identifiers('sqrt((kc.width / cubit.royal)^2 + (kc.height / cubit.royal)^2) * pi')).toEqual(['cubit.royal', 'kc.height', 'kc.width']);
  });
  it('rejects unknown names, bad arity and junk', () => {
    expect(() => evaluate('nope + 1')).toThrow(/unknown identifier "nope"/);
    expect(() => evaluate('atan2(1)')).toThrow(/takes 2/);
    expect(() => parse('1 +')).toThrow(SyntaxError);
    expect(() => parse('1 $ 2')).toThrow(SyntaxError);
    expect(() => parse('(1 + 2')).toThrow(SyntaxError);
  });
});
