/**
 * The modern city as merged prisms.
 *
 * `scripts/city.ts` wrote 231,988 buildings east of the plateau as oriented
 * boxes: a centre, a width and a depth, the direction the long side points,
 * and a height the Open Buildings 2.5D raster measured. This turns a run of
 * those records into meshes.
 *
 * Three things shape it, and all three are because there are a quarter of a
 * million of them.
 *
 *   batches   The import sorted its records into one-kilometre cells, so a
 *             run of records is a region. A batch is a square block of those
 *             cells merged into one mesh, which is one draw call and one
 *             thing to cull. The whole city is about a dozen of them.
 *   levels    `near` draws every building in the batch. `far` leaves out the
 *             small ones, which from a kilometre away are a texture on the
 *             ground rather than a building, and which are most of the city's
 *             triangles for almost none of its silhouette.
 *   lazily    One batch at one level is built at a time, because building
 *             every batch at every level at once is tens of megabytes of
 *             vertices for a city that is mostly over the horizon.
 *
 * The city is CONTEXT and not evidence. Nothing here carries an evidence
 * tier, no claim may cite it, and the box is the best fit to an imported
 * outline rather than the outline itself: a record says where a building is,
 * how big it is, which way it faces and how tall it is, and nothing about its
 * shape is a measurement of that building. `data/footprints/city.json` says
 * so at length and is the contract.
 *
 * Frame as everywhere else: +X east, +Y north, +Z up, metres.
 */

import type { Mesh } from './mesh';

/** Floats per record in `city.bin`: x, y, width, depth, yawDeg, height, measured. */
export const CITY_STRIDE = 7;

/**
 * LOOK CHOICES, not measurements, and each one a decision about drawing
 * rather than a fact about Giza.
 *
 * `batchCells` is how many of the import's one-kilometre cells make a batch's
 * side. Four gives blocks four kilometres across, which is about a dozen over
 * the city: few enough that culling them is cheap, small enough that the near
 * half of the view is not paying for the far half.
 *
 * `coarseAreaM2` is the roof area below which a building is left out of the
 * `far` level. Two hundred square metres is a little over the import's own
 * mean of 143, and what it leaves out is the yards, sheds and single rooms
 * that at a kilometre are smaller than the gaps between them.
 *
 * `sinkMetres` is how far a prism's base is put below the ground under its
 * centre. The ground out there is a sixty-metre grid and a building is
 * fifteen metres across, so a box standing exactly on the height at its
 * centre lifts a corner wherever the ground tilts. Three metres of skirt
 * buries that, and it is never seen because the ground is drawn over it.
 */
export const CITY = {
  batchCells: 4,
  coarseAreaM2: 200,
  sinkMetres: 3,
} as const;

/** One building, as the binary stores it. */
export interface CityBox {
  /** Centre of the box in the scene frame, metres. */
  x: number;
  y: number;
  /** The long side and the short side, metres; width is never less than depth. */
  width: number;
  depth: number;
  /** Which way the long side points: degrees counter-clockwise from east, in [0, 180). */
  yawDeg: number;
  /** Metres above the ground under it. */
  height: number;
  /** Whether the raster measured that height, or the import filled it in. */
  measured: boolean;
}

/** One entry of `city.json`'s `cells` list: the cell's corner, and its run of records. */
export interface CityCell {
  x: number;
  y: number;
  from: number;
  count: number;
}

/** A run of records, as a batch collects them out of the cell list. */
export interface CityRun {
  from: number;
  count: number;
}

/** A square block of cells, the records in it, and where it is. */
export interface CityBatch {
  /** The block's south-west corner in the scene frame, metres. */
  x: number;
  y: number;
  /** The block's side, metres. */
  size: number;
  /** Every run of records inside it, in the order the binary holds them. */
  runs: CityRun[];
  /** How many buildings that is. */
  count: number;
}

/** Read one record out of the binary. */
export function cityBox(data: ArrayLike<number>, index: number): CityBox {
  const at = index * CITY_STRIDE;
  return {
    x: data[at] as number,
    y: data[at + 1] as number,
    width: data[at + 2] as number,
    depth: data[at + 3] as number,
    yawDeg: data[at + 4] as number,
    height: data[at + 5] as number,
    measured: (data[at + 6] as number) !== 0,
  };
}

/**
 * The cell list gathered into square blocks.
 *
 * A block's cells are not one run of records: the import sorted south to
 * north and west to east within a row, so a four by four block is up to four
 * runs, one per row, while adjacent cells in the same row are one run because
 * their records are adjacent. Merging them here is what lets a batch be built
 * by walking the binary forwards instead of gathering indices.
 */
export function cityBatches(cells: readonly CityCell[], cellSize: number, batchCells = CITY.batchCells): CityBatch[] {
  const size = cellSize * batchCells;
  const blocks = new Map<string, CityBatch>();
  for (const cell of cells) {
    if (cell.count === 0) continue;
    const bx = Math.floor(cell.x / size) * size;
    const by = Math.floor(cell.y / size) * size;
    const key = `${bx},${by}`;
    let batch = blocks.get(key);
    if (!batch) {
      batch = { x: bx, y: by, size, runs: [], count: 0 };
      blocks.set(key, batch);
    }
    const last = batch.runs[batch.runs.length - 1];
    if (last && last.from + last.count === cell.from) last.count += cell.count;
    else batch.runs.push({ from: cell.from, count: cell.count });
    batch.count += cell.count;
  }
  return [...blocks.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

export type CityLevel = 'near' | 'far';

export interface CityMeshOptions {
  /** Ground height at a point in the scene frame, metres. */
  groundLevel: (x: number, y: number) => number;
  /** Roof area below which a building is left out of the `far` level. */
  coarseAreaM2?: number;
  /** How far a prism's base is put below the ground under its centre. */
  sinkMetres?: number;
}

/** A batch built at one level, with what went into it. */
export interface CityMesh extends Mesh {
  level: CityLevel;
  /** How many buildings were drawn, and how many left out as too small. */
  drawn: number;
  dropped: number;
  /** How many of the drawn carry a height the raster measured. */
  measured: number;
}

/** Vertices and triangles one prism costs: four walls and a roof, each with its own corners. */
export const PRISM_VERTICES = 20;
export const PRISM_TRIANGLES = 10;

/** Whether this box is drawn at this level. */
function drawnAt(box: CityBox, level: CityLevel, coarseAreaM2: number): boolean {
  return level === 'near' || box.width * box.depth >= coarseAreaM2;
}

/**
 * One batch as a single mesh of prisms.
 *
 * Each building gets its own corners for each of its five faces rather than
 * eight shared ones, so the normals a consumer computes are the faces' own
 * and a box reads as a box instead of a lump. That is twenty vertices where
 * eight would do, and it is the reason one batch at one level is built at a
 * time rather than the whole city at once.
 *
 * The roof is drawn and the floor is not: a floor is under the ground and is
 * seen by nobody.
 */
export function cityBatchMesh(
  data: ArrayLike<number>,
  batch: CityBatch,
  level: CityLevel,
  options: CityMeshOptions,
): CityMesh {
  const coarseAreaM2 = options.coarseAreaM2 ?? CITY.coarseAreaM2;
  const sink = options.sinkMetres ?? CITY.sinkMetres;

  let drawn = 0;
  let measured = 0;
  for (const run of batch.runs) {
    for (let i = run.from; i < run.from + run.count; i++) {
      const box = cityBox(data, i);
      if (!drawnAt(box, level, coarseAreaM2)) continue;
      drawn++;
      if (box.measured) measured++;
    }
  }

  const positions = new Float32Array(drawn * PRISM_VERTICES * 3);
  const indices = new Uint32Array(drawn * PRISM_TRIANGLES * 3);
  let v = 0;
  let t = 0;
  for (const run of batch.runs) {
    for (let i = run.from; i < run.from + run.count; i++) {
      const box = cityBox(data, i);
      if (!drawnAt(box, level, coarseAreaM2)) continue;

      // The long side points along yaw and the short side across it, and both
      // are measured from the box's own centre, so the turn is about that
      // centre and not about the origin.
      const yaw = (box.yawDeg * Math.PI) / 180;
      const ax = (Math.cos(yaw) * box.width) / 2;
      const ay = (Math.sin(yaw) * box.width) / 2;
      const bx = (-Math.sin(yaw) * box.depth) / 2;
      const by = (Math.cos(yaw) * box.depth) / 2;
      // Counter-clockwise seen from above, as every ring in this package is.
      const corners: [number, number][] = [
        [box.x - ax - bx, box.y - ay - by],
        [box.x + ax - bx, box.y + ay - by],
        [box.x + ax + bx, box.y + ay + by],
        [box.x - ax + bx, box.y - ay + by],
      ];
      const ground = options.groundLevel(box.x, box.y);
      const bottom = ground - sink;
      const top = ground + box.height;

      for (let c = 0; c < 4; c++) {
        const [x0, y0] = corners[c] as [number, number];
        const [x1, y1] = corners[(c + 1) % 4] as [number, number];
        const base = v;
        positions.set([x0, y0, bottom, x1, y1, bottom, x1, y1, top, x0, y0, top], v * 3);
        v += 4;
        indices.set([base, base + 1, base + 2, base, base + 2, base + 3], t);
        t += 6;
      }
      const roof = v;
      for (const [cx, cy] of corners) {
        positions.set([cx, cy, top], v * 3);
        v += 1;
      }
      indices.set([roof, roof + 1, roof + 2, roof, roof + 2, roof + 3], t);
      t += 6;
    }
  }

  return {
    positions,
    indices,
    vertexCount: v,
    triangleCount: t / 3,
    level,
    drawn,
    dropped: batch.count - drawn,
    measured,
  };
}

/**
 * Every batch at one level. The convenience the tests and Blender use; the
 * viewer builds a batch at a time, so that the far half of the city is never
 * held at its near level.
 */
export function cityMeshes(
  data: ArrayLike<number>,
  batches: readonly CityBatch[],
  level: CityLevel,
  options: CityMeshOptions,
): CityMesh[] {
  return batches.map((batch) => cityBatchMesh(data, batch, level, options));
}
