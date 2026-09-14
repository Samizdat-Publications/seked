import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ComponentRef } from 'react';
import type { Model } from '../model';
import type { OverlaySpec } from '../overlays';
import { sectionPlanes } from '../section';
import { DOME_RADIUS, type DomeBuffers, type NamedDomeStar } from '../sky';
import { useView } from '../store';
import type { LayerId } from '../view';
import { ClaimOverlay } from './ClaimOverlay';
import { FlyCamera } from './FlyCamera';
import { Interiors } from './Interior';
import { NorthArrow } from './NorthArrow';
import { Pyramids } from './Pyramids';
import { SkyDome } from './SkyDome';
import { Plateau, type TerrainProps } from './Terrain';

/** The stars of the moment, or undefined when the sky layer is off. */
export interface SkyProps {
  buffers: DomeBuffers;
  named: NamedDomeStar[];
  latitudeDeg: number;
  lstDeg: number;
}

export interface SceneProps {
  model: Model;
  terrain: TerrainProps;
  layers: Record<LayerId, boolean>;
  /** The overlay of the selected claim, where the viewer can draw it. */
  overlay: OverlaySpec | undefined;
  sky: SkyProps | undefined;
}

/**
 * Two skies. By day the background is the flat slate the monuments were
 * modelled against; with the star dome on it goes to something near black and
 * the lights come down with it, because a plateau lit like noon under a sky
 * full of stars is a picture of nothing.
 */
const DAY = {
  background: '#0f1319',
  fog: [4000, 13000] as const,
  hemisphere: { sky: '#b9cbe0', ground: '#3b3327', intensity: 0.7 },
  ambient: 0.25,
  sun: { position: [-1400, 1700, 1100] as const, intensity: 2.4, colour: '#fff3e0' },
};

const NIGHT = {
  background: '#04070d',
  fog: [6000, 26000] as const,
  hemisphere: { sky: '#243448', ground: '#0a0b0f', intensity: 0.22 },
  ambient: 0.06,
  sun: { position: [900, 1500, -1200] as const, intensity: 0.34, colour: '#aec4ea' },
};

/**
 * The data is +X east, +Y north, +Z up; three is Y-up. One rotation of the
 * whole group reconciles them, so no geometry is rewritten and a vertex in
 * the browser is the vertex in Blender.
 */
export function Scene({ model, terrain, layers, overlay, sky }: SceneProps): React.JSX.Element {
  const start = useRef(useView.getState().camera).current;
  const mode = useView((s) => s.mode);
  const section = useView((s) => s.section);
  const planes = useMemo(() => sectionPlanes(section), [section]);
  const groundPlanes = useMemo(() => sectionPlanes(section, section.ground), [section]);
  const light = layers.sky ? NIGHT : DAY;

  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 45, near: 1, far: 40000, position: start.position }}>
      <color attach="background" args={[light.background]} />
      <fog attach="fog" args={[light.background, light.fog[0], light.fog[1]]} />
      <hemisphereLight args={[light.hemisphere.sky, light.hemisphere.ground, light.hemisphere.intensity]} />
      <ambientLight intensity={light.ambient} />
      {/* By day, high in the south-west so the north and east faces separate. */}
      <directionalLight position={[...light.sun.position]} intensity={light.sun.intensity} color={light.sun.colour} />

      <LocalClipping />
      {layers.grid && <gridHelper args={[6000, 60, '#38475a', '#1d2630']} />}

      <group rotation={[-Math.PI / 2, 0, 0]}>
        {layers.sky && sky && <SkyDome {...sky} radius={DOME_RADIUS} />}
        <Plateau {...terrain} context={layers.terrain} ground={layers.ground} clippingPlanes={groundPlanes} />
        {layers.pyramids && <Pyramids pyramids={model.pyramids} massings={model.massings} today={layers.today} clippingPlanes={planes} />}
        {layers.interior && <Interiors interiors={model.interiors} clippingPlanes={planes} />}
        {layers.north && <NorthArrow />}
        {layers.overlay && overlay && <ClaimOverlay overlay={overlay} pyramids={model.pyramids} clippingPlanes={planes} />}
      </group>

      {mode === 'fly' ? <FlyCamera /> : <Controls />}
    </Canvas>
  );
}

/**
 * Clipping per material rather than per scene, so the section can take the
 * masonry and leave the ground standing.
 */
function LocalClipping(): null {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);
  return null;
}

function Controls(): React.JSX.Element {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const setCamera = useView((s) => s.setCamera);
  const epoch = useView((s) => s.cameraEpoch);

  // On mount, and again whenever the panel moves the camera itself, adopt the
  // camera in the store. The controls' own changes do not bump the epoch, so
  // this cannot fight a drag.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const { camera } = useView.getState();
    c.object.position.set(...camera.position);
    c.target.set(...camera.target);
    c.update();
  }, [epoch]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      minDistance={2}
      maxDistance={14000}
      maxPolarAngle={Math.PI * 0.495}
      onChange={() => {
        const c = controls.current;
        if (!c) return;
        const p = c.object.position;
        const t = c.target;
        setCamera({ position: [p.x, p.y, p.z], target: [t.x, t.y, t.z] });
      }}
    />
  );
}
