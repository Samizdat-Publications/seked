/**
 * The water: the harbour at the valley temples, and the flood plain of the
 * First Time.
 *
 * Where it stands is @seked/geometry's `waterExtent`, which reads the
 * waterline off the two valley temples' own footprints; nothing about the
 * level or the outline is decided here. What is decided here is how water
 * looks, and every one of those decisions is in `LOOK` below and is a look
 * choice.
 *
 * Two kinds, drawn differently.
 *
 * The harbour is a basin, which means a hole: the ground east of the temples
 * on the modern surface model stands about two metres above their floors, so
 * a plane at the waterline would be buried. `Terrain.tsx` discards the ground
 * inside the basin's outline the same way it discards it inside the Sphinx's
 * enclosure, and the quay wall drawn here fills the rim between the plateau
 * and the water. That is the spec's "a water surface on a cut in the ground",
 * done the way a realtime renderer can afford: no geometry booleans, one
 * fragment test.
 *
 * The flood plain is one plane and no hole at all. It stands above the ground
 * rather than below it, so the ground hides it wherever the ground is higher,
 * which is what "every sample below the level" means when a renderer does it.
 * Its west edge is the temples' east faces and disappears behind the plateau.
 *
 * The reflection is drei's `MeshReflectorMaterial`: one more render of the
 * scene, at `LOOK.resolution` square, from the camera mirrored in the plane.
 * The plan asks for it to be gated on the renderer's `quality`, and that prop
 * is `Renderer.tsx`'s own and reaches neither the store nor here, so it is
 * always on and the resolution is kept modest instead. Moving `quality` into
 * the view store is Track J's file to touch, not this one's.
 *
 * Frame as everywhere else inside the one rotated group: +X east, +Y north,
 * +Z up, metres.
 */
import { MeshReflectorMaterial } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { waterExtent, type Environment, type Footprint, type WaterBody } from '@seked/geometry';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentRef } from 'react';
import {
  DataTexture,
  LinearMipmapLinearFilter,
  PlaneGeometry,
  RepeatWrapping,
  RGBAFormat,
  Vector2,
  type BufferGeometry,
  type Material,
  type Plane,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { useView } from '../store';
import { applyAtmosphere } from './Atmosphere';
import { meshGeometry } from './geometry';
import { patchMaterial } from './materials/patch';
import { groundSampler, StoneSurface } from './Trench';
import type { TerrainProps } from './Terrain';

/**
 * LOOK CHOICES, not measurements. Nothing below is a record of anything: it
 * is what water is drawn like.
 *
 * `colour` is a deep Nile green-blue and `mirror` how much of the reflection
 * is kept against it. `blur` is the reflection's two-pass blur in pixels,
 * which is what stops a 512-pixel mirror reading as a 512-pixel mirror, and
 * `mixStrength` how hard the reflection is laid over the colour.
 *
 * `rippleTileMetres` is how far apart the ripples are on the ground, and
 * `driftA` and `driftB` the two speeds the normal map is scrolled at, in
 * tiles a second: two layers crossing each other, because one layer scrolling
 * reads as a moving picture of water rather than as water.
 *
 * `resolution` is the mirror's own square, `quayStepMetres` how finely the
 * basin's rim follows the ground, and `shoreBiasMetres` how far the plain is
 * lifted off the ground it meets so the two do not fight for the same pixels
 * along the shoreline.
 */
const LOOK = {
  colour: '#1d4b47',
  roughness: 0.26,
  metalness: 0.1,
  mirror: 0.8,
  mixStrength: 1.15,
  mixBlur: 1.2,
  blur: [220, 70] as [number, number],
  resolution: 512,
  rippleTileMetres: 24,
  driftA: [0.016, 0.009] as [number, number],
  driftB: [-0.011, 0.013] as [number, number],
  quayStepMetres: 20,
  shoreBiasMetres: 0.05,
} as const;

// --- What the rest of the scene reads off this one -------------------------
//
// The ground has to know where the water is twice over: to cut the basin out
// of itself, and to green its margins in the First Time. `Vegetation.tsx`
// needs the same level for the same mask. The body travels between them the
// way `Trench.tsx`'s cut does, published from here rather than put in the view
// store, because it follows the footprints and the timeline and not anything
// the reader asked for.

let published: WaterBody | undefined;
const listeners = new Set<() => void>();

function publish(next: WaterBody | undefined): void {
  published = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The water as it stands this frame, or nothing where the stop is dry. */
export function useWater(): WaterBody | undefined {
  return useSyncExternalStore(subscribe, () => published, () => undefined);
}

/** Every footprint out of the bundle, fetched once and kept. */
let features: Promise<Footprint[]> | undefined;

export function loadFootprints(): Promise<Footprint[]> {
  features ??= fetch(`${import.meta.env.BASE_URL}seked.json`)
    .then((r) => (r.ok ? (r.json() as Promise<{ footprints?: { features?: Footprint[] } }>) : undefined))
    .then((bundle) => bundle?.footprints?.features ?? [])
    .catch(() => []);
  return features;
}

// --- The ripple ------------------------------------------------------------

/**
 * A tiling normal map of two octaves of value noise, built as pixels rather
 * than drawn on a canvas because what is wanted is a height field and its
 * slopes, not a picture.
 *
 * The noise wraps, so the tile has no seam: each octave's lattice divides the
 * texture's own size, and the lattice is read modulo its period.
 */
function rippleNormals(size = 256): DataTexture {
  const hash = (i: number, j: number, period: number, seed: number): number => {
    const x = ((i % period) + period) % period;
    const y = ((j % period) + period) % period;
    const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const octave = (u: number, v: number, period: number, seed: number): number => {
    const fx = u * period;
    const fy = v * period;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = hash(i, j, period, seed) * (1 - sx) + hash(i + 1, j, period, seed) * sx;
    const b = hash(i, j + 1, period, seed) * (1 - sx) + hash(i + 1, j + 1, period, seed) * sx;
    return a * (1 - sy) + b * sy;
  };
  const height = (u: number, v: number): number => octave(u, v, 4, 1) * 0.65 + octave(u, v, 11, 2) * 0.35;

  const data = new Uint8Array(size * size * 4);
  const step = 1 / size;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = i / size;
      const v = j / size;
      // Central differences on the wrapped field, scaled so the slopes land
      // in a range a normal map can carry.
      const dx = (height(u + step, v) - height(u - step, v)) * 2.2;
      const dy = (height(u, v + step) - height(u, v - step)) * 2.2;
      const len = Math.hypot(dx, dy, 1);
      const p = (j * size + i) * 4;
      data[p] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      data[p + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      data[p + 2] = Math.round((1 / len) * 0.5 * 255 + 127);
      data[p + 3] = 255;
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** The line drei's reflector samples the normal map on, which the drift replaces. */
const DREI_NORMAL_TAP = 'vec4 normalColor = texture2D(normalMap, vUv * normalScale);';

/**
 * Two scrolling layers in place of drei's one still one.
 *
 * The reflector samples its normal map itself, inside the chunk it puts after
 * `emissivemap_fragment`, and it uses `normalScale` as the tiling rather than
 * as a strength, so three's own `offset` never reaches it. The tap is
 * replaced instead: the same texture twice, at two scales, each drifting at
 * its own speed. If drei's line ever changes, this says so and the water is
 * merely still.
 */
function applyDrift(material: Material, drift: { a: { value: Vector2 }; b: { value: Vector2 } }): void {
  patchMaterial(material, 'drift', 'v1', (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.waterDriftA = drift.a;
    shader.uniforms.waterDriftB = drift.b;
    if (!shader.fragmentShader.includes(DREI_NORMAL_TAP)) {
      console.warn('seked: the reflector no longer samples its normal map where the water drift expects it');
      return;
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec2 waterDriftA;\nuniform vec2 waterDriftB;')
      .replace(
        DREI_NORMAL_TAP,
        `vec4 normalColor = mix(
           texture2D(normalMap, vUv * normalScale + waterDriftA),
           texture2D(normalMap, vUv * normalScale * 0.41 + waterDriftB),
           0.45);`,
      );
  });
}

// --- The surfaces ----------------------------------------------------------

type Xy = readonly [number, number];

/** The bounds of a rectangle outline: its centre and its size. */
function box(outline: readonly Xy[]): { cx: number; cy: number; width: number; depth: number } {
  const xs = outline.map(([x]) => x);
  const ys = outline.map(([, y]) => y);
  const west = Math.min(...xs);
  const east = Math.max(...xs);
  const south = Math.min(...ys);
  const north = Math.max(...ys);
  return { cx: (west + east) / 2, cy: (south + north) / 2, width: east - west, depth: north - south };
}

/**
 * The surface itself: a plane in the data frame's XY at the water's level,
 * with the UVs the reflector's normal map needs. `PlaneGeometry` lies in XY
 * with its normal along +Z, which inside the rotated group is up, so it needs
 * no rotation of its own and the reflector's local +Z normal is the right one.
 */
function surfaceGeometry(body: WaterBody): BufferGeometry {
  const { cx, cy, width, depth } = box(body.outline);
  const geometry = new PlaneGeometry(width, depth, 1, 1);
  geometry.translate(cx, cy, body.level + LOOK.shoreBiasMetres);
  geometry.computeBoundingSphere();
  return geometry;
}

/** A rectangle's ring walked at about `step` metres, so a band on it can follow the ground. */
function walkRing(outline: readonly Xy[], step: number): Xy[] {
  const out: Xy[] = [];
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i] as Xy;
    const [x1, y1] = outline[(i + 1) % outline.length] as Xy;
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  return out;
}

/**
 * The quay: a band standing inside the basin's rim, from the plateau's own
 * surface at each point down to the basin's floor, facing in. It is what
 * fills the hole `Terrain.tsx` cuts, so the reader sees a cut quay wall with
 * two metres of it above the waterline rather than the background through the
 * ground.
 */
function quayMesh(outline: readonly Xy[], floor: number, ground: (x: number, y: number) => number) {
  const ring = walkRing(outline, LOOK.quayStepMetres);
  const n = ring.length;
  const positions = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const [x, y] = ring[i] as Xy;
    positions.set([x, y, Math.max(ground(x, y), floor)], i * 3);
    positions.set([x, y, floor], (n + i) * 3);
  }
  const indices = new Uint32Array(n * 6);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // Wound so the band faces into the basin, which is the only side of it
    // anyone stands on.
    indices.set([i, j, n + i, j, n + j, n + i], i * 6);
  }
  return { positions, indices, vertexCount: n * 2, triangleCount: n * 2 };
}

export interface WaterProps {
  env: Environment;
  terrain: TerrainProps;
  clippingPlanes: Plane[];
}

export function Water({ env, terrain, clippingPlanes }: WaterProps): React.JSX.Element | null {
  const state = useView((s) => s.state);
  const [footprints, setFootprints] = useState<Footprint[]>([]);
  useEffect(() => {
    let alive = true;
    void loadFootprints().then((all) => {
      if (alive) setFootprints(all);
    });
    return () => {
      alive = false;
    };
  }, []);

  const body = useMemo(() => waterExtent(footprints, env, state), [footprints, env, state]);
  useEffect(() => {
    publish(body);
    return () => publish(undefined);
  }, [body]);

  const surface = useMemo(() => (body ? surfaceGeometry(body) : undefined), [body]);
  const ground = useMemo(() => groundSampler(terrain), [terrain]);
  const quay = useMemo(
    () => (body && body.kind === 'basin' ? meshGeometry(quayMesh(body.outline, body.floor, ground)) : undefined),
    [body, ground],
  );
  useEffect(() => () => {
    surface?.dispose();
    quay?.dispose();
  }, [surface, quay]);

  const ripple = useMemo(() => rippleNormals(), []);
  useEffect(() => () => ripple.dispose(), [ripple]);
  const drift = useRef({ a: { value: new Vector2() }, b: { value: new Vector2() } }).current;
  useFrame((_, delta) => {
    drift.a.value.x += LOOK.driftA[0] * delta;
    drift.a.value.y += LOOK.driftA[1] * delta;
    drift.b.value.x += LOOK.driftB[0] * delta;
    drift.b.value.y += LOOK.driftB[1] * delta;
  });

  const material = useRef<ComponentRef<typeof MeshReflectorMaterial>>(null);
  useEffect(() => {
    const m = material.current;
    if (!m || !body) return;
    // The reflector's own `onBeforeCompile` is a method on its class, and
    // `patchMaterial` installs an own property that would shadow it. So it is
    // taken first and run as the first patch, which is also what puts it
    // before the drift that edits the chunk it writes.
    const reflector = (Object.getPrototypeOf(m) as { onBeforeCompile?: (shader: unknown) => void }).onBeforeCompile;
    if (reflector) patchMaterial(m, 'reflector', 'v1', (shader) => reflector.call(m, shader));
    applyAtmosphere(m);
    applyDrift(m, drift);
    // No cascades. `CSM.setupMaterial` assigns its own `onBeforeCompile`,
    // which `patchMaterial` adopts as the one hook it keeps from outside, and
    // that place is taken here by the reflector. A shadow on a mirror is the
    // smaller loss.
  }, [body, drift]);

  if (!body || !surface) return null;
  const tier = body.kind === 'basin' ? 'reconstruction' : 'claim';
  const seked = {
    name: body.kind === 'basin' ? 'The harbour at the valley temples' : 'The flood plain of the First Time',
    tier,
    note: body.label,
    state,
  };
  const { width, depth } = box(body.outline);
  return (
    <>
      <mesh geometry={surface} name={`water.${body.kind}`} userData={{ seked }} receiveShadow={false}>
        <MeshReflectorMaterial
          ref={material}
          color={LOOK.colour}
          roughness={LOOK.roughness}
          metalness={LOOK.metalness}
          mirror={LOOK.mirror}
          mixStrength={LOOK.mixStrength}
          mixBlur={LOOK.mixBlur}
          blur={LOOK.blur}
          resolution={LOOK.resolution}
          normalMap={ripple}
          // drei's reflector reads `normalScale` as the normal map's tiling
          // rather than as its strength, so this is the ripple's size on the
          // ground and not its depth.
          normalScale={new Vector2(width / LOOK.rippleTileMetres, depth / LOOK.rippleTileMetres)}
          clippingPlanes={clippingPlanes}
        />
      </mesh>
      {quay && (
        <StoneSurface
          geometry={quay}
          name="water.basin.quay"
          role="bedrock"
          options={{ strength: 0.9, relief: 1 }}
          colour="#9a8a6d"
          roughness={0.95}
          seked={{
            name: 'The quay of the harbour basin',
            // Only a basin has a quay, and a basin is the reconstruction, so
            // this literal cannot disagree with the surface's own tier.
            tier: 'reconstruction',
            note: `The cut rim of the basin, drawn from the plateau's own surface down to its floor. ${body.label}`,
            state,
          }}
          clippingPlanes={clippingPlanes}
          both
        />
      )}
    </>
  );
}
