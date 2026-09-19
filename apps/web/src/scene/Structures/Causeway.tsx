/**
 * Khafre's causeway, and the roof over it in the states that stand the
 * complexes whole. The causeway itself is the ribbon the footprint import
 * built on the ridge it runs along, so it is there in every state; the roof is
 * carried over it by `causewayRoofMesh` from the two keys the database holds
 * for it, on the walls `causewayWallsMesh` puts under it. No record here gives
 * those walls and the label says so: they are a look choice, as the roof's own
 * flat top is.
 *
 * What the three surfaces are made of does come from a record, since
 * 2026-09-19: `data/materials.json` gives the causeway a Giza limestone core
 * and a white Mokattam limestone casing, cited and not yet verified, and
 * `cased.ts` turns those names into tints. The ramp itself is drawn as its
 * core, because what a reader sees of it in a ruin is its body; the walls and
 * the roof, which only the whole states carry, are drawn as its casing.
 */
import type { Plane } from 'three';
import type { StructureMesh } from '../../model';
import type { StateId } from '../../view';
import { Built, COLOURS } from './Built';
import { lookFor, lookWords, type StoneLook } from './cased';

/** What the causeway is drawn as where the table says nothing about it. */
const PLAIN: StoneLook = { role: 'core', colour: COLOURS.limestone, stone: { strength: 0.9, relief: 0.9 } };
const PLAIN_CASED: StoneLook = { role: 'casing', colour: COLOURS.casing, stone: { strength: 0.6, relief: 0.5 } };

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
  const stone = causeway?.stone ?? walls?.stone ?? roof?.stone ?? {};
  const body = lookFor(stone, ['core', 'casing'], PLAIN);
  const cased = lookFor(stone, ['casing', 'core'], PLAIN_CASED);
  return (
    <>
      {causeway && (
        <Built
          built={causeway}
          state={state}
          clippingPlanes={clippingPlanes}
          role={body.role}
          colour={body.colour}
          stone={body.stone}
          look={lookWords(body)}
        />
      )}
      {walls && (
        <Built
          built={walls}
          state={state}
          clippingPlanes={clippingPlanes}
          role={cased.role}
          colour={cased.colour}
          stone={{ ...cased.stone, relief: 0.7 }}
          look={lookWords(cased)}
        />
      )}
      {roof && (
        <Built
          built={roof}
          state={state}
          clippingPlanes={clippingPlanes}
          role={cased.role}
          colour={cased.colour}
          stone={cased.stone}
          look={lookWords(cased)}
        />
      )}
    </>
  );
}
