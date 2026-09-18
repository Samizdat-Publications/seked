import { DEG } from '@seked/units';
import { useEffect, useMemo } from 'react';
import type { Plane } from 'three';
import type { PyramidParams } from '../model';
import type { GhostProfile as Profile, GhostProfileSpec } from '../overlays';
import { pyramidGeometry } from './geometry';

/**
 * The claimed profile over the measured one. Same base, same place, same
 * rotation; only the apex moves, to where the claim's slope puts it. Where a
 * claim offers several slopes they are drawn together, which is the point of
 * A3: at this base the π and φ apexes are 14 cm apart, so the ghosts sit
 * inside the monument and inside each other. The panel gives the angles,
 * which is where the difference lives.
 *
 * A ghost is a solid inside a solid, so it is drawn twice, the way the lines
 * are: once depth tested, which puts it in the scene with everything else,
 * and once over the top at a third of the strength, so the part of it buried
 * in the monument is still there to be read and is plainly the buried part.
 */
export function GhostProfiles({
  spec,
  pyramids,
  clippingPlanes,
  proposed = false,
}: {
  spec: GhostProfileSpec;
  pyramids: PyramidParams[];
  clippingPlanes: Plane[];
  /** True when the claim was put to the model rather than filed by a person. */
  proposed?: boolean;
}): React.JSX.Element | null {
  const params = pyramids.find((p) => p.id === spec.structure);
  if (!params) return null;
  return (
    <>
      {spec.profiles.map((profile) => (
        <Ghost key={profile.label} params={params} profile={profile} clippingPlanes={clippingPlanes} proposed={proposed} />
      ))}
    </>
  );
}

/**
 * How much of itself the ghost's occluded pass keeps. Higher than the lines'
 * third, because a ghost at a claimed slope is buried in the monument along
 * its whole length and the buried part is the whole of the drawing, where a
 * ray or a bearing is mostly in the open and only dips into stone.
 */
const OCCLUDED = 0.5;

function Ghost({
  params,
  profile,
  clippingPlanes,
  proposed,
}: {
  params: PyramidParams;
  profile: Profile;
  clippingPlanes: Plane[];
  proposed: boolean;
}): React.JSX.Element {
  const height = (params.base / 2) * Math.tan(profile.slopeDeg * DEG);
  const geometry = useMemo(() => pyramidGeometry({ base: params.base, height }), [params.base, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  // A mesh cannot be dashed the way a line can, so a proposed claim's ghost
  // says so by standing at three quarters of the strength of a filed one and
  // by the `proposed` word on its label.
  const strength = proposed ? 0.75 : 1;
  const place = {
    position: [params.offsetEast, params.offsetNorth, params.offsetUp] as [number, number, number],
    rotation: [0, 0, params.orientationDeg * DEG] as [number, number, number],
  };

  return (
    <group {...place}>
      <mesh geometry={geometry} renderOrder={2}>
        <meshBasicMaterial
          color={profile.colour}
          transparent
          opacity={0.14 * strength}
          depthWrite={false}
          toneMapped={false}
          clippingPlanes={clippingPlanes}
        />
      </mesh>
      <mesh geometry={geometry} renderOrder={3}>
        <meshBasicMaterial
          color={profile.colour}
          wireframe
          transparent
          opacity={0.65 * strength}
          depthWrite={false}
          toneMapped={false}
          clippingPlanes={clippingPlanes}
        />
      </mesh>
      <mesh geometry={geometry} renderOrder={4}>
        <meshBasicMaterial
          color={profile.colour}
          wireframe
          transparent
          opacity={0.65 * strength * OCCLUDED}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
          clippingPlanes={clippingPlanes}
        />
      </mesh>
    </group>
  );
}
