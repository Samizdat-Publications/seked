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
import { useView } from '../store';
import type { StateId } from '../view';
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
  /** What the low dust glows, which is warmer than either. */
  airDustColour: { value: new Color('#e8c79a') },
  /** Extinction per metre at the datum, which is the Great Pyramid's base. */
  airDensity: { value: 0 },
  /** Metres over which the air thins to a third: the scale height. */
  airScaleHeight: { value: 800 },
  /** Extinction per metre inside the dust layer, which is nothing at noon. */
  airDustDensity: { value: 0 },
  /** Metres above the datum the dust holds full strength to. */
  airDustBase: { value: 15 },
  /** And the metres it thins to a third over above that. */
  airDustScale: { value: 28 },
  /** The height at and below which a camera sees `airDustLowShare` of the dust. */
  airDustLowStand: { value: 10 },
  /** And the height at which it sees all of it. */
  airDustHighStand: { value: 100 },
  /** What a camera standing in the dust sees of it. */
  airDustLowShare: { value: 1 },
};

/**
 * Look choices, carried across from `blender/render_sky.py`, which gives the
 * plateau a haze volume and a separate dust layer and scales both per view.
 *
 * Density here is per metre at the datum. Stage 1 set it at 1.2e-4, which
 * reads right along the panorama's kilometre and a half and washes the
 * foreground from a stand 260 m up, where the ray is short and steep and
 * ought to be clear. Both come down by about a third and the scale height
 * comes down with them, from 700 m to 500, so that climbing buys clarity
 * faster: that is the shape of the fault, not its size.
 *
 * What the foreground lost by that is given back by the dust, which is the
 * render's second volume and was not modelled here at all: 6e-4 per metre
 * from 15 m above the datum, thinning to a third by 43 m, in a warm sand
 * colour. It is strongest at dawn and dusk, when the ground has given up its
 * heat and nothing is lifting it, and gone by noon; and it is what puts a
 * causeway in front of a mastaba field instead of level with it.
 */
const LOOK = {
  density: 0.8e-4,
  /** Dawn and dusk are hazier, which is when the renders look best. */
  lowSunDensity: 1.75e-4,
  /** At night the air stops carrying light and only takes it away. */
  nightDensity: 0.35e-4,
  scaleHeight: 500,
  dust: {
    /**
     * Per metre inside the layer at dawn and dusk. The render's own is 6e-4,
     * but the render's camera stands in it and this one often looks down
     * through it from above: at 4e-4 the Eastern Cemetery went to a smear from
     * the Sphinx's stand, which is the fault this task exists to fix.
     */
    density: 1.3e-4,
    base: 15,
    scaleHeight: 28,
    /**
     * And what a stand low down sees of that, which is less than a stand above
     * it. Look choices, all three.
     *
     * The density above is right at dawn, where the renders were set, and at
     * the akhet moment it doubles up with the horizon's own brightness: the
     * sun is on the horizon, every ray from a low stand runs the length of the
     * dust layer rather than down through it, and the layer is glowing in the
     * sun's own colour along the one direction the camera is pointed. The
     * closed-form integral is not wrong about that. What is wrong is the
     * density, which was chosen from a stand looking down.
     *
     * So the layer thins for a camera standing low: two thirds of it at ten
     * metres above the datum and under, which is the plan's own line and is
     * inside the dust's own flat top, rising to all of it at two hundred and
     * fifty, which is higher than anything on the plateau but the Great
     * Pyramid and is where a camera is unarguably looking down on the dust
     * rather than along it. Both heights are look choices and the ramp
     * between them is one too: what picked the top of it was that the two
     * stands the layer was overdoing, the harbour at 45 m and the akhet in
     * front of the Sphinx at 80, should come out at about seven tenths.
     */
    lowStand: 10,
    highStand: 250,
    lowShare: 2 / 3,
  },
  sun: { high: new Color('#eef2f6'), low: new Color('#e8a163') },
  /**
   * What the air glows away from the sun. Brighter and less blue than stage
   * 1's: the photographs of this place under a high sun have a whitish band
   * along the horizon, not an even grey veil, and since the in-scattered
   * colour only arrives in the share the ray has lost, brightening it whitens
   * the horizon strongly and leaves the near ground alone. Greying the sand
   * was the other way the same number could have gone and is the wrong one.
   */
  sky: { high: new Color('#c6d6e6'), low: new Color('#bfab92'), night: new Color('#1b2740') },
  /** The render's DUST_COLOUR, which is sand lit through sand. */
  dustGlow: new Color('#e8c79a'),
} as const;

/**
 * The air of each stop of the timeline. Look choices, and the spec's, in
 * section 3: the First Time has clearer air, at seven tenths the density, and
 * a cooler cast to the sky it scatters, because that is the world before the
 * plateau was a quarry and before the city downwind of it. The other three
 * stops keep the air the renders were set against. The Cairo haze of `today`
 * is not here: it is a band low in the east and belongs to the sky, in
 * `Sky.tsx`.
 */
const STATE_AIR: Record<StateId, { density: number; cool: number }> = {
  ancient: { density: 0.7, cool: 0.2 },
  built: { density: 1, cool: 0 },
  stripped: { density: 1, cool: 0 },
  today: { density: 1, cool: 0 },
};

/** Where the ancient state's sky colour is drawn toward. A look choice. */
const CLEAR_SKY = new Color('#93b6dd');

const scratch = new Color();

/**
 * Point the air at the sun and set its colours from the sun's altitude and the
 * stop of the timeline. Call it once where the sun is known; every patched
 * material follows.
 */
export function setAtmosphere(sun: Sun, state: StateId): void {
  const night = nightness(sun.altitudeDeg);
  // 1 with the sun on the horizon, 0 with it high: the same shape the sky's
  // own turbidity ramp has, and the reason dusk is the hazy hour.
  const low = Math.min(1, Math.max(0, (18 - sun.altitudeDeg) / 24));
  const era = STATE_AIR[state];
  (AIR.airSun!.value as Vector3).copy(sun.direction);
  (AIR.airSunColour!.value as Color).copy(scratch.lerpColors(LOOK.sun.high, LOOK.sun.low, low)).lerp(LOOK.sky.night, night);
  (AIR.airSkyColour!.value as Color)
    .copy(scratch.lerpColors(LOOK.sky.high, LOOK.sky.low, low))
    .lerp(CLEAR_SKY, era.cool * (1 - night))
    .lerp(LOOK.sky.night, night);
  (AIR.airDustColour!.value as Color).copy(scratch.copy(LOOK.dustGlow).lerp(LOOK.sky.night, night));
  const day = LOOK.density + (LOOK.lowSunDensity - LOOK.density) * low;
  AIR.airDensity!.value = (day + (LOOK.nightDensity - day) * night) * era.density;
  AIR.airScaleHeight!.value = LOOK.scaleHeight;
  // The dust follows the same low-sun ramp as the haze and goes out with the
  // light: what holds it up is the day's own heat leaving the ground, and by
  // the time the stars are out there is nothing in the air to see.
  AIR.airDustDensity!.value = LOOK.dust.density * low * (1 - night) * era.density;
  AIR.airDustBase!.value = LOOK.dust.base;
  AIR.airDustScale!.value = LOOK.dust.scaleHeight;
  AIR.airDustLowStand!.value = LOOK.dust.lowStand;
  AIR.airDustHighStand!.value = LOOK.dust.highStand;
  AIR.airDustLowShare!.value = LOOK.dust.lowShare;
}

/**
 * The same, as a hook, for a component that has the sun as a prop. The stop is
 * read from the store here rather than taken as a second prop, so that the
 * scene's one call site does not have to be touched to give each state its own
 * air.
 */
export function useAtmosphere(sun: Sun): void {
  const state = useView((s) => s.state);
  useEffect(() => setAtmosphere(sun, state), [sun, state]);
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
  patchMaterial(material, 'air', 'v3', (shader) => {
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
 * The model, in GLSL: two layers of air, one over the whole view and one
 * pooled low, exactly as `build_atmosphere` gives the render.
 *
 * The optical depth along a ray between two heights, for air whose density
 * falls off as exp(-z/H), has a closed form: the path length times H times
 * the difference of the two exponentials, over the height difference. When
 * the two heights are within a hair of each other the expression is 0/0, so
 * the flat-air case is taken instead.
 *
 * The dust has a flat top rather than a peak at the datum: full strength up to
 * `airDustBase` and exponential above it. Its integral in height is therefore
 * the ramp plus the exponential's own, and the average over a segment is the
 * difference of that integral over the height difference, which is the same
 * trick and the same 0/0 case.
 *
 * The in-scattered colour is the sky's, swinging to the sun's own colour as
 * the ray points at it, and then toward the dust's warm sand in the share of
 * the extinction the dust is responsible for. The fourth power is a cheap
 * forward-scattering lobe, not Henyey-Greenstein: what it has to do is make
 * the air glow around a low sun, and it does.
 *
 * The world's up here is three's, +Y, because this runs on world positions
 * and not on the data frame.
 */
const AIR_CHUNK = `
varying vec3 vAirWorld;
uniform vec3 airSun;
uniform vec3 airSunColour;
uniform vec3 airSkyColour;
uniform vec3 airDustColour;
uniform float airDensity;
uniform float airScaleHeight;
uniform float airDustDensity;
uniform float airDustBase;
uniform float airDustScale;
uniform float airDustLowStand;
uniform float airDustHighStand;
uniform float airDustLowShare;

float sekedOpticalDepth(float fromY, float toY, float distance) {
  float scale = max(airScaleHeight, 1.0);
  float drop = toY - fromY;
  float near = exp(-fromY / scale);
  if (abs(drop) < 1.0) return airDensity * distance * near;
  return airDensity * distance * scale * (near - exp(-toY / scale)) / drop;
}

float sekedDustProfile(float y) {
  return exp(-max(y - airDustBase, 0.0) / max(airDustScale, 1.0));
}

float sekedDustIntegral(float y) {
  float scale = max(airDustScale, 1.0);
  return min(y, airDustBase) + scale * (1.0 - sekedDustProfile(y));
}

// How much of the dust a camera at this height sees: less standing in it,
// all of it looking down on it from above.
float sekedDustStand(float y) {
  float t = smoothstep(airDustLowStand, airDustHighStand, y);
  return mix(airDustLowShare, 1.0, t);
}

float sekedDustDepth(float fromY, float toY, float distance) {
  if (airDustDensity <= 0.0) return 0.0;
  float density = airDustDensity * sekedDustStand(cameraPosition.y);
  float drop = toY - fromY;
  if (abs(drop) < 1.0) return density * distance * sekedDustProfile(fromY);
  return density * distance * (sekedDustIntegral(toY) - sekedDustIntegral(fromY)) / drop;
}

vec3 sekedAir(vec3 colour, vec3 world) {
  vec3 ray = world - cameraPosition;
  float distance = length(ray);
  if (distance < 1e-3) return colour;
  float haze = sekedOpticalDepth(cameraPosition.y, world.y, distance);
  float dust = sekedDustDepth(cameraPosition.y, world.y, distance);
  float depth = haze + dust;
  if (depth <= 0.0) return colour;
  vec3 direction = ray / distance;
  float transmittance = exp(-depth);
  float towardSun = max(dot(direction, normalize(airSun)), 0.0);
  vec3 inscatter = mix(airSkyColour, airSunColour, pow(towardSun, 4.0) * 0.8);
  inscatter = mix(inscatter, airDustColour, (dust / depth) * 0.8);
  return colour * transmittance + inscatter * (1.0 - transmittance);
}
`;
