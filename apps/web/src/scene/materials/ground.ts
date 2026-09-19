/**
 * The green on the ground, and the one mask that decides where it goes.
 *
 * The First Time is set in the African Humid Period, about 12,500 to 3,500
 * BCE, when North Africa was grassland and not desert. That is science and
 * not a claim; what is a claim is how green this plateau is drawn, and every
 * number that decides it is in `GREEN` below and is a look choice.
 *
 * One mask serves two things that must agree: the tint the ground takes in
 * the shader, and the places `Vegetation.tsx` stands its grass cards on the
 * CPU. Agreeing is not a matter of writing the same formula twice, because
 * a noise written twice in two languages is two noises. So the two parts of
 * the mask that do not come from the geometry are baked once, into one
 * texture over the plateau's own extent:
 *
 *   red    a large smooth noise, which is what makes the green patchy rather
 *          than uniform
 *   green  the keep-off, which is 0 within a margin of any monument's
 *          footprint and 1 in the clear
 *   blue   how built up the ground is now, from the modern city's own count
 *          of buildings per square kilometre. Only `today` weighs it, and it
 *          is what stops the fields growing through Giza and Cairo.
 *
 * The shader reads that texture; `greenAt` reads the same texels through
 * `sampleMask`. The rest of the mask, the height above the water and the
 * steepness of the ground, is read from the geometry on each side: from the
 * world position and the face normal in the shader, from the terrain sampler
 * on the CPU.
 *
 * Frame as everywhere else: +X east, +Y north, +Z up, metres.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  RGBAFormat,
  Vector3,
  type IUniform,
  type MeshStandardMaterial,
} from 'three';
import type { Footprint } from '@seked/geometry';
import type { StateId } from '../../view';
import { loadFootprints } from '../Water';
import { after, patchMaterial } from './patch';

/**
 * LOOK CHOICES, not measurements. None of this is a record of what grew at
 * Giza: it is how much green the plateau is drawn with at each stop, and
 * where.
 *
 * `strength` is the whole mask's weight per stop: the First Time green, `built`
 * a dry scrub mottle, the two late stops bare. `colour` is what the green is
 * mixed towards and `dry` what the scrub is; both are laid over the sand's own
 * photograph rather than in place of it, so the ground keeps its grain.
 *
 * `aboveWaterMetres` is how far above the waterline the green starts: nothing
 * grows in the harbour or out in the flood, and a tussock standing in the
 * basin is the one mistake this mask can make that a reader sees at once.
 *
 * `wetMetres` is how far above the water's level the green is still full
 * strength before it falls away, and `dryMetres` how far above it the flood's
 * own term has gone altogether. Fifty-five metres is about the plateau's
 * height over the valley, so the terrace keeps a little of it and the top of
 * the plateau none. Away from the water only the noise's patches are green, at
 * `uplandShare` of the strength, which is what puts scrub on the plateau and
 * meadow along the shore.
 *
 * `slope` is the two cosines between which a face stops being ground and
 * starts being bedrock: nothing grows on the cliff of the Sphinx's enclosure
 * or on a quarry wall.
 *
 * `keepOffMetres` is the margin round a monument's own footprint that stays
 * bare, `noiseMetres` how large the noise's patches are, and `maskPixels` the
 * baked texture's own square. At 512 over six kilometres a texel is about
 * twelve metres, which is finer than the twenty-metre terrain grid the green
 * is drawn on.
 */
export const GREEN = {
  strength: { ancient: 1, built: 0.3, stripped: 0, today: 0 } as Record<StateId, number>,
  colour: new Vector3(0.16, 0.34, 0.07),
  dry: new Vector3(0.32, 0.31, 0.14),
  aboveWaterMetres: 1.2,
  wetMetres: 8,
  dryMetres: 55,
  uplandShare: 0.7,
  /**
   * How much of the ground the stop's green covers where neither the noise's
   * patches nor the water reach it, which on this plateau is most of it.
   *
   * This is the term that makes the timeline read. The African Humid Period
   * is not a desert with green patches in it, it is grassland, so the First
   * Time's floor is high and the mottle only says where the grass is richer.
   * `built` is the same land drying: about a third of it, which draws as
   * scrub between bare ground. The two modern stops have none at all, and
   * that is what leaves their desert bare on both sides of the fields.
   * LOOK CHOICES, all four.
   */
  floor: { ancient: 0.75, built: 0.28, stripped: 0, today: 0 } as Record<StateId, number>,
  slope: { from: 0.55, to: 0.85 },
  keepOffMetres: 15,
  noiseMetres: 260,
  maskPixels: 512,
  /**
   * The cultivation of the modern valley, which is a different green from the
   * First Time's and is drawn by the same terms.
   *
   * The savanna is patchy because grassland is patchy; the cultivated valley
   * is not, so `upland` is zero and the mottle is switched off altogether.
   * What is left is the one term that says how far above the river a place
   * is, and that is what draws the valley: the fields run from the water's
   * edge to the desert, and the desert is simply the ground that is too high
   * for them. `wetMetres` and `dryMetres` are where that band starts and
   * ends above the river's own surface, and both are LOOK CHOICES: fourteen
   * metres holds the floodplain proper at full green and thirty puts the
   * edge of the green at about the twenty-metre contour, which is roughly
   * where the desert begins east of Giza.
   *
   * `strength` is deliberately under one: modern Egypt's fields are a strong
   * green but they are seen here through several kilometres of haze and under
   * a city, and full strength made the valley read as a lawn.
   */
  valley: {
    strength: 0.9,
    colour: new Vector3(0.12, 0.3, 0.05),
    upland: 0,
    wetMetres: 6,
    dryMetres: 14,
  },
} as const;

/** The plateau's extent, which the baked mask covers texel for texel. */
export interface MaskExtent {
  x0: number;
  y0: number;
  /** Metres across, east and north alike: the terrain is square. */
  size: number;
}

export interface GreenMask {
  texture: DataTexture;
  extent: MaskExtent;
  /** The baked texels, four to a pixel, for the CPU to read the same values. */
  data: Uint8Array;
}

/**
 * How built up the ground is now, off the city import's own index.
 *
 * `scripts/city.ts` writes `city.json` with the records sorted into cells a
 * kilometre square and a count for each, which is a density map already made
 * and costs fifteen kilobytes rather than the six and a half megabytes of the
 * boxes themselves. `denseCount` is the count at which a cell is taken as
 * fully built: it is a LOOK CHOICE, and a generous one, because a cell with
 * six hundred buildings in it is a town whatever its remaining gardens say.
 *
 * Nothing here is evidence and nothing may cite it: the city is context, and
 * this is only where the green is not allowed to grow.
 */
export interface BuiltUp {
  /** Metres square, the import's own cell. */
  size: number;
  /** Cell corner east, cell corner north, buildings in it. */
  cells: ReadonlyArray<readonly [number, number, number]>;
}

const DENSE_COUNT = 600;

/** The share of a place that is town, 0 to 1, with a cell's edges softened. */
function builtShare(city: BuiltUp | undefined, x: number, y: number): number {
  if (!city || city.cells.length === 0) return 0;
  if (!builtIndex || builtIndexFor !== city) {
    builtIndex = new Map();
    for (const [cx, cy, count] of city.cells) builtIndex.set(`${cx}:${cy}`, count);
    builtIndexFor = city;
  }
  // Bilinear over the four cells around the point, so the town's edge is a
  // slope across a kilometre and not a step at a cell's wall.
  const fx = x / city.size - 0.5;
  const fy = y / city.size - 0.5;
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const tx = fx - i;
  const ty = fy - j;
  const at = (ci: number, cj: number): number => {
    const count = builtIndex?.get(`${ci * city.size}:${cj * city.size}`) ?? 0;
    return Math.min(1, count / DENSE_COUNT);
  };
  const a = at(i, j) * (1 - tx) + at(i + 1, j) * tx;
  const b = at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx;
  return a * (1 - ty) + b * ty;
}

let builtIndex: Map<string, number> | undefined;
let builtIndexFor: BuiltUp | undefined;

/** Smooth value noise on a lattice `metres` across, the same shape as the stone's. */
function patches(x: number, y: number, metres: number): number {
  const hash = (i: number, j: number): number => {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const fx = x / metres;
  const fy = y / metres;
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const tx = fx - i;
  const ty = fy - j;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash(i, j) * (1 - sx) + hash(i + 1, j) * sx;
  const b = hash(i, j + 1) * (1 - sx) + hash(i + 1, j + 1) * sx;
  return a * (1 - sy) + b * sy;
}

/**
 * The mask, baked once over the plateau.
 *
 * The keep-off is stamped as a disc per footprint, of the footprint's own
 * area radius plus the margin, which is coarse and is meant to be: it is
 * there to keep grass from growing through a mastaba's wall, not to trace
 * one. A footprint whose area the import did not compute falls back on its
 * outline's own half-diagonal.
 */
export function buildGreenMask(
  features: readonly Footprint[],
  extent: MaskExtent,
  city?: BuiltUp,
): GreenMask {
  const n = GREEN.maskPixels;
  const metresPerTexel = extent.size / n;
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) {
    const y = extent.y0 + (j + 0.5) * metresPerTexel;
    for (let i = 0; i < n; i++) {
      const x = extent.x0 + (i + 0.5) * metresPerTexel;
      const p = (j * n + i) * 4;
      data[p] = Math.round(patches(x, y, GREEN.noiseMetres) * 255);
      data[p + 1] = 255;
      data[p + 2] = Math.round(builtShare(city, x, y) * 255);
      data[p + 3] = 255;
    }
  }

  for (const f of features) {
    if (f.ring.length < 3) continue;
    let cx = 0;
    let cy = 0;
    for (const [x, y] of f.ring) {
      cx += x;
      cy += y;
    }
    cx /= f.ring.length;
    cy /= f.ring.length;
    const spread = f.area > 0
      ? Math.sqrt(f.area / Math.PI)
      : Math.max(...f.ring.map(([x, y]) => Math.hypot(x - cx, y - cy)));
    const radius = spread + GREEN.keepOffMetres;
    const lo = (v: number, origin: number) => Math.max(0, Math.floor((v - radius - origin) / metresPerTexel));
    const hi = (v: number, origin: number) => Math.min(n - 1, Math.ceil((v + radius - origin) / metresPerTexel));
    for (let j = lo(cy, extent.y0); j <= hi(cy, extent.y0); j++) {
      const y = extent.y0 + (j + 0.5) * metresPerTexel;
      for (let i = lo(cx, extent.x0); i <= hi(cx, extent.x0); i++) {
        const x = extent.x0 + (i + 0.5) * metresPerTexel;
        // A soft edge over one texel, so the bare ring round a mastaba does
        // not read as a stencil.
        const d = Math.hypot(x - cx, y - cy);
        const clear = Math.min(1, Math.max(0, (d - radius) / metresPerTexel + 1));
        const p = (j * n + i) * 4 + 1;
        data[p] = Math.min(data[p] as number, Math.round(clear * 255));
      }
    }
  }

  const texture = new DataTexture(data, n, n, RGBAFormat);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, extent, data };
}

/**
 * The masks, by the extent each covers, built once the footprints have loaded
 * and kept. Every caller of the same extent gets the same object, because the
 * footprints are fetched once and the bake is memoised.
 *
 * It is a map and not one slot because two grids are masked now: the
 * plateau's twenty-metre square and the desert's sixty-metre one, which the
 * valley's cultivation is drawn on. One slot made the two evict each other
 * and rebake a 512 by 512 mask every render.
 */
const baked = new Map<string, GreenMask>();

/**
 * The city's cell index, for the mask's blue channel.
 *
 * This is the header of `city.json` and not its six and a half megabytes of
 * boxes: fifteen kilobytes of counts per square kilometre, which is all the
 * mask wants. It is fetched once whatever the stop, because the mask is baked
 * once for all four and only `today` weighs the channel. A city.json that is
 * not there is no town, and the fields grow as they did before it.
 */
let builtUp: Promise<BuiltUp | undefined> | undefined;

export function loadBuiltUp(): Promise<BuiltUp | undefined> {
  builtUp ??= fetch(`${import.meta.env.BASE_URL}city/city.json`)
    .then((r) => (r.ok ? (r.json() as Promise<{ cells?: { size: number; list: [number, number, number, number][] } }>) : undefined))
    .then((header) =>
      header?.cells
        ? { size: header.cells.size, cells: header.cells.list.map(([x, y, , count]) => [x, y, count] as const) }
        : undefined,
    )
    .catch(() => undefined);
  return builtUp;
}

export function useGreenMask(header: MaskHeader): GreenMask | undefined {
  const extent = useMemo(() => maskExtent(header), [header]);
  const [mask, setMask] = useState<GreenMask | undefined>(() => bakedFor(extent));
  useEffect(() => {
    const ready = bakedFor(extent);
    if (ready) {
      setMask(ready);
      return;
    }
    let alive = true;
    void Promise.all([loadFootprints(), loadBuiltUp()]).then(([features, city]) => {
      const key = extentKey(extent);
      let mask = baked.get(key);
      if (!mask) {
        mask = buildGreenMask(features, extent, city);
        baked.set(key, mask);
      }
      if (alive) setMask(mask);
    });
    return () => {
      alive = false;
    };
  }, [extent]);
  return mask;
}

/** What the mask needs off the terrain's header: where the grid starts and how far it runs. */
export interface MaskHeader {
  nx: number;
  ny: number;
  x0: number;
  y0: number;
  spacing: number;
}

export function maskExtent(header: MaskHeader): MaskExtent {
  return {
    x0: header.x0,
    y0: header.y0,
    size: Math.max((header.nx - 1) * header.spacing, (header.ny - 1) * header.spacing),
  };
}

function extentKey(extent: MaskExtent): string {
  return `${extent.x0}:${extent.y0}:${extent.size}`;
}

function bakedFor(extent: MaskExtent): GreenMask | undefined {
  return baked.get(extentKey(extent));
}

/** The baked noise and keep-off at a place on the ground, as the shader reads them. */
export function sampleMask(mask: GreenMask, x: number, y: number): { noise: number; clear: number; built: number } {
  const n = GREEN.maskPixels;
  const metresPerTexel = mask.extent.size / n;
  const i = Math.min(n - 1, Math.max(0, Math.floor((x - mask.extent.x0) / metresPerTexel)));
  const j = Math.min(n - 1, Math.max(0, Math.floor((y - mask.extent.y0) / metresPerTexel)));
  const p = (j * n + i) * 4;
  return {
    noise: (mask.data[p] as number) / 255,
    clear: (mask.data[p + 1] as number) / 255,
    built: (mask.data[p + 2] as number) / 255,
  };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * How green a place on the ground is, from 0 to 1, on the CPU. The shader's
 * `sekedGreen` below is this function in GLSL, term for term, and the two
 * share the one baked texture so their noise cannot drift apart.
 *
 * `level` is the water's own surface, or undefined where the stop is dry, in
 * which case the height term is dropped and only the patches decide.
 * `upness` is the cosine between the ground's normal and up.
 */
export function greenAt(
  mask: GreenMask,
  x: number,
  y: number,
  z: number,
  upness: number,
  level: number | undefined,
  strength: number,
  bands: { upland?: number; wetMetres?: number; dryMetres?: number; floor?: number; built?: number } = {},
): number {
  if (strength <= 0) return 0;
  const { noise, clear, built } = sampleMask(mask, x, y);
  const mottle = smoothstep(0.42, 0.72, noise) * (bands.upland ?? GREEN.uplandShare);
  const wet = level === undefined
    ? 0
    : 1 - smoothstep(bands.wetMetres ?? GREEN.wetMetres, bands.dryMetres ?? GREEN.dryMetres, z - level);
  const above = level === undefined ? 1 : smoothstep(0, GREEN.aboveWaterMetres, z - level);
  const floor = bands.floor ?? 0;
  const patchy = Math.min(1, mottle + wet * (1 - mottle));
  const cover = floor + (1 - floor) * patchy;
  const town = 1 - (bands.built ?? 0) * built;
  return strength * cover * clear * town * above * smoothstep(GREEN.slope.from, GREEN.slope.to, upness);
}

/**
 * The green one stop of the timeline takes.
 *
 * `ancient` gets the meadow of the First Time and `built` its dry scrub, both
 * patchy over the whole plateau. `stripped` and `today` get the valley's
 * cultivation instead, which is not patchy and is not on the plateau at all:
 * its one term is the height above the river, so it draws the fields between
 * the water and the desert and nothing above them.
 *
 * `Vegetation.tsx` is deliberately not routed through here. It scatters on
 * `GREEN.strength`, which stays zero for the two modern stops, so the
 * cultivated valley is a tint and not sixty thousand savanna tussocks
 * standing in somebody's berseem.
 */
export function greenFor(state: StateId): Omit<GreenOptions, 'mask' | 'level'> {
  if (state === 'today' || state === 'stripped') {
    const { strength, colour, upland, wetMetres, dryMetres } = GREEN.valley;
    return { strength, colour, upland, wetMetres, dryMetres, floor: 0, built: state === 'today' ? 1 : 0 };
  }
  return {
    strength: GREEN.strength[state],
    colour: state === 'built' ? GREEN.dry : GREEN.colour,
    floor: GREEN.floor[state],
  };
}

export interface GreenOptions {
  mask: GreenMask;
  /** The water's surface level in the data frame, or undefined where the stop is dry. */
  level: number | undefined;
  /** The stop's own weight, from `GREEN.strength` or from `GREEN.valley`. */
  strength: number;
  /** What the green is mixed towards: the meadow's colour, the scrub's or the crop's. */
  colour: Vector3;
  /**
   * How much green the noise's patches put on ground that is nowhere near the
   * water. `GREEN.uplandShare` is the savanna's; the cultivated valley passes
   * zero, which leaves the height above the river as the only term and is
   * what makes the fields stop where the desert starts.
   */
  upland?: number;
  /** Where the band above the water starts falling away, and where it is gone. */
  wetMetres?: number;
  dryMetres?: number;
  /**
   * How green the ground is where neither the patches nor the water reach it.
   * The First Time's grassland is continuous, so it passes a high floor and
   * the mottle only says where the grass is richer; the cultivated valley
   * passes none, so the fields end and the desert begins.
   */
  floor?: number;
  /**
   * How much the modern city takes the green off the ground under it, 0 to 1.
   * Only `today` has a city, so only `today` passes one: the other three stops
   * stand on the same ground before it was there.
   */
  built?: number;
}

/**
 * The green's uniforms, one record per material, the same objects for as long
 * as the material lives.
 *
 * Three calls `onBeforeCompile` only when it has to build a program. A patch
 * that changes nothing the program cache key knows about does not make it
 * build one: the material is marked for update, three finds the program it
 * already has, and the uniforms that program was compiled with are the ones it
 * goes on reading. So a patch that made a fresh `{ value }` on every call
 * wrote each stop's green into an object nothing would ever read again, and
 * the ground kept whichever stop it happened to compile under: the plateau
 * drew `built`'s dry scrub in every state and the desert ring the modern
 * valley's cultivation in every state, from the first frame to the last.
 * Found by reading the live uniforms out of the renderer, 2026-09-19.
 *
 * `Atmosphere.ts` is written the other way round, and says why, for exactly
 * this reason. This follows it: the values are written here, outside the
 * patch, and the patch only hands the shader the objects they live in.
 */
interface GreenUniforms {
  greenMask: IUniform;
  greenOrigin: IUniform;
  greenSize: IUniform;
  greenLevel: IUniform;
  greenHasWater: IUniform;
  greenStrength: IUniform;
  greenColour: IUniform;
  greenUpland: IUniform;
  greenWet: IUniform;
  greenDry: IUniform;
  greenFloor: IUniform;
  greenBuilt: IUniform;
}

const GREEN_UNIFORMS = new WeakMap<MeshStandardMaterial, GreenUniforms>();

function greenUniforms(material: MeshStandardMaterial): GreenUniforms {
  const held = GREEN_UNIFORMS.get(material);
  if (held) return held;
  const made: GreenUniforms = {
    greenMask: { value: null },
    greenOrigin: { value: [0, 0] },
    greenSize: { value: 1 },
    greenLevel: { value: 0 },
    greenHasWater: { value: 0 },
    greenStrength: { value: 0 },
    greenColour: { value: GREEN.colour },
    greenUpland: { value: GREEN.uplandShare },
    greenWet: { value: GREEN.wetMetres },
    greenDry: { value: GREEN.dryMetres },
    greenFloor: { value: 0 },
    greenBuilt: { value: 0 },
  };
  GREEN_UNIFORMS.set(material, made);
  return made;
}

/**
 * Lay the green on a ground material.
 *
 * It runs after the stone's own chunk, on `alphamap_fragment`, which is past
 * both `map_fragment` and `color_fragment` and still before anything is lit,
 * so what is tinted is the photographed sand and not the light on it. The
 * height and the slope come out of the geometry here; the patches and the
 * keep-off out of the baked mask, which is the same texture the scatter on
 * the CPU reads.
 */
export function applyGreen(material: MeshStandardMaterial, options: GreenOptions): void {
  const { mask, level, strength, colour } = options;
  const uniforms = greenUniforms(material);
  uniforms.greenMask.value = mask.texture;
  uniforms.greenOrigin.value = [mask.extent.x0, mask.extent.y0];
  uniforms.greenSize.value = mask.extent.size;
  uniforms.greenLevel.value = level ?? 0;
  uniforms.greenHasWater.value = level === undefined ? 0 : 1;
  uniforms.greenStrength.value = strength;
  uniforms.greenColour.value = colour;
  uniforms.greenUpland.value = options.upland ?? GREEN.uplandShare;
  uniforms.greenWet.value = options.wetMetres ?? GREEN.wetMetres;
  uniforms.greenDry.value = options.dryMetres ?? GREEN.dryMetres;
  uniforms.greenFloor.value = options.floor ?? 0;
  uniforms.greenBuilt.value = options.built ?? 0;
  patchMaterial(material, 'green', 'v2', (shader) => {
    for (const [name, uniform] of Object.entries(uniforms)) shader.uniforms[name] = uniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGreenWorld;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvGreenWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = after(
      shader.fragmentShader.replace('#include <common>', `#include <common>\n${GREEN_CHUNK}`),
      'alphamap_fragment',
      '  diffuseColor.rgb = mix(diffuseColor.rgb, greenColour * (0.6 + 0.8 * length(diffuseColor.rgb)), sekedGreen());',
    );
  });
}

/**
 * The mask in GLSL.
 *
 * The world here is three's, +Y up, because this runs on world positions;
 * the mask's own axes are the data frame's east and north, which inside the
 * one rotated group are +X and -Z. The face normal is taken from the
 * derivatives of the world position rather than from the interpolated normal,
 * for the same reason the stone takes it that way: it is right on a grid
 * whose normals are smoothed across every cell.
 */
const GREEN_CHUNK = `
varying vec3 vGreenWorld;
uniform sampler2D greenMask;
uniform vec2 greenOrigin;
uniform float greenSize;
uniform float greenLevel;
uniform float greenHasWater;
uniform float greenStrength;
uniform vec3 greenColour;
uniform float greenUpland;
uniform float greenWet;
uniform float greenDry;
uniform float greenFloor;
uniform float greenBuilt;

float sekedGreen() {
  if (greenStrength <= 0.0) return 0.0;
  vec2 onGround = vec2(vGreenWorld.x, -vGreenWorld.z);
  vec2 uv = (onGround - greenOrigin) / greenSize;
  vec4 baked = texture2D(greenMask, uv);
  // The upland's term is mottle on both sides of the mask, because patch is
  // a reserved word in GLSL ES.
  float mottle = smoothstep(0.42, 0.72, baked.r) * greenUpland;
  float wet = greenHasWater * (1.0 - smoothstep(greenWet, greenDry, vGreenWorld.y - greenLevel));
  // The floor is how green the ground is where neither term reaches it: the
  // grassland of the First Time is continuous and only richer in its patches,
  // while the cultivated valley has none, which is what keeps the desert
  // desert on either side of the fields.
  float cover = greenFloor + (1.0 - greenFloor) * min(1.0, mottle + wet * (1.0 - mottle));
  float above = mix(1.0, smoothstep(0.0, ${GREEN.aboveWaterMetres.toFixed(2)}, vGreenWorld.y - greenLevel), greenHasWater);
  vec3 face = normalize(cross(dFdx(vGreenWorld), dFdy(vGreenWorld)));
  float upness = abs(face.y);
  float slope = smoothstep(${GREEN.slope.from.toFixed(2)}, ${GREEN.slope.to.toFixed(2)}, upness);
  // Nothing grows through a town: the blue channel is how built up the ground
  // is now, and only the stop that has a city weighs it.
  float town = 1.0 - greenBuilt * baked.b;
  return greenStrength * cover * baked.g * town * above * slope;
}
`;
