import type { TerrainHeader } from '@seked/data/browser';
import { terrainGrid, terrainRing, type GroundPyramid } from '@seked/geometry';
import { useEffect, useMemo, useRef } from 'react';
import { Vector2, type MeshStandardMaterial, type Plane } from 'three';
import { gridGeometry } from './geometry';
import { applyAtmosphere } from './Atmosphere';
import { before, patchMaterial } from './materials/patch';
import { forgetCascades, receiveCascades } from './materials/shadows';
import { applyStone, useStone } from './materials/stone';
import { applyGreen, greenFor, useGreenMask } from './materials/ground';
import { useView } from '../store';
import { useSphinxCut } from './Trench';
import { useWater } from './Water';

/**
 * The ground that is not drawn: the Sphinx's enclosure, and the harbour basin.
 *
 * Both are holes in the grid, thrown away in the fragment shader rather than
 * dug out of it. A plan here is convex, so a fragment is inside it exactly
 * when it is left of every edge of it taken counter-clockwise, which is a
 * handful of instructions and needs not one vertex moved. The alternative,
 * pulling the samples inside a plan down to the cut's floor, cannot work at
 * GLO-30's twenty metres: a cut a hundred metres across has five samples in
 * it, and the funnel between them and their neighbours would bury one wall
 * and leave the other standing in the air. `Trench.tsx` draws the enclosure's
 * floor and walls; `Water.tsx` draws the basin's water and its quay.
 *
 * The basin's hole comes and goes with the timeline, and the ground is a
 * fixture of every state, so it is not dissolved: the hole appears the frame
 * the stop changes while the water fades in over the dissolve. That is the
 * one place this track's work does not cross-fade, and the water arriving
 * over it covers most of it.
 */
/**
 * How many outline points the cut uniform carries, whatever the cuts are: a
 * capacity, not a measurement. The Sphinx's ditch and the harbour basin
 * together are 23 points; 64 leaves room for another cut or a finer outline,
 * and a plan that needs more throws rather than cutting wrongly.
 *
 * The size is fixed because three keeps one uniforms object per material but
 * caches compiled programs per shader text, and hands a program back from
 * that cache without touching the uniforms. So if the array's declared size
 * followed the cuts, a change of stop that brought back an earlier program
 * would upload an array of the other length into it, and an array shorter
 * than the declaration is a crash in the upload. One array of one length,
 * shared by every compile and rewritten in place when the cuts change, is
 * what every program can safely read.
 */
const TRENCH_CAPACITY = 64;
const trenchValues = new WeakMap<MeshStandardMaterial, Vector2[]>();

function applyGroundCuts(material: MeshStandardMaterial, cuts: readonly (readonly (readonly [number, number])[])[]): void {
  const plans = cuts.filter((c) => c.length >= 3);
  const flat = plans.flat();
  if (flat.length > TRENCH_CAPACITY) {
    throw new Error(`seked: ${flat.length} cut points on the ground, and the trench uniform carries ${TRENCH_CAPACITY}`);
  }
  let values = trenchValues.get(material);
  if (!values) {
    values = Array.from({ length: TRENCH_CAPACITY }, () => new Vector2());
    trenchValues.set(material, values);
  }
  values.forEach((v, i) => (i < flat.length ? v.set(flat[i]![0], flat[i]![1]) : v.set(0, 0)));
  const key = `v3:${plans.map((c) => c.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')).join('|')}`;
  patchMaterial(material, 'trench', key, (shader) => {
    if (plans.length === 0) return;
    shader.uniforms.uTrench = { value: values };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
varying vec2 vTrenchPos;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vTrenchPos = transformed.xy;`);
    let start = 0;
    const tests = plans.map((plan) => {
      const first = start;
      const n = plan.length;
      start += n;
      return `
      {
        bool inside = true;
        for (int i = 0; i < ${n}; i++) {
          vec2 a = uTrench[${first} + i];
          vec2 b = uTrench[${first} + (i == ${n} - 1 ? 0 : i + 1)];
          if ((b.x - a.x) * (vTrenchPos.y - a.y) - (b.y - a.y) * (vTrenchPos.x - a.x) < 0.0) inside = false;
        }
        if (inside) sekedCut = true;
      }`;
    });
    shader.fragmentShader = before(
      shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
uniform vec2 uTrench[${TRENCH_CAPACITY}];
varying vec2 vTrenchPos;`,
      ),
      'clipping_planes_fragment',
      `
      bool sekedCut = false;
      ${tests.join('')}
      if (sekedCut) discard;
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
  // The green the stop takes, laid over the sand by the one mask
  // `Vegetation.tsx` stands its grass on, so the tint and the blades cannot
  // disagree about where the meadow is. `greenFor` chooses: the First Time's
  // meadow, `built`'s dry scrub, or the cultivated valley of the two modern
  // stops, which is drawn by its height above the river and so stops where
  // the desert starts.
  const state = useView((s) => s.state);
  const water = useWater();
  const mask = useGreenMask(header);
  useEffect(() => {
    const material = groundMaterial.current;
    if (!material || !mask) return;
    applyGreen(material, { mask, level: water?.level, ...greenFor(state) });
  }, [mask, water, state]);
  // The Sphinx's enclosure, where one is standing, and the harbour basin,
  // where the timeline has one, are holes in this grid.
  const cut = useSphinxCut();
  const cuts = useMemo(
    () => [cut?.outline, water?.kind === 'basin' ? water.outline : undefined]
      .filter((o): o is readonly (readonly [number, number])[] => o !== undefined),
    [cut, water],
  );
  useEffect(() => {
    if (groundMaterial.current) applyGroundCuts(groundMaterial.current, cuts);
  }, [cuts]);
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

export interface DesertProps {
  header: TerrainHeader;
  heights: Float32Array;
  /** Orthometric elevation of the Great Pyramid's base, which is z = 0 here. */
  datum: number;
  /**
   * Half-extent of the fine grid, metres: the square this ring leaves out,
   * because `Plateau` draws it. It is the fine header's own, not this one's.
   */
  omitWithin: number;
  /** The section planes, or the keep-everything plane when the cut spares the ground. */
  clippingPlanes: Plane[];
}

/**
 * How far out the far grid's own edge is carried, metres. A LOOK CHOICE.
 *
 * The heightfield stops twelve kilometres out, and from a stand eighty metres
 * up the true horizon is about thirty-two. Without the skirt that difference
 * showed as a band of sky under the horizon right across the view, which a
 * reader takes for the edge of the world, and it was three degrees tall
 * before this ring existed at all. Thirty-five kilometres clears the horizon
 * from any stand the viewer allows and stays inside the camera's own far
 * plane. Nothing out there is measured: the skirt holds the last height the
 * data gives and the air does the rest.
 */
export const HORIZON_METRES = 35000;

/**
 * The desert, the valley floor and the far horizon: the same Copernicus
 * product over plus or minus twelve kilometres at sixty metres, with the fine
 * grid's own square left out of it.
 *
 * It exists because the plateau's grid stops three kilometres out and the city
 * behind it runs to ten. Without this the far half of Giza would stand on
 * nothing and the horizon would be the fine grid's own straight edge four
 * kilometres away. It is context in the plain sense: the same source, the same
 * projection, no pyramid flattened into it and nothing cut out of it, drawn
 * under everything else and hazed into the air like any distance.
 *
 * Beyond the data it is carried on as a flat skirt to `HORIZON_METRES`, so
 * the world does not end in mid-air short of the horizon.
 *
 * It is a fixture of every state, so it does not dissolve with the timeline.
 * Nor does it cast or receive the sun's shadows: it is all beyond the last
 * cascade, and a cascade that reached it would be too coarse to show anything.
 */
export function Desert({ header, heights, datum, omitWithin, clippingPlanes }: DesertProps): React.JSX.Element {
  const mesh = useMemo(
    () => terrainRing({ header, heights, datum, omitWithin, skirtTo: HORIZON_METRES }),
    [header, heights, datum, omitWithin],
  );
  const geometry = useMemo(() => gridGeometry(mesh), [mesh]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // The plateau's own sand, its tile taken four times larger because this grid
  // is seen from kilometres rather than from hundreds of metres, and its
  // relief dropped for the same reason: a normal map at that distance is
  // noise. A look choice, and the same photograph either way.
  const sand = useStone('sand');
  const gravel = useStone('gravel');
  const material = useRef<MeshStandardMaterial>(null);
  useEffect(() => {
    if (!material.current) return;
    applyStone(material.current, sand, { strength: 0.8, scale: 12, relief: 0.15, mix: gravel, mixMetres: 480 });
  }, [sand, gravel]);
  // The same green the plateau takes, off a mask baked over this grid's own
  // square rather than the plateau's. It is what puts the cultivated valley
  // on the ground between the river and the desert, which is nearly all
  // outside the fine grid, and it is what keeps the First Time's meadow from
  // stopping dead at three kilometres.
  const state = useView((s) => s.state);
  const water = useWater();
  const mask = useGreenMask(header);
  useEffect(() => {
    if (!material.current || !mask) return;
    applyGreen(material.current, { mask, level: water?.level, ...greenFor(state) });
  }, [mask, water, state]);
  useEffect(() => {
    if (material.current) applyAtmosphere(material.current);
  });

  return (
    <mesh geometry={geometry} renderOrder={-2}>
      <meshStandardMaterial ref={material} color="#a1927a" roughness={1} metalness={0} clippingPlanes={clippingPlanes} />
    </mesh>
  );
}
