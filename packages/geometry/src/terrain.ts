/**
 * The plateau as two grids over the same samples: the surface model exactly as
 * delivered, and the ground the monuments actually stand on.
 *
 * Copernicus GLO-30 is a surface model whose editing mask marks the monument
 * footprints, so each pyramid arrives as a smooth mound and the sample at the
 * origin is neither the ground under Khufu nor the built surface of Khufu.
 * Standing a surveyed pyramid on that is wrong twice over, so `groundHeight`
 * puts the ground under each footprint at the base elevation the survey gives
 * it and blends back into the model beyond it. It is a stand-in until the GPMP
 * contours are entered, and it is deliberately crude: a square footprint
 * ignoring the few arcminutes of orientation, a flat margin, and one smoothstep.
 *
 * The same function runs in Blender through blender/seked_data.py, which a
 * parity test pins to this one, so the .blend, the GLB and the viewer cannot
 * disagree about where the ground is.
 *
 * Frame as everywhere else: +X east, +Y north, +Z up, metres, with z = 0 at the
 * Great Pyramid's base.
 */

import type { Mesh } from './mesh';

/** Metres beyond a footprint over which the ground stays at the surveyed base level. */
export const GROUND_FLAT_MARGIN = 40;

/** Metres over which that level blends back into the surface model. */
export const GROUND_BLEND_DISTANCE = 260;

/** What the ground needs to know about a pyramid: its footprint and its base. */
export interface GroundPyramid {
  /** Base side length, metres. */
  base: number;
  offsetEast: number;
  offsetNorth: number;
  /** Base elevation in the project frame, which the ground is set to. */
  offsetUp: number;
}

/**
 * The surface height at one sample with the pyramids' footprints flattened.
 *
 * Inside a footprint plus `GROUND_FLAT_MARGIN` the answer is that pyramid's
 * base level outright. Further out, the model is pulled down towards the base
 * level by a smoothstep that reaches the untouched surface at
 * `GROUND_FLAT_MARGIN + GROUND_BLEND_DISTANCE`; where two pyramids both reach a
 * sample the lower of the two wins, so no monument is left on a shelf.
 */
export function groundHeight(x: number, y: number, zSurface: number, pyramids: readonly GroundPyramid[]): number {
  let z = zSurface;
  for (const p of pyramids) {
    const d = Math.max(Math.abs(x - p.offsetEast), Math.abs(y - p.offsetNorth)) - p.base / 2;
    if (d <= GROUND_FLAT_MARGIN) return p.offsetUp;
    if (d < GROUND_FLAT_MARGIN + GROUND_BLEND_DISTANCE) {
      const t = (d - GROUND_FLAT_MARGIN) / GROUND_BLEND_DISTANCE;
      const s = t * t * (3 - 2 * t);
      z = Math.min(z, p.offsetUp + (zSurface - p.offsetUp) * s);
    }
  }
  return z;
}

/** The part of a heightfield header the grid needs; `TerrainHeader` satisfies it. */
export interface TerrainGridHeader {
  /** Samples east to west and south to north. */
  nx: number;
  ny: number;
  /** East and north coordinate of the first sample, metres from the origin. */
  x0: number;
  y0: number;
  /** Grid spacing, metres. */
  spacing: number;
}

export interface TerrainGridOptions {
  header: TerrainGridHeader;
  /** Row-major, rows south to north, columns west to east. */
  heights: ArrayLike<number>;
  /** Elevation of the frame origin above the heightfield's datum, taken off every sample. */
  datum?: number;
  /** The pyramids whose footprints the ground is flattened under. */
  pyramids?: readonly GroundPyramid[];
}

export interface TerrainGrid {
  /** The surface model as delivered, less the datum. */
  context: Mesh;
  /** The same grid with each footprint at its surveyed base level. */
  ground: Mesh;
}

/**
 * Both plateau grids from one heightfield, sharing an index buffer because
 * they share every cell. Two triangles per cell, wound counter-clockwise seen
 * from above so the surface faces up.
 */
export function terrainGrid(o: TerrainGridOptions): TerrainGrid {
  const { nx, ny, x0, y0, spacing } = o.header;
  const datum = o.datum ?? 0;
  const pyramids = o.pyramids ?? [];
  const count = nx * ny;

  const context = new Float32Array(count * 3);
  const ground = new Float32Array(count * 3);
  for (let j = 0; j < ny; j++) {
    const y = y0 + j * spacing;
    const row = j * nx;
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * spacing;
      const z = (o.heights[row + i] as number) - datum;
      const v = (row + i) * 3;
      context[v] = x;
      context[v + 1] = y;
      context[v + 2] = z;
      ground[v] = x;
      ground[v + 1] = y;
      ground[v + 2] = groundHeight(x, y, z, pyramids);
    }
  }

  const indices = new Uint32Array((nx - 1) * (ny - 1) * 6);
  let t = 0;
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      indices[t++] = a;
      indices[t++] = b;
      indices[t++] = d;
      indices[t++] = a;
      indices[t++] = d;
      indices[t++] = c;
    }
  }

  const triangleCount = indices.length / 3;
  return {
    context: { positions: context, indices, vertexCount: count, triangleCount },
    ground: { positions: ground, indices, vertexCount: count, triangleCount },
  };
}

/**
 * How far the far ring runs back under the fine grid before it stops, metres.
 *
 * A look choice. The two grids are the same Copernicus samples resampled at
 * sixty metres and at twenty, so their heights along the fine grid's own edge
 * agree to within a metre or so but not exactly, and butting them edge to edge
 * would leave a crack of sky along a straight line four kilometres from the
 * camera. Two of the far grid's cells of overlap puts the join under the fine
 * grid, which is drawn over it, and nothing about either surface is changed.
 */
export const RING_OVERLAP = 120;

export interface TerrainRingOptions {
  header: TerrainGridHeader;
  /** Row-major, rows south to north, columns west to east. */
  heights: ArrayLike<number>;
  /** Elevation of the frame origin above the heightfield's datum, taken off every sample. */
  datum?: number;
  /**
   * Half-extent of the finer grid this ring surrounds, metres. A cell wholly
   * inside it, less `RING_OVERLAP`, is left out: that is the part the fine
   * grid draws.
   */
  omitWithin: number;
  /**
   * Half-extent of the flat skirt carried out from the grid's own edge,
   * metres, or nothing for no skirt.
   *
   * A LOOK CHOICE and nothing else, and the one thing in this file that is
   * not the heightfield. Without it the world ends at the edge of the data
   * and the sky shows under the horizon in a band a reader reads as a wall;
   * with it the ground runs on at the height of the last sample it has, and
   * the air takes it the rest of the way. Nothing about the skirt is a
   * measurement of anything: it is the last measured height held, not a
   * guess at what is out there.
   */
  skirtTo?: number;
}

/**
 * The grid's boundary samples as vertex indices, counter-clockwise seen from
 * above and starting at the south-west corner. Used to hang the skirt on.
 */
function perimeter(nx: number, ny: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < nx - 1; i++) out.push(i);
  for (let j = 0; j < ny - 1; j++) out.push(j * nx + (nx - 1));
  for (let i = nx - 1; i > 0; i--) out.push((ny - 1) * nx + i);
  for (let j = ny - 1; j > 0; j--) out.push(j * nx);
  return out;
}

/**
 * The desert beyond the plateau's own grid: one coarse heightfield with its
 * middle left out, so the city, the valley and the horizon have ground under
 * them without a second copy of the plateau being drawn over the first.
 *
 * Every sample is kept as a vertex, because the index buffer is what decides
 * what is drawn and walking the grid twice to renumber the survivors would buy
 * about two megabytes and cost a page of arithmetic. No pyramid is flattened
 * here: `groundHeight`'s footprints all lie in the middle, which is the part
 * this mesh does not draw.
 */
export function terrainRing(o: TerrainRingOptions): Mesh {
  const { nx, ny, x0, y0, spacing } = o.header;
  const datum = o.datum ?? 0;
  const inner = Math.max(0, o.omitWithin - RING_OVERLAP);
  const count = nx * ny;

  const positions = new Float32Array(count * 3);
  for (let j = 0; j < ny; j++) {
    const y = y0 + j * spacing;
    const row = j * nx;
    for (let i = 0; i < nx; i++) {
      const v = (row + i) * 3;
      positions[v] = x0 + i * spacing;
      positions[v + 1] = y;
      positions[v + 2] = (o.heights[row + i] as number) - datum;
    }
  }

  const indices: number[] = [];
  for (let j = 0; j < ny - 1; j++) {
    const ySouth = y0 + j * spacing;
    const yNorth = ySouth + spacing;
    for (let i = 0; i < nx - 1; i++) {
      const xWest = x0 + i * spacing;
      const xEast = xWest + spacing;
      // The cell is dropped only when all four of its corners are inside.
      const within =
        Math.max(Math.abs(xWest), Math.abs(xEast)) <= inner && Math.max(Math.abs(ySouth), Math.abs(yNorth)) <= inner;
      if (within) continue;
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      indices.push(a, b, d, a, d, c);
    }
  }

  // The skirt: every boundary sample again, pushed straight out from the
  // origin to the skirt's own square and left at the height it already had.
  let vertices = positions;
  let vertexCount = count;
  if (o.skirtTo !== undefined && o.skirtTo > 0) {
    const edge = perimeter(nx, ny);
    vertices = new Float32Array((count + edge.length) * 3);
    vertices.set(positions);
    edge.forEach((sample, n) => {
      const from = sample * 3;
      const x = positions[from] as number;
      const y = positions[from + 1] as number;
      const reach = Math.max(Math.abs(x), Math.abs(y));
      const k = reach === 0 ? 1 : (o.skirtTo as number) / reach;
      const to = (count + n) * 3;
      vertices[to] = x * k;
      vertices[to + 1] = y * k;
      vertices[to + 2] = positions[from + 2] as number;
    });
    for (let n = 0; n < edge.length; n++) {
      const m = (n + 1) % edge.length;
      const inner = edge[n] as number;
      const innerNext = edge[m] as number;
      const outer = count + n;
      const outerNext = count + m;
      indices.push(outer, outerNext, innerNext, outer, innerNext, inner);
    }
    vertexCount = count + edge.length;
  }

  return {
    positions: vertices,
    indices: Uint32Array.from(indices),
    vertexCount,
    triangleCount: indices.length / 3,
  };
}
