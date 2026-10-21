/**
 * The great circle of world wonders as its author draws it: Jim Alison's sites (data/places/great-circle.json), in his
 * own degrees and minutes, fitted by `bestCircle` and set beside the axis he gives. The figure is the circle cut and
 * laid straight: distance along it across, each site's distance off it up, so "on a line" can be seen at the scale the
 * claim means. Kilometres take the Earth's mean radius from its record.
 */
import doc from '../../../data/places/great-circle.json';
import { bestCircle, offsets, seeded, toVec, type CircleFit, type Site, type Vec3 } from './greatcircle';

export type Dms = [number, number, string];

/** Degrees from degrees, minutes and a hemisphere letter. */
export function dms([d, m, h]: Dms): number {
  if (!'NSEW'.includes(h)) throw new Error(`no hemisphere ${h}`);
  return (d + m / 60) * (h === 'S' || h === 'W' ? -1 : 1);
}

export interface WorldSite extends Site { id: string; name: string; milesOff: number }

export const ALISON = {
  source: doc.source,
  sites: doc.sites.map((s): WorldSite => ({ id: s.id, name: s.name, lat: dms(s.latitude as Dms), lon: dms(s.longitude as Dms), milesOff: s.miles_off })),
  axis: { lat: dms(doc.axis.latitude as Dms), lon: dms(doc.axis.longitude as Dms) } as Site,
};

const D = Math.PI / 180;
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The angle in degrees between two poles, either way up (a circle has two). */
export function poleSeparation(a: Vec3, b: Vec3): number {
  return Math.acos(Math.min(1, Math.abs(dot(a, b)))) / D;
}

export interface Strip { fit: CircleFit; along: number[]; sites: WorldSite[] }

/**
 * Each site's place along the fitted circle, in degrees from the first site eastward round the pole, so the circle can
 * be cut and laid flat. With the offsets in `fit`, that is the strip the figure draws.
 */
export function strip(sites: WorldSite[]): Strip {
  const fit = bestCircle(sites);
  const p = fit.pole;
  // two axes in the circle's plane: the first site's foot on it, and the pole crossed with that
  const v0 = toVec(sites[0]!), k = dot(p, v0);
  const e1n: Vec3 = [v0[0] - k * p[0], v0[1] - k * p[1], v0[2] - k * p[2]];
  const n1 = Math.hypot(...e1n), e1: Vec3 = [e1n[0] / n1, e1n[1] / n1, e1n[2] / n1];
  const e2: Vec3 = [p[1] * e1[2] - p[2] * e1[1], p[2] * e1[0] - p[0] * e1[2], p[0] * e1[1] - p[1] * e1[0]];
  const along = sites.map((s) => { const v = toVec(s); return ((Math.atan2(dot(v, e2), dot(v, e1)) / D) + 360) % 360; });
  return { fit, along, sites };
}

/** Each site's distance from the circle with the author's own axis as its pole, in degrees. */
export function offAuthorsAxis(): number[] {
  return offsets(toVec(ALISON.axis), ALISON.sites);
}

const f1 = (x: number) => x.toFixed(1);

/**
 * The circle laid straight down the page: one row a site, in their order round it from the first, each dot its
 * distance off the best circle (the upright line) to scale across, inside the author's "within one quarter of a
 * degree" as a band. `km` turns a degree into kilometres.
 */
export function stripSvg(s: Strip, km: number, width = 300): string {
  const pad = 10, name = 112, row = 12.5, top = 28, band = 0.25;
  const half = Math.max(0.75, Math.ceil(s.fit.worst * 4) / 4), k = (width - name - 2 * pad) / (2 * half);
  const cx = name + pad + half * k, h = top + s.sites.length * row + 26;
  const X = (o: number) => f1(cx + o * k);
  const order = s.sites.map((_, i) => i).sort((a, b) => s.along[a]! - s.along[b]!);
  const ticks = [-half, -band, band, half].filter((t, i, a) => a.indexOf(t) === i);
  return `<svg viewBox="0 0 ${width} ${h}" width="${width}" height="${h}" role="img" aria-label="Jim Alison's ${s.sites.length} sites, each at its distance off the great circle that fits them best">
  <rect x="${X(-band)}" y="${top - 6}" width="${f1(2 * band * k)}" height="${s.sites.length * row + 2}" fill="rgba(255,255,255,0.07)"/>
  <line class="wall draw-on" x1="${X(0)}" y1="${top - 6}" x2="${X(0)}" y2="${top - 4 + s.sites.length * row}" pathLength="1"/>
  <text class="north" x="${X(0)}" y="${top - 14}" text-anchor="middle">the circle</text>
  ${ticks.map((t) => `<text class="north" x="${X(t)}" y="${top + s.sites.length * row + 8}" text-anchor="${t === half ? 'end' : 'middle'}">${Math.round(Math.abs(t) * km)} km</text>`).join('')}
  ${order.map((i, j) => {
    const y = top + j * row, o = s.fit.offsets[i]!;
    return `<text class="lab" x="${name}" y="${y + 4}" text-anchor="end">${s.sites[i]!.name}</text><line class="dim" x1="${X(0)}" y1="${y}" x2="${X(o)}" y2="${y}"/><circle class="star" cx="${X(o)}" cy="${y}" r="3"/>`;
  }).join('\n  ')}
  <text class="north" x="${pad}" y="${h - 4}">in order round the Earth</text>
</svg>`;
}

/** How many of `pool` lie within `tol` degrees of the great circle with this pole. */
export function within(pole: Vec3, pool: Vec3[], tol: number): number {
  const s = Math.sin(tol * D);
  let n = 0;
  for (const v of pool) if (Math.abs(dot(pole, v)) <= s) n++;
  return n;
}

export interface PoolReply { tol: number; claim: number; counts: number[]; mean: number; share: number; best: number }

/**
 * The reply with a pool: how many of a list of comparable sites (the World Heritage List's cultural properties) the
 * claim's circle passes within `tol` of, against as many great circles with their poles at random, evenly over the
 * sphere, from a seeded generator. `share` is the part of the random circles that pass as many or more.
 */
export function poolReply(pole: Vec3, pool: Site[], tol: number, trials: number, seed = 1): PoolReply {
  const vs = pool.map(toVec), rand = seeded(seed);
  const claim = within(pole, vs, tol);
  const counts: number[] = [];
  for (let t = 0; t < trials; t++) {
    const z = 2 * rand() - 1, th = 2 * Math.PI * rand(), r = Math.sqrt(1 - z * z);
    counts.push(within([r * Math.cos(th), r * Math.sin(th), z], vs, tol));
  }
  return { tol, claim, counts, mean: counts.reduce((a, b) => a + b, 0) / trials, share: counts.filter((c) => c >= claim).length / trials, best: Math.max(...counts) };
}

/** The random circles' counts as a bar chart, the claim's circle marked among them. */
export function poolSvg(r: PoolReply, width = 300): string {
  const pad = 10, h = 96, base = h - 30, top = 20;
  const bins = new Array(r.best + 1).fill(0) as number[];
  for (const c of r.counts) bins[c]!++;
  const peak = Math.max(...bins), bw = (width - 2 * pad) / bins.length;
  const X = (n: number) => pad + n * bw;
  return `<svg viewBox="0 0 ${width} ${h}" width="${width}" height="${h}" role="img" aria-label="How many World Heritage sites ${r.counts.length} random great circles pass near, with Alison's circle among them">
  ${bins.map((b, n) => b ? `<rect x="${f1(X(n) + 0.5)}" y="${f1(base - (b / peak) * (base - top))}" width="${f1(Math.max(1, bw - 1))}" height="${f1((b / peak) * (base - top))}" fill="${n >= r.claim ? 'rgba(255, 214, 140, 0.85)' : 'rgba(255,255,255,0.35)'}" stroke="none"/>` : '').join('')}
  <line class="wall draw-on" x1="${f1(X(r.claim) + bw / 2)}" y1="${top - 8}" x2="${f1(X(r.claim) + bw / 2)}" y2="${base}" pathLength="1"/>
  <text class="here-lab halo" x="${f1(X(r.claim) + bw / 2 + 4)}" y="${top}">Alison's circle: ${r.claim}</text>
  <text class="north" x="${f1(X(0))}" y="${base + 12}">0</text>
  <text class="north" x="${f1(X(r.best) + bw)}" y="${base + 12}" text-anchor="end">${r.best} sites</text>
  <text class="north" x="${pad}" y="${h - 4}">${r.counts.length} random circles; ${Math.round(r.share * 100)}% catch as many</text>
</svg>`;
}
