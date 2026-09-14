import { DEG } from '@seked/units';
import { useEffect, useMemo } from 'react';
import type { StructureInterior } from '../model';
import { meshGeometry } from './geometry';

/** Aswan granite, which is what the chambers the claims turn on are lined with. */
const GRANITE = '#9d827b';

/**
 * The passages and chambers, one mesh per solid, placed beside their pyramid
 * exactly as the pyramid itself is placed: the centre offsets east and north,
 * the base elevation relative to G1's, and a rotation about the vertical by
 * the measured orientation. The solids are built in the browser by
 * `interiorSolids`, the same function the Blender generator's mirror runs, so
 * this is the database and not an import of a model of it.
 *
 * They are separate solids rather than a boolean cut out of the masonry, so
 * the section plane opens them; with no cut they sit inside opaque stone and
 * are simply not seen, which is the honest thing for them to do.
 */
export function Interiors({ interiors }: { interiors: StructureInterior[] }): React.JSX.Element {
  return (
    <>
      {interiors.map((interior) => (
        <Interior key={interior.params.id} interior={interior} />
      ))}
    </>
  );
}

function Interior({ interior }: { interior: StructureInterior }): React.JSX.Element {
  const { params, solids } = interior;
  const geometries = useMemo(
    () => Object.entries(solids).map(([name, solid]) => ({ name, geometry: meshGeometry(solid) })),
    [solids],
  );
  useEffect(() => () => {
    for (const g of geometries) g.geometry.dispose();
  }, [geometries]);

  return (
    <group
      position={[params.offsetEast, params.offsetNorth, params.offsetUp]}
      rotation={[0, 0, params.orientationDeg * DEG]}
    >
      {geometries.map(({ name, geometry }) => (
        <mesh key={name} geometry={geometry} name={name}>
          <meshStandardMaterial color={GRANITE} roughness={0.78} metalness={0} flatShading />
        </mesh>
      ))}
    </group>
  );
}
