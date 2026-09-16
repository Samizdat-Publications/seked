/**
 * The plateau's lesser monuments as massing solids, from footprints.
 *
 * A footprint is an outline already in the project frame and already set on
 * the scene's ground (scripts/footprints.ts does both, from OpenStreetMap),
 * with either a height OSM tags or a measurement key to look one up. Three
 * kinds of solid come out of one:
 *
 *   prism    the outline carried straight up, from `base + minHeight` to
 *            `base + height`; temples, tombs, walls and the parts of the
 *            Sphinx, whose head OSM models as starting eleven metres up
 *   pyramid  the outline rising to an apex over its own area centroid, which
 *            for a square footprint is the square pyramid and for anything
 *            else is the honest generalisation of one
 *   pit      the outline cut `depth` down from the ground, drawn as a solid
 *            so a renderer can give the cut its own dark material
 *
 * These are massings and say so. A pyramid built this way has no courses, no
 * concavity and no casing, and its height is whatever OSM says, which for the
 * queens' pyramids is the restored original. The three large pyramids are
 * never built here: the survey builds those.
 *
 * The caps are triangulated by ear clipping, because an outline traced from
 * imagery is not convex: the Sphinx's body is twenty-four vertices round a
 * shape with a neck in it. The same function runs in blender/seked_data.py
 * and a parity test pins the two meshes to each other.
 */

import type { Environment } from './environment';
import type { Mesh } from './mesh';

export type FootprintKind = 'prism' | 'pyramid' | 'pit';

export interface Footprint {
  id: string;
  name: string;
  kind: FootprintKind;
  group: string;
  osm: number;
  /** The ground under the outline, metres above the Great Pyramid's base. */
  base: number;
  /** Top of the solid above `base`, as OSM tags it. */
  height?: number;
  /** Bottom of the solid above `base`, as OSM tags it, for a part that starts off the ground. */
  minHeight?: number;
  /** The measurement key for the height, where OSM tags none. */
  heightKey?: string;
  /** The measurement key for a pit's depth. */
  depthKey?: string;
  area: number;
  /** Counter-clockwise seen from above, open (the first point is not repeated), metres. */
  ring: [number, number][];
}

/**
 * How far above a pit's own ground its top is drawn. The ground and the top of
 * the cut would otherwise be one plane and fight for every pixel; a centimetre
 * is invisible at any distance the scene is looked at from.
 */
export const PIT_LIP = 0.01;

/** Below this, a cross product is taken as zero: the three points are in a line. */
const COLLINEAR = 1e-9;

type Xy = readonly [number, number];

function cross(a: Xy, b: Xy, c: Xy): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function strictlyInside(p: Xy, a: Xy, b: Xy, c: Xy): boolean {
  return cross(a, b, p) > COLLINEAR && cross(b, c, p) > COLLINEAR && cross(c, a, p) > COLLINEAR;
}

/**
 * Triangles covering a simple counter-clockwise polygon, as indices into it,
 * each triangle counter-clockwise.
 *
 * Ear clipping, first ear found each pass, which is O(n^3) and fine at the
 * forty vertices the largest outline has. A vertex in a straight line with its
 * neighbours is clipped as a zero-area triangle rather than dropped, so every
 * edge of the outline is an edge of the cap and the solid stays closed. If an
 * outline is not simple after all, which a traced one occasionally is not,
 * whatever is left is fanned from its first vertex rather than lost.
 */
export function triangulate(ring: readonly Xy[]): number[] {
  const open = ring.map((_, i) => i);
  const out: number[] = [];
  while (open.length > 3) {
    let clipped = false;
    for (let k = 0; k < open.length; k++) {
      const i0 = open[(k + open.length - 1) % open.length] as number;
      const i1 = open[k] as number;
      const i2 = open[(k + 1) % open.length] as number;
      const a = ring[i0] as Xy;
      const b = ring[i1] as Xy;
      const c = ring[i2] as Xy;
      const turn = cross(a, b, c);
      if (turn < -COLLINEAR) continue;
      if (turn > COLLINEAR) {
        let blocked = false;
        for (const j of open) {
          if (j === i0 || j === i1 || j === i2) continue;
          if (strictlyInside(ring[j] as Xy, a, b, c)) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
      }
      out.push(i0, i1, i2);
      open.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  for (let k = 1; k + 1 < open.length; k++) out.push(open[0] as number, open[k] as number, open[k + 1] as number);
  return out;
}

/** The area centroid of a counter-clockwise polygon. */
export function ringCentroid(ring: readonly Xy[]): [number, number] {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i] as Xy;
    const [x1, y1] = ring[(i + 1) % ring.length] as Xy;
    const c = x0 * y1 - x1 * y0;
    a += c;
    cx += (x0 + x1) * c;
    cy += (y0 + y1) * c;
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** The records a footprint's solid is built from: its height or depth key, if it names one. */
export function footprintInputs(f: Footprint): string[] {
  return [f.heightKey, f.depthKey].filter((k): k is string => k !== undefined);
}

/** The solid's bottom and top in the frame, or nothing where the environment lacks the height it needs. */
export function footprintSpan(f: Footprint, env: Environment): { bottom: number; top: number } | undefined {
  if (f.kind === 'pit') {
    const depth = f.depthKey === undefined ? undefined : env[f.depthKey];
    if (depth === undefined || !(depth > 0)) return undefined;
    return { bottom: f.base - depth, top: f.base + PIT_LIP };
  }
  const height = f.height ?? (f.heightKey === undefined ? undefined : env[f.heightKey]);
  if (height === undefined || !Number.isFinite(height)) return undefined;
  const bottom = f.base + (f.minHeight ?? 0);
  const top = f.base + height;
  return top > bottom ? { bottom, top } : undefined;
}

function toMesh(verts: number[][], tris: number[]): Mesh {
  const positions = new Float32Array(verts.length * 3);
  verts.forEach((v, i) => positions.set(v, i * 3));
  return { positions, indices: Uint32Array.from(tris), vertexCount: verts.length, triangleCount: tris.length / 3 };
}

/**
 * One footprint's solid. Vertices are the outline at the bottom, then either
 * the outline at the top (prism, pit) or a single apex (pyramid). Faces wind
 * counter-clockwise seen from outside, as every other mesh here does.
 */
export function footprintMesh(f: Footprint, env: Environment): Mesh | undefined {
  const span = footprintSpan(f, env);
  if (!span || f.ring.length < 3) return undefined;
  const n = f.ring.length;
  const caps = triangulate(f.ring);
  const verts: number[][] = f.ring.map(([x, y]) => [x, y, span.bottom]);
  const tris: number[] = [];
  // The bottom faces down, so each cap triangle is reversed.
  for (let t = 0; t < caps.length; t += 3) tris.push(caps[t] as number, caps[t + 2] as number, caps[t + 1] as number);

  if (f.kind === 'pyramid') {
    const [cx, cy] = ringCentroid(f.ring);
    verts.push([cx, cy, span.top]);
    for (let i = 0; i < n; i++) tris.push(i, (i + 1) % n, n);
    return toMesh(verts, tris);
  }

  for (const [x, y] of f.ring) verts.push([x, y, span.top]);
  for (let t = 0; t < caps.length; t += 3) tris.push(n + (caps[t] as number), n + (caps[t + 1] as number), n + (caps[t + 2] as number));
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tris.push(i, j, n + j, i, n + j, n + i);
  }
  return toMesh(verts, tris);
}
