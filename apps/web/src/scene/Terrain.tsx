import type { TerrainHeader } from '@seked/data/browser';
import { terrainGrid, type GroundPyramid } from '@seked/geometry';
import { useEffect, useMemo, useRef } from 'react';
import type { MeshStandardMaterial, Plane } from 'three';
import { gridGeometry } from './geometry';
import { applyStone, useStone } from './stone';

export interface TerrainProps {
  header: TerrainHeader;
  heights: Float32Array;
  /** Orthometric elevation of the Great Pyramid's base, which is z = 0 here. */
  datum: number;
  /** The pyramids the ground grid is flattened under. */
  pyramids: GroundPyramid[];
}

export interface PlateauProps extends TerrainProps {
  /** Draw the surface model exactly as delivered. */
  context: boolean;
  /** Draw the same grid with the footprints at their surveyed base levels. */
  ground: boolean;
  /** The section planes, or the keep-everything plane when the cut spares the ground. */
  clippingPlanes: Plane[];
}

/**
 * The plateau, twice over. Both grids come from `terrainGrid` in
 * @seked/geometry, which is the function blender/generate.py mirrors, so what
 * is drawn here is what is in the .blend.
 *
 * The context grid is Copernicus GLO-30 at 20 m as delivered. Its editing mask
 * smooths the monuments away, so the mound under G1 is neither the ground nor
 * the pyramid, which is why the ground grid is the default: the same samples
 * with each footprint set to the base elevation the survey gives it. That is a
 * stand-in until the GPMP contours are entered, and it says so in the panel.
 * Shown together, the raw model goes over the ground as a wireframe, which is
 * the honest way to see how much of the plateau has been moved. It is off in
 * the tour: the raw model's mounds rise through the lower faces of every
 * pyramid, and a wireframe crossing a pyramid's base reads as the pyramid
 * having sunk, which is the opposite of what it shows.
 */
export function Plateau({ header, heights, datum, pyramids, context, ground, clippingPlanes }: PlateauProps): React.JSX.Element {
  const grids = useMemo(() => terrainGrid({ header, heights, datum, pyramids }), [header, heights, datum, pyramids]);
  const contextGeometry = useMemo(() => gridGeometry(grids.context), [grids]);
  const groundGeometry = useMemo(() => gridGeometry(grids.ground), [grids]);
  useEffect(() => () => {
    contextGeometry.dispose();
    groundGeometry.dispose();
  }, [contextGeometry, groundGeometry]);
  // The ground takes the renders' fine sand, three times its tile so the
  // twenty-metre grid does not show it repeating at the distances it is seen from.
  const sand = useStone('sand');
  const groundMaterial = useRef<MeshStandardMaterial>(null);
  useEffect(() => {
    if (groundMaterial.current) applyStone(groundMaterial.current, sand, 0.8, 3);
  }, [sand]);

  return (
    <>
      {ground && (
        <mesh geometry={groundGeometry} renderOrder={-1}>
          {/* The flattened footprint is exactly coplanar with a pyramid's base
              cap, which is the one place two surfaces genuinely share a plane:
              the offset settles which of them the depth buffer keeps. */}
          <meshStandardMaterial
            ref={groundMaterial}
            color="#6a6152"
            roughness={1}
            metalness={0}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
            clippingPlanes={clippingPlanes}
          />
        </mesh>
      )}
      {context && (
        <mesh geometry={contextGeometry} renderOrder={-1}>
          <meshStandardMaterial color="#55503f" roughness={1} metalness={0} wireframe={ground} clippingPlanes={clippingPlanes} />
        </mesh>
      )}
    </>
  );
}
