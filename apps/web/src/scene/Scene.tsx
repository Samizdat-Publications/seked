import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ComponentRef } from 'react';
import type { Model } from '../model';
import type { OverlaySpec } from '../overlays';
import { sectionPlanes } from '../section';
import type { DomeBuffers, NamedDomeStar } from '../sky';
import { useView } from '../store';
import type { LayerId } from '../view';
import { useAtmosphere } from './Atmosphere';
import { ClaimOverlay } from './ClaimOverlay';
import { FadeScope } from './fade';
import { Renderer } from './Renderer';
import { Sky, useSun } from './Sky';
import { FlyCamera } from './FlyCamera';
import { Interiors } from './Interior';
import { NorthArrow } from './NorthArrow';
import { Masses } from './Masses';
import { Pyramids } from './Pyramids';
import { Standins } from './Standins';
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
  /** The epoch the scene is drawn at, which the sun and the dome share (see `sceneEpoch`). */
  epoch: number;
}

/**
 * Behind the sky box there is nothing to see, and the sky box covers every
 * direction, so the background only shows through the one frame before the
 * shader compiles. It is near black because a flash of slate is worse than a
 * flash of night.
 *
 * Neither the sun nor the sky's own light is chosen here any more. The sun is
 * the cascaded shadow maps' lights in `Renderer.tsx` and the fill is the
 * hemisphere and ambient in `Sky.tsx`, both placed by `@seked/sky` for the
 * day and hour on the timeline, so the scene cannot be lit from a direction
 * the astronomy does not put the sun in.
 */
const BACKGROUND = '#05070c';

/**
 * The data is +X east, +Y north, +Z up; three is Y-up. One rotation of the
 * whole group reconciles them, so no geometry is rewritten and a vertex in
 * the browser is the vertex in Blender.
 */
export function Scene({ model, terrain, layers, overlay, sky, epoch }: SceneProps): React.JSX.Element {
  const start = useRef(useView.getState().camera).current;
  // The observer is the Great Pyramid's own centre, which is where every sky
  // number in this project is reckoned from.
  const observer = useMemo(
    () => ({ latitudeDeg: model.latitudeDeg, longitudeDeg: model.env['g1.center.longitude'] ?? 0 }),
    [model],
  );
  const sun = useSun(observer, epoch);
  // The air is shared uniforms rather than a component, because every material
  // in the scene reads the same ones.
  useAtmosphere(sun);
  const mode = useView((s) => s.mode);
  const section = useView((s) => s.section);
  const planes = useMemo(() => sectionPlanes(section), [section]);
  const groundPlanes = useMemo(() => sectionPlanes(section, section.ground), [section]);

  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: false, powerPreference: 'high-performance' }} camera={{ fov: 45, near: 1, far: 40000, position: start.position }}>
      <color attach="background" args={[BACKGROUND]} />

      {layers.grid && <gridHelper args={[6000, 60, '#38475a', '#1d2630']} />}

      <group rotation={[-Math.PI / 2, 0, 0]}>
        <Sky sun={sun} observer={observer} stars={sky} furniture={layers.sky} />
        {/* Everything the timeline changes dissolves between stops; the sky
            and the annotations outside the scope do not. */}
        <FadeScope>
          <Plateau {...terrain} context={layers.terrain} ground={layers.ground} clippingPlanes={groundPlanes} />
          {layers.pyramids && <Pyramids pyramids={model.pyramids} today={layers.today} clippingPlanes={planes} />}
          {layers.pyramids && <Masses massings={model.massings} plateau={model.plateau} clippingPlanes={planes} />}
          {layers.interior && <Interiors interiors={model.interiors} clippingPlanes={planes} />}
          <Standins />
        </FadeScope>
        {layers.north && <NorthArrow />}
        {layers.overlay && overlay && <ClaimOverlay overlay={overlay} pyramids={model.pyramids} clippingPlanes={planes} />}
      </group>

      {mode === 'fly' ? <FlyCamera /> : <Controls />}
      {/* Last, because from here the composer does the drawing. */}
      <Renderer sun={sun} />
    </Canvas>
  );
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
