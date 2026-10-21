/**
 * The world's pyramids "on a line": the claim as its proponents draw it and the reply from the same arithmetic.
 *
 * The claim: a great circle runs through the sites. The fit here is the one a proponent would make at its best, the
 * circle that least-squares the sites' angular distances from it (its pole is the eigenvector of the smallest
 * eigenvalue of the sum of the sites' outer products). The reply: the same fit for as many random sites in the same
 * band of latitude, many times over, and the share of those that come as close. Angles only; turning them into
 * kilometres needs the Earth's radius, which is a record, so the caller does it.
 */

export type Vec3 = [number, number, number];
export interface Site { lat: number; lon: number }

const D = Math.PI / 180;

export function toVec({ lat, lon }: Site): Vec3 {
  const c = Math.cos(lat * D);
  return [c * Math.cos(lon * D), c * Math.sin(lon * D), Math.sin(lat * D)];
}

export function toSite([x, y, z]: Vec3): Site {
  return { lat: Math.asin(Math.max(-1, Math.min(1, z))) / D, lon: Math.atan2(y, x) / D };
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Eigenvalues and eigenvectors of a symmetric 3 by 3 matrix by Jacobi rotations, smallest value first. */
export function symmetricEigen(m: number[][]): { values: number[]; vectors: Vec3[] } {
  const a = m.map((r) => [...r]);
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 50; sweep++) {
    const off = a[0]![1]! ** 2 + a[0]![2]! ** 2 + a[1]![2]! ** 2;
    if (off < 1e-30) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]] as const) {
      if (Math.abs(a[p]![q]!) < 1e-300) continue;
      const theta = (a[q]![q]! - a[p]![p]!) / (2 * a[p]![q]!);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) {
        const akp = a[k]![p]!, akq = a[k]![q]!;
        a[k]![p] = c * akp - s * akq; a[k]![q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p]![k]!, aqk = a[q]![k]!;
        a[p]![k] = c * apk - s * aqk; a[q]![k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k]![p]!, vkq = v[k]![q]!;
        v[k]![p] = c * vkp - s * vkq; v[k]![q] = s * vkp + c * vkq;
      }
    }
  }
  return [0, 1, 2].map((i) => ({ value: a[i]![i]!, vector: [v[0]![i]!, v[1]![i]!, v[2]![i]!] as Vec3 }))
    .sort((x, y) => x.value - y.value)
    .reduce((o, e) => ({ values: [...o.values, e.value], vectors: [...o.vectors, e.vector] }), { values: [] as number[], vectors: [] as Vec3[] });
}

/** Each site's angular distance from the great circle with this pole, in degrees, positive on the pole's side. */
export function offsets(pole: Vec3, sites: Site[]): number[] {
  return sites.map((s) => Math.asin(Math.max(-1, Math.min(1, dot(pole, toVec(s))))) / D);
}

const rms = (xs: number[]) => Math.sqrt(xs.reduce((t, x) => t + x * x, 0) / xs.length);

export interface CircleFit { pole: Vec3; offsets: number[]; rms: number; worst: number }

/** The great circle that comes closest to the sites, least squares on the sphere. */
export function bestCircle(sites: Site[]): CircleFit {
  if (sites.length < 2) throw new Error('a great circle needs two sites');
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const s of sites) {
    const p = toVec(s);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i]![j]! += p[i]! * p[j]!;
  }
  let pole = symmetricEigen(m).vectors[0]!;
  // the pole in the northern hemisphere, so the same circle always has the same pole
  if (pole[2] < 0 || (pole[2] === 0 && pole[0] < 0)) pole = [-pole[0], -pole[1], -pole[2]];
  const off = offsets(pole, sites);
  return { pole, offsets: off, rms: rms(off), worst: Math.max(...off.map(Math.abs)) };
}

/** A small seeded generator (mulberry32), so the reply's random sites are the same on every page load and in tests. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A site at random in a band of latitude, evenly by area, any longitude. */
export function randomSite(rand: () => number, south: number, north: number): Site {
  const z0 = Math.sin(south * D), z1 = Math.sin(north * D);
  return { lat: Math.asin(z0 + (z1 - z0) * rand()) / D, lon: rand() * 360 - 180 };
}

export interface Chance { trials: number; asClose: number; share: number; rms: number[] }

/**
 * The reply: as many random sites as the claim has, in the band of latitude its sites span, fitted the same way, over
 * and over. `asClose` counts the trials whose best circle is no worse than the claim's (by root mean square).
 */
export function chance(sites: Site[], trials: number, seed = 1): Chance {
  const fit = bestCircle(sites);
  const south = Math.min(...sites.map((s) => s.lat)), north = Math.max(...sites.map((s) => s.lat));
  const rand = seeded(seed);
  const out: number[] = [];
  let asClose = 0;
  for (let t = 0; t < trials; t++) {
    const r = bestCircle(sites.map(() => randomSite(rand, south, north))).rms;
    out.push(r);
    if (r <= fit.rms) asClose++;
  }
  return { trials, asClose, share: asClose / trials, rms: out };
}
