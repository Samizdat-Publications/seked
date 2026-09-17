/**
 * Everything the viewer derives from the bundle, in one place and with no
 * React in sight. The preset resolver, the environment builder and the claim
 * evaluator are the same functions the dossier runs, so a slider that changes
 * one number re-evaluates every claim the way a regenerated dossier would.
 */
import { evaluateClaim, type Claim, type ClaimResult } from '@seked/claims/browser';
import { resolve, type Database, type Measurement, type Resolved } from '@seked/data/browser';
import {
  buildEnvironment,
  causewayRoofMesh,
  courseHeights,
  enclosureWallMesh,
  footprintMesh,
  interiorSolids,
  mastabaMesh,
  smallPyramidMesh,
  surveyFootprints,
  templeMesh,
  type Environment,
  type Footprint,
  type Mesh,
  type Solid,
} from '@seked/geometry';
import { databaseOf, type SekedBundle } from './bundle';
import type { StateId } from './view';

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
 * The plateau's lesser monuments, as the footprint import has them.
 *
 * One mass per named monument, and the mastaba fields as a single mass,
 * because six hundred meshes would cost the viewer far more than one and a
 * field of tombs is one thing to look at. Built with `footprintMesh`, the
 * function blender/seked_data.py mirrors, so the browser and the .blend stand
 * the same solids in the same places. Heights a footprint looks up in the
 * database come from `env`, so a preset that carried a better figure would
 * move them.
 */
export interface PlateauMass {
  id: string;
  name: string;
  group: string;
  kind: Footprint['kind'];
  mesh: Mesh;
  /** How many footprints went into it: one, or the whole field. */
  count: number;
}

/** Several meshes as one, indices offset so each still points at its own vertices. */
export function mergeMeshes(meshes: readonly Mesh[]): Mesh {
  const vertexCount = meshes.reduce((a, m) => a + m.vertexCount, 0);
  const positions = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(meshes.reduce((a, m) => a + m.indices.length, 0));
  let v = 0;
  let i = 0;
  for (const m of meshes) {
    positions.set(m.positions, v * 3);
    for (let k = 0; k < m.indices.length; k++) indices[i + k] = (m.indices[k] as number) + v;
    v += m.vertexCount;
    i += m.indices.length;
  }
  return { positions, indices, vertexCount, triangleCount: indices.length / 3 };
}

// --- The lesser monuments, per state ---------------------------------------
//
// Stage 2 stops drawing the plateau as one set of OSM massings and builds each
// group with the builder @seked/geometry has for it, in the look its state
// asks for. A builder without the keys it needs returns undefined and nothing
// is drawn in its place, which is the point of them: a queen's pyramid with no
// recorded slope is drawn from its own outline and height and says so, and an
// enclosure wall with no recorded distance is not drawn at all.

/**
 * What the reader is looking at, in the honesty words of the design.
 * `excavated` is a traced or surveyed outline carried up: the monument is
 * there and this is its extent. `reconstruction` is a builder's account of
 * how it stood, which is never a measurement of its form.
 */
export type StructureTier = 'reconstruction' | 'excavated';

/** One built solid, with what Track H's hover needs to name it. */
export interface StructureMesh {
  id: string;
  name: string;
  tier: StructureTier;
  /** The builder's own label, or what the massing is. */
  note: string;
  mesh: Mesh;
}

/** A temple as its parts, so each takes its own stone. */
export interface TempleStructure {
  id: string;
  name: string;
  tier: StructureTier;
  note: string;
  walls: Mesh;
  roof: Mesh | undefined;
  pillars: Mesh | undefined;
}

/** Everything the scene draws for one state, beside the pyramids and the stand-ins. */
export interface Structures {
  queens: StructureMesh[];
  /** The mastaba fields as one geometry. Never 577 meshes. */
  mastabas: StructureMesh | undefined;
  /** The named tombs that are mastabas in all but their OSM group. */
  tombs: StructureMesh[];
  temples: TempleStructure[];
  enclosureWalls: StructureMesh[];
  walls: StructureMesh[];
  causeway: StructureMesh | undefined;
  causewayRoof: StructureMesh | undefined;
  pits: StructureMesh[];
  /** The slabs over the boat pits, merged; only where a state roofs them. */
  pitCovers: StructureMesh | undefined;
  /** Whatever no builder covers, as the OSM massing stage 1 drew. */
  fallback: StructureMesh[];
}

/**
 * The look choices this file makes, all in one place as the plan asks. None of
 * them is a measurement and none is read from the database.
 */
export const STRUCTURE_LOOK = {
  /** How deep the slab over a boat pit is drawn, metres. */
  pitCoverThickness: 0.8,
  /**
   * How far the top of that slab stands above the ground it covers, metres.
   * The blocks over Khufu's southern pit were laid flush with the rock, so the
   * slab is sunk into the cut and only a lip of it shows, which is enough to
   * keep it from fighting the ground for pixels.
   */
  pitCoverLip: 0.02,
  /**
   * The tomb of Khentkawes I is a two-stepped rock-cut block, not a pyramid,
   * and OSM's `kind` for it says pyramid. It is drawn as a prism, which is the
   * nearer of the two shapes the footprint import can make of one outline.
   */
  khentkawesAsPrism: true,
} as const;

/** The three pyramids an enclosure wall is looked for round. */
const ENCLOSED = ['g1', 'g2', 'g3'] as const;

/** Footprints in the temple group that are not temples, and are drawn as what they are. */
const NOT_A_TEMPLE = new Set(['khufu.basalt_pavement']);

/** Footprints in the queens' group that are not pyramids. */
const NOT_A_PYRAMID = new Set(['khentkawes']);

/**
 * The timeline's four stops over the builders' two: the early pair stand the
 * monuments whole and cased, the late pair as they were left.
 */
export function isWholeState(state: StateId): boolean {
  return state === 'ancient' || state === 'built';
}

function massingNote(f: Footprint): string {
  return (
    `Massing: ${f.name} as the footprint import has it, the traced outline carried up to a height that is ` +
    "OSM's or the database's. Its extent is the monument's; nothing about its form is."
  );
}

/** One footprint as the massing stage 1 drew, for a group no builder covers. */
function massing(f: Footprint, env: Environment, note = massingNote(f)): StructureMesh | undefined {
  const mesh = footprintMesh(f, env);
  return mesh === undefined ? undefined : { id: f.id, name: f.name, tier: 'excavated', note, mesh };
}

/** The slab laid over one boat pit, at ground level, in the states that roof them. */
function pitCoverMesh(f: Footprint, env: Environment): Mesh | undefined {
  return footprintMesh(
    {
      ...f,
      id: `${f.id}.cover`,
      kind: 'prism',
      base: f.base + STRUCTURE_LOOK.pitCoverLip - STRUCTURE_LOOK.pitCoverThickness,
      height: STRUCTURE_LOOK.pitCoverThickness,
      depthKey: undefined,
      heightKey: undefined,
    },
    env,
  );
}

/**
 * Everything the plateau's lesser monuments are in one state.
 *
 * The 577 mastabas come back as one merged geometry, because six hundred
 * meshes cost the viewer far more than one and a field of tombs is one thing
 * to look at; the builder merges the parts of each tomb and this merges the
 * tombs.
 */
export function structuresFor(features: readonly Footprint[], env: Environment, state: StateId): Structures {
  const whole = isWholeState(state);
  const built = (mesh: { label: string } & Mesh, f: Footprint): StructureMesh =>
    ({ id: f.id, name: f.name, tier: 'reconstruction', note: mesh.label, mesh });

  const queens: StructureMesh[] = [];
  const tombs: StructureMesh[] = [];
  const temples: TempleStructure[] = [];
  const walls: StructureMesh[] = [];
  const pits: StructureMesh[] = [];
  const covers: Mesh[] = [];
  const fallback: StructureMesh[] = [];
  const field: Mesh[] = [];
  let firstTomb: string | undefined;
  let causeway: StructureMesh | undefined;

  for (const f of features) {
    if (f.group === 'mastabas') {
      const tomb = mastabaMesh(f, env, whole ? 'cased' : 'ruined');
      if (tomb === undefined) continue;
      field.push(tomb);
      firstTomb ??= tomb.label;
      continue;
    }
    if (f.group === 'queens' && !NOT_A_PYRAMID.has(f.id)) {
      const small = smallPyramidMesh(f, env, whole ? 'cased' : 'stepped');
      if (small !== undefined) queens.push(built(small, f));
      continue;
    }
    if (f.group === 'temples' && !NOT_A_TEMPLE.has(f.id)) {
      const temple = templeMesh(f, env, whole ? 'whole' : 'ruined');
      if (temple !== undefined) {
        temples.push({ id: f.id, name: f.name, tier: 'reconstruction', note: temple.label, walls: temple.walls, roof: temple.roof, pillars: temple.pillars });
      }
      continue;
    }
    if (f.group === 'tombs') {
      // Hemiunu's is a mastaba in everything but the group OSM gives it, and
      // it already looks its height up under tier3.mastaba.height, so it is
      // built by the mastaba builder rather than drawn flat beside 577 of them.
      const tomb = mastabaMesh({ ...f, group: 'mastabas' }, env, whole ? 'cased' : 'ruined');
      if (tomb !== undefined) tombs.push(built(tomb, f));
      continue;
    }
    if (f.group === 'pits') {
      const pit = massing(f, env);
      if (pit !== undefined) pits.push(pit);
      if (whole) {
        const cover = pitCoverMesh(f, env);
        if (cover !== undefined) covers.push(cover);
      }
      continue;
    }
    if (f.group === 'walls') {
      const wall = massing(f, env);
      if (wall !== undefined) walls.push(wall);
      continue;
    }
    if (f.group === 'causeways') {
      causeway ??= massing(f, env);
      continue;
    }
    const block = f.id === 'khentkawes' && STRUCTURE_LOOK.khentkawesAsPrism;
    const other = massing(
      block ? { ...f, kind: 'prism' } : f,
      env,
      block
        ? `${massingNote(f)} Look choice: drawn as a prism rather than the pyramid OSM's kind names, because ` +
          'the tomb of Khentkawes I is a two-stepped rock-cut block.'
        : undefined,
    );
    if (other !== undefined) fallback.push(other);
  }

  const roof = whole ? causewayRoofMesh(env, features) : undefined;
  const enclosureWalls: StructureMesh[] = [];
  if (whole) {
    for (const id of ENCLOSED) {
      const wall = enclosureWallMesh(env, id);
      if (wall !== undefined) {
        enclosureWalls.push({ id: `${id}.enclosure`, name: `${STRUCTURE_LABELS[id]}, enclosure wall`, tier: 'reconstruction', note: wall.label, mesh: wall });
      }
    }
  }

  return {
    queens,
    mastabas:
      field.length === 0
        ? undefined
        : {
            id: 'mastabas',
            name: 'Mastaba fields',
            tier: 'reconstruction',
            note:
              `${field.length} tombs, each built alike and merged into one geometry. One of them, as a ` +
              `sample of all of them. ${firstTomb ?? ''}`,
            mesh: mergeMeshes(field),
          },
    tombs,
    temples,
    enclosureWalls,
    walls,
    causeway,
    causewayRoof:
      roof === undefined
        ? undefined
        : { id: 'khafre.causeway.roof', name: 'Causeway of Khafre, roof', tier: 'reconstruction', note: roof.label, mesh: roof },
    pits,
    pitCovers:
      covers.length === 0
        ? undefined
        : {
            id: 'boat_pits.covers',
            name: 'Boat pits, covering slabs',
            tier: 'reconstruction',
            note:
              'Reconstruction: slabs laid over the boat pits, flush with the rock they are cut into. ' +
              'Khufu’s southern pit was found closed by forty-one limestone blocks, so a covered pit is ' +
              `the documented condition of one of them; the slab here is ${STRUCTURE_LOOK.pitCoverThickness} ` +
              'm deep over every pit, and its depth, its single piece and which pits are covered are all ' +
              'look choices.',
            mesh: mergeMeshes(covers),
          },
    fallback,
  };
}

/**
 * What the scene needs to draw the plateau's lesser monuments in any state:
 * the environment the builders read, the footprints they build from, the
 * stage 1 massings, and one state's structures built on demand.
 *
 * `structures` is memoised on the state inside the closure, so it is memoised
 * on the model too: a new model, from a new preset or a cubit tick, makes a
 * new closure and every state is built again.
 */
export interface Plateau {
  env: Environment;
  features: Footprint[];
  /** The OSM massings, as stage 1 drew every group. */
  masses: PlateauMass[];
  structures: (state: StateId) => Structures;
}

export function plateauOf(features: readonly Footprint[], env: Environment): Plateau {
  // The traced footprints, then the solids built from survey records, some of
  // which (Khafre's causeway) are placed by the traced ones they join.
  const all = [...features, ...surveyFootprints(env, features)];
  const cache = new Map<StateId, Structures>();
  return {
    env,
    features: all,
    masses: plateauMasses(features, env),
    structures: (state) => {
      let one = cache.get(state);
      if (one === undefined) {
        one = structuresFor(all, env, state);
        cache.set(state, one);
      }
      return one;
    },
  };
}

export function plateauMasses(features: readonly Footprint[], env: Environment): PlateauMass[] {
  const out: PlateauMass[] = [];
  const field: Mesh[] = [];
  // The traced footprints, then the solids built from survey records, some of
  // which (Khafre's causeway) are placed by the traced ones they join.
  for (const f of [...features, ...surveyFootprints(env, features)]) {
    const mesh = footprintMesh(f, env);
    if (!mesh) continue;
    if (f.group === 'mastabas') field.push(mesh);
    else out.push({ id: f.id, name: f.name, group: f.group, kind: f.kind, mesh, count: 1 });
  }
  if (field.length > 0) {
    out.push({ id: 'mastabas', name: 'Mastaba fields', group: 'mastabas', kind: 'prism', mesh: mergeMeshes(field), count: field.length });
  }
  return out;
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
  /** The Sphinx's box, when the preset carries the size and the position for it and the footprint import has no Sphinx. */
  massings: MassingParams[];
  /**
   * The plateau's lesser monuments from the footprint import: the footprints,
   * the stage 1 massings and the builders' structures for any state. It was
   * the massings alone until stage 2 gave the timeline a look for each group.
   */
  plateau: Plateau;
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
  const plateau = plateauOf((bundle.footprints?.features ?? []) as Footprint[], env);
  // The OSM Sphinx supersedes the box, as it does in blender/generate.py: an
  // outline modelled as forepaws, body and head on the ground it is cut into,
  // against a box on the datum plane forty metres above that ground.
  const osmSphinx = plateau.masses.some((m) => m.id === 'sphinx.body');
  const massings = osmSphinx
    ? []
    : [massingParams(env, 'sphinx', SPHINX_MASSING_LABEL)].filter((m): m is MassingParams => m !== undefined);
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
    plateau,
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
