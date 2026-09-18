/**
 * Every sequence the viewer can play: the tour, and the two film presets.
 *
 * A film preset is a sequence with no narration. It is the same data the tour
 * is made of and is played by the same engine, so recording one is the tour's
 * own machinery stepped a frame at a time rather than a second pipeline.
 *
 * "The eras" is the timeline made into a film: one stand, four stops, the sun
 * crossing each of them. "The rollback" is the cinematic `scripts/sky-rollback.ts`
 * bakes for Blender, in the browser: one stand, Alnitak held on the meridian
 * and the ages turning under it.
 *
 * As in the tour, every epoch is a timeline stop's own, read off `view.ts`,
 * and the sidereal time is computed by the engine rather than typed.
 */
import { LOOKS, type Look } from './looks';
import type { Sequence } from './motion/types';
import { TOUR } from './tour';
import { STATES, stateById } from './view';

function look(id: Look['id']): Look {
  const found = LOOKS.find((l) => l.id === id);
  if (!found) throw new Error(`sequences: no look "${id}" in looks.ts`);
  return found;
}

/** The stand the three pyramids were framed from for the render that proved the look. */
const PANORAMA = look('panorama');
/** The stand the stars were framed from, looking up past the apex. */
const NIGHT = look('night');

/** How long each stop holds in "The eras". A look choice: long enough to take in a whole plateau. */
const ERA_SECONDS = 15;
/**
 * The hours the sun sweeps between within each stop, from well after sunrise
 * to well before sunset. Look choices, on the panorama stand's own day.
 */
const ERA_FROM_HOUR = 6.5;
const ERA_TO_HOUR = 18.5;

/**
 * The four stops, in the order the ages ran, each for the same fifteen
 * seconds from the same stand with the same day under it. The epoch is not
 * keyed: moving the timeline takes the sky to the stop's own epoch, which is
 * what "the epoch following the state" means, and opening no claim is what
 * hands the epoch back to it.
 */
const ERAS: Sequence = {
  id: 'eras',
  label: 'The eras',
  note: 'The three from the south, held while the timeline runs from the First Time to the survey, a day of sun inside each stop.',
  shots: [...STATES]
    .sort((a, b) => a.epoch - b.epoch)
    .map((stop) => ({
      id: `era-${stop.id}`,
      seconds: ERA_SECONDS,
      camera: [{ at: 0, value: PANORAMA.camera }],
      state: { to: stop.id, at: 0 },
      claim: null,
      layers: { pyramids: true, ground: true, terrain: false, overlay: false, sky: false },
      moment: [
        { at: 0, value: { day: PANORAMA.moment.day, hour: ERA_FROM_HOUR } },
        { at: ERA_SECONDS, value: { day: PANORAMA.moment.day, hour: ERA_TO_HOUR } },
      ],
    })),
};

/** How long the rollback runs in all, and the two rests inside it. */
const ROLLBACK_SECONDS = 20;
/** The seconds the sky holds still at each of the two epochs it rolls to. */
const REST = 4;
/** The first roll ends here, the second starts at `+ REST`, and the last ends at the close. */
const FIRST_ARRIVAL = 6;
const SECOND_ARRIVAL = 16;

/**
 * 2026 back to 2450 BCE, a rest, then back to 10,500 BCE and a rest. The three
 * epochs are the `today`, `built` and `ancient` stops' own, read off the
 * timeline; 2450 BCE is also the epoch C2 is stated at, which is the claim
 * whose shafts the overlay is drawing, and 10,500 BCE is C5's.
 */
const ROLLBACK: Sequence = {
  id: 'rollback',
  label: 'The rollback',
  note: 'Night over the apex with Alnitak held on the meridian while the sky rolls from now to 2450 BCE and on to 10,500 BCE.',
  shots: [
    {
      id: 'rollback',
      seconds: ROLLBACK_SECONDS,
      camera: [{ at: 0, value: NIGHT.camera }],
      claim: 'C2',
      layers: { pyramids: true, interior: true, ground: true, overlay: true, sky: true },
      moment: [{ at: 0, value: NIGHT.moment }],
      epoch: [
        { at: 0, value: stateById('today').epoch },
        { at: FIRST_ARRIVAL, value: stateById('built').epoch },
        { at: FIRST_ARRIVAL + REST, value: stateById('built').epoch },
        { at: SECOND_ARRIVAL, value: stateById('ancient').epoch },
        { at: SECOND_ARRIVAL + REST, value: stateById('ancient').epoch },
      ],
      // The whole point of the cinematic: one star nailed to the meridian
      // while precession turns everything else around it.
      lst: { meridian: 'alnitak' },
    },
  ],
};

/** The tour first, because it is the one with words; the film presets after it. */
export const SEQUENCES: Sequence[] = [TOUR, ERAS, ROLLBACK];

export const sequenceById = (id: string): Sequence | undefined => SEQUENCES.find((s) => s.id === id);
