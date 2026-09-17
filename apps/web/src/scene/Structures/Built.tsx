/**
 * The one mesh every structure component draws through, and the rules it
 * draws by.
 *
 * Everything here is shared: the geometry is built once per mesh and disposed
 * with the component, the stone comes from `useStoneMaterial` as it does for
 * the pyramids, a stand-in that has loaded takes the place of whatever it
 * replaces, and each mesh carries `userData.seked` so Track H's hover can name
 * it, its evidence tier and the builder's own account of it.
 */
import { useEffect, useMemo } from 'react';
import { DoubleSide, FrontSide, type Plane } from 'three';
import type { StructureMesh, StructureTier } from '../../model';
import { useView } from '../../store';
import type { StateId } from '../../view';
import { meshGeometry } from '../geometry';
import { useStoneMaterial } from '../materials/useStoneMaterial';
import type { StoneRole } from '../materials/stone';
import type { StoneOptions } from '../materials/stone';
import type { Mesh as GeometryMesh } from '@seked/geometry';

/** What Track H's `Hover.tsx` reads off any object in the scene. */
export interface SekedUserData {
  name: string;
  tier: StructureTier;
  /** The builder's own label: what was built, from which keys, with which look choices. */
  note: string;
  state: StateId;
}

/**
 * The flat colours a surface keeps until its photograph has loaded, and after
 * that the tint the photograph is laid over. Look choices, all of them, and
 * the same four the stage 1 massings used.
 */
export const COLOURS = {
  limestone: '#bfb08e',
  casing: '#d6c49c',
  granite: '#9d827b',
  basalt: '#3b3c3d',
  pit: '#3a3128',
} as const;

/** What any structure has to say about itself, with or without a single mesh of its own. */
export type Labelled = Omit<StructureMesh, 'mesh'> & { mesh?: GeometryMesh };

export interface BuiltProps {
  built: Labelled;
  state: StateId;
  clippingPlanes: Plane[];
  role: StoneRole | undefined;
  colour: string;
  stone: StoneOptions;
  /** Override the mesh the structure carries, for a temple's roof or its pillars. */
  mesh?: GeometryMesh;
  /** Distinguish this mesh from its structure's others, so React keeps them apart. */
  part?: string;
}

/**
 * The model is rebuilt on every store change, so a mesh arrives as a new
 * object each time even when not one vertex has moved. The geometry is keyed
 * on what could actually move it, the vertex count and the solid's vertical
 * extent, so a cubit tick does not rebuild six hundred tombs.
 */
function geometryKey(mesh: GeometryMesh): string {
  const p = mesh.positions;
  return `${mesh.vertexCount}:${p[2]}:${p[p.length - 1]}`;
}

export function Built({ built, state, clippingPlanes, role, colour, stone, mesh, part }: BuiltProps): React.JSX.Element | null {
  const solid = mesh ?? built.mesh;
  const key = solid === undefined ? '' : geometryKey(solid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => (solid === undefined ? undefined : meshGeometry(solid)), [key]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  const material = useStoneMaterial(role, stone);
  const seked = useMemo<SekedUserData>(
    () => ({ name: built.name, tier: built.tier, note: built.note, state }),
    [built.name, built.tier, built.note, state],
  );
  const hidden = useView((s) => s.hiddenMasses).has(built.id);
  // A section leaves the far side of the masonry facing away from the reader,
  // so the cut only reads if the back faces are drawn.
  const cut = clippingPlanes.length > 0 && clippingPlanes[0]?.constant !== undefined && Math.abs(clippingPlanes[0].constant) < 1e6;
  if (hidden || geometry === undefined) return null; // a fitted stand-in model stands here instead
  return (
    <mesh geometry={geometry} name={part === undefined ? built.id : `${built.id}.${part}`} userData={{ seked }} castShadow receiveShadow>
      <meshStandardMaterial
        key={`${state}:${role ?? 'flat'}`}
        ref={material}
        color={colour}
        roughness={0.94}
        metalness={0}
        flatShading
        side={cut ? DoubleSide : FrontSide}
        clippingPlanes={clippingPlanes}
      />
    </mesh>
  );
}
