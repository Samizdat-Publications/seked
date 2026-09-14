import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useRef, type ComponentRef } from 'react';
import type { Model } from '../model';
import { useView } from '../store';
import type { LayerId } from '../view';
import { NorthArrow } from './NorthArrow';
import { Pyramids } from './Pyramids';
import { Terrain, type TerrainProps } from './Terrain';

export interface SceneProps {
  model: Model;
  terrain: TerrainProps;
  layers: Record<LayerId, boolean>;
}

const SKY = '#0f1319';

/**
 * The data is +X east, +Y north, +Z up; three is Y-up. One rotation of the
 * whole group reconciles them, so no geometry is rewritten and a vertex in
 * the browser is the vertex in Blender.
 */
export function Scene({ model, terrain, layers }: SceneProps): React.JSX.Element {
  const start = useRef(useView.getState().camera).current;
  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 45, near: 1, far: 40000, position: start.position }}>
      <color attach="background" args={[SKY]} />
      <fog attach="fog" args={[SKY, 4000, 13000]} />
      <hemisphereLight args={['#b9cbe0', '#3b3327', 0.7]} />
      <ambientLight intensity={0.25} />
      {/* High in the south-west, so the north and east faces separate. */}
      <directionalLight position={[-1400, 1700, 1100]} intensity={2.4} color="#fff3e0" />

      {layers.grid && <gridHelper args={[6000, 60, '#38475a', '#1d2630']} />}

      <group rotation={[-Math.PI / 2, 0, 0]}>
        {layers.terrain && <Terrain {...terrain} />}
        {layers.pyramids && <Pyramids pyramids={model.pyramids} today={layers.today} />}
        {layers.north && <NorthArrow />}
      </group>

      <Controls />
    </Canvas>
  );
}

function Controls(): React.JSX.Element {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const setCamera = useView((s) => s.setCamera);
  const start = useRef(useView.getState().camera).current;

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    c.target.set(...start.target);
    c.update();
  }, [start]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      minDistance={40}
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
