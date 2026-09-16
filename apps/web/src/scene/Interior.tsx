import { DEG } from '@seked/units';
import { useEffect, useMemo } from 'react';
import { DoubleSide, type Plane } from 'three';
import type { StructureInterior } from '../model';
import { meshGeometry } from './geometry';

/** Aswan granite, which is what the chambers the claims turn on are lined with. */
const GRANITE = '#9d827b';

/**
 * What a `void.*` solid is drawn in: a cool translucent blue, and never the
 * stone the rooms are made of.
 *
 * Nobody has stood in the North Face Corridor or the Big Void. They are shapes
 * fitted to a muon deficit, carrying their papers' error bars, and the Big
 * Void is carried twice over because its inclination was never resolved. Drawn
 * in granite beside the King's Chamber they would read as rooms somebody had
 * walked through with a tape, which is the one impression they must not give.
 * The Blender section answers this by drawing them as an outline with no fill
 * and its lit views by giving them this same colour; this is the viewer's half
 * of the same decision.
 */
const INFERRED = '#7fa6c4';

/** Whether a solid is a void the muons found rather than a room somebody has entered. */
function isInferred(name: string): boolean {
  return name.startsWith('void.');
}

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
export function Interiors({
  interiors,
  clippingPlanes,
}: {
  interiors: StructureInterior[];
  clippingPlanes: Plane[];
}): React.JSX.Element {
  return (
    <>
      {interiors.map((interior) => (
        <Interior key={interior.params.id} interior={interior} clippingPlanes={clippingPlanes} />
      ))}
    </>
  );
}

function Interior({ interior, clippingPlanes }: { interior: StructureInterior; clippingPlanes: Plane[] }): React.JSX.Element {
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
      {geometries.map(({ name, geometry }) => {
        const inferred = isInferred(name);
        return (
          <mesh key={name} geometry={geometry} name={name} renderOrder={inferred ? 1 : 0}>
            {/* A room is a solid of the void, so a cut through it shows the far
                wall from behind: both sides are drawn or the section is empty. */}
            <meshStandardMaterial
              color={inferred ? INFERRED : GRANITE}
              roughness={inferred ? 0.35 : 0.78}
              metalness={0}
              emissive={inferred ? INFERRED : '#000000'}
              emissiveIntensity={inferred ? 0.35 : 0}
              transparent={inferred}
              opacity={inferred ? 0.3 : 1}
              depthWrite={!inferred}
              flatShading
              side={DoubleSide}
              clippingPlanes={clippingPlanes}
            />
          </mesh>
        );
      })}
    </group>
  );
}
