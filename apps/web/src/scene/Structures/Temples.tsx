/**
 * The six temples of the footprint import, as three surfaces: the walls on
 * the traced outline, the roof slab over them and the colonnade inside the
 * court. The roof and the colonnade belong to the early states only; the late
 * ones show the walls at a quarter of what stands.
 *
 * Which stone each surface takes is no longer decided here. Until 2026-09-19
 * this file held a set of one id, `khafre.valley_temple`, and everything in
 * it was granite while everything else was limestone; that was a look choice
 * standing in for a fact, and the fact is now `data/materials.json`, where
 * every row cites a source. Khafre's valley temple is red granite from Aswan
 * on a yellow Giza limestone core with an alabaster floor, because
 * Hoelscher's Blatt XVII has a Zeichenerklaerung that names each hatching;
 * Menkaure's two temples are crude brick over limestone, because Reisner's
 * table of periods (p. 7) says Mycerinus' granite casing was never finished
 * and Shepseskaf cased the building in mud brick. A temple with no row in the
 * table is drawn in the builder's own limestone and its label says the table
 * is silent about it.
 *
 * The tints and the photographed sets behind those names are in `cased.ts`,
 * which is where a look choice about a material belongs.
 *
 * The roofs come off with the `roofs` layer, which is what a reader wants
 * when the question is how a temple was laid out rather than how it looked
 * from outside: a Fourth Dynasty mortuary temple's court is open to the sky
 * with its colonnade round the edge, and with a slab over the whole plan
 * there is nothing of that to see.
 *
 * A temple the database holds a plan for arrives with `parts` instead, one
 * mesh per piece with the stone that piece takes, and is drawn from those:
 * the mass in its own stone and the hall's lining, pillars and statue plinths
 * in whatever the table calls that temple's pillars. Khafre's valley temple
 * is the one so far, from Hoelscher's Blatt XVII.
 */
import type { Plane } from 'three';
import type { TempleStructure } from '../../model';
import type { StateId } from '../../view';
import { Built, COLOURS } from './Built';
import { lookFor, lookWords, type StoneLook } from './cased';

/**
 * What a temple is drawn as where the table says nothing: the massing's own
 * limestone, which is what every temple looked like before the table existed.
 */
const PLAIN: StoneLook = { role: 'core', colour: COLOURS.limestone, stone: { strength: 0.75, relief: 0.8 } };
const PLAIN_CASED: StoneLook = { role: 'casing', colour: COLOURS.casing, stone: { strength: 0.75, relief: 0.8 } };

export function Temples({
  temples,
  state,
  whole,
  roofs,
  clippingPlanes,
}: {
  temples: TempleStructure[];
  state: StateId;
  whole: boolean;
  /** Whether the roof slabs are drawn. Off lifts them off and leaves the court and its colonnade in the open. */
  roofs: boolean;
  clippingPlanes: Plane[];
}): React.JSX.Element {
  return (
    <>
      {temples.map((temple) => {
        // An outer wall is the casing where the building has one and the core
        // where it does not; in a ruin there is no casing left to see, so the
        // core is asked for first.
        const outside = whole
          ? lookFor(temple.stone, ['casing', 'core'], PLAIN_CASED)
          : lookFor(temple.stone, ['core', 'casing'], PLAIN);
        const pillars = lookFor(temple.stone, ['pillars', 'casing', 'core'], outside);
        const roof = lookFor(temple.stone, ['roof', 'casing', 'core'], PLAIN);
        if (temple.parts !== undefined) {
          // A plan-driven temple marks each piece granite or core. Granite
          // means "the stone this temple's pillars and lining are", which the
          // table answers; core means its mass, which is `outside`.
          return (
            <group key={temple.id}>
              {temple.parts.map((part) => {
                const look = part.material === 'granite' ? pillars : outside;
                return (
                  <Built
                    key={part.name}
                    built={temple}
                    state={state}
                    clippingPlanes={clippingPlanes}
                    role={look.role}
                    colour={look.colour}
                    stone={look.stone}
                    look={lookWords(look)}
                    mesh={part.mesh}
                    part={part.name}
                  />
                );
              })}
            </group>
          );
        }
        return (
          <group key={temple.id}>
            <Built
              built={temple}
              state={state}
              clippingPlanes={clippingPlanes}
              role={outside.role}
              colour={outside.colour}
              stone={outside.stone}
              look={lookWords(outside)}
              mesh={temple.walls}
              part="walls"
            />
            {temple.roof && roofs && (
              <Built
                built={temple}
                state={state}
                clippingPlanes={clippingPlanes}
                role={roof.role}
                colour={roof.colour}
                stone={roof.stone}
                look={lookWords(roof)}
                mesh={temple.roof}
                part="roof"
              />
            )}
            {temple.pillars && (
              <Built
                built={temple}
                state={state}
                clippingPlanes={clippingPlanes}
                role={pillars.role}
                colour={pillars.colour}
                stone={pillars.stone}
                look={lookWords(pillars)}
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
