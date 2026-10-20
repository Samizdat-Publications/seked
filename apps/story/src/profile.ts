/**
 * Chapter 6's draw-on profile (docs/script.md, chapter 6's beats): the Great
 * Pyramid's base walked round and laid on a circle whose radius is its height
 * (A1), and its section's Kepler triangle beside the square on its height (A2).
 * Every length is the environment's, so the figure is the dossier's pyramid;
 * the readouts are A1's and A2's own comparisons.
 */
import { evaluateClaim, type Claim, type ComparisonResult } from '@seked/claims/browser';

export interface Profile {
  /** Metres: the mean side, half of it, the original height, the apothem and the perimeter. */
  side: number;
  half: number;
  height: number;
  apothem: number;
  perimeter: number;
  /** A1's comparison (perimeter over height against 2π) and A2's two (apothem over half-base, face over height²). */
  a1: ComparisonResult;
  a2: ComparisonResult[];
}

export function profileOf(env: Record<string, number>, a1: Claim, a2: Claim): Profile {
  const get = (k: string) => {
    const v = env[k];
    if (v === undefined) throw new Error(`the environment carries no ${k}`);
    return v;
  };
  return {
    side: get('g1.base.side.mean'),
    half: get('g1.base.half'),
    height: get('g1.height.original'),
    apothem: get('g1.apothem'),
    perimeter: get('g1.base.perimeter'),
    a1: evaluateClaim(a1, env).comparisons[0]!,
    a2: evaluateClaim(a2, env).comparisons,
  };
}

/** A point `d` metres along a square's perimeter of side `side`, from its south-west corner anticlockwise, as (east, north) from its centre. */
export function alongSquare(side: number, d: number): [number, number] {
  const h = side / 2;
  const t = ((d % (4 * side)) + 4 * side) % (4 * side);
  const leg = Math.floor(t / side);
  const s = t - leg * side;
  return ([[-h + s, -h], [h, -h + s], [h - s, h], [-h, h - s]] as [number, number][])[leg]!;
}
