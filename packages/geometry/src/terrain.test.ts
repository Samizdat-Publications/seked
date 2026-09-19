import { describe, expect, it } from 'vitest';
import {
  GROUND_BLEND_DISTANCE,
  GROUND_FLAT_MARGIN,
  groundHeight,
  terrainGrid,
  terrainRing,
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

describe('terrainRing', () => {
  /** A 21 by 21 grid at 100 m, spanning plus or minus 1000 m, every sample at 7 m. */
  const header = { nx: 21, ny: 21, x0: -1000, y0: -1000, spacing: 100 };
  const heights = new Float32Array(21 * 21).fill(7);

  it('keeps every sample as a vertex and puts it where the header says', () => {
    const ring = terrainRing({ header, heights, omitWithin: 500 });
    expect(ring.vertexCount).toBe(21 * 21);
    // The first sample is the south-west corner, the last the north-east.
    expect([ring.positions[0], ring.positions[1], ring.positions[2]]).toEqual([-1000, -1000, 7]);
    const last = (21 * 21 - 1) * 3;
    expect([ring.positions[last], ring.positions[last + 1], ring.positions[last + 2]]).toEqual([1000, 1000, 7]);
  });

  it('takes the datum off every height', () => {
    const ring = terrainRing({ header, heights, omitWithin: 500, datum: 2 });
    for (let v = 2; v < ring.positions.length; v += 3) expect(ring.positions[v]).toBe(5);
  });

  it('leaves out the cells the fine grid covers, and keeps the rest', () => {
    const whole = terrainRing({ header, heights, omitWithin: 0 });
    expect(whole.triangleCount).toBe(20 * 20 * 2);
    // omitWithin 500 less the 120 m overlap drops the cells wholly inside
    // plus or minus 380, which at 100 m cells is the six by six block from
    // -300 to 300. Nothing else goes.
    const ring = terrainRing({ header, heights, omitWithin: 500 });
    expect(ring.triangleCount).toBe((20 * 20 - 6 * 6) * 2);
  });

  it('draws the overlap, so the join lies under the finer grid', () => {
    // Without the overlap the hole would reach 500 m; with it the cells
    // between 380 and 500 are still drawn.
    const ring = terrainRing({ header, heights, omitWithin: 500 });
    const drawn = new Set<number>();
    for (const i of ring.indices) drawn.add(i);
    const at = (x: number, y: number): number => ((y - header.y0) / header.spacing) * header.nx + (x - header.x0) / header.spacing;
    expect(drawn.has(at(400, 0))).toBe(true);
    expect(drawn.has(at(0, -400))).toBe(true);
    expect(drawn.has(at(0, 0))).toBe(false);
  });

  it('hangs a skirt on the boundary and leaves the heights alone', () => {
    const plain = terrainRing({ header, heights, omitWithin: 500 });
    const ring = terrainRing({ header, heights, omitWithin: 500, skirtTo: 5000 });
    // One vertex per boundary sample: 2 * (nx - 1) + 2 * (ny - 1).
    const edge = 2 * 20 + 2 * 20;
    expect(ring.vertexCount).toBe(plain.vertexCount + edge);
    // Two triangles per boundary segment, and the ring is closed.
    expect(ring.triangleCount).toBe(plain.triangleCount + edge * 2);
    // Every skirt vertex sits on the skirt's own square at the height of the
    // sample it hangs from, which in this flat grid is 7 m throughout.
    for (let v = plain.vertexCount; v < ring.vertexCount; v++) {
      const x = ring.positions[v * 3] as number;
      const y = ring.positions[v * 3 + 1] as number;
      expect(Math.max(Math.abs(x), Math.abs(y))).toBeCloseTo(5000, 6);
      expect(ring.positions[v * 3 + 2]).toBe(7);
    }
  });

  it('carries each edge sample its own height out, not a level of its own', () => {
    // A grid that falls away to the north-east, so no two boundary samples
    // share a height and a skirt at one level would be caught.
    const sloped = new Float32Array(21 * 21);
    for (let j = 0; j < 21; j++) for (let i = 0; i < 21; i++) sloped[j * 21 + i] = i + 2 * j;
    const plain = terrainRing({ header, heights: sloped, omitWithin: 500 });
    const ring = terrainRing({ header, heights: sloped, omitWithin: 500, skirtTo: 5000 });
    const heightsOut = new Set<number>();
    for (let v = plain.vertexCount; v < ring.vertexCount; v++) heightsOut.add(ring.positions[v * 3 + 2] as number);
    expect(heightsOut.size).toBeGreaterThan(1);
    // The corner sample of the grid is its highest, and the skirt keeps it.
    expect(Math.max(...heightsOut)).toBe(20 + 2 * 20);
  });

  it('never indexes past its own vertices', () => {
    const ring = terrainRing({ header, heights, omitWithin: 500, skirtTo: 5000 });
    for (const i of ring.indices) expect(i).toBeLessThan(ring.vertexCount);
    expect(ring.indices.length).toBe(ring.triangleCount * 3);
  });
});
