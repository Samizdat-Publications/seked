/**
 * How the picture is made, as against what is in it.
 *
 * The Blender renders get their look from three things the viewer did not
 * have: a filmic tone curve over a high dynamic range, shadows that stay
 * sharp near the camera across a plateau kilometres wide, and a little
 * ambient occlusion where stone meets stone. This file is those three.
 *
 * Every number in it is a look choice and says so. Nothing here is a
 * measurement; the only quantity from outside is the sun's direction, which
 * comes from `@seked/sky` by way of `useSun`.
 */
import { Bloom, EffectComposer, HueSaturation, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { useFrame, useThree } from '@react-three/fiber';
import { ToneMappingMode } from 'postprocessing';
import { useEffect, useState } from 'react';
import { Color, HalfFloatType, NoToneMapping, PCFShadowMap, Vector3 } from 'three';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { setCascades } from './materials/shadows';
import { worldDirection, type Sun } from './Sky';

/**
 * Look choices, all of them. Exposure is the stop the AgX curve is fed at:
 * the scene's lights are in the physical units `@react-three/fiber` sets up,
 * so this is where a render is made brighter or darker without touching what
 * the sun is doing.
 */
const LOOK = {
  /** How far ambient occlusion reaches, in metres of world space. */
  aoRadius: 14,
  aoIntensity: 1.6,
  /** Only the sky and the specular glints are meant to bloom, so the threshold is high. */
  bloom: { threshold: 0.92, smoothing: 0.35, intensity: 0.28 },
  vignette: { offset: 0.34, darkness: 0.42 },
  shadows: {
    /** Cascades over the distance the plateau fills: near the camera, mid, and the far pyramids. */
    cascades: 3,
    /** Metres. Beyond this the air carries the picture and a shadow would not be seen. */
    maxFar: 3000,
    mapSize: 2048,
    /** Metres of slope-scaled offset. Large enough to kill acne on a face raking the sun. */
    bias: -0.0009,
    /** Metres the shadow camera is pulled back, so a pyramid casts before it is in frustum. */
    margin: 400,
  },
} as const;

export type Quality = 'full' | 'reduced';

export interface RendererProps {
  sun: Sun;
  /** `reduced` drops the ambient occlusion and halves the shadow maps, for a weak GPU. */
  quality?: Quality;
}

/**
 * The renderer's own settings, the shadows, and the post chain. Mounted as
 * the last child of the Canvas, because the composer takes over drawing from
 * that point.
 */
export function Renderer({ sun, quality = 'full' }: RendererProps): React.JSX.Element {
  return (
    <>
      <Settings sun={sun} />
      <Shadows sun={sun} quality={quality} />
      <EffectComposer
        enableNormalPass={false}
        multisampling={0}
        frameBufferType={HalfFloatType}
      >
        <N8AO
          aoRadius={LOOK.aoRadius}
          intensity={quality === 'full' ? LOOK.aoIntensity : 0}
          quality={quality === 'full' ? 'medium' : 'performance'}
          halfRes={quality !== 'full'}
          distanceFalloff={1}
        />
        <Bloom
          luminanceThreshold={LOOK.bloom.threshold}
          luminanceSmoothing={LOOK.bloom.smoothing}
          intensity={LOOK.bloom.intensity}
          mipmapBlur
        />
        <Vignette offset={LOOK.vignette.offset} darkness={LOOK.vignette.darkness} eskil={false} />
        <SMAA />
        <ToneMapping mode={ToneMappingMode.AGX} />
        <HueSaturation saturation={saturationAt(sun.altitudeDeg)} />
      </EffectComposer>
    </>
  );
}

/**
 * Local clipping for the section cut, soft shadow filtering, and the tone
 * mapper turned off on the renderer itself: the composer's last effect does
 * AgX, so leaving the renderer's own curve on would apply it twice. Three
 * still hands `toneMappingExposure` to every shader, which is what the AgX
 * effect reads, so the exposure lives here.
 */
function Settings({ sun }: { sun: Sun }): null {
  const gl = useThree((s) => s.gl);
  const exposure = exposureAt(sun.altitudeDeg);
  useEffect(() => {
    gl.localClippingEnabled = true;
    gl.toneMapping = NoToneMapping;
    gl.toneMappingExposure = exposure;
    gl.shadowMap.enabled = true;
    // Three 0.186 removed PCFSoftShadowMap; the cascades carry the sharpness
    // a wider filter would otherwise have had to make up for.
    gl.shadowMap.type = PCFShadowMap;
  }, [gl, exposure]);
  return null;
}

/**
 * The stop the AgX curve is fed at, by the sun's altitude. Look choices, all
 * of them, and the same move a photographer makes: the plateau at noon is
 * three stops brighter than the plateau at sunset, and a fixed exposure that
 * holds noon leaves dusk nearly black, which is what stage 2 showed at the
 * akhet moment.
 *
 * The top anchor is the panorama's own exposure, which is what the Blender
 * renders were matched at; the bottom is the night one, which is a photograph
 * taken with the aperture open, as the render's night view is.
 */
const EXPOSURE: ReadonlyArray<readonly [number, number]> = [
  [-14, 2.4],
  [-6, 1.9],
  [-1, 1.45],
  [2, 1.25],
  [8, 0.95],
  [20, 0.72],
  [45, 0.62],
];

/**
 * How much saturation is put back after the curve, by the sun's altitude.
 *
 * AgX trades saturation for its highlight roll-off, which is why Blender's own
 * "AgX - Punchy" adds some back, and 0.16 is that by day. At dusk the sky is
 * already at the far end of its own gamut and the Preetham model turns the
 * upper sky a bottle green when the sun is under the horizon, so the same
 * addition there paints the artefact rather than the picture. Look choices.
 */
const SATURATION: ReadonlyArray<readonly [number, number]> = [
  [-6, 0.0],
  [4, 0.08],
  [15, 0.16],
];

/** Exposure at an altitude, linear between the two anchors either side of it. */
export function exposureAt(altitudeDeg: number): number {
  return table(EXPOSURE, altitudeDeg);
}

/** Saturation added after the curve at an altitude, through the same shape. */
export function saturationAt(altitudeDeg: number): number {
  return table(SATURATION, altitudeDeg);
}

/** A value from a table of (altitude, value) anchors, flat outside its ends. */
function table(rows: ReadonlyArray<readonly [number, number]>, altitudeDeg: number): number {
  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  if (altitudeDeg <= first[0]) return first[1];
  if (altitudeDeg >= last[0]) return last[1];
  for (let i = 1; i < rows.length; i++) {
    const hi = rows[i]!;
    const lo = rows[i - 1]!;
    if (altitudeDeg > hi[0]) continue;
    const t = (altitudeDeg - lo[0]) / (hi[0] - lo[0]);
    return lo[1] + t * (hi[1] - lo[1]);
  }
  return last[1];
}

/**
 * Cascaded shadow maps following the sun.
 *
 * One shadow camera over the whole plateau would put a texel at most of a
 * metre, which is the height of a course: the pyramids' steps would cast
 * nothing a reader could see. Three cascades put the near one where the
 * camera is looking and leave the far one to cover the horizon.
 *
 * The CSM's own directional lights are the sun: their direction, colour and
 * intensity come from the sun's own place, so there is no second light in the
 * scene to disagree with the astronomy.
 */
function Shadows({ sun, quality }: { sun: Sun; quality: Quality }): null {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const mapSize = quality === 'full' ? LOOK.shadows.mapSize : LOOK.shadows.mapSize / 2;
  const [csm, setCsm] = useState<CSM | undefined>(undefined);

  // The CSM's constructor adds its lights to the scene, which makes it a side
  // effect and not a memo. React runs a memo's factory twice in development,
  // and the second instance would leave the first one's three lights standing
  // in the scene: six directional lights, where the cascade shader indexes
  // three, and every material fails to compile.
  useEffect(() => {
    const next = new CSM({
      camera,
      parent: scene,
      cascades: LOOK.shadows.cascades,
      maxFar: LOOK.shadows.maxFar,
      mode: 'practical',
      shadowMapSize: mapSize,
      shadowBias: LOOK.shadows.bias,
      lightMargin: LOOK.shadows.margin,
      lightDirection: new Vector3(1, -1, 1).normalize(),
    });
    setCsm(next);
    setCascades(next);
    return () => {
      setCsm(undefined);
      next.remove();
      next.dispose();
      // After the CSM, because disposing it deletes the hook off every
      // material it touched, and this is what puts the patches back.
      setCascades(undefined);
    };
  }, [camera, scene, mapSize]);

  // The sun only moves when the reader moves the timeline, so the light is set
  // there and the frame loop only refits the cascades to the camera.
  //
  // The direction the light travels is the opposite of the direction to the
  // sun, and its altitude is floored a degree above the horizon: CSM builds
  // its shadow cameras with `lookAt` against a fixed world up, which is
  // degenerate for a light coming from straight below. What goes to nothing
  // as the sun sets is the intensity, not the direction.
  useEffect(() => {
    if (!csm) return;
    const colour = sunColour(sun.altitudeDeg);
    csm.lightDirection.copy(worldDirection(Math.max(sun.altitudeDeg, 1), sun.azimuthDeg)).negate().normalize();
    csm.lightIntensity = sunIntensity(sun.altitudeDeg);
    for (const light of csm.lights) {
      light.intensity = csm.lightIntensity;
      light.color.copy(colour);
      light.visible = csm.lightIntensity > 0;
    }
    csm.updateFrustums();
  }, [csm, sun]);

  useFrame(() => csm?.update());

  return null;
}

/**
 * The sun's strength by altitude, and its colour with it. A look table, not a
 * measurement: it stands in for the air the light has come through, which the
 * scene does not model.
 *
 * The sun goes out a degree under the horizon rather than at civil twilight,
 * because that is where it actually goes: the last of the direct light is the
 * upper limb at about -0.8 degrees, and everything after it is the sky's. The
 * old table kept a fifth of the sun burning to -6, which put a low rim light
 * on faces the renders have in flat shadow. What carries the picture from
 * there is `SKY_LOOK`'s fill and `EXPOSURE`, not an invented sun.
 *
 * The foot is gentler too: a fifth of noon at 2 degrees, deep orange, which is
 * the light in docs/progress/0007-blender-akhet.png a few minutes earlier.
 */
const SUN_LOOK: ReadonlyArray<readonly [number, number, Color]> = [
  [-6, 0.0, new Color('#2c3d63')],
  [-1, 0.0, new Color('#b4431a')],
  [2, 0.64, new Color('#d05a1c')],
  [6, 1.35, new Color('#e8853a')],
  [12, 2.1, new Color('#f7bb78')],
  [20, 2.5, new Color('#ffdcae')],
  [45, 3.0, new Color('#fff1dc')],
  [70, 3.2, new Color('#fffaf0')],
];

function between(altitudeDeg: number): { lo: (typeof SUN_LOOK)[number]; hi: (typeof SUN_LOOK)[number]; t: number } {
  const first = SUN_LOOK[0]!;
  const last = SUN_LOOK[SUN_LOOK.length - 1]!;
  if (altitudeDeg <= first[0]) return { lo: first, hi: first, t: 0 };
  if (altitudeDeg >= last[0]) return { lo: last, hi: last, t: 0 };
  for (let i = 1; i < SUN_LOOK.length; i++) {
    const hi = SUN_LOOK[i]!;
    const lo = SUN_LOOK[i - 1]!;
    if (altitudeDeg > hi[0]) continue;
    return { lo, hi, t: (altitudeDeg - lo[0]) / (hi[0] - lo[0]) };
  }
  return { lo: last, hi: last, t: 0 };
}

/** Intensity of the sun's light at an altitude, interpolated through `SUN_LOOK`. */
export function sunIntensity(altitudeDeg: number): number {
  const { lo, hi, t } = between(altitudeDeg);
  return lo[1] + t * (hi[1] - lo[1]);
}

/** The sun's colour at an altitude, interpolated through the same table. */
export function sunColour(altitudeDeg: number): Color {
  const { lo, hi, t } = between(altitudeDeg);
  return new Color().lerpColors(lo[2], hi[2], t);
}
