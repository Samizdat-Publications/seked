import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ComponentRef } from 'react';
import type { Model } from '../model';
import type { GhostProfileSpec } from '../overlays';
import { sectionPlanes } from '../section';
import { useView } from '../store';
import type { LayerId } from '../view';
import { FlyCamera } from './FlyCamera';
import { GhostProfiles } from './GhostProfile';
import { Interiors } from './Interior';
import { NorthArrow } from './NorthArrow';
import { Pyramids } from './Pyramids';
import { Plateau, type TerrainProps } from './Terrain';

export interface SceneProps {
  model: Model;
  terrain: TerrainProps;
  layers: Record<LayerId, boolean>;
  /** The overlay of the selected claim, where the viewer can draw it. */
  ghosts: GhostProfileSpec | undefined;
}

const SKY = '#0f1319';

/**
 * The data is +X east, +Y north, +Z up; three is Y-up. One rotation of the
 * whole group reconciles them, so no geometry is rewritten and a vertex in
 * the browser is the vertex in Blender.
 */
export function Scene({ model, terrain, layers, ghosts }: SceneProps): React.JSX.Element {
  const start = useRef(useView.getState().camera).current;
  const mode = useView((s) => s.mode);
  const section = useView((s) => s.section);
  const planes = useMemo(() => sectionPlanes(section), [section]);
  const groundPlanes = useMemo(() => sectionPlanes(section, section.ground), [section]);

  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 45, near: 1, far: 40000, position: start.position }}>
      <color attach="background" args={[SKY]} />
      <fog attach="fog" args={[SKY, 4000, 13000]} />
      <hemisphereLight args={['#b9cbe0', '#3b3327', 0.7]} />
      <ambientLight intensity={0.25} />
      {/* High in the south-west, so the north and east faces separate. */}
      <directionalLight position={[-1400, 1700, 1100]} intensity={2.4} color="#fff3e0" />

      <LocalClipping />
      {layers.grid && <gridHelper args={[6000, 60, '#38475a', '#1d2630']} />}

      <group rotation={[-Math.PI / 2, 0, 0]}>
        <Plateau {...terrain} context={layers.terrain} ground={layers.ground} clippingPlanes={groundPlanes} />
        {layers.pyramids && <Pyramids pyramids={model.pyramids} today={layers.today} clippingPlanes={planes} />}
        {layers.interior && <Interiors interiors={model.interiors} clippingPlanes={planes} />}
        {layers.north && <NorthArrow />}
        {layers.overlay && ghosts && <GhostProfiles spec={ghosts} pyramids={model.pyramids} clippingPlanes={planes} />}
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
