/**
 * The claim overlays that are not ghost profiles: the shaft rays, the
 * descending passage's ray, the compass rose and the Orion projection.
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
import type {
  CompassRoseSpec,
  OverlaySpec,
  PassageRaySpec,
  ShaftRaysSpec,
  SkyProjectionSpec,
  StarMark,
} from '../overlays';
import { DOME_RADIUS } from '../sky';
import type { PyramidParams } from '../model';
import { GhostProfiles } from './GhostProfile';
import { lineGeometry, polylineGeometry, ringPoints } from './geometry';
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
    case 'compass-rose':
      return <CompassRose spec={overlay.spec} />;
    case 'sky-projection':
      return <SkyProjection spec={overlay.spec} />;
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

function Polyline({ points, colour, close = false }: { points: number[][]; colour: string; close?: boolean }): React.JSX.Element {
  const geometry = useMemo(() => polylineGeometry(points, close), [points, close]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry} renderOrder={18} frustumCulled={false}>
      <lineBasicMaterial color={colour} transparent opacity={0.9} depthTest={false} depthWrite={false} fog={false} toneMapped={false} />
    </lineSegments>
  );
}

/** The star a claim is aimed at, ringed on the dome and named with its altitude. */
function TargetStar({ star, note }: { star: StarMark; note: string }): React.JSX.Element | null {
  if (star.altDeg < -2) return null;
  const at = onDome(star.direction);
  return (
    <group>
      <Marker position={at} colour={star.colour} />
      <Label
        text={note}
        position={[at[0], at[1], at[2] + DOME_RADIUS * 0.05]}
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
        colour={spec.colour}
      />
      <TargetStar
        star={spec.star}
        note={`${spec.star.name}: ${culmination} ${formatDms(spec.targetAltitudeDeg)} against ${formatDms(spec.angleDeg)}`}
      />
    </group>
  );
}

const TRUE_NORTH = '#7fd1ff';
const MEASURED = '#ffcf70';

/**
 * C1. True north and the pyramid's own north, with the few arcminutes between
 * them drawn many times wider than they are. The factor comes from the claim
 * file and is written into the label, because a picture that lies about a
 * scale has to say so.
 */
function CompassRose({ spec }: { spec: CompassRoseSpec }): React.JSX.Element {
  const [east, north, up] = spec.centre;
  const z = up + 1.5;
  const r = spec.radiusM;
  const drawn = spec.azimuthDeg * spec.exaggeration;
  const a = (drawn * Math.PI) / 180;
  const ring = useMemo(() => ringPoints(r, 0, 120), [r]);
  const quarters = useMemo(() => {
    const points: number[][] = [];
    for (let i = 0; i < 4; i++) {
      const t = (i * Math.PI) / 2;
      points.push([r * 0.94 * Math.sin(t), r * 0.94 * Math.cos(t), 0], [r * Math.sin(t), r * Math.cos(t), 0]);
    }
    return points;
  }, [r]);
  const minutes = Math.abs(spec.arcminutes);
  const side = spec.arcminutes < 0 ? 'west' : 'east';

  return (
    <group>
      <group position={[east, north, z]}>
        <Polyline points={ring} colour="#4f6478" close />
        <Ray points={quarters} colour="#4f6478" opacity={0.7} />
        <Ray points={[[0, -r, 0], [0, r, 0]]} colour={TRUE_NORTH} />
        <Ray points={[[-r * Math.sin(a), -r * Math.cos(a), 0], [r * Math.sin(a), r * Math.cos(a), 0]]} colour={MEASURED} />
        <Label text="true north" position={[0, r * 1.08, 24]} colour={TRUE_NORTH} />
        <Label
          text={`measured ${minutes.toFixed(1)}′ ${side} of north, drawn ${spec.exaggeration.toFixed(0)}× wide`}
          position={[r * Math.sin(a) * 1.15, r * Math.cos(a) * 1.15, 60]}
          colour={MEASURED}
        />
      </group>
      {/* The dome is about the observer, not about the rose, so the star pair
          sits outside the rose's own placement. */}
      {spec.stars.length > 1 && <StarPair stars={spec.stars} />}
    </group>
  );
}

/**
 * Spence's pair, joined on the dome. Her method reads north off the line
 * between two circumpolar stars when it stands vertical, so the line is the
 * thing worth drawing; whether it is vertical now is the reader's to see.
 */
function StarPair({ stars }: { stars: StarMark[] }): React.JSX.Element | null {
  const shown = stars.filter((s) => s.altDeg > -2);
  if (shown.length < 2) return null;
  const points = shown.map((s) => onDome(s.direction));
  return (
    <group>
      <Polyline points={points} colour="#b9a6ff" />
      {shown.map((star) => (
        <TargetStar key={star.id} star={star} note={`${star.name} ${formatDms(star.altDeg)} high`} />
      ))}
    </group>
  );
}

const BELT = '#ffcf70';
const DIAGONAL = '#cfd8e3';

/**
 * C4. The belt at this epoch, scaled and laid on the plateau beside the line
 * through the three pyramid centres. Both lines start at the same point, so
 * what the eye compares is the angle and the spacing, which is what the claim
 * compares too.
 */
function SkyProjection({ spec }: { spec: SkyProjectionSpec }): React.JSX.Element {
  const z = spec.height;
  const ground = useMemo(() => spec.ground.map((g) => [g.at[0], g.at[1], z]), [spec.ground, z]);
  const belt = useMemo(() => spec.belt.map((s) => [s.at[0], s.at[1], z + 6]), [spec.belt, z]);
  return (
    <group>
      <Polyline points={ground} colour={DIAGONAL} />
      <Polyline points={belt} colour={BELT} />
      {spec.ground.map((g, i) => (
        <group key={g.id}>
          <Marker position={[g.at[0], g.at[1], z]} colour={DIAGONAL} />
          {i === spec.ground.length - 1 && (
            <Label
              text={`centres ${spec.groundAngleDeg.toFixed(2)}° from the meridian`}
              position={[g.at[0], g.at[1] - 120, z + 90]}
              colour={DIAGONAL}
            />
          )}
        </group>
      ))}
      {spec.belt.map((star, i) => (
        <group key={star.id}>
          <Marker position={[star.at[0], star.at[1], z + 6]} colour={BELT} />
          <Label text={star.name} position={[star.at[0], star.at[1], z + 70]} colour={BELT} />
          {i === spec.belt.length - 1 && (
            <Label
              text={`belt ${spec.beltAngleDeg.toFixed(2)}° from the meridian, ${spec.inverted ? 'north and south swapped' : 'north to north'}`}
              position={[star.at[0], star.at[1] + 120, z + 150]}
              colour={BELT}
            />
          )}
        </group>
      ))}
    </group>
  );
}
