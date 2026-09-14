import { DEG } from '@seked/units';
import { useEffect, useMemo } from 'react';
import { DoubleSide, FrontSide, type Plane } from 'three';
import type { PyramidParams } from '../model';
import { pyramidGeometry } from './geometry';

/**
 * The three pyramids, placed exactly as blender/generate.py places them: the
 * centre offsets east and north, the base elevation relative to G1's, and a
 * rotation about the vertical by the measured orientation.
 */
export function Pyramids({
  pyramids,
  today,
  clippingPlanes,
}: {
  pyramids: PyramidParams[];
  today: boolean;
  clippingPlanes: Plane[];
}): React.JSX.Element {
  return (
    <>
      {pyramids.map((params) => (
        <Pyramid key={params.id} params={params} today={today} clippingPlanes={clippingPlanes} />
      ))}
    </>
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
  const { base, height, heightToday, concavity, orientationDeg } = params;
  const truncated = today && heightToday !== undefined;
  const geometry = useMemo(
    () => pyramidGeometry({ base, height, concavity, truncateAt: truncated ? heightToday : undefined }),
    [base, height, concavity, truncated, heightToday],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  // A section leaves the far side of the masonry facing away from the reader,
  // so the cut only reads if the back faces are drawn.
  const cut = clippingPlanes.length > 0 && clippingPlanes[0]?.constant !== undefined && Math.abs(clippingPlanes[0].constant) < 1e6;

  return (
    <mesh geometry={geometry} position={[params.offsetEast, params.offsetNorth, params.offsetUp]} rotation={[0, 0, orientationDeg * DEG]}>
      <meshStandardMaterial
        color={truncated ? '#b3a789' : '#d6c49c'}
        roughness={0.94}
        metalness={0}
        flatShading
        side={cut ? DoubleSide : FrontSide}
        clippingPlanes={clippingPlanes}
      />
    </mesh>
  );
}
