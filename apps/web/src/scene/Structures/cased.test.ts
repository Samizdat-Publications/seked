import { describe, expect, it } from 'vitest';
import { MATERIALS, type Cased, type Material } from '@seked/data/browser';
import { STONE_LOOK, lookFor, lookWords, type StoneLook } from './cased';

const row = (material: Material['material']): Material =>
  ({ structure: 'x', part: 'casing', material, source: 'hoelscher-1912', verified: false });

const FALLBACK: StoneLook = { role: 'core', colour: '#000000', stone: { strength: 1 } };

describe('what a material looks like', () => {
  it('has a look for every material the table may name, and no others', () => {
    expect(Object.keys(STONE_LOOK).sort()).toEqual([...MATERIALS].sort());
  });

  it('draws red granite red, which is the whole of Stewart`s call on 2026-09-19', () => {
    // Not a colour comparison in words: the red channel has to beat the other
    // two by enough to read as red against near-white sand, which the old
    // grey-mauve #9d827b did not.
    const hex = STONE_LOOK['granite.red'].colour;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
    expect(r).toBeGreaterThan(g + 40);
    expect(r).toBeGreaterThan(b + 40);
    expect(STONE_LOOK['granite.red'].role).toBe('granite');
  });

  it('keeps black granite dark and apart from red', () => {
    expect(STONE_LOOK['granite.black'].colour).not.toBe(STONE_LOOK['granite.red'].colour);
    const hex = STONE_LOOK['granite.black'].colour;
    const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (const c of channels) expect(c).toBeLessThan(96);
  });

  it('takes the first part the table answers, in the order asked', () => {
    const cased: Cased = { core: row('limestone.giza'), casing: row('granite.red') };
    expect(lookFor(cased, ['casing', 'core'], FALLBACK)).toBe(STONE_LOOK['granite.red']);
    expect(lookFor(cased, ['core', 'casing'], FALLBACK)).toBe(STONE_LOOK['limestone.giza']);
  });

  it('skips a part the table is silent about rather than falling straight back', () => {
    const cased: Cased = { core: row('limestone.giza') };
    expect(lookFor(cased, ['pillars', 'casing', 'core'], FALLBACK)).toBe(STONE_LOOK['limestone.giza']);
  });

  it('falls back only when the table answers none of the parts asked', () => {
    expect(lookFor({}, ['casing', 'core'], FALLBACK)).toBe(FALLBACK);
    expect(lookFor({ floor: row('alabaster') }, ['casing', 'core'], FALLBACK)).toBe(FALLBACK);
  });
});

describe('what a look says about itself', () => {
  it('names every number it chose, and says none of them is measured', () => {
    const words = lookWords(STONE_LOOK['granite.red']);
    expect(words).toContain('Look choices, none of them measured');
    expect(words).toContain('50 per cent');
    expect(words).toContain('3.4 by 1.7 m');
    expect(words).toContain('every 1.7 m');
  });

  it('leaves out a block or a course the material does not have', () => {
    const words = lookWords(STONE_LOOK.mudbrick);
    expect(words).not.toContain('blocks');
    expect(words).not.toContain('joint line');
    expect(lookWords(STONE_LOOK.alabaster)).not.toContain('joint line');
  });

  it('keeps the granite far sample well under a building`s own width', () => {
    // The shader's far sample is 23 times the tile, and `granite_wall` tiles
    // at 1.9 m. Left at 1.0 that is 43.7 m, which is the width of Khafre's
    // valley temple: one tile across the face, and the photograph's large
    // passages read as planking rather than stone.
    const tile = 1.9 * (STONE_LOOK['granite.red'].stone.scale ?? 1);
    expect(tile * 23).toBeLessThan(30);
  });
});
