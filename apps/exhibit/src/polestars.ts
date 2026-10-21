/**
 * Spence's method (2000), computed: hang a plumb line so that Mizar and Kochab both sit on it, one above the pole and
 * one below, and call that line north. It is north only in the years when the great circle through the two stars
 * passes through the pole; before and after, precession carries the pole off it and the line strays, east or west by
 * which star is above. So a pyramid's measured turn from north reads off a year.
 *
 * Everything here is the sky package's: the two stars' mean places of date (proper motion and Vondrák precession),
 * turned into azimuths at Giza's latitude. No year and no rate is typed.
 */
import { positionAtEpoch, type StarMotion } from '@seked/sky/browser';

const D = Math.PI / 180;

/** Azimuth from north, east positive, and altitude, in degrees, for a star at hour angle `h`. */
function horizontal(decDeg: number, hDeg: number, latDeg: number): { az: number; alt: number } {
  const d = decDeg * D, h = hDeg * D, p = latDeg * D;
  const east = -Math.cos(d) * Math.sin(h);
  const north = Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.cos(h) * Math.sin(p);
  const up = Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(h) * Math.cos(p);
  return { az: Math.atan2(east, north) / D, alt: Math.asin(up) / D };
}

const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/**
 * The plumb line's azimuth in each of the two moments of the day when the stars stand one above the other in the
 * north: `upper` is when the first star is the higher (Mizar over Kochab, for Spence's pair). Degrees, east positive,
 * so a negative value is a line that falls west of north. NaN where the two never line up near north.
 */
export function plumbLine(upper: StarMotion, lower: StarMotion, epoch: number, latDeg: number): { upper: number; lower: number } {
  const a = positionAtEpoch(upper, epoch), b = positionAtEpoch(lower, epoch);
  const at = (lst: number) => {
    const p = horizontal(a.decDeg, lst - a.raDeg, latDeg), q = horizontal(b.decDeg, lst - b.raDeg, latDeg);
    return { gap: wrap(p.az - q.az), az: (p.az + q.az) / 2, upperHigher: p.alt > q.alt, near: Math.abs(p.az) < 30 && Math.abs(q.az) < 30 };
  };
  const out = { upper: NaN, lower: NaN };
  const step = 0.5;
  for (let lst = 0; lst < 360; lst += step) {
    const s = at(lst), e = at(lst + step);
    if (!s.near || !e.near || Math.sign(s.gap) === Math.sign(e.gap)) continue;
    let lo = lst, hi = lst + step;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (Math.sign(at(mid).gap) === Math.sign(s.gap)) lo = mid; else hi = mid;
    }
    const r = at((lo + hi) / 2);
    out[r.upperHigher ? 'upper' : 'lower'] = r.az;
  }
  return out;
}

export type Configuration = 'upper' | 'lower';

/** The year (astronomical numbering) in `[from, to]` where the plumb line in `config` falls `targetDeg` from north. */
export function yearFor(upper: StarMotion, lower: StarMotion, latDeg: number, config: Configuration, targetDeg: number,
  from = -3500, to = -1500): number | null {
  const f = (y: number) => plumbLine(upper, lower, y, latDeg)[config] - targetDeg;
  let lo = from, hi = to, flo = f(lo);
  if (!Number.isFinite(flo) || Math.sign(flo) === Math.sign(f(hi))) return null;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2, fm = f(mid);
    if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm; } else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface PoleReading { king: string; orientation: number; upper: number | null; lower: number | null }
export interface PoleStars {
  /** When the line is true north, the same year in either configuration. */
  aligned: number;
  /** The line's stray in each configuration, sampled across the figure's years. */
  curve: { year: number; upper: number; lower: number }[];
  /** Each pyramid's turn read off as a year in each configuration. */
  readings: PoleReading[];
  /** Radiocarbon ranges for the kings who have them, to set beside the stars' years. */
  reigns: { king: string; earliest: number; latest: number; median?: number }[];
  from: number;
  to: number;
}

/**
 * The figure's numbers: the year the pair's line is north, the curve either side, each pyramid's turn as a year by
 * the stars, and the radiocarbon accessions for the same kings. Null if the stars never line up in the window.
 */
export function poleStars(mizar: StarMotion, kochab: StarMotion, latDeg: number, needles: { king: string; orientation: number }[],
  reigns: { king: string; earliest: number; latest: number; median?: number }[]): PoleStars | null {
  const aligned = yearFor(mizar, kochab, latDeg, 'upper', 0);
  if (aligned === null) return null;
  const readings = needles.map((n) => ({ king: n.king, orientation: n.orientation,
    upper: yearFor(mizar, kochab, latDeg, 'upper', n.orientation), lower: yearFor(mizar, kochab, latDeg, 'lower', n.orientation) }));
  const kings = new Set(needles.map((n) => n.king));
  const mine = reigns.filter((r) => kings.has(r.king));
  const years = [aligned, ...readings.flatMap((r) => [r.upper, r.lower]).filter((y): y is number => y !== null),
    ...mine.flatMap((r) => [r.earliest, r.latest])];
  // the window's ends on round years as the page counts them (2650 BCE is -2649)
  const from = 1 - Math.ceil((1 - Math.min(...years)) / 50) * 50, to = 1 - Math.floor((1 - Math.max(...years)) / 50) * 50;
  const curve = [];
  for (let k = 0; k <= 40; k++) {
    const year = from + ((to - from) * k) / 40, p = plumbLine(mizar, kochab, year, latDeg);
    curve.push({ year, upper: p.upper, lower: p.lower });
  }
  return { aligned, curve, readings, reigns: mine, from, to };
}

const yearText = (y: number) => (y <= 0 ? `${1 - Math.round(y)} BCE` : `${Math.round(y)} CE`);
const minutes = (deg: number) => `${deg < 0 ? '&#8722;' : '+'}${Math.abs(deg * 60).toFixed(1)}&#8242;`;

/**
 * The plumb line's stray against the year, in arc minutes, one line for each star above (Mizar solid, Kochab dashed),
 * each pyramid's measured turn a level crossing them, and below on the same years the radiocarbon accessions.
 */
export function poleStarsSvg(p: PoleStars, width = 300): string {
  const x0 = 36, x1 = width - 16, top = 12, plot = 104, mid = top + plot / 2, row = 20;
  const span = Math.max(10, Math.ceil((Math.max(...p.readings.map((r) => Math.abs(r.orientation))) * 60 * 1.6) / 5) * 5);
  const H = top + plot + 14 + p.reigns.length * row + 18;
  const X = (y: number) => x0 + ((y - p.from) / (p.to - p.from)) * (x1 - x0);
  const Y = (deg: number) => mid - ((deg * 60) / span) * (plot / 2);
  const f = (z: number) => z.toFixed(1);
  const path = (k: 'upper' | 'lower') => p.curve.filter((c) => Number.isFinite(c[k])).map((c, i) => `${i ? 'L' : 'M'}${f(X(c.year))},${f(Y(c[k]))}`).join(' ');
  const ticks = [];
  for (let y = p.from; y <= p.to; y += 50) ticks.push(y);
  const axis = top + plot + 14 + p.reigns.length * row;
  return `<svg viewBox="0 0 ${width} ${H}" width="${width}" height="${H}" role="img" aria-label="The line through Mizar and Kochab is true north in ${yearText(p.aligned)}; ${p.readings.map((r) => `${r.king}'s turn reads ${[r.upper, r.lower].filter((y): y is number => y !== null).map(yearText).join(' or ')}`).join('; ')}">
  <defs><clipPath id="pole-plot"><rect x="${x0}" y="${top}" width="${x1 - x0}" height="${plot}"/></clipPath></defs>
  <line class="dim" x1="${x0}" y1="${mid}" x2="${x1}" y2="${mid}"/>
  <text class="north" x="${x0 - 4}" y="${mid + 3}" text-anchor="end">N</text>
  <text class="north" x="${x0 - 4}" y="${top + 8}" text-anchor="end">E</text>
  <text class="north" x="${x0 - 4}" y="${top + plot}" text-anchor="end">W</text>
  <g clip-path="url(#pole-plot)">
  <path class="wall draw-on" d="${path('upper')}" fill="none" pathLength="1"/>
  <path class="dim" d="${path('lower')}" fill="none"/>
  ${p.readings.map((r, i) => `<line class="dim" x1="${x0}" y1="${f(Y(r.orientation))}" x2="${x1}" y2="${f(Y(r.orientation))}" opacity="0.5"/>
  ${[r.upper, r.lower].map((y, j) => (y === null ? '' : `<circle class="${j ? 'here' : 'star'}" cx="${f(X(y))}" cy="${f(Y(r.orientation))}" r="${j ? 2.5 : 3.5}"/>`)).join('')}
  <text class="lab halo" x="${x0 + 4}" y="${f(Y(r.orientation) + (r.orientation < 0 && i % 2 ? 11 : -4))}">${r.king} ${minutes(r.orientation)}</text>`).join('\n  ')}
  </g>
  <line class="wall" x1="${x0 + 4}" y1="${top + plot - 17}" x2="${x0 + 16}" y2="${top + plot - 17}"/>
  <text class="here-lab" x="${x0 + 20}" y="${top + plot - 14}">Mizar above</text>
  <line class="dim" x1="${x0 + 4}" y1="${top + plot - 5}" x2="${x0 + 16}" y2="${top + plot - 5}"/>
  <text class="here-lab" x="${x0 + 20}" y="${top + plot - 2}">Kochab above</text>
  ${p.reigns.map((r, i) => {
    const y = top + plot + 14 + i * row + 10;
    return `<text class="here-lab" x="${x0 - 4}" y="${y + 3}" text-anchor="end">C14</text>
  <line class="wall" x1="${f(X(r.earliest))}" y1="${y}" x2="${f(X(r.latest))}" y2="${y}"/>
  <text class="here-lab" x="${f(X(r.latest) + 4)}" y="${y + 3}">${r.king}</text>`;
  }).join('\n  ')}
  <line class="dim" x1="${x0}" y1="${axis}" x2="${x1}" y2="${axis}"/>
  ${ticks.map((t) => `<text class="north" x="${f(X(t))}" y="${axis + 13}" text-anchor="middle">${yearText(t).replace(' BCE', '')}</text>`).join('')}
</svg>`;
}
