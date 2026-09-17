/**
 * The air between the camera and the monument.
 *
 * A flat fog is a curtain: it hides a far pyramid instead of putting it
 * behind something. What the Blender renders have and the viewer did not is
 * aerial perspective, which does two things at once. Light on its way to the
 * eye is scattered out of the ray, so a distant face loses contrast and its
 * blacks lift; and light from the sky is scattered into the ray, so what is
 * left takes the colour of the air, warm near the sun and blue away from it.
 * Put together, Menkaure a kilometre and a half off sits back in the picture
 * rather than ending at a fog line, and the ground dissolves into the horizon
 * instead of stopping at the edge of the terrain tile.
 *
 * The air is denser low down, which is why a range of hills is paler at its
 * feet than at its summit. That is an exponential falling off with height,
 * integrated along the ray in closed form, which costs a handful of
 * instructions and is the whole of the model.
 *
 * Every number here is a look choice. The only quantity from outside is the
 * sun's direction and altitude, which come from `@seked/sky`.
 */
import { useEffect } from 'react';
import { Color, Vector3, type IUniform, type Material } from 'three';
import { patchMaterial } from './materials/patch';
import { nightness, type Sun } from './Sky';

/**
 * The uniforms every patched material shares. They are the same objects in
 * every shader, so one write a frame reaches the whole scene and nothing has
 * to keep a list of materials.
 */
const AIR: Record<string, IUniform> = {
  /** Toward the sun, world frame, unit. */
  airSun: { value: new Vector3(0, 1, 0) },
  /** What the air glows near the sun's own direction. */
  airSunColour: { value: new Color('#e9b784') },
  /** What it glows everywhere else. */
  airSkyColour: { value: new Color('#9fb6cf') },
  /** Extinction per metre at the datum, which is the Great Pyramid's base. */
  airDensity: { value: 0 },
  /** Metres over which the air thins to a third: the scale height. */
  airScaleHeight: { value: 800 },
};

/**
 * Look choices, carried across from `blender/render_sky.py`, which gives the
 * plateau a haze volume of 2e-4 per metre and scales it per view. Density
 * here is per metre at the datum: at 1.2e-4 a face 1,500 m off has lost about
 * a sixth of its contrast, which is roughly what the panorama shows across
 * the same distance. The render's separate dust layer, which pools in the
 * first forty metres above the ground, is not modelled here yet.
 */
const LOOK = {
  density: 1.2e-4,
  /** Dawn and dusk are hazier, which is when the renders look best. */
  lowSunDensity: 2.6e-4,
  /** At night the air stops carrying light and only takes it away. */
  nightDensity: 0.5e-4,
  scaleHeight: 700,
  sun: { high: new Color('#dfe6ee'), low: new Color('#e8a163') },
  sky: { high: new Color('#9db9d8'), low: new Color('#b7a48f'), night: new Color('#1b2740') },
} as const;

const scratch = new Color();

/**
 * Point the air at the sun and set its colours from the sun's altitude. Call
 * it once where the sun is known; every patched material follows.
 */
export function setAtmosphere(sun: Sun): void {
  const night = nightness(sun.altitudeDeg);
  // 1 with the sun on the horizon, 0 with it high: the same shape the sky's
  // own turbidity ramp has, and the reason dusk is the hazy hour.
  const low = Math.min(1, Math.max(0, (18 - sun.altitudeDeg) / 24));
  (AIR.airSun!.value as Vector3).copy(sun.direction);
  (AIR.airSunColour!.value as Color).copy(scratch.lerpColors(LOOK.sun.high, LOOK.sun.low, low)).lerp(LOOK.sky.night, night);
  (AIR.airSkyColour!.value as Color).copy(scratch.lerpColors(LOOK.sky.high, LOOK.sky.low, low)).lerp(LOOK.sky.night, night);
  const day = LOOK.density + (LOOK.lowSunDensity - LOOK.density) * low;
  AIR.airDensity!.value = day + (LOOK.nightDensity - day) * night;
  AIR.airScaleHeight!.value = LOOK.scaleHeight;
}

/** The same, as a hook, for a component that has the sun as a prop. */
export function useAtmosphere(sun: Sun): void {
  useEffect(() => setAtmosphere(sun), [sun]);
}

/**
 * Put the air on a material. Composes with the triplanar stone and with the
 * cascaded shadow maps through `patchMaterial`, which owns the one
 * `onBeforeCompile` a material has.
 *
 * The patch runs after `opaque_fragment`, where the lit colour is in
 * `gl_FragColor` and still in linear light, and before the colour space
 * conversion, which is where scattering belongs: mixing a fog in after a
 * transfer function is what makes a sky band.
 */
export function applyAtmosphere(material: Material): void {
  patchMaterial(material, 'air', 'v1', (shader) => {
    for (const [name, uniform] of Object.entries(AIR)) shader.uniforms[name] = uniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAirWorld;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvAirWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${AIR_CHUNK}`)
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  gl_FragColor.rgb = sekedAir(gl_FragColor.rgb, vAirWorld);');
  });
}

/**
 * The model, in GLSL.
 *
 * The optical depth along a ray between two heights, for air whose density
 * falls off as exp(-z/H), has a closed form: the path length times H times
 * the difference of the two exponentials, over the height difference. When
 * the two heights are within a hair of each other the expression is 0/0, so
 * the flat-air case is taken instead.
 *
 * The in-scattered colour is the sky's, swinging to the sun's own colour as
 * the ray points at it. The fourth power is a cheap forward-scattering lobe,
 * not Henyey-Greenstein: what it has to do is make the air glow around a low
 * sun, and it does.
 *
 * The world's up here is three's, +Y, because this runs on world positions
 * and not on the data frame.
 */
const AIR_CHUNK = `
varying vec3 vAirWorld;
uniform vec3 airSun;
uniform vec3 airSunColour;
uniform vec3 airSkyColour;
uniform float airDensity;
uniform float airScaleHeight;

float sekedOpticalDepth(float fromY, float toY, float distance) {
  float scale = max(airScaleHeight, 1.0);
  float drop = toY - fromY;
  float near = exp(-fromY / scale);
  if (abs(drop) < 1.0) return airDensity * distance * near;
  return airDensity * distance * scale * (near - exp(-toY / scale)) / drop;
}

vec3 sekedAir(vec3 colour, vec3 world) {
  vec3 ray = world - cameraPosition;
  float distance = length(ray);
  if (distance < 1e-3 || airDensity <= 0.0) return colour;
  vec3 direction = ray / distance;
  float transmittance = exp(-sekedOpticalDepth(cameraPosition.y, world.y, distance));
  float towardSun = max(dot(direction, normalize(airSun)), 0.0);
  vec3 inscatter = mix(airSkyColour, airSunColour, pow(towardSun, 4.0) * 0.8);
  return colour * transmittance + inscatter * (1.0 - transmittance);
}
`;
