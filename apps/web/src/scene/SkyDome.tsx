/**
 * The sky over the plateau: the bundled catalogue as one point cloud, a
 * horizon ring with the four cardinal points, and the stars the claims name
 * picked out and labelled.
 *
 * The cloud is built in equatorial coordinates of date (see ../sky.ts) and
 * placed by a single rotation, so dragging the sidereal-time slider turns one
 * object rather than rebuilding five thousand positions, and the epoch slider
 * is the only control that touches the buffers. Below the horizon a star is
 * dropped in the vertex shader, which costs nothing and needs no second
 * buffer.
 */
import { useThree } from '@react-three/fiber';
import { apply, equatorialToHorizon, type Vec3 } from '@seked/sky/browser';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial, type Points } from 'three';
import type { DomeBuffers, NamedDomeStar } from '../sky';
import { lineGeometry, polylineGeometry, ringPoints } from './geometry';
import { Label } from './Label';

const VERTEX = `
attribute float aSize;
attribute vec3 aColour;
uniform float uScale;
varying vec3 vColour;
void main() {
  vColour = aColour;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec4 view = viewMatrix * world;
  gl_Position = projectionMatrix * view;
  gl_PointSize = aSize * uScale / max(1.0, -view.z);
  // Under the horizon there is no star to draw: put it outside the clip
  // volume rather than filtering the buffer, which would undo the point of
  // building it once per epoch.
  if (world.y < 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const FRAGMENT = `
varying vec3 vColour;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  // GLSL leaves smoothstep undefined when the edges are the wrong way
  // round, so the fall-off is written forwards and inverted.
  gl_FragColor = vec4(vColour, 1.0 - smoothstep(0.015, 0.25, r2));
}
`;

const HORIZON = '#33506b';
const CARDINALS: ReadonlyArray<readonly [string, number]> = [
  ['N', 0],
  ['E', 90],
  ['S', 180],
  ['W', 270],
];

export interface SkyDomeProps {
  buffers: DomeBuffers;
  named: NamedDomeStar[];
  latitudeDeg: number;
  lstDeg: number;
  radius: number;
}

export function SkyDome({ buffers, named, latitudeDeg, lstDeg, radius }: SkyDomeProps): React.JSX.Element {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(buffers.positions, 3));
    g.setAttribute('aColour', new BufferAttribute(buffers.colours, 3));
    g.setAttribute('aSize', new BufferAttribute(buffers.sizes, 1));
    g.boundingSphere = null;
    return g;
  }, [buffers]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // gl_PointSize is in framebuffer pixels, so a star's size has to carry the
  // device pixel ratio or it halves on a retina screen; the radius is in it
  // too, which is what makes the size the one the star would have at the dome.
  const pixelRatio = useThree((state) => state.gl.getPixelRatio());
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uScale: { value: radius * pixelRatio } },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [radius, pixelRatio],
  );
  useEffect(() => () => material.dispose(), [material]);

  // The whole sphere turns with sidereal time. Three's own frame is Y-up and
  // the scene group has already turned the data frame into it, so this
  // rotation is expressed in the data frame like everything else: a matrix of
  // the three rows east, north and up.
  const rotation = useMemo(() => equatorialToHorizon(latitudeDeg, lstDeg), [latitudeDeg, lstDeg]);
  const cloud = useRef<Points>(null);
  useLayoutEffect(() => {
    const object = cloud.current;
    if (!object) return;
    const m = rotation;
    object.matrixAutoUpdate = false;
    object.matrix.set(
      m[0][0] as number, m[0][1] as number, m[0][2] as number, 0,
      m[1][0] as number, m[1][1] as number, m[1][2] as number, 0,
      m[2][0] as number, m[2][1] as number, m[2][2] as number, 0,
      0, 0, 0, 1,
    );
    object.matrixWorldNeedsUpdate = true;
  }, [rotation]);

  const turn = useMemo(() => {
    const m = rotation;
    return (v: readonly number[]): Vec3 => apply(m, [v[0] as number, v[1] as number, v[2] as number]);
  }, [rotation]);

  const visible = useMemo(
    () => named.map((star) => ({ star, at: turn(star.at) })).filter((s) => s.at[2] > 0),
    [named, turn],
  );

  return (
    <group>
      {/* The cloud is built in equatorial coordinates and turned into place
          by its own matrix, which is what makes the sidereal-time slider free. */}
      <points ref={cloud} frustumCulled={false}>
        <primitive object={geometry} attach="geometry" />
        <primitive object={material} attach="material" />
      </points>
      <Horizon radius={radius} />
      {visible.map(({ star, at }) => (
        <Label
          key={star.id}
          text={star.name}
          position={[at[0] * 0.985, at[1] * 0.985, at[2] * 0.985 + radius * 0.022]}
          colour="#cfe0f2"
          opacity={0.85}
        />
      ))}
    </group>
  );
}

/** The horizon and the four quarters, which is how a reader checks an azimuth. */
function Horizon({ radius }: { radius: number }): React.JSX.Element {
  const ring = useMemo(() => polylineGeometry(ringPoints(radius * 0.995, 0), true), [radius]);
  const ticks = useMemo(() => {
    const points: number[][] = [];
    for (const [, azimuth] of CARDINALS) {
      const a = (azimuth * Math.PI) / 180;
      const r = radius * 0.995;
      points.push([r * Math.sin(a), r * Math.cos(a), 0], [r * Math.sin(a), r * Math.cos(a), radius * 0.05]);
    }
    // Already pairs, one segment per quarter, so no polyline expansion.
    return lineGeometry(points);
  }, [radius]);
  useEffect(() => () => {
    ring.dispose();
    ticks.dispose();
  }, [ring, ticks]);

  return (
    <group>
      <lineSegments geometry={ring} frustumCulled={false}>
        <lineBasicMaterial color={HORIZON} transparent opacity={0.75} fog={false} toneMapped={false} />
      </lineSegments>
      <lineSegments geometry={ticks} frustumCulled={false}>
        <lineBasicMaterial color={HORIZON} fog={false} toneMapped={false} />
      </lineSegments>
      {CARDINALS.map(([name, azimuth]) => {
        const a = (azimuth * Math.PI) / 180;
        const r = radius * 0.995;
        return (
          <Label
            key={name}
            text={name}
            position={[r * Math.sin(a), r * Math.cos(a), radius * 0.075]}
            colour="#8fb4d6"
          />
        );
      })}
    </group>
  );
}
