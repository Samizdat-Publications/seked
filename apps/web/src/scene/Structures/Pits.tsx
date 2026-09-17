/**
 * The boat pits: a cut in the ground, drawn as a solid so the cut takes its
 * own dark rock, with a lid of slabs over it in the states that stand the
 * plateau whole. Khufu's southern pit was found closed by forty-one limestone
 * blocks, so a covered pit is the documented condition of one of them; that
 * every pit is covered, and by one slab, is a look choice and the model says
 * so in the label.
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
          role={undefined}
          colour={COLOURS.pit}
          stone={{ strength: 0 }}
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
