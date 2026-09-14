import { DEG } from '@seked/units';
import { useEffect, useMemo } from 'react';
import type { PyramidParams } from '../model';
import { pyramidGeometry } from './geometry';

/**
 * The three pyramids, placed exactly as blender/generate.py places them: the
 * centre offsets east and north, the base elevation relative to G1's, and a
 * rotation about the vertical by the measured orientation.
 */
export function Pyramids({ pyramids, today }: { pyramids: PyramidParams[]; today: boolean }): React.JSX.Element {
  return (
    <>
      {pyramids.map((params) => (
        <Pyramid key={params.id} params={params} today={today} />
      ))}
    </>
  );
}

function Pyramid({ params, today }: { params: PyramidParams; today: boolean }): React.JSX.Element {
  const { base, height, heightToday, concavity, orientationDeg } = params;
  const truncated = today && heightToday !== undefined;
  const geometry = useMemo(
    () => pyramidGeometry({ base, height, concavity, truncateAt: truncated ? heightToday : undefined }),
    [base, height, concavity, truncated, heightToday],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} position={[params.offsetEast, params.offsetNorth, params.offsetUp]} rotation={[0, 0, orientationDeg * DEG]}>
      <meshStandardMaterial color={truncated ? '#b3a789' : '#d6c49c'} roughness={0.94} metalness={0} flatShading />
    </mesh>
  );
}
