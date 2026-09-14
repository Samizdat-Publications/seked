/**
 * The Great Pyramid's interior, wired to the measurement database.
 *
 * `interior.ts` holds the shape builders and knows nothing but metres.
 * This file names the solids and says which records fix each one, so the
 * viewer, the Blender generator and a claim overlay all get the same rooms
 * from the same numbers. Nothing here stores a measurement: every value is
 * looked up in the resolved environment, and a solid whose records the preset
 * does not carry is skipped rather than guessed at.
 *
 * The frame is the project frame: origin at the base centre, +X east,
 * +Y north, +Z up, metres. A stored point is three records, `<point>.north`,
 * `.east` and `.up`, so `point()` puts them back in x, y, z order.
 */

import type { Environment } from './environment';
import { chamber, extrudedSection, passage } from './interior';
import type { SectionPair, Solid } from './interior';
import type { Point } from './landmarks';

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
  /** Every record the solid is built from, for provenance and for the skip test. */
  keys: readonly string[];
  build(env: Environment): Solid;
}

const BUILDERS: readonly Builder[] = [
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

/** Every record each solid is built from, for provenance in the .blend and the GLB. */
export const INTERIOR_SOLID_INPUTS: Record<string, readonly string[]> =
  Object.fromEntries(BUILDERS.map((b) => [b.name, b.keys]));

/**
 * The Great Pyramid's interior as named solids, in order from the entrance
 * down and then up. A solid whose records the environment does not carry is
 * left out: presets differ, and a missing room is better than an invented one.
 */
export function interiorSolids(env: Environment): Record<string, Solid> {
  const out: Record<string, Solid> = {};
  for (const builder of BUILDERS) {
    if (!builder.keys.every((key) => Number.isFinite(env[key]))) continue;
    out[builder.name] = builder.build(env);
  }
  return out;
}
