import { describe, expect, it } from 'vitest';
import { loadClaims } from '@seked/claims';
import { EXAMPLES, exampleAt } from './examples';

const filed = new Set(loadClaims().map((c) => c.id));

describe('the five things a proponent says', () => {
  it('are five, with ids and titles of their own', () => {
    expect(EXAMPLES).toHaveLength(5);
    expect(new Set(EXAMPLES.map((e) => e.id)).size).toBe(5);
    for (const example of EXAMPLES) {
      expect(example.title.length).toBeGreaterThan(0);
      expect(example.prose.length).toBeGreaterThan(80);
      expect(example.expect.length).toBeGreaterThan(40);
    }
  });

  it('each stand near a claim that is actually filed', () => {
    for (const example of EXAMPLES) expect(filed.has(example.near), `${example.id} stands near ${example.near}`).toBe(true);
  });

  it('are numbered from one, as the CLI asks for them', () => {
    expect(exampleAt(1)).toBe(EXAMPLES[0]);
    expect(exampleAt(5)).toBe(EXAMPLES[4]);
    expect(() => exampleAt(0)).toThrow(/there is no example 0/);
    expect(() => exampleAt(6)).toThrow(/numbered 1 to 5/);
  });
});
