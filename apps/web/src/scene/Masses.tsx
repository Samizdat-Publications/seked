import { useEffect, useMemo } from 'react';
import type { Plane } from 'three';
import type { MassingParams, PlateauMass } from '../model';
import { useView } from '../store';
import { meshGeometry } from './geometry';
import { useStoneMaterial } from './materials/useStoneMaterial';

/**
 * The plateau's lesser monuments as the footprint import has them, and the
 * Sphinx box where the import has no Sphinx: massings, outlines carried up to
 * a height that is OSM's or an estimate. Stage 2 replaces these with the
 * builders in @seked/geometry, state by state; until then they are what the
 * viewer draws for everything that is not a pyramid or a stand-in.
 */
export function Masses({
  massings,
  plateau,
  clippingPlanes,
}: {
  massings: MassingParams[];
  plateau: PlateauMass[];
  clippingPlanes: Plane[];
}): React.JSX.Element {
  return (
    <>
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
function Mass({ mass, clippingPlanes }: { mass: PlateauMass; clippingPlanes: Plane[] }): React.JSX.Element | null {
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
  if (useView((s) => s.hiddenMasses).has(mass.id)) return null; // a fitted stand-in model stands here instead
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
