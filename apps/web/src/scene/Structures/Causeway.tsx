/**
 * Khafre's causeway, and the roof over it in the states that stand the
 * complexes whole. The causeway itself is the ribbon the footprint import
 * built on the ridge it runs along, so it is there in every state; the roof is
 * carried over it by `causewayRoofMesh` from the two keys the database holds
 * for it. The walls that would have carried the roof are not drawn: no record
 * here gives them.
 */
import type { Plane } from 'three';
import type { StructureMesh } from '../../model';
import type { StateId } from '../../view';
import { Built, COLOURS } from './Built';

export function Causeway({
  causeway,
  roof,
  state,
  clippingPlanes,
}: {
  causeway: StructureMesh | undefined;
  roof: StructureMesh | undefined;
  state: StateId;
  clippingPlanes: Plane[];
}): React.JSX.Element {
  return (
    <>
      {causeway && (
        <Built
          built={causeway}
          state={state}
          clippingPlanes={clippingPlanes}
          role="core"
          colour={COLOURS.limestone}
          stone={{ strength: 0.9, relief: 0.9 }}
        />
      )}
      {roof && (
        <Built
          built={roof}
          state={state}
          clippingPlanes={clippingPlanes}
          role="casing"
          colour={COLOURS.casing}
          stone={{ strength: 0.6, relief: 0.5 }}
        />
      )}
    </>
  );
}
