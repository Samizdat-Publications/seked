/**
 * The sky the plateau stands under, and the sun that lights it.
 *
 * Nothing here computes an astronomical quantity. `sunAt` in `@seked/sky`
 * places the sun, checked against the bake the Blender renders are lit by,
 * and `ltpb` and `equatorialToHorizon` turn the celestial sphere; this file
 * turns those into a direction in three's world frame, a Preetham sky, a
 * light of the right colour and strength, an environment map taken off the
 * sky itself, and the stars as the sun goes down.
 *
 * Because the light and the sky are both built from the one sun, they cannot
 * disagree: there is no second place in the viewer where a light direction is
 * chosen. Everything else in the file, the turbidity, the tints, the
 * strengths, is a look choice and is named as one.
 *
 * The component mounts inside `Scene.tsx`'s rotated group, which is the one
 * place the data frame becomes three's Y-up world. So the stars and the Milky
 * Way are in the data frame like the rest of the scene, while the sky
 * shader's `sunPosition` is in the world frame, because that shader reads a
 * world position out of its vertex stage rather than a local one.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { enuDirection, equatorialToHorizon, ltpb, sunAt, type Mat3, type SunPosition } from '@seked/sky/browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  RepeatWrapping,
  Scene as ThreeScene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Texture,
  type WebGLRenderTarget,
} from 'three';
import { Sky as PreethamSky } from 'three/examples/jsm/objects/Sky.js';
import { DOME_RADIUS, type DomeBuffers, type NamedDomeStar } from '../sky';
import { useView } from '../store';
import { sceneEpoch, type StateId } from '../view';
import { useStateTransition } from './fade';
import { setCasingCorona } from './materials/casing';
import { SkyDome } from './SkyDome';

/** Where the plateau is, which is the Great Pyramid's own centre. */
export interface Observer {
  latitudeDeg: number;
  longitudeDeg: number;
}

export interface Sun extends SunPosition {
  /**
   * A unit vector toward the sun in three's world frame, which is the data
   * frame turned Y-up: +X east, +Y up, +Z south.
   */
  direction: Vector3;
  /** Above the horizon on the same convention as a published sunrise. */
  up: boolean;
}

/**
 * The data frame's east, north and up as three's world frame reads them. The
 * one rotation in `Scene.tsx` turns the scene's geometry this way, and a
 * direction that is not in the scene graph has to be turned by hand.
 */
export function worldDirection(altitudeDeg: number, azimuthDeg: number): Vector3 {
  const [east, north, up] = enuDirection(altitudeDeg, azimuthDeg);
  return new Vector3(east, up, -north);
}

/**
 * The sun for the store's epoch and moment, memoised on the four numbers it
 * depends on so a camera drag does not recompute it.
 *
 * The epoch is the reader's override, or the viewer's default. It cannot see
 * the epoch of a selected claim, which `App.tsx` computes and does not pass
 * down: with a dated claim open and no override, the star dome follows that
 * claim and the sun keeps the default. Closing that gap means passing the
 * scene's epoch into `Scene`, which is another track's file.
 */
export function useSun({ latitudeDeg, longitudeDeg }: Observer, epoch: number): Sun {
  const day = useView((s) => s.moment.day);
  const hour = useView((s) => s.moment.hour);
  return useMemo(() => {
    const at = sunAt({ epoch, day, hour, latitudeDeg, longitudeDeg });
    return {
      ...at,
      direction: worldDirection(at.altitudeDeg, at.azimuthDeg),
      up: at.apparentAltitudeDeg !== undefined,
    };
  }, [epoch, day, hour, latitudeDeg, longitudeDeg]);
}

/**
 * The Preetham sky's four knobs by the sun's altitude, and the fill light
 * that goes with them. Look choices throughout, set against the Blender
 * renders: thick dusty air at dawn and dusk, where a low sun has the whole
 * depth of it to come through, and clearer air at noon. Egypt's desert haze
 * is what keeps the turbidity from ever going near one.
 *
 * `fill` is the hemisphere light, which stands in for the sky's own light
 * reaching a face the sun does not; `ambient` is the last of it, in the
 * shadows, and goes almost out at night.
 */
interface SkyLook {
  altitude: number;
  turbidity: number;
  rayleigh: number;
  mie: number;
  mieG: number;
  fill: number;
  ambient: number;
}

/**
 * The anchors are close together from -6 to +10 degrees because that band is
 * where a picture of this place is decided and the first pass had nothing in
 * it: the akhet moment sits at -1.6 degrees, between the old -6 and 0, and
 * the plateau came out nearly black.
 *
 * What the renders show at that moment (0007 and 0015) is that after sunset
 * the sun is not what lights the plateau at all: the pyramids are flat
 * lavender shapes and the ground is warm cream, both of them lit only by a
 * sky that is still bright. So the fill is held at 0.15 at civil twilight and
 * climbs from there rather than falling away with the sun, which is what a
 * sky whose whole western half is still alight actually does. Only past civil
 * twilight, where the renders go dark too, does it go out.
 */
const SKY_LOOK: ReadonlyArray<SkyLook> = [
  { altitude: -18, turbidity: 3.0, rayleigh: 0.35, mie: 0.004, mieG: 0.8, fill: 0.03, ambient: 0.025 },
  { altitude: -6, turbidity: 4.4, rayleigh: 0.7, mie: 0.016, mieG: 0.78, fill: 0.15, ambient: 0.055 },
  { altitude: -3, turbidity: 5.2, rayleigh: 0.95, mie: 0.022, mieG: 0.76, fill: 0.19, ambient: 0.065 },
  { altitude: 0, turbidity: 5.6, rayleigh: 1.25, mie: 0.024, mieG: 0.76, fill: 0.24, ambient: 0.075 },
  { altitude: 2, turbidity: 5.8, rayleigh: 1.6, mie: 0.02, mieG: 0.78, fill: 0.28, ambient: 0.08 },
  { altitude: 10, turbidity: 5.4, rayleigh: 2.2, mie: 0.011, mieG: 0.82, fill: 0.37, ambient: 0.095 },
  { altitude: 25, turbidity: 4.2, rayleigh: 1.6, mie: 0.006, mieG: 0.8, fill: 0.5, ambient: 0.12 },
  { altitude: 60, turbidity: 3.4, rayleigh: 1.1, mie: 0.005, mieG: 0.8, fill: 0.62, ambient: 0.14 },
];

/** The look at an altitude, linear between the two anchors either side of it. */
export function skyLook(altitudeDeg: number): SkyLook {
  const first = SKY_LOOK[0]!;
  const last = SKY_LOOK[SKY_LOOK.length - 1]!;
  if (altitudeDeg <= first.altitude) return first;
  if (altitudeDeg >= last.altitude) return last;
  for (let i = 1; i < SKY_LOOK.length; i++) {
    const hi = SKY_LOOK[i]!;
    const lo = SKY_LOOK[i - 1]!;
    if (altitudeDeg > hi.altitude) continue;
    const t = (altitudeDeg - lo.altitude) / (hi.altitude - lo.altitude);
    const mix = (a: number, b: number): number => a + t * (b - a);
    return {
      altitude: altitudeDeg,
      turbidity: mix(lo.turbidity, hi.turbidity),
      rayleigh: mix(lo.rayleigh, hi.rayleigh),
      mie: mix(lo.mie, hi.mie),
      mieG: mix(lo.mieG, hi.mieG),
      fill: mix(lo.fill, hi.fill),
      ambient: mix(lo.ambient, hi.ambient),
    };
  }
  return last;
}

/**
 * What each stop of the timeline does to the sky itself, as multipliers on the
 * look the sun's altitude gives. Look choices, following the spec's section 3:
 * the First Time has clearer air, so its scattering haze comes down a fifth,
 * which reads as a deeper blue overhead and a cleaner horizon. The other three
 * stops are the sky the renders were set against. `today`'s own difference is
 * the Cairo haze, which is a band rather than a change to the whole sky and is
 * drawn by `CairoHaze` below.
 */
const STATE_SKY: Record<StateId, { turbidity: number; mie: number }> = {
  ancient: { turbidity: 0.8, mie: 0.8 },
  built: { turbidity: 1, mie: 1 },
  stripped: { turbidity: 1, mie: 1 },
  today: { turbidity: 1, mie: 1 },
};

/** The look of a stop's own sky at that altitude. */
export function stateSky(look: SkyLook, state: StateId): SkyLook {
  const era = STATE_SKY[state];
  return { ...look, turbidity: look.turbidity * era.turbidity, mie: look.mie * era.mie };
}

/**
 * The sun's strength by altitude, and its colour with it. A look table, not a
 * measurement: it stands in for the air the light has come through, which the
 * scene does not model. It lives beside the sky because it is the same sun,
 * and because the environment map's own ground needs it; `Renderer.tsx` reads
 * it from here for the cascades' lights.
 *
 * The sun goes out a degree under the horizon rather than at civil twilight,
 * because that is where it actually goes: the last of the direct light is the
 * upper limb at about -0.8 degrees, and everything after it is the sky's. The
 * old table kept a fifth of the sun burning to -6, which put a rim light on
 * faces the renders have in flat shadow. What carries the picture from there
 * is `SKY_LOOK`'s fill and the renderer's exposure, not an invented sun.
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

/** The sun's strength with it overhead, which everything else is a share of. */
const SUN_NOON = SUN_LOOK[SUN_LOOK.length - 1]![1];

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

/** The colour of the sky's own light and of the ground's bounce. Look choices. */
const ZENITH = new Color('#82a9da');
const DUSK_ZENITH = new Color('#45577f');
const NIGHT_ZENITH = new Color('#111c35');
const BOUNCE = new Color('#6b5a3e');
const NIGHT_AMBIENT = new Color('#16243f');
const DAY_AMBIENT = new Color('#bcccdf');

/**
 * What the lit half of the sky is when the sun is at the horizon. A look
 * choice, read off the band in docs/progress/0015-blender-akhet-causeway.png.
 *
 * A hemisphere light has one colour for everything facing up, and taking that
 * colour to the zenith's blue at sunset is what made the akhet plateau read
 * cold and dead: at that moment the greater part of the light falling on the
 * ground has come out of the orange west, not out of the blue overhead.
 */
const DUSK_GLOW = new Color('#c9885a');

/** How far the fill is allowed to be pulled to that glow at its strongest. A look choice. */
const DUSK_GLOW_SHARE = 0.55;

/**
 * How near the horizon the sun has to be for that glow to count, in degrees
 * either side. A look choice: the panorama's own moment has the sun at 10.7
 * degrees and the render of it is warm, so the band has to reach past that
 * before the sky goes back to being the ordinary blue one.
 */
const DUSK_GLOW_BAND = 16;

/**
 * How far down the sun is before the sky is called night, and the band it
 * fades across: civil twilight at one end, near astronomical at the other.
 * Inside that band the stars come up and the daylit sky goes out.
 */
const TWILIGHT = { top: -2, bottom: -14 } as const;

/** 0 by day, 1 in full night, interpolated through the twilight band. */
export function nightness(altitudeDeg: number): number {
  return Math.min(1, Math.max(0, (TWILIGHT.top - altitudeDeg) / (TWILIGHT.top - TWILIGHT.bottom)));
}

/**
 * The light the stars themselves put on the plateau.
 *
 * With the sun down the viewer had the pyramids as flat black cut-outs: the
 * only lights left were a hemisphere at 0.03 in the night sky's near-black
 * blue and an ambient at 0.025, and the renders' own night view
 * (docs/progress/0020-blender-night-milky-way.png) is not that. It has the
 * silhouettes reading against a lit sky and the ground faintly there.
 *
 * So the dome pays for it. The catalogue's own colours, which `sky.ts` writes
 * from each star's magnitude and colour index, are averaged: their mean
 * luminance is the strength and their mean hue is the colour, pulled most of
 * the way to the night sky's blue because what reaches a face at night has
 * been scattered by the same air that makes the sky blue by day. Only the
 * gain is chosen here, and no star is typed twice.
 */
const STARLIGHT = {
  /**
   * What the dome's mean luminance is worth as a hemisphere light. Small on
   * purpose: the render's own night has the ground near black and the
   * pyramids as silhouettes, and all this has to do is keep a face from being
   * the same black as the one beside it.
   */
  gain: 0.05,
  /** How far the dome's own hue is pulled to the night sky's. A look choice. */
  blue: 0.7,
  /** With nothing loaded, a night that is dark but not black. */
  fallback: { colour: new Color('#7f90b4'), intensity: 0.02 },
} as const;

/** The ground's bounce under the stars, which is next to nothing. */
const NIGHT_BOUNCE = new Color('#0b1018');

/** Rec. 709 luminance, which is what separates a light's colour from its strength. */
export function luminanceOf(colour: Color): number {
  return 0.2126 * colour.r + 0.7152 * colour.g + 0.0722 * colour.b;
}

/** The hemisphere light the star dome is worth, or the fallback with no dome. */
export function starlightOf(buffers: DomeBuffers | undefined): { colour: Color; intensity: number } {
  if (!buffers || buffers.count === 0) return { colour: STARLIGHT.fallback.colour, intensity: STARLIGHT.fallback.intensity };
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < buffers.count; i++) {
    r += buffers.colours[i * 3] ?? 0;
    g += buffers.colours[i * 3 + 1] ?? 0;
    b += buffers.colours[i * 3 + 2] ?? 0;
  }
  const mean = new Color(r / buffers.count, g / buffers.count, b / buffers.count);
  const luminance = luminanceOf(mean);
  // Hue and strength are separated, so that pulling the colour toward the
  // night sky's blue tints the light without also dimming it: the strength is
  // the dome's own mean and the gain, and nothing else.
  const blue = NIGHT_SKY.zenith.clone();
  blue.multiplyScalar(1 / Math.max(luminanceOf(blue), 1e-6));
  const colour = mean.multiplyScalar(1 / Math.max(luminance, 1e-6)).lerp(blue, STARLIGHT.blue);
  colour.multiplyScalar(1 / Math.max(luminanceOf(colour), 1e-6));
  return { colour, intensity: luminance * STARLIGHT.gain };
}

/** The stars of the epoch, as `App.tsx` hands them to the scene. */
export interface StarsProps {
  buffers: DomeBuffers;
  named: NamedDomeStar[];
  latitudeDeg: number;
  lstDeg: number;
}

export interface SkyProps {
  sun: Sun;
  observer: Observer;
  /** The stars of the epoch, when the reader has the sky layer on. */
  stars: StarsProps | undefined;
  /** The horizon ring, the quarters and the star labels, which the layer toggles. */
  furniture: boolean;
}

/**
 * The sky as it stands this frame, for a material that is lit by the sky but
 * is not the sky and has no way to be handed the sun.
 *
 * The water is the one that needs it: it is drawn inside the same rotated
 * group, it is a drei material that keeps its own uniforms, and the sun
 * reaches it through neither a prop nor the store, because `Scene.tsx` hands
 * the sun to `Sky` and to `Renderer` and to nothing else. Rather than compute
 * a second sun, which would be the same number typed twice and could drift
 * from this one, the sky writes what it has here and whoever needs it reads
 * it inside `useFrame`.
 *
 * The object is the same one every frame and its fields are written in place,
 * for the reason `fade.ts` gives for its own: a value that changes with the
 * hour would re-render the scene to animate something no component draws.
 */
const STAND = { altitudeDeg: 90, colour: new Color('#ffffff') };

/** What the sky is doing. Read it in a frame loop, never in a render body. */
export function skyStand(): { readonly altitudeDeg: number; readonly colour: Color } {
  return STAND;
}

function setSkyStand(altitudeDeg: number, colour: Color): void {
  STAND.altitudeDeg = altitudeDeg;
  STAND.colour.copy(colour);
}

/**
 * The sky, the fill light, the environment map, and the night behind them.
 * Mounts inside the rotated group.
 */
export function Sky({ sun, observer, stars, furniture }: SkyProps): React.JSX.Element {
  const lst = useView((s) => s.lst);
  const override = useView((s) => s.epoch);
  const state = useView((s) => s.state);
  const epoch = sceneEpoch(override, undefined);
  const look = stateSky(skyLook(sun.altitudeDeg), state);
  const night = nightness(sun.altitudeDeg);

  // The fill goes from the daylit zenith through dusk to a deep blue, which
  // is the one colour a shadowed face takes when the sun has gone; and while
  // the sun is within a few degrees of the horizon it is pulled toward the
  // glow of the lit west, which is what keeps the akhet plateau warm.
  const fill = useMemo(() => {
    const dusk = Math.min(1, Math.max(0, (8 - sun.altitudeDeg) / 14));
    const glow = Math.max(0, 1 - Math.abs(sun.altitudeDeg) / DUSK_GLOW_BAND) * (1 - night);
    return new Color()
      .lerpColors(ZENITH, DUSK_ZENITH, dusk)
      .lerp(DUSK_GLOW, glow * DUSK_GLOW_SHARE)
      .lerp(NIGHT_ZENITH, night);
  }, [sun.altitudeDeg, night]);
  const ambient = useMemo(() => new Color().lerpColors(DAY_AMBIENT, NIGHT_AMBIENT, night), [night]);
  const starlight = useMemo(() => starlightOf(stars?.buffers), [stars]);

  // The corona's light on the casing, which is the First Time's alone and is a
  // claim. `Pyramids.tsx` draws the sprite at each apex on its own band from
  // -6 to -12 degrees; this uses the scene's one night ramp, which starts a
  // little earlier and ends a little later, so the glow is up before the
  // sprite and outlasts it rather than switching with it.
  useEffect(() => setCasingCorona(state === 'ancient' ? night : 0), [state, night]);

  // And what the water reads to know the hour: the sun's altitude and the
  // colour the sky itself has taken at it.
  useEffect(() => setSkyStand(sun.altitudeDeg, fill), [sun.altitudeDeg, fill]);

  return (
    <group>
      <Atmosphere sun={sun} look={look} night={night} fill={fill} state={state} />
      {/* A hemisphere light's up is the direction of its own position in the
          world, and this group has already been turned, so what it is given
          here is the data frame's up. */}
      <hemisphereLight position={[0, 0, 1]} color={fill} groundColor={BOUNCE} intensity={look.fill} />
      <ambientLight color={ambient} intensity={look.ambient} />
      {night > 0 && (
        <hemisphereLight
          position={[0, 0, 1]}
          color={starlight.colour}
          groundColor={NIGHT_BOUNCE}
          intensity={starlight.intensity * night}
        />
      )}
      <CairoHaze night={night} />
      {night > 0.02 && <NightSky epoch={epoch} latitudeDeg={observer.latitudeDeg} lstDeg={lst} opacity={night} />}
      {stars && night > 0.02 && <SkyDome {...stars} radius={DOME_RADIUS} opacity={night} furniture={furniture} />}
    </group>
  );
}

/**
 * How large the sky box is drawn. Its own shader pins every vertex to the far
 * plane, so all the scale has to do is keep the camera inside the box.
 */
const SKY_SCALE = 100000;

/** How much of the sky's own light reaches a material through the environment map. A look choice. */
const ENVIRONMENT_STRENGTH = 0.2;

/**
 * How far the sun has to move before the environment map is worth building
 * again. Look choices, both of them.
 *
 * Half a degree of altitude is the sun's own disc, which is the smallest move
 * that changes where the bright band sits on the horizon; two degrees of
 * azimuth swings the lit quarter of the sky by less than the blur of the
 * roughest mip anything in the scene samples. Under either the map comes back
 * a picture no eye can tell from the last one, and a moment tweened twelve
 * times a second would pay for twelve of them a second.
 *
 * The look itself and the fill and the night are all functions of the same
 * altitude, so these two gates cover them; the stop of the timeline is not,
 * and is checked on its own.
 */
const ENVIRONMENT_STEP = { altitudeDeg: 0.5, azimuthDeg: 2 } as const;

/**
 * The cube the map is taken off. A look choice, and three's own default.
 *
 * Stage 4 asked for this to be halved while a sequence is playing, if a
 * rebuild still cost more than 4 ms once the generator was kept. Measured on a
 * 5070 Ti at the dawn stand, 1600 by 900 at a device ratio of 1.5: a build
 * costs about 290 ms when the generator is made fresh for it, which is what it
 * used to be, and about 0.4 ms when the generator, the probe and its ground
 * are kept, which is well under the 4 ms. Halving the cube was tried anyway
 * and measured no better (4.8 frames a second against 4.9 through the same
 * sweep), because changing the size makes `PMREMGenerator` throw its ping-pong
 * target away and recompile its blur and GGX shaders, which costs more than a
 * sequence saves and is paid again on the way back up. So there is one size,
 * and no scene file reads the motion store.
 */
const ENVIRONMENT_CUBE = 256;

/** The difference of two azimuths, the short way round the compass, in degrees. */
function azimuthApart(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * The ground the environment map stands on.
 *
 * Until now the map was the sky alone, so the lower half of every reflection
 * was whatever three's Preetham shader returns for a direction under the
 * horizon, which is a dark blue. That is what put a cool cast on the polished
 * casing's faces toward a low sun and what turned the electrum caps to soot at
 * dusk: half of what a mirror sees at Giza is sand.
 *
 * So the probe scene gains a hemisphere under the sky, in one flat colour: the
 * sand's own albedo times the light falling on it, which is the sun's colour
 * at its own strength foreshortened by its altitude, plus the sky's fill. It
 * is a mean and not a picture; nothing about the plateau's shape is in it, and
 * every number here is a look choice.
 */
const GROUND = {
  /** The mean the desert reflects, across the sand, the bedrock and the stone. */
  albedo: new Color('#c9ab7e'),
  /**
   * The share of the sun's own light that comes back up. Over one, because
   * this is not a radiometric bounce: the foreshortening is already in the
   * sine, and what the reflections want is the sand as the eye reads it at
   * that hour, which is the sand the exposure table is set for.
   */
  bounce: 2.2,
  /** And of the sky's, which is what is left when the sun has gone. */
  skyShare: 1.0,
  /** How far down the probe sphere the ground is drawn, as a share of the sky box. */
  scale: 0.45,
} as const;

const groundScratch = new Color();

/**
 * The flat colour the environment's ground is drawn in, from the sun and the
 * sky the scene is already using. Exported so it can be read at a glance.
 */
export function environmentGround(altitudeDeg: number, look: SkyLook, fill: Color): Color {
  // The light on a horizontal surface falls off with the cosine of the sun's
  // angle from the vertical, which is the sine of its altitude; under the
  // horizon there is none of it left.
  const facing = Math.max(0, Math.sin((altitudeDeg * Math.PI) / 180));
  const lit = (sunIntensity(altitudeDeg) / SUN_NOON) * facing * GROUND.bounce;
  return new Color()
    .copy(sunColour(altitudeDeg))
    .multiplyScalar(lit)
    .add(groundScratch.copy(fill).multiplyScalar(look.fill * GROUND.skyShare))
    .multiply(GROUND.albedo);
}

/**
 * The sky itself: three's Preetham model on a box drawn at the far plane, and
 * a pre-filtered map of the same shader set as the scene's environment, so
 * every standard material reflects the sky it is standing under. The
 * environment is what puts light on a north face at noon, and what the
 * polished casing will want in the ancient state.
 */
function Atmosphere({
  sun,
  look,
  night,
  fill,
  state,
}: {
  sun: Sun;
  look: SkyLook;
  night: number;
  /** The sky's own colour, which is half of what the environment's ground is lit by. */
  fill: Color;
  /** The stop of the timeline, which changes the sky's own turbidity under a still sun. */
  state: StateId;
}): React.JSX.Element {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const mesh = useMemo(() => new PreethamSky(), []);

  useEffect(() => () => {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }, [mesh]);

  // Preetham knows nothing about night: left alone it gives a black sky with
  // a bright band where the sun has gone. Taking the scattering down as the
  // stars come up is a look choice, and the only honest one available.
  const rayleigh = look.rayleigh * (1 - night * 0.85);

  useEffect(() => {
    const u = mesh.material.uniforms;
    u.sunPosition!.value.copy(sun.direction);
    u.turbidity!.value = look.turbidity;
    u.rayleigh!.value = rayleigh;
    u.mieCoefficient!.value = look.mie;
    u.mieDirectionalG!.value = look.mieG;
    // The disc is the sun. Below the horizon there is nothing to draw, and
    // the model has no business inventing one.
    u.showSunDisc!.value = sun.up ? 1 : 0;
  }, [mesh, sun, look, rayleigh]);

  // The environment map is taken off a second copy of the same shader, in a
  // scene of its own: the mesh in the graph cannot be rendered while the
  // renderer is drawing the graph.
  //
  // The generator, the probe and its ground are built once and kept. Building
  // them per change was most of what a rebuild cost, because a new
  // `PMREMGenerator` compiles its own blur and GGX shaders before it can
  // render anything, and a moment tweened through a shot paid that twelve
  // times a second.
  const rig = useMemo(() => {
    const probe = new PreethamSky();
    probe.scale.setScalar(SKY_SCALE);
    // The ground under it: the lower half of a sphere, seen from inside,
    // which is where the probe camera sits. It is drawn unlit and untone-
    // mapped, because what the map wants is the radiance itself.
    const ground = new Mesh(
      new SphereGeometry(SKY_SCALE * GROUND.scale, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new MeshBasicMaterial({ side: BackSide, fog: false }),
    );
    const world = new ThreeScene();
    world.add(probe);
    world.add(ground);
    return { pmrem: new PMREMGenerator(gl), probe, ground, world, target: undefined as WebGLRenderTarget | undefined };
  }, [gl]);

  useEffect(
    () => () => {
      scene.environment = null;
      rig.target?.dispose();
      rig.probe.geometry.dispose();
      rig.probe.material.dispose();
      rig.ground.geometry.dispose();
      rig.ground.material.dispose();
      rig.pmrem.dispose();
    },
    [rig, scene],
  );

  // What the map standing in the scene was built from, so the next render can
  // tell whether the sun has moved far enough to be worth another.
  const built = useRef<{ altitudeDeg: number; azimuthDeg: number; state: StateId } | null>(null);

  // No dependency list: this runs after every render and decides for itself.
  useEffect(() => {
    // Free, so it follows every change however small: it is one number on the
    // scene and the shaders read it as they stand.
    scene.environmentIntensity = ENVIRONMENT_STRENGTH * (1 - night * 0.85);

    const was = built.current;
    const worth =
      was === null
      || was.state !== state
      || Math.abs(sun.altitudeDeg - was.altitudeDeg) > ENVIRONMENT_STEP.altitudeDeg
      || azimuthApart(sun.azimuthDeg, was.azimuthDeg) > ENVIRONMENT_STEP.azimuthDeg;
    if (!worth) return;

    const u = rig.probe.material.uniforms;
    u.sunPosition!.value.copy(sun.direction);
    u.turbidity!.value = look.turbidity;
    u.rayleigh!.value = rayleigh;
    u.mieCoefficient!.value = look.mie;
    u.mieDirectionalG!.value = look.mieG;
    u.showSunDisc!.value = 0;
    (rig.ground.material as MeshBasicMaterial).color.copy(environmentGround(sun.altitudeDeg, look, fill));
    const previous = rig.target;
    try {
      if (import.meta.env.DEV) console.time('seked: sky environment');
      rig.target = rig.pmrem.fromScene(rig.world, 0, 1, SKY_SCALE, { size: ENVIRONMENT_CUBE });
      if (import.meta.env.DEV) console.timeEnd('seked: sky environment');
      scene.environment = rig.target.texture;
      previous?.dispose();
      built.current = { altitudeDeg: sun.altitudeDeg, azimuthDeg: sun.azimuthDeg, state };
    } catch (error) {
      console.warn('seked: could not build the sky environment map', error);
    }
  });

  return <primitive object={mesh} scale={SKY_SCALE} renderOrder={-10} />;
}

/**
 * The Cairo haze: a faint warm-grey band low in the east, drawn in `today` and
 * in no other state.
 *
 * Cairo is real and it is downwind, and from the plateau at dusk the city
 * stands under a brown lift that the desert to the west does not have. It is
 * the one thing about the modern sky that is not the same sky the other stops
 * stand under, and the spec asks for it in section 3.4.
 *
 * Every number here is a look choice and none of them is a measurement: the
 * city is a direction and a colour, not a figure in the database. It is kept
 * faint on purpose, so that a reader who did not know Cairo was there would
 * take it for dust.
 */
const HAZE = {
  /** Degrees of azimuth, from north through east, the band is drawn across. */
  fromAzimuth: 40,
  toAzimuth: 140,
  /** Degrees of altitude. It starts a little below the horizon so it has no edge there. */
  fromAltitude: -1.5,
  toAltitude: 8,
  /** Degrees over which it fades out at each end of the arc. */
  taper: 24,
  /** The brown-grey a city's own light and dust lift a horizon to. */
  colour: new Color('#a08a6e'),
  /** How strong it is at its strongest, which is at the horizon by day. */
  opacity: 0.3,
  /** And at night, when the sky behind it is dark and a lift shows more. */
  nightOpacity: 0.16,
  /** Sat just inside the star dome, beyond anything the plateau draws. */
  radius: DOME_RADIUS * 0.985,
  segments: { azimuth: 64, altitude: 8 },
} as const;

/** The band, as a strip of triangles carrying their own alpha. */
function hazeGeometry(): BufferGeometry {
  const { fromAzimuth, toAzimuth, fromAltitude, toAltitude, taper, radius, segments } = HAZE;
  const columns = segments.azimuth + 1;
  const rows = segments.altitude + 1;
  const position = new Float32Array(columns * rows * 3);
  const colour = new Float32Array(columns * rows * 4);
  const index: number[] = [];
  for (let c = 0; c < columns; c++) {
    const u = c / segments.azimuth;
    const azimuth = fromAzimuth + (toAzimuth - fromAzimuth) * u;
    // Out to nothing at each end of the arc, so the band has no vertical edge.
    const ends = Math.min(azimuth - fromAzimuth, toAzimuth - azimuth) / taper;
    const across = Math.min(1, Math.max(0, ends));
    for (let r = 0; r < rows; r++) {
      const v = r / segments.altitude;
      const altitude = fromAltitude + (toAltitude - fromAltitude) * v;
      const a = (azimuth * Math.PI) / 180;
      const h = (altitude * Math.PI) / 180;
      const i = c * rows + r;
      // The data frame: +X east, +Y north, +Z up, azimuth from north through east.
      position[i * 3] = radius * Math.cos(h) * Math.sin(a);
      position[i * 3 + 1] = radius * Math.cos(h) * Math.cos(a);
      position[i * 3 + 2] = radius * Math.sin(h);
      // Densest at the bottom and gone by the top, which is what a layer of
      // air held down by its own weight looks like from outside it.
      const up = Math.max(0, (altitude - fromAltitude) / (toAltitude - fromAltitude));
      colour[i * 4] = 1;
      colour[i * 4 + 1] = 1;
      colour[i * 4 + 2] = 1;
      colour[i * 4 + 3] = across * across * (1 - up) * (1 - up);
      if (c < segments.azimuth && r < segments.altitude) {
        const next = (c + 1) * rows + r;
        index.push(i, next, i + 1, next, next + 1, i + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('color', new BufferAttribute(colour, 4));
  geometry.setIndex(index);
  return geometry;
}

function CairoHaze({ night }: { night: number }): React.JSX.Element {
  const transition = useStateTransition();
  const geometry = useMemo(() => hazeGeometry(), []);
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: HAZE.colour,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        fog: false,
      }),
    [],
  );
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  // The band comes and goes with the timeline's own dissolve rather than
  // cutting, which is the same eight tenths of a second everything else takes.
  useFrame(() => {
    const { from, to, t } = transition;
    const presence = (to === 'today' ? t : 0) + (from === 'today' ? 1 - t : 0);
    material.opacity = presence * (HAZE.opacity + (HAZE.nightOpacity - HAZE.opacity) * night);
    material.visible = material.opacity > 0.002;
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={-8} />;
}

/** The deep blue a clear desert night actually is, and the lift at the horizon. Look choices. */
const NIGHT_SKY = { zenith: new Color('#1b2436'), horizon: new Color('#2b3448') };

/** How bright the Milky Way is drawn over that. A look choice. */
const MILKY_WAY_STRENGTH = 0.9;

/**
 * The night sky: a deep blue dome with NASA's Milky Way laid over it.
 *
 * The map is the Deep Star Maps 2020 (SVS 4851, public domain), the galaxy's
 * diffuse light with the stars left out, as `scripts/web-textures.py` writes
 * it out of the same EXR `blender/render_sky.py` reads: an equirectangular
 * map on J2000 axes, centred at right ascension zero with right ascension
 * increasing to the left.
 *
 * The sphere is turned by the precession to the epoch and then into the
 * horizon frame, which is the product the sky bake calls `icrsToEnu`, so the
 * band lies among the very stars the dome draws. The blue behind it and the
 * strength over it are look choices; the map is a picture and never a
 * measurement.
 *
 * It is one mesh and not two because the shader wants both frames anyway: the
 * sphere's own local direction is ICRS, which is what samples the map, and
 * its world direction is what says how far up the sky a fragment is.
 */
function NightSky({
  epoch,
  latitudeDeg,
  lstDeg,
  opacity,
}: {
  epoch: number;
  latitudeDeg: number;
  lstDeg: number;
  opacity: number;
}): React.JSX.Element | null {
  const [texture, setTexture] = useState<Texture | undefined>(undefined);

  useEffect(() => {
    let live = true;
    new TextureLoader().load(
      `${import.meta.env.BASE_URL}sky/milkyway-2k.webp`,
      (loaded) => {
        loaded.colorSpace = SRGBColorSpace;
        loaded.wrapS = RepeatWrapping;
        loaded.anisotropy = 4;
        if (live) setTexture(loaded);
        else loaded.dispose();
      },
      undefined,
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          milkyWay: { value: null },
          milkyWayStrength: { value: 0 },
          nightOpacity: { value: 0 },
          nightZenith: { value: NIGHT_SKY.zenith },
          nightHorizon: { value: NIGHT_SKY.horizon },
        },
        vertexShader: NIGHT_SKY_VERTEX,
        fragmentShader: NIGHT_SKY_FRAGMENT,
        side: BackSide,
        depthWrite: false,
        transparent: true,
        fog: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    material.uniforms.milkyWay!.value = texture ?? null;
    // The material is first compiled with nothing in that sampler, because
    // the blue behind the galaxy should be up before the galaxy has loaded.
    // Three binds its own empty texture for a null sampler and will not go
    // back to look again, so the arrival is a recompile.
    material.needsUpdate = true;
    material.uniforms.milkyWayStrength!.value = MILKY_WAY_STRENGTH;
    // The blue comes up through twilight with the stars, so the sunset is not
    // painted over while it is still a sunset.
    material.uniforms.nightOpacity!.value = opacity;
  }, [material, texture, opacity]);

  const geometry = useMemo(() => new SphereGeometry(DOME_RADIUS * 0.995, 64, 40), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const rotation = useMemo(
    () => product(equatorialToHorizon(latitudeDeg, lstDeg), ltpb(epoch)),
    [latitudeDeg, lstDeg, epoch],
  );
  const sphere = useRef<Mesh>(null);
  useEffect(() => {
    const object = sphere.current;
    if (!object) return;
    object.matrixAutoUpdate = false;
    object.matrix.set(
      rotation[0]![0]!, rotation[0]![1]!, rotation[0]![2]!, 0,
      rotation[1]![0]!, rotation[1]![1]!, rotation[1]![2]!, 0,
      rotation[2]![0]!, rotation[2]![1]!, rotation[2]![2]!, 0,
      0, 0, 0, 1,
    );
    object.matrixWorldNeedsUpdate = true;
  }, [rotation, texture]);

  return <mesh ref={sphere} geometry={geometry} material={material} frustumCulled={false} renderOrder={-9} />;
}

/** Rows-first three by three product, in the shape `@seked/sky` writes a rotation. */
function product(a: Mat3, b: Mat3): Mat3 {
  const out: number[][] = [];
  for (let i = 0; i < 3; i++) {
    const row: number[] = [];
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) sum += (a[i]![k] as number) * (b[k]![j] as number);
      row.push(sum);
    }
    out.push(row);
  }
  return out as unknown as Mat3;
}

const NIGHT_SKY_VERTEX = `
varying vec3 vLocal;
varying vec3 vWorld;
void main() {
  vLocal = position;
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// The map's own layout, read back: right ascension zero at the middle of the
// image and increasing leftwards, declination from the south pole at the
// bottom. The direction is the sphere's own local one, and the sphere's
// matrix is what makes local mean ICRS.
const NIGHT_SKY_FRAGMENT = `
uniform sampler2D milkyWay;
uniform float milkyWayStrength;
uniform float nightOpacity;
uniform vec3 nightZenith;
uniform vec3 nightHorizon;
varying vec3 vLocal;
varying vec3 vWorld;
#define SEKED_PI 3.141592653589793
void main() {
  // The sky's own colour, by how far up the fragment is in the world frame.
  float up = normalize(vWorld).y;
  vec3 colour = mix(nightHorizon, nightZenith, smoothstep(0.0, 0.4, up));
  // And the galaxy over it, sampled by the sphere's local direction, which
  // this mesh's matrix has made an ICRS one.
  vec3 d = normalize(vLocal);
  float u = 0.5 - atan(d.y, d.x) / (2.0 * SEKED_PI);
  float v = 0.5 + asin(clamp(d.z, -1.0, 1.0)) / SEKED_PI;
  colour += texture2D(milkyWay, vec2(u, v)).rgb * milkyWayStrength;
  gl_FragColor = vec4(colour, nightOpacity);
}
`;
