/**
 * Buffers for three, built from @seked/geometry in the browser. The viewer
 * does not load the Blender export: it generates the same vertices from the
 * same function, so what you orbit is the measurement database and not a
 * snapshot of it.
 */
import type { TerrainHeader } from '@seked/data/browser';
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
 * The heightfield as a grid mesh in the project frame. Heights are
 * orthometric on EGM2008, so they are dropped by the site's base elevation to
 * sit in the same frame as the monuments.
 */
export function terrainGeometry(header: TerrainHeader, heights: Float32Array, datum: number): BufferGeometry {
  const { nx, ny, x0, y0, spacing } = header;
  const positions = new Float32Array(nx * ny * 3);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v = (j * nx + i) * 3;
      positions[v] = x0 + i * spacing;
      positions[v + 1] = y0 + j * spacing;
      positions[v + 2] = (heights[j * nx + i] as number) - datum;
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
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
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
