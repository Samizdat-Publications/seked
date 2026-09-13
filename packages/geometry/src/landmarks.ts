/**
 * Named points every claim overlay can reference. Same frame as the mesh:
 * origin at the base centre, +X east, +Y north, +Z up, metres.
 */
export type Point = [number, number, number];
export type Landmarks = Record<string, Point>;

export interface LandmarkOptions {
  base: number;
  height: number;
  concavity?: number;
  /** Optional prefix, e.g. "g1", producing keys like "g1.apex". */
  prefix?: string;
}

export function pyramidLandmarks({ base, height, concavity = 0, prefix }: LandmarkOptions): Landmarks {
  const h = base / 2;
  const p = prefix ? `${prefix}.` : '';
  const out: Landmarks = {
    [`${p}apex`]: [0, 0, height],
    [`${p}base.centre`]: [0, 0, 0],
    [`${p}corner.NE`]: [h, h, 0],
    [`${p}corner.NW`]: [-h, h, 0],
    [`${p}corner.SW`]: [-h, -h, 0],
    [`${p}corner.SE`]: [h, -h, 0],
    [`${p}side.mid.N`]: [0, h - concavity, 0],
    [`${p}side.mid.W`]: [-h + concavity, 0, 0],
    [`${p}side.mid.S`]: [0, -h + concavity, 0],
    [`${p}side.mid.E`]: [h - concavity, 0, 0],
  };
  // Face centroids of the flat (concavity-free) faces, one third of the way up.
  const cz = height / 3;
  const ch = (h * 2) / 3;
  out[`${p}face.centroid.N`] = [0, ch, cz];
  out[`${p}face.centroid.W`] = [-ch, 0, cz];
  out[`${p}face.centroid.S`] = [0, -ch, cz];
  out[`${p}face.centroid.E`] = [ch, 0, cz];
  return out;
}
