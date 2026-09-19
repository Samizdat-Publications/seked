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
 * `stripped` and `today` get the Nile, at the course and the level it has
 * now. Its level is read off the heightfield rather than typed, for the same
 * reason the harbour's is read off the temples: Copernicus GLO-30 is a
 * surface model, and a river's surface is in it, flat and several metres
 * below anything around it. `riverLevel` finds it as a low percentile of the
 * valley's own samples, which east of Giza lands on a plateau of height that
 * 5.5 per cent of the valley shares and that is insensitive to the
 * percentile chosen. So the river is where the data says the water is, drawn
 * by the same one-plane rule the flood plain uses, and nobody typed a
 * waterline.
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
import type { Mesh } from './mesh';

/** A point in plan, as the footprint builders use it. */
type Xy = readonly [number, number];

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
  /**
   * Which percentile of the valley's own heights is taken for the modern
   * river's surface. A look choice, and a weak one: between the third and
   * the twelfth percentile the wetted area of the valley moves from 5.4 to
   * 15 per cent and the level itself by four metres, because the samples
   * pile up on the river's own flat surface. The fifth is inside that pile.
   */
  riverPercentile: 5,
  /**
   * How far the drawn surface is lifted above the height that percentile
   * gives. A look choice: the heightfield's own river surface is flat, so a
   * plane laid exactly on it would fight it in the depth buffer along the
   * whole river. Thirty centimetres is under the product's own vertical
   * error and clears it.
   */
  riverRiseMetres: 0.3,
  /**
   * The valley the river's level is read out of, metres in the frame: east
   * of the escarpment, and the north and south of the imported city's box. A
   * look choice about where to look, not about what is found.
   */
  riverBox: { west: 3000, east: 11000, south: -4500, north: 7000 },
} as const;

/** The states that have water, and which kind. */
export type WaterKind = 'basin' | 'plain' | 'river';

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

/**
 * The modern river's surface, read off a heightfield.
 *
 * `sample` is the ground at a point in the frame, and `box` the valley to
 * look in. The samples of a valley with a river in it are not a smooth
 * distribution: a few per cent of them sit on the river's own flat surface
 * several metres below the fields, so a low percentile of them lands on the
 * water and not on anything else. Nothing is typed and nothing is searched
 * for: the number that comes out is whatever the imported heights say.
 */
export interface RiverBox {
  west: number;
  east: number;
  south: number;
  north: number;
}

export function riverLevel(
  sample: (x: number, y: number) => number,
  box: RiverBox = LOOK.riverBox,
  step = 60,
  percentile: number = LOOK.riverPercentile,
): number {
  const heights: number[] = [];
  for (let x = box.west; x <= box.east; x += step) {
    for (let y = box.south; y <= box.north; y += step) heights.push(sample(x, y));
  }
  if (heights.length === 0) throw new Error('seked: no samples to read a river level out of');
  heights.sort((a, b) => a - b);
  const at = Math.min(heights.length - 1, Math.max(0, Math.floor((percentile / 100) * (heights.length - 1))));
  return (heights[at] as number) + LOOK.riverRiseMetres;
}

/**
 * The Nile as it runs now: one surface over the valley at the level
 * `riverLevel` read out of the ground, which the ground hides wherever the
 * ground is higher. That is the same rule the flood plain is drawn by, and
 * what stands is the river's own channel, because the channel is the only
 * part of the valley below its water.
 */
export function riverBody(level: number, box: RiverBox = LOOK.riverBox): WaterBody {
  return {
    kind: 'river',
    level,
    floor: level,
    outline: rectangleRing(box.west, box.east, box.south, box.north),
    label:
      'Context, not evidence: the Nile at its present course, drawn as one surface east of the plateau that the ground hides wherever the ground is higher, ' +
      `so what stands is the channel. Its level, ${level.toFixed(2)} m in this frame, is read off Copernicus GLO-30 itself as the ` +
      `${LOOK.riverPercentile}th percentile of the valley's own heights, which is the river's flat surface in the surface model and not a number anybody typed. ` +
      `Look choices: which valley to look in, the percentile, and the ${LOOK.riverRiseMetres} m the drawn plane stands above what it found, which is there so the plane does not fight the model's own water in the depth buffer. ` +
      'The course and the level are the modern ones and belong to the modern states alone.',
  };
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

// --- The quay ---------------------------------------------------------------
//
// What `Water.tsx` already calls a quay is the cut rim of the basin: the
// ground's own face, from the plateau's surface down to the basin's floor,
// filling the hole the terrain discards. It is earth, and it follows the
// modern surface model. This is the other thing, and the one Track D of the
// architecture pass is about: a built quay, a masonry wall standing in the
// water along the basin's front, with its top a stated height above the
// waterline, so a boat has something to come alongside and the valley
// temples have a doorstep rather than a shoreline.

/**
 * LOOK CHOICES, every one. Nobody has excavated Giza's harbour front and no
 * plate read here draws it, so what is chosen is a quay that reads as a quay:
 * high enough out of the water to stand on, deep enough to reach the basin's
 * floor, thick enough to be masonry and battered like everything else of its
 * date. `batterDeg` is the temples' own 82 degrees rounded off toward the
 * vertical, because a quay takes its load from behind and not from its own
 * weight; it is no more measured than the temples' is.
 */
export const QUAY = {
  /** How far the quay's top stands above the waterline, metres. */
  freeboardMetres: 2,
  /** How thick the wall is at its footing, metres, measured into the basin. */
  thicknessMetres: 3,
  /** The angle of its seaward face from the horizontal, degrees. Vertical behind. */
  batterDeg: 84,
} as const;

/**
 * The quay along the front of the harbour basin, or nothing where the state
 * has no basin.
 *
 * It stands on the basin's west edge, which is the westernmost of the two
 * valley temples' east faces, and runs the whole north-south length of the
 * basin, so both temples and the ground between them front onto it. It is
 * built into the water rather than into the bank: the face a boat comes
 * alongside is the outer one, and behind it is the fill the temples stand on.
 *
 * Its foot is the basin's floor and its head is `QUAY.freeboardMetres` above
 * the waterline, both of which come from the water body and are therefore
 * read off the footprints like everything else here. Only the freeboard, the
 * thickness and the batter are chosen, and the label says so.
 */
export function quayMesh(
  water: WaterBody | undefined,
  features: readonly Footprint[],
): { mesh: Mesh; label: string } | undefined {
  if (water === undefined || water.kind !== 'basin') return undefined;
  const b = bounds(water.outline);
  const top = water.level + QUAY.freeboardMetres;
  const rise = top - water.floor;
  if (!(rise > 0)) return undefined;
  const lean = rise / Math.tan((QUAY.batterDeg * Math.PI) / 180);
  if (!(QUAY.thicknessMetres > lean)) return undefined;

  // The basin's own west edge is the WESTERNMOST of the two temples' east
  // faces, so that neither of them stands behind the water. A wall on that
  // line stands 1.13 m inside Khafre's valley temple, which the water never
  // showed because the temple hid it and which a solid quay would show at
  // once. So the quay's back is the EASTERNMOST of the two faces instead: the
  // front is continuous, both temples stand behind it, and the metre of water
  // that leaves between the Sphinx Temple and the quay is the metre the two
  // temples' own footprints disagree by.
  const faces = VALLEY_TEMPLES.map((id) => features.find((f) => f.id === id))
    .filter((f): f is Footprint => f !== undefined)
    .map((f) => bounds(f.ring).east);
  const west = faces.length === VALLEY_TEMPLES.length ? Math.max(...faces) : b.west;
  const east = west + QUAY.thicknessMetres;
  // Counter-clockwise seen from above, so the walls face out.
  const foot: Xy[] = [[west, b.south], [east, b.south], [east, b.north], [west, b.north]];
  // Only the seaward face leans; the landward one is vertical against the fill.
  const head: Xy[] = [[west, b.south], [east - lean, b.south], [east - lean, b.north], [west, b.north]];
  const verts: number[][] = [
    ...foot.map(([x, y]) => [x, y, water.floor]),
    ...head.map(([x, y]) => [x, y, top]),
  ];
  const tris: number[] = [
    // The bottom, facing down, and the top, facing up.
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    tris.push(i, j, 4 + j, i, 4 + j, 4 + i);
  }
  const positions = new Float32Array(verts.flat());
  return {
    mesh: { positions, indices: new Uint32Array(tris), vertexCount: verts.length, triangleCount: tris.length / 3 },
    label:
      'Reconstruction: the quay along the front of the harbour basin, standing in the water on the west edge of the basin, ' +
      `which is the westernmost of the two valley temples' east faces. Its foot is the basin's floor at ${water.floor.toFixed(2)} m ` +
      `and its head ${QUAY.freeboardMetres} m above the waterline at ${top.toFixed(2)} m, both of them read off the temples' own ` +
      `footprints and not typed. Look choices, none of them measured: the ${QUAY.freeboardMetres} m of freeboard, the ` +
      `${QUAY.thicknessMetres} m thickness, and the ${QUAY.batterDeg} degree batter on its seaward face, vertical behind. ` +
      'Its back stands on the easternmost of the two east faces rather than on the west edge of the basin, ' +
      'which is the westernmost of them, so that neither temple has a wall standing inside it. ' +
      'Nobody has excavated this front and no plate read here draws it.',
  };
}
