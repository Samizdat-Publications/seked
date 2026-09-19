/**
 * The plateau's lesser monuments, built from our own data, one look per stop
 * on the timeline.
 *
 * Stage 1 drew every footprint as a massing: the traced outline carried up to
 * a height that was OSM's or an estimate, the same solid in every state. Stage
 * 2 hands each group to the builder `@seked/geometry` has for it, and the
 * timeline's four stops map onto the builders' two: `ancient` and `built`
 * stand the monuments whole and cased, `stripped` and `today` leave them as
 * ruins. A group with no builder, and the Sphinx's parts, keep the massing
 * and say that is what they are.
 *
 * What is drawn is what the database can carry. A queen's pyramid with no
 * recorded slope is built from its own outline and its own height and the
 * label says so; an enclosure wall with no recorded distance is not built at
 * all. Nothing here fills a hole with a plausible number.
 *
 * The component is still mounted as `Masses` from `scene/Masses.tsx`, with the
 * props Scene.tsx has always passed it, so nothing outside this folder had to
 * change. `model.plateau` now carries the footprints, the environment and the
 * structures of a state as well as the massings.
 */
import { useMemo } from 'react';
import type { Plane } from 'three';
import type { MassingParams, Plateau, StructureMesh } from '../../model';
import { isWholeState } from '../../model';
import { useView } from '../../store';
import type { StateId } from '../../view';
import { useStoneMaterial } from '../materials/useStoneMaterial';
import { Built, COLOURS } from './Built';
import { sekedUserData } from './label';
import { Causeway } from './Causeway';
import { Mastabas } from './Mastabas';
import { Pits } from './Pits';
import { Queens } from './Queens';
import { Temples } from './Temples';
import { Walls } from './Walls';

/** The plateau's black stone: the pavement of Khufu's mortuary temple, from Petrie's corners. */
const BASALT = new Set(['khufu.basalt_pavement']);

export function Structures({
  massings,
  plateau,
  clippingPlanes,
}: {
  massings: MassingParams[];
  plateau: Plateau;
  clippingPlanes: Plane[];
}): React.JSX.Element {
  const state = useView((s) => s.state);
  // The one layer this folder reads for itself. Lifting the temple roofs off
  // is how a reader sees a court and its colonnade, which is the whole point
  // of laying the pillars round the edge rather than across the middle.
  const roofs = useView((s) => s.layers.roofs);
  // Memoised on the model and the state: `plateau.structures` keeps one build
  // per state inside the closure the model made, and a new model makes a new
  // closure. Building a state costs about a tenth of a second, almost all of
  // it the 577 mastabas, and it happens once.
  const structures = useMemo(() => plateau.structures(state), [plateau, state]);
  const whole = isWholeState(state);
  const { env } = plateau;

  return (
    <>
      {massings.map((params) => (
        <Massing key={params.id} params={params} state={state} clippingPlanes={clippingPlanes} />
      ))}
      <Queens queens={structures.queens} env={env} state={state} whole={whole} clippingPlanes={clippingPlanes} />
      <Mastabas field={structures.mastabas} tombs={structures.tombs} env={env} state={state} whole={whole} clippingPlanes={clippingPlanes} />
      <Temples temples={structures.temples} state={state} whole={whole} roofs={roofs} clippingPlanes={clippingPlanes} />
      <Walls walls={structures.walls} enclosureWalls={structures.enclosureWalls} state={state} clippingPlanes={clippingPlanes} />
      <Causeway
        causeway={structures.causeway}
        roof={structures.causewayRoof}
        walls={structures.causewayWalls}
        state={state}
        clippingPlanes={clippingPlanes}
      />
      <Pits pits={structures.pits} covers={structures.pitCovers} state={state} clippingPlanes={clippingPlanes} />
      {structures.fallback.map((one) => (
        <Fallback key={one.id} built={one} state={state} clippingPlanes={clippingPlanes} />
      ))}
    </>
  );
}

/** Whatever no builder covers: the Sphinx's parts, Khentkawes, the basalt pavement. */
function Fallback({ built, state, clippingPlanes }: { built: StructureMesh; state: StateId; clippingPlanes: Plane[] }): React.JSX.Element {
  const basalt = BASALT.has(built.id);
  return (
    <Built
      built={built}
      state={state}
      clippingPlanes={clippingPlanes}
      role={basalt ? undefined : 'core'}
      colour={basalt ? COLOURS.basalt : COLOURS.limestone}
      stone={basalt ? { strength: 0 } : { strength: 0.85, relief: 0.7 }}
    />
  );
}

/**
 * A massing placeholder: the Sphinx as a box of the surveyed length, width
 * and height, sitting on the frame's datum plane at the offsets derived from
 * its cited coordinates. The same box blender/generate.py builds, and drawn
 * flat and dull on purpose, because it is a volume and not a statue. It is
 * mounted only where the footprint import has no Sphinx at all.
 */
function Massing({ params, state, clippingPlanes }: { params: MassingParams; state: StateId; clippingPlanes: Plane[] }): React.JSX.Element {
  const { length, width, height, offsetEast, offsetNorth } = params;
  const material = useStoneMaterial(undefined, { strength: 0 });
  const seked = useMemo(
    () =>
      sekedUserData(
        {
          id: params.id,
          name: params.label,
          tier: 'excavated',
          note:
            'Massing: a box of the surveyed length, width and height, on the centre its cited coordinates ' +
            'derive. A volume, not a statue, and drawn only where the footprint import has no Sphinx.',
        },
        state,
      ),
    [params.id, params.label, state],
  );
  return (
    <mesh position={[offsetEast, offsetNorth, height / 2]} userData={{ seked }} castShadow receiveShadow>
      <boxGeometry args={[length, width, height]} />
      <meshStandardMaterial ref={material} color="#9c9078" roughness={0.97} metalness={0} flatShading clippingPlanes={clippingPlanes} />
    </mesh>
  );
}
