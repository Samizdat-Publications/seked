import { describe, expect, it } from 'vitest';
import {
  GROUND_BLEND_DISTANCE,
  GROUND_FLAT_MARGIN,
  groundHeight,
  terrainGrid,
  type GroundPyramid,
} from './terrain';

/** Two pyramids with round numbers, so every distance below can be read off. */
const G1: GroundPyramid = { base: 230, offsetEast: 0, offsetNorth: 0, offsetUp: 0 };
const G2: GroundPyramid = { base: 200, offsetEast: -400, offsetNorth: -500, offsetUp: 10 };
const BOTH = [G1, G2];

/** Where the flat ground ends and where the surface model is untouched again. */
const FLAT_TO = 115 + GROUND_FLAT_MARGIN;
const BLEND_TO = FLAT_TO + GROUND_BLEND_DISTANCE;

describe('groundHeight', () => {
  it('leaves the surface alone when there is nothing standing on it', () => {
    expect(groundHeight(0, 0, 62.5, [])).toBe(62.5);
    expect(groundHeight(2000, -2000, 41, [])).toBe(41);
  });

  it('sets the whole footprint and its margin to the surveyed base level', () => {
    for (const [x, y] of [[0, 0], [115, 115], [-115, 40], [FLAT_TO, 0], [0, -FLAT_TO], [FLAT_TO, FLAT_TO]]) {
      expect(groundHeight(x as number, y as number, 62.5, [G1]), `(${x}, ${y})`).toBe(0);
    }
  });

  it('is the surface model again beyond the blend', () => {
    expect(groundHeight(BLEND_TO, 0, 62.5, [G1])).toBe(62.5);
    expect(groundHeight(BLEND_TO + 1, 0, 62.5, [G1])).toBe(62.5);
    expect(groundHeight(3000, 3000, 40, [G1])).toBe(40);
  });

  it('rises smoothly across the blend, and never above the surface', () => {
    let previous = 0;
    for (let d = FLAT_TO; d <= BLEND_TO; d += 5) {
      const z = groundHeight(d, 0, 62.5, [G1]);
      expect(z, `${d} m east`).toBeGreaterThanOrEqual(previous);
      expect(z).toBeLessThanOrEqual(62.5);
      previous = z;
    }
    // A smoothstep is flat at both ends and half way up in the middle.
    expect(groundHeight((FLAT_TO + BLEND_TO) / 2, 0, 62.5, [G1])).toBeCloseTo(31.25, 9);
  });

  it('measures the footprint as a square, so the corner reaches furthest', () => {
    // Chebyshev distance: the same 40 m margin on the diagonal as on the axis.
    expect(groundHeight(FLAT_TO, FLAT_TO, 62.5, [G1])).toBe(0);
    expect(groundHeight(FLAT_TO + 0.001, FLAT_TO + 0.001, 62.5, [G1])).toBeGreaterThan(0);
  });

  it('takes the lower answer where two pyramids reach the same sample', () => {
    const x = -200;
    const y = -300;
    const surface = 70;
    const alone = [groundHeight(x, y, surface, [G1]), groundHeight(x, y, surface, [G2])];
    expect(groundHeight(x, y, surface, BOTH)).toBeCloseTo(Math.min(...alone), 12);
    expect(groundHeight(x, y, surface, BOTH)).toBeLessThan(surface);
  });

  it('flattens to a pyramid own base level even inside another blend', () => {
    expect(groundHeight(-400, -500, 70, BOTH)).toBe(10);
    expect(groundHeight(0, 0, 70, BOTH)).toBe(0);
  });
});

describe('terrainGrid', () => {
  // A 3 x 2 grid at 100 m, so the samples land on round coordinates.
  const header = { nx: 3, ny: 2, x0: -100, y0: 0, spacing: 100 };
  const heights = [10, 11, 12, 13, 14, 15];

  it('lays the samples out row-major, rows south to north', () => {
    const { context } = terrainGrid({ header, heights });
    expect([...context.positions.slice(0, 9)]).toEqual([-100, 0, 10, 0, 0, 11, 100, 0, 12]);
    expect([...context.positions.slice(9, 18)]).toEqual([-100, 100, 13, 0, 100, 14, 100, 100, 15]);
    expect(context.vertexCount).toBe(6);
    expect(context.triangleCount).toBe(4);
  });

  it('takes the datum off every sample', () => {
    const { context } = terrainGrid({ header, heights, datum: 10 });
    expect([...context.positions.filter((_, i) => i % 3 === 2)]).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('gives the ground the same grid and the same cells as the context', () => {
    const { context, ground } = terrainGrid({ header, heights, pyramids: [G1] });
    expect(ground.vertexCount).toBe(context.vertexCount);
    expect(ground.indices).toBe(context.indices);
    for (let i = 0; i < ground.positions.length; i += 3) {
      expect(ground.positions[i]).toBe(context.positions[i]);
      expect(ground.positions[i + 1]).toBe(context.positions[i + 1]);
    }
  });

  it('flattens the ground under a pyramid and leaves the context alone', () => {
    const { context, ground } = terrainGrid({ header, heights, pyramids: [G1] });
    // The sample at (0, 0) is inside G1's footprint; (-100, 0) and (100, 0) are too.
    expect([...ground.positions.filter((_, i) => i % 3 === 2)].slice(0, 3)).toEqual([0, 0, 0]);
    expect([...context.positions.filter((_, i) => i % 3 === 2)].slice(0, 3)).toEqual([10, 11, 12]);
  });

  it('winds both triangles of a cell counter-clockwise seen from above', () => {
    const { context } = terrainGrid({ header, heights });
    expect([...context.indices.slice(0, 6)]).toEqual([0, 1, 4, 0, 4, 3]);
  });
});
