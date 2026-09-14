import type { TerrainHeader } from '@seked/data/browser';
import { terrainGrid, type GroundPyramid } from '@seked/geometry';
import { useEffect, useMemo } from 'react';
import { gridGeometry } from './geometry';

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
 * the honest way to see how much of the plateau has been moved.
 */
export function Plateau({ header, heights, datum, pyramids, context, ground }: PlateauProps): React.JSX.Element {
  const grids = useMemo(() => terrainGrid({ header, heights, datum, pyramids }), [header, heights, datum, pyramids]);
  const contextGeometry = useMemo(() => gridGeometry(grids.context), [grids]);
  const groundGeometry = useMemo(() => gridGeometry(grids.ground), [grids]);
  useEffect(() => () => {
    contextGeometry.dispose();
    groundGeometry.dispose();
  }, [contextGeometry, groundGeometry]);

  return (
    <>
      {ground && (
        <mesh geometry={groundGeometry} renderOrder={-1}>
          <meshStandardMaterial color="#6a6152" roughness={1} metalness={0} />
        </mesh>
      )}
      {context && (
        <mesh geometry={contextGeometry} renderOrder={-1}>
          <meshStandardMaterial color="#55503f" roughness={1} metalness={0} wireframe={ground} />
        </mesh>
      )}
    </>
  );
}
