/**
 * Interior solids: passages, chambers and corbelled galleries. The plan keeps
 * the interior as separate objects rather than a boolean cut out of the
 * pyramid, so the viewer can clip them and a claim can name a point on one.
 *
 * Same frame as the exterior: origin at the Great Pyramid's base centre,
 * +X east, +Y north, +Z up, metres. Nothing here reads the database; every
 * builder takes metres and returns a closed, outward-wound mesh, so
 * `meshVolume` of anything built here is positive.
 */

import type { Landmarks, Point } from './landmarks';
import type { Mesh } from './mesh';

/** A closed mesh plus the named points a claim overlay can reach. */
export interface Solid extends Mesh {
  landmarks: Landmarks;
}

/**
 * Where a cross-section's heights are measured. `perpendicular` takes them
 * square to the sloping floor, which is Petrie's convention for the passages;
 * `vertical` takes them straight up, which makes an oblique prism whose
 * volume is the section area times the horizontal run, not the slant length.
 */
export type HeightMode = 'perpendicular' | 'vertical';

/** One `[halfWidth, height]` step of a cross-section, height 0 at the floor. */
export type SectionPair = readonly [number, number];

type V3 = [number, number, number];

/** A horizontal run shorter than this counts as none, so the axis is vertical. */
const FLAT = 1e-12;

function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

function toMesh(verts: V3[], tris: number[], landmarks: Landmarks): Solid {
  const positions = new Float32Array(verts.length * 3);
  verts.forEach((v, i) => positions.set(v, i * 3));
  return {
    positions,
    indices: Uint32Array.from(tris),
    vertexCount: verts.length,
    triangleCount: tris.length / 3,
    landmarks,
  };
}

/**
 * The frame a section is drawn in. `width` is horizontal and square to the
 * axis's horizontal projection; `up` is the direction heights are measured in.
 * A vertical axis has no horizontal projection to be square to, so the width
 * falls back to east and, in perpendicular mode, the heights then run north.
 */
function sectionFrame(from: Point, to: Point, mode: HeightMode): { width: V3; up: V3 } {
  const d: V3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const run = Math.hypot(d[0], d[1]);
  const width: V3 = run > FLAT ? [-d[1] / run, d[0] / run, 0] : [1, 0, 0];
  if (mode === 'vertical') {
    if (run <= FLAT) throw new Error('extrudedSection: vertical heights need an axis with a horizontal run');
    return { width, up: [0, 0, 1] };
  }
  const len = Math.hypot(d[0], d[1], d[2]);
  const axis: V3 = [d[0] / len, d[1] / len, d[2] / len];
  // (axis, width, up) is right-handed, so `up` leans with the floor and the
  // section outline below comes out counter-clockwise seen down the axis.
  return { width, up: cross(axis, width) };
}

export interface ExtrudedSectionOptions {
  /** Start of the floor centre line. */
  from: Point;
  /** End of the floor centre line. */
  to: Point;
  /** `[halfWidth, height]` up one side from the floor; heights must not decrease. */
  section: ReadonlyArray<SectionPair>;
  /** Default `perpendicular`. */
  heightMode?: HeightMode;
  /** Optional prefix, e.g. "g1.gallery", producing keys like "g1.gallery.axis.mid". */
  prefix?: string;
}

/**
 * Extrude a vertical cross-section along the straight axis from `from` to
 * `to`, mirroring the section about the floor centre line.
 *
 * Vertices: the section outline at the near end, then the same outline at the
 * far end, so a section of n pairs gives 4n vertices. Within one outline,
 * index k is section pair k on the +width side and index 2n-1-k is its mirror,
 * which walks counter-clockwise in the (width, up) plane: up the near side,
 * back down the far side.
 *
 * Faces: one quad per outline edge, plus a ladder of cells between the two
 * mirrored halves at each end. The zero-height cells at a corbel step are kept
 * rather than skipped, because they are what keeps the end caps edge-manifold
 * with the ledge faces; they enclose no volume.
 */
export function extrudedSection(o: ExtrudedSectionOptions): Solid {
  const { from, to, section } = o;
  const n = section.length;
  if (n < 2) throw new Error('extrudedSection: a section needs at least two [halfWidth, height] pairs');
  for (let k = 1; k < n; k++) {
    if ((section[k] as SectionPair)[1] < (section[k - 1] as SectionPair)[1]) {
      throw new Error('extrudedSection: section heights must not decrease');
    }
  }
  const { width, up } = sectionFrame(from, to, o.heightMode ?? 'perpendicular');

  const m = 2 * n;
  const outline: V3[] = new Array(m);
  for (let k = 0; k < n; k++) {
    const [hw, h] = section[k] as SectionPair;
    outline[k] = [width[0] * hw + up[0] * h, width[1] * hw + up[1] * h, width[2] * hw + up[2] * h];
    outline[m - 1 - k] = [up[0] * h - width[0] * hw, up[1] * h - width[1] * hw, up[2] * h - width[2] * hw];
  }

  const verts: V3[] = [];
  for (const p of outline) verts.push([from[0] + p[0], from[1] + p[1], from[2] + p[2]]);
  for (const p of outline) verts.push([to[0] + p[0], to[1] + p[1], to[2] + p[2]]);

  const tris: number[] = [];
  for (let k = 0; k < m; k++) {
    // Wall along outline edge k, near pair first: the outward normal is the
    // outline tangent crossed into the axis.
    const j = (k + 1) % m;
    tris.push(k, j, m + j, k, m + j, m + k);
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i, b = i + 1, c = m - 2 - i, d = m - 1 - i;
    tris.push(m + a, m + b, m + c, m + a, m + c, m + d); // far cap, faces along the axis
    tris.push(d, c, b, d, b, a);                          // near cap, faces back against it
  }

  const p = o.prefix ? `${o.prefix}.` : '';
  return toMesh(verts, tris, {
    [`${p}floor.begin`]: [from[0], from[1], from[2]],
    [`${p}floor.end`]: [to[0], to[1], to[2]],
    [`${p}axis.mid`]: midpoint(from, to),
  });
}

export interface PassageOptions {
  from: Point;
  to: Point;
  width: number;
  height: number;
  heightMode?: HeightMode;
  prefix?: string;
}

/** A passage of constant rectangular section: `extrudedSection` with two pairs. */
export function passage(o: PassageOptions): Solid {
  const half = o.width / 2;
  return extrudedSection({
    from: o.from,
    to: o.to,
    section: [[half, 0], [half, o.height]],
    heightMode: o.heightMode ?? 'perpendicular',
    prefix: o.prefix,
  });
}

export interface Gable {
  /** Height of the ridge above the chamber floor, so above `min[2]`. */
  ridgeHeight: number;
  /** The horizontal axis the ridge runs along: 'x' is east to west. */
  axis: 'x' | 'y';
}

export interface ChamberOptions {
  /** Floor corner, the low end of every axis. */
  min: Point;
  /** Wall-top corner, the high end of every axis. */
  max: Point;
  /** Optional pitched roof above the wall tops. */
  gable?: Gable;
  /** Optional prefix, e.g. "g1.queen", producing keys like "g1.queen.centre". */
  prefix?: string;
}

/** Corner order, the same ring the pyramid landmarks use. */
const CORNERS = ['NE', 'NW', 'SW', 'SE'] as const;

/**
 * An axis-aligned chamber, optionally with a gabled roof.
 *
 * Vertices: 0-3 the floor ring and 4-7 the wall-top ring, both counter-
 * clockwise seen from above starting north-east, matching `CORNERS`; then, when
 * gabled, the two ridge ends, the east one first for a ridge along x and the
 * north one first for a ridge along y.
 */
export function chamber(o: ChamberOptions): Solid {
  const { min, max, gable } = o;
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const plan: [number, number][] = [[x1, y1], [x0, y1], [x0, y0], [x1, y0]];

  const verts: V3[] = [];
  for (const [x, y] of plan) verts.push([x, y, z0]);
  for (const [x, y] of plan) verts.push([x, y, z1]);

  const tris: number[] = [0, 3, 2, 0, 2, 1]; // floor, clockwise from above so it faces down
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    tris.push(i, j, 4 + j, i, 4 + j, 4 + i); // walls
  }

  if (!gable) {
    tris.push(4, 5, 6, 4, 6, 7); // flat ceiling, counter-clockwise from above
  } else {
    const rz = z0 + gable.ridgeHeight;
    if (gable.axis === 'x') {
      verts.push([x1, cy, rz], [x0, cy, rz]); // 8 east end, 9 west end
      tris.push(4, 5, 9, 4, 9, 8); // north slope
      tris.push(6, 7, 8, 6, 8, 9); // south slope
      tris.push(4, 8, 7);          // east gable end
      tris.push(5, 6, 9);          // west gable end
    } else {
      verts.push([cx, y1, rz], [cx, y0, rz]); // 8 north end, 9 south end
      tris.push(7, 4, 8, 7, 8, 9); // east slope
      tris.push(5, 6, 9, 5, 9, 8); // west slope
      tris.push(4, 5, 8);          // north gable end
      tris.push(6, 7, 9);          // south gable end
    }
  }

  const p = o.prefix ? `${o.prefix}.` : '';
  const landmarks: Landmarks = {
    [`${p}centre`]: [cx, cy, (z0 + z1) / 2],
    [`${p}floor.centre`]: [cx, cy, z0],
  };
  CORNERS.forEach((name, i) => {
    landmarks[`${p}corner.${name}.floor`] = [...(verts[i] as V3)];
    landmarks[`${p}corner.${name}.ceiling`] = [...(verts[i + 4] as V3)];
  });
  if (gable) landmarks[`${p}ridge.mid`] = [cx, cy, z0 + gable.ridgeHeight];
  return toMesh(verts, tris, landmarks);
}
