/**
 * Everything the viewer derives from the bundle, in one place and with no
 * React in sight. The preset resolver, the environment builder and the claim
 * evaluator are the same functions the dossier runs, so a slider that changes
 * one number re-evaluates every claim the way a regenerated dossier would.
 */
import { evaluateClaim, type Claim, type ClaimResult } from '@seked/claims/browser';
import { resolve, type Database, type Measurement, type Resolved } from '@seked/data/browser';
import { buildEnvironment, courseHeights, interiorSolids, type Environment, type Solid } from '@seked/geometry';
import { databaseOf, type SekedBundle } from './bundle';

export const STRUCTURES = ['g1', 'g2', 'g3'] as const;
export type StructureId = (typeof STRUCTURES)[number];

export const STRUCTURE_LABELS: Record<StructureId, string> = {
  g1: 'G1 Khufu',
  g2: 'G2 Khafre',
  g3: 'G3 Menkaure',
};

/**
 * One pyramid as the database has it, in the project frame: +X east, +Y
 * north, +Z up, metres. The same five values and the same two sign flips as
 * blender/generate.py, so the web and Blender place the monuments alike.
 */
export interface PyramidParams {
  id: StructureId;
  label: string;
  base: number;
  height: number;
  /** Today's truncated height, where the database has one. */
  heightToday: number | undefined;
  /**
   * The course heights the database has for it, bottom up and in metres,
   * where it has any. They are what the pyramid as it stands is drawn from,
   * and a pyramid without them falls back to the flat truncation.
   */
  courses: number[] | undefined;
  /** Inward indent of each face's centre line at the base. */
  concavity: number;
  /** Degrees east of north; a few arcminutes at Giza. */
  orientationDeg: number;
  offsetEast: number;
  offsetNorth: number;
  offsetUp: number;
}

export function pyramidParams(values: Record<string, number>, id: StructureId): PyramidParams | undefined {
  const base = values[`${id}.base.side.mean`];
  const height = values[`${id}.height.original`];
  if (base === undefined || height === undefined) return undefined;
  const courses = courseHeights(values, id);
  return {
    id,
    label: STRUCTURE_LABELS[id],
    base,
    height,
    heightToday: values[`${id}.height.today`],
    courses: courses.length > 0 ? courses : undefined,
    concavity: values[`${id}.concavity`] ?? 0,
    orientationDeg: values[`${id}.orientation`] ?? 0,
    offsetEast: -(values[`${id}.centre.offset.west`] ?? 0),
    offsetNorth: -(values[`${id}.centre.offset.south`] ?? 0),
    offsetUp: values[`${id}.base.elevation.relative`] ?? 0,
  };
}

/**
 * The Sphinx as the viewer draws it: a box, not a statue.
 *
 * The same placeholder blender/generate.py builds, from the same keys, so the
 * .blend, the GLB and the browser stand it in the same place. The sizes are
 * the ARCE survey's; the position is `sphinx.center.latitude` and
 * `.longitude`, a commonly cited pair worth about 55 m, turned into offsets by
 * `buildEnvironment`. There is no base elevation for the Sphinx in the
 * database, so the box sits on the frame's datum plane, the Great Pyramid's
 * base level.
 */
export const SPHINX_MASSING_LABEL = 'Sphinx (massing placeholder)';

export interface MassingParams {
  id: string;
  label: string;
  /** East-west, which is the way the statue lies; its front face is the east one. */
  length: number;
  /** North-south. */
  width: number;
  height: number;
  offsetEast: number;
  offsetNorth: number;
}

export function massingParams(values: Record<string, number>, id: string, label: string): MassingParams | undefined {
  const length = values[`${id}.length`];
  const width = values[`${id}.width`];
  const height = values[`${id}.height`];
  const offsetEast = values[`${id}.centre.offset.east`];
  const offsetNorth = values[`${id}.centre.offset.north`];
  if (length === undefined || width === undefined || height === undefined) return undefined;
  if (offsetEast === undefined || offsetNorth === undefined) return undefined;
  return { id, label, length, width, height, offsetEast, offsetNorth };
}

/**
 * One structure's interior, in its own frame, beside what it takes to place it.
 * Which structures are here is the database's answer, not the viewer's: a
 * structure whose interior records the preset carries gets one.
 */
export interface StructureInterior {
  params: PyramidParams;
  solids: Record<string, Solid>;
}

export interface Model {
  /** The bundle's own records, in the shape resolve() and sourceById() want. */
  db: Database;
  resolved: Resolved;
  /** The resolved values with the cubit override applied, before derivation. */
  values: Record<string, number>;
  env: Environment;
  pyramids: PyramidParams[];
  /** The Sphinx's box, when the preset carries the size and the position for it. */
  massings: MassingParams[];
  interiors: StructureInterior[];
  results: Map<string, ClaimResult>;
  /** The measured royal cubit under this preset, which the slider starts from. */
  measuredCubit: number;
  /** The epoch override every dated claim above was evaluated at, or null for each claim's own. */
  epochOverride: number | null;
  /** The observer every sky claim and the dome itself are seen from. */
  latitudeDeg: number;
}

/**
 * The claim as the reader's epoch override has it. A claim with no epoch of
 * its own never sees the sky and is handed back untouched, so overriding the
 * epoch moves exactly the claims the sky slider is about.
 */
export function atEpoch(claim: Claim, epoch: number | null): Claim {
  return epoch === null || claim.epoch === undefined ? claim : { ...claim, epoch };
}

/**
 * Resolve a preset, optionally override the royal cubit and the epoch, derive
 * the environment and evaluate every claim against it. The epoch override is
 * the cubit slider's move applied to time: a dated claim is evaluated at the
 * epoch the reader is looking at rather than at the one its author chose, so
 * the panel's residuals move as the sky is dragged.
 */
export function buildModel(bundle: SekedBundle, presetId: string, cubit: number | null, epoch: number | null = null): Model {
  const db = databaseOf(bundle);
  const resolved = resolve(db, presetId);
  const measuredCubit = resolved.values['cubit.royal'] ?? 0.5236;
  const values = cubit === null ? resolved.values : { ...resolved.values, 'cubit.royal': cubit };
  const env = buildEnvironment(values);
  const pyramids = STRUCTURES.map((id) => pyramidParams(values, id)).filter((p): p is PyramidParams => p !== undefined);
  // The offsets the box is placed by are derived, so it reads `env` and not
  // the resolved values: `buildEnvironment` is where a coordinate becomes a
  // position in the frame.
  const massings = [massingParams(env, 'sphinx', SPHINX_MASSING_LABEL)].filter((m): m is MassingParams => m !== undefined);
  const interiors = pyramids
    .map((params) => ({ params, solids: interiorSolids(env, { structure: params.id }) }))
    .filter((interior) => Object.keys(interior.solids).length > 0);
  const results = new Map<string, ClaimResult>();
  for (const claim of bundle.claims) results.set(claim.id, evaluateClaimSafely(atEpoch(claim, epoch), env));
  return {
    db,
    resolved,
    values,
    env,
    pyramids,
    massings,
    interiors,
    results,
    measuredCubit,
    epochOverride: epoch,
    latitudeDeg: env['g1.center.latitude'] ?? 0,
  };
}

/**
 * A claim whose formula names a key the preset does not carry throws. That is
 * the right answer for the dossier and the wrong one for a viewer, which
 * should say so in the panel and keep the other sixteen claims on screen.
 */
export interface FailedClaim extends ClaimResult {
  error?: string;
}

function evaluateClaimSafely(claim: Claim, env: Environment): FailedClaim {
  try {
    return evaluateClaim(claim, env);
  } catch (e) {
    return {
      id: claim.id,
      title: claim.title,
      group: claim.group,
      status: claim.status,
      freeChoices: claim.free_choices.length,
      comparisons: [],
      fits: undefined,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** The records behind a claim's formulas, for the detail pane's provenance. */
export function recordsFor(keys: string[], resolved: Resolved): Measurement[] {
  return keys.map((k) => resolved.records.get(k)).filter((m): m is Measurement => m !== undefined);
}
