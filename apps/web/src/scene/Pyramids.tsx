import { DEG } from '@seked/units';
import { useEffect, useMemo } from 'react';
import { DoubleSide, FrontSide, type Plane } from 'three';
import type { MassingParams, PlateauMass, PyramidParams } from '../model';
import { meshGeometry, pyramidGeometry, steppedPyramidGeometry } from './geometry';

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
  return (
    <mesh geometry={geometry} name={mass.id}>
      <meshStandardMaterial color={color} roughness={0.96} metalness={0} flatShading clippingPlanes={clippingPlanes} />
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
  return (
    <mesh position={[offsetEast, offsetNorth, height / 2]}>
      <boxGeometry args={[length, width, height]} />
      <meshStandardMaterial color="#9c9078" roughness={0.97} metalness={0} flatShading clippingPlanes={clippingPlanes} />
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
  const cut = clippingPlanes.length > 0 && clippingPlanes[0]?.constant !== undefined && Math.abs(clippingPlanes[0].constant) < 1e6;

  return (
    <mesh geometry={geometry} position={[params.offsetEast, params.offsetNorth, params.offsetUp]} rotation={[0, 0, orientationDeg * DEG]}>
      <meshStandardMaterial
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
