/**
 * Chapter 6's draw-on profile (docs/script.md, chapter 6's beats): the Great
 * Pyramid's base walked round and laid on a circle whose radius is its height
 * (A1), its section's Kepler triangle beside the square on its height (A2), the
 * same circle grown into the northern hemisphere (B1), and the base's turn
 * from true north (C1). Every length is the environment's, so the figure is the
 * dossier's pyramid; the readouts are the claims' own comparisons.
 */
import { evaluateClaim, type Claim, type ComparisonResult } from '@seked/claims/browser';

/** The chapter's four claims, in the order the row of small multiples shows them. */
export const PROFILE_CLAIMS = ['A1', 'A2', 'B1', 'C1'] as const;
export type ProfileClaim = (typeof PROFILE_CLAIMS)[number];

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
  /** B1's two (height and perimeter at 1 : 43,200 against the polar radius and the equatorial circumference). */
  b1: ComparisonResult[];
  /** C1's (the mean casing azimuth against true north, degrees; west of north is negative). */
  c1: ComparisonResult;
  /** The polar radius, metres; the scale factor B1 names. */
  polarRadius: number;
  scale: number;
  /** Each claim's title and its count of free choices, for the row. */
  claims: Record<ProfileClaim, { title: string; freeChoices: number }>;
}

/** Chapter 6's figure from the environment and the claim files; throws if a claim or a length is missing. */
export function profileOf(env: Record<string, number>, all: Claim[]): Profile {
  const claim = (id: ProfileClaim) => {
    const c = all.find((x) => x.id === id);
    if (!c) throw new Error(`no claim ${id}`);
    return c;
  };
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
    a1: evaluateClaim(claim('A1'), env).comparisons[0]!,
    a2: evaluateClaim(claim('A2'), env).comparisons,
    b1: evaluateClaim(claim('B1'), env).comparisons,
    c1: evaluateClaim(claim('C1'), env).comparisons[0]!,
    polarRadius: get('earth.radius.polar'),
    scale: Number(claim('B1').overlay?.params?.['scale'] ?? NaN),
    claims: Object.fromEntries(PROFILE_CLAIMS.map((id) => [id, { title: claim(id).title, freeChoices: claim(id).free_choices.length }])) as Profile['claims'],
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
