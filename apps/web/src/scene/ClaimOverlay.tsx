/**
 * The claim overlays that are not ghost profiles: the shaft rays, the
 * descending passage's ray, the compass rose, the Orion projection, the
 * bearings taken along the plateau, the base lines drawn on it, Legon's
 * rectangle over the three pyramids, the corner line carried off the plateau
 * towards Heliopolis, the King's Chamber as a wireframe, the Earth shrunk by
 * 43,200 and stood on the base centre, and the parallels of latitude laid
 * across the base.
 *
 * Every one of them is drawn from a spec built in ../overlays.ts out of the
 * claim file's own params, so nothing here knows which claim it is serving.
 * What they share is `PALETTE`: lapis is the claim's own geometry, the warm
 * sand is the survey it is drawn against, and the green and the red are the
 * claim's grade and appear nowhere else. A reader who has learnt that much
 * from one overlay can read all of them.
 *
 * **Lines are in the scene, not on top of it.** Every line is drawn twice:
 * once depth tested, which puts it among the stone with everything else, and
 * once more with the depth test reversed, so the part of it running through
 * the monument shows at a third of the strength and is plainly the part
 * running through the monument. That two-pass treatment is the default here
 * because every overlay this project has is drawn against something it is
 * inside of or crosses: a ray that starts in the King's Chamber, a rose on a
 * pavement buried under the pyramid, a corner line twenty kilometres long
 * that dives under the terrain. The one that is not is the pair of stars
 * joined on the dome, and it says so with `through={false}`.
 *
 * Labels and markers keep no depth test at all. They are annotations rather
 * than geometry, they carry their own glass, and a caption that disappears
 * behind the thing it captions is no caption.
 */
import { formatValue } from '@seked/claims/browser';
import { DEG, formatDms } from '@seked/units';
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { GreaterDepth, type BufferGeometry, type LineSegments, type Plane } from 'three';
import {
  cornerMissWords,
  parallelOffsetWords,
  PALETTE,
  type ChamberWireframeSpec,
  type CompassRoseSpec,
  type GhostEarthSpec,
  type GroundBearingsSpec,
  type GroundLineSpec,
  type GroundOutlinesSpec,
  type GroundRectangleSpec,
  type MapInsetSpec,
  type OverlaySpec,
  type OverlayStyle,
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

type Point3 = [number, number, number];

/**
 * Where the claim came from and how it came out, handed down to the parts
 * rather than threaded through a dozen component signatures. A filed claim
 * that cannot be computed is the quiet default, so a part drawn outside an
 * overlay draws as an ordinary one.
 */
const StyleContext = createContext<OverlayStyle>({ proposed: false, fits: undefined });

const useOverlayStyle = (): OverlayStyle => useContext(StyleContext);

export function ClaimOverlay({
  overlay,
  pyramids,
  clippingPlanes,
}: {
  overlay: OverlaySpec;
  pyramids: PyramidParams[];
  clippingPlanes: Plane[];
}): React.JSX.Element | null {
  const anchor = landing(overlay, pyramids);
  return (
    <StyleContext.Provider value={{ proposed: overlay.proposed, fits: overlay.fits }}>
      <Drawing overlay={overlay} pyramids={pyramids} clippingPlanes={clippingPlanes} />
      {anchor && <Verdict at={anchor} fits={overlay.fits} />}
    </StyleContext.Provider>
  );
}

function Drawing({
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
      return (
        <GhostProfiles spec={overlay.spec} pyramids={pyramids} clippingPlanes={clippingPlanes} proposed={overlay.proposed} />
      );
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
    case 'ghost-earth':
      return <GhostEarth spec={overlay.spec} />;
    case 'map-inset':
      return <MapInset spec={overlay.spec} />;
  }
}

/**
 * Where the claim lands: the one point in each drawing at which the claim's
 * own arithmetic puts something, and therefore the only place the grade
 * belongs. The scaled pole for B1, the claimed corner for D2, the ghost's
 * apex for A1, the obelisk for D1. A claim that cannot be computed has no
 * grade and the ring is not drawn at all.
 */
function landing(overlay: OverlaySpec, pyramids: PyramidParams[]): Point3 | undefined {
  switch (overlay.kind) {
    case 'ghost-profile': {
      const params = pyramids.find((p) => p.id === overlay.spec.structure);
      const profile = overlay.spec.profiles[0];
      if (!params || !profile) return undefined;
      return [params.offsetEast, params.offsetNorth, params.offsetUp + (params.base / 2) * Math.tan(profile.slopeDeg * DEG)];
    }
    case 'shaft-rays':
      return overlay.spec.rays[0]?.from as Point3 | undefined;
    case 'passage-ray':
      return overlay.spec.from as Point3;
    case 'compass-rose':
      return overlay.spec.centre as Point3;
    case 'sky-projection': {
      const star = overlay.spec.belt[overlay.spec.belt.length - 1];
      return star && [star.at[0], star.at[1], overlay.spec.height + 6];
    }
    case 'ground-bearings':
      return [overlay.spec.from[0], overlay.spec.from[1], overlay.spec.height];
    case 'ground-outlines':
      return overlay.spec.outlines[0]?.corners[0] as Point3 | undefined;
    case 'ground-rectangle':
      return [overlay.spec.claimedSouthWest[0], overlay.spec.claimedSouthWest[1], overlay.spec.height];
    case 'ground-line':
      return [overlay.spec.to.at[0], overlay.spec.to.at[1], overlay.spec.height];
    case 'chamber-wireframe': {
      const diagonal = overlay.spec.diagonals[0];
      return diagonal && middle(diagonal.from, diagonal.to);
    }
    case 'ghost-earth': {
      const [east, north, up] = overlay.spec.centre;
      return [east, north, up + overlay.spec.polarRadiusM];
    }
    case 'map-inset': {
      const claimed = overlay.spec.parallels.find((p) => p.name === 'claimed');
      const [east, north] = overlay.spec.centre;
      return claimed && [east, north + claimed.offsetM, overlay.spec.height];
    }
  }
}

const middle = (from: readonly number[], to: readonly number[]): Point3 => [
  ((from[0] as number) + (to[0] as number)) / 2,
  ((from[1] as number) + (to[1] as number)) / 2,
  ((from[2] as number) + (to[2] as number)) / 2,
];

const along = (from: readonly number[], direction: readonly number[], distance: number): Point3 => [
  (from[0] as number) + (direction[0] as number) * distance,
  (from[1] as number) + (direction[1] as number) * distance,
  (from[2] as number) + (direction[2] as number) * distance,
];

const onDome = (direction: readonly number[], radius = DOME_RADIUS): Point3 => along([0, 0, 0], direction, radius);

/**
 * How much of itself the occluded pass keeps, and how much of itself a
 * proposed claim keeps. Half rather than a third: most of what an overlay
 * draws is buried, so a third put the ghost Earth's graticule and the
 * perimeter circle on the pavement below the point of being drawn at all,
 * which is the failure the depth test was meant to avoid, not to cause.
 */
const OCCLUDED = 0.5;
const PROPOSED_STRENGTH = 0.75;

/**
 * The claim's grade, as a ring at the point the claim lands. This is the one
 * green and the one red in the whole of an overlay; everything else is lapis
 * or sand. The ring is wider than the marks the drawing puts down, so where
 * the two coincide it reads as a ring about the mark.
 */
function Verdict({ at, fits }: { at: Point3; fits: boolean | undefined }): React.JSX.Element | null {
  if (fits === undefined) return null;
  return <Marker position={at} px={38} colour={fits ? PALETTE.fits : PALETTE.misses} />;
}

/**
 * A run of line, drawn twice: in the scene, and again through whatever stands
 * in front of it at a third of the strength. A proposed claim's lines are
 * dashed on the geometry's own scale, so a five-metre diagonal and a
 * twenty-kilometre bearing dash at the same rate to the eye.
 */
function Lines({
  geometry,
  colour,
  opacity = 0.9,
  through = true,
}: {
  geometry: BufferGeometry;
  colour: string;
  opacity?: number;
  /** False for a line drawn wholly in the open, such as one across the dome. */
  through?: boolean;
}): React.JSX.Element {
  const { proposed } = useOverlayStyle();
  // The dash is sized off the drawing's own bounding sphere rather than a
  // figure in metres, so a five-metre diagonal and a twenty-kilometre bearing
  // dash at the same rate to the eye.
  const dash = useMemo(() => {
    if (!proposed) return undefined;
    geometry.computeBoundingSphere();
    const size = Math.max((geometry.boundingSphere?.radius ?? 1) / 60, 1e-4);
    return { dashSize: size, gapSize: size * 0.85 };
  }, [geometry, proposed]);
  // `computeLineDistances` belongs to the line and not to the geometry, and
  // it writes the attribute both passes then read.
  const near = useRef<LineSegments>(null);
  const far = useRef<LineSegments>(null);
  useLayoutEffect(() => {
    if (!dash) return;
    near.current?.computeLineDistances();
    far.current?.computeLineDistances();
  }, [dash, geometry]);
  const strength = opacity * (proposed ? PROPOSED_STRENGTH : 1);
  const common = { color: colour, transparent: true, depthWrite: false, fog: false, toneMapped: false } as const;

  return (
    <>
      <lineSegments ref={near} geometry={geometry} renderOrder={17} frustumCulled={false}>
        {dash ? (
          <lineDashedMaterial {...common} {...dash} opacity={strength} />
        ) : (
          <lineBasicMaterial {...common} opacity={strength} />
        )}
      </lineSegments>
      {through && (
        <lineSegments ref={far} geometry={geometry} renderOrder={18} frustumCulled={false}>
          {dash ? (
            <lineDashedMaterial {...common} {...dash} opacity={strength * OCCLUDED} depthFunc={GreaterDepth} />
          ) : (
            <lineBasicMaterial {...common} opacity={strength * OCCLUDED} depthFunc={GreaterDepth} />
          )}
        </lineSegments>
      )}
    </>
  );
}

function Ray({
  points,
  colour,
  opacity,
  through,
}: {
  points: number[][];
  colour: string;
  opacity?: number;
  through?: boolean;
}): React.JSX.Element {
  const geometry = useMemo(() => lineGeometry(points), [points]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <Lines geometry={geometry} colour={colour} opacity={opacity} through={through} />;
}

function Polyline({
  points,
  colour,
  close = false,
  opacity,
  through,
}: {
  points: number[][];
  colour: string;
  close?: boolean;
  opacity?: number;
  through?: boolean;
}): React.JSX.Element {
  const geometry = useMemo(() => polylineGeometry(points, close), [points, close]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <Lines geometry={geometry} colour={colour} opacity={opacity} through={through} />;
}

/**
 * A label on the stage's glass, with its leader back to the point it names
 * and, for a claim the runner proposed rather than a person filed, the word
 * `proposed` in front of the text.
 */
function Note({
  text,
  at,
  offset,
  colour,
}: {
  text: string;
  at: Point3;
  offset?: [number, number];
  colour: string;
}): React.JSX.Element {
  const { proposed } = useOverlayStyle();
  return <Label text={text} at={at} offset={offset} colour={colour} tag={proposed ? 'proposed' : undefined} />;
}

/** The star a claim is aimed at, ringed on the dome and named with its altitude. */
function TargetStar({ star, note }: { star: StarMark; note: string }): React.JSX.Element | null {
  if (star.altDeg < -2) return null;
  const at = onDome(star.direction);
  return (
    <group>
      <Marker position={at} colour={star.colour} />
      <Note text={note} at={at} offset={[0, 34]} colour={star.colour} />
    </group>
  );
}

/**
 * C2. Each shaft as a ray from its chamber's centre in the meridian plane,
 * carried out to the dome, with its star ringed where it stands now and the
 * transit altitude the claim actually compares written beside it.
 *
 * The ray is sand and the star is lapis on the same rung of the ladder: the
 * angle is a survey figure out of a surveyed room, and the star at the end of
 * it is the claim's own assignment.
 */
function ShaftRays({ spec }: { spec: ShaftRaysSpec }): React.JSX.Element {
  return (
    <group>
      {spec.rays.map((ray, i) => (
        <group key={ray.key}>
          <Ray points={[ray.from, along(ray.from, ray.direction, DOME_RADIUS)]} colour={ray.colour} />
          <Note
            text={`${ray.label} ${formatDms(ray.angleDeg)}`}
            at={along(ray.from, ray.direction, DOME_RADIUS * 0.055)}
            offset={[0, 26 + i * 22]}
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
      <Note
        text={`descending passage ${formatDms(spec.angleDeg)}`}
        at={along(spec.from, spec.direction, DOME_RADIUS * 0.06)}
        offset={[0, 26]}
        colour={spec.colour}
      />
      <TargetStar
        star={spec.star}
        note={`${spec.star.name}: ${culmination} ${formatDms(spec.targetAltitudeDeg)} against ${formatDms(spec.angleDeg)}`}
      />
    </group>
  );
}

/**
 * C1. True north and the pyramid's own north, with the few arcminutes between
 * them drawn many times wider than they are. The factor comes from the claim
 * file and is written into the label, because a picture that lies about a
 * scale has to say so.
 *
 * True north is the survey's own line and the measured side azimuth is what
 * the claim is about, so this is the one drawing where the sand is the frame
 * of reference and the lapis is the monument's own error.
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
  const trueNorth = PALETTE.survey[0] as string;
  const measured = PALETTE.claim[0] as string;

  return (
    <group>
      <group position={[east, north, z]}>
        <Polyline points={ring} colour={PALETTE.frame} opacity={0.4} close />
        <Ray points={quarters} colour={PALETTE.frame} opacity={0.4} />
        <Ray points={[[0, -r, 0], [0, r, 0]]} colour={trueNorth} />
        <Ray points={[[-r * Math.sin(a), -r * Math.cos(a), 0], [r * Math.sin(a), r * Math.cos(a), 0]]} colour={measured} />
        <Note text="true north" at={[0, r, 0]} offset={[0, 28]} colour={trueNorth} />
        <Note
          text={`measured ${minutes.toFixed(1)}′ ${side} of north, drawn ${spec.exaggeration.toFixed(0)}× wide`}
          at={[r * Math.sin(a), r * Math.cos(a), 0]}
          offset={[0, 62]}
          colour={measured}
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
 *
 * This is the one line in the overlays drawn wholly in the open, so it takes
 * no second pass through the stone.
 */
function StarPair({ stars }: { stars: StarMark[] }): React.JSX.Element | null {
  const shown = stars.filter((s) => s.altDeg > -2);
  if (shown.length < 2) return null;
  const points = shown.map((s) => onDome(s.direction));
  return (
    <group>
      <Polyline points={points} colour={PALETTE.claim[2] as string} through={false} />
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
 * The bearings are the claim's own expressions and are drawn in lapis; the
 * sight lines run to corners the pyramids actually have and are sand.
 */
function GroundBearings({ spec }: { spec: GroundBearingsSpec }): React.JSX.Element {
  const [east, north] = spec.from;
  const z = spec.height;
  const at = (azimuthDeg: number, distance: number): Point3 => [
    east + Math.sin((azimuthDeg * Math.PI) / 180) * distance,
    north + Math.cos((azimuthDeg * Math.PI) / 180) * distance,
    z,
  ];
  return (
    <group>
      <Marker position={[east, north, z]} colour={PALETTE.frame} />
      {spec.sights.map((sight) => (
        <group key={sight.label}>
          <Ray points={[[east, north, z], [sight.at[0], sight.at[1], z]]} colour={sight.colour} opacity={0.75} />
          <Marker position={[sight.at[0], sight.at[1], z]} colour={sight.colour} />
          <Note
            text={`${sight.label} ${sight.azimuthDeg.toFixed(2)}°`}
            at={[sight.at[0], sight.at[1], z]}
            offset={[0, 34]}
            colour={sight.colour}
          />
        </group>
      ))}
      {spec.bearings.map((bearing, i) => (
        <group key={bearing.label}>
          <Ray points={[[east, north, z], at(bearing.azimuthDeg, spec.lengthM)]} colour={bearing.colour} />
          <Note
            text={`${bearing.label} ${bearing.azimuthDeg.toFixed(2)}°`}
            at={at(bearing.azimuthDeg, spec.lengthM * 0.85)}
            offset={[0, 26 + i * 22]}
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
 * won or lost. Both lines are Petrie's, so both are sand.
 */
function GroundOutlines({ spec }: { spec: GroundOutlinesSpec }): React.JSX.Element {
  return (
    <group>
      {spec.outlines.map((outline, i) => {
        const corner = outline.corners[0] as Point3;
        return (
          <group key={outline.name}>
            <Polyline points={outline.corners} colour={outline.colour} close />
            {outline.markCorners &&
              outline.corners.map((c) => <Marker key={`${c[0]},${c[1]}`} position={c} colour={outline.colour} />)}
            <Note
              text={`${outline.name} ${formatValue(outline.sideM, 'm')} = ${outline.sideInches.toFixed(1)} P″`}
              at={corner}
              offset={[0, 30 + i * 24]}
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
      <Note
        text={extent(spec.extentEastCubits, spec.claimedEastCubits, spec.claimedEastSource)}
        at={[(ne[0] + nw[0]) / 2, ne[1], z]}
        offset={[0, 32]}
        colour={spec.measuredColour}
      />
      <Note
        text={extent(spec.extentNorthCubits, spec.claimedNorthCubits, spec.claimedNorthSource)}
        at={[nw[0], (nw[1] + sw[1]) / 2, z]}
        offset={[0, 32]}
        colour={spec.measuredColour}
      />
      <Marker position={[spec.claimedSouthWest[0], spec.claimedSouthWest[1], z]} colour={spec.claimedColour} />
      <Note
        text={cornerMissWords(spec)}
        at={[spec.claimedSouthWest[0], spec.claimedSouthWest[1], z]}
        offset={[0, 52]}
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
 * are small enough to argue with, and a picture of the fan is not. The corner
 * line is sand because both its corners are surveyed; the bearing to the
 * obelisk and the round 45 degrees are what the claim asserts, and are lapis.
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
      <Note
        text={`${spec.from.label} through ${spec.through.label}, ${spec.cornerBearingDeg.toFixed(2)}°`}
        at={at(spec.from.at, spec.cornerBearingDeg, spec.to.distanceM * 0.45)}
        offset={[0, 26]}
        colour={spec.cornerColour}
      />
      <Marker position={start} colour={spec.cornerColour} />
      <Marker position={[spec.through.at[0], spec.through.at[1], z]} colour={spec.cornerColour} />

      <Ray points={[[0, 0, z], target]} colour={spec.targetColour} />
      <Note
        text={`${spec.to.label}, ${(spec.to.distanceM / 1000).toFixed(1)} km`}
        at={target}
        offset={[0, 58]}
        colour={spec.targetColour}
      />
      <Marker position={target} colour={spec.targetColour} />
      <Note
        text={`base centre to the ${spec.to.label}, ${spec.targetBearingDeg.toFixed(2)}°`}
        at={at([0, 0], spec.targetBearingDeg, spec.to.distanceM * 0.7)}
        offset={[0, 26]}
        colour={spec.targetColour}
      />

      {spec.referenceBearingDeg !== undefined && (
        <group>
          <Ray
            points={[start, at(spec.from.at, spec.referenceBearingDeg, REFERENCE_RUN_M)]}
            colour={spec.referenceColour}
            opacity={0.7}
          />
          <Note
            text={`${spec.referenceBearingDeg.toFixed(2)}° exactly`}
            at={at(spec.from.at, spec.referenceBearingDeg, REFERENCE_RUN_M)}
            offset={[0, 26]}
            colour={spec.referenceColour}
          />
        </group>
      )}
    </group>
  );
}

/**
 * A4. The King's Chamber as a box of twelve edges with the three diagonals
 * the claim compares drawn across it. The box is the surveyed room and is
 * sand, dim; the diagonals are the claim's own arithmetic and are lapis.
 *
 * The lengths written at the middle of each diagonal are the claim's own,
 * which are Petrie's means of the wall faces and not the four wall positions
 * and two levels the box is built from. Those are different records, and a
 * preset that takes the floor from one survey and the ceiling from another
 * parts the drawn line from its label by the better part of a decimetre; the
 * panel prints both lengths so the difference is never only in the drawing.
 */
function ChamberWireframe({ spec }: { spec: ChamberWireframeSpec }): React.JSX.Element {
  return (
    <group>
      <Ray points={spec.edges} colour={PALETTE.survey[0] as string} opacity={0.5} />
      {spec.diagonals.map((d, i) => (
        <group key={d.name}>
          <Ray points={[d.from, d.to]} colour={d.colour} />
          <Note
            text={`${d.name} ${formatValue(d.cubits, 'rc')} rc${d.target === undefined ? '' : `, claimed ${formatValue(d.target, 'rc')}`}`}
            at={middle(d.from, d.to)}
            offset={[0, 26 + i * 22]}
            colour={d.colour}
          />
        </group>
      ))}
    </group>
  );
}

/**
 * C4. The belt at this epoch, scaled and laid on the plateau beside the line
 * through the three pyramid centres. Both lines start at the same point, so
 * what the eye compares is the angle and the spacing, which is what the claim
 * compares too. The line through the centres is where the pyramids are and is
 * sand; the belt laid on the ground is the claim and is lapis.
 */
function SkyProjection({ spec }: { spec: SkyProjectionSpec }): React.JSX.Element {
  const z = spec.height;
  const centres = PALETTE.survey[0] as string;
  const belt = PALETTE.claim[0] as string;
  const groundPoints = useMemo(() => spec.ground.map((g) => [g.at[0], g.at[1], z]), [spec.ground, z]);
  const beltPoints = useMemo(() => spec.belt.map((s) => [s.at[0], s.at[1], z + 6]), [spec.belt, z]);
  return (
    <group>
      <Polyline points={groundPoints} colour={centres} />
      <Polyline points={beltPoints} colour={belt} />
      {spec.ground.map((g, i) => (
        <group key={g.id}>
          <Marker position={[g.at[0], g.at[1], z]} colour={centres} />
          {i === spec.ground.length - 1 && (
            <Note
              text={`centres ${spec.groundAngleDeg.toFixed(2)}° from the meridian`}
              at={[g.at[0], g.at[1], z]}
              offset={[0, 30]}
              colour={centres}
            />
          )}
        </group>
      ))}
      {spec.belt.map((star, i) => (
        <group key={star.id}>
          <Marker position={[star.at[0], star.at[1], z + 6]} colour={belt} />
          <Note text={star.name} at={[star.at[0], star.at[1], z + 6]} offset={[0, 26]} colour={belt} />
          {i === spec.belt.length - 1 && (
            <Note
              text={`belt ${spec.beltAngleDeg.toFixed(2)}° from the meridian, ${spec.inverted ? 'north and south swapped' : 'north to north'}`}
              at={[star.at[0], star.at[1], z + 6]}
              offset={[0, 56]}
              colour={belt}
            />
          )}
        </group>
      ))}
    </group>
  );
}

/**
 * The ghost Earth's graticule: parallels every fifteen degrees from the
 * equator to seventy-five, twelve meridians, and enough points up each
 * meridian that the curve reads as a curve.
 */
const GHOST_EARTH_PARALLELS = [0, 15, 30, 45, 60, 75];
const GHOST_EARTH_MERIDIANS = 12;
const GHOST_EARTH_STEPS = 18;

/** The graticule is a frame around the two circles that carry the claim, not a globe. */
const GRATICULE_OPACITY = 0.45;

/**
 * B1. The northern hemisphere shrunk by 43,200 and stood on the pyramid's
 * base centre, so the scaled pole falls half a metre above where the apex is
 * and the scaled equator a metre outside the circle whose circumference is
 * the measured base perimeter. Those two gaps are the claim's two residuals,
 * at the size the plateau has rather than in a column of figures.
 *
 * The wireframe is an ellipsoid and not a sphere: the horizontal radii come
 * from the scaled equatorial circumference and the vertical from the scaled
 * polar radius, which are the two numbers the claim itself uses. Half a metre
 * of flattening in a hundred and fifty is invisible, and inventing a mean
 * radius to avoid it would put a third number in the picture that the claim
 * never mentions.
 */
function GhostEarth({ spec }: { spec: GhostEarthSpec }): React.JSX.Element {
  const [east, north, up] = spec.centre;
  const equator = spec.equatorRadiusM;
  const pole = spec.polarRadiusM;
  const parallels = useMemo(
    () => GHOST_EARTH_PARALLELS.map((lat) => ringPoints(equator * Math.cos(lat * DEG), pole * Math.sin(lat * DEG), 96)),
    [equator, pole],
  );
  const meridians = useMemo(() => {
    const lines: number[][][] = [];
    for (let i = 0; i < GHOST_EARTH_MERIDIANS; i++) {
      const a = (i / GHOST_EARTH_MERIDIANS) * Math.PI * 2;
      const line: number[][] = [];
      for (let step = 0; step <= GHOST_EARTH_STEPS; step++) {
        const lat = (step / GHOST_EARTH_STEPS) * (Math.PI / 2);
        line.push([equator * Math.cos(lat) * Math.sin(a), equator * Math.cos(lat) * Math.cos(a), pole * Math.sin(lat)]);
      }
      lines.push(line);
    }
    return lines;
  }, [equator, pole]);
  const perimeter = useMemo(() => ringPoints(spec.perimeterRadiusM, 0, 96), [spec.perimeterRadiusM]);
  const scale = spec.scale.toLocaleString('en-US');

  return (
    <group position={[east, north, up]}>
      {meridians.map((line, i) => (
        <Polyline key={`meridian-${i}`} points={line} colour={spec.earthColour} opacity={GRATICULE_OPACITY} />
      ))}
      {parallels.map((points, i) => (
        <Polyline
          key={`parallel-${i}`}
          points={points}
          colour={spec.earthColour}
          opacity={i === 0 ? 0.9 : GRATICULE_OPACITY}
          close
        />
      ))}
      <Polyline points={perimeter} colour={spec.pyramidColour} close />
      <Note
        text={`polar radius ÷ ${scale} = ${pole.toFixed(2)} m, height ${spec.heightM.toFixed(2)} m`}
        at={[0, 0, pole]}
        offset={[0, 44]}
        colour={spec.earthColour}
      />
      <Note
        text={`equatorial circumference ÷ ${scale} = ${equator.toFixed(2)} m of radius, perimeter ÷ 2π = ${spec.perimeterRadiusM.toFixed(2)} m`}
        at={[equator, 0, 0]}
        offset={[0, 30]}
        colour={spec.pyramidColour}
      />
    </group>
  );
}

/**
 * B3. Three parallels of latitude drawn across the Great Pyramid's own base,
 * with the base outline under them.
 *
 * The claim is a coincidence in the seventh decimal place of a latitude, so
 * the only honest picture is one that shows what a decimal place of latitude
 * is worth on the ground. The cited base centre is the middle line; the speed
 * of light lands nine metres north of it and the same base centre read on the
 * datum Egypt surveyed the plateau with lands eighteen metres south. All
 * three lines sit inside a footprint 230 m on a side.
 */
function MapInset({ spec }: { spec: MapInsetSpec }): React.JSX.Element {
  const [east, north] = spec.centre;
  const z = spec.height;
  return (
    <group>
      <Polyline points={spec.outline} colour={PALETTE.frame} close opacity={0.45} />
      <Marker position={[east, north, z]} colour={PALETTE.frame} />
      {spec.parallels.map((parallel, i) => {
        const y = north + parallel.offsetM;
        return (
          <group key={parallel.name}>
            <Ray points={[[east - spec.halfLengthM, y, z], [east + spec.halfLengthM, y, z]]} colour={parallel.colour} />
            <Note
              text={`${parallel.label} ${parallel.latitudeDeg.toFixed(7)}°, ${parallelOffsetWords(parallel)}`}
              at={[east + spec.halfLengthM * 0.45, y, z]}
              offset={[0, 24 + i * 22]}
              colour={parallel.colour}
            />
          </group>
        );
      })}
    </group>
  );
}
