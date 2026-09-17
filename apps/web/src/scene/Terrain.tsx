import type { TerrainHeader } from '@seked/data/browser';
import { terrainGrid, type GroundPyramid } from '@seked/geometry';
import { useEffect, useMemo, useRef } from 'react';
import { Vector2, type MeshStandardMaterial, type Plane } from 'three';
import { gridGeometry } from './geometry';
import { applyAtmosphere } from './Atmosphere';
import { before, patchMaterial } from './materials/patch';
import { forgetCascades, receiveCascades } from './materials/shadows';
import { applyStone, useStone } from './materials/stone';
import { useSphinxCut } from './Trench';

/**
 * The ground inside the Sphinx's enclosure, thrown away in the fragment
 * shader rather than dug out of the grid.
 *
 * The plan is convex, so a fragment is inside it exactly when it is left of
 * every edge of it taken counter-clockwise, which is a handful of
 * instructions and needs not one vertex moved. The alternative, pulling the
 * samples inside the plan down to the trench's floor, cannot work at
 * GLO-30's twenty metres: a cut a hundred metres across has five samples in
 * it, and the funnel between them and their neighbours would bury the west
 * wall and leave the east one standing in the air. `Trench.tsx` draws the
 * floor and the walls that fill the hole.
 */
function applyTrenchCut(material: MeshStandardMaterial, outline: readonly (readonly [number, number])[] | undefined): void {
  const n = outline && outline.length >= 3 ? outline.length : 0;
  const key = `v1:${n}:${outline?.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ') ?? ''}`;
  patchMaterial(material, 'trench', key, (shader) => {
    if (n === 0 || !outline) return;
    shader.uniforms.uTrench = { value: outline.map(([x, y]) => new Vector2(x, y)) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
varying vec2 vTrenchPos;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vTrenchPos = transformed.xy;`);
    shader.fragmentShader = before(
      shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
uniform vec2 uTrench[${n}];
varying vec2 vTrenchPos;`,
      ),
      'clipping_planes_fragment',
      `
      bool sekedInTrench = true;
      for (int i = 0; i < ${n}; i++) {
        vec2 a = uTrench[i];
        vec2 b = uTrench[i == ${n} - 1 ? 0 : i + 1];
        if ((b.x - a.x) * (vTrenchPos.y - a.y) - (b.y - a.y) * (vTrenchPos.x - a.x) < 0.0) sekedInTrench = false;
      }
      if (sekedInTrench) discard;
      `,
    );
  });
}

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
  // twenty-metre grid does not show it repeating at the distances it is seen
  // from. Its tint is the mean of `render_materials.py`'s two sand colours,
  // which the render mixes with a large noise, converted out of linear light:
  // a look choice carried across rather than a new one.
  const sand = useStone('sand');
  const gravel = useStone('gravel');
  const groundMaterial = useRef<MeshStandardMaterial>(null);
  useEffect(() => {
    if (!groundMaterial.current) return;
    applyStone(groundMaterial.current, sand, { strength: 0.8, scale: 3, relief: 0.6, mix: gravel, mixMetres: 120 });
  }, [sand, gravel]);
  // The Sphinx's enclosure, where one is standing, is a hole in this grid.
  const cut = useSphinxCut();
  useEffect(() => {
    if (groundMaterial.current) applyTrenchCut(groundMaterial.current, cut?.outline);
  }, [cut]);
  // The ground takes the sun's shadows and casts none of its own worth having.
  useEffect(() => {
    const material = groundMaterial.current;
    if (!material) return;
    applyAtmosphere(material);
    receiveCascades(material);
    return () => forgetCascades(material);
  });

  return (
    <>
      {ground && (
        <mesh geometry={groundGeometry} renderOrder={-1} receiveShadow>
          {/* The flattened footprint is exactly coplanar with a pyramid's base
              cap, which is the one place two surfaces genuinely share a plane:
              the offset settles which of them the depth buffer keeps. */}
          <meshStandardMaterial
            ref={groundMaterial}
            color="#a1927a"
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
