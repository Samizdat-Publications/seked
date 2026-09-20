/**
 * The queens' and satellite pyramids, cased in the early states and as
 * stepped cores in the late ones. The builder is `smallPyramidMesh`; what is
 * chosen here is only the stone.
 */
import type { Plane } from 'three';
import type { Environment } from '@seked/geometry';
import type { StructureMesh } from '../../model';
import type { StateId } from '../../view';
import { Built, COLOURS } from './Built';

/** Typical length of a block along a course, metres. A look choice, as it is for the pyramids. */
const LOOK = { blockLengthM: 2.5 };

export function Queens({
  queens,
  env,
  state,
  whole,
  clippingPlanes,
}: {
  queens: StructureMesh[];
  env: Environment;
  state: StateId;
  whole: boolean;
  clippingPlanes: Plane[];
}): React.JSX.Element {
  // The one course height the database carries for the plateau's smaller
  // masonry, which is what the stepped builder stacks; the stone's joints are
  // spaced by the same number so the two cannot disagree.
  const course = env['tier3.mastaba.course.height'] ?? 0;
  return (
    <>
      {queens.map((one) => (
        <Built
          key={one.id}
          built={one}
          state={state}
          clippingPlanes={clippingPlanes}
          role={whole ? 'casing' : 'core'}
          colour={whole ? COLOURS.casing : COLOURS.limestone}
          stone={
            whole
              ? {
                  strength: 0.45,
                  relief: 0.35,
                  course,
                  // The cased face gets the block tone the ruined one has
                  // always had. G1-a stands 84 m from the camera in the shot
                  // inside the Great Pyramid, nearer than anything else in
                  // the walkthrough (docs/shot-list.md), and at that range a
                  // dressed face with joints but no tone between the blocks
                  // reads as a scored sheet rather than as laid stone. The
                  // course height is the database's; the block's length is
                  // the look choice above.
                  block: course > 0 ? { length: LOOK.blockLengthM, height: course } : undefined,
                }
              : { strength: 0.9, relief: 1, block: course > 0 ? { length: LOOK.blockLengthM, height: course } : undefined }
          }
        />
      ))}
    </>
  );
}
