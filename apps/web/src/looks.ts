/**
 * The hero looks: the five stands the Blender renders proved, as views the
 * browser can be put at.
 *
 * Each is a camera and a moment. The cameras are `blender/render.py`'s own
 * `VIEWS`, which are compositions and not measurements: they were chosen by
 * looking at what came out. They are stated there in the project frame,
 * +X east, +Y north, +Z up, and are turned here into three's world frame,
 * which is that frame Y-up: [east, up, -north]. Nothing else about them
 * changes, so a look in the viewer stands where the render stood.
 *
 * The moments are `view.ts`'s named ones, which are the moments each render
 * named in the sky bake. One caution about them: their days are the modern
 * calendar's for the equinoxes and the solstices, and at the epochs this
 * viewer opens on the seasons have moved weeks away from those days, because
 * the proleptic Julian calendar drifts and delta T is sixteen hours at 2450
 * BCE. A named moment is therefore a time of day and a rough season, not the
 * solstice itself. Putting that right means solving for the day at the
 * epoch, which `seasonInstant` in `@seked/sky` can do and this table cannot.
 */
import { MOMENTS, type CameraView, type Moment, type Vec3 } from './view';

export type LookId = 'dawn' | 'panorama' | 'harbour' | 'akhet' | 'night';

export interface Look {
  id: LookId;
  label: string;
  camera: CameraView;
  moment: Moment;
  /** What the stand is for, in the words the render script uses for it. */
  note: string;
}

/** A place in the project frame, +X east, +Y north, +Z up, as three's world reads it. */
export function toWorld([east, north, up]: readonly [number, number, number]): Vec3 {
  return [east, up, -north];
}

const moment = (id: string): Moment => {
  const named = MOMENTS.find((m) => m.id === id);
  if (!named) throw new Error(`looks: no moment "${id}" in view.ts`);
  return named.moment;
};

export const LOOKS: ReadonlyArray<Look> = [
  {
    id: 'dawn',
    label: 'Dawn from the east',
    camera: { position: toWorld([700, 300, 45]), target: toWorld([-60, -90, 40]) },
    moment: moment('equinox-dawn'),
    note: 'The equinox sun an hour up, raking the east faces from across the plateau.',
  },
  {
    id: 'panorama',
    label: 'The three from the south',
    camera: { position: toWorld([-100, -1700, 60]), target: toWorld([-300, -370, 58]) },
    moment: moment('winter-dusk'),
    note: 'The low December sun on the south faces, the east faces in shadow and the west edges catching it: the render that proved the look.',
  },
  {
    id: 'harbour',
    label: 'Over the harbour',
    camera: { position: toWorld([520, -330, 45]), target: toWorld([320, -450, -35]) },
    moment: moment('equinox-dawn'),
    note: 'North-east of the Sphinx, looking down across the valley temples and the causeway climbing to Khafre.',
  },
  {
    id: 'akhet',
    label: 'The akhet from the Sphinx',
    camera: { position: toWorld([503.1, -501.5, 46.2]), target: toWorld([-206.4, -132.1, 67.1]) },
    moment: moment('summer-sunset'),
    note: "C6's own target: the gap between the Great Pyramid's south-west corner and Khafre's north-east one, from a stand in front of the Sphinx.",
  },
  {
    id: 'night',
    label: 'Night over the apex',
    camera: { position: toWorld([0, 300, 45]), target: toWorld([0, -200, 268]) },
    moment: moment('midnight'),
    note: 'From the north, looking up past the Great Pyramid into the stars of the epoch.',
  },
];

export const lookById = (id: LookId): Look | undefined => LOOKS.find((look) => look.id === id);
