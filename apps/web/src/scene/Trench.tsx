/**
 * The Sphinx's enclosure: the trench the statue was left standing in.
 *
 * The Sphinx is not a thing built on the plateau, it is a thing left behind
 * when a horseshoe of rock was quarried away round it, so the cut is as much
 * of the monument as the statue. `sphinxTrenchMesh` in @seked/geometry builds
 * it from the three outlines OSM traced, pushed out by a margin, with a floor
 * at the lowest of their own base levels and walls rising to the plateau's
 * own surface at each vertex of the plan.
 *
 * Two things here are named look choices and nothing here is a measurement.
 * The margin is one, because the database carries no `sphinx.enclosure.margin`
 * and the ARCE plan that would give one has not been read; the label the
 * geometry writes says so in those words, and the hover note carries it. The
 * other is that the walls are cut vertically rather than following the
 * quarried steps and the wider western corridor.
 *
 * The ground is not dug here. The plateau grid is Copernicus GLO-30 at 20 m
 * and a vertical cut a hundred metres across cannot live in samples that far
 * apart: a dip in it would be a funnel with the wall buried in one side of it
 * and standing proud of the other. So the cut is exact and the ground is
 * simply not drawn inside the plan: `Terrain.tsx` reads the outline published
 * here and discards the ground's fragments within it, which is the boolean
 * `blender/render_standins.py` does with a box cutter, done the way a
 * realtime renderer can afford.
 *
 * Frame as everywhere else inside the one rotated group: +X east, +Y north,
 * +Z up, metres.
 */
import { groundHeight, sphinxTrenchMesh, type Footprint, type GroundPyramid, type SphinxTrench } from '@seked/geometry';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Environment } from '@seked/geometry';
import { DoubleSide, FrontSide, type BufferGeometry, type Plane } from 'three';
import { useView } from '../store';
import { meshGeometry } from './geometry';
import type { StoneOptions, StoneRole } from './materials/stone';
import { useStoneMaterial } from './materials/useStoneMaterial';
import type { TerrainProps } from './Terrain';

/**
 * How far the cut stands clear of the traced outlines, in metres, where the
 * database carries no record for it.
 *
 * A LOOK CHOICE, not a measurement. The plan asks for four metres north and
 * south and six west; `dilateHull` pushes every side out alike, so this is
 * the one number and it is the larger of the two, which keeps the cut's east
 * edge clear of the Sphinx Temple's own outline six metres beyond the paws.
 * The figure to replace it with is `sphinx.enclosure.margin`, scaled off the
 * ARCE 1:200 map of the amphitheatre with `scripts/plate.py`.
 */
const LOOK = { marginMetres: 6 };

/** The outline the trench was cut on, for the ground grid and the sand that buries it. */
export interface SphinxCut {
  outline: readonly (readonly [number, number])[];
  /** The floor's level in the data frame, metres. */
  floor: number;
  /** The OSM height of the Sphinx's head above its own base, where the import has one. */
  headHeight: number | undefined;
}

let cut: SphinxCut | undefined;
const listeners = new Set<() => void>();

function publish(next: SphinxCut | undefined): void {
  cut = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The trench as it stands this frame, or nothing. `Terrain.tsx` cuts the
 * ground to it and `Sand.tsx` fills it; both are mounted beside this one
 * rather than under it, so the plan travels between them here rather than
 * through the view store, where it does not belong: it follows what has
 * loaded and what the database carries, not what the reader asked for.
 */
export function useSphinxCut(): SphinxCut | undefined {
  return useSyncExternalStore(subscribe, () => cut, () => undefined);
}

/** The Sphinx's own outlines out of the bundle, fetched once and kept. */
let footprints: Promise<Footprint[]> | undefined;

export function loadSphinxFootprints(): Promise<Footprint[]> {
  footprints ??= fetch(`${import.meta.env.BASE_URL}seked.json`)
    .then((r) => (r.ok ? (r.json() as Promise<{ footprints?: { features?: Footprint[] } }>) : undefined))
    .then((bundle) => (bundle?.footprints?.features ?? []).filter((f) => f.group === 'sphinx'))
    .catch(() => []);
  return footprints;
}

/**
 * The plateau's surface as a function of east and north: the same heightfield
 * `Terrain.tsx` draws, read with the same `groundHeight`, so the wall tops
 * meet the ground rather than a second opinion about where it is.
 */
export function groundSampler({ header, heights, datum, pyramids }: {
  header: TerrainProps['header'];
  heights: Float32Array;
  datum: number;
  pyramids: readonly GroundPyramid[];
}): (x: number, y: number) => number {
  const { nx, ny, x0, y0, spacing } = header;
  const at = (i: number, j: number): number =>
    (heights[Math.min(ny - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))] as number) - datum;
  return (x, y) => {
    const fx = (x - x0) / spacing;
    const fy = (y - y0) / spacing;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const south = at(i, j) * (1 - tx) + at(i + 1, j) * tx;
    const north = at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx;
    return groundHeight(x, y, south * (1 - ty) + north * ty, pyramids);
  };
}

/** What the hover tag and the dissolve read off a mesh this track draws. */
export interface SekedTag {
  name: string;
  tier: 'stand-in' | 'reconstruction';
  note: string;
  state: string;
}

export interface StoneSurfaceProps {
  geometry: BufferGeometry;
  name: string;
  role: StoneRole;
  options: StoneOptions;
  colour: string;
  roughness: number;
  seked: SekedTag;
  clippingPlanes: Plane[];
  castShadow?: boolean;
  /** A surface with no inside, such as the sand, is drawn from both sides. */
  both?: boolean;
}

/**
 * One surface with its photographed stone on it.
 *
 * It is its own component because `useStoneMaterial` lays the stone on in an
 * effect keyed on the stone, and a parent that returns null until its geometry
 * is ready would have run that effect with no material to lay it on and never
 * run it again. Mounting the mesh and the hook together cannot go wrong that
 * way.
 */
export function StoneSurface({
  geometry, name, role, options, colour, roughness, seked, clippingPlanes, castShadow, both,
}: StoneSurfaceProps): React.JSX.Element {
  const material = useStoneMaterial(role, options);
  return (
    <mesh geometry={geometry} name={name} userData={{ seked }} castShadow={castShadow ?? false} receiveShadow>
      <meshStandardMaterial
        ref={material}
        color={colour}
        roughness={roughness}
        metalness={0}
        side={both ? DoubleSide : FrontSide}
        clippingPlanes={clippingPlanes}
      />
    </mesh>
  );
}

export interface TrenchProps {
  env: Environment;
  terrain: TerrainProps;
  clippingPlanes: Plane[];
}

export function Trench({ env, terrain, clippingPlanes }: TrenchProps): React.JSX.Element | null {
  const state = useView((s) => s.state);
  // No Sphinx, no trench: while the stand-in has not loaded the viewer is
  // drawing the three OSM prisms on the flat ground, and a cut under them
  // would be a hole with nothing in it.
  const standing = useView((s) => s.hiddenMasses).has('sphinx.body');
  const [parts, setParts] = useState<Footprint[]>([]);

  useEffect(() => {
    let alive = true;
    void loadSphinxFootprints().then((all) => {
      if (alive) setParts(all);
    });
    return () => {
      alive = false;
    };
  }, []);

  const ground = useMemo(() => groundSampler(terrain), [terrain]);
  const trench = useMemo<SphinxTrench | undefined>(
    () => (parts.length === 0 ? undefined : sphinxTrenchMesh(env, parts, { groundLevel: ground, margin: LOOK.marginMetres })),
    [env, parts, ground],
  );

  const head = parts.find((f) => f.id === 'sphinx.head');
  useEffect(() => {
    if (!trench || !standing) {
      publish(undefined);
      return;
    }
    publish({ outline: trench.outline, floor: trench.floorLevel, headHeight: head?.height });
    return () => publish(undefined);
  }, [trench, standing, head]);

  const floorGeometry = useMemo(() => (trench ? meshGeometry(trench.floor) : undefined), [trench]);
  const wallGeometry = useMemo(() => (trench ? meshGeometry(trench.walls) : undefined), [trench]);
  useEffect(() => () => {
    floorGeometry?.dispose();
    wallGeometry?.dispose();
  }, [floorGeometry, wallGeometry]);

  const seked = trench
    ? { name: 'The Sphinx enclosure', tier: 'reconstruction' as const, note: trench.label, state }
    : undefined;

  if (!trench || !standing || !floorGeometry || !wallGeometry || !seked) return null;
  return (
    <>
      {/* The floor is the quarried bedrock under the sand blown into it, which
          is the fine sand the plateau itself takes; the walls are the cut rock. */}
      <StoneSurface
        geometry={floorGeometry}
        name="sphinx.enclosure.floor"
        role="sand"
        options={{ strength: 0.8, scale: 3, relief: 0.5 }}
        colour="#a1927a"
        roughness={1}
        seked={seked}
        clippingPlanes={clippingPlanes}
      />
      <StoneSurface
        geometry={wallGeometry}
        name="sphinx.enclosure.walls"
        role="bedrock"
        options={{ strength: 0.9, relief: 1 }}
        colour="#9a8a6d"
        roughness={0.97}
        seked={seked}
        clippingPlanes={clippingPlanes}
        castShadow
      />
    </>
  );
}
