/**
 * The section cut, as three clipping planes in the world frame.
 *
 * The scene is one group rotated to turn the data's Z-up into three's Y-up, so
 * data (east, north, up) is world (east, up, -north). A `Plane` keeps the half
 * space where `normal . p + constant >= 0`, so:
 *
 *   ns  the north-south plane, normal pointing east, keeping the west side.
 *       Its position is an east coordinate, and it is the plane Petrie draws
 *       Plate I on: put it through the passages and the interior opens.
 *   ew  the east-west plane, normal pointing north in the data frame (world
 *       +Z, since north is world -Z), keeping the south side. Its position is
 *       a north coordinate.
 *
 * A material's plane count is part of its shader, so this never returns an
 * empty list: with the cut off, or off for the ground, it returns one plane
 * far enough away to keep everything. The count then never changes and no
 * material has to be recompiled when the reader turns the cut on.
 */
import { Plane, Vector3 } from 'three';
import type { Section } from './view';

/** Ten thousand kilometres above the plateau, which keeps every vertex. */
const KEEP_EVERYTHING: Plane[] = [new Plane(new Vector3(0, 1, 0), 1e7)];

/**
 * The planes to clip one material with. Pass `cut: false` for something the
 * section is not meant to touch, such as the ground when the reader has left
 * "cut the ground too" off.
 */
export function sectionPlanes(section: Section, cut = true): Plane[] {
  if (!cut || !section.on) return KEEP_EVERYTHING;
  return section.axis === 'ns'
    ? [new Plane(new Vector3(-1, 0, 0), section.at)]
    : [new Plane(new Vector3(0, 0, 1), section.at)];
}
