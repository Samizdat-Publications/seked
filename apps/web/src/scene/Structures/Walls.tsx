/**
 * The walls: the Wall of the Crow as the footprint import traced it, and the
 * enclosure wall round a pyramid where the database says how far out it stood
 * and how high. Only Khafre's is there to draw, from Petrie's section 71, and
 * only in the states that stand the complexes whole; nothing is drawn round
 * the other two, because a wall at a guessed distance would look exactly like
 * a wall at a surveyed one.
 */
import type { Plane } from 'three';
import type { StructureMesh } from '../../model';
import type { StateId } from '../../view';
import { Built, COLOURS } from './Built';

export function Walls({
  walls,
  enclosureWalls,
  state,
  clippingPlanes,
}: {
  walls: StructureMesh[];
  enclosureWalls: StructureMesh[];
  state: StateId;
  clippingPlanes: Plane[];
}): React.JSX.Element {
  return (
    <>
      {[...walls, ...enclosureWalls].map((wall) => (
        <Built
          key={wall.id}
          built={wall}
          state={state}
          clippingPlanes={clippingPlanes}
          role="core"
          colour={COLOURS.limestone}
          stone={{ strength: 0.9, relief: 1 }}
        />
      ))}
    </>
  );
}
