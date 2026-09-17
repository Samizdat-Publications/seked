/**
 * Buffers for three, built from @seked/geometry in the browser. The viewer
 * does not load the Blender export: it generates the same vertices from the
 * same function, so what you orbit is the measurement database and not a
 * snapshot of it.
 */
import { pyramidMesh, steppedPyramidMesh, type Mesh, type PyramidMeshOptions, type SteppedPyramidOptions } from '@seked/geometry';
import { BufferAttribute, BufferGeometry } from 'three';

/** Flat-shaded, because a pyramid's faces are flat and share their base ring. */
export function meshGeometry(mesh: Mesh): BufferGeometry {
  const indexed = new BufferGeometry();
  indexed.setAttribute('position', new BufferAttribute(mesh.positions, 3));
  indexed.setIndex(new BufferAttribute(mesh.indices, 1));
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export interface PyramidGeometryOptions extends PyramidMeshOptions {
  /**
   * Draw only the part above this height above the base, which is how a cap
   * of surviving casing is cut off a whole pyramid. A pyramid is a linear
   * taper, so what stands above a level is itself a pyramid: the base shrinks
   * by the same fraction the height does, and so does the concavity, which is
   * an indent of the base ring. A value outside the pyramid leaves it whole.
   */
  fromHeight?: number;
}

export function pyramidGeometry(options: PyramidGeometryOptions): BufferGeometry {
  return meshGeometry(pyramidPart(options));
}

/**
 * The mesh `pyramidGeometry` draws, before it becomes a buffer: the whole
 * pyramid, or the frustum-shaped part of it above `fromHeight`, standing at
 * the same place on the same faces as the whole one.
 */
export function pyramidPart(options: PyramidGeometryOptions): Mesh {
  const { fromHeight, ...whole } = options;
  if (fromHeight === undefined || !(fromHeight > 0) || !(fromHeight < whole.height)) return pyramidMesh(whole);
  const k = (whole.height - fromHeight) / whole.height;
  const part = pyramidMesh({
    base: whole.base * k,
    height: whole.height - fromHeight,
    concavity: (whole.concavity ?? 0) * k,
    truncateAt: whole.truncateAt === undefined ? undefined : whole.truncateAt - fromHeight,
  });
  const positions = Float32Array.from(part.positions);
  for (let i = 2; i < positions.length; i += 3) positions[i] = (positions[i] as number) + fromHeight;
  return { ...part, positions };
}

/**
 * The pyramid as it stands, one square slab per course. Flat-shaded like the
 * smooth pyramid, and for the same reason: every wall and every step's ledge
 * is a flat face, and smoothing the normals across a step would round off the
 * only thing this mesh is here to show.
 */
export function steppedPyramidGeometry(options: SteppedPyramidOptions): BufferGeometry {
  return meshGeometry(steppedPyramidMesh(options));
}

/**
 * An indexed buffer geometry, keeping the mesh's own vertices. The plateau
 * grids are 90,601 samples each and share their cells with their neighbours,
 * so un-indexing them to get flat shading would cost six times the memory for
 * no gain; the normals are smoothed instead.
 */
export function gridGeometry(mesh: Mesh): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(mesh.positions, 3));
  geometry.setIndex(new BufferAttribute(mesh.indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** A line loop or open polyline as a position buffer, for the north arrow's glyph. */
export function lineGeometry(points: number[][]): BufferGeometry {
  const positions = new Float32Array(points.length * 3);
  points.forEach((p, i) => positions.set([p[0] as number, p[1] as number, p[2] as number], i * 3));
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  return geometry;
}

/**
 * A polyline as the pairs `lineSegments` wants: every interior point twice.
 * `close` joins the last point back to the first, which is how the horizon
 * ring and the compass rose are drawn.
 */
export function polylineGeometry(points: number[][], close = false): BufferGeometry {
  const pairs: number[][] = [];
  const last = close ? points.length : points.length - 1;
  for (let i = 0; i < last; i++) {
    pairs.push(points[i] as number[], points[(i + 1) % points.length] as number[]);
  }
  return lineGeometry(pairs);
}

/** A horizontal ring of `segments` sides at radius `r` and height `z`, in the data frame. */
export function ringPoints(r: number, z = 0, segments = 180): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    out.push([r * Math.sin(a), r * Math.cos(a), z]);
  }
  return out;
}
