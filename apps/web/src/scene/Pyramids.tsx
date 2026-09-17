import { DEG } from '@seked/units';
import { useEffect, useMemo } from 'react';
import { DoubleSide, FrontSide, type Plane } from 'three';
import type { PyramidParams } from '../model';
import { useView } from '../store';
import type { StateId } from '../view';
import { pyramidGeometry, steppedPyramidGeometry } from './geometry';
import { useStoneMaterial } from './materials/useStoneMaterial';

/**
 * Typical length of a block along a course, in metres: a look choice, and the
 * only part of the block variation that is not the database's. Reisner's and
 * Petrie's course heights give the other axis.
 */
const BLOCK_LENGTH_M = 2.5;

/**
 * Which timeline stops stand the pyramids cased. The two early ones are the
 * monument whole, the two late ones the core the casing was quarried off; the
 * difference between `built` and `ancient`, and between `stripped` and
 * `today`, is in the materials rather than in the solid.
 */
export const CASED_STATES: ReadonlyArray<StateId> = ['ancient', 'built'];

export const isCased = (state: StateId): boolean => CASED_STATES.includes(state);

/**
 * The three pyramids, placed exactly as blender/generate.py places them: the
 * centre offsets east and north, the base elevation relative to G1's, and a
 * rotation about the vertical by the measured orientation.
 *
 * Whether they stand cased or stripped is the timeline's to say and no longer
 * a layer's: `stripped` and `today` draw the stepped core, `built` and
 * `ancient` the pyramid as it was finished.
 */
export function Pyramids({
  pyramids,
  clippingPlanes,
}: {
  pyramids: PyramidParams[];
  clippingPlanes: Plane[];
}): React.JSX.Element {
  const state = useView((s) => s.state);
  return (
    <>
      {pyramids.map((params) => (
        <Pyramid key={params.id} params={params} state={state} clippingPlanes={clippingPlanes} />
      ))}
    </>
  );
}

/**
 * What the hover label and the dissolve read off a pyramid's mesh. The tier is
 * `survey` because the solid is the database's base, height, courses and
 * orientation and nothing else.
 */
function sekedUserData(params: PyramidParams, state: StateId): Record<string, unknown> {
  return {
    seked: {
      name: params.label,
      tier: 'survey',
      note: 'Built from the measurement database under the current preset.',
      state,
    },
  };
}

function Pyramid({
  params,
  state,
  clippingPlanes,
}: {
  params: PyramidParams;
  state: StateId;
  clippingPlanes: Plane[];
}): React.JSX.Element {
  const { base, height, heightToday, courses, concavity, orientationDeg } = params;
  // A pyramid as it stands is drawn course by course where the database has
  // the courses and as a flat truncation where it does not, which is the same
  // choice blender/generate.py makes for its "(today)" object.
  const standing = !isCased(state);
  const stepped = standing && courses !== undefined;
  const truncated = standing && courses === undefined && heightToday !== undefined;
  // The params are rebuilt on every store change, so the courses arrive as a
  // fresh array each time even when not one height has moved; the stack is
  // keyed on their values so a slider tick elsewhere does not rebuild it.
  const coursesKey = courses?.join(' ');
  const geometry = useMemo(
    () =>
      stepped
        ? steppedPyramidGeometry({ base, height, courses: coursesKey!.split(' ').map(Number) })
        : pyramidGeometry({ base, height, concavity, truncateAt: truncated ? heightToday : undefined }),
    [base, height, concavity, stepped, coursesKey, truncated, heightToday],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  // A section leaves the far side of the masonry facing away from the reader,
  // so the cut only reads if the back faces are drawn.
  // Cased, a face takes the fine pale stone faintly; standing, the coarse core.
  // The coursing is the database's: the mean of the courses this pyramid
  // carries, which is what a block is high, and what the joints on a dressed
  // face are spaced by. A pyramid with no courses recorded gets neither.
  const courseHeight = courses && courses.length > 0 ? courses.reduce((a, b) => a + b, 0) / courses.length : 0;
  const material = useStoneMaterial(
    standing ? 'core' : 'casing',
    standing
      ? { strength: 0.9, relief: 1, block: courseHeight > 0 ? { length: BLOCK_LENGTH_M, height: courseHeight } : undefined }
      : { strength: 0.45, relief: 0.35, course: courseHeight },
  );
  const cut = clippingPlanes.length > 0 && clippingPlanes[0]?.constant !== undefined && Math.abs(clippingPlanes[0].constant) < 1e6;

  return (
    <mesh
      geometry={geometry}
      position={[params.offsetEast, params.offsetNorth, params.offsetUp]}
      rotation={[0, 0, orientationDeg * DEG]}
      userData={sekedUserData(params, state)}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        key={standing ? 'standing' : 'cased'}
        ref={material}
        color={standing ? '#b3a789' : '#d6c49c'}
        roughness={0.94}
        metalness={0}
        flatShading
        side={cut ? DoubleSide : FrontSide}
        clippingPlanes={clippingPlanes}
      />
    </mesh>
  );
}
