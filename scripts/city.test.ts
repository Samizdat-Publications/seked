import { describe, expect, it } from 'vitest';
import {
  BBOX,
  boxCorners,
  convexHull,
  fillHeight,
  inBox,
  median,
  minAreaRect,
  parseRow,
  parseWktPolygon,
  samplePoints,
  tangentPlane,
  toUtm,
  undoFloatPredictor,
  utmEpsg,
  utmZone,
  type OrientedBox,
  type Xy,
} from './city';

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

describe('the raster the heights come out of', () => {
  const A = 6378137;
  const B = 6356752.314;

  it('puts the central meridian of zone 36 at 500,000 m east', () => {
    const [east, north] = toUtm(0, 33, 36, A, B);
    expect(east).toBeCloseTo(500000, 6);
    expect(north).toBeCloseTo(0, 6);
  });

  it('agrees with the plateau as it was measured in UTM 36N', () => {
    // 319,994 east, 3,317,945 north, measured before this import was written.
    const [east, north] = toUtm(29.9792, 31.1342, 36, A, B);
    expect(east).toBeCloseTo(319994, -0.3);
    expect(north).toBeCloseTo(3317945, -0.3);
  });

  it('knows which zone the plateau is in', () => {
    expect(utmZone(31.1342)).toBe(36);
    expect(utmEpsg(36)).toBe(32636);
  });

  it('undoes the floating-point predictor a TIFF encoder applies', () => {
    const width = 4;
    const height = 3;
    const values = new Float32Array([
      0, 0.5, 4, 12.5, -99, 1.5, 3, 3, 97.5, 0, 0.02, 0.98,
    ]);
    // The encoder, written the other way round from the reader: byte planes
    // most significant first, then the difference along the row.
    const raw = Buffer.from(values.buffer.slice(0));
    const rowBytes = width * 4;
    const encoded = Buffer.alloc(raw.length);
    for (let row = 0; row < height; row++) {
      const s = row * rowBytes;
      const shuffled = Buffer.alloc(rowBytes);
      for (let j = 0; j < width; j++) {
        for (let b = 0; b < 4; b++) shuffled[b * width + j] = raw[s + 4 * j + (3 - b)] as number;
      }
      for (let i = rowBytes - 1; i > 0; i--) shuffled[i] = ((shuffled[i] as number) - (shuffled[i - 1] as number)) & 0xff;
      shuffled.copy(encoded, s);
    }
    expect([...undoFloatPredictor(encoded, width, height)]).toEqual([...values]);
  });

  it('refuses a block that is not the size it was told', () => {
    expect(() => undoFloatPredictor(Buffer.alloc(16), 4, 3)).toThrow(/48 bytes/);
  });

  it('takes nine points spread over a roof, all of them on it', () => {
    const box = { x: 10, y: -4, width: 30, depth: 12, yawDeg: 0 };
    const points = samplePoints(box);
    expect(points).toHaveLength(9);
    for (const [x, y] of points) {
      expect(Math.abs(x - 10)).toBeLessThanOrEqual(15);
      expect(Math.abs(y + 4)).toBeLessThanOrEqual(6);
    }
    expect(points).toContainEqual([10, -4]);
    expect(points).toContainEqual([20, -8]);
  });

  it('turns the sample points with the building', () => {
    // A quarter turn sends the point ten metres along the long side to the north.
    const points = samplePoints({ x: 0, y: 0, width: 30, depth: 12, yawDeg: 90 });
    expect(points[7]?.[0]).toBeCloseTo(0, 9);
    expect(points[7]?.[1]).toBeCloseTo(10, 9);
  });

  it('takes the middle of what it has, low side on a tie', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2);
    expect(median([7])).toBe(7);
  });

  it('fills an unmeasured height from the measured buildings of the same size', () => {
    const box = (): OrientedBox => ({ x: 0, y: 0, width: 4, depth: 3, yawDeg: 0 });
    const boxes = [box(), box(), box(), box(), box()];
    const areas = [10, 20, 30, 200, 300];
    const heights = new Float32Array([3, 5, Number.NaN, 40, 50]);
    const fill = fillHeight(boxes, areas, heights);
    // The one with no height is 30 m2, so the fill is the median of the
    // heights of the buildings at or under 30 m2, which are 3 and 5.
    expect(fill.medianMissingArea).toBe(30);
    expect(fill.height).toBe(3);
    // The measured ones are 10, 20, 200 and 300 m2, whose middle pair is 20 and 200.
    expect(fill.medianMeasuredArea).toBe(20);
  });
});
