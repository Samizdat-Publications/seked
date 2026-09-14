/**
 * Buffers for three, built from @seked/geometry in the browser. The viewer
 * does not load the Blender export: it generates the same vertices from the
 * same function, so what you orbit is the measurement database and not a
 * snapshot of it.
 */
import { pyramidMesh, type Mesh, type PyramidMeshOptions } from '@seked/geometry';
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

export function pyramidGeometry(options: PyramidMeshOptions): BufferGeometry {
  return meshGeometry(pyramidMesh(options));
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
