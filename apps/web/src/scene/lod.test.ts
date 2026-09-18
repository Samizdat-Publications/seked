import { describe, expect, it } from 'vitest';
import { chooseLod, LOD_RETURN, LOD_SETTLE, newLod } from './lod';

/** The stand-ins' own lines, which are the widest pair in the scene. */
const LINES = [400, 1500];
const LEVELS = 3;

/** Walk a distance at one thing for `frames` frames and answer the level drawn last. */
function hold(lod: ReturnType<typeof newLod>, distance: number, frames: number): number {
  let level = -1;
  for (let i = 0; i < frames; i++) level = chooseLod(lod, distance, LINES, LEVELS);
  return level;
}

describe('chooseLod', () => {
  it('takes the distance at face value on the first frame', () => {
    expect(chooseLod(newLod(), 100, LINES, LEVELS)).toBe(0);
    expect(chooseLod(newLod(), 800, LINES, LEVELS)).toBe(1);
    expect(chooseLod(newLod(), 9000, LINES, LEVELS)).toBe(2);
  });

  it('waits for the level to be asked for twice running', () => {
    const lod = newLod();
    chooseLod(lod, 100, LINES, LEVELS);
    // One frame past the line changes nothing.
    expect(chooseLod(lod, 500, LINES, LEVELS)).toBe(0);
    expect(chooseLod(lod, 500, LINES, LEVELS)).toBe(1);
  });

  it('throws away a single odd frame', () => {
    const lod = newLod();
    hold(lod, 100, 3);
    expect(chooseLod(lod, 5000, LINES, LEVELS)).toBe(0);
    expect(hold(lod, 100, 3)).toBe(0);
  });

  it('holds the coarser level until the camera is well back inside the line', () => {
    const lod = newLod();
    hold(lod, 500, LOD_SETTLE + 1);
    expect(lod.level).toBe(1);
    // Just inside the line is not enough: that is the flutter this exists for.
    expect(hold(lod, 399, LOD_SETTLE + 1)).toBe(1);
    expect(hold(lod, 400 * LOD_RETURN - 1, LOD_SETTLE + 1)).toBe(0);
  });

  it('does not swap at all when the camera sits on a line', () => {
    const lod = newLod();
    hold(lod, 100, 2);
    const drawn: number[] = [];
    for (let i = 0; i < 40; i++) drawn.push(chooseLod(lod, 400 + (i % 2 === 0 ? 0.01 : -0.01), LINES, LEVELS));
    // A hundredth of a metre either side of the line never asks for the same
    // level twice running, so nothing is ever swapped and the statue is drawn
    // at the level it arrived on.
    expect(new Set(drawn)).toEqual(new Set([0]));
  });

  it('never asks for a level the thing does not have', () => {
    const lod = newLod();
    expect(hold(lod, 100000, 5)).toBe(LEVELS - 1);
    expect(chooseLod(newLod(), 100000, LINES, 2)).toBe(1);
  });
});
