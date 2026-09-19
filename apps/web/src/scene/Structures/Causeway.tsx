/**
 * Khafre's causeway, and the roof over it in the states that stand the
 * complexes whole. The causeway itself is the ribbon the footprint import
 * built on the ridge it runs along, so it is there in every state; the roof is
 * carried over it by `causewayRoofMesh` from the two keys the database holds
 * for it, on the walls `causewayWallsMesh` puts under it. No record here gives
 * those walls and the label says so: they are a look choice, as the roof's own
 * flat top is.
 */
import type { Plane } from 'three';
import type { StructureMesh } from '../../model';
import type { StateId } from '../../view';
import { Built, COLOURS } from './Built';

export function Causeway({
  causeway,
  roof,
  walls,
  state,
  clippingPlanes,
}: {
  causeway: StructureMesh | undefined;
  roof: StructureMesh | undefined;
  walls: StructureMesh | undefined;
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
      {walls && (
        <Built
          built={walls}
          state={state}
          clippingPlanes={clippingPlanes}
          role="core"
          colour={COLOURS.limestone}
          stone={{ strength: 0.8, relief: 0.7 }}
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
