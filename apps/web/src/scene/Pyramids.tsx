import { DEG } from '@seked/units';
import { useEffect, useMemo, useRef } from 'react';
import { DoubleSide, FrontSide, type MeshStandardMaterial, type Plane } from 'three';
import type { MassingParams, PlateauMass, PyramidParams } from '../model';
import { meshGeometry, pyramidGeometry, steppedPyramidGeometry } from './geometry';
import { applyAtmosphere } from './Atmosphere';
import { forgetCascades, receiveCascades } from './materials/shadows';
import { applyStone, useStone, type StoneOptions, type StoneRole } from './materials/stone';

/**
 * Typical length of a block along a course, in metres: a look choice, and the
 * only part of the block variation that is not the database's. Reisner's and
 * Petrie's course heights give the other axis.
 */
const BLOCK_LENGTH_M = 2.5;

/**
 * A standard material that takes a role's photographed stone once it has
 * loaded, flat colour until then, and a cascade of the sun's shadow map and
 * the air between it and the camera either way.
 */
function useStoneMaterial(role: StoneRole | undefined, options: StoneOptions): React.RefObject<MeshStandardMaterial | null> {
  const ref = useRef<MeshStandardMaterial>(null);
  const stone = useStone(role ?? 'core');
  const key = JSON.stringify(options);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (ref.current && role) applyStone(ref.current, stone, JSON.parse(key) as StoneOptions);
  }, [stone, role, key]);
  useEffect(() => {
    const material = ref.current;
    if (!material) return;
    applyAtmosphere(material);
    receiveCascades(material);
    return () => forgetCascades(material);
  });
  return ref;
}

/**
 * The three pyramids, placed exactly as blender/generate.py places them: the
 * centre offsets east and north, the base elevation relative to G1's, and a
 * rotation about the vertical by the measured orientation.
 */
export function Pyramids({
  pyramids,
  massings,
  plateau,
  today,
  clippingPlanes,
}: {
  pyramids: PyramidParams[];
  massings: MassingParams[];
  plateau: PlateauMass[];
  today: boolean;
  clippingPlanes: Plane[];
}): React.JSX.Element {
  return (
    <>
      {pyramids.map((params) => (
        <Pyramid key={params.id} params={params} today={today} clippingPlanes={clippingPlanes} />
      ))}
      {massings.map((params) => (
        <Massing key={params.id} params={params} clippingPlanes={clippingPlanes} />
      ))}
      {plateau.map((mass) => (
        <Mass key={mass.id} mass={mass} clippingPlanes={clippingPlanes} />
      ))}
    </>
  );
}

/** Colours for the plateau's masses: limestone, the Granite Temple's granite, and a rock-cut pit in shadow. */
const MASS_LIMESTONE = '#bfb08e';
const MASS_GRANITE = '#9d827b';
const MASS_PIT = '#3a3128';
const MASS_BASALT = '#3b3c3d';

/**
 * One of the plateau's lesser monuments from the footprint import. Drawn flat
 * and dull like the old Sphinx box, because every one of them is a massing:
 * a traced outline carried up to a height that is OSM's or an estimate.
 *
 * The model is rebuilt on every store change, so the mesh arrives as a new
 * object each time even when not one vertex has moved; the geometry is keyed
 * on what could actually move it, the vertex count and the solid's vertical
 * extent, so a cubit tick does not rebuild six hundred tombs.
 */
function Mass({ mass, clippingPlanes }: { mass: PlateauMass; clippingPlanes: Plane[] }): React.JSX.Element {
  const zs = mass.mesh.positions;
  const key = `${mass.mesh.vertexCount}:${zs[2]}:${zs[zs.length - 1]}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => meshGeometry(mass.mesh), [key]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const color =
    mass.kind === 'pit' ? MASS_PIT
      : mass.id === 'khafre.valley_temple' ? MASS_GRANITE
        : mass.id === 'khufu.basalt_pavement' ? MASS_BASALT
          : MASS_LIMESTONE;
  const material = useStoneMaterial(color === MASS_LIMESTONE ? 'core' : undefined, { strength: 0.85, relief: 0.7 });
  return (
    <mesh geometry={geometry} name={mass.id} castShadow receiveShadow>
      <meshStandardMaterial ref={material} color={color} roughness={0.96} metalness={0} flatShading clippingPlanes={clippingPlanes} />
    </mesh>
  );
}

/**
 * A massing placeholder: the Sphinx as a box of the surveyed length, width
 * and height, sitting on the frame's datum plane at the offsets derived from
 * its cited coordinates. The same box blender/generate.py builds, and drawn
 * flat and dull on purpose, because it is a volume and not a statue.
 */
function Massing({ params, clippingPlanes }: { params: MassingParams; clippingPlanes: Plane[] }): React.JSX.Element {
  const { length, width, height, offsetEast, offsetNorth } = params;
  const material = useStoneMaterial(undefined, { strength: 0 });
  return (
    <mesh position={[offsetEast, offsetNorth, height / 2]} castShadow receiveShadow>
      <boxGeometry args={[length, width, height]} />
      <meshStandardMaterial ref={material} color="#9c9078" roughness={0.97} metalness={0} flatShading clippingPlanes={clippingPlanes} />
    </mesh>
  );
}

function Pyramid({
  params,
  today,
  clippingPlanes,
}: {
  params: PyramidParams;
  today: boolean;
  clippingPlanes: Plane[];
}): React.JSX.Element {
  const { base, height, heightToday, courses, concavity, orientationDeg } = params;
  // The pyramid as it stands is drawn course by course where the database has
  // the courses and as a flat truncation where it does not, which is the same
  // choice blender/generate.py makes for its "(today)" object.
  const stepped = today && courses !== undefined;
  const truncated = today && courses === undefined && heightToday !== undefined;
  const standing = stepped || truncated;
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
    <mesh geometry={geometry} position={[params.offsetEast, params.offsetNorth, params.offsetUp]} rotation={[0, 0, orientationDeg * DEG]} castShadow receiveShadow>
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
