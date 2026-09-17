/**
 * The mastaba fields, and the named tombs that are mastabas in all but the
 * group OSM gives them.
 *
 * The field is one merged geometry per state, never 577 meshes: the builder
 * merges the core, the casing skin and the chapel of each tomb, and the model
 * merges the tombs. It is the heaviest thing the viewer builds, so it is built
 * once per state and kept for as long as the model lives.
 */
import type { Plane } from 'three';
import type { Environment } from '@seked/geometry';
import type { StructureMesh } from '../../model';
import type { StateId } from '../../view';
import { Built, COLOURS } from './Built';

/** Typical length of a block along a course, metres. A look choice. */
const LOOK = { blockLengthM: 2.0 };

export function Mastabas({
  field,
  tombs,
  env,
  state,
  whole,
  clippingPlanes,
}: {
  field: StructureMesh | undefined;
  tombs: StructureMesh[];
  env: Environment;
  state: StateId;
  whole: boolean;
  clippingPlanes: Plane[];
}): React.JSX.Element {
  // Reisner's mean course for the core mastabas of the Western Field, which is
  // what the batter and the courses of these tombs are drawn from.
  const course = env['tier3.mastaba.course.height'] ?? 0;
  const role = whole ? 'casing' : 'core';
  const colour = whole ? COLOURS.casing : COLOURS.limestone;
  const stone = whole
    ? { strength: 0.5, relief: 0.4, course }
    : { strength: 0.9, relief: 1, block: course > 0 ? { length: LOOK.blockLengthM, height: course } : undefined };
  return (
    <>
      {field && <Built built={field} state={state} clippingPlanes={clippingPlanes} role={role} colour={colour} stone={stone} />}
      {tombs.map((tomb) => (
        <Built key={tomb.id} built={tomb} state={state} clippingPlanes={clippingPlanes} role={role} colour={colour} stone={stone} />
      ))}
    </>
  );
}
