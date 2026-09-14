/**
 * The Great Pyramid as it stands: a stack of square slabs, one per course,
 * built from the course heights in the database rather than from a single
 * truncation height. Same frame as the rest of the geometry, origin at the
 * base centre, +X east, +Y north, +Z up, metres.
 *
 * Course k stands from the top of everything below it to that plus its own
 * height, and its half-width is the casing face line taken at its bed,
 * half × (1 − z / height). So the steps hang on the same face the smooth
 * pyramid has, the course is full width all the way up and the ledge is
 * exposed at its top, which is what a stepped core looks like from the
 * ground. Two things are deliberately left out of that outline:
 *
 * The casing's thickness. What survives above the bottom courses is core
 * masonry, and its face stands inside the casing line by however thick the
 * casing was at that level. The database carries no per-course casing
 * thickness, so rather than invent one the slabs are hung on the casing line
 * and read a little too wide by a constant of the order of a metre.
 *
 * The concavity. The hollowing is a property of the casing faces, and the
 * 0.94 m of it the database carries is about the size of a single course's
 * step. Drawing both would put a guess about faces that are gone on top of a
 * measurement of courses that are there, and at the scale the steps are
 * legible at the two cannot be told apart. So the slabs are four-sided.
 */
import type { Landmarks } from './landmarks';
import type { Mesh } from './mesh';

export interface SteppedPyramidOptions {
  base: number;
  /** The original height, which is what the face line is computed from. */
  height: number;
  /** Course heights in metres, from the bottom up. */
  courses: number[];
}

type V3 = [number, number, number];

/** Counter-clockwise seen from above, starting at the north-east corner, as the eight-point ring in mesh.ts does. */
function corners(half: number, z: number): V3[] {
  return [
    [half, half, z],
    [-half, half, z],
    [-half, -half, z],
    [half, -half, z],
  ];
}

/**
 * The bed of each course, in metres above the base, and the summit platform's
 * top last. Course 1 is bedded at 0, so this has one more entry than there
 * are courses and its last entry is the height of the pyramid as it stands.
 */
export function courseLevels(courses: number[]): number[] {
  const levels = [0];
  let z = 0;
  for (const h of courses) {
    z += h;
    levels.push(z);
  }
  return levels;
}

/**
 * The stepped solid. Eight vertices per course, the base ring first: the
 * course's own bed ring and its top ring, both at the one half-width. The
 * walls, the ledges between one course's top and the next one's bed, and the
 * two caps close it into a single manifold wound outward, so `meshVolume` is
 * positive and equals the slab volumes added up.
 */
export function steppedPyramidMesh({ base, height, courses }: SteppedPyramidOptions): Mesh {
  if (courses.length === 0) throw new Error('a stepped pyramid needs at least one course');
  const halfBase = base / 2;
  const verts: V3[] = [];
  const tris: number[] = [];
  const quad = (a: number, b: number, c: number, d: number): void => {
    tris.push(a, b, c, a, c, d);
  };

  let z = 0;
  for (const h of courses) {
    if (z >= height) throw new Error(`the courses reach ${z.toFixed(3)} m, which is the whole ${height} m of the pyramid`);
    const half = halfBase * (1 - z / height);
    const bed = verts.length;
    for (const v of corners(half, z)) verts.push(v);
    for (const v of corners(half, z + h)) verts.push(v);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      quad(bed + i, bed + j, bed + 4 + j, bed + 4 + i);
    }
    z += h;
  }

  quad(3, 2, 1, 0); // The base cap, wound clockwise from above so it faces down.
  for (let k = 0; k + 1 < courses.length; k++) {
    const above = k * 8 + 4;
    const next = (k + 1) * 8;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      quad(above + i, above + j, next + j, next + i); // The step's ledge, facing up.
    }
  }
  const summit = (courses.length - 1) * 8 + 4;
  quad(summit, summit + 1, summit + 2, summit + 3);

  const positions = new Float32Array(verts.length * 3);
  verts.forEach((v, i) => positions.set(v, i * 3));
  return {
    positions,
    indices: Uint32Array.from(tris),
    vertexCount: verts.length,
    triangleCount: tris.length / 3,
  };
}

/**
 * The courses worth naming a point on. One is the thickest course in Goyon's
 * table and the bottom of the whole stack; 35, 44 and 67 are three of the
 * thick courses that stand out of it, the ones Petrie marks the pyramid's
 * twenty-fifths against. The top course is added by `steppedPyramidLandmarks`,
 * whichever number it turns out to have.
 */
export const LANDMARK_COURSES = [1, 35, 44, 67];

export interface SteppedLandmarkOptions {
  courses: number[];
  /** Optional prefix, e.g. "g1", producing keys like "g1.top.centre". */
  prefix?: string;
}

/**
 * The summit platform's centre and the bed of a handful of courses, so a
 * claim about a thick course has a point to hang an overlay on. A course's
 * level is the height of its bed, which is how a survey states one: Petrie's
 * "the 25th course is at 885.0" is the top of the twenty-fourth.
 */
export function steppedPyramidLandmarks({ courses, prefix }: SteppedLandmarkOptions): Landmarks {
  const levels = courseLevels(courses);
  const p = prefix ? `${prefix}.` : '';
  const out: Landmarks = {};
  if (courses.length === 0) return out;
  out[`${p}top.centre`] = [0, 0, levels[courses.length] as number];
  for (const n of [...LANDMARK_COURSES, courses.length]) {
    if (n < 1 || n > courses.length) continue;
    out[`${p}course.${n}.level`] = [0, 0, levels[n - 1] as number];
  }
  return out;
}

/**
 * The course heights a preset carries for one structure, bottom up. The keys
 * are `<id>.course.<n>.height` and they are read in numeric order, not in the
 * order the resolver happened to put them in, so a renumbered import cannot
 * quietly stack the pyramid in the wrong order.
 */
export function courseHeights(values: Record<string, number>, prefix: string): number[] {
  const pattern = new RegExp(`^${prefix.replace(/\./g, '\\.')}\\.course\\.(\\d+)\\.height$`);
  const numbered: { n: number; height: number }[] = [];
  for (const [key, value] of Object.entries(values)) {
    const match = pattern.exec(key);
    if (match) numbered.push({ n: Number(match[1]), height: value });
  }
  return numbered.sort((a, b) => a.n - b.n).map((c) => c.height);
}
