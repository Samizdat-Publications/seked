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
import { useThree } from '@react-three/fiber';
import { enuDirection, equatorialToHorizon, ltpb, sunAt, type Mat3, type SunPosition } from '@seked/sky/browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BackSide,
  Color,
  Mesh,
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
import { sceneEpoch } from '../view';
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
export function useSun({ latitudeDeg, longitudeDeg }: Observer): Sun {
  const override = useView((s) => s.epoch);
  const day = useView((s) => s.moment.day);
  const hour = useView((s) => s.moment.hour);
  const epoch = sceneEpoch(override, undefined);
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

const SKY_LOOK: ReadonlyArray<SkyLook> = [
  { altitude: -18, turbidity: 3.0, rayleigh: 0.35, mie: 0.004, mieG: 0.8, fill: 0.03, ambient: 0.025 },
  { altitude: -6, turbidity: 4.0, rayleigh: 1.4, mie: 0.006, mieG: 0.82, fill: 0.08, ambient: 0.04 },
  { altitude: 0, turbidity: 8.0, rayleigh: 3.2, mie: 0.02, mieG: 0.88, fill: 0.22, ambient: 0.07 },
  { altitude: 8, turbidity: 6.0, rayleigh: 2.4, mie: 0.012, mieG: 0.84, fill: 0.34, ambient: 0.09 },
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

/** The colour of the sky's own light and of the ground's bounce. Look choices. */
const ZENITH = new Color('#82a9da');
const DUSK_ZENITH = new Color('#45577f');
const NIGHT_ZENITH = new Color('#111c35');
const BOUNCE = new Color('#6b5a3e');
const NIGHT_AMBIENT = new Color('#16243f');
const DAY_AMBIENT = new Color('#bcccdf');

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
 * The sky, the fill light, the environment map, and the night behind them.
 * Mounts inside the rotated group.
 */
export function Sky({ sun, observer, stars, furniture }: SkyProps): React.JSX.Element {
  const lst = useView((s) => s.lst);
  const override = useView((s) => s.epoch);
  const epoch = sceneEpoch(override, undefined);
  const look = skyLook(sun.altitudeDeg);
  const night = nightness(sun.altitudeDeg);

  // The fill goes from the daylit zenith through dusk to a deep blue, which
  // is the one colour a shadowed face takes when the sun has gone.
  const fill = useMemo(() => {
    const dusk = Math.min(1, Math.max(0, (8 - sun.altitudeDeg) / 14));
    return new Color().lerpColors(ZENITH, DUSK_ZENITH, dusk).lerp(NIGHT_ZENITH, night);
  }, [sun.altitudeDeg, night]);
  const ambient = useMemo(() => new Color().lerpColors(DAY_AMBIENT, NIGHT_AMBIENT, night), [night]);

  return (
    <group>
      <Atmosphere sun={sun} look={look} night={night} />
      {/* A hemisphere light's up is the direction of its own position in the
          world, and this group has already been turned, so what it is given
          here is the data frame's up. */}
      <hemisphereLight position={[0, 0, 1]} color={fill} groundColor={BOUNCE} intensity={look.fill} />
      <ambientLight color={ambient} intensity={look.ambient} />
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
 * The sky itself: three's Preetham model on a box drawn at the far plane, and
 * a pre-filtered map of the same shader set as the scene's environment, so
 * every standard material reflects the sky it is standing under. The
 * environment is what puts light on a north face at noon, and what the
 * polished casing will want in the ancient state.
 */
function Atmosphere({ sun, look, night }: { sun: Sun; look: SkyLook; night: number }): React.JSX.Element {
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
  // renderer is drawing the graph. It is rebuilt when the sun moves, which is
  // only when the reader moves the timeline.
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const probe = new PreethamSky();
    probe.scale.setScalar(SKY_SCALE);
    const u = probe.material.uniforms;
    u.sunPosition!.value.copy(sun.direction);
    u.turbidity!.value = look.turbidity;
    u.rayleigh!.value = rayleigh;
    u.mieCoefficient!.value = look.mie;
    u.mieDirectionalG!.value = look.mieG;
    u.showSunDisc!.value = 0;
    const world = new ThreeScene();
    world.add(probe);
    let target: WebGLRenderTarget | undefined;
    try {
      target = pmrem.fromScene(world, 0, 1, SKY_SCALE);
      scene.environment = target.texture;
      // At full strength the sky washes every shadow out of a desert at noon.
      scene.environmentIntensity = ENVIRONMENT_STRENGTH * (1 - night * 0.85);
    } catch (error) {
      console.warn('seked: could not build the sky environment map', error);
    }
    return () => {
      scene.environment = null;
      target?.dispose();
      probe.geometry.dispose();
      probe.material.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, sun, look, rayleigh, night]);

  return <primitive object={mesh} scale={SKY_SCALE} renderOrder={-10} />;
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
