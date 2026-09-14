/**
 * The claim overlays that are not ghost profiles: the shaft rays, the
 * descending passage's ray, the compass rose, the Orion projection, the
 * bearings taken along the plateau, the base lines drawn on it, Legon's
 * rectangle over the three pyramids, the corner line carried off the plateau
 * towards Heliopolis and the King's Chamber as a wireframe.
 *
 * Every one of them is drawn from a spec built in ../overlays.ts out of the
 * claim file's own params, so nothing here knows which claim it is serving.
 * They are drawn without depth testing, like the ghost profiles: a ray that
 * starts in the King's Chamber and a rose on the pavement are both inside
 * solid masonry, and an overlay that is invisible until the reader finds the
 * section plane is no overlay at all.
 */
import { formatValue } from '@seked/claims/browser';
import { formatDms } from '@seked/units';
import { useEffect, useMemo } from 'react';
import type { Plane } from 'three';
import {
  offsetWords,
  type ChamberWireframeSpec,
  type CompassRoseSpec,
  type GroundBearingsSpec,
  type GroundLineSpec,
  type GroundOutlinesSpec,
  type GroundRectangleSpec,
  type OverlaySpec,
  type PassageRaySpec,
  type ShaftRaysSpec,
  type SkyProjectionSpec,
  type StarMark,
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
    case 'ground-bearings':
      return <GroundBearings spec={overlay.spec} />;
    case 'ground-outlines':
      return <GroundOutlines spec={overlay.spec} />;
    case 'ground-rectangle':
      return <GroundRectangle spec={overlay.spec} />;
    case 'ground-line':
      return <GroundLine spec={overlay.spec} />;
    case 'chamber-wireframe':
      return <ChamberWireframe spec={overlay.spec} />;
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

/**
 * C5 and C6. The claim as a set of lines drawn along the plateau from the
 * viewpoint: one per bearing the claim file names, at the azimuth its own
 * expression evaluates to, and one to each corner the claim sights on, which
 * is what "between the pyramids" means when it is drawn rather than said.
 *
 * The lines lie flat a few metres above the pavement, so the picture is the
 * plan the claim's arithmetic is: what the eye compares is the angle between
 * the sun's line and the ones on either side of it.
 */
function GroundBearings({ spec }: { spec: GroundBearingsSpec }): React.JSX.Element {
  const [east, north] = spec.from;
  const z = spec.height;
  const at = (azimuthDeg: number, distance: number): Point3 => [
    east + Math.sin(azimuthDeg * Math.PI / 180) * distance,
    north + Math.cos(azimuthDeg * Math.PI / 180) * distance,
    z,
  ];
  return (
    <group>
      <Marker position={[east, north, z]} colour={MEASURED} />
      {spec.sights.map((sight) => (
        <group key={sight.label}>
          <Ray points={[[east, north, z], [sight.at[0], sight.at[1], z]]} colour={sight.colour} opacity={0.75} />
          <Marker position={[sight.at[0], sight.at[1], z]} colour={sight.colour} />
          <Label text={`${sight.label} ${sight.azimuthDeg.toFixed(2)}°`} position={[sight.at[0], sight.at[1], z + 60]} colour={sight.colour} />
        </group>
      ))}
      {spec.bearings.map((bearing) => (
        <group key={bearing.label}>
          <Ray points={[[east, north, z], at(bearing.azimuthDeg, spec.lengthM)]} colour={bearing.colour} />
          <Label
            text={`${bearing.label} ${bearing.azimuthDeg.toFixed(2)}°`}
            position={at(bearing.azimuthDeg, spec.lengthM * 0.85)}
            colour={bearing.colour}
          />
        </group>
      ))}
    </group>
  );
}

/**
 * B4. The casing base line and the socket base line as two squares on the
 * pavement, one inside the other. They are 0.7 m apart and the pyramid is
 * 230 m across, so at any distance that shows both squares the two are one
 * line: what is drawn is where each line runs, and the sides in metres and in
 * pyramid inches are written beside them because that is where the claim is
 * won or lost.
 */
function GroundOutlines({ spec }: { spec: GroundOutlinesSpec }): React.JSX.Element {
  return (
    <group>
      {spec.outlines.map((outline, i) => {
        const [east, north, up] = outline.corners[0] as Point3;
        return (
          <group key={outline.name}>
            <Polyline points={outline.corners} colour={outline.colour} close />
            {outline.markCorners &&
              outline.corners.map((corner) => (
                <Marker key={`${corner[0]},${corner[1]}`} position={corner} colour={outline.colour} />
              ))}
            <Label
              text={`${outline.name} ${formatValue(outline.sideM, 'm')} = ${outline.sideInches.toFixed(1)} P″`}
              position={[east, north, up + 24 + i * 36]}
              colour={outline.colour}
            />
          </group>
        );
      })}
    </group>
  );
}

/** The four corners of an axis-aligned rectangle, north-east first. */
function rectangle(ne: readonly number[], sw: readonly number[], z: number): Point3[] {
  const [e1, n1] = [ne[0] as number, ne[1] as number];
  const [e0, n0] = [sw[0] as number, sw[1] as number];
  return [[e1, n1, z], [e0, n1, z], [e0, n0, z], [e1, n0, z]];
}

/**
 * D2. The rectangle the three pyramids make and the rectangle Legon says was
 * set out, drawn over each other from the same north-east corner. Nothing is
 * fitted: the claimed sides are 1000√2 and 1000√3 cubits long, so its far
 * corner lands where the arithmetic puts it, and the gap to Menkaure's own
 * corner is the claim's error at the size the plateau has.
 */
function GroundRectangle({ spec }: { spec: GroundRectangleSpec }): React.JSX.Element {
  const z = spec.height;
  const measured = useMemo(() => rectangle(spec.from.at, spec.to.at, z), [spec.from.at, spec.to.at, z]);
  const claimed = useMemo(() => rectangle(spec.from.at, spec.claimedSouthWest, z), [spec.from.at, spec.claimedSouthWest, z]);
  const extent = (measuredRc: number, claimedRc: number, source: string | undefined): string =>
    `${measuredRc.toFixed(1)} rc measured, ${source === undefined ? '' : `${source} = `}${claimedRc.toFixed(1)} rc claimed`;
  const [ne, nw, sw] = measured as [Point3, Point3, Point3, Point3];

  return (
    <group>
      <Polyline points={measured} colour={spec.measuredColour} close />
      <Polyline points={claimed} colour={spec.claimedColour} close />
      {measured.map((corner) => (
        <Marker key={`${corner[0]},${corner[1]}`} position={corner} colour={spec.measuredColour} />
      ))}
      <Label
        text={extent(spec.extentEastCubits, spec.claimedEastCubits, spec.claimedEastSource)}
        position={[(ne[0] + nw[0]) / 2, ne[1], z + 90]}
        colour={spec.measuredColour}
      />
      <Label
        text={extent(spec.extentNorthCubits, spec.claimedNorthCubits, spec.claimedNorthSource)}
        position={[nw[0], (nw[1] + sw[1]) / 2, z + 90]}
        colour={spec.measuredColour}
      />
      <Marker position={[spec.claimedSouthWest[0], spec.claimedSouthWest[1], z]} colour={spec.claimedColour} />
      <Label
        text={`${spec.to.label} is ${offsetWords(spec.missEastM, 'east', 'west')} and ${offsetWords(spec.missNorthM, 'north', 'south')} of the claimed corner`}
        position={[spec.claimedSouthWest[0], spec.claimedSouthWest[1], z + 60]}
        colour={spec.claimedColour}
      />
    </group>
  );
}

/** How far the round-number reference line is run, metres. A kilometre reads. */
const REFERENCE_RUN_M = 1000;

/**
 * D1. The line through Menkaure's and Khufu's south-east corners, carried out
 * to the distance of the obelisk at Heliopolis, with the bearing to the
 * obelisk itself drawn from the Great Pyramid's base centre and the round 45
 * degrees the claim also states drawn short beside it.
 *
 * The three lines start together and part over twenty kilometres, which is
 * the only honest way to show a degree and a half: the panel's arcminutes
 * are small enough to argue with, and a picture of the fan is not.
 */
function GroundLine({ spec }: { spec: GroundLineSpec }): React.JSX.Element {
  const z = spec.height;
  const at = (origin: readonly number[], azimuthDeg: number, distance: number): Point3 => [
    (origin[0] as number) + Math.sin((azimuthDeg * Math.PI) / 180) * distance,
    (origin[1] as number) + Math.cos((azimuthDeg * Math.PI) / 180) * distance,
    z,
  ];
  const start: Point3 = [spec.from.at[0], spec.from.at[1], z];
  const target: Point3 = [spec.to.at[0], spec.to.at[1], z];

  return (
    <group>
      <Ray points={[start, at(spec.from.at, spec.cornerBearingDeg, spec.to.distanceM)]} colour={spec.cornerColour} />
      <Label
        text={`${spec.from.label} through ${spec.through.label}, ${spec.cornerBearingDeg.toFixed(2)}°`}
        position={at(spec.from.at, spec.cornerBearingDeg, spec.to.distanceM * 0.45)}
        colour={spec.cornerColour}
      />
      <Marker position={start} colour={spec.cornerColour} />
      <Marker position={[spec.through.at[0], spec.through.at[1], z]} colour={spec.cornerColour} />

      <Ray points={[[0, 0, z], target]} colour={spec.targetColour} />
      <Label
        text={`${spec.to.label}, ${(spec.to.distanceM / 1000).toFixed(1)} km`}
        position={[target[0], target[1], z + 200]}
        colour={spec.targetColour}
      />
      <Marker position={target} colour={spec.targetColour} />
      <Label
        text={`base centre to the ${spec.to.label}, ${spec.targetBearingDeg.toFixed(2)}°`}
        position={at([0, 0], spec.targetBearingDeg, spec.to.distanceM * 0.7)}
        colour={spec.targetColour}
      />

      {spec.referenceBearingDeg !== undefined && (
        <group>
          <Ray
            points={[start, at(spec.from.at, spec.referenceBearingDeg, REFERENCE_RUN_M)]}
            colour={spec.referenceColour}
            opacity={0.55}
          />
          <Label
            text={`${spec.referenceBearingDeg.toFixed(2)}° exactly`}
            position={at(spec.from.at, spec.referenceBearingDeg, REFERENCE_RUN_M)}
            colour={spec.referenceColour}
          />
        </group>
      )}
    </group>
  );
}

/** The chamber's own edges, dim enough that the diagonals read over them. */
const WIREFRAME = '#8fa6bd';

/**
 * A4. The King's Chamber as a box of twelve edges with the three diagonals
 * the claim compares drawn across it, all of it through the masonry: the
 * 3-4-5 is a claim about a room forty metres inside a pyramid, and an overlay
 * that waits for the reader to find the section plane shows it to nobody.
 *
 * The lengths written at the middle of each diagonal are the claim's own,
 * which are Petrie's means of the wall faces and not the four wall positions
 * the box is built from. The two differ by a centimetre or two, far less than
 * the lines are thick.
 */
function ChamberWireframe({ spec }: { spec: ChamberWireframeSpec }): React.JSX.Element {
  return (
    <group>
      <Ray points={spec.edges} colour={WIREFRAME} opacity={0.5} />
      {spec.diagonals.map((d) => (
        <group key={d.name}>
          <Ray points={[d.from, d.to]} colour={d.colour} />
          <Label
            text={`${d.name} ${formatValue(d.cubits, 'rc')} rc${d.target === undefined ? '' : `, claimed ${formatValue(d.target, 'rc')}`}`}
            position={[(d.from[0] + d.to[0]) / 2, (d.from[1] + d.to[1]) / 2, (d.from[2] + d.to[2]) / 2]}
            colour={d.colour}
          />
        </group>
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
