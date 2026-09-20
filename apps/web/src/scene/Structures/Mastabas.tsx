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

/**
 * Typical length of a block along a course, metres, and how far one tomb's
 * tone is allowed to sit from another's. Both look choices.
 *
 * The tone is the one that matters for the picture. The field is a single
 * merged buffer of 577 tombs and it is in all eleven shots of the walkthrough
 * (docs/shot-list.md), nearer than 300 m in one of them, and until now every
 * tomb in it was the same colour, so it read as a pale carpet rather than as
 * a cemetery. `model.ts` writes a number per tomb from its own id and
 * `stone.ts` reads it.
 *
 * The size of the spread is bounded at the top by arithmetic rather than by
 * taste. The shader multiplies the photograph by `1 + bodyTone * (t - 0.5) *
 * 2` for a tone t in [0, 1), so anything over 1 sends the darkest bodies
 * negative and they clamp to black: at 1.5 about a sixth of the field went
 * out. Under 0.5 the whole range stays positive, and 0.45 is most of what is
 * available without clipping.
 */
const LOOK = { blockLengthM: 2.0, bodyTone: 0.45 };

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
    ? { strength: 0.5, relief: 0.4, course, bodyTone: LOOK.bodyTone }
    : {
        strength: 0.9,
        relief: 1,
        block: course > 0 ? { length: LOOK.blockLengthM, height: course } : undefined,
        bodyTone: LOOK.bodyTone,
      };
  return (
    <>
      {field && <Built built={field} state={state} clippingPlanes={clippingPlanes} role={role} colour={colour} stone={stone} />}
      {tombs.map((tomb) => (
        <Built key={tomb.id} built={tomb} state={state} clippingPlanes={clippingPlanes} role={role} colour={colour} stone={stone} />
      ))}
    </>
  );
}
