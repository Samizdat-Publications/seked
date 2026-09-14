/**
 * The claim overlays that are not ghost profiles: the shaft rays and the
 * descending passage's ray, with the rest to follow.
 *
 * Every one of them is drawn from a spec built in ../overlays.ts out of the
 * claim file's own params, so nothing here knows which claim it is serving.
 * They are drawn without depth testing, like the ghost profiles: a ray that
 * starts in the King's Chamber and a rose on the pavement are both inside
 * solid masonry, and an overlay that is invisible until the reader finds the
 * section plane is no overlay at all.
 */
import { formatDms } from '@seked/units';
import { useEffect, useMemo } from 'react';
import type { Plane } from 'three';
import type { OverlaySpec, PassageRaySpec, ShaftRaysSpec, StarMark } from '../overlays';
import { DOME_RADIUS } from '../sky';
import type { PyramidParams } from '../model';
import { GhostProfiles } from './GhostProfile';
import { lineGeometry } from './geometry';
import { Label, Marker } from './Label';

export function ClaimOverlay({
  overlay,
  pyramids,
  clippingPlanes,
}: {
  overlay: OverlaySpec;
  pyramids: PyramidParams[];
  clippingPlanes: Plane[];
}): React.JSX.Element | null {
  switch (overlay.kind) {
    case 'ghost-profile':
      return <GhostProfiles spec={overlay.spec} pyramids={pyramids} clippingPlanes={clippingPlanes} />;
    case 'shaft-rays':
      return <ShaftRays spec={overlay.spec} />;
    case 'passage-ray':
      return <PassageRay spec={overlay.spec} />;
  }
}

type Point3 = [number, number, number];

const along = (from: readonly number[], direction: readonly number[], distance: number): Point3 => [
  (from[0] as number) + (direction[0] as number) * distance,
  (from[1] as number) + (direction[1] as number) * distance,
  (from[2] as number) + (direction[2] as number) * distance,
];

const onDome = (direction: readonly number[], radius = DOME_RADIUS): Point3 => along([0, 0, 0], direction, radius);

/** A straight run of line, drawn over whatever is in front of it. */
function Ray({ points, colour, opacity = 0.9 }: { points: number[][]; colour: string; opacity?: number }): React.JSX.Element {
  const geometry = useMemo(() => lineGeometry(points), [points]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry} renderOrder={18} frustumCulled={false}>
      <lineBasicMaterial color={colour} transparent opacity={opacity} depthTest={false} depthWrite={false} fog={false} toneMapped={false} />
    </lineSegments>
  );
}

/** The star a claim is aimed at, ringed on the dome and named with its altitude. */
function TargetStar({ star, note }: { star: StarMark; note: string }): React.JSX.Element | null {
  if (star.altDeg < -2) return null;
  const at = onDome(star.direction);
  return (
    <group>
      <Marker position={at} size={DOME_RADIUS * 0.045} colour={star.colour} />
      <Label
        text={note}
        position={[at[0], at[1], at[2] + DOME_RADIUS * 0.05]}
        size={DOME_RADIUS * 0.026}
        colour={star.colour}
      />
    </group>
  );
}

/**
 * C2. Each shaft as a ray from its chamber's centre in the meridian plane,
 * carried out to the dome, with its star ringed where it stands now and the
 * transit altitude the claim actually compares written beside it.
 */
function ShaftRays({ spec }: { spec: ShaftRaysSpec }): React.JSX.Element {
  return (
    <group>
      {spec.rays.map((ray) => (
        <group key={ray.key}>
          <Ray points={[ray.from, along(ray.from, ray.direction, DOME_RADIUS)]} colour={ray.colour} />
          <Label
            text={`${ray.label} ${formatDms(ray.angleDeg)}`}
            position={along(ray.from, ray.direction, DOME_RADIUS * 0.055)}
            size={DOME_RADIUS * 0.013}
            colour={ray.colour}
          />
          <TargetStar
            star={ray.star}
            note={`${ray.star.name}: transit ${formatDms(ray.star.transitAltitudeDeg)} against ${formatDms(ray.angleDeg)}`}
          />
        </group>
      ))}
    </group>
  );
}

/** C3. The descending passage carried out of its mouth, and the star at the end of it. */
function PassageRay({ spec }: { spec: PassageRaySpec }): React.JSX.Element {
  const culmination = spec.culmination === 'lower' ? 'lower culmination' : 'transit';
  return (
    <group>
      <Ray points={[spec.from, along(spec.from, spec.direction, DOME_RADIUS)]} colour={spec.colour} />
      <Label
        text={`descending passage ${formatDms(spec.angleDeg)}`}
        position={along(spec.from, spec.direction, DOME_RADIUS * 0.06)}
        size={DOME_RADIUS * 0.013}
        colour={spec.colour}
      />
      <TargetStar
        star={spec.star}
        note={`${spec.star.name}: ${culmination} ${formatDms(spec.targetAltitudeDeg)} against ${formatDms(spec.angleDeg)}`}
      />
    </group>
  );
}
