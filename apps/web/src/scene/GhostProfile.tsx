import { DEG } from '@seked/units';
import { useEffect, useMemo } from 'react';
import type { PyramidParams } from '../model';
import type { GhostProfile as Profile, GhostProfileSpec } from '../overlays';
import { pyramidGeometry } from './geometry';

/**
 * The claimed profile over the measured one. Same base, same place, same
 * rotation; only the apex moves, to where the claim's slope puts it. Where a
 * claim offers several slopes they are drawn together, which is the point of
 * A3: at this base the π and φ apexes are 14 cm apart, so the ghosts sit
 * inside the monument and inside each other. They are drawn without depth
 * testing so they read as an overlay rather than disappearing into the
 * stone; the panel gives the angles, which is where the difference lives.
 */
export function GhostProfiles({ spec, pyramids }: { spec: GhostProfileSpec; pyramids: PyramidParams[] }): React.JSX.Element | null {
  const params = pyramids.find((p) => p.id === spec.structure);
  if (!params) return null;
  return (
    <>
      {spec.profiles.map((profile) => (
        <Ghost key={profile.label} params={params} profile={profile} />
      ))}
    </>
  );
}

function Ghost({ params, profile }: { params: PyramidParams; profile: Profile }): React.JSX.Element {
  const height = (params.base / 2) * Math.tan(profile.slopeDeg * DEG);
  const geometry = useMemo(() => pyramidGeometry({ base: params.base, height }), [params.base, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const place = {
    position: [params.offsetEast, params.offsetNorth, params.offsetUp] as [number, number, number],
    rotation: [0, 0, params.orientationDeg * DEG] as [number, number, number],
  };

  return (
    <group {...place}>
      <mesh geometry={geometry} renderOrder={2}>
        <meshBasicMaterial color={profile.colour} transparent opacity={0.14} depthWrite={false} depthTest={false} toneMapped={false} />
      </mesh>
      <mesh geometry={geometry} renderOrder={3}>
        <meshBasicMaterial color={profile.colour} wireframe transparent opacity={0.65} depthWrite={false} depthTest={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
