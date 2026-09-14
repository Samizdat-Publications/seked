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
import { evaluate, type Claim, type Comparison } from '@seked/claims/browser';
import type { Environment, Point } from '@seked/geometry';
import {
  lowerCulminationAltitude,
  meridianAngle,
  placeOnDome,
  positionsAtEpoch,
  skyEnvironment,
  tangentOffset,
  transitAltitude,
  transitIsNorth,
  transitLst,
  type Equatorial,
  type Star,
  type TangentPoint,
  type Vec3,
} from '@seked/sky/browser';
import { DEG } from '@seked/units';
import { STRUCTURES, type PyramidParams, type StructureId, type StructureInterior } from './model';
import { starByName } from './sky';

export const BUILT_OVERLAYS = new Set([
  'ghost-profile',
  'ghost-profiles',
  'shaft-rays',
  'passage-ray',
  'compass-rose',
  'sky-projection',
  'sun-ribbon',
  'akhet',
  'ground-bearings',
  'ground-outlines',
  'ground-rectangle',
  'ground-line',
  'chamber-wireframe',
]);

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
  /** C4's free choice: lay the sky on the plateau with north and south swapped. */
  krupp: boolean;
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

// --- C1 compass rose -------------------------------------------------------

export interface CompassRoseSpec {
  structure: StructureId;
  /** The pyramid's base centre in the scene frame. */
  centre: Point;
  radiusM: number;
  /** The measured azimuth of the sides, degrees east of north; a few arcminutes. */
  azimuthDeg: number;
  arcminutes: number;
  /**
   * What the drawn line is multiplied by. Three arcminutes over a rose of a
   * couple of hundred metres is a fifth of a millimetre, which is nothing at
   * all, so the line is drawn wide of the truth on purpose and says so.
   */
  exaggeration: number;
  /** The methods the claim's sources propose, and the stars Spence's needs. */
  methods: string[];
  stars: StarMark[];
}

/**
 * C1. True north and the pyramid's own north on the same rose, with the
 * difference exaggerated so it can be seen at all. The exaggeration is a
 * number in the claim file, so the drawing's one lie is declared in data
 * rather than buried in a component.
 */
export function compassRoseSpec(claim: Claim, ctx: OverlayContext): CompassRoseSpec | undefined {
  const overlay = claim.overlay;
  if (!overlay || overlay.type !== 'compass-rose') return undefined;
  const params: Record<string, unknown> = overlay.params ?? {};
  const structure = asString(params.structure) ?? 'g1';
  if (!isStructure(structure)) return undefined;
  const placed = structureOf(ctx, structure);
  if (!placed) return undefined;

  const stars = asStrings(params.stars)
    .map((name, i) => {
      const star = starByName(ctx.stars, name);
      return star ? markStar(star, ctx, RAY_COLOURS[i % RAY_COLOURS.length] as string) : undefined;
    })
    .filter((s): s is StarMark => s !== undefined);

  return {
    structure,
    centre: [placed.offsetEast, placed.offsetNorth, placed.offsetUp],
    radiusM: asNumber(params.radius_m) ?? placed.base * 0.8,
    azimuthDeg: placed.orientationDeg,
    arcminutes: placed.orientationDeg * 60,
    exaggeration: asNumber(params.exaggeration) ?? 1,
    methods: asStrings(params.methods),
    stars,
  };
}

// --- C4 sky projection -----------------------------------------------------

export interface ProjectedStar {
  id: string;
  name: string;
  /** Where the star lands on the plateau: east and north in the scene frame, metres. */
  at: [number, number];
  /** Its place on the tangent plane about the centre star, degrees. */
  tangent: TangentPoint;
}

export interface GroundPoint {
  id: StructureId;
  at: [number, number];
}

export interface SkyProjectionSpec {
  /** The pyramid centres the belt is laid against, in the claim file's order. */
  ground: GroundPoint[];
  belt: ProjectedStar[];
  /** Metres on the plateau per degree on the tangent plane. */
  scale: number;
  /** The belt's angle from the meridian, degrees; C4's first comparison. */
  beltAngleDeg: number;
  /** The same angle for the ground line the claim compares it with. */
  groundAngleDeg: number;
  /** North and south swapped, which is what Krupp says the correlation needs. */
  inverted: boolean;
  /** How high above the pavement the projection is drawn, so it reads over the ground. */
  height: number;
}

/**
 * C4. The belt at the scene's epoch, laid on the plateau about the pyramids.
 *
 * The construction is the claim's own: a tangent plane about the middle star
 * of the three, x the difference in right ascension times the cosine of that
 * star's declination and y the difference in declination, both in degrees.
 * The plane is then scaled so the first two stars are as far apart as the
 * first two pyramid centres, and laid down with x along east and y along
 * north, anchored on the first pyramid. Nothing is rotated to fit: the belt's
 * angle from the meridian is what the claim's first comparison measures, and
 * it comes out of this picture unchanged, which a test pins.
 *
 * The one choice is the sign of north, because laying a map of the sky on the
 * ground can be done either way up. That is Krupp's objection and C4's second
 * free choice, and it is a toggle rather than a constant.
 */
export function skyProjectionSpec(claim: Claim, ctx: OverlayContext): SkyProjectionSpec | undefined {
  const overlay = claim.overlay;
  if (!overlay || overlay.type !== 'sky-projection') return undefined;
  const params: Record<string, unknown> = overlay.params ?? {};

  const stars = asStrings(params.stars)
    .map((name) => starByName(ctx.stars, name))
    .filter((s): s is Star => s !== undefined);
  const ground = asStrings(params.ground)
    .filter(isStructure)
    .map((id) => structureOf(ctx, id))
    .filter((p): p is PyramidParams => p !== undefined)
    .map((p) => ({ id: p.id, at: [p.offsetEast, p.offsetNorth] as [number, number] }));
  if (stars.length < 2 || ground.length < 2) return undefined;

  // The tangent plane is about the middle star, which is what C4's formulas
  // take the cosine of; with two stars there is no middle and the first serves.
  const places = positionsAtEpoch(stars, ctx.epoch);
  const centre = places[Math.floor((stars.length - 1) / 2)] as Equatorial;
  const tangents = places.map((p) => tangentOffset(p, centre));

  const first = tangents[0] as TangentPoint;
  const second = tangents[1] as TangentPoint;
  const skySeparation = Math.hypot(second.x - first.x, second.y - first.y);
  const g0 = ground[0] as GroundPoint;
  const g1 = ground[1] as GroundPoint;
  const groundSeparation = Math.hypot(g1.at[0] - g0.at[0], g1.at[1] - g0.at[1]);
  if (skySeparation === 0 || groundSeparation === 0) return undefined;
  const scale = groundSeparation / skySeparation;
  const northward = ctx.krupp ? -1 : 1;

  const belt: ProjectedStar[] = stars.map((star, i) => {
    const t = tangents[i] as TangentPoint;
    return {
      id: star.id,
      name: star.name,
      tangent: t,
      at: [g0.at[0] + (t.x - first.x) * scale, g0.at[1] + northward * (t.y - first.y) * scale],
    };
  });

  const last = tangents[tangents.length - 1] as TangentPoint;
  const lastGround = ground[ground.length - 1] as GroundPoint;
  return {
    ground,
    belt,
    scale,
    beltAngleDeg: meridianAngle(first, last),
    groundAngleDeg:
      Math.atan2(Math.abs(lastGround.at[0] - g0.at[0]), Math.abs(lastGround.at[1] - g0.at[1])) / DEG,
    inverted: ctx.krupp,
    height: 12,
  };
}

// --- C5 and C6: bearings drawn on the plateau ------------------------------

/** A direction from the viewpoint, drawn as a line along the ground. */
export interface GroundBearing {
  label: string;
  /** The expression the claim file writes, which is the honest caption for the line. */
  source: string;
  azimuthDeg: number;
  colour: string;
}

/** A place on the plateau the viewpoint is sighted on, such as a pyramid's corner. */
export interface GroundSight {
  label: string;
  /** East and north in the scene frame, metres. */
  at: [number, number];
  /** The bearing to it, which is what the claim's target is made of. */
  azimuthDeg: number;
  colour: string;
}

/**
 * The three overlay types this spec serves. C5 and C6 name the picture they
 * draw; `ground-bearings` is the same picture under its own name, for a claim
 * whose bearings are not a ribbon or an akhet.
 */
const GROUND_BEARING_TYPES = ['sun-ribbon', 'akhet', 'ground-bearings'] as const;
type GroundBearingsType = (typeof GROUND_BEARING_TYPES)[number];

const isGroundBearings = (type: string): type is GroundBearingsType =>
  (GROUND_BEARING_TYPES as readonly string[]).includes(type);

export interface GroundBearingsSpec {
  type: GroundBearingsType;
  /** The viewpoint: a structure's centre, east and north in the scene frame. */
  from: [number, number];
  /** Metres above the pavement the lines are drawn at, so they read over the ground. */
  height: number;
  lengthM: number;
  bearings: GroundBearing[];
  sights: GroundSight[];
}

/**
 * A structure's centre in the scene frame, whichever way the database places
 * it: the derived east and north offsets for a structure placed by a
 * coordinate, and Petrie's south and west for the two he triangulated.
 */
function centreOf(env: Environment, id: string): [number, number] | undefined {
  const west = env[`${id}.centre.offset.west`];
  const south = env[`${id}.centre.offset.south`];
  const east = env[`${id}.centre.offset.east`] ?? (west === undefined ? undefined : -west);
  const north = env[`${id}.centre.offset.north`] ?? (south === undefined ? undefined : -south);
  return east === undefined || north === undefined ? undefined : [east, north];
}

/** A corner of a structure's base, named by the claim and placed on the ground. */
export interface GroundCorner {
  label: string;
  /** East and north in the scene frame, metres. */
  at: [number, number];
}

/**
 * `g1.sw`, `g2.ne`, `g3.corner.sw`: a base corner of a structure, from its
 * centre and its half-base. The claims write the corner both ways, so the
 * structure is the first segment and the corner the last, whatever is between.
 */
function cornerOf(env: Environment, name: string): GroundCorner | undefined {
  const parts = name.split('.');
  const id = parts[0];
  const corner = parts[parts.length - 1];
  if (!id || !corner || parts.length < 2) return undefined;
  const centre = centreOf(env, id);
  const half = env[`${id}.base.half`];
  if (!centre || half === undefined) return undefined;
  const lower = corner.toLowerCase();
  const north = lower.includes('n') ? 1 : lower.includes('s') ? -1 : 0;
  const east = lower.includes('e') ? 1 : lower.includes('w') ? -1 : 0;
  if (north === 0 || east === 0) return undefined;
  return {
    label: `${id.toUpperCase()} ${corner.toUpperCase()} corner`,
    at: [centre[0] + east * half, centre[1] + north * half],
  };
}

/**
 * The claim's own comparison for one part of an overlay, found by the start of
 * its label. An overlay that needs a target takes it from the claim rather
 * than carrying a constant of its own, so the drawing and the dossier cannot
 * come to hold different numbers.
 */
function comparisonFor(claim: Claim, prefix: string): Comparison | undefined {
  return claim.comparisons.find((c) => c.label.startsWith(prefix));
}

/**
 * An expression evaluated in the environment, or nothing when this preset
 * cannot evaluate it. An overlay drops the part it cannot draw rather than
 * taking the whole claim down with it.
 */
function tryEvaluate(source: string, env: Environment): number | undefined {
  try {
    const value = evaluate(source, env);
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

const azimuthTo = (from: readonly number[], to: readonly number[]): number =>
  (Math.atan2((to[0] as number) - (from[0] as number), (to[1] as number) - (from[1] as number)) / DEG + 360) % 360;

/**
 * C5 and C6. Both claims are a bearing taken from a place on the ground: a
 * star and the sun rising over the eastern horizon seen from the Sphinx, and
 * the summer solstice sun setting into the gap between two pyramids seen from
 * the same spot. So both are drawn the same way, as lines along the plateau
 * from the viewpoint, and the claim file says which lines.
 *
 * Every azimuth is an expression in the claim's own language evaluated in the
 * environment of the scene's epoch, so a line and the residual in the panel
 * cannot disagree, and dragging the sky moves both.
 */
export function groundBearingsSpec(claim: Claim, ctx: OverlayContext): GroundBearingsSpec | undefined {
  const overlay = claim.overlay;
  if (!overlay || !isGroundBearings(overlay.type)) return undefined;
  const params: Record<string, unknown> = overlay.params ?? {};
  const from = centreOf(ctx.env, asString(params.from) ?? 'sphinx');
  if (!from) return undefined;

  // The same scope the claim evaluator builds: the measured and derived keys,
  // plus the stars and the sun of this epoch.
  const scope: Environment = {
    ...ctx.env,
    ...skyEnvironment({ epoch: ctx.epoch, latitudeDeg: ctx.latitudeDeg, stars: ctx.stars }),
  };

  const bearings: GroundBearing[] = [];
  for (const entry of Array.isArray(params.bearings) ? params.bearings : []) {
    if (typeof entry !== 'object' || entry === null) continue;
    const row = entry as Record<string, unknown>;
    const label = asString(row.label);
    const source = asString(row.azimuth);
    if (!label || !source) continue;
    try {
      const azimuthDeg = evaluate(source, scope);
      if (!Number.isFinite(azimuthDeg)) continue;
      bearings.push({ label, source, azimuthDeg, colour: RAY_COLOURS[bearings.length % RAY_COLOURS.length] as string });
    } catch {
      // A bearing the environment cannot evaluate is simply not drawn.
    }
  }

  const sights: GroundSight[] = asStrings(params.corners)
    .map((name) => cornerOf(ctx.env, name))
    .filter((c): c is GroundCorner => c !== undefined)
    .map((c) => ({ ...c, azimuthDeg: azimuthTo(from, c.at), colour: SIGHT_COLOUR }));

  if (bearings.length === 0 && sights.length === 0) return undefined;
  return {
    type: overlay.type,
    from,
    height: asNumber(params.height_m) ?? 8,
    lengthM: asNumber(params.length_m) ?? 1200,
    bearings,
    sights,
  };
}

/** The corner sight lines, which are ground and not sky. */
export const SIGHT_COLOUR = '#cfd8e3';

/**
 * "1.7 m west": a signed offset said in words. A miss on the ground has a
 * direction rather than a sign, and the scene and the panel have to say it
 * the same way.
 */
export const offsetWords = (metres: number, positive: string, negative: string): string =>
  `${Math.abs(metres).toFixed(1)} m ${metres < 0 ? negative : positive}`;

// --- B4 the base lines, drawn on the ground --------------------------------

/** One square on the pavement: a base line the claim measures a side of. */
export interface GroundOutline {
  /** The line as the claim file names it, `casing` or `socket`. */
  name: string;
  label: string;
  sideM: number;
  /** The side in Smyth's pyramid inches, which is the number the claim compares. */
  sideInches: number;
  /** Days in the tropical year times twenty-five, which is what he compares it with. */
  targetInches: number;
  residualPct: number;
  /**
   * Petrie's sockets are cut holes at the four corners, so the socket line has
   * points on the ground to mark; the casing line is an edge and has none.
   */
  markCorners: boolean;
  /** The four corners in the scene frame, north-east first, then anticlockwise. */
  corners: Point[];
  colour: string;
}

export interface GroundOutlinesSpec {
  structure: StructureId;
  outlines: GroundOutline[];
}

/** Which measured side each named base line is, and how it is drawn. */
const BASE_LINES: Record<string, { key: string; label: string; markCorners: boolean }> = {
  casing: { key: 'base.side.mean', label: 'casing base line', markCorners: false },
  socket: { key: 'base.socket.mean', label: 'socket base line', markCorners: true },
};

/** A square of this side about the structure's centre, turned with the structure. */
function outlineCorners(sideM: number, placed: PyramidParams): Point[] {
  const half = sideM / 2;
  const ring: ReadonlyArray<readonly [number, number]> = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  return ring.map(([east, north]) => placePoint([east * half, north * half, 1], placed));
}

/**
 * B4. The two base lines the claim's argument is actually about, drawn as two
 * squares on the pavement: the casing edge Petrie measured and the line
 * through Petrie's socket corners, which is the one Smyth's number needs.
 *
 * The whole dispute is 0.7 m of ground, so the picture cannot carry it and
 * does not pretend to: the squares say where the two lines are and the panel
 * beside them says how far each is from Smyth's 9,131 inches.
 */
export function groundOutlinesSpec(claim: Claim, ctx: OverlayContext): GroundOutlinesSpec | undefined {
  const overlay = claim.overlay;
  if (!overlay || overlay.type !== 'ground-outlines') return undefined;
  const params: Record<string, unknown> = overlay.params ?? {};
  const structure = asString(params.structure) ?? 'g1';
  if (!isStructure(structure)) return undefined;
  const placed = structureOf(ctx, structure);
  if (!placed) return undefined;

  const inch = ctx.env['unit.pyramid_inch'];
  const year = ctx.env['year.tropical'];
  if (inch === undefined || year === undefined) return undefined;
  const targetInches = year * 25;

  const outlines: GroundOutline[] = [];
  for (const name of asStrings(params.outlines)) {
    const line = BASE_LINES[name];
    if (line === undefined) continue;
    // A preset that does not carry the socket sides has no socket line, and
    // the casing square is drawn on its own rather than nothing at all.
    const sideM = ctx.env[`${structure}.${line.key}`];
    if (sideM === undefined) continue;
    const sideInches = sideM / inch;
    outlines.push({
      name,
      label: line.label,
      sideM,
      sideInches,
      targetInches,
      residualPct: ((sideInches - targetInches) / targetInches) * 100,
      markCorners: line.markCorners,
      corners: outlineCorners(sideM, placed),
      colour: RAY_COLOURS[outlines.length % RAY_COLOURS.length] as string,
    });
  }
  return outlines.length === 0 ? undefined : { structure, outlines };
}

// --- D2 Legon's rectangle --------------------------------------------------

export interface GroundRectangleSpec {
  /** The rectangle's north-east corner, which both rectangles are anchored on. */
  from: GroundCorner;
  /** The measured south-west corner, which is Menkaure's. */
  to: GroundCorner;
  /** Metres above the datum the two rectangles are drawn at. */
  height: number;
  extentEastM: number;
  extentNorthM: number;
  extentEastCubits: number;
  extentNorthCubits: number;
  claimedEastCubits: number;
  claimedNorthCubits: number;
  claimedEastM: number;
  claimedNorthM: number;
  /** The expressions the claim writes its two targets as, which are the honest captions. */
  claimedEastSource: string | undefined;
  claimedNorthSource: string | undefined;
  /** Where the claimed rectangle's south-west corner falls, in the scene frame. */
  claimedSouthWest: [number, number];
  /** From the claimed corner to the measured one: east and north, metres. */
  missEastM: number;
  missNorthM: number;
  residualEastPct: number;
  residualNorthPct: number;
  measuredColour: string;
  claimedColour: string;
}

/**
 * D2. Two rectangles laid over the plateau on the same corner: the one the
 * three pyramids actually make, from Khufu's north-east corner to Menkaure's
 * south-west, and the 1000√2 by 1000√3 cubits Legon says was set out.
 *
 * Anchoring both on the same corner is the point. A claim about a rectangle
 * of round numbers is a claim that one corner follows from the other, so the
 * drawing lets the second corner fall where the arithmetic puts it and marks
 * how far that is from the corner Menkaure has.
 */
export function groundRectangleSpec(claim: Claim, ctx: OverlayContext): GroundRectangleSpec | undefined {
  const overlay = claim.overlay;
  if (!overlay || overlay.type !== 'ground-rectangle') return undefined;
  const params: Record<string, unknown> = overlay.params ?? {};
  const [from, to] = asStrings(params.corners).map((name) => cornerOf(ctx.env, name));
  const cubit = ctx.env['cubit.royal'];
  if (!from || !to || cubit === undefined) return undefined;

  // High enough to clear the highest pavement the rectangle crosses, which is
  // Khafre's: the plateau rises about ten metres between Khufu and Menkaure.
  const named = asStrings(params.structures)
    .filter(isStructure)
    .map((id) => structureOf(ctx, id))
    .filter((p): p is PyramidParams => p !== undefined);
  const height = (named.length === 0 ? 0 : Math.max(...named.map((p) => p.offsetUp))) + 8;

  const extentEastM = from.at[0] - to.at[0];
  const extentNorthM = from.at[1] - to.at[1];
  const extentEastCubits = extentEastM / cubit;
  const extentNorthCubits = extentNorthM / cubit;
  const claimedEastCubits = 1000 * Math.SQRT2;
  const claimedNorthCubits = 1000 * Math.sqrt(3);
  const claimedEastM = claimedEastCubits * cubit;
  const claimedNorthM = claimedNorthCubits * cubit;
  const claimedSouthWest: [number, number] = [from.at[0] - claimedEastM, from.at[1] - claimedNorthM];

  return {
    from,
    to,
    height,
    extentEastM,
    extentNorthM,
    extentEastCubits,
    extentNorthCubits,
    claimedEastCubits,
    claimedNorthCubits,
    claimedEastM,
    claimedNorthM,
    claimedEastSource: comparisonFor(claim, 'east-west')?.target,
    claimedNorthSource: comparisonFor(claim, 'north-south')?.target,
    claimedSouthWest,
    missEastM: to.at[0] - claimedSouthWest[0],
    missNorthM: to.at[1] - claimedSouthWest[1],
    residualEastPct: ((extentEastCubits - claimedEastCubits) / claimedEastCubits) * 100,
    residualNorthPct: ((extentNorthCubits - claimedNorthCubits) / claimedNorthCubits) * 100,
    measuredColour: RAY_COLOURS[0] as string,
    claimedColour: RAY_COLOURS[1] as string,
  };
}

// --- D1 the corner line, carried off the plateau ---------------------------

/** Somewhere off the plateau a line is aimed at, placed from its coordinates. */
export interface GroundTarget {
  /** The claim's own name for it, such as `heliopolis.obelisk`. */
  key: string;
  label: string;
  /** East and north in the scene frame, metres. */
  at: [number, number];
  /** Its distance from the frame's origin, which is the Great Pyramid's base centre. */
  distanceM: number;
  /**
   * The records `buildEnvironment` derived those offsets from, so the panel
   * can say how well the place is actually known instead of asserting it.
   */
  recordKeys: string[];
}

export interface GroundLineSpec {
  /** The far corner the line is taken from, and the near one it runs through. */
  from: GroundCorner;
  through: GroundCorner;
  to: GroundTarget;
  /** Metres above the datum the lines are drawn at. */
  height: number;
  /** The bearing the two corners give, which is the claim's measured value. */
  cornerBearingDeg: number;
  /** The bearing from the frame's origin to the target, which is its first target. */
  targetBearingDeg: number;
  /** The round number the claim also compares the corner line with. */
  referenceBearingDeg: number | undefined;
  residualToTargetDeg: number;
  residualToReferenceDeg: number | undefined;
  cornerColour: string;
  targetColour: string;
  referenceColour: string;
}

/** `heliopolis.obelisk` read as a name rather than as a key. */
function nameOf(key: string): string {
  const words = key.split('.').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * D1. The line through two south-east corners, carried out to the distance of
 * the obelisk it is said to point at, beside the bearing to the obelisk
 * itself and the round 45 degrees the claim also asks for.
 *
 * Three lines from one place is the whole picture: the reader sees at once
 * that the corner line and the bearing to Heliopolis are a degree and a half
 * apart, which no amount of arithmetic in a panel makes as plain. The target
 * is placed from its own coordinates through the environment's derived
 * offsets, so the drawing and the claim's target are the same number.
 */
export function groundLineSpec(claim: Claim, ctx: OverlayContext): GroundLineSpec | undefined {
  const overlay = claim.overlay;
  if (!overlay || overlay.type !== 'ground-line') return undefined;
  const params: Record<string, unknown> = overlay.params ?? {};
  const from = cornerOf(ctx.env, asString(params.from) ?? '');
  const through = cornerOf(ctx.env, asString(params.through) ?? '');
  const key = asString(params.to) ?? '';
  const at = centreOf(ctx.env, key);
  if (!from || !through || !at) return undefined;

  // The second comparison is the round number the claim also states, which
  // the drawing carries as a third line rather than as a constant of its own.
  const reference = claim.comparisons[1];
  const referenceBearingDeg = reference === undefined ? undefined : tryEvaluate(reference.target, ctx.env);

  const cornerBearingDeg = azimuthTo(from.at, through.at);
  const targetBearingDeg = azimuthTo([0, 0], at);
  return {
    from,
    through,
    to: {
      key,
      label: nameOf(key),
      at,
      distanceM: Math.hypot(at[0], at[1]),
      recordKeys: [`${key}.center.latitude`, `${key}.center.longitude`],
    },
    height: 8,
    cornerBearingDeg,
    targetBearingDeg,
    referenceBearingDeg,
    residualToTargetDeg: cornerBearingDeg - targetBearingDeg,
    residualToReferenceDeg: referenceBearingDeg === undefined ? undefined : cornerBearingDeg - referenceBearingDeg,
    cornerColour: RAY_COLOURS[0] as string,
    targetColour: RAY_COLOURS[1] as string,
    referenceColour: SIGHT_COLOUR,
  };
}

// --- A4 the King's Chamber as a wireframe ----------------------------------

/** One diagonal of a chamber, and what the claim asks of it. */
export interface ChamberDiagonal {
  /** The diagonal as the claim file names it: `end-wall`, `floor` or `space`. */
  name: string;
  /** Its two ends in the scene frame. */
  from: Point;
  to: Point;
  lengthM: number;
  cubits: number;
  /** What the claim's matching comparison asks for, when it has one. */
  target: number | undefined;
  residualPct: number | undefined;
  colour: string;
}

export interface ChamberWireframeSpec {
  structure: StructureId;
  /** The chamber's landmark prefix, such as `kc`. */
  chamber: string;
  /**
   * The twelve edges as twenty-four points, each pair one edge: four on the
   * floor, four on the ceiling and four standing between them.
   */
  edges: Point[];
  diagonals: ChamberDiagonal[];
}

/** Which two corners each named diagonal runs between. */
const CHAMBER_DIAGONALS: Record<string, readonly [string, string]> = {
  // The end walls are the short ones, ten cubits wide and eleven high; the
  // chamber is twenty cubits east to west, so this runs up the east wall.
  'end-wall': ['SE.floor', 'NE.ceiling'],
  floor: ['SW.floor', 'NE.floor'],
  space: ['SW.floor', 'NE.ceiling'],
};

/** The corner ring `chamber()` builds, in the order it builds it. */
const CHAMBER_CORNERS = ['NE', 'NW', 'SW', 'SE'] as const;

/**
 * A4. The King's Chamber as twelve edges and three diagonals, drawn through
 * the masonry so the 3-4-5 the claim is about can be seen whole.
 *
 * The box is the one the wall records build; the diagonals are labelled with
 * the claim's own comparisons, evaluated here in the same environment the
 * dossier evaluates them in. Those are not quite the same chamber: Petrie's
 * `kc.length`, `kc.width` and `kc.height` are his means of the wall faces and
 * differ from the four wall positions by a few centimetres. The wireframe is
 * therefore where the room is and the numbers beside it are what the claim
 * compares, which is the only way both can be true at once.
 */
export function chamberWireframeSpec(claim: Claim, ctx: OverlayContext): ChamberWireframeSpec | undefined {
  const overlay = claim.overlay;
  if (!overlay || overlay.type !== 'chamber-wireframe') return undefined;
  const params: Record<string, unknown> = overlay.params ?? {};
  const structure = asString(params.structure) ?? 'g1';
  if (!isStructure(structure)) return undefined;
  const placed = structureOf(ctx, structure);
  const chamber = asString(params.chamber);
  const cubit = ctx.env['cubit.royal'];
  if (!placed || !chamber || cubit === undefined) return undefined;

  const corner = (name: string): Point | undefined => {
    const point = landmark(ctx, structure, `${chamber}.corner.${name}`);
    return point === undefined ? undefined : placePoint(point, placed);
  };
  const floor = CHAMBER_CORNERS.map((c) => corner(`${c}.floor`));
  const ceiling = CHAMBER_CORNERS.map((c) => corner(`${c}.ceiling`));
  if (floor.some((p) => p === undefined) || ceiling.some((p) => p === undefined)) return undefined;

  const edges: Point[] = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    edges.push(floor[i] as Point, floor[j] as Point);
    edges.push(ceiling[i] as Point, ceiling[j] as Point);
    edges.push(floor[i] as Point, ceiling[i] as Point);
  }

  const diagonals: ChamberDiagonal[] = [];
  for (const name of asStrings(params.diagonals)) {
    const ends = CHAMBER_DIAGONALS[name];
    if (ends === undefined) continue;
    const from = corner(ends[0]);
    const to = corner(ends[1]);
    if (!from || !to) continue;
    // With a comparison the diagonal carries the claim's own arithmetic; with
    // none it carries the length of the line that is drawn, and no target.
    const comparison = comparisonFor(claim, name);
    const claimed = comparison === undefined ? undefined : tryEvaluate(comparison.formula, ctx.env);
    const target = comparison === undefined ? undefined : tryEvaluate(comparison.target, ctx.env);
    const cubits = claimed ?? Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) / cubit;
    diagonals.push({
      name,
      from,
      to,
      lengthM: cubits * cubit,
      cubits,
      target,
      residualPct: target === undefined ? undefined : ((cubits - target) / target) * 100,
      colour: RAY_COLOURS[diagonals.length % RAY_COLOURS.length] as string,
    });
  }
  return diagonals.length === 0 ? undefined : { structure, chamber, edges, diagonals };
}

// --- What the scene is handed ---------------------------------------------

export type OverlaySpec =
  | { kind: 'ghost-profile'; spec: GhostProfileSpec }
  | { kind: 'shaft-rays'; spec: ShaftRaysSpec }
  | { kind: 'passage-ray'; spec: PassageRaySpec }
  | { kind: 'compass-rose'; spec: CompassRoseSpec }
  | { kind: 'sky-projection'; spec: SkyProjectionSpec }
  | { kind: 'ground-bearings'; spec: GroundBearingsSpec }
  | { kind: 'ground-outlines'; spec: GroundOutlinesSpec }
  | { kind: 'ground-rectangle'; spec: GroundRectangleSpec }
  | { kind: 'ground-line'; spec: GroundLineSpec }
  | { kind: 'chamber-wireframe'; spec: ChamberWireframeSpec };

/** The overlay a claim declares, resolved, or undefined when it is not built. */
export function overlaySpec(claim: Claim | undefined, ctx: OverlayContext): OverlaySpec | undefined {
  if (!claim) return undefined;
  const ghost = ghostProfileSpec(claim, ctx.env);
  if (ghost) return { kind: 'ghost-profile', spec: ghost };
  const shafts = shaftRaysSpec(claim, ctx);
  if (shafts) return { kind: 'shaft-rays', spec: shafts };
  const passage = passageRaySpec(claim, ctx);
  if (passage) return { kind: 'passage-ray', spec: passage };
  const rose = compassRoseSpec(claim, ctx);
  if (rose) return { kind: 'compass-rose', spec: rose };
  const projection = skyProjectionSpec(claim, ctx);
  if (projection) return { kind: 'sky-projection', spec: projection };
  const bearings = groundBearingsSpec(claim, ctx);
  if (bearings) return { kind: 'ground-bearings', spec: bearings };
  const outlines = groundOutlinesSpec(claim, ctx);
  if (outlines) return { kind: 'ground-outlines', spec: outlines };
  const rectangle = groundRectangleSpec(claim, ctx);
  if (rectangle) return { kind: 'ground-rectangle', spec: rectangle };
  const line = groundLineSpec(claim, ctx);
  if (line) return { kind: 'ground-line', spec: line };
  const wireframe = chamberWireframeSpec(claim, ctx);
  if (wireframe) return { kind: 'chamber-wireframe', spec: wireframe };
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
    case 'compass-rose':
      return `A rose on ${overlay.spec.structure.toUpperCase()}'s base: true north against the measured side azimuth, drawn ${ROUND(overlay.spec.exaggeration, 0)} times wide of the truth so ${ROUND(Math.abs(overlay.spec.arcminutes), 1)}′ can be seen.`;
    case 'sky-projection':
      return `The belt at this epoch laid on the plateau, ${ROUND(overlay.spec.scale, 0)} m per degree, ${overlay.spec.inverted ? 'with north and south swapped' : 'north to north'}.`;
    case 'ground-bearings': {
      const lines = overlay.spec.bearings.map((b) => `${b.label} at ${ROUND(b.azimuthDeg, 2)}°`).join(', ');
      const sighted = overlay.spec.sights.map((s) => `${s.label} at ${ROUND(s.azimuthDeg, 2)}°`).join(' and ');
      return `Lines along the plateau from the viewpoint: ${lines}${sighted ? `, sighted on ${sighted}` : ''}.`;
    }
    case 'ground-outlines': {
      const squares = overlay.spec.outlines.map((o) => `${o.name} at ${ROUND(o.sideM, 2)} m`).join(' and ');
      return `${overlay.spec.structure.toUpperCase()}'s base lines drawn on the pavement, ${squares} a side; the panel carries the difference the picture cannot.`;
    }
    case 'ground-rectangle': {
      const spec = overlay.spec;
      return `The rectangle the pyramids make, ${ROUND(spec.extentEastCubits)} by ${ROUND(spec.extentNorthCubits)} cubits, against the claimed ${ROUND(spec.claimedEastCubits)} by ${ROUND(spec.claimedNorthCubits)}, both anchored on the ${spec.from.label} so the claimed corner falls where the arithmetic puts it.`;
    }
    case 'ground-line': {
      const spec = overlay.spec;
      return `The corner line at ${ROUND(spec.cornerBearingDeg, 2)}° carried ${ROUND(spec.to.distanceM / 1000)} km to the ${spec.to.label}, which lies at ${ROUND(spec.targetBearingDeg, 2)}° from the Great Pyramid's base centre.`;
    }
    case 'chamber-wireframe': {
      const spec = overlay.spec;
      const drawn = spec.diagonals.map((d) => `${d.name} ${ROUND(d.cubits, 2)} rc`).join(', ');
      return `${spec.chamber.toUpperCase()} as a wireframe through the masonry, with the diagonals the claim compares: ${drawn}.`;
    }
  }
}
