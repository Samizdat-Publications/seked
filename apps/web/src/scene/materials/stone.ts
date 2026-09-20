/**
 * The photographed stone, and the relief that makes it stone rather than a
 * picture of stone.
 *
 * The same CC0 Poly Haven sets the Blender renders use, laid on by world
 * position from three sides at once and blended by the face's own normal,
 * because the meshes carry no UVs. That is the box projection the renders
 * use. What is new here is the other two maps: the normal, which is what a
 * course of blocks needs to read as blocks under a raking sun, and the
 * roughness, which is what keeps a dressed face from looking like the same
 * plastic as a broken one.
 *
 * Each set is sampled twice, at its real tile size and at twenty-three times
 * it. The viewer is mostly seen from hundreds of metres, where a two-metre
 * tile has mipmapped down to its own average and shows nothing; the far
 * sample's light and dark patches read as weathering across a whole face, and
 * the fine one comes up as the camera closes in.
 *
 * Nothing in this file is a measurement. The tile sizes are the Poly Haven
 * API's own statement of how large each photograph is on the ground; the
 * strengths, the scales and the noises are look choices. The one number from
 * the database is the course height a caller may pass, which is what the
 * joint lines on a dressed face are spaced by.
 *
 * `scripts/web-textures.py` writes the maps and their index into
 * public/textures/. Where it has not been run, or a map fails to load, a
 * material keeps its flat colour.
 */
import { useEffect, useState } from 'react';
import {
  LinearSRGBColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type MeshStandardMaterial,
  type Texture,
} from 'three';
import { useView } from '../../store';
import { patchMaterial } from './patch';

export type StoneRole = 'core' | 'casing' | 'sand' | 'gravel' | 'granite' | 'bedrock';

interface StoneEntry {
  file: string;
  maps?: { colour: string; normal?: string; roughness?: string };
  tileMetres: number;
  meanLinear: number;
  attribution: string;
}

export interface Stone {
  colour: Texture;
  /** The OpenGL-convention normal map, where the set has one. */
  normal: Texture | undefined;
  /** The roughness, as a single channel in a grey image, where the set has one. */
  roughness: Texture | undefined;
  tileMetres: number;
  /** The colour map's mean luminance in linear light, what the photograph is taken about. */
  meanLinear: number;
  attribution: string;
}

let index: Promise<Record<string, StoneEntry> | undefined> | undefined;
const loaded = new Map<StoneRole, Promise<Stone | undefined>>();

function stoneIndex(): Promise<Record<string, StoneEntry> | undefined> {
  index ??= fetch(`${import.meta.env.BASE_URL}textures/index.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, StoneEntry>>) : undefined))
    .catch(() => undefined);
  return index;
}

/** One map, wrapped and in the right colour space. Data maps are never sRGB. */
function loadMap(file: string, data: boolean): Promise<Texture | undefined> {
  return new Promise((resolve) => {
    new TextureLoader().load(
      `${import.meta.env.BASE_URL}textures/${file}`,
      (texture) => {
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.colorSpace = data ? LinearSRGBColorSpace : SRGBColorSpace;
        texture.anisotropy = 8;
        resolve(texture);
      },
      undefined,
      () => resolve(undefined),
    );
  });
}

function loadStone(role: StoneRole): Promise<Stone | undefined> {
  let promise = loaded.get(role);
  if (!promise) {
    // A set of maps is several megabytes on a cold cache, which is most of the
    // fifteen seconds before the plateau has its surfaces. The caption says so
    // while it happens rather than leaving a reader with flat grey stone and
    // no reason for it.
    useView.getState().setLoading(`stone:${role}`, true);
    promise = stoneIndex().then(async (entries) => {
      const entry = entries?.[role];
      if (!entry) return undefined;
      const maps = entry.maps ?? { colour: entry.file };
      const [colour, normal, roughness] = await Promise.all([
        loadMap(maps.colour, false),
        maps.normal ? loadMap(maps.normal, true) : Promise.resolve(undefined),
        maps.roughness ? loadMap(maps.roughness, true) : Promise.resolve(undefined),
      ]);
      if (!colour) return undefined;
      return { colour, normal, roughness, tileMetres: entry.tileMetres, meanLinear: entry.meanLinear, attribution: entry.attribution };
    }).finally(() => useView.getState().setLoading(`stone:${role}`, false));
    loaded.set(role, promise);
  }
  return promise;
}

/** A role's stone once it has loaded, or undefined while it loads or if it never will. */
export function useStone(role: StoneRole): Stone | undefined {
  const [stone, setStone] = useState<Stone | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void loadStone(role).then((s) => {
      if (live) setStone(s);
    });
    return () => {
      live = false;
    };
  }, [role]);
  return stone;
}

export interface StoneOptions {
  /** How far the photograph shows through the material's own tint: 1 the photograph alone, 0 the flat colour. */
  strength: number;
  /** A multiplier on the set's real tile size, for a surface seen from further off. */
  scale?: number;
  /** How far the normal map bends the surface. 0 leaves the geometry's own normal. */
  relief?: number;
  /**
   * Metres of a block, for the block-to-block tone variation that makes a
   * course read as courses rather than as a stripe. Horizontal is a look
   * choice; vertical is the course height, which comes from the database.
   * Zero for a surface that is not coursed.
   */
  block?: { length: number; height: number };
  /**
   * Metres between the joint lines on a dressed face, which is the course
   * height from the database. Zero for a face with no joints to draw.
   */
  course?: number;
  /** A second set mixed in by a large noise, as the render mixes gravel into sand. */
  mix?: Stone | undefined;
  /** Metres of that noise's patches. A look choice. */
  mixMetres?: number;
  /**
   * How far the bodies of a merged field are allowed to differ in tone, as a
   * share either side of their shared colour. Zero, the default, leaves them
   * identical, which is what every single-body mesh wants.
   *
   * This reads the `sekedTone` attribute `mergeMeshes` writes, one number per
   * body, so it does nothing on a mesh that has none. The mastaba field is
   * what it exists for: 577 tombs in one buffer, in all eleven shots of the
   * walkthrough, sharing a single tone and reading as a pale carpet rather
   * than a cemetery (docs/shot-list.md). Limestone quarried at different
   * times and weathered for four thousand years does not come out one colour;
   * how far apart is a look choice and this number measures nothing.
   */
  bodyTone?: number;
}

/**
 * Patch a standard material to take its colour, its relief and its roughness
 * from `stone` by triplanar projection, the material's own colour acting as a
 * tint over the photograph.
 *
 * Composes with the cascaded shadow maps and with the air through
 * `patchMaterial`, which owns the one `onBeforeCompile` a material has.
 */
export function applyStone(material: MeshStandardMaterial, stone: Stone | undefined, options: StoneOptions): void {
  if (!stone) return;
  const { strength, scale = 1, relief = 1, block, course = 0, mix, mixMetres = 90, bodyTone = 0 } = options;
  const tile = stone.tileMetres * scale;
  const hasNormal = Boolean(stone.normal) && relief > 0;
  const hasRough = Boolean(stone.roughness);
  const hasMix = Boolean(mix);
  const hasBlock = Boolean(block);
  const hasCourse = course > 0;
  const hasBodyTone = bodyTone > 0;
  // What the program is compiled from, as against what a uniform can change.
  const key = [
    tile,
    hasNormal ? 'n' : '',
    hasRough ? 'r' : '',
    hasMix ? 'm' : '',
    hasBlock ? 'b' : '',
    hasCourse ? 'c' : '',
    hasBodyTone ? 't' : '',
  ].join(':');

  patchMaterial(material, 'stone', key, (shader) => {
    shader.uniforms.stoneMap = { value: stone.colour };
    shader.uniforms.stoneTile = { value: tile };
    shader.uniforms.stoneStrength = { value: strength };
    shader.uniforms.stoneMean = { value: Math.max(stone.meanLinear, 0.01) };
    if (hasNormal) {
      shader.uniforms.stoneNormalMap = { value: stone.normal };
      shader.uniforms.stoneRelief = { value: relief };
    }
    if (hasRough) shader.uniforms.stoneRoughMap = { value: stone.roughness };
    if (hasMix && mix) {
      shader.uniforms.stoneMixMap = { value: mix.colour };
      shader.uniforms.stoneMixTile = { value: mix.tileMetres * scale };
      shader.uniforms.stoneMixMean = { value: Math.max(mix.meanLinear, 0.01) };
      shader.uniforms.stoneMixMetres = { value: mixMetres };
    }
    if (hasBlock && block) shader.uniforms.stoneBlock = { value: [block.length, block.height] };
    if (hasCourse) shader.uniforms.stoneCourse = { value: course };
    if (hasBodyTone) shader.uniforms.stoneBodyTone = { value: bodyTone };

    const defines = [
      hasNormal ? '#define SEKED_STONE_NORMAL' : '',
      hasRough ? '#define SEKED_STONE_ROUGH' : '',
      hasMix ? '#define SEKED_STONE_MIX' : '',
      hasBlock ? '#define SEKED_STONE_BLOCK' : '',
      hasCourse ? '#define SEKED_STONE_COURSE' : '',
      hasBodyTone ? '#define SEKED_STONE_BODY_TONE' : '',
    ].filter(Boolean).join('\n');

    // The defines go into the vertex shader too, because the body tone's
    // attribute and varying are declared there and a material without one
    // must not ask for `sekedTone` that no geometry supplies.
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\n${defines}\nvarying vec3 vStoneWorld;\n#ifdef SEKED_STONE_BODY_TONE\nattribute float sekedTone;\nvarying float vStoneBody;\n#endif`,
      )
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvStoneWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#ifdef SEKED_STONE_BODY_TONE\nvStoneBody = sekedTone;\n#endif',
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${defines}\n${STONE_CHUNK}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${COLOUR_FRAGMENT}`);
    if (hasRough) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>\n  roughnessFactor *= sekedStoneRough();`,
      );
    }
    if (hasNormal) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>\n  normal = sekedStoneNormal(normal);`,
      );
    }
  });
}

/**
 * The whole of the stone, in GLSL.
 *
 * `sekedStoneWeights` is the box projection's blend, taken from the face's
 * own normal rather than from an interpolated one, so it is right on a
 * flat-shaded mesh with no normals worth the name.
 *
 * The normal blend is the whiteout blend: each plane's tangent normal is
 * swung into world space by adding the face normal's own components, which
 * keeps a detail that runs across a corner from flipping. The result is put
 * back into view space with the view matrix, because that is the space three
 * lights in.
 *
 * The block variation is a hash of which cell of the coursing a fragment
 * falls in, worth a few percent of tone either way. That is what makes a
 * stepped core read as blocks and not as a striped cone, and it is the same
 * thing `render_materials.wire_core` does with its block cells.
 */
const STONE_CHUNK = `
varying vec3 vStoneWorld;
#ifdef SEKED_STONE_BODY_TONE
uniform float stoneBodyTone;
varying float vStoneBody;
#endif
uniform sampler2D stoneMap;
uniform float stoneTile;
uniform float stoneStrength;
uniform float stoneMean;
#ifdef SEKED_STONE_NORMAL
uniform sampler2D stoneNormalMap;
uniform float stoneRelief;
#endif
#ifdef SEKED_STONE_ROUGH
uniform sampler2D stoneRoughMap;
#endif
#ifdef SEKED_STONE_MIX
uniform sampler2D stoneMixMap;
uniform float stoneMixTile;
uniform float stoneMixMean;
uniform float stoneMixMetres;
#endif
#ifdef SEKED_STONE_BLOCK
uniform vec2 stoneBlock;
#endif
#ifdef SEKED_STONE_COURSE
uniform float stoneCourse;
#endif

vec3 sekedStoneFace() {
  return normalize(cross(dFdx(vStoneWorld), dFdy(vStoneWorld)));
}

vec3 sekedStoneWeights(vec3 faceNormal) {
  vec3 w = pow(abs(faceNormal), vec3(4.0));
  return w / max(w.x + w.y + w.z, 1e-5);
}

/*
 * The photograph on three planes at once, blended by the face's own normal.
 *
 * The x plane reads p.zy and not p.yz, which is the whole of a fault found on
 * 2026-09-19 and worth writing down. The world here is three's, so y is up and
 * z is minus north. p.yz puts up on the texture's own horizontal axis, which
 * turns the photograph a quarter turn on every face whose normal is east or
 * west, while the z plane's p.xy leaves it upright on every face that looks
 * north or south. For an isotropic photograph that is invisible. granite_wall
 * is not isotropic: it is a coursed wall, and the first red granite the valley
 * temple ever wore had its courses running from the ground to the roof, so the
 * building read as varnished planking. The normal map below had it right all
 * along, sampling p.zy, so the colour and the relief were disagreeing about
 * which way the stone was laid.
 */
vec3 sekedTriplanar(sampler2D map, vec3 p, vec3 w, float tile) {
  return texture2D(map, p.zy / tile).rgb * w.x
       + texture2D(map, p.xz / tile).rgb * w.y
       + texture2D(map, p.xy / tile).rgb * w.z;
}

float sekedHash(vec3 cell) {
  return fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

/** Smooth value noise on the world position, for patches metres across. */
float sekedPatches(vec3 p, float metres) {
  vec3 q = p / max(metres, 1e-3);
  vec3 cell = floor(q);
  vec3 f = q - cell;
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(sekedHash(cell + vec3(0.0, 0.0, 0.0)), sekedHash(cell + vec3(1.0, 0.0, 0.0)), f.x);
  float b = mix(sekedHash(cell + vec3(0.0, 1.0, 0.0)), sekedHash(cell + vec3(1.0, 1.0, 0.0)), f.x);
  float c = mix(sekedHash(cell + vec3(0.0, 0.0, 1.0)), sekedHash(cell + vec3(1.0, 0.0, 1.0)), f.x);
  float d = mix(sekedHash(cell + vec3(0.0, 1.0, 1.0)), sekedHash(cell + vec3(1.0, 1.0, 1.0)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}

/** The photograph, taken about its own mean so it adds grain and not a tone. */
vec3 sekedStonePhoto(sampler2D map, float tile, float mean) {
  vec3 p = vStoneWorld;
  vec3 w = sekedStoneWeights(sekedStoneFace());
  vec3 near = sekedTriplanar(map, p, w, tile);
  vec3 far = sekedTriplanar(map, p + vec3(0.31, 0.17, 0.53), w, tile * 23.0);
  float closeness = clamp(1.0 - length(p - cameraPosition) / 250.0, 0.0, 1.0);
  return mix(far, near * far / mean, closeness * 0.8) / mean;
}

#ifdef SEKED_STONE_ROUGH
float sekedStoneRough() {
  vec3 p = vStoneWorld;
  vec3 w = sekedStoneWeights(sekedStoneFace());
  // The map's own mid grey is taken as no change, so a material keeps the
  // roughness it was given and the photograph only moves it about.
  float r = sekedTriplanar(stoneRoughMap, p, w, stoneTile).r;
  return mix(1.0, 0.6 + r * 0.8, 0.8);
}
#endif

#ifdef SEKED_STONE_NORMAL
vec3 sekedStoneNormal(vec3 viewNormal) {
  vec3 p = vStoneWorld;
  vec3 face = sekedStoneFace();
  vec3 w = sekedStoneWeights(face);
  vec3 tx = texture2D(stoneNormalMap, p.zy / stoneTile).xyz * 2.0 - 1.0;
  vec3 ty = texture2D(stoneNormalMap, p.xz / stoneTile).xyz * 2.0 - 1.0;
  vec3 tz = texture2D(stoneNormalMap, p.xy / stoneTile).xyz * 2.0 - 1.0;
  // The whiteout blend: swing each plane's tangent normal into world space by
  // adding the face normal, so a detail crossing a corner does not flip.
  tx = vec3(tx.xy + face.zy, abs(tx.z) * face.x);
  ty = vec3(ty.xy + face.xz, abs(ty.z) * face.y);
  tz = vec3(tz.xy + face.xy, abs(tz.z) * face.z);
  vec3 world = normalize(tx.zyx * w.x + ty.xzy * w.y + tz.xyz * w.z);
  vec3 bent = normalize(mat3(viewMatrix) * world);
  return normalize(mix(viewNormal, bent, clamp(stoneRelief, 0.0, 1.0)));
}
#endif
`;

/**
 * The colour, which is the photograph over the material's own tint, plus the
 * two things that are about masonry rather than about stone: a second set
 * mixed in by large patches, as the render mixes gravel into sand, and a
 * tone per block of the coursing, which is what makes a stepped core read as
 * blocks. The joint line is a narrow darkening at each course top, the
 * course height being the database's own.
 */
const COLOUR_FRAGMENT = `
{
  vec3 photo = sekedStonePhoto(stoneMap, stoneTile, stoneMean);
#ifdef SEKED_STONE_MIX
  float patches = smoothstep(0.35, 0.65, sekedPatches(vStoneWorld, stoneMixMetres));
  photo = mix(photo, sekedStonePhoto(stoneMixMap, stoneMixTile, stoneMixMean), patches);
#endif
#ifdef SEKED_STONE_BLOCK
  vec3 cell = floor(vec3(vStoneWorld.x / stoneBlock.x, vStoneWorld.y / stoneBlock.x, vStoneWorld.z / stoneBlock.y));
  photo *= 0.88 + 0.24 * sekedHash(cell);
#endif
#ifdef SEKED_STONE_COURSE
  float fromTop = abs(fract(vStoneWorld.z / stoneCourse + 0.5) - 0.5) * stoneCourse;
  photo *= mix(0.82, 1.0, smoothstep(0.0, 0.06, fromTop));
#endif
#ifdef SEKED_STONE_BODY_TONE
  // One tone for the whole body, from the attribute the merge wrote, so a
  // tomb differs from its neighbour and never from itself.
  photo *= 1.0 + stoneBodyTone * (vStoneBody - 0.5) * 2.0;
#endif
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * photo, stoneStrength);
}
`;
