/**
 * The hero cameras, as `blender/render.py` frames them.
 *
 * Each look is one of that file's VIEWS: its station and its aim, turned from
 * the data frame (east, north, up) into the world frame the store's camera
 * lives in, which is that frame Y-up, so `[east, north, up]` becomes
 * `[east, up, -north]`. The moment is not restated here either: a view names
 * a moment in the sky bake, and each of those is one of `MOMENTS`, so the
 * look points at the preset rather than carrying a day and an hour of its
 * own.
 *
 * The metres are framings and not measurements. Nothing downstream reads them
 * and no claim depends on one.
 */
import { MOMENTS, type CameraView, type Moment } from '../view';

export interface Look {
  id: string;
  label: string;
  camera: CameraView;
  moment: Moment;
  /** What the view is of, and what it wants before it reads as intended. */
  note: string;
}

const momentOf = (id: (typeof MOMENTS)[number]['id']): Moment => {
  const named = MOMENTS.find((m) => m.id === id);
  if (named === undefined) throw new Error(`no moment named ${id}`);
  return named.moment;
};

export const LOOKS: readonly Look[] = [
  {
    id: 'dawn',
    label: 'Dawn',
    camera: { position: [700, 45, -300], target: [-60, 40, 90] },
    moment: momentOf('equinox-dawn'),
    note: 'From the plain east and a little north of the Great Pyramid, an hour after the equinox sunrise, with the east faces taking the first of the light.',
  },
  {
    id: 'panorama',
    label: 'Panorama',
    camera: { position: [-100, 60, 1700], target: [-300, 58, 370] },
    moment: momentOf('winter-dusk'),
    note: 'The three from the desert well south of them, Menkaure on the left and Khufu on the right, under the December sun an hour before it sets. The render this whole look was proved on.',
  },
  {
    id: 'harbour',
    label: 'Harbour',
    camera: { position: [520, 45, 330], target: [320, -35, 450] },
    moment: momentOf('equinox-dawn'),
    note: 'From the air north-east of the Sphinx, down across the basin and the valley temples to the enclosure. Made for the built state, which is the one that fills the harbour.',
  },
  {
    id: 'akhet',
    label: 'Akhet',
    camera: { position: [503.1, 46.2, 501.5], target: [-206.4, 67.1, 132.1] },
    moment: momentOf('summer-sunset'),
    note: "Standing in front of the Sphinx and looking at the gap between Khufu's south-west corner and Khafre's north-east one, which is claim C6's own target, at the June solstice sunset.",
  },
  {
    id: 'night',
    label: 'Night',
    camera: { position: [0, 45, -300], target: [0, 268, 200] },
    moment: momentOf('midnight'),
    note: "Up the Great Pyramid's north face at midnight, which is where the Blender night frame stands. Turn the star dome on in Layers to see what it is looking at.",
  },
] as const;
