/**
 * The pyramids' interiors, wired to the measurement database.
 *
 * `interior.ts` holds the shape builders and knows nothing but metres.
 * This file names the solids and says which records fix each one, so the
 * viewer, the Blender generator and a claim overlay all get the same rooms
 * from the same numbers. Nothing here stores a measurement: every value is
 * looked up in the resolved environment, and a solid whose records the preset
 * does not carry is skipped rather than guessed at.
 *
 * The frame is the structure's own frame: origin at its base centre, +X east,
 * +Y north, +Z up, metres. Placing an interior beside its pyramid is the
 * caller's job and uses the same centre offsets, base elevation and
 * orientation the pyramid object uses. A stored point is three records,
 * `<point>.north`, `.east` and `.up`, so `point()` puts them back in x, y, z
 * order.
 *
 * The Great Pyramid's records are unprefixed (`kc.*`, `qc.*`, `gg.*`,
 * `passage.*`, `entrance.*`, `chamber.subterranean.*`, `antechamber.*`) and
 * are read by the hand-written builders below, which name Petrie's rooms one
 * by one because his survey stores each of them differently. Every other
 * structure carries its id on the front of every key (`g2.entrance.floor
 * .begin.north`, `g2.passage.descending.width`, `g2.chamber.burial.wall.north
 * .north`) and is discovered from those keys instead: adding Khafre's or
 * Menkaure's records is enough to make their interiors appear, and no code
 * here knows what either plan looks like.
 */

import type { Environment } from './environment';
import { bore, chamber, extrudedSection, passage } from './interior';
import type { BoreSegment, Gable, SectionPair, Solid } from './interior';
import type { Point } from './landmarks';

/** The structures whose interiors are looked for, when a caller names none. */
export const INTERIOR_STRUCTURES = ['g1', 'g2', 'g3'] as const;

export interface InteriorOptions {
  /** Which structure's interior to build. The Great Pyramid is the default. */
  structure?: string;
}

/**
 * What a structure's interior records are prefixed with. The Great Pyramid's
 * are unprefixed, being the ones Petrie's survey filled first; everything
 * else carries its structure id, so `g2.chamber.burial.floor.up` is Khafre's.
 */
export function interiorKeyPrefix(structure: string): string {
  return structure === 'g1' ? '' : `${structure}.`;
}

/** The records that fix one stored point. */
function pointKeys(base: string): string[] {
  return [`${base}.north`, `${base}.east`, `${base}.up`];
}

function value(env: Environment, key: string): number {
  const v = env[key];
  if (v === undefined) throw new Error(`interiorSolids: ${key} is not in the environment`);
  return v;
}

function point(env: Environment, base: string): Point {
  return [value(env, `${base}.east`), value(env, `${base}.north`), value(env, `${base}.up`)];
}

/** A box from two opposite corners in any order, so the caller need not sort them. */
function box(a: Point, b: Point): { min: Point; max: Point } {
  return {
    min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
    max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
  };
}

/**
 * The Grand Gallery's cross-section: the full floor, ramps included, narrowing
 * by one lap's overhang at each corbel step up to a roof as wide as the floor
 * between the ramps. §46 gives the number of laps and the 20.55 in total
 * overhang but only one lap's height (Smyth's third lap, 166.2 in), so the
 * steps are spread evenly over `gg.height`: the widths are measured, the
 * heights are a placeholder until §46's lap levels are entered as records.
 */
function gallerySection(env: Environment): SectionPair[] {
  const overhang = value(env, 'gg.ramp.width');
  const halfFloor = value(env, 'gg.floor.width') / 2 + overhang;
  const laps = Math.round(value(env, 'gg.corbel.count'));
  const bands = laps + 1;
  const band = value(env, 'gg.height') / bands;
  const section: SectionPair[] = [];
  for (let i = 0; i < bands; i++) {
    const halfWidth = halfFloor - (i * overhang) / laps;
    section.push([halfWidth, i * band], [halfWidth, (i + 1) * band]);
  }
  return section;
}

/** The section Petrie gives for the entrance passage, 41.6 by 47 in. */
const SHARED_SECTION = ['passage.descending.width', 'passage.descending.height'] as const;

interface Builder {
  /** Name of the solid, and the prefix of every landmark it carries. */
  name: string;
  /**
   * Every record the solid is built from, for provenance and for the skip
   * test. A function where the list depends on what the records carry, as a
   * shaft's does on how many legs it has.
   */
  keys: readonly string[] | ((env: Environment) => readonly string[]);
  build(env: Environment): Solid;
}

/** A builder's inputs under this environment. */
function keysOf(builder: Builder, env: Environment): readonly string[] {
  return typeof builder.keys === 'function' ? builder.keys(env) : builder.keys;
}

const ROOM_BUILDERS: readonly Builder[] = [
  {
    // The entrance passage, from the true beginning of its floor in the north
    // face down to the flat end Petrie measured in the rock.
    name: 'passage.descending',
    keys: [...pointKeys('entrance.floor.begin'), ...pointKeys('passage.descending.floor.end'), ...SHARED_SECTION],
    build: (env) => passage({
      from: point(env, 'entrance.floor.begin'),
      to: point(env, 'passage.descending.floor.end'),
      width: value(env, 'passage.descending.width'),
      height: value(env, 'passage.descending.height'),
      prefix: 'passage.descending',
    }),
  },
  {
    // The horizontal passage out of that end to the subterranean chamber's N.
    // wall. §37 measures it at about 32 wide and 35.5 to 36.0 high, smaller
    // than the entrance passage, but neither figure is in the database yet, so
    // the entrance passage's section stands in here and below.
    name: 'passage.subterranean_north',
    keys: [...pointKeys('passage.descending.floor.end'), ...pointKeys('passage.subterranean_north.end'), ...SHARED_SECTION],
    build: (env) => passage({
      from: point(env, 'passage.descending.floor.end'),
      to: point(env, 'passage.subterranean_north.end'),
      width: value(env, 'passage.descending.width'),
      height: value(env, 'passage.descending.height'),
      prefix: 'passage.subterranean_north',
    }),
  },
  {
    // The large unfinished chamber. §64's level for it is the roof, not the
    // floor, so the box hangs below the stored centre by §37's 140 in: the
    // floor was never cut to one plane and runs 140 to 198 in under the roof.
    name: 'chamber.subterranean',
    keys: [
      ...pointKeys('chamber.subterranean.centre'),
      'chamber.subterranean.length.north', 'chamber.subterranean.length.south',
      'chamber.subterranean.width.east', 'chamber.subterranean.width.west',
      'chamber.subterranean.height',
    ],
    build: (env) => {
      const [east, north, roof] = point(env, 'chamber.subterranean.centre');
      const length = (value(env, 'chamber.subterranean.length.north') + value(env, 'chamber.subterranean.length.south')) / 2;
      const width = (value(env, 'chamber.subterranean.width.east') + value(env, 'chamber.subterranean.width.west')) / 2;
      const height = value(env, 'chamber.subterranean.height');
      return chamber({
        min: [east - length / 2, north - width / 2, roof - height],
        max: [east + length / 2, north + width / 2, roof],
        prefix: 'chamber.subterranean',
      });
    },
  },
  {
    // The rough southern drift-way out of the chamber's S. wall.
    name: 'passage.subterranean_south',
    keys: [...pointKeys('passage.subterranean_south.begin'), ...pointKeys('passage.subterranean_south.end'), ...SHARED_SECTION],
    build: (env) => passage({
      from: point(env, 'passage.subterranean_south.begin'),
      to: point(env, 'passage.subterranean_south.end'),
      width: value(env, 'passage.descending.width'),
      height: value(env, 'passage.descending.height'),
      prefix: 'passage.subterranean_south',
    }),
  },
  {
    // The ascending passage, from where its floor produced cuts the entrance
    // passage floor up to the north end of the gallery.
    name: 'passage.ascending',
    keys: [
      ...pointKeys('passage.ascending.floor.begin'), ...pointKeys('passage.ascending.floor.end'),
      'passage.ascending.width', 'passage.ascending.height',
    ],
    build: (env) => passage({
      from: point(env, 'passage.ascending.floor.begin'),
      to: point(env, 'passage.ascending.floor.end'),
      width: value(env, 'passage.ascending.width'),
      height: value(env, 'passage.ascending.height'),
      prefix: 'passage.ascending',
    }),
  },
  {
    // The horizontal passage to the Queen's Chamber. It leaves the floor at the
    // north end of the gallery, on the ascending passage's axis carried through
    // (§39 takes that axis as parallel to the Pyramid's side), and runs south to
    // the chamber's north wall at the chamber's floor level. §38 states the
    // passages of the Pyramid as one section, 41.6 wide by 47 perpendicular, so
    // the entrance passage's width and height are used here.
    name: 'passage.queens_chamber',
    keys: [
      'passage.ascending.floor.begin.east', 'passage.ascending.floor.end.north',
      'qc.corner.ne.north', 'qc.corner.ne.up', ...SHARED_SECTION,
    ],
    build: (env) => {
      const east = value(env, 'passage.ascending.floor.begin.east');
      const floor = value(env, 'qc.corner.ne.up');
      return passage({
        from: [east, value(env, 'passage.ascending.floor.end.north'), floor],
        to: [east, value(env, 'qc.corner.ne.north'), floor],
        width: value(env, 'passage.descending.width'),
        height: value(env, 'passage.descending.height'),
        prefix: 'passage.queens_chamber',
      });
    },
  },
  {
    // The Queen's Chamber, hung off its north-east floor corner: west by
    // qc.length, south by qc.width, up by the wall height, with the gabled roof
    // ridge running east to west over the middle.
    name: 'qc',
    keys: [...pointKeys('qc.corner.ne'), 'qc.length', 'qc.width', 'qc.wall.height', 'qc.gable.height'],
    build: (env) => {
      const [east, north, floor] = point(env, 'qc.corner.ne');
      return chamber({
        min: [east - value(env, 'qc.length'), north - value(env, 'qc.width'), floor],
        max: [east, north, floor + value(env, 'qc.wall.height')],
        gable: { ridgeHeight: value(env, 'qc.gable.height'), axis: 'x' },
        prefix: 'qc',
      });
    },
  },
  {
    // The Grand Gallery, from the top of the ascending passage to the virtual
    // south end of its floor: the slope carried on through the great step to
    // the plane of the south wall.
    name: 'gg',
    keys: [
      ...pointKeys('passage.ascending.floor.end'), ...pointKeys('gg.floor.virtual_south_end'),
      'gg.floor.width', 'gg.ramp.width', 'gg.corbel.count', 'gg.height',
    ],
    build: (env) => extrudedSection({
      from: point(env, 'passage.ascending.floor.end'),
      to: point(env, 'gg.floor.virtual_south_end'),
      section: gallerySection(env),
      prefix: 'gg',
    }),
  },
  {
    // The Antechamber, between the two points §64 stores for it: the north end
    // of its floor and the south end of its roof, with the width centred on the
    // passage axis those two share.
    name: 'antechamber',
    keys: [...pointKeys('antechamber.floor.north_end'), ...pointKeys('antechamber.roof.south_end'), 'antechamber.width'],
    build: (env) => {
      const north = point(env, 'antechamber.floor.north_end');
      const south = point(env, 'antechamber.roof.south_end');
      const half = value(env, 'antechamber.width') / 2;
      const axis = (north[0] + south[0]) / 2;
      const { min, max } = box([axis - half, north[1], north[2]], [axis + half, south[1], south[2]]);
      return chamber({ min, max, prefix: 'antechamber' });
    },
  },
  {
    // The King's Chamber, from the four measured wall positions and the two
    // measured levels. Its own kc.length, kc.width and kc.height are Petrie's
    // means of the wall faces and are not used to build it, so the two agree
    // only as well as the survey does.
    name: 'kc',
    keys: [
      'kc.wall.north.north', 'kc.wall.south.north', 'kc.wall.east.east', 'kc.wall.west.east',
      'kc.floor.elevation', 'kc.ceiling.up',
    ],
    build: (env) => {
      const { min, max } = box(
        [value(env, 'kc.wall.west.east'), value(env, 'kc.wall.south.north'), value(env, 'kc.floor.elevation')],
        [value(env, 'kc.wall.east.east'), value(env, 'kc.wall.north.north'), value(env, 'kc.ceiling.up')],
      );
      return chamber({ min, max, prefix: 'kc' });
    },
  },
];

// --- The four shafts --------------------------------------------------------
//
// A shaft is a bore out of a chamber wall: an inlet, then legs laid end to
// end. The records, under `<chamber>.shaft.<side>.`:
//
//   inlet.from_east_wall      metres west of the chamber's east wall
//   inlet.from_floor          metres above the chamber's floor
//   segment.<k>.length        metres along the floor, or
//   segment.<k>.to_face       1: run until the pyramid's face
//   segment.<k>.angle         slope, degrees above the horizontal
//   segment.<k>.direction     optional azimuth; the side's own bearing otherwise
//   width, height             the section, heights square to the floor
//
// The inlet's north coordinate is the chamber wall the shaft leaves, which is
// the side in its name, and comes off the chamber's own records; nothing about
// the wall is typed a second time. A last leg that runs to the face ends on
// the face, which is where Petrie found the mouths, and the level it comes
// out at is a result, not an input. The four are the King's Chamber's and the
// Queen's Chamber's, north and south; the count of legs is whatever the
// records carry, in order, so a survey that resolves one more bend adds a
// record and no code.

/** How many legs a shaft may carry; the records are read in order until one is missing. */
const MAX_SEGMENTS = 12;

/** The chamber walls a shaft can leave, from the records that place them. */
const SHAFT_CHAMBERS: Record<string, {
  wall: (env: Environment, side: 'north' | 'south') => number;
  eastWall: (env: Environment) => number;
  floor: (env: Environment) => number;
  keys: readonly string[];
}> = {
  kc: {
    wall: (env, side) => value(env, `kc.wall.${side}.north`),
    eastWall: (env) => value(env, 'kc.wall.east.east'),
    floor: (env) => value(env, 'kc.floor.elevation'),
    keys: ['kc.wall.north.north', 'kc.wall.south.north', 'kc.wall.east.east', 'kc.floor.elevation'],
  },
  qc: {
    wall: (env, side) => (side === 'north' ? value(env, 'qc.corner.ne.north') : value(env, 'qc.corner.ne.north') - value(env, 'qc.width')),
    eastWall: (env) => value(env, 'qc.corner.ne.east'),
    floor: (env) => value(env, 'qc.corner.ne.up'),
    keys: ['qc.corner.ne.north', 'qc.corner.ne.east', 'qc.corner.ne.up', 'qc.width'],
  },
};

/** The records that describe one shaft's legs, in order, or nothing if the first is missing. */
function shaftSegmentKeys(env: Environment, base: string): string[] {
  const keys: string[] = [];
  for (let k = 1; k <= MAX_SEGMENTS; k++) {
    const leg = `${base}.segment.${k}`;
    const hasLength = env[`${leg}.length`] !== undefined;
    const toFace = env[`${leg}.to_face`] !== undefined;
    if (!hasLength && !toFace) break;
    keys.push(hasLength ? `${leg}.length` : `${leg}.to_face`, `${leg}.angle`);
    if (env[`${leg}.direction`] !== undefined) keys.push(`${leg}.direction`);
  }
  return keys;
}

function shaftBuilder(chamberId: string, side: 'north' | 'south'): Builder {
  const base = `${chamberId}.shaft.${side}`;
  const room = SHAFT_CHAMBERS[chamberId] as (typeof SHAFT_CHAMBERS)[string];
  return {
    name: base,
    // How many legs there are is the records' business, so the keys are read
    // off the environment: the fixed part, then every leg it carries. A shaft
    // with no first leg names segment.1.angle and is skipped for want of it.
    keys: (env) => [
      ...room.keys, 'g1.base.side.mean', 'g1.face.angle',
      `${base}.inlet.from_east_wall`, `${base}.inlet.from_floor`, `${base}.width`, `${base}.height`,
      `${base}.segment.1.angle`, ...shaftSegmentKeys(env, base),
    ],
    build: (env) => {
      const inlet: Point = [
        room.eastWall(env) - value(env, `${base}.inlet.from_east_wall`),
        room.wall(env, side),
        room.floor(env) + value(env, `${base}.inlet.from_floor`),
      ];
      const bearing = side === 'north' ? 0 : 180;
      const segments: BoreSegment[] = [];
      for (let k = 1; k <= MAX_SEGMENTS; k++) {
        const leg = `${base}.segment.${k}`;
        const length = env[`${leg}.length`];
        const toFace = env[`${leg}.to_face`];
        if (length === undefined && toFace === undefined) break;
        segments.push({
          ...(length !== undefined ? { length } : { toFace: true }),
          angleDeg: value(env, `${leg}.angle`),
          directionDeg: env[`${leg}.direction`] ?? bearing,
        });
      }
      return bore({
        inlet,
        segments,
        width: value(env, `${base}.width`),
        height: value(env, `${base}.height`),
        face: { halfBase: value(env, 'g1.base.side.mean') / 2, faceAngleDeg: value(env, 'g1.face.angle') },
        prefix: base,
      });
    },
  };
}

function shaftBuilders(): Builder[] {
  return (['kc', 'qc'] as const).flatMap((room) => (['north', 'south'] as const).map((side) => shaftBuilder(room, side)));
}

// --- The chambers of construction ------------------------------------------
//
// Five spaces stacked over the King's Chamber, each floored with the rough
// upper side of the beams that roof the space below it. No source states how
// thick those beams are: Petrie says in section 62 that they are "very
// unequal in depth", and neither he nor Vyse measured one. So the levels are
// not in the database and cannot be, and the stack is solved instead.
//
// Vyse's appendix gives each chamber's plan and the range its height varies
// over, and one further figure that closes the whole thing: 69 ft 3 in,
// perpendicular, from the King's Chamber floor to the roof of Campbell's.
// Take the King's Chamber's own height out of that, take the five chambers'
// heights out of it, and what is left is the five floors. Sharing that evenly
// is the single assumption here; everything else is a measured record, and
// the top of Campbell's lands on Vyse's figure by construction rather than by
// agreement.
//
// In plan they are centred on the King's Chamber. That is Petrie's own
// reading of the masons' lines in section 62: two vertical lines on the
// second chamber's south wall 413.5 apart, "evidently intended for the length
// of the King's Chamber below them", and a mid-line pair on its east wall
// totalling 204.65, "intended for King's Chamber width". The chambers overrun
// the room below on every side, and the builders set them out from its centre.

/** The five, lowest first: Davison's, Wellington's, Nelson's, Lady Arbuthnot's, Campbell's. */
const CONSTRUCTION_COUNT = 5;

/** The records fixing the King's Chamber, which the stack stands on and is centred over. */
const CONSTRUCTION_ROOM_KEYS = [
  'kc.wall.north.north', 'kc.wall.south.north', 'kc.wall.east.east', 'kc.wall.west.east',
  'kc.floor.elevation', 'kc.ceiling.up',
] as const;

interface ConstructionChamber {
  /** Its floor, and the level its side walls stop at: the ceiling, or the wall top under a gable. */
  floor: number;
  top: number;
  /** The ridge above the floor, where the chamber is roofed with a gable. */
  ridge?: number;
  length: number;
  width: number;
  keys: string[];
}

/** A chamber's height: the mean of the range Vyse's table gives it. */
function constructionHeight(env: Environment, n: number): { value: number; keys: string[] } | undefined {
  const base = `chamber.construction_${n}.height`;
  const lo = numberAt(env, `${base}.min`);
  const hi = numberAt(env, `${base}.max`);
  if (lo === undefined || hi === undefined || hi <= 0) return undefined;
  return { value: (lo + hi) / 2, keys: [`${base}.min`, `${base}.max`] };
}

/**
 * The whole stack, solved. Nothing comes back unless every chamber's plan and
 * height are carried and the closing figure with them, because four measured
 * chambers and a guess at the fifth is not what the sources say.
 */
function constructionStack(env: Environment): { chambers: ConstructionChamber[]; slab: number; keys: string[] } | undefined {
  const closing = numberAt(env, 'chamber.construction.stack.height');
  const kcFloor = numberAt(env, 'kc.floor.elevation');
  const kcCeiling = numberAt(env, 'kc.ceiling.up');
  if (closing === undefined || kcFloor === undefined || kcCeiling === undefined) return undefined;
  if (kcCeiling <= kcFloor) return undefined;

  const keys: string[] = ['chamber.construction.stack.height', ...CONSTRUCTION_ROOM_KEYS];
  const parts: { height: number; length: number; width: number; keys: string[] }[] = [];
  for (let n = 1; n <= CONSTRUCTION_COUNT; n++) {
    const base = `chamber.construction_${n}`;
    const height = constructionHeight(env, n);
    const length = dimension(env, `${base}.length`, ['north', 'south']);
    const width = dimension(env, `${base}.width`, ['east', 'west']);
    if (!height || !length || !width || length.value <= 0 || width.value <= 0) return undefined;
    const own = [...height.keys, ...length.keys, ...width.keys];
    parts.push({ height: height.value, length: length.value, width: width.value, keys: own });
    keys.push(...own);
  }

  // What the closing figure leaves for the five floors, shared evenly.
  const rooms = parts.reduce((a, part) => a + part.height, 0);
  const slab = (closing - (kcCeiling - kcFloor) - rooms) / CONSTRUCTION_COUNT;
  if (!(slab > 0)) return undefined;

  // Campbell's is the one with a pitched roof: its side walls stop at the low
  // wall Vyse measured, and the mean height carries on up to the ridge.
  const gableKey = `chamber.construction_${CONSTRUCTION_COUNT}.wall.height`;
  const gableWall = numberAt(env, gableKey);

  const chambers: ConstructionChamber[] = [];
  let level = kcCeiling;
  for (const [i, part] of parts.entries()) {
    const floor = level + slab;
    const gabled = i === CONSTRUCTION_COUNT - 1 && gableWall !== undefined && gableWall > 0 && gableWall < part.height;
    if (gabled) keys.push(gableKey);
    chambers.push({
      floor,
      top: floor + (gabled ? (gableWall as number) : part.height),
      ...(gabled ? { ridge: part.height } : {}),
      length: part.length,
      width: part.width,
      keys: part.keys,
    });
    level = floor + part.height;
  }
  return { chambers, slab, keys };
}

/**
 * The stack's solved levels, and how thick one floor came out, for a caller
 * that wants the numbers rather than the solids: the dossier, a test that
 * checks the top lands on Vyse's figure, and the Python mirror's parity test.
 */
export interface ConstructionStack {
  slab: number;
  chambers: { floor: number; top: number; ridge?: number }[];
}

export function constructionChamberLevels(env: Environment): ConstructionStack | undefined {
  const stack = constructionStack(env);
  if (!stack) return undefined;
  return {
    slab: stack.slab,
    chambers: stack.chambers.map(({ floor, top, ridge }) => (ridge === undefined ? { floor, top } : { floor, top, ridge })),
  };
}

function constructionBuilder(n: number): Builder {
  const prefix = `chamber.construction_${n}`;
  return {
    name: prefix,
    // One chamber cannot be built without the other four: the floors between
    // them come out of the closing figure, which only closes over the whole
    // stack. So every one of them names every record the stack was solved
    // from, and a preset missing any of them builds none of the five.
    keys: (env) => constructionStack(env)?.keys ?? [
      `${prefix}.height.min`, `${prefix}.height.max`,
      'chamber.construction.stack.height', ...CONSTRUCTION_ROOM_KEYS,
    ],
    build: (env) => {
      const stack = constructionStack(env);
      if (!stack) throw new Error('interiorSolids: the chambers of construction are not all in the environment');
      const room = stack.chambers[n - 1] as ConstructionChamber;
      const east = (value(env, 'kc.wall.east.east') + value(env, 'kc.wall.west.east')) / 2;
      const north = (value(env, 'kc.wall.north.north') + value(env, 'kc.wall.south.north')) / 2;
      const min: Point = [east - room.length / 2, north - room.width / 2, room.floor];
      const max: Point = [east + room.length / 2, north + room.width / 2, room.top];
      return room.ridge === undefined
        ? chamber({ min, max, prefix })
        : chamber({ min, max, gable: { ridgeHeight: room.ridge, axis: 'x' }, prefix });
    },
  };
}

function constructionBuilders(): Builder[] {
  return Array.from({ length: CONSTRUCTION_COUNT }, (_, i) => constructionBuilder(i + 1));
}

// --- The voids the muons found --------------------------------------------
//
// A void is not a room. Nobody has stood in either of these; they are the
// shape a muon deficit takes, fitted as a rectangular cuboid, and the records
// carry the fit's own error bars. They are built here beside Petrie's rooms
// because they are inside the same pyramid and belong in the same frame, and
// they are named `void.*` so that everything downstream can tell them apart
// from a chamber somebody has walked into.
//
// The North Face Corridor is fixed by the paper in three ways and derived in
// the fourth. Its size and its floor level are records. East to west it is
// centred on the descending corridor, which the paper states outright: its
// central axis "is coincident with the center of the Chevron and above the
// DC". North to south it stands 0.84 m behind the north face of the Chevron,
// and the Chevron stands in the pyramid's north face, so the setback is taken
// off the face plane at the corridor's own mid-height, the same way an
// entrance's north coordinate is taken off it.
//
// Two things that follows are worth saying plainly. The face plane is the
// casing's, and the casing is long gone from the entrance, so a corridor
// placed against it stands about the casing's thickness further in than one
// placed against the core face the paper's team could actually see. And the
// paper's slope, -0.3 +/- 1.5 degrees, has zero inside it and the paper
// favours a horizontal corridor, so the solid is drawn level.

const NFC = 'void.north_face_corridor';

const BIG = 'void.big';

/** The records fixing the Grand Gallery, which the Big Void stands over and borrows its section from. */
const BIG_VOID_GALLERY_KEYS = [
  ...pointKeys('passage.ascending.floor.end'), ...pointKeys('gg.floor.virtual_south_end'),
  'gg.floor.width', 'gg.ramp.width', 'gg.height',
] as const;

/** The records fixing the Queen's Chamber floor, which the one published distance is measured from. */
const BIG_VOID_QUEENS_KEYS = [...pointKeys('qc.corner.ne'), 'qc.length', 'qc.width'] as const;

const BIG_VOID_KEYS = [
  `${BIG}.length.min`,
  `${BIG}.centre.from_queens_chamber_floor.min`, `${BIG}.centre.from_queens_chamber_floor.max`,
  ...BIG_VOID_GALLERY_KEYS, ...BIG_VOID_QUEENS_KEYS,
] as const;

/**
 * Where the Big Void's centre is, solved from the one distance the paper
 * publishes, and the section and length it is drawn at.
 *
 * The 2017 paper states four things about it and no coordinates at all: the
 * void is above the Grand Gallery, its cross section is comparable to the
 * Gallery's, its length is at least 30 m, and its centre is between 40 m and
 * 50 m from the floor of the Queen's Chamber. Nothing else about its place is
 * anywhere in the text; the figures carry it, and a position read off a
 * figure by eye is not a measurement.
 *
 * Those four are enough, because "above the Grand Gallery" fixes two of the
 * three coordinates and the distance fixes the third. The centre stands over
 * the Gallery's own plan midpoint, on the Gallery's east offset, and its
 * height is whatever puts it the published distance from the Queen's Chamber
 * floor. That comes out at about 61 m over the pavement, some ten metres over
 * the Gallery's roof, and the two published bounds put it between 56 m and
 * 67 m, which is the error bar the void carries and the reason it is drawn as
 * an outline and never as a room.
 */
function bigVoid(env: Environment): { centre: Point; along: Point; length: number; width: number; height: number } | undefined {
  const near = numberAt(env, `${BIG}.centre.from_queens_chamber_floor.min`);
  const far = numberAt(env, `${BIG}.centre.from_queens_chamber_floor.max`);
  const length = numberAt(env, `${BIG}.length.min`);
  if (near === undefined || far === undefined || length === undefined || length <= 0) return undefined;

  // The Queen's Chamber floor, taken at its centre: the films were near its
  // south-west corner and in the Niche on its east side, and the paper says
  // "the floor of the Queen's chamber" rather than either of them.
  const [qcEast, qcNorth, qcUp] = point(env, 'qc.corner.ne');
  const queens: Point = [qcEast - value(env, 'qc.length') / 2, qcNorth - value(env, 'qc.width') / 2, qcUp];

  const low = point(env, 'passage.ascending.floor.end');
  const high = point(env, 'gg.floor.virtual_south_end');
  const along: Point = [high[0] - low[0], high[1] - low[1], high[2] - low[2]];
  const run = Math.hypot(along[0], along[1], along[2]);
  if (run < MIN_RUN) return undefined;

  const east = (low[0] + high[0]) / 2;
  const north = (low[1] + high[1]) / 2;
  const distance = (near + far) / 2;
  const flat = Math.hypot(east - queens[0], north - queens[1]);
  const rise = distance * distance - flat * flat;
  // A void that near the Queen's Chamber in plan and that far from it must
  // stand above it. If the arithmetic says otherwise the preset is not
  // describing this pyramid, and nothing is drawn.
  if (!(rise > 0)) return undefined;

  return {
    centre: [east, north, queens[2] + Math.sqrt(rise)],
    along: [along[0] / run, along[1] / run, along[2] / run],
    length,
    // "comparable to that of the Grand Gallery": the Gallery's own floor,
    // ramps included, by its own height. A rectangle, because "comparable" is
    // as far as the paper goes and a corbelled copy would claim more.
    width: value(env, 'gg.floor.width') + 2 * value(env, 'gg.ramp.width'),
    height: value(env, 'gg.height'),
  };
}

/** One of the two inclinations the paper leaves open, as a tube through the solved centre. */
function bigVoidBuilder(name: string, inclined: boolean): Builder {
  return {
    name: `${BIG}.${name}`,
    keys: BIG_VOID_KEYS,
    build: (env) => {
      const big = bigVoid(env);
      if (!big) throw new Error('interiorSolids: the Big Void is not in the environment');
      // Level, or along the Grand Gallery's own slope. The centre is the same
      // either way: the paper's two hypotheses differ in how the void lies,
      // not in where it was found.
      const unit: Point = inclined ? big.along : [0, 1, 0];
      const half = big.length / 2;
      // `passage` takes the floor centre line and measures its heights square
      // to it, so the line has to run half a section-height below the void's
      // centre, along that same square-to-the-axis up. Straight up for a level
      // run, and for a sloping one whatever part of straight up is square to
      // the axis, which is the frame `passage` will use.
      const lean = unit[2];
      const up: Point = [-unit[0] * lean, -unit[1] * lean, 1 - unit[2] * lean];
      const upLength = Math.hypot(up[0], up[1], up[2]);
      const drop = big.height / 2 / upLength;
      const floor: Point = [big.centre[0] - up[0] * drop, big.centre[1] - up[1] * drop, big.centre[2] - up[2] * drop];
      const from: Point = [floor[0] - unit[0] * half, floor[1] - unit[1] * half, floor[2] - unit[2] * half];
      const to: Point = [floor[0] + unit[0] * half, floor[1] + unit[1] * half, floor[2] + unit[2] * half];
      return passage({ from, to, width: big.width, height: big.height, prefix: `${BIG}.${name}` });
    },
  };
}

const VOID_BUILDERS: readonly Builder[] = [
  {
    name: NFC,
    keys: [
      `${NFC}.length`, `${NFC}.width`, `${NFC}.height`, `${NFC}.floor.up`, `${NFC}.from_north_face`,
      'entrance.floor.begin.east', 'g1.base.side.mean', 'g1.face.angle',
    ],
    build: (env) => {
      const floor = value(env, `${NFC}.floor.up`);
      const height = value(env, `${NFC}.height`);
      const halfBase = value(env, 'g1.base.side.mean') / 2;
      const faceAngle = (value(env, 'g1.face.angle') * Math.PI) / 180;
      // The face at the corridor's mid-height, then in by the setback.
      const face = halfBase - (floor + height / 2) / Math.tan(faceAngle);
      const north = face - value(env, `${NFC}.from_north_face`);
      const east = value(env, 'entrance.floor.begin.east');
      const halfLength = value(env, `${NFC}.length`) / 2;
      return chamber({
        min: [east - halfLength, north - value(env, `${NFC}.width`), floor],
        max: [east + halfLength, north, floor + height],
        prefix: NFC,
      });
    },
  },
  bigVoidBuilder('horizontal', false),
  bigVoidBuilder('inclined', true),
];

/** The Great Pyramid's solids: Petrie's rooms in order from the entrance down and then up,
 *  then the four shafts, the five chambers of construction, and the voids the muons found. */
const BUILDERS: readonly Builder[] = [...ROOM_BUILDERS, ...shaftBuilders(), ...constructionBuilders(), ...VOID_BUILDERS];

/** Every record a shaft is built from under this environment: the fixed keys and the legs it actually carries. */
export function shaftInputs(env: Environment, chamberId: string, side: 'north' | 'south'): readonly string[] {
  return keysOf(shaftBuilder(chamberId, side), env);
}

// --- Structures whose plan is discovered from their records ----------------
//
// A structure other than G1 is read rather than written out. Every key it owns
// begins with its id, and two shapes are looked for under it:
//
//   <id>.passage.<name>.floor.begin.{north,east,up}   floor centre line
//   <id>.passage.<name>.floor.end.{north,east,up}     the far end, if measured
//   <id>.passage.<name>.length                        else metres along the floor
//   <id>.passage.<name>.angle                         and the slope in degrees
//   <id>.passage.<name>.direction                     optional bearing, azimuth
//   <id>.passage.<name>.{width,height}                rectangular section
//
// A passage that records both ends is drawn between them and its `angle`, if
// there is one, is provenance. A passage that records only where it begins is
// drawn from `length` and `angle`, the slope being positive for a passage
// that rises going away from its beginning, along `direction` if a record
// gives one and due south otherwise. That is how a published plan states a
// passage, and computing the far end keeps it out of the database.
//
//   <id>.chamber.<name>.wall.{north,south}.north      wall positions
//   <id>.chamber.<name>.wall.{east,west}.east
//   <id>.chamber.<name>.{floor,ceiling}.up            levels
//   <id>.chamber.<name>.gable.height                  optional pitched roof
//
// A chamber's three extents are each read on their own, because a survey
// records what it could reach. East to west is both side walls if both were
// located, else one of them and the chamber's `length` (whole, or the mean of
// the `length.north` and `length.south` Petrie measures), else `centre` and
// that length; north to south is the same with the two end walls and `width`.
// The vertical is `floor.up` with either `ceiling.up` or `wall.height`. A wall
// bounds its own side, so a length hung off `wall.west.east` runs east and one
// hung off `wall.east.east` runs west; nothing there is a choice.
//
// A north coordinate may instead be recorded as a distance south of the north
// base edge, `<point>.from_north_base`, and an east one as a distance west of
// the east base edge, `<point>.from_east_side`, which is how a survey that
// measured from the casing states them; both are converted here with the
// structure's half-base. A passage with no `floor.begin` of its own starts at
// the structure's entrance, `<id>.entrance.<name>.floor.begin` if one is named
// for it and `<id>.entrance.floor.begin` for the descending passage, which is
// how G1's entrance passage is stored. An entrance that records a level and an
// east offset but no north coordinate is put on the north face, which is where
// every entrance at Giza is, from `<id>.face.angle` and the half base.
// Anything incomplete is skipped.

/** A passage shorter than this is a rounding artefact, not a passage. */
const MIN_RUN = 1e-6;

/**
 * The bearing a passage takes when no record gives it one. Every entrance
 * passage at Giza runs south into its pyramid from the north face, so a
 * published plan that states a length and a slope and nothing else is stating
 * a run due south.
 */
const DUE_SOUTH = 180;

/** A resolved coordinate and the record it actually came from. */
interface Coordinate {
  value: number;
  key: string;
}

function numberAt(env: Environment, key: string): number | undefined {
  const v = env[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** The distance-from-the-casing spelling of each horizontal axis. */
const FROM_EDGE: Record<string, string> = { north: 'from_north_base', east: 'from_east_side' };

/**
 * One coordinate of a stored point. `<base>.north` is the frame coordinate;
 * `<base>.from_north_base` is the same point given as a distance south of the
 * structure's north base edge, and `<base>.from_east_side` a distance west of
 * its east base edge, so both need the half-base to convert. There is no such
 * alternative for up, which is measured from the pavement either way.
 */
function coordinate(env: Environment, base: string, axis: 'north' | 'east' | 'up', half: number | undefined): Coordinate | undefined {
  const key = `${base}.${axis}`;
  const direct = numberAt(env, key);
  if (direct !== undefined) return { value: direct, key };
  const edge = FROM_EDGE[axis];
  if (edge === undefined || half === undefined) return undefined;
  const fromEdge = `${base}.${edge}`;
  const inward = numberAt(env, fromEdge);
  return inward === undefined ? undefined : { value: half - inward, key: fromEdge };
}

/** One extent of a chamber, and the records that fixed it. */
interface Extent {
  lo: number;
  hi: number;
  keys: string[];
}

/**
 * A measured dimension, either as the sides a survey took it on or whole:
 * the mean of `length.north` and `length.south`, or failing those `length`.
 * Whichever sides are present are averaged, which is what G1's subterranean
 * chamber does.
 *
 * The sides come first. A survey that reached both walls measured more than
 * one that stated an overall size, and the two spellings are different keys,
 * so the preset cannot arbitrate between them the way it does between two
 * sources of one key. That is how the chambers of construction take Petrie's
 * walls for their plan and Vyse's table for their heights.
 */
function dimension(env: Environment, base: string, sides: readonly string[]): { value: number; keys: string[] } | undefined {
  const found = sides
    .map((side) => ({ key: `${base}.${side}`, value: numberAt(env, `${base}.${side}`) }))
    .filter((p): p is { key: string; value: number } => p.value !== undefined);
  if (found.length > 0) {
    return { value: found.reduce((a, p) => a + p.value, 0) / found.length, keys: found.map((p) => p.key) };
  }
  const whole = numberAt(env, base);
  return whole === undefined ? undefined : { value: whole, keys: [base] };
}

/**
 * One horizontal extent: both bounding walls, or one of them and the measured
 * dimension, or the centre and the dimension. `high` is the north or east
 * wall, `low` the south or west one.
 */
function extent(
  env: Environment,
  base: string,
  axis: 'north' | 'east',
  half: number | undefined,
  low: string,
  high: string,
  size: string,
  sides: readonly string[],
): Extent | undefined {
  const lo = coordinate(env, `${base}.${low}`, axis, half);
  const hi = coordinate(env, `${base}.${high}`, axis, half);
  if (lo && hi) {
    return { lo: Math.min(lo.value, hi.value), hi: Math.max(lo.value, hi.value), keys: [hi.key, lo.key] };
  }
  const span = dimension(env, `${base}.${size}`, sides);
  if (!span || span.value <= 0) return undefined;
  if (lo) return { lo: lo.value, hi: lo.value + span.value, keys: [lo.key, ...span.keys] };
  if (hi) return { lo: hi.value - span.value, hi: hi.value, keys: [hi.key, ...span.keys] };
  const centre = coordinate(env, `${base}.centre`, axis, half);
  if (!centre) return undefined;
  return { lo: centre.value - span.value / 2, hi: centre.value + span.value / 2, keys: [centre.key, ...span.keys] };
}

/** The vertical extent: the floor, and either the ceiling or the wall height. */
function verticalExtent(env: Environment, base: string): Extent | undefined {
  const floor = numberAt(env, `${base}.floor.up`);
  if (floor === undefined) return undefined;
  const ceiling = numberAt(env, `${base}.ceiling.up`);
  if (ceiling !== undefined && ceiling > floor) {
    return { lo: floor, hi: ceiling, keys: [`${base}.floor.up`, `${base}.ceiling.up`] };
  }
  const walls = numberAt(env, `${base}.wall.height`);
  if (walls !== undefined && walls > 0) return { lo: floor, hi: floor + walls, keys: [`${base}.floor.up`, `${base}.wall.height`] };
  return undefined;
}

/** A stored point as x, y, z, with its records in the north, east, up order G1 uses. */
function storedPoint(env: Environment, base: string, half: number | undefined): { point: Point; keys: string[] } | undefined {
  const north = coordinate(env, base, 'north', half);
  const east = coordinate(env, base, 'east', half);
  const up = coordinate(env, base, 'up', half);
  if (!north || !east || !up) return undefined;
  return { point: [east.value, north.value, up.value], keys: [north.key, east.key, up.key] };
}

/** Every `<name>` present under `<prefix><kind>.`, sorted, so the plan comes out of the data. */
function memberNames(env: Environment, prefix: string, kind: string): string[] {
  const head = `${prefix}${kind}.`;
  const found = new Set<string>();
  for (const key of Object.keys(env)) {
    if (!key.startsWith(head)) continue;
    const rest = key.slice(head.length);
    const dot = rest.indexOf('.');
    if (dot > 0) found.add(rest.slice(0, dot));
  }
  return [...found].sort();
}

/**
 * The north coordinate of a point in the pyramid's north face, taken from the
 * face instead of read off a record. Every entrance at Giza is in the north
 * face, and a face is a plane, so a point on it at height `up` stands
 * `up / tan(face angle)` south of the north base edge: a survey that recorded
 * the threshold's height recorded its plan position along with it, and the
 * setback is the face's own geometry rather than a second measurement. That
 * makes it a derived quantity, which belongs here and not in the database.
 *
 * The face angle is the resolved `<id>.face.angle`, so it moves with the
 * preset, and it is named among the records because it is what does the work.
 * The half base converts as it does for `from_north_base` and goes unnamed
 * for the same reason. A preset carrying no face angle, or no base to halve,
 * leaves the point unmade and the passage unbuilt, exactly as before.
 */
function faceNorth(env: Environment, base: string, structure: string, half: number | undefined): Coordinate | undefined {
  const up = numberAt(env, `${base}.up`);
  const key = `${structure}.face.angle`;
  const angle = numberAt(env, key);
  if (up === undefined || half === undefined || angle === undefined) return undefined;
  if (angle <= 0 || angle >= 90) return undefined;
  return { value: half - up / Math.tan((angle * Math.PI) / 180), key };
}

/**
 * An entrance point: the stored point if all three coordinates are recorded,
 * and otherwise the same point with its north coordinate taken from the north
 * face, which is where every entrance at Giza is.
 */
function entrancePoint(env: Environment, base: string, structure: string, half: number | undefined): { point: Point; keys: string[] } | undefined {
  const stored = storedPoint(env, base, half);
  if (stored) return stored;
  const north = faceNorth(env, base, structure, half);
  const east = coordinate(env, base, 'east', half);
  const up = coordinate(env, base, 'up', half);
  if (!north || !east || !up) return undefined;
  return { point: [east.value, north.value, up.value], keys: [north.key, east.key, up.key] };
}

/** Where a passage begins when it records no floor.begin of its own. */
function entranceBegin(env: Environment, structure: string, prefix: string, name: string, half: number | undefined): { point: Point; keys: string[] } | undefined {
  const named = entrancePoint(env, `${prefix}entrance.${name}.floor.begin`, structure, half);
  if (named) return named;
  return name === 'descending' ? entrancePoint(env, `${prefix}entrance.floor.begin`, structure, half) : undefined;
}

/**
 * The far end of a passage whose source states it as a run rather than as a
 * second point. `<base>.length` is metres measured along the floor and
 * `<base>.angle` the slope in degrees, positive for a passage that rises
 * going away from its beginning and negative for one that descends. The
 * bearing is `<base>.direction` when a record gives it as an azimuth in
 * degrees, and `DUE_SOUTH` otherwise. The end point itself is never stored:
 * it is a derived quantity, so it is computed here from the three records.
 */
function endFromRun(env: Environment, base: string, from: Point): { point: Point; keys: string[] } | undefined {
  const length = numberAt(env, `${base}.length`);
  const angle = numberAt(env, `${base}.angle`);
  if (length === undefined || angle === undefined || length <= 0) return undefined;
  const keys = [`${base}.length`, `${base}.angle`];
  const direction = numberAt(env, `${base}.direction`);
  if (direction !== undefined) keys.push(`${base}.direction`);
  const azimuth = ((direction ?? DUE_SOUTH) * Math.PI) / 180;
  const slope = (angle * Math.PI) / 180;
  const flat = length * Math.cos(slope);
  return {
    point: [
      from[0] + flat * Math.sin(azimuth),
      from[1] + flat * Math.cos(azimuth),
      from[2] + length * Math.sin(slope),
    ],
    keys,
  };
}

function passageBuilder(env: Environment, structure: string, prefix: string, name: string, half: number | undefined): Builder | undefined {
  const base = `${prefix}passage.${name}`;
  const from = storedPoint(env, `${base}.floor.begin`, half) ?? entranceBegin(env, structure, prefix, name, half);
  const width = numberAt(env, `${base}.width`);
  const height = numberAt(env, `${base}.height`);
  if (!from || width === undefined || height === undefined || width <= 0 || height <= 0) return undefined;
  // A survey that could reach both ends leaves two points. A published plan
  // states a length along the floor and a slope instead, and the far end is
  // worked out from them rather than written down anywhere.
  const stored = storedPoint(env, `${base}.floor.end`, half);
  const to = stored ?? endFromRun(env, base, from.point);
  if (!to) return undefined;
  const run = Math.hypot(to.point[0] - from.point[0], to.point[1] - from.point[1], to.point[2] - from.point[2]);
  if (run < MIN_RUN) return undefined;

  const keys = [...from.keys, ...to.keys, `${base}.width`, `${base}.height`];
  // The recorded slope is not needed to build a passage whose two ends are
  // known, but it is part of the provenance when the database carries it. On
  // the other path it is load-bearing and `endFromRun` has already named it.
  if (stored && numberAt(env, `${base}.angle`) !== undefined) keys.push(`${base}.angle`);
  return {
    name: base,
    keys,
    build: () => passage({ from: from.point, to: to.point, width, height, prefix: base }),
  };
}

function chamberBuilder(env: Environment, prefix: string, name: string, half: number | undefined): Builder | undefined {
  const base = `${prefix}chamber.${name}`;
  const northSouth = extent(env, base, 'north', half, 'wall.south', 'wall.north', 'width', ['east', 'west']);
  const eastWest = extent(env, base, 'east', half, 'wall.west', 'wall.east', 'length', ['north', 'south']);
  const upDown = verticalExtent(env, base);
  if (!northSouth || !eastWest || !upDown) return undefined;

  const min: Point = [eastWest.lo, northSouth.lo, upDown.lo];
  const max: Point = [eastWest.hi, northSouth.hi, upDown.hi];
  const span: Point = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  if (span[0] <= 0 || span[1] <= 0 || span[2] <= 0) return undefined;

  const keys = [...northSouth.keys, ...eastWest.keys, ...upDown.keys];
  // A gable is optional, and only a ridge above the wall tops is one: the
  // ridge runs along the chamber's longer horizontal axis, which is how every
  // gabled chamber at Giza is roofed, G1's Queen's Chamber included.
  const ridgeHeight = numberAt(env, `${base}.gable.height`);
  let gable: Gable | undefined;
  if (ridgeHeight !== undefined && ridgeHeight > span[2]) {
    keys.push(`${base}.gable.height`);
    gable = { ridgeHeight, axis: span[0] >= span[1] ? 'x' : 'y' };
  }
  return {
    name: base,
    keys,
    build: () => (gable ? chamber({ min, max, gable, prefix: base }) : chamber({ min, max, prefix: base })),
  };
}

/**
 * Half the base, which `from_north_base` is converted with. `buildEnvironment`
 * derives it, but the Blender generator resolves the database without that
 * step, so the measured side stands in for it.
 */
function halfBase(env: Environment, structure: string): number | undefined {
  const half = numberAt(env, `${structure}.base.half`);
  if (half !== undefined) return half;
  const base = numberAt(env, `${structure}.base.side.mean`);
  return base === undefined ? undefined : base / 2;
}

/**
 * The builders a structure's own records describe, passages first and then
 * chambers, each group in name order so the list is the same on every run and
 * in the Python mirror.
 */
function discover(env: Environment, structure: string): Builder[] {
  const prefix = interiorKeyPrefix(structure);
  const half = halfBase(env, structure);
  const out: Builder[] = [];
  for (const name of memberNames(env, prefix, 'passage')) {
    const builder = passageBuilder(env, structure, prefix, name, half);
    if (builder) out.push(builder);
  }
  for (const name of memberNames(env, prefix, 'chamber')) {
    const builder = chamberBuilder(env, prefix, name, half);
    if (builder) out.push(builder);
  }
  return out;
}

function buildersFor(env: Environment, structure: string): readonly Builder[] {
  return structure === 'g1' ? BUILDERS : discover(env, structure);
}

/**
 * Every record each of the Great Pyramid's solids is built from, for
 * provenance, with no environment to ask: a shaft lists its fixed records and
 * its first leg's angle here, and `interiorSolidInputs` lists the rest.
 */
export const INTERIOR_SOLID_INPUTS: Record<string, readonly string[]> =
  Object.fromEntries(BUILDERS.map((b) => [b.name, keysOf(b, {})]));

/** The records behind each solid a structure's interior actually builds. */
export function interiorSolidInputs(env: Environment, options: InteriorOptions = {}): Record<string, readonly string[]> {
  return Object.fromEntries(buildersFor(env, options.structure ?? 'g1').map((b) => [b.name, keysOf(b, env)]));
}

/**
 * One structure's interior as named solids, in the Great Pyramid's case in
 * order from the entrance down and then up. A solid whose records the
 * environment does not carry is left out: presets differ, and a missing room
 * is better than an invented one.
 */
export function interiorSolids(env: Environment, options: InteriorOptions = {}): Record<string, Solid> {
  const out: Record<string, Solid> = {};
  for (const builder of buildersFor(env, options.structure ?? 'g1')) {
    if (!keysOf(builder, env).every((key) => Number.isFinite(env[key]))) continue;
    out[builder.name] = builder.build(env);
  }
  return out;
}

/** Which of `ids` the environment carries an interior for, in the order given. */
export function interiorStructures(env: Environment, ids: readonly string[] = INTERIOR_STRUCTURES): string[] {
  return ids.filter((id) => buildersFor(env, id).some((b) => keysOf(b, env).every((key) => Number.isFinite(env[key]))));
}
