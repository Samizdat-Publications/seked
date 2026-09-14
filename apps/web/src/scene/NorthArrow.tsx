import { useEffect, useMemo } from 'react';
import { lineGeometry } from './geometry';

const COLOUR = '#7fd1ff';
/** Due north of G1, clear of the monuments and above the GLO-30 mound. */
const AT: [number, number, number] = [0, 430, 60];
const SIZE = 30;

/**
 * Which way is north, in the data frame where north is +Y. The glyph lies
 * flat so it reads from above, which is how a reader checks the orientation
 * claims.
 */
export function NorthArrow(): React.JSX.Element {
  const [x, y, z] = AT;
  const glyph = useMemo(
    () =>
      lineGeometry([
        [0, 0, 0],
        [0, SIZE, 0],
        [0, SIZE, 0],
        [SIZE * 0.7, 0, 0],
        [SIZE * 0.7, 0, 0],
        [SIZE * 0.7, SIZE, 0],
      ]),
    [],
  );
  useEffect(() => () => glyph.dispose(), [glyph]);

  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0, 0]}>
        <coneGeometry args={[14, 54, 4]} />
        <meshStandardMaterial color={COLOUR} roughness={0.6} />
      </mesh>
      <lineSegments geometry={glyph} position={[-SIZE * 0.35, 46, 0]}>
        <lineBasicMaterial color={COLOUR} />
      </lineSegments>
    </group>
  );
}
