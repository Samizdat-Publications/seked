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
  strength: { ancient: 1, built: 0.22, stripped: 0, today: 0 } as Record<StateId, number>,
  colour: new Vector3(0.34, 0.41, 0.18),
  dry: new Vector3(0.45, 0.42, 0.26),
  aboveWaterMetres: 1.2,
  wetMetres: 8,
  dryMetres: 55,
  uplandShare: 0.7,
  slope: { from: 0.55, to: 0.85 },
  keepOffMetres: 15,
  noiseMetres: 260,
  maskPixels: 512,
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
export function buildGreenMask(features: readonly Footprint[], extent: MaskExtent): GreenMask {
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
 * The mask for the plateau's own grid, built once the footprints have loaded
 * and kept for as long as the extent is the same one. Both the ground and the
 * vegetation call it, and both get the same object, because the footprints
 * are fetched once and the bake is memoised on the extent it covers.
 */
let baked: { key: string; mask: GreenMask } | undefined;

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
    void loadFootprints().then((features) => {
      const key = extentKey(extent);
      baked ??= { key, mask: buildGreenMask(features, extent) };
      if (baked.key !== key) baked = { key, mask: buildGreenMask(features, extent) };
      if (alive) setMask(baked.mask);
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
  return baked && baked.key === extentKey(extent) ? baked.mask : undefined;
}

/** The baked noise and keep-off at a place on the ground, as the shader reads them. */
export function sampleMask(mask: GreenMask, x: number, y: number): { noise: number; clear: number } {
  const n = GREEN.maskPixels;
  const metresPerTexel = mask.extent.size / n;
  const i = Math.min(n - 1, Math.max(0, Math.floor((x - mask.extent.x0) / metresPerTexel)));
  const j = Math.min(n - 1, Math.max(0, Math.floor((y - mask.extent.y0) / metresPerTexel)));
  const p = (j * n + i) * 4;
  return { noise: (mask.data[p] as number) / 255, clear: (mask.data[p + 1] as number) / 255 };
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
): number {
  if (strength <= 0) return 0;
  const { noise, clear } = sampleMask(mask, x, y);
  const mottle = smoothstep(0.42, 0.72, noise) * GREEN.uplandShare;
  const wet = level === undefined
    ? 0
    : 1 - smoothstep(GREEN.wetMetres, GREEN.dryMetres, z - level);
  const above = level === undefined ? 1 : smoothstep(0, GREEN.aboveWaterMetres, z - level);
  const cover = Math.min(1, mottle + wet * (1 - mottle));
  return strength * cover * clear * above * smoothstep(GREEN.slope.from, GREEN.slope.to, upness);
}

export interface GreenOptions {
  mask: GreenMask;
  /** The water's surface level in the data frame, or undefined where the stop is dry. */
  level: number | undefined;
  /** The stop's own weight, from `GREEN.strength`. */
  strength: number;
  /** What the green is mixed towards: the meadow's colour or the scrub's. */
  colour: Vector3;
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
  patchMaterial(material, 'green', 'v1', (shader) => {
    shader.uniforms.greenMask = { value: mask.texture };
    shader.uniforms.greenOrigin = { value: [mask.extent.x0, mask.extent.y0] };
    shader.uniforms.greenSize = { value: mask.extent.size };
    shader.uniforms.greenLevel = { value: level ?? 0 };
    shader.uniforms.greenHasWater = { value: level === undefined ? 0 : 1 };
    shader.uniforms.greenStrength = { value: strength };
    shader.uniforms.greenColour = { value: colour };
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

float sekedGreen() {
  if (greenStrength <= 0.0) return 0.0;
  vec2 onGround = vec2(vGreenWorld.x, -vGreenWorld.z);
  vec2 uv = (onGround - greenOrigin) / greenSize;
  vec4 baked = texture2D(greenMask, uv);
  // The upland's term is mottle on both sides of the mask, because patch is
  // a reserved word in GLSL ES.
  float mottle = smoothstep(0.42, 0.72, baked.r) * ${GREEN.uplandShare.toFixed(3)};
  float wet = greenHasWater * (1.0 - smoothstep(${GREEN.wetMetres.toFixed(1)}, ${GREEN.dryMetres.toFixed(1)}, vGreenWorld.y - greenLevel));
  float cover = min(1.0, mottle + wet * (1.0 - mottle));
  float above = mix(1.0, smoothstep(0.0, ${GREEN.aboveWaterMetres.toFixed(2)}, vGreenWorld.y - greenLevel), greenHasWater);
  vec3 face = normalize(cross(dFdx(vGreenWorld), dFdy(vGreenWorld)));
  float upness = abs(face.y);
  float slope = smoothstep(${GREEN.slope.from.toFixed(2)}, ${GREEN.slope.to.toFixed(2)}, upness);
  return greenStrength * cover * baked.g * above * slope;
}
`;
