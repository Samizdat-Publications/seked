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
