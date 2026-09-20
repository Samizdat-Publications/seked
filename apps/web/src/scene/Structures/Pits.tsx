/**
 * The boat pits: a cut in the ground, drawn as a solid so the cut takes its
 * own dark rock, with a lid of slabs over it in the states that stand the
 * plateau whole. Khufu's southern pit was found closed by forty-one limestone
 * blocks, so a covered pit is the documented condition of one of them; that
 * every pit is covered, and by one slab, is a look choice and the model says
 * so in the label.
 *
 * The cut takes the bedrock set rather than a flat colour, changed
 * 2026-09-20. It had `strength: 0`, which is the flat tint and no photograph
 * at all, and docs/shot-list.md is why that matters: the covering slabs stand
 * 116 m from the camera in the shot inside the Great Pyramid, third nearest
 * of anything in the walkthrough, and a rock-cut trench at that range reads
 * as a dark hole rather than as rock. `bedrock` is the quarried face the
 * Sphinx enclosure already uses, which is the same thing these are: stone the
 * quarrymen cut back. The tint stays what it was, so the pit is no lighter
 * than before, it simply has a surface now.
 */
import type { Plane } from 'three';
import type { StructureMesh } from '../../model';
import type { StateId } from '../../view';
import { Built, COLOURS } from './Built';

export function Pits({
  pits,
  covers,
  state,
  clippingPlanes,
}: {
  pits: StructureMesh[];
  covers: StructureMesh | undefined;
  state: StateId;
  clippingPlanes: Plane[];
}): React.JSX.Element {
  return (
    <>
      {pits.map((pit) => (
        <Built
          key={pit.id}
          built={pit}
          state={state}
          clippingPlanes={clippingPlanes}
          role="bedrock"
          colour={COLOURS.pit}
          stone={{ strength: 0.7, relief: 0.9 }}
        />
      ))}
      {covers && (
        <Built
          built={covers}
          state={state}
          clippingPlanes={clippingPlanes}
          role="core"
          colour={COLOURS.limestone}
          stone={{ strength: 0.85, relief: 0.7 }}
        />
      )}
    </>
  );
}
