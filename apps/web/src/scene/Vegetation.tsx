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
import { useEffect, useMemo, useRef, useState } from 'react';
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
  TextureLoader,
  Vector3,
  type Material,
  type Plane,
  type Texture,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { rectangleContains } from '@seked/geometry';
import { useView } from '../store';
import { applyAtmosphere } from './Atmosphere';
import { patchMaterial } from './materials/patch';
import { GREEN, greenAt, useGreenMask, type GreenMask } from './materials/ground';
import { cascadeBreaks, forgetCascades, receiveCascades } from './materials/shadows';
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
  /**
   * How far out a scattered plant stops being a model and becomes a card, in
   * metres from the camera.
   *
   * A look choice, and a new one (2026-09-18). Nine hundred metres is where a
   * twelve-metre palm is about fifteen pixels tall at this field of view,
   * which is a silhouette and nothing more, and a silhouette is what a card
   * draws. Below it every plant is its own model at full size, which is
   * itself a change: the plants used to take the grass's own fade and were
   * squashed to nothing from four hundred metres out, so they were paid for
   * in full and not seen at all.
   */
  cardMetres: 900,
  /**
   * How far inside that line the camera has to come back before the model
   * returns. A look choice, and `lod.ts`'s own pattern: sixty metres is wide
   * enough that no move at a walking pace crosses it twice and narrow enough
   * that nothing is a card where it fills the frame.
   */
  cardBandMetres: 60,
  /**
   * How far out a card has shrunk to nothing. A look choice. Two and a half
   * kilometres carries the savanna out to where the haze takes it, and stops
   * short of the scatter's own edge, which would otherwise read as a line of
   * trees ruled across the horizon.
   */
  cardFadeMetres: 2500,
  /**
   * Where the plants stop casting shadows while there are no cascades to ask.
   *
   * A look choice and a fallback only: the real line is the first cascade's
   * own far plane, read off `materials/shadows.ts` every frame. Five hundred
   * metres is about what `Renderer.tsx`'s three cascades in `practical` mode
   * over three kilometres come to, so the picture does not jump between the
   * scene mounting and the sun being built.
   */
  shadowFallbackMetres: 500,
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

/** The most of one plant that stands at once, a look choice set by what the coarse level costs. */
const PLANT_CAP = 700;

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
 * The wind, the distance fade and the dissolve, patched into the card's own
 * material.
 *
 * The wind and the fade are the vertex shader's business: the sway leans the
 * top of the card about its foot, and the fade takes the card's height to
 * nothing as it goes out, which is cheaper than any transparency and leaves
 * nothing to sort. Both are read once per instance and never per vertex, so a
 * card bends and shrinks as one thing and cannot shimmer along its own edge.
 *
 * The distance is measured to the instance's own centre and not to its
 * origin. They are the same point for a grass card, which stands on its foot
 * at the middle of its own spread, and metres apart for a plant, whose parts
 * each carry their place inside the model in their instance matrix: measured
 * to the origin, an acacia's crown and its trunk fade at different distances
 * and the tree comes apart as a camera creeps up on it. The centre comes off
 * the geometry's own bounding sphere, so no distance is typed here.
 *
 * The dissolve is the fragment shader's. `fade.ts` stipples the plateau
 * between stops by turning three's alpha hash on and taking the material's
 * opacity down, and an alpha-tested material fights that: the test compares
 * the map's alpha times the opacity against a fixed bar, so as the opacity
 * falls the bar effectively rises, and the card is eaten in from its thin
 * edges and gone long before the hash has stippled anything. Dividing the
 * opacity back out of the test leaves the cut-out exactly where it was drawn
 * and hands the whole of the dissolve to the hash, which is what every stone
 * in the scene is dissolved by. So the cards keep their alpha test, take
 * `fade.ts`'s hash as it is given, and nothing here has to know that a
 * dissolve is running.
 */
function applyBlades(material: Material, clock: { value: number }, geometry: BufferGeometry, fadeMetres: number): void {
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  const centre = geometry.boundingSphere?.center ?? new Vector3();
  // Through `patchMaterial` and not by assigning the hook, because the air
  // and the cascaded shadow maps both want the same one, and the cascades
  // assign theirs from outside whenever the sun is rebuilt.
  patchMaterial(material, 'blades', 'v3', (shader) => {
    shader.uniforms.bladeTime = clock;
    shader.uniforms.bladeFade = { value: fadeMetres };
    shader.uniforms.bladeSway = { value: (LOOK.swayDegrees * Math.PI) / 180 };
    shader.uniforms.bladeCentre = { value: centre.clone() };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float bladeTime;\nuniform float bladeFade;\nuniform float bladeSway;\nuniform vec3 bladeCentre;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 anchor = (modelMatrix * instanceMatrix * vec4(bladeCentre, 1.0)).xyz;
          float far = distance(anchor, cameraPosition);
          // A fade of nothing is no fade at all: a plant inside the card line
          // is drawn at its own size and is swapped for a card rather than
          // shrunk away, which is what the grass alone is still shrunk by.
          float near = bladeFade > 0.0 ? 1.0 - smoothstep(bladeFade * 0.6, bladeFade, far) : 1.0;
          // The card is modelled standing in +Z, which inside the rotated
          // group is up, so its height is its own z and the lean is in xy.
          float up = transformed.z;
          float phase = anchor.x * 0.21 + anchor.z * 0.17;
          float lean = sin(bladeTime * ${(Math.PI * 2 / LOOK.swaySeconds).toFixed(4)} + phase) * bladeSway * up;
          transformed.x += lean;
          transformed.y += lean * 0.6;
          transformed.z = up * near;
        }`,
      );
    // Three's own chunk, with the opacity divided back out of the bar. Its
    // other branch, `ALPHA_TO_COVERAGE`, is not on anywhere in this scene.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <alphatest_fragment>',
      `#ifdef USE_ALPHATEST
        if ( diffuseColor.a < alphaTest * opacity ) discard;
      #endif`,
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

/**
 * The level a scattered plant is instanced from, baked to a triangle budget
 * by `scripts/web-assets.ts` rather than to a ratio of the finest level.
 */
const SCATTER_LEVEL = 'scatter';

/** One line of `public/props/manifest.json`, as far as the vegetation cares. */
export interface PropEntry {
  id: string;
  kind: string;
  name: string;
  file: string;
  lods?: string[];
  /** How many triangles each level draws, by node name, as the baker measured them. */
  levels?: Record<string, number>;
  /** The far ring's billboard: the file beside the GLB, and the metres its square stands for. */
  card?: { file: string; metres: number };
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

/**
 * The meshes a plant is instanced from: everything under the model's first
 * level of detail (the node `lods[0]` names, or the whole model where a file
 * carries no levels), each with the transform it carries inside that node.
 * The props pipeline has already turned the model into the data frame and
 * scaled it to `scale_to`, so nothing is scaled or turned again here; a palm
 * is a trunk and a crown in two materials, so every primitive is kept.
 */
interface PlantPart {
  mesh: Mesh;
  local: Matrix4;
}

function partsOf(group: Group, level: string | undefined): PlantPart[] {
  const node = (level ? group.getObjectByName(level) : undefined) ?? group;
  node.updateMatrixWorld(true);
  const inverse = new Matrix4().copy(node.matrixWorld).invert();
  const parts: PlantPart[] = [];
  node.traverse((child) => {
    if (!(child as Mesh).isMesh) return;
    parts.push({ mesh: child as Mesh, local: new Matrix4().multiplyMatrices(inverse, child.matrixWorld) });
  });
  return parts;
}

// --- The three rings -------------------------------------------------------
//
// A plant is drawn one of three ways by how far it is from the camera, and
// each way is its own instanced mesh over one shared placement list.
//
//   ring 0, inside the first shadow cascade: its own model, casting a shadow
//   ring 1, out to `LOOK.cardMetres`:        its own model, casting nothing
//   ring 2, beyond that:                     two crossed quads with a picture
//
// It is done as three lists of indices and not as a flag the shader reads,
// because a flag still pays for every vertex of every instance: seven hundred
// island trees at three thousand triangles is two million triangles of vertex
// work whether they end up on screen or collapsed to nothing. Cutting a
// mesh's `count` down is the only thing that stops the work being done, and
// that is the whole saving.
//
// The shadow line is where it is because a shadow map has a texel size. The
// cascades cover three kilometres between them, so the second and third put a
// texel at metres, and a tree's shadow drawn at metres a texel is a grey
// lozenge that nothing in the picture explains, while the tree is still paid
// for in that whole pass. Inside the first cascade the texel is fine enough
// to read a crown, and that is where the plants cast. The metres come off the
// cascades themselves (`materials/shadows.ts`), never typed here, so a change
// to `LOOK.shadows` in `Renderer.tsx` moves this line with it.
//
// The bands are `lod.ts`'s rule in its simplest form. Going out, the next ring
// takes over at the line; coming in, the finer one does not return until the
// camera is a band inside it, so a camera loitering on a line stays on
// whichever side it arrived from and nothing flickers.

/** How many rings there are: shadowed model, plain model, card. */
const RINGS = 3;

/** Which ring draws each place, and the three lists that follow from it. */
interface Partition {
  /** The ring each place is in: 0 shadowed model, 1 plain model, 2 card. */
  side: Uint8Array;
  /** The place indices each mesh draws, one array a ring, and how many of each are live. */
  rings: Uint32Array[];
  counts: number[];
  /** Bumped when the lists change, which is the only time a mesh rewrites its matrices. */
  version: number;
}

function newPartition(n: number): Partition {
  return {
    side: new Uint8Array(n),
    rings: Array.from({ length: RINGS }, () => new Uint32Array(n)),
    counts: new Array<number>(RINGS).fill(0),
    version: 0,
  };
}

/**
 * Sort the places into the rings for this frame, and rebuild the lists only
 * when something actually crossed. The distance is to the place itself, in the
 * data frame, which is where both the places and the camera are put.
 *
 * `lines[i]` is where ring `i` gives way to ring `i + 1`, so a plant walks out
 * one ring at a time and back in one ring at a time, which is `chooseLod`'s
 * own shape without its per-thing state: the state here is the ring the place
 * was in last frame, which is the same memory and one byte instead of three
 * numbers.
 */
function repartition(partition: Partition, places: Scattered['places'], at: Vector3, lines: number[], band: number): void {
  let changed = partition.version === 0;
  const last = RINGS - 1;
  for (let i = 0; i < places.length; i++) {
    const p = places[i] as Scattered['places'][number];
    const distance = Math.hypot(p.x - at.x, p.y - at.y, p.z - at.z);
    const was = partition.side[i] as number;
    let now = was;
    while (now < last && distance > (lines[now] as number)) now++;
    while (now > 0 && distance < (lines[now - 1] as number) - band) now--;
    if (now === was) continue;
    partition.side[i] = now;
    changed = true;
  }
  if (!changed) return;
  partition.counts.fill(0);
  for (let i = 0; i < places.length; i++) {
    const ring = partition.side[i] as number;
    (partition.rings[ring] as Uint32Array)[partition.counts[ring] as number] = i;
    partition.counts[ring] = (partition.counts[ring] as number) + 1;
  }
  partition.version++;
}

/**
 * The card: two quads crossed at a right angle, one in the data frame's XZ
 * plane and one in its YZ plane, standing on the ground and rising in +Z.
 *
 * The baker's picture holds two views side by side, the plant seen from the
 * south in the left half and from the west in the right, so the quad whose
 * width runs east takes the left half and the one whose width runs north
 * takes the right, and each quad shows the view that belongs to it. Both are
 * drawn from either side, because half of a crossed pair always faces away.
 *
 * The cross is not turned to face the camera. A cross does not need to be:
 * that is what the second quad is for, and a card that turns pops as the
 * camera swings while a card that does not simply changes which of its two
 * pictures is nearer the front. It is also seven hundred matrices a frame
 * that are never written.
 */
function cardGeometryFor(metres: number): BufferGeometry {
  const w = metres / 2;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const quad = (east: boolean, u0: number): void => {
    const base = positions.length / 3;
    if (east) positions.push(-w, 0, 0, w, 0, 0, w, 0, metres, -w, 0, metres);
    else positions.push(0, -w, 0, 0, w, 0, 0, w, metres, 0, -w, metres);
    uvs.push(u0, 0, u0 + 0.5, 0, u0 + 0.5, 1, u0, 1);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  quad(true, 0);
  quad(false, 0.5);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(Float32Array.from(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(Float32Array.from(uvs), 2));
  geometry.setIndex(new BufferAttribute(Uint16Array.from(indices), 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

const cardTextures = new Map<string, Texture>();

/** The card's picture, once per plant and shared between every instance of it. */
function loadCard(file: string): Texture {
  let texture = cardTextures.get(file);
  if (!texture) {
    texture = new TextureLoader().load(`${import.meta.env.BASE_URL}props/${file}`);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    cardTextures.set(file, texture);
  }
  return texture;
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
    applyBlades(m, clock, geometry, LOOK.fadeMetres);
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
  const [parts, setParts] = useState<PlantPart[] | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    // A scattered plant stands hundreds of times, so it is instanced from the
    // level baked to a triangle budget and from no other.
    //
    // It used to take the coarsest of the ratio levels, on the reasoning that
    // the coarsest is the cheapest. It is, and it was not nearly cheap
    // enough: a ratio and an error bound are two demands on the simplifier
    // and the error bound wins, so the island tree's coarsest ratio level was
    // still 169,160 triangles across three meshes. Seven hundred of those is
    // 118 million triangles a frame before the shadow passes, which is what
    // held the built and ancient states at four frames a second while the
    // today state ran at two hundred (director, 2026-09-18). The `scatter`
    // level asks for a count instead and relaxes the error until it gets it.
    void loadPlant(entry.file).then((group) => {
      if (!alive || !group) return;
      const scatter = entry.lods?.includes(SCATTER_LEVEL) ? SCATTER_LEVEL : undefined;
      if (!scatter) {
        console.warn(
          `seked: ${entry.id} has no "${SCATTER_LEVEL}" level, so it is scattered from its coarsest ratio level, `
            + `which may be tens of thousands of triangles times ${PLANT_CAP} instances. `
            + 'Give it a `scatter_to` in blender/props.json and run pnpm web-assets.',
        );
      }
      setParts(partsOf(group, scatter ?? entry.lods?.[entry.lods.length - 1]));
    });
    return () => {
      alive = false;
    };
  }, [entry]);

  const density = PLANT_DENSITY[plantKindOf(entry)] ?? PLANT_DENSITY_DEFAULT;
  const places = useMemo(
    () => scatter(mask, ground, level, strength, density, PLANT_CAP, seed, basin).places,
    [mask, ground, level, strength, density, seed, basin],
  );
  const matrices = useMemo(() => instanceMatrices(places), [places]);

  // Which ring each place is in this frame. It is held here and read by both
  // meshes, so the two can never disagree about which of them draws a plant.
  const partition = useMemo(() => newPartition(places.length), [places]);
  const here = useRef(new Vector3()).current;
  const group = useRef<Group>(null);
  const lines = useRef<number[]>([LOOK.shadowFallbackMetres, LOOK.cardMetres]).current;
  useFrame(({ camera }) => {
    const node = group.current;
    if (!node || places.length === 0) return;
    // Where the first cascade ends, off the cascades themselves. It follows
    // the camera's own far plane, so it is read every frame and not once.
    const breaks = cascadeBreaks();
    lines[0] = Math.min(breaks?.[0] ?? LOOK.shadowFallbackMetres, LOOK.cardMetres);
    lines[1] = LOOK.cardMetres;
    // The camera in the data frame. Taken through the group's own inverse
    // rather than by turning the axes here, so nothing in this file has to
    // know which way the one rotated group is turned.
    node.worldToLocal(here.copy(camera.position));
    repartition(partition, places, here, lines, LOOK.cardBandMetres);
  });

  const tag = useMemo(
    () => ({
      name: entry.name,
      tier: 'claim',
      note:
        `A claim: ${entry.name} standing in the First Time's grassland, a stand-in model scattered by the green mask and not by any record. `
        + 'The science behind the staging is the African Humid Period, about 12,500 to 3,500 BCE. '
        + (entry.note ?? ''),
      state,
    }),
    [entry, state],
  );

  if (!parts || parts.length === 0 || places.length === 0) return null;
  return (
    <group ref={group} name={`vegetation.${entry.id}`} userData={{ seked: tag }}>
      {parts.map((part, k) => (
        <PlantPrimitive
          key={`${entry.id}:${k}:${places.length}`}
          part={part}
          matrices={matrices}
          partition={partition}
          clippingPlanes={clippingPlanes}
          clock={clock}
        />
      ))}
      {entry.card && (
        <PlantCards
          key={`${entry.id}:card:${places.length}`}
          card={entry.card}
          matrices={matrices}
          partition={partition}
          clippingPlanes={clippingPlanes}
          clock={clock}
        />
      )}
    </group>
  );
}

/**
 * One primitive of a plant, instanced at every place in the two model rings,
 * with the part's own transform inside the model applied first.
 *
 * It is two meshes and not one because they differ in exactly one thing: the
 * near one casts a shadow and the middle one does not, and `castShadow` is a
 * property of a mesh and not of an instance. Two calls drawing between them
 * the triangles one used to draw cost a call; the middle ring's instances not
 * being drawn at all in the three shadow passes is the saving.
 *
 * The matrices are combined once, when the scatter changes, and the frame's
 * work is a copy of sixteen floats per instance that moved between the rings,
 * done only on the frames the partition says something moved.
 */
function PlantPrimitive({
  part,
  matrices,
  partition,
  clippingPlanes,
  clock,
}: {
  part: PlantPart;
  matrices: Matrix4[];
  partition: Partition;
  clippingPlanes: Plane[];
  clock: { value: number };
}): React.JSX.Element | null {
  const material = useMemo(() => {
    const held = part.mesh.material;
    const m = (Array.isArray(held) ? held[0] : held) as MeshStandardMaterial | undefined;
    if (!m) return undefined;
    const copy = m.clone();
    // No fade of its own: inside the card line a plant is drawn at its own
    // size, and outside it the card has taken over.
    applyBlades(copy, clock, part.mesh.geometry, 0);
    applyAtmosphere(copy);
    return copy;
  }, [part, clock]);
  useEffect(() => {
    if (!material) return;
    material.clippingPlanes = clippingPlanes;
    receiveCascades(material);
    return () => {
      forgetCascades(material);
      material.dispose();
    };
  }, [material, clippingPlanes]);

  const [casting, setCasting] = useState<InstancedMesh | null>(null);
  const [plain, setPlain] = useState<InstancedMesh | null>(null);
  const combined = useMemo(() => {
    const out = new Float32Array(matrices.length * 16);
    const m = new Matrix4();
    matrices.forEach((x, i) => {
      m.copy(x).multiply(part.local);
      out.set(m.elements, i * 16);
    });
    return out;
  }, [matrices, part]);
  const drawn = useRef(-1);
  useEffect(() => {
    drawn.current = -1;
    if (casting) casting.frustumCulled = false;
    if (plain) plain.frustumCulled = false;
  }, [casting, plain, combined]);
  useFrame(() => {
    if (!casting || !plain || drawn.current === partition.version) return;
    drawn.current = partition.version;
    writeRing(casting, combined, partition, 0);
    writeRing(plain, combined, partition, 1);
  });

  if (!material) return null;
  return (
    <>
      <instancedMesh ref={setCasting} args={[part.mesh.geometry, material, matrices.length]} castShadow receiveShadow />
      <instancedMesh ref={setPlain} args={[part.mesh.geometry, material, matrices.length]} castShadow={false} receiveShadow />
    </>
  );
}

/**
 * The far ring: one instanced mesh of crossed quads per plant, carrying the
 * baker's two views of it.
 *
 * It never casts a shadow. A card is a flat cross and its shadow is a flat
 * cross, which at nine hundred metres is a smudge on the sand that nobody can
 * read as a tree; the near ring is where the shadows are, and Q4 is where
 * that is settled.
 */
function PlantCards({
  card,
  matrices,
  partition,
  clippingPlanes,
  clock,
}: {
  card: NonNullable<PropEntry['card']>;
  matrices: Matrix4[];
  partition: Partition;
  clippingPlanes: Plane[];
  clock: { value: number };
}): React.JSX.Element {
  const geometry = useMemo(() => cardGeometryFor(card.metres), [card.metres]);
  const texture = useMemo(() => loadCard(card.file), [card.file]);
  const material = useMemo(() => {
    const m = new MeshStandardMaterial({
      map: texture,
      // Alpha test and not blending, as the grass is, so nothing has to be
      // sorted and the dissolve between stops is left to the alpha hash.
      alphaTest: 0.4,
      transparent: false,
      side: DoubleSide,
      roughness: 0.9,
      metalness: 0,
    });
    applyBlades(m, clock, geometry, LOOK.cardFadeMetres);
    applyAtmosphere(m);
    return m;
  }, [texture, clock, geometry]);
  useEffect(() => {
    material.clippingPlanes = clippingPlanes;
    receiveCascades(material);
    return () => {
      forgetCascades(material);
      material.dispose();
    };
  }, [material, clippingPlanes]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const [mesh, setMesh] = useState<InstancedMesh | null>(null);
  const flat = useMemo(() => {
    const out = new Float32Array(matrices.length * 16);
    matrices.forEach((m, i) => out.set(m.elements, i * 16));
    return out;
  }, [matrices]);
  const drawn = useRef(-1);
  useEffect(() => {
    drawn.current = -1;
    if (mesh) mesh.frustumCulled = false;
  }, [mesh, flat]);
  useFrame(() => {
    if (!mesh || drawn.current === partition.version) return;
    drawn.current = partition.version;
    writeRing(mesh, flat, partition, 2);
  });

  return <instancedMesh ref={setMesh} args={[geometry, material, matrices.length]} castShadow={false} receiveShadow />;
}

/** Copy one ring's matrices into a mesh and draw exactly that many instances. */
function writeRing(mesh: InstancedMesh, from: Float32Array, partition: Partition, ring: number): void {
  const which = partition.rings[ring] as Uint32Array;
  const count = partition.counts[ring] as number;
  const array = mesh.instanceMatrix.array as Float32Array;
  for (let i = 0; i < count; i++) {
    const at = (which[i] as number) * 16;
    array.set(from.subarray(at, at + 16), i * 16);
  }
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
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
