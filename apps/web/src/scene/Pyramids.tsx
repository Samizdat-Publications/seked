import { DEG } from '@seked/units';
import { useEffect, useMemo } from 'react';
import { BufferGeometry, DoubleSide, FrontSide, type Plane } from 'three';
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

function Pyramid({
  params,
  state,
  clippingPlanes,
}: {
  params: PyramidParams;
  state: StateId;
  clippingPlanes: Plane[];
}): React.JSX.Element {
  if (isCased(state)) return <CasedPyramid params={params} state={state} clippingPlanes={clippingPlanes} />;
  return (
    <>
      <StandingCore params={params} state={state} clippingPlanes={clippingPlanes} />
      <CasingCap params={params} state={state} clippingPlanes={clippingPlanes} />
    </>
  );
}

/** The pyramid as it was finished: the smooth solid, hollowed faces and all. */
function CasedPyramid({ params, state, clippingPlanes }: PyramidPartProps): React.JSX.Element {
  const { base, height, concavity } = params;
  const geometry = useGeometry(
    () => pyramidGeometry({ base, height, concavity }),
    `cased:${base}:${height}:${concavity}`,
  );
  // Cased, a face takes the fine pale stone faintly. The coursing is the
  // database's: the mean of the courses this pyramid carries, which is what
  // the joints on a dressed face are spaced by. A pyramid with no courses
  // recorded gets none.
  const material = useStoneMaterial('casing', { strength: 0.45, relief: 0.35, course: meanCourse(params.courses) });
  return (
    <PyramidMesh params={params} state={state} geometry={geometry} clippingPlanes={clippingPlanes}>
      <meshStandardMaterial
        key="cased"
        ref={material}
        color="#d6c49c"
        roughness={0.94}
        metalness={0}
        flatShading
        side={sideFor(clippingPlanes)}
        clippingPlanes={clippingPlanes}
      />
    </PyramidMesh>
  );
}

/**
 * The core as it stands: course by course where the database has the courses
 * and as a flat truncation where it does not, which is the same choice
 * blender/generate.py makes for its "(today)" object. Where a cap of casing
 * survives the core stops under it, so the two solids do not fight for the
 * same faces.
 */
function StandingCore({ params, state, clippingPlanes }: PyramidPartProps): React.JSX.Element {
  const { base, height, heightToday, concavity } = params;
  const top = capLevel(params) ?? heightToday;
  const courses = coursesBelow(params.courses, top);
  const geometry = useGeometry(
    () =>
      courses
        ? steppedPyramidGeometry({ base, height, courses })
        : pyramidGeometry({ base, height, concavity, truncateAt: top }),
    `core:${base}:${height}:${concavity}:${top}:${courses?.length ?? 0}`,
  );
  const course = meanCourse(params.courses);
  const material = useStoneMaterial('core', {
    strength: 0.9,
    relief: 1,
    block: course > 0 ? { length: BLOCK_LENGTH_M, height: course } : undefined,
  });
  return (
    <PyramidMesh params={params} state={state} geometry={geometry} clippingPlanes={clippingPlanes}>
      <meshStandardMaterial
        key="standing"
        ref={material}
        color="#b3a789"
        roughness={0.94}
        metalness={0}
        flatShading
        side={sideFor(clippingPlanes)}
        clippingPlanes={clippingPlanes}
      />
    </PyramidMesh>
  );
}

/**
 * Khafre's cap: the casing that still stands under his summit, drawn as the
 * cased pyramid with everything below the cap's lower edge cut away. The
 * level is `casingCapLevel`, his present height less the depth of casing
 * Maragioglio and Rinaldi record there, so nothing about the cap is placed by
 * hand. Any pyramid the database gave such a record would get one; today only
 * Khafre has one.
 */
function CasingCap({ params, state, clippingPlanes }: PyramidPartProps): React.JSX.Element | null {
  const { base, height, heightToday, concavity } = params;
  const level = capLevel(params);
  const geometry = useGeometry(
    () =>
      level === undefined
        ? new BufferGeometry()
        : pyramidGeometry({ base, height, concavity, fromHeight: level, truncateAt: heightToday }),
    `cap:${base}:${height}:${concavity}:${level}:${heightToday}`,
  );
  // The cap is weathered casing, not dressed casing: four and a half thousand
  // years of it. Look choices, set against blender/render_materials.py's
  // `cap_over_core_material` and the panorama it renders: the fine pale stone
  // rather than the core's coarse one, a good deal paler and smoother than
  // the core below, because a photograph of Khafre is a white hat on a brown
  // stack and the two have to be told apart at a kilometre.
  const material = useStoneMaterial('casing', { strength: 0.5, relief: 0.5, course: meanCourse(params.courses) });
  if (level === undefined) return null;
  return (
    <PyramidMesh params={params} state={state} geometry={geometry} clippingPlanes={clippingPlanes}>
      <meshStandardMaterial
        key="cap"
        ref={material}
        color="#e3d8bc"
        roughness={0.7}
        metalness={0}
        flatShading
        side={sideFor(clippingPlanes)}
        clippingPlanes={clippingPlanes}
      />
    </PyramidMesh>
  );
}

interface PyramidPartProps {
  params: PyramidParams;
  state: StateId;
  clippingPlanes: Plane[];
}

/**
 * One solid of one pyramid, placed and labelled. The placement is the
 * structure's own, so every part of a pyramid stands on the same centre and
 * turns by the same measured orientation.
 */
function PyramidMesh({
  params,
  state,
  geometry,
  clippingPlanes,
  children,
}: PyramidPartProps & { geometry: BufferGeometry; children: React.ReactNode }): React.JSX.Element {
  return (
    <mesh
      geometry={geometry}
      position={[params.offsetEast, params.offsetNorth, params.offsetUp]}
      rotation={[0, 0, params.orientationDeg * DEG]}
      userData={sekedUserData(params, state)}
      castShadow
      receiveShadow
    >
      {children}
    </mesh>
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

/**
 * A geometry rebuilt only when one of the numbers behind it moves, and
 * disposed when it is replaced. The model is rebuilt on every store change,
 * so a fresh params object arrives each time even when not one vertex has
 * moved; the key is what could actually move it.
 */
function useGeometry(build: () => BufferGeometry, key: string): BufferGeometry {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(build, [key]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** The cap's lower edge, where it is a level inside the pyramid as it stands. */
function capLevel(params: PyramidParams): number | undefined {
  const { casingCapLevel, heightToday } = params;
  if (casingCapLevel === undefined || heightToday === undefined) return undefined;
  return casingCapLevel > 0 && casingCapLevel < heightToday ? casingCapLevel : undefined;
}

/** The courses that stand entirely below a level, or all of them for no level. */
function coursesBelow(courses: number[] | undefined, level: number | undefined): number[] | undefined {
  if (courses === undefined || courses.length === 0) return undefined;
  if (level === undefined) return courses;
  const kept: number[] = [];
  let z = 0;
  for (const h of courses) {
    if (z + h > level) break;
    kept.push(h);
    z += h;
  }
  return kept.length > 0 ? kept : undefined;
}

/** The mean of the courses a pyramid carries, or zero for one that carries none. */
function meanCourse(courses: number[] | undefined): number {
  return courses && courses.length > 0 ? courses.reduce((a, b) => a + b, 0) / courses.length : 0;
}

/**
 * A section leaves the far side of the masonry facing away from the reader, so
 * the cut only reads if the back faces are drawn.
 */
function sideFor(clippingPlanes: Plane[]): typeof FrontSide | typeof DoubleSide {
  const cut = clippingPlanes.length > 0 && clippingPlanes[0]?.constant !== undefined && Math.abs(clippingPlanes[0].constant) < 1e6;
  return cut ? DoubleSide : FrontSide;
}
