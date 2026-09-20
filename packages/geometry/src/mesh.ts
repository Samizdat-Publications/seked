/**
 * Parametric pyramid mesh in the project frame: origin at the base centre,
 * +X east, +Y north, +Z up, metres. Each face is split down its centre line
 * so the concavity (the "eight-sided" hollowing) can be expressed by pulling
 * the base midpoints inward; the indent shrinks linearly to zero at the apex.
 */

export interface PyramidMeshOptions {
  base: number;
  height: number;
  /** Cut the pyramid at this height above the base (today's stripped top). */
  truncateAt?: number;
  /** Inward indent of each face's centre line at the base, metres. */
  concavity?: number;
}

export interface Mesh {
  positions: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  triangleCount: number;
  /**
   * One number per vertex, for a mesh that is several bodies merged into one
   * buffer and wants them told apart in a shader. `mergeMeshes` writes it
   * from a number per body; nothing else sets it and nothing reads it as a
   * measurement. It is absent on a mesh that is one body, which is most of
   * them.
   */
  tones?: Float32Array;
}

type V3 = [number, number, number];

function ring(half: number, indent: number, z: number): V3[] {
  // Counter-clockwise seen from above, starting at the north-east corner.
  return [
    [half, half, z],            // NE corner
    [0, half - indent, z],      // N mid
    [-half, half, z],           // NW corner
    [-half + indent, 0, z],     // W mid
    [-half, -half, z],          // SW corner
    [0, -half + indent, z],     // S mid
    [half, -half, z],           // SE corner
    [half - indent, 0, z],      // E mid
  ];
}

export function pyramidMesh(o: PyramidMeshOptions): Mesh {
  const { base, height } = o;
  const concavity = o.concavity ?? 0;
  const truncated = o.truncateAt !== undefined && o.truncateAt < height;
  const half = base / 2;

  const verts: V3[] = [];
  const tris: number[] = [];
  const push = (v: V3) => verts.push(v) - 1;

  const baseRing = ring(half, concavity, 0).map(push); // 0..7

  if (truncated) {
    const t = o.truncateAt as number;
    const k = (height - t) / height;
    const topRing = ring(half * k, concavity * k, t).map(push); // 8..15
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      const b0 = baseRing[i] as number, b1 = baseRing[j] as number;
      const t0 = topRing[i] as number, t1 = topRing[j] as number;
      tris.push(b0, b1, t1, b0, t1, t0);
    }
    const topCentre = push([0, 0, t]);
    for (let i = 0; i < 8; i++) tris.push(topCentre, topRing[i] as number, topRing[(i + 1) % 8] as number);
  } else {
    const apex = push([0, 0, height]);
    for (let i = 0; i < 8; i++) tris.push(baseRing[i] as number, baseRing[(i + 1) % 8] as number, apex);
  }

  const baseCentre = push([0, 0, 0]);
  for (let i = 0; i < 8; i++) tris.push(baseCentre, baseRing[(i + 1) % 8] as number, baseRing[i] as number);

  const positions = new Float32Array(verts.length * 3);
  verts.forEach((v, i) => positions.set(v, i * 3));
  return {
    positions,
    indices: Uint32Array.from(tris),
    vertexCount: verts.length,
    triangleCount: tris.length / 3,
  };
}

/** Signed volume of a closed mesh with outward-facing triangles (divergence theorem). */
export function meshVolume(mesh: Mesh): number {
  const p = mesh.positions;
  const ix = mesh.indices;
  let six = 0;
  for (let i = 0; i < ix.length; i += 3) {
    const a = (ix[i] as number) * 3, b = (ix[i + 1] as number) * 3, c = (ix[i + 2] as number) * 3;
    const ax = p[a] as number, ay = p[a + 1] as number, az = p[a + 2] as number;
    const bx = p[b] as number, by = p[b + 1] as number, bz = p[b + 2] as number;
    const cx = p[c] as number, cy = p[c + 1] as number, cz = p[c + 2] as number;
    six += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return six / 6;
}
