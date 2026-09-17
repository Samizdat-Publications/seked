/**
 * The grass of the Green Sahara, and the scrub and trees that stand in it.
 *
 * The African Humid Period, about 12,500 to 3,500 BCE, is why the First Time
 * is green: North Africa then carried grassland, lakes and the animals that
 * go with them. That is science. What is a claim is this particular plateau
 * drawn with this much grass on it, and the tag every instance carries says
 * so in those words.
 *
 * The grass is one `InstancedMesh` of crossed quads with an alpha-tested
 * texture drawn here rather than downloaded, scattered over the terrain grid
 * by the same mask that tints the ground in `materials/ground.ts`. Reading
 * the mask on the CPU and in the shader out of one baked texture is the whole
 * reason that file bakes one: a blade standing where the ground is bare would
 * give the trick away at the first step.
 *
 * Three things keep the count affordable. The scatter walks the terrain's own
 * cells and puts down at most `LOOK.perSquareMetre` blades a square metre,
 * weighted by the mask, so the empty desert costs nothing. The total is
 * capped at `LOOK.cap` and the cells are walked from the plateau outward, so
 * what is dropped when the cap is reached is the furthest grass. And each
 * card shrinks to nothing in the vertex shader beyond `LOOK.fadeMetres`, so
 * the far half of the field costs no fragments.
 *
 * The plants from Track K's `public/props/manifest.json` are scattered by the
 * same mask, at their own densities, once that file exists. Until it does the
 * cards ship alone and nothing here fails: a manifest that is not there is an
 * empty list.
 *
 * Frame as everywhere else inside the one rotated group: +X east, +Y north,
 * +Z up, metres.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  type Material,
  type Plane,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { rectangleContains } from '@seked/geometry';
import { useView } from '../store';
import { applyAtmosphere } from './Atmosphere';
import { patchMaterial } from './materials/patch';
import { GREEN, greenAt, useGreenMask, type GreenMask } from './materials/ground';
import { forgetCascades, receiveCascades } from './materials/shadows';
import { groundSampler } from './Trench';
import type { TerrainProps } from './Terrain';
import { useWater } from './Water';

/**
 * LOOK CHOICES, not measurements. What grew at Giza in 10,500 BCE is not
 * recorded; this is how a meadow is drawn.
 *
 * `perSquareMetre` is the tussock density where the mask is full, `cap` the
 * most instances that will ever be built, and `fadeMetres` how far out a card
 * has shrunk to nothing. `heightMetres` and `widthMetres` are one tussock's
 * size, with `heightVary` the share either side of it that the scatter
 * varies. A card is a clump of grass a couple of metres across and not a
 * blade: a cap of sixty thousand over a plateau six kilometres wide can only
 * be tussocks, and tussocks are what savanna is anyway.
 *
 * `swayDegrees` and `swaySeconds` are the wind: a lean at the card's top,
 * cycling on its own phase per instance so the field does not breathe as one.
 *
 * `greens` are the three the blades are painted in, `tipFade` how far up a
 * blade goes pale, and `cardPixels` the drawn texture's own square.
 */
const LOOK = {
  perSquareMetre: 0.07,
  cap: 60000,
  fadeMetres: 700,
  heightMetres: 1.3,
  widthMetres: 2.4,
  heightVary: 0.4,
  swayDegrees: 7,
  swaySeconds: 3.4,
  greens: ['#4f6b28', '#67853a', '#87995a'],
  tipFade: 0.55,
  cardPixels: 128,
  /**
   * What the card's own greens are multiplied by at each stop: the First Time
   * as drawn, `built` a dry straw, the two late stops never reached because
   * their strength is zero and nothing is scattered.
   */
  tint: { ancient: '#ffffff', built: '#a89968', stripped: '#a89968', today: '#a89968' } as Record<string, string>,
} as const;

/** How many of a plant kind stand per square metre of full mask, by its own kind. */
const PLANT_DENSITY: Record<string, number> = {
  grass: 0,
  scrub: 0.0009,
  shrub: 0.0009,
  bush: 0.0009,
  tree: 0.00018,
  palm: 0.00018,
};

/** The density for a plant the manifest names something this file has not met. */
const PLANT_DENSITY_DEFAULT = 0.0006;

// --- The card --------------------------------------------------------------

/**
 * A clump of blades on a canvas, alpha where there is no blade.
 *
 * Drawn rather than fetched because it is a dozen tapering strokes and a
 * download is a download. Each blade is a quadratic curve from the foot of
 * the card, leaning a little, narrowing to nothing at its tip, and the whole
 * is darker at the root than at the tip, which is what a blade does in the
 * light.
 */
function grassTexture(): CanvasTexture {
  const size = LOOK.cardPixels;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    // A fixed sequence, so the texture is the same picture every load.
    let seed = 20261;
    const random = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const blades = 22;
    for (let b = 0; b < blades; b++) {
      const root = (b + 0.5 + (random() - 0.5) * 0.8) * (size / blades);
      const height = size * (0.55 + random() * 0.45);
      const lean = (random() - 0.5) * size * 0.4;
      const width = size * (0.012 + random() * 0.018);
      const colour = new Color(LOOK.greens[Math.floor(random() * LOOK.greens.length)] as string);
      const pale = colour.clone().lerp(new Color('#cfd3a0'), LOOK.tipFade);
      const gradient = ctx.createLinearGradient(0, size, 0, size - height);
      gradient.addColorStop(0, `#${colour.getHexString()}`);
      gradient.addColorStop(1, `#${pale.getHexString()}`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(root - width, size);
      ctx.quadraticCurveTo(root + lean * 0.4, size - height * 0.6, root + lean, size - height);
      ctx.quadraticCurveTo(root + lean * 0.4 + width, size - height * 0.6, root + width, size);
      ctx.closePath();
      ctx.fill();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Two quads crossed at a right angle, standing on the data frame's XY plane
 * and rising in +Z, with the UVs the card's texture wants. Both are drawn
 * from either side, because half of a crossed pair always faces away.
 */
function cardGeometry(): BufferGeometry {
  const w = LOOK.widthMetres / 2;
  const h = LOOK.heightMetres;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const quad = (ax: number, ay: number): void => {
    const base = positions.length / 3;
    positions.push(-ax * w, -ay * w, 0, ax * w, ay * w, 0, ax * w, ay * w, h, -ax * w, -ay * w, h);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  quad(1, 0);
  quad(0, 1);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(Float32Array.from(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(Float32Array.from(uvs), 2));
  geometry.setIndex(new BufferAttribute(Uint16Array.from(indices), 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * The wind and the distance fade, patched into the card's own material.
 *
 * Both are the vertex shader's business: the sway leans the top of the card
 * about its foot, and the fade takes the card's height to nothing as it goes
 * out, which is cheaper than any transparency and leaves nothing to sort. The
 * instance's own foot in world space gives both the phase and the distance,
 * and it comes out of the instance matrix rather than an extra attribute.
 */
function applyBlades(material: Material, clock: { value: number }): void {
  // Through `patchMaterial` and not by assigning the hook, because the air
  // and the cascaded shadow maps both want the same one, and the cascades
  // assign theirs from outside whenever the sun is rebuilt.
  patchMaterial(material, 'blades', 'v1', (shader) => {
    shader.uniforms.bladeTime = clock;
    shader.uniforms.bladeFade = { value: LOOK.fadeMetres };
    shader.uniforms.bladeSway = { value: (LOOK.swayDegrees * Math.PI) / 180 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float bladeTime;\nuniform float bladeFade;\nuniform float bladeSway;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 foot = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float far = distance(foot, cameraPosition);
          float near = 1.0 - smoothstep(bladeFade * 0.6, bladeFade, far);
          // The card is modelled standing in +Z, which inside the rotated
          // group is up, so its height is its own z and the lean is in xy.
          float up = transformed.z;
          float phase = foot.x * 0.21 + foot.z * 0.17;
          float lean = sin(bladeTime * ${(Math.PI * 2 / LOOK.swaySeconds).toFixed(4)} + phase) * bladeSway * up;
          transformed.x += lean;
          transformed.y += lean * 0.6;
          transformed.z = up * near;
        }`,
      );
  });
}

// --- The scatter -----------------------------------------------------------

export interface Scattered {
  /** East, north, up, the yaw about up in radians, and the scale. */
  places: { x: number; y: number; z: number; yaw: number; scale: number }[];
}

/**
 * Where a kind stands, walked over the terrain's own cells out from the
 * plateau's centre, so a cap cuts the furthest and not a random half.
 *
 * The mask is `greenAt`, which is the ground's own tint read on the CPU. The
 * ground's steepness comes from the terrain sampler, four metres either side,
 * which is as fine as a twenty-metre grid can answer.
 *
 * The harbour basin is skipped outright. Its ground stands above its own
 * waterline on the surface model, which is exactly why `Terrain.tsx` cuts a
 * hole there, and the mask cannot see a hole: without this the plateau grows
 * a meadow standing in the harbour.
 */
function scatter(
  mask: GreenMask,
  ground: (x: number, y: number) => number,
  level: number | undefined,
  strength: number,
  density: number,
  cap: number,
  seed: number,
  basin: readonly (readonly [number, number])[] | undefined,
): Scattered {
  const places: Scattered['places'] = [];
  if (strength <= 0 || density <= 0) return { places };
  const { x0, y0, size } = mask.extent;
  // Twenty metres, the terrain's own spacing: fine enough that the mask does
  // not jump between cells and coarse enough to walk in a frame.
  const step = 20;
  const cells = Math.floor(size / step);
  const half = cells / 2;
  let state = seed;
  const random = (): number => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  // Cell indices ordered by how far they are from the middle of the grid,
  // which is the Great Pyramid's own neighbourhood.
  const order: number[] = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) order.push(j * cells + i);
  order.sort((a, b) => {
    const da = Math.hypot((a % cells) - half, Math.floor(a / cells) - half);
    const db = Math.hypot((b % cells) - half, Math.floor(b / cells) - half);
    return da - db;
  });

  const area = step * step;
  for (const cell of order) {
    if (places.length >= cap) break;
    const i = cell % cells;
    const j = Math.floor(cell / cells);
    const cx = x0 + (i + 0.5) * step;
    const cy = y0 + (j + 0.5) * step;
    if (basin && rectangleContains(basin, cx, cy)) continue;
    const z = ground(cx, cy);
    const dx = (ground(cx + 4, cy) - ground(cx - 4, cy)) / 8;
    const dy = (ground(cx, cy + 4) - ground(cx, cy - 4)) / 8;
    const upness = 1 / Math.sqrt(1 + dx * dx + dy * dy);
    const green = greenAt(mask, cx, cy, z, upness, level, strength);
    if (green <= 0.02) continue;
    const wanted = green * density * area;
    let n = Math.floor(wanted);
    if (random() < wanted - n) n += 1;
    for (let k = 0; k < n && places.length < cap; k++) {
      const x = cx + (random() - 0.5) * step;
      const y = cy + (random() - 0.5) * step;
      if (basin && rectangleContains(basin, x, y)) continue;
      places.push({
        x,
        y,
        z: ground(x, y),
        yaw: random() * Math.PI * 2,
        scale: 1 + (random() - 0.5) * 2 * LOOK.heightVary,
      });
    }
  }
  return { places };
}

/** The instance matrices for a scatter, in the data frame. */
function instanceMatrices(places: Scattered['places']): Matrix4[] {
  const dummy = new Object3D();
  return places.map((p) => {
    dummy.position.set(p.x, p.y, p.z);
    // Yaw about the data frame's own up, which is +Z.
    dummy.rotation.set(0, 0, p.yaw);
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();
    return dummy.matrix.clone();
  });
}

// --- Track K's plants ------------------------------------------------------

/** One line of `public/props/manifest.json`, as far as the vegetation cares. */
export interface PropEntry {
  id: string;
  kind: string;
  name: string;
  file: string;
  lods?: string[];
  scale_to?: number;
  evidence?: string;
  note?: string;
}

let props: Promise<PropEntry[]> | undefined;

/** The props manifest, once, and an empty list where Track K has not landed. */
export function loadProps(): Promise<PropEntry[]> {
  props ??= fetch(`${import.meta.env.BASE_URL}props/manifest.json`)
    .then((r) => (r.ok ? (r.json() as Promise<PropEntry[] | { props?: PropEntry[] }>) : []))
    .then((body) => (Array.isArray(body) ? body : (body.props ?? [])))
    .catch(() => []);
  return props;
}

const models = new Map<string, Promise<Group | undefined>>();

function loadPlant(file: string): Promise<Group | undefined> {
  let promise = models.get(file);
  if (!promise) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    promise = new Promise<Group | undefined>((resolve) => {
      loader.load(`${import.meta.env.BASE_URL}props/${file}`, (gltf) => resolve(gltf.scene), undefined, () => resolve(undefined));
    });
    models.set(file, promise);
  }
  return promise;
}

/** The first mesh in a loaded model, which is what a plant is instanced from. */
function firstMesh(group: Group): Mesh | undefined {
  let found: Mesh | undefined;
  group.traverse((object) => {
    if (!found && (object as Mesh).isMesh) found = object as Mesh;
  });
  return found;
}

// --- The component ---------------------------------------------------------

export interface VegetationProps {
  terrain: TerrainProps;
  clippingPlanes: Plane[];
}

export function Vegetation({ terrain, clippingPlanes }: VegetationProps): React.JSX.Element | null {
  const state = useView((s) => s.state);
  const water = useWater();
  const mask = useGreenMask(terrain.header);
  const ground = useMemo(() => groundSampler(terrain), [terrain]);
  const strength = GREEN.strength[state];
  const level = water?.level;
  const basin = water?.kind === 'basin' ? water.outline : undefined;

  const blades = useMemo(
    () => (mask ? scatter(mask, ground, level, strength, LOOK.perSquareMetre, LOOK.cap, 90210, basin) : undefined),
    [mask, ground, level, strength, basin],
  );

  const geometry = useMemo(() => cardGeometry(), []);
  const texture = useMemo(() => grassTexture(), []);
  useEffect(() => () => {
    geometry.dispose();
    texture.dispose();
  }, [geometry, texture]);

  // One clock for every card and every plant, advanced here rather than in
  // each material, so the field leans as one wind and not as several.
  const clock = useMemo(() => ({ value: 0 }), []);
  useFrame((_, delta) => {
    clock.value += delta;
  });

  const material = useMemo(() => {
    const m = new MeshStandardMaterial({
      map: texture,
      // Alpha test and not blending: the cards overlap each other by the
      // thousand and sorting them is not worth a frame. It also leaves the
      // dissolve free to turn the alpha hash on over the top, which is what
      // `fade.ts` does between stops.
      alphaTest: 0.45,
      transparent: false,
      side: DoubleSide,
      roughness: 0.85,
      metalness: 0,
      color: LOOK.tint[state] ?? '#ffffff',
    });
    applyBlades(m, clock);
    applyAtmosphere(m);
    return m;
  }, [texture, clock, state]);
  useEffect(() => {
    material.clippingPlanes = clippingPlanes;
    material.needsUpdate = true;
  }, [material, clippingPlanes]);
  useEffect(() => {
    receiveCascades(material);
    return () => forgetCascades(material);
  }, [material]);
  useEffect(() => () => material.dispose(), [material]);

  const seked = useMemo(
    () => ({
      name: 'The grass of the Green Sahara',
      tier: 'claim' as const,
      note:
        'A claim: the First Time drawn green. The science behind the staging is the African Humid Period, about 12,500 to 3,500 BCE, '
        + 'when North Africa carried grassland and lakes rather than desert; what grew on this plateau in 10,500 BCE is not recorded. '
        + `Look choices: ${LOOK.perSquareMetre} blades a square metre where the mask is full, capped at ${LOOK.cap}, `
        + 'scattered by the same mask that tints the ground, which keeps them off steep rock and off the monuments’ own footprints.',
      state,
    }),
    [state],
  );

  if (!blades || blades.places.length === 0) return null;
  return (
    <>
      <Cards geometry={geometry} material={material} places={blades.places} seked={seked} />
      {mask && (
        <Plants
          mask={mask}
          ground={ground}
          level={level}
          strength={strength}
          basin={basin}
          clippingPlanes={clippingPlanes}
          clock={clock}
          state={state}
        />
      )}
    </>
  );
}

interface CardsProps {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  places: Scattered['places'];
  seked: object;
}

/**
 * The instanced mesh itself. It is its own component so that the matrices are
 * written in an effect that has the mesh to write them on, which a parent
 * returning null until its scatter is ready could not promise.
 */
function Cards({ geometry, material, places, seked }: CardsProps): React.JSX.Element {
  const [mesh, setMesh] = useState<InstancedMesh | null>(null);
  useEffect(() => {
    if (!mesh) return;
    instanceMatrices(places).forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    // The cards stand all over the plateau, so the frustum test against one
    // bounding sphere is worth nothing and the sphere itself is wrong until
    // the matrices are in.
    mesh.frustumCulled = false;
  }, [mesh, places]);
  return (
    <instancedMesh
      ref={setMesh}
      args={[geometry, material, places.length]}
      key={places.length}
      name="vegetation.grass"
      userData={{ seked }}
      castShadow={false}
      receiveShadow
    />
  );
}

interface PlantsProps {
  mask: GreenMask;
  ground: (x: number, y: number) => number;
  level: number | undefined;
  strength: number;
  basin: readonly (readonly [number, number])[] | undefined;
  clippingPlanes: Plane[];
  clock: { value: number };
  state: string;
}

/**
 * Track K's plants, scattered by the same mask. Where the manifest is absent
 * this renders nothing at all and says nothing, which is the state it ships
 * in until that track lands.
 */
function Plants({ mask, ground, level, strength, basin, clippingPlanes, clock, state }: PlantsProps): React.JSX.Element | null {
  const [entries, setEntries] = useState<PropEntry[]>([]);
  useEffect(() => {
    let alive = true;
    void loadProps().then((all) => {
      if (alive) setEntries(all.filter((e) => e.kind === 'plant'));
    });
    return () => {
      alive = false;
    };
  }, []);
  if (strength <= 0) return null;
  return (
    <>
      {entries.map((entry, i) => (
        <Plant
          key={entry.id}
          entry={entry}
          mask={mask}
          ground={ground}
          level={level}
          strength={strength}
          basin={basin}
          clippingPlanes={clippingPlanes}
          clock={clock}
          state={state}
          seed={7717 + i * 131}
        />
      ))}
    </>
  );
}

interface PlantProps extends PlantsProps {
  entry: PropEntry;
  seed: number;
}

function Plant({ entry, mask, ground, level, strength, basin, clippingPlanes, clock, state, seed }: PlantProps): React.JSX.Element | null {
  const [source, setSource] = useState<Mesh | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void loadPlant(entry.lods?.[0] ?? entry.file).then((group) => {
      if (alive && group) setSource(firstMesh(group));
    });
    return () => {
      alive = false;
    };
  }, [entry]);

  const density = PLANT_DENSITY[plantKindOf(entry)] ?? PLANT_DENSITY_DEFAULT;
  const places = useMemo(
    () => scatter(mask, ground, level, strength, density, 4000, seed, basin).places,
    [mask, ground, level, strength, density, seed, basin],
  );

  const material = useMemo(() => {
    const held = source?.material;
    const m = (Array.isArray(held) ? held[0] : held) as MeshStandardMaterial | undefined;
    if (!m) return undefined;
    const copy = m.clone();
    applyBlades(copy, clock);
    applyAtmosphere(copy);
    return copy;
  }, [source, clock]);
  useEffect(() => {
    if (!material) return;
    material.clippingPlanes = clippingPlanes;
    receiveCascades(material);
    return () => {
      forgetCascades(material);
      material.dispose();
    };
  }, [material, clippingPlanes]);

  const [mesh, setMesh] = useState<InstancedMesh | null>(null);
  useEffect(() => {
    if (!mesh) return;
    const scale = entry.scale_to ?? 1;
    instanceMatrices(places).forEach((m, i) => {
      mesh.setMatrixAt(i, m.clone().multiply(new Matrix4().makeScale(scale, scale, scale)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
  }, [mesh, places, entry]);

  if (!source || !material || places.length === 0) return null;
  return (
    <instancedMesh
      ref={setMesh}
      args={[source.geometry, material, places.length]}
      key={`${entry.id}:${places.length}`}
      name={`vegetation.${entry.id}`}
      userData={{
        seked: {
          name: entry.name,
          tier: 'claim',
          note:
            `A claim: ${entry.name} standing in the First Time's grassland, a stand-in model scattered by the green mask and not by any record. `
            + 'The science behind the staging is the African Humid Period, about 12,500 to 3,500 BCE. '
            + (entry.note ?? ''),
          state,
        },
      }}
      castShadow
      receiveShadow
    />
  );
}

/**
 * Which density a plant takes, out of its own id or name. The manifest says
 * `kind: 'plant'` and no more, so the word that decides how thickly it stands
 * is looked for in what it is called.
 */
function plantKindOf(entry: PropEntry): string {
  const words = `${entry.id} ${entry.name}`.toLowerCase();
  for (const kind of Object.keys(PLANT_DENSITY)) if (words.includes(kind)) return kind;
  return 'default';
}
