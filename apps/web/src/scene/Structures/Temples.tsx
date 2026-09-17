/**
 * The six temples of the footprint import, as three surfaces: the walls on
 * the traced outline, the roof slab over them and the colonnade inside the
 * court. The roof and the colonnade belong to the early states only; the late
 * ones show the walls at a quarter of what stands.
 *
 * Khafre's valley temple is Petrie's Granite Temple and takes granite, in
 * every state, because its core blocks and its casing are what it is known
 * for. The colonnades are granite everywhere, which is a look choice: the
 * monolithic red granite pillars of that temple are the model for all of them
 * and nothing in the database says what the other five were columned with.
 */
import type { Plane } from 'three';
import type { TempleStructure } from '../../model';
import type { StateId } from '../../view';
import { Built, COLOURS } from './Built';

/** The temples whose stone is granite rather than limestone. A look choice everywhere but the first. */
const GRANITE = new Set(['khafre.valley_temple']);

export function Temples({
  temples,
  state,
  whole,
  clippingPlanes,
}: {
  temples: TempleStructure[];
  state: StateId;
  whole: boolean;
  clippingPlanes: Plane[];
}): React.JSX.Element {
  return (
    <>
      {temples.map((temple) => {
        const granite = GRANITE.has(temple.id);
        const role = granite ? 'granite' : whole ? 'casing' : 'core';
        const colour = granite ? COLOURS.granite : whole ? COLOURS.casing : COLOURS.limestone;
        return (
          <group key={temple.id}>
            <Built
              built={temple}
              state={state}
              clippingPlanes={clippingPlanes}
              role={role}
              colour={colour}
              stone={{ strength: 0.75, relief: 0.8 }}
              mesh={temple.walls}
              part="walls"
            />
            {temple.roof && (
              <Built
                built={temple}
                state={state}
                clippingPlanes={clippingPlanes}
                role="core"
                colour={COLOURS.limestone}
                stone={{ strength: 0.85, relief: 0.6 }}
                mesh={temple.roof}
                part="roof"
              />
            )}
            {temple.pillars && (
              <Built
                built={temple}
                state={state}
                clippingPlanes={clippingPlanes}
                role="granite"
                colour={COLOURS.granite}
                stone={{ strength: 0.85, relief: 0.5 }}
                mesh={temple.pillars}
                part="pillars"
              />
            )}
          </group>
        );
      })}
    </>
  );
}
