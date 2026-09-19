import { describe, expect, it } from 'vitest';
import { BBOX, boxCorners, convexHull, inBox, minAreaRect, parseRow, parseWktPolygon, tangentPlane, type Xy } from './city';

/** Turn a polygon about the origin, the way a building sits along its street. */
function turn(points: readonly Xy[], deg: number): Xy[] {
  const c = Math.cos((deg * Math.PI) / 180);
  const s = Math.sin((deg * Math.PI) / 180);
  return points.map(([x, y]) => [x * c - y * s, x * s + y * c] as Xy);
}

/** The corners of a rectangle of this size about the origin. */
const rectangle = (width: number, depth: number): Xy[] => [
  [-width / 2, -depth / 2],
  [width / 2, -depth / 2],
  [width / 2, depth / 2],
  [-width / 2, depth / 2],
];

describe('the oriented box of a building', () => {
  it('gives a rectangle back exactly as it went in', () => {
    const box = minAreaRect(rectangle(20, 5).map(([x, y]) => [x + 3, y - 2] as Xy));
    expect(box?.width).toBeCloseTo(20, 9);
    expect(box?.depth).toBeCloseTo(5, 9);
    expect(box?.x).toBeCloseTo(3, 9);
    expect(box?.y).toBeCloseTo(-2, 9);
    expect(box?.yawDeg).toBeCloseTo(0, 9);
  });

  it('finds the yaw of a turned rectangle', () => {
    const box = minAreaRect(turn(rectangle(20, 5), 30));
    expect(box?.yawDeg).toBeCloseTo(30, 6);
    expect(box?.width).toBeCloseTo(20, 6);
    expect(box?.depth).toBeCloseTo(5, 6);
  });

  it('finds the long axis of a long thin building', () => {
    const box = minAreaRect(turn(rectangle(60, 3), 115).map(([x, y]) => [x + 120, y - 40] as Xy));
    expect(box?.yawDeg).toBeCloseTo(115, 6);
    expect(box?.width).toBeCloseTo(60, 6);
    expect(box?.depth).toBeCloseTo(3, 6);
    expect(box?.x).toBeCloseTo(120, 6);
    expect(box?.y).toBeCloseTo(-40, 6);
  });

  it('still knows which way a near-square building faces', () => {
    const box = minAreaRect(turn(rectangle(10, 9.5), 20));
    expect(box?.yawDeg).toBeCloseTo(20, 6);
    expect(box?.width).toBeCloseTo(10, 6);
    expect(box?.depth).toBeCloseTo(9.5, 6);
  });

  it('reports a yaw of a half turn as the same box, never as 180 degrees', () => {
    const box = minAreaRect(turn(rectangle(20, 5), 210));
    expect(box?.yawDeg).toBeCloseTo(30, 6);
    expect(box?.yawDeg).toBeGreaterThanOrEqual(0);
    expect(box?.yawDeg).toBeLessThan(180);
  });

  it('is the smallest rectangle and not the north-facing one', () => {
    // A square turned 45 degrees: its axis-aligned box has twice the area.
    const box = minAreaRect(turn(rectangle(10, 10), 45));
    expect((box as { width: number }).width * (box as { depth: number }).depth).toBeCloseTo(100, 6);
    expect(box?.width).toBeCloseTo(10, 6);
    expect(box?.depth).toBeCloseTo(10, 6);
  });

  it('covers an L-shaped block, and no larger than its bounding box', () => {
    const ell: Xy[] = [[0, 0], [20, 0], [20, 6], [6, 6], [6, 14], [0, 14]];
    const box = minAreaRect(ell);
    expect(box).toBeDefined();
    const { width, depth } = box as { width: number; depth: number };
    expect(width * depth).toBeLessThanOrEqual(20 * 14 + 1e-9);
    const corners = boxCorners(box as Parameters<typeof boxCorners>[0]);
    for (const [px, py] of ell) {
      const inside = corners.every((c, i) => {
        const n = corners[(i + 1) % 4] as Xy;
        return (n[0] - c[0]) * (py - c[1]) - (n[1] - c[1]) * (px - c[0]) >= -1e-6;
      });
      expect(inside, `(${px}, ${py}) is outside the box`).toBe(true);
    }
  });

  it('refuses an outline no rectangle can be fitted to', () => {
    expect(minAreaRect([[0, 0], [1, 1], [2, 2]])).toBeUndefined();
    expect(minAreaRect([[0, 0], [1, 1]])).toBeUndefined();
  });

  it('hulls a cloud of points counter-clockwise', () => {
    const hull = convexHull([[0, 0], [2, 0], [2, 2], [0, 2], [1, 1]]);
    expect(hull).toHaveLength(4);
    let area = 0;
    for (let i = 0; i < hull.length; i++) {
      const [x0, y0] = hull[i] as Xy;
      const [x1, y1] = hull[(i + 1) % hull.length] as Xy;
      area += x0 * y1 - x1 * y0;
    }
    expect(area / 2).toBeCloseTo(4, 9);
  });
});

describe('reading a row of the archive', () => {
  const line = '29.9792,31.1342,143.21,0.8134,"POLYGON((31.1342 29.9792, 31.1343 29.9792, 31.1343 29.9793, 31.1342 29.9793, 31.1342 29.9792))",7GXHPM2C+2X';

  it('cuts the four leading numbers off a line whose geometry is full of commas', () => {
    const row = parseRow(line);
    expect(row?.lat).toBe(29.9792);
    expect(row?.lon).toBe(31.1342);
    expect(row?.area).toBe(143.21);
    expect(row?.confidence).toBe(0.8134);
    expect(row?.wkt.startsWith('POLYGON((')).toBe(true);
    expect(row?.wkt.endsWith('))')).toBe(true);
  });

  it('reads the ring and drops the repeated closing point', () => {
    const ring = parseWktPolygon((parseRow(line) as { wkt: string }).wkt);
    expect(ring).toHaveLength(4);
    expect(ring?.[0]).toEqual([31.1342, 29.9792]);
  });

  it('keeps the outer ring of a building with a courtyard, spaced or not', () => {
    expect(parseWktPolygon('POLYGON((0 0, 4 0, 4 4, 0 4, 0 0),(1 1, 2 1, 2 2, 1 2, 1 1))')).toHaveLength(4);
    expect(parseWktPolygon('POLYGON((0 0, 4 0, 4 4, 0 4, 0 0), (1 1, 2 1, 2 2, 1 2, 1 1))')).toHaveLength(4);
  });

  it('refuses a multipolygon rather than guessing which part is the building', () => {
    expect(parseWktPolygon('MULTIPOLYGON(((0 0, 4 0, 4 4, 0 0)))')).toBeUndefined();
  });

  it('refuses anything that is not a polygon', () => {
    expect(parseWktPolygon('POINT(31.1 29.9)')).toBeUndefined();
    expect(parseWktPolygon('POLYGON((0 0, 1 1))')).toBeUndefined();
  });

  it('keeps the plateau and the far bank of the Nile inside the box', () => {
    expect(inBox(29.9792, 31.1342)).toBe(true);
    expect(inBox(30.0, 31.23)).toBe(true);
    expect(inBox(29.9792, 31.3)).toBe(false);
    expect(inBox(29.9, 31.1342)).toBe(false);
    expect(BBOX[0]).toBeLessThan(BBOX[2]);
    expect(BBOX[1]).toBeLessThan(BBOX[3]);
  });
});

describe('the tangent plane the city stands on', () => {
  // WGS84 as the database holds it, so the test says what it is testing.
  const A = 6378137;
  const B = 6356752.314;
  const projection = tangentPlane(29.979167, 31.134167, A, B);

  it('puts the origin at the Great Pyramid', () => {
    expect(projection.project(31.134167, 29.979167)).toEqual([0, 0]);
  });

  it('agrees with the standard metres per degree at thirty degrees north', () => {
    // The truncated series every surveyor's handbook prints, which is an
    // independent arithmetic and good to a centimetre at this latitude.
    const cos = (deg: number): number => Math.cos((deg * Math.PI) / 180);
    const phi = 29.979167;
    const perLat = 111132.92 - 559.82 * cos(2 * phi) + 1.175 * cos(4 * phi) - 0.0023 * cos(6 * phi);
    const perLon = 111412.84 * cos(phi) - 93.5 * cos(3 * phi) + 0.118 * cos(5 * phi);
    expect(Math.abs(projection.metresPerDegLat - perLat)).toBeLessThan(0.1);
    expect(Math.abs(projection.metresPerDegLon - perLon)).toBeLessThan(0.1);
  });

  it('runs east positive and north positive', () => {
    const [x, y] = projection.project(31.2, 30.0);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
  });
});
