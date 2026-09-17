/**
 * The Sphinx enclosure: the trench the statue was cut out of.
 *
 * The Sphinx is not a thing built on the plateau, it is a thing left behind
 * when a horseshoe of rock was quarried away round it, so the enclosure is as
 * much of the monument as the statue. Its floor is at the Sphinx's own base
 * level, which the footprint import took off the terrain, and its walls stand
 * vertically from there to the plateau's surface, nearly twenty metres at the
 * western end.
 *
 * What is missing is its plan. This builds it as the outlines OSM traced for
 * the body, the paws and the head, taken together and pushed out by
 * `sphinx.enclosure.margin`, which is a record no source in this database has
 * supplied yet. Until one does, this returns nothing at all: a trench at a
 * margin picked to look right would be a position guessed from how a picture
 * looks, which CLAUDE.md rules out.
 *
 * The margin would come off a published plan, read with `scripts/plate.py`
 * against its own scale bar, with a sigma and `method: "scaled from plate"`,
 * never verified. `arce-sphinx-1991` is already a source in the database and
 * is the obvious plan to read.
 *
 * Frame as everywhere else: +X east, +Y north, +Z up, metres.
 */

import type { Environment } from './environment';
import { triangulate, type Footprint } from './footprints';
import type { Mesh } from './mesh';

/** The record that would give the trench its plan. Nothing in data/measurements carries it yet. */
export const SPHINX_MARGIN_KEY = 'sphinx.enclosure.margin';

/** The record that would give the rim its level, in place of a caller passing the terrain's. */
export const SPHINX_RIM_KEY = 'sphinx.enclosure.rim.elevation';

/** The footprints the enclosure is taken from. */
export const SPHINX_PARTS = ['sphinx.body', 'sphinx.paws', 'sphinx.head'];

type Xy = readonly [number, number];

/**
 * The convex hull of a set of points, counter-clockwise seen from above, by
 * Andrew's monotone chain.
 *
 * The three Sphinx outlines overlap and their true union is a concave figure
 * with a neck in it. The hull of them is the simplest honest reading of
 * "all three together" that stays a simple polygon, and the statue's plan is
 * near enough convex that the difference is small against the margin itself.
 * It is a look choice and the label says so.
 */
export function convexHull(points: readonly Xy[]): Xy[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o: Xy, a: Xy, b: Xy): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: readonly Xy[]): Xy[] => {
    const out: Xy[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2] as Xy, out[out.length - 1] as Xy, p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/**
 * A convex outline pushed out by `margin` along each vertex's own bisector.
 * Only used on a hull, where every corner turns the same way and the bisector
 * cannot fold back on itself.
 */
export function dilateHull(hull: readonly Xy[], margin: number): Xy[] {
  const n = hull.length;
  return hull.map(([x, y], i) => {
    const [px, py] = hull[(i + n - 1) % n] as Xy;
    const [qx, qy] = hull[(i + 1) % n] as Xy;
    const l1 = Math.hypot(x - px, y - py);
    const l2 = Math.hypot(qx - x, qy - y);
    if (l1 === 0 || l2 === 0) return [x, y] as Xy;
    // The outward normal of a counter-clockwise edge is its direction turned right.
    const n1x = (y - py) / l1;
    const n1y = -(x - px) / l1;
    const n2x = (qy - y) / l2;
    const n2y = -(qx - x) / l2;
    const mitre = 1 / Math.max(1e-9, 1 + n1x * n2x + n1y * n2y);
    return [x + (n1x + n2x) * margin * mitre, y + (n1y + n2y) * margin * mitre] as Xy;
  });
}

function toMesh(verts: number[][], tris: number[]): Mesh {
  const positions = new Float32Array(verts.length * 3);
  verts.forEach((v, i) => positions.set(v, i * 3));
  return { positions, indices: Uint32Array.from(tris), vertexCount: verts.length, triangleCount: tris.length / 3 };
}

/** A counter-clockwise outline as a flat cap at one level, facing up. */
export function capMesh(ring: readonly Xy[], z: number): Mesh {
  return toMesh(ring.map(([x, y]) => [x, y, z]), triangulate(ring));
}

/** The side of a cut: the outline carried from `bottom` to `top`, facing into the cut. */
export function cutWallMesh(ring: readonly Xy[], bottom: number, top: number): Mesh {
  const n = ring.length;
  const verts: number[][] = [];
  for (const [x, y] of ring) verts.push([x, y, bottom]);
  for (const [x, y] of ring) verts.push([x, y, top]);
  const tris: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tris.push(j, i, n + i, j, n + i, n + j);
  }
  return toMesh(verts, tris);
}

/** The trench, as the two surfaces a renderer gives different rock to. */
export interface SphinxTrench {
  floor: Mesh;
  walls: Mesh;
  label: string;
}

/**
 * The Sphinx enclosure, or nothing.
 *
 * `groundLevel` is the plateau's surface round the statue, which is a terrain
 * question and not a measurement, so the caller passes it; a record under
 * `SPHINX_RIM_KEY` would answer it instead and is preferred where one exists.
 * Without `SPHINX_MARGIN_KEY`, and without a rim from either place, nothing
 * is built.
 */
export function sphinxTrenchMesh(env: Environment, features: readonly Footprint[], groundLevel?: number): SphinxTrench | undefined {
  const margin = env[SPHINX_MARGIN_KEY];
  const rim = env[SPHINX_RIM_KEY] ?? groundLevel;
  if (margin === undefined || !(margin > 0) || rim === undefined || !Number.isFinite(rim)) return undefined;

  const parts = features.filter((f) => SPHINX_PARTS.includes(f.id));
  if (parts.length === 0) return undefined;
  const floorLevel = Math.min(...parts.map((f) => f.base));
  if (!(rim > floorLevel)) return undefined;

  const hull = convexHull(parts.flatMap((f) => f.ring as Xy[]));
  if (hull.length < 3) return undefined;
  const outline = dilateHull(hull, margin);
  return {
    floor: capMesh(outline, floorLevel),
    walls: cutWallMesh(outline, floorLevel, rim),
    label:
      `Reconstruction: the Sphinx enclosure, the outlines of ${parts.map((f) => f.id).join(', ')} taken ` +
      `together and pushed out by ${margin} m from ${SPHINX_MARGIN_KEY}, its floor at ${floorLevel} m, ` +
      `which is the lowest of their own base levels, and its walls vertical to ${rim} m` +
      `${env[SPHINX_RIM_KEY] === undefined ? ', the ground the caller gave' : ` from ${SPHINX_RIM_KEY}`}. ` +
      'Look choices: the three outlines read as their convex hull rather than their true union, and walls ' +
      'cut vertically rather than following the quarried steps.',
  };
}
