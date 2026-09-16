import { useEffect, useState } from 'react';
import { RepeatWrapping, SRGBColorSpace, TextureLoader, type MeshStandardMaterial, type Texture } from 'three';

/**
 * The same CC0 stone the Blender renders use, for the viewer. The meshes carry
 * no UVs, so a texture is laid on by world position from three sides at once
 * and blended by the face's own normal, which is the box projection the
 * renders use. It is sampled at twenty-three times the set's real tile
 * size, so its patches read as weathering from the distances the viewer is
 * mostly seen at, and at the real size as the camera comes within a few
 * hundred metres. None of this is a measurement.
 *
 * `scripts/web-textures.py` writes the maps and their index into
 * public/textures/. Where it has not been run, or a map fails to load, a
 * material keeps its flat colour.
 */

export type StoneRole = 'core' | 'casing' | 'sand' | 'gravel';

interface StoneEntry {
  file: string;
  tileMetres: number;
  meanLinear: number;
  attribution: string;
}

export interface Stone {
  texture: Texture;
  tileMetres: number;
  /** The map's mean luminance in linear light, what the photograph is taken about. */
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

function loadStone(role: StoneRole): Promise<Stone | undefined> {
  let promise = loaded.get(role);
  if (!promise) {
    promise = stoneIndex().then(
      (entries) =>
        new Promise<Stone | undefined>((resolve) => {
          const entry = entries?.[role];
          if (!entry) return resolve(undefined);
          new TextureLoader().load(
            `${import.meta.env.BASE_URL}textures/${entry.file}`,
            (texture) => {
              texture.wrapS = RepeatWrapping;
              texture.wrapT = RepeatWrapping;
              texture.colorSpace = SRGBColorSpace;
              texture.anisotropy = 8;
              resolve({ texture, tileMetres: entry.tileMetres, meanLinear: entry.meanLinear, attribution: entry.attribution });
            },
            undefined,
            () => resolve(undefined),
          );
        }),
    );
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

/**
 * Patch a standard material to take its colour from `stone` by triplanar
 * projection, the material's own colour acting as a tint over it. `strength`
 * is how far the photograph shows through the tint: 1 is the photograph
 * alone, 0 the flat colour.
 */
export function applyStone(material: MeshStandardMaterial, stone: Stone | undefined, strength: number, scale = 1): void {
  if (!stone) return;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.stoneMap = { value: stone.texture };
    shader.uniforms.stoneTile = { value: stone.tileMetres * scale };
    shader.uniforms.stoneStrength = { value: strength };
    shader.uniforms.stoneMean = { value: Math.max(stone.meanLinear, 0.01) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStoneWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvStoneWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vStoneWorld;
uniform sampler2D stoneMap;
uniform float stoneTile;
uniform float stoneStrength;
uniform float stoneMean;
vec3 stoneTriplanar(vec3 p, vec3 w, float tile) {
  return texture2D(stoneMap, p.yz / tile).rgb * w.x + texture2D(stoneMap, p.xz / tile).rgb * w.y + texture2D(stoneMap, p.xy / tile).rgb * w.z;
}`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
{
  vec3 faceNormal = normalize(cross(dFdx(vStoneWorld), dFdy(vStoneWorld)));
  vec3 w = pow(abs(faceNormal), vec3(4.0));
  w /= max(w.x + w.y + w.z, 1e-5);
  vec3 near = stoneTriplanar(vStoneWorld, w, stoneTile);
  // The viewer is mostly seen from hundreds of metres, where a two-metre tile
  // mipmaps down to its own average and shows nothing. So the same photograph
  // is also laid at twenty-three times its size, where its light and dark
  // patches read as weathering across a whole face, and the fine sample only
  // shows through as the camera comes close.
  vec3 far = stoneTriplanar(vStoneWorld + vec3(0.31, 0.17, 0.53), w, stoneTile * 23.0);
  float closeness = clamp(1.0 - length(vStoneWorld - cameraPosition) / 250.0, 0.0, 1.0);
  vec3 photo = mix(far, near * far / stoneMean, closeness * 0.8);
  // The photograph taken about its typical brightness, so the tint keeps the
  // material's own tone and the photograph adds only its grain and variation.
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * photo / stoneMean, stoneStrength);
}`,
      );
  };
  material.customProgramCacheKey = () => `stone:${stone.tileMetres * scale}:${strength}`;
  material.needsUpdate = true;
}
