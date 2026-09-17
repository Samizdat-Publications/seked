import { DEG } from '@seked/units';
import { useEffect, useMemo, type RefObject } from 'react';
import { BufferGeometry, DoubleSide, FrontSide, type MeshPhysicalMaterial, type Plane } from 'three';
import type { PyramidParams } from '../model';
import { useView } from '../store';
import type { StateId } from '../view';
import { meshGeometry, pyramidGeometry, steppedPyramidGeometry } from './geometry';
import { CASING_COLOUR, applyCasing } from './materials/casing';
import { ELECTRUM_COLOUR, applyElectrum } from './materials/metal';
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
  // The course tops the casing's joints are drawn at, worked out once for all
  // three: a pyramid with no course table of its own is coursed at the mean of
  // the pyramid that has one, which is what render_materials.py does and says.
  const casing = useMemo(() => {
    const fallback = meanCourse(pyramids.find((p) => p.courses !== undefined)?.courses);
    return new Map(pyramids.map((p) => [p.id, casingCourseLevels(p, fallback)]));
  }, [pyramids]);
  return (
    <>
      {pyramids.map((params) => (
        <Pyramid
          key={params.id}
          params={params}
          state={state}
          casingCourses={casing.get(params.id) ?? []}
          clippingPlanes={clippingPlanes}
        />
      ))}
    </>
  );
}

/**
 * The height above the base each course of the casing tops out at, bottom up.
 *
 * The same list `course_levels_to_apex` in blender/render_materials.py builds,
 * and for the same reason: the database carries a course table for the Great
 * Pyramid alone, and it stops short of the apex. So a pyramid is coursed by
 * its own courses as far as they go, and above them, or for a pyramid with no
 * table at all, at the mean course of the one that has. That mean is a number
 * out of the database rather than a number chosen here, but which pyramid it
 * is taken from is a look choice, and it is the one the render makes. A
 * preset carrying no courses at all draws no joints rather than invented ones.
 */
export function casingCourseLevels(params: PyramidParams, fallbackCourse: number): number[] {
  const levels: number[] = [];
  let z = 0;
  for (const h of params.courses ?? []) {
    if (z + h >= params.height) break;
    z += h;
    levels.push(z);
  }
  const mean = meanCourse(params.courses) || fallbackCourse;
  if (!(mean > 0)) return levels;
  while (z + mean < params.height) {
    z += mean;
    levels.push(z);
  }
  return levels;
}

function Pyramid(props: PyramidPartProps): React.JSX.Element {
  if (isCased(props.state)) {
    return (
      <>
        <CasedPyramid {...props} />
        <Pyramidion {...props} />
      </>
    );
  }
  return (
    <>
      <StandingCore {...props} />
      <CasingCap {...props} />
    </>
  );
}

/**
 * The capstone, in the states that have one: plain casing stone as built, and
 * electrum in the First Time, which is the claim the spec makes of that state.
 * Nothing about its form is chosen here. `pyramidionMesh` builds it from
 * `<id>.pyramidion.height` and the pyramid's own face angle and hands it back
 * already standing in the site frame with its apex at the pyramid's apex, so
 * it is drawn without a transform of its own and cannot drift off the top.
 */
function Pyramidion({ params, state, clippingPlanes }: PyramidPartProps): React.JSX.Element | null {
  const capstone = params.pyramidion;
  const geometry = useGeometry(
    () => (capstone ? meshGeometry(capstone) : new BufferGeometry()),
    `pyramidion:${params.id}:${capstone?.vertexCount ?? 0}:${capstone?.positions[2] ?? 0}`,
  );
  const electrum = state === 'ancient';
  // The stone is the casing's, faintly, for the built state; electrum takes
  // its colour from what it reflects and wants no photograph over it.
  const standard = useStoneMaterial(electrum ? undefined : 'casing', { strength: electrum ? 0 : 0.3, relief: 0.2 });
  const material = standard as RefObject<MeshPhysicalMaterial | null>;
  useEffect(() => {
    const m = material.current;
    if (!m) return;
    if (electrum) applyElectrum(m);
    else applyCasing(m, { courses: [], pristine: false });
  }, [material, electrum]);
  if (!capstone) return null;
  return (
    <mesh
      geometry={geometry}
      userData={{
        seked: {
          name: `${params.label}: the capstone`,
          tier: 'reconstruction',
          note: capstone.label,
          state,
        },
      }}
      castShadow
      receiveShadow
    >
      <meshPhysicalMaterial
        key={electrum ? 'electrum' : 'stone'}
        ref={material}
        color={electrum ? ELECTRUM_COLOUR : CASING_COLOUR}
        flatShading
        side={sideFor(clippingPlanes)}
        clippingPlanes={clippingPlanes}
      />
    </mesh>
  );
}

/**
 * The pyramid as it was finished: the smooth solid, hollowed faces and all,
 * dressed in polished Tura limestone with the database's own courses laid on
 * it. `ancient` polishes it to the mirror the spec asks of the First Time;
 * `built` leaves it a dressed face.
 */
function CasedPyramid({ params, state, casingCourses, clippingPlanes }: PyramidPartProps): React.JSX.Element {
  const { base, height, concavity } = params;
  const geometry = useGeometry(
    () => pyramidGeometry({ base, height, concavity }),
    `cased:${base}:${height}:${concavity}`,
  );
  // Cased, a face takes the fine pale stone faintly: the photograph is the
  // grain of the limestone, and the masonry on top of it is `applyCasing`'s.
  // A look choice, as the other strengths are.
  const standard = useStoneMaterial('casing', { strength: 0.35, relief: 0.25 });
  const material = standard as RefObject<MeshPhysicalMaterial | null>;
  const pristine = state === 'ancient';
  const coursesKey = `${casingCourses.length}:${casingCourses[casingCourses.length - 1] ?? 0}`;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (material.current) applyCasing(material.current, { courses: casingCourses, pristine });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material, coursesKey, pristine]);
  return (
    <PyramidMesh params={params} state={state} geometry={geometry} clippingPlanes={clippingPlanes}>
      <meshPhysicalMaterial
        key="cased"
        ref={material}
        color={CASING_COLOUR}
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
  /** The course tops the casing's joints are drawn at, from `casingCourseLevels`. */
  casingCourses: number[];
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
}: {
  params: PyramidParams;
  state: StateId;
  clippingPlanes: Plane[];
  geometry: BufferGeometry;
  children: React.ReactNode;
}): React.JSX.Element {
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
