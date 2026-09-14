/**
 * Which overlays the viewer can actually draw, and how to read the ones it
 * can. A claim's overlay is a declaration in its YAML file, not code, so the
 * list of types that exist runs ahead of the list that is built; the detail
 * pane says which is which rather than pretending.
 *
 * Everything here is pure. A spec is the claim file's params resolved against
 * the environment, the interior landmarks and the sky of the moment: metres,
 * degrees and unit vectors in the project frame, +X east, +Y north, +Z up. The
 * components under scene/ turn a spec into geometry and know nothing about
 * claims, so a new overlay is a spec builder and a component and never a
 * special case in the panel.
 */
import { evaluate, type Claim } from '@seked/claims/browser';
import type { Environment, Point } from '@seked/geometry';
import {
  lowerCulminationAltitude,
  placeOnDome,
  transitAltitude,
  transitIsNorth,
  transitLst,
  type Star,
  type Vec3,
} from '@seked/sky/browser';
import { DEG } from '@seked/units';
import { STRUCTURES, type PyramidParams, type StructureId, type StructureInterior } from './model';
import { starByName } from './sky';

export const BUILT_OVERLAYS = new Set(['ghost-profile', 'ghost-profiles', 'shaft-rays', 'passage-ray']);

/** Enough colours for the three slopes A3 puts side by side. */
const GHOST_COLOURS = ['#7fd1ff', '#ffcf70', '#ff9bc2'];

/** One colour per ray, so a shaft and the star it is aimed at share it. */
export const RAY_COLOURS = ['#7fd1ff', '#ffcf70', '#ff9bc2', '#9ae6a0'];

export interface GhostProfile {
  /** The expression as the claim file writes it, which is the honest label. */
  label: string;
  slopeDeg: number;
  colour: string;
}

export interface GhostProfileSpec {
  structure: StructureId;
  profiles: GhostProfile[];
  /** The survey's error band on the measured face angle, in arcminutes. */
  errorBandArcmin: number | undefined;
}

const asString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const asNumber = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const isStructure = (id: string): id is StructureId => (STRUCTURES as readonly string[]).includes(id);

/**
 * A ghost profile is a pyramid on the measured base at a claimed slope, so a
 * reader can see how far the claim is from the monument. The slopes are
 * expressions in the same language the claims use, evaluated in the same
 * environment, so changing the preset or the cubit moves them too.
 */
export function ghostProfileSpec(claim: Claim, env: Environment): GhostProfileSpec | undefined {
  const overlay = claim.overlay;
  if (!overlay || (overlay.type !== 'ghost-profile' && overlay.type !== 'ghost-profiles')) return undefined;
  const params: Record<string, unknown> = overlay.params ?? {};
  const structure = asString(params.structure) ?? 'g1';
  if (!isStructure(structure)) return undefined;

  const written = overlay.type === 'ghost-profiles' ? (Array.isArray(params.slopes) ? params.slopes : []) : [params.slope];
  const profiles: GhostProfile[] = [];
  for (const raw of written) {
    const source = asString(raw);
    if (!source) continue;
    try {
      profiles.push({ label: source, slopeDeg: evaluate(source, env), colour: GHOST_COLOURS[profiles.length % GHOST_COLOURS.length] as string });
    } catch {
      // A slope the environment cannot evaluate is simply not drawn.
    }
  }
  if (profiles.length === 0) return undefined;
  return { structure, profiles, errorBandArcmin: asNumber(params.error_band_arcmin) };
}

// --- The sky overlays ------------------------------------------------------

/** Everything a sky overlay needs besides the claim: the model, and the moment. */
export interface OverlayContext {
  env: Environment;
  pyramids: PyramidParams[];
  interiors: StructureInterior[];
  /** The ten stars the claims name, from the bundle. */
  stars: Star[];
  /** The epoch the scene is drawn at, which is what the overlays follow. */
  epoch: number;
  /** Local apparent sidereal time as an angle. */
  lstDeg: number;
  latitudeDeg: number;
}

/** One star, everything an overlay wants to draw or label it with. */
export interface StarMark {
  id: string;
  name: string;
  bayer: string;
  /** Right ascension of date, which is also the sidereal time of its transit. */
  raDeg: number;
  decDeg: number;
  /** Where it is right now, at the scene's sidereal time. */
  altDeg: number;
  azDeg: number;
  direction: Vec3;
  /** Altitude at upper culmination, and which side of the zenith that falls on. */
  transitAltitudeDeg: number;
  transitNorth: boolean;
  /** Altitude below the pole. Negative means the star sets. */
  lowerAltitudeDeg: number;
  /** The sidereal time that puts it on the meridian, above the pole and below it. */
  transitLstDeg: number;
  lowerLstDeg: number;
  colour: string;
}

export function markStar(star: Star, ctx: OverlayContext, colour = RAY_COLOURS[0] as string): StarMark {
  const placed = placeOnDome(star, { epoch: ctx.epoch, latitudeDeg: ctx.latitudeDeg, lstDeg: ctx.lstDeg });
  return {
    id: star.id,
    name: star.name,
    bayer: star.bayer,
    raDeg: placed.raDeg,
    decDeg: placed.decDeg,
    altDeg: placed.altDeg,
    azDeg: placed.azDeg,
    direction: placed.direction,
    transitAltitudeDeg: transitAltitude(placed.decDeg, ctx.latitudeDeg),
    transitNorth: transitIsNorth(placed.decDeg, ctx.latitudeDeg),
    lowerAltitudeDeg: lowerCulminationAltitude(placed.decDeg, ctx.latitudeDeg),
    transitLstDeg: transitLst(placed.raDeg),
    lowerLstDeg: transitLst(placed.raDeg + 180),
    colour,
  };
}

/** Turn a point in a structure's own frame into the scene frame. */
export function placePoint(p: Point, params: PyramidParams): Point {
  const a = params.orientationDeg * DEG;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return [
    params.offsetEast + p[0] * cos - p[1] * sin,
    params.offsetNorth + p[0] * sin + p[1] * cos,
    params.offsetUp + p[2],
  ];
}

/** Turn a direction in a structure's own frame into the scene frame. */
export function placeDirection(d: Vec3, params: PyramidParams): Vec3 {
  const a = params.orientationDeg * DEG;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return [d[0] * cos - d[1] * sin, d[0] * sin + d[1] * cos, d[2]];
}

/** A named point on one of a structure's interior solids, in that structure's frame. */
function landmark(ctx: OverlayContext, structure: StructureId, key: string): Point | undefined {
  const interior = ctx.interiors.find((i) => i.params.id === structure);
  if (!interior) return undefined;
  for (const solid of Object.values(interior.solids)) {
    const found = solid.landmarks[key];
    if (found) return found;
  }
  return undefined;
}

function structureOf(ctx: OverlayContext, id: string): PyramidParams | undefined {
  return ctx.pyramids.find((p) => p.id === id);
}

const normalise = (v: Vec3): Vec3 => {
  const m = Math.hypot(v[0], v[1], v[2]);
  return m === 0 ? [0, 0, 1] : [v[0] / m, v[1] / m, v[2] / m];
};

/** A direction from an altitude and an azimuth of 0 (north) or 180 (south). */
function meridianDirection(altDeg: number, side: 'north' | 'south'): Vec3 {
  const alt = altDeg * DEG;
  const horizontal = Math.cos(alt) * (side === 'north' ? 1 : -1);
  return [0, horizontal, Math.sin(alt)];
}

// --- C2 shaft rays ---------------------------------------------------------

export interface ShaftRay {
  /** The shaft as the claim file names it, such as `kc.shaft.south`. */
  key: string;
  label: string;
  side: 'north' | 'south';
  /** The measured shaft angle above the horizontal, degrees. */
  angleDeg: number;
  /** Where the ray starts: the chamber's centre, in the scene frame. */
  from: Point;
  /** Unit vector along the shaft, in the meridian plane. */
  direction: Vec3;
  star: StarMark;
  /** The star's transit altitude less the shaft angle, degrees. */
  residualDeg: number;
  colour: string;
}

export interface ShaftRaysSpec {
  structure: StructureId;
  rays: ShaftRay[];
}

/**
 * C2. One ray per shaft, from the chamber's centre out along the measured
 * angle in the meridian plane, north or south as the shaft's own name says,
 * with the star the claim assigns to it marked where it stands now.
 *
 * The shafts themselves are not in the database as geometry, only as four
 * angles, so a ray is drawn rather than a bore: the honest picture of what is
 * actually measured. The chamber centre is the interior landmark, so the ray
 * starts where the room is and not at an assumed point.
 */
export function shaftRaysSpec(claim: Claim, ctx: OverlayContext): ShaftRaysSpec | undefined {
  const overlay = claim.overlay;
  if (!overlay || overlay.type !== 'shaft-rays') return undefined;
  const params: Record<string, unknown> = overlay.params ?? {};
  const structure = asString(params.structure) ?? 'g1';
  if (!isStructure(structure)) return undefined;
  const placed = structureOf(ctx, structure);
  if (!placed) return undefined;

  const shafts = asStrings(params.shafts);
  const names = asStrings(params.stars);
  const rays: ShaftRay[] = [];
  shafts.forEach((key, i) => {
    const parts = key.split('.');
    const side = parts[parts.length - 1];
    const chamber = parts[0];
    if ((side !== 'north' && side !== 'south') || chamber === undefined) return;
    const angleDeg = ctx.env[`${key}.angle`];
    const centre = landmark(ctx, structure, `${chamber}.centre`);
    const star = starByName(ctx.stars, names[i] ?? '');
    if (angleDeg === undefined || !centre || !star) return;
    const colour = RAY_COLOURS[rays.length % RAY_COLOURS.length] as string;
    const mark = markStar(star, ctx, colour);
    rays.push({
      key,
      label: `${chamber.toUpperCase()} ${side} shaft`,
      side,
      angleDeg,
      from: placePoint(centre, placed),
      direction: placeDirection(meridianDirection(angleDeg, side), placed),
      star: mark,
      residualDeg: mark.transitAltitudeDeg - angleDeg,
      colour,
    });
  });
  return rays.length === 0 ? undefined : { structure, rays };
}

// --- C3 passage ray --------------------------------------------------------

export interface PassageRaySpec {
  structure: StructureId;
  /** The passage as the claim names it, such as `passage.descending`. */
  passage: string;
  /** The recorded axis angle, degrees above the horizontal. */
  angleDeg: number;
  /** The same angle as the two floor landmarks actually give it. */
  landmarkAngleDeg: number;
  /** The mouth of the passage, in the scene frame. */
  from: Point;
  /** Looking up and out of the passage, which is north. */
  direction: Vec3;
  star: StarMark;
  culmination: 'upper' | 'lower';
  /** The altitude the claim puts against the passage angle. */
  targetAltitudeDeg: number;
  residualDeg: number;
  colour: string;
}

/**
 * C3. The descending passage's axis carried out of its mouth to the dome,
 * with the star the claim names marked. The axis is the two floor landmarks,
 * not the recorded angle, so the line is the passage the survey measured; the
 * recorded angle is carried alongside and the panel shows both.
 */
export function passageRaySpec(claim: Claim, ctx: OverlayContext): PassageRaySpec | undefined {
  const overlay = claim.overlay;
  if (!overlay || overlay.type !== 'passage-ray') return undefined;
  const params: Record<string, unknown> = overlay.params ?? {};
  const structure = asString(params.structure) ?? 'g1';
  if (!isStructure(structure)) return undefined;
  const placed = structureOf(ctx, structure);
  if (!placed) return undefined;

  // The claim writes the passage as the key of its angle record; the solid and
  // its landmarks are that key with the last segment dropped.
  const angleKey = asString(params.passage) ?? '';
  const passage = angleKey.endsWith('.angle') ? angleKey.slice(0, -'.angle'.length) : angleKey;
  const angleDeg = ctx.env[`${passage}.angle`];
  const mouth = landmark(ctx, structure, `${passage}.floor.begin`);
  const foot = landmark(ctx, structure, `${passage}.floor.end`);
  const star = starByName(ctx.stars, asString(params.star) ?? '');
  if (angleDeg === undefined || !mouth || !foot || !star) return undefined;

  const along = normalise([mouth[0] - foot[0], mouth[1] - foot[1], mouth[2] - foot[2]]);
  const culmination = asString(params.culmination) === 'upper' ? 'upper' : 'lower';
  const colour = RAY_COLOURS[0] as string;
  const mark = markStar(star, ctx, colour);
  const targetAltitudeDeg = culmination === 'lower' ? mark.lowerAltitudeDeg : mark.transitAltitudeDeg;
  return {
    structure,
    passage,
    angleDeg,
    landmarkAngleDeg: Math.asin(along[2]) / DEG,
    from: placePoint(mouth, placed),
    direction: placeDirection(along, placed),
    star: mark,
    culmination,
    targetAltitudeDeg,
    residualDeg: targetAltitudeDeg - angleDeg,
    colour,
  };
}

// --- What the scene is handed ---------------------------------------------

export type OverlaySpec =
  | { kind: 'ghost-profile'; spec: GhostProfileSpec }
  | { kind: 'shaft-rays'; spec: ShaftRaysSpec }
  | { kind: 'passage-ray'; spec: PassageRaySpec };

/** The overlay a claim declares, resolved, or undefined when it is not built. */
export function overlaySpec(claim: Claim | undefined, ctx: OverlayContext): OverlaySpec | undefined {
  if (!claim) return undefined;
  const ghost = ghostProfileSpec(claim, ctx.env);
  if (ghost) return { kind: 'ghost-profile', spec: ghost };
  const shafts = shaftRaysSpec(claim, ctx);
  if (shafts) return { kind: 'shaft-rays', spec: shafts };
  const passage = passageRaySpec(claim, ctx);
  if (passage) return { kind: 'passage-ray', spec: passage };
  return undefined;
}

export interface OverlayNote {
  type: string | undefined;
  built: boolean;
  text: string;
}

const ROUND = (v: number, d = 1): string => v.toFixed(d);

export function overlayNote(claim: Claim, ctx: OverlayContext): OverlayNote {
  const type = claim.overlay?.type;
  if (!type) return { type: undefined, built: false, text: 'This claim declares no overlay.' };
  const found = overlaySpec(claim, ctx);
  if (!found) return { type, built: false, text: `Overlay "${type}" not built yet.` };
  return { type, built: true, text: describe(found) };
}

function describe(overlay: OverlaySpec): string {
  switch (overlay.kind) {
    case 'ghost-profile': {
      const structure = overlay.spec.structure.toUpperCase();
      return overlay.spec.profiles.length === 1
        ? `Ghosted over ${structure}: a pyramid on the measured base at the claimed slope.`
        : `Ghosted over ${structure}: ${overlay.spec.profiles.length} pyramids on the measured base, one per claimed slope.`;
    }
    case 'shaft-rays':
      return `${overlay.spec.rays.length} rays from the chamber centres at the measured shaft angles, each carried to the dome with its star marked where it stands now.`;
    case 'passage-ray':
      return `The ${overlay.spec.passage.split('.').pop()} passage axis carried out of its mouth to the dome, with ${overlay.spec.star.name} marked at ${ROUND(overlay.spec.star.altDeg)}°.`;
  }
}
