import { DEG } from '@seked/units';

export interface PyramidProfileInput {
  /** Base side length, metres. */
  base: number;
  /** Original height to the apex, metres. */
  height: number;
}

/** Every derived number of a square pyramid, computed rather than stored. */
export interface PyramidProfile extends PyramidProfileInput {
  half: number;
  perimeter: number;
  baseArea: number;
  /** Slant height from the base centre of a face to the apex. */
  apothem: number;
  faceAngleDeg: number;
  /** Corner edge from a base corner to the apex. */
  arrisLength: number;
  arrisAngleDeg: number;
  volume: number;
  faceArea: number;
  lateralArea: number;
}

export function squarePyramid({ base, height }: PyramidProfileInput): PyramidProfile {
  const half = base / 2;
  const apothem = Math.hypot(half, height);
  const arrisLength = Math.hypot(half * Math.SQRT2, height);
  return {
    base,
    height,
    half,
    perimeter: 4 * base,
    baseArea: base * base,
    apothem,
    faceAngleDeg: Math.atan2(height, half) / DEG,
    arrisLength,
    arrisAngleDeg: Math.atan2(height, half * Math.SQRT2) / DEG,
    volume: (base * base * height) / 3,
    faceArea: (base * apothem) / 2,
    lateralArea: 2 * base * apothem,
  };
}

/** Volume of the pyramid below a horizontal cut at `truncateAt` metres above the base. */
export function frustumVolume(base: number, height: number, truncateAt: number): number {
  const full = (base * base * height) / 3;
  if (truncateAt >= height) return full;
  const remaining = height - truncateAt;
  const topBase = (base * remaining) / height;
  return full - (topBase * topBase * remaining) / 3;
}
