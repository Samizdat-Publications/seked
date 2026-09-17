/**
 * The queens' and satellite pyramids, cased and as stepped ruins.
 *
 * Nobody surveyed these the way Petrie surveyed the three great pyramids, so
 * what there is to build from is an OSM outline traced from imagery, a height
 * OSM tags or a seked-estimate, and whatever slope the database carries for
 * the group. A traced outline is a quadrilateral a metre or two out of square,
 * which is tracing error and not a monument that was built out of square, so
 * the outline is fitted to a square of its own area, on its own principal
 * axis, about its own centroid. Nothing is added: the square carries exactly
 * the area the outline has.
 *
 * Two states come out of one:
 *
 *   cased    the smooth four-faced pyramid, for `ancient` and `built`
 *   stepped  a stepped core of courses, cut off partway up as a ruin, which
 *            is what these stand as now
 *
 * Frame as everywhere else: +X east, +Y north, +Z up, metres, origin at the
 * Great Pyramid's base centre. The mesh comes back standing where the
 * footprint stands, as `pyramidionMesh` does.
 */

import { steppedPyramidMesh } from './courses';
import type { Environment } from './environment';
import { footprintSpan, ringCentroid, type Footprint } from './footprints';
import { pyramidMesh, type Mesh } from './mesh';
import { placeMesh, type LabelledMesh } from './pyramidion';

const DEG = Math.PI / 180;

/**
 * How far up a stepped ruin is carried, as a share of the height it was built
 * to. A look choice: the queens' pyramids have lost their tops and their
 * casing and stand as rough cores, and no record here says by how much, so one
 * fraction is used for all of them and is named in every label.
 */
export const RUIN_FRACTION = 0.8;

/** A traced outline read as the square it was meant to be. */
export interface SquareFit {
  centre: [number, number];
  /** The side of a square of the outline's own area, metres. */
  side: number;
  /** The outline's principal axis, degrees counter-clockwise from east, in (-45, 45]. */
  angleDeg: number;
}

/** The area a closed counter-clockwise outline encloses, metres squared. */
export function ringArea(ring: readonly (readonly [number, number])[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i] as readonly [number, number];
    const [x1, y1] = ring[(i + 1) % ring.length] as readonly [number, number];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
}

/**
 * The square an outline is read as: its own area, its own area centroid, and
 * the direction its edges mostly run in.
 *
 * A square's edges lie in two directions ninety degrees apart, so an edge's
 * direction only fixes the square modulo ninety degrees. Turning each edge's
 * angle by four and taking the mean direction, weighted by the edge's length,
 * folds the two families onto one and averages them without a wrap to handle:
 * a quarter of that mean is the axis. It is the standard square-symmetric mean
 * direction and it is exact for a true square in any orientation.
 */
export function squareFit(ring: readonly (readonly [number, number])[]): SquareFit | undefined {
  if (ring.length < 3) return undefined;
  const area = ringArea(ring);
  if (!(area > 0)) return undefined;
  let c = 0;
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i] as readonly [number, number];
    const [x1, y1] = ring[(i + 1) % ring.length] as readonly [number, number];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    const theta = Math.atan2(dy, dx);
    c += length * Math.cos(4 * theta);
    s += length * Math.sin(4 * theta);
  }
  const angle = c === 0 && s === 0 ? 0 : Math.atan2(s, c) / 4;
  return { centre: ringCentroid(ring), side: Math.sqrt(area), angleDeg: angle / DEG };
}

/** What a small pyramid is built from, before a mesh is made of it. */
export interface SmallPyramidProfile extends SquareFit {
  /** The height it is built to, metres above its own base. */
  height: number;
  /** Its base in the frame, metres. */
  base: number;
  faceAngleDeg: number;
  /** True when the face angle came from a record rather than from the outline and the height. */
  slopeMeasured: boolean;
}

/** The measurement key a slope for the whole group would live under. */
export const QUEENS_SLOPE_KEY = 'tier3.queens.slope';

/**
 * The square, the height and the face angle of one small pyramid.
 *
 * Where the database carries a slope for the group, that slope and the square
 * fix the apex, because a measured angle beats a height OSM tagged off a
 * photograph. Where it does not, the height stands as the footprint gives it
 * and the angle follows from the two. Nothing is built without a height.
 */
export function smallPyramidProfile(f: Footprint, env: Environment): SmallPyramidProfile | undefined {
  if (f.group !== 'queens') return undefined;
  const fit = squareFit(f.ring);
  const span = footprintSpan(f, env);
  if (fit === undefined || span === undefined) return undefined;
  const slope = env[QUEENS_SLOPE_KEY];
  const measured = slope !== undefined && slope > 0 && slope < 90;
  const height = measured ? (fit.side / 2) * Math.tan((slope as number) * DEG) : span.top - span.bottom;
  if (!(height > 0)) return undefined;
  return {
    ...fit,
    height,
    base: span.bottom,
    faceAngleDeg: measured ? (slope as number) : Math.atan2(height, fit.side / 2) / DEG,
    slopeMeasured: measured,
  };
}

function slopeNote(p: SmallPyramidProfile): string {
  return p.slopeMeasured
    ? `its face angle of ${p.faceAngleDeg.toFixed(3)} degrees from ${QUEENS_SLOPE_KEY}, which fixes the apex`
    : `its face angle of ${p.faceAngleDeg.toFixed(3)} degrees following from the square and the height, because ` +
      `the database carries no ${QUEENS_SLOPE_KEY}`;
}

/**
 * One queen's or satellite pyramid, cased or as a stepped ruin.
 *
 * `cased` is the smooth pyramid the square and the face angle give. `stepped`
 * stacks courses of `tier3.mastaba.course.height` on the same face line and
 * stops at `RUIN_FRACTION` of the height: that course height is Reisner's
 * mean for the core mastabas of the Western Field, reused here because no
 * course height for a queen's pyramid is in the database, and the label says
 * so wherever it is drawn.
 */
export function smallPyramidMesh(f: Footprint, env: Environment, state: 'cased' | 'stepped'): LabelledMesh | undefined {
  const p = smallPyramidProfile(f, env);
  if (p === undefined) return undefined;
  const where = (mesh: Mesh): Mesh => placeMesh(mesh, p.centre[0], p.centre[1], p.base, p.angleDeg);

  if (state === 'cased') {
    return {
      ...where(pyramidMesh({ base: p.side, height: p.height })),
      label:
        `Reconstruction: ${f.name}, cased. Its base is a square of ${p.side.toFixed(2)} m, the area of the ` +
        `OSM outline, about that outline's own centroid and principal axis, and ${slopeNote(p)}. Look ` +
        'choices: four plain faces, no concavity, no casing thickness and no pyramidion.',
    };
  }

  const courseHeight = env['tier3.mastaba.course.height'];
  if (courseHeight === undefined || !(courseHeight > 0)) return undefined;
  const top = RUIN_FRACTION * p.height;
  const count = Math.floor(top / courseHeight);
  if (count < 1) return undefined;
  const courses = Array.from({ length: count }, () => courseHeight);
  return {
    ...where(steppedPyramidMesh({ base: p.side, height: p.height, courses })),
    label:
      `Reconstruction: ${f.name}, as a stepped ruin. ${count} courses of ` +
      `${courseHeight.toFixed(4)} m, which is tier3.mastaba.course.height, Reisner's mean for the core ` +
      'mastabas of the Western Field, reused here because the database carries no course height for a ' +
      `queen's pyramid. They are hung on the same face line as the cased state, with ${slopeNote(p)}. Look ` +
      `choices: the reuse of the mastaba course, and stopping at ${RUIN_FRACTION} of the built height, ` +
      'one fraction for every one of them.',
  };
}
