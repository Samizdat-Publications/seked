/**
 * Where the water stood.
 *
 * Two bodies of water, one rule for both. The rule is that the level is read
 * off the valley temples' own floors and never typed: Khafre's valley temple
 * and the Sphinx Temple are called valley temples because a boat came to
 * their doors, so the waterline of the harbour is the level their footprints
 * were set on when `scripts/footprints.ts` put them on the terrain. Move the
 * footprints and the water moves with them.
 *
 * `built` gets the harbour. Lehner's survey of the Giza plain puts a basin
 * immediately east of the two temples, and that is the mainstream
 * archaeology this draws: a rectangle from the temples' east faces out into
 * the plain, cut below their floors so the water has somewhere to be. Its
 * extent is a look choice and says so; what is not a look choice is that a
 * harbour was there.
 *
 * `ancient` gets the flood plain, which is the claim's staging: in the
 * African Humid Period the Nile ran high and its flood reached the foot of
 * the plateau, so east of the valley temples everything below the level is
 * water. It is drawn as one plane and the ground hides it wherever the
 * ground is higher, which is what "every sample below the level" means when
 * a renderer does it. The plane stands a named number of metres above the
 * harbour's own waterline, because the modern plain east of Giza carries
 * five thousand years of alluvium and the GLO-30 surface under it is not the
 * surface of 10,500 BCE. That number is a look choice, and what it draws on
 * that surface is braided water in the low ground with land between it,
 * which is what a watered valley looks like and not what a lake does. It
 * cannot be anything better: no model of the ground of 10,500 BCE exists
 * here, so the shoreline is the modern one at a chosen level and nothing
 * more.
 *
 * `stripped` and `today` have no water at all.
 *
 * Nothing in this file is a measurement. Every number in `LOOK` is a look
 * choice and is named as one; the levels themselves come from the
 * footprints, which come from OpenStreetMap fitted onto the survey, and the
 * label each body of water carries says which of its parts is which.
 *
 * Frame as everywhere else: +X east, +Y north, +Z up, metres.
 */

import type { Environment } from './environment';
import { footprintSpan, type Footprint } from './footprints';

/** The two footprints the waterline is read off. */
export const VALLEY_TEMPLES = ['khafre.valley_temple', 'sphinx.temple'];

/**
 * LOOK CHOICES, not measurements. Every one of them is a decision about how
 * the water is drawn, and a record would replace none of them, because none
 * of them is a thing anybody measured.
 *
 * `basinDepthMetres` is how far the harbour is cut below the temples' floors,
 * which is the plan's own two metres: enough for the water to be water and
 * shallow enough that the quay wall reads as a quay.
 *
 * `basinReachMetres` is how far east of the temples' east faces the basin
 * runs, and `basinMarginMetres` how far it stands clear of them north and
 * south. Lehner puts a harbour here; nobody has given this project its
 * outline.
 *
 * `floodRiseMetres` is how far the First Time's flood plain stands above the
 * harbour's waterline. Three metres puts water in about a third of the plain
 * east of the plateau on the modern surface model, which reads as channels
 * and marsh with land between them; much more and the plain becomes an
 * archipelago, much less and it dries up. The modern surface is the only one
 * this project has, so on the ground of 10,500 BCE the same picture would
 * want a different number.
 *
 * `plainReachMetres` is how far the flood plain is carried east, north and
 * south of the temples before it is left to the haze. The terrain itself
 * ends three kilometres out.
 */
export const LOOK = {
  basinDepthMetres: 2,
  basinReachMetres: 250,
  basinMarginMetres: 60,
  floodRiseMetres: 3,
  plainReachMetres: 6000,
} as const;

/** The states that have water, and which kind. */
export type WaterKind = 'basin' | 'plain';

export interface WaterBody {
  kind: WaterKind;
  /** The surface's level in the data frame, metres. */
  level: number;
  /**
   * The bed under the surface, metres. The basin is cut to it; the flood
   * plain has no bed of its own, so it is the level itself.
   */
  floor: number;
  /** The outline, counter-clockwise seen from above, open (the first point is not repeated). */
  outline: [number, number][];
  /** What the hover tag says: what was drawn, out of what, and which parts are look choices. */
  label: string;
}

/**
 * The level the two valley temples' floors stand at, which is the waterline
 * of the harbour: the lower of the two footprints' own bottoms, so neither
 * temple has its doorstep under water.
 *
 * Undefined where either footprint is missing, or where the environment does
 * not carry the height key their spans need, because a level guessed without
 * them would be a number nobody chose.
 */
export function valleyTempleFloor(features: readonly Footprint[], env: Environment): number | undefined {
  const spans = VALLEY_TEMPLES.map((id) => {
    const found = features.find((f) => f.id === id);
    return found === undefined ? undefined : footprintSpan(found, env);
  });
  if (spans.some((s) => s === undefined)) return undefined;
  return Math.min(...spans.map((s) => (s as { bottom: number }).bottom));
}

/**
 * The water's surface level at a stop on the timeline, or undefined where
 * that stop has no water or the temples' footprints are not there to read it
 * off.
 *
 * The plan writes this `waterLevel(env, state)`; the footprints come in too,
 * because the level is theirs and the plan's own test asks for it to be
 * undefined without them.
 */
export function waterLevel(features: readonly Footprint[], env: Environment, state: string): number | undefined {
  const floor = valleyTempleFloor(features, env);
  if (floor === undefined) return undefined;
  if (state === 'built') return floor;
  if (state === 'ancient') return floor + LOOK.floodRiseMetres;
  return undefined;
}

/** The least and greatest east and north of a ring. */
function bounds(ring: readonly (readonly [number, number])[]): { west: number; east: number; south: number; north: number } {
  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  return { west: Math.min(...xs), east: Math.max(...xs), south: Math.min(...ys), north: Math.max(...ys) };
}

/** A rectangle as a ring, counter-clockwise seen from above. */
export function rectangleRing(west: number, east: number, south: number, north: number): [number, number][] {
  return [[west, south], [east, south], [east, north], [west, north]];
}

/**
 * The water at a stop on the timeline: its kind, its level, its bed and its
 * outline, or nothing where the stop is dry or the footprints are absent.
 */
export function waterExtent(features: readonly Footprint[], env: Environment, state: string): WaterBody | undefined {
  const level = waterLevel(features, env, state);
  if (level === undefined) return undefined;
  const temples = VALLEY_TEMPLES.map((id) => features.find((f) => f.id === id)).filter(
    (f): f is Footprint => f !== undefined,
  );
  if (temples.length < VALLEY_TEMPLES.length) return undefined;
  const boxes = temples.map((t) => bounds(t.ring));
  // The east faces of the two temples. The basin runs from the westernmost of
  // them, so that both of them stand on its edge rather than one of them
  // behind it.
  const faces = boxes.map((b) => b.east);
  const front = Math.min(...faces);

  if (state === 'built') {
    const south = Math.min(...boxes.map((b) => b.south)) - LOOK.basinMarginMetres;
    const north = Math.max(...boxes.map((b) => b.north)) + LOOK.basinMarginMetres;
    return {
      kind: 'basin',
      level,
      floor: level - LOOK.basinDepthMetres,
      outline: rectangleRing(front, Math.max(...faces) + LOOK.basinReachMetres, south, north),
      label:
        'Reconstruction: the harbour basin at the valley temples, which Lehner’s survey of the Giza plain places here. ' +
        `Its waterline is the two temples’ own floor level, ${level.toFixed(2)} m in this frame, read off their footprints and not typed. ` +
        `Look choices: the basin runs ${LOOK.basinReachMetres} m east of their east faces and stands ${LOOK.basinMarginMetres} m clear of them ` +
        `north and south, and is cut ${LOOK.basinDepthMetres} m below the waterline. None of the three is a measurement.`,
    };
  }

  const reach = LOOK.plainReachMetres;
  return {
    kind: 'plain',
    level,
    floor: level,
    outline: rectangleRing(
      front,
      front + reach,
      Math.min(...boxes.map((b) => b.south)) - reach,
      Math.max(...boxes.map((b) => b.north)) + reach,
    ),
    label:
      'A claim: the flood plain of the First Time, drawn east of the valley temples as one surface that the ground hides wherever the ground is higher, ' +
      'so what stands is water in the low ground and land between it. ' +
      'The science behind the staging is the African Humid Period, about 12,500 to 3,500 BCE, when North Africa was wet and the Nile ran high; ' +
      'how far its flood reached at Giza in 10,500 BCE is not known, and the ground it is drawn on is the modern surface model. ' +
      `Look choices: the surface stands ${LOOK.floodRiseMetres} m above the harbour’s own waterline, which is the valley temples’ floor level, ` +
      `and is carried ${reach} m out. Neither is a measurement, and the ground it is laid over is the modern surface model.`,
  };
}

/**
 * Whether a point is inside a rectangle ring, its edges counting as inside.
 * Both outlines here are rectangles, so this is their whole containment test.
 */
export function rectangleContains(ring: readonly (readonly [number, number])[], x: number, y: number): boolean {
  const b = bounds(ring);
  return x >= b.west && x <= b.east && y >= b.south && y <= b.north;
}
