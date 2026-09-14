import type { TerrainHeader } from '@seked/data/browser';
import { useEffect, useMemo } from 'react';
import { terrainGeometry } from './geometry';

export interface TerrainProps {
  header: TerrainHeader;
  heights: Float32Array;
  /** Orthometric elevation of the Great Pyramid's base, which is z = 0 here. */
  datum: number;
}

/**
 * Copernicus GLO-30, 20 m grid, as context only. The product's editing mask
 * smooths the monuments away, so the mound under G1 is not G1 and the ground
 * under it is not the surveyed base either.
 */
export function Terrain({ header, heights, datum }: TerrainProps): React.JSX.Element {
  const geometry = useMemo(() => terrainGeometry(header, heights, datum), [header, heights, datum]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} renderOrder={-1}>
      <meshStandardMaterial color="#6a6152" roughness={1} metalness={0} flatShading />
    </mesh>
  );
}
