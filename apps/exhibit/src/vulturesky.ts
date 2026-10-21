/**
 * C8's sky, as the claim reads it: the ecliptic of its epoch laid flat around the solstice sun, the constellations
 * Sweatman and Tsikritsis pair with Pillar 43's animals (C8's overlay names them), and the star the date hangs on.
 * Flat in ecliptic longitude and latitude of date, so it depends on no observer, as the claim's comparison does not.
 */
import { obliquityOfDate, positionsAtEpoch } from '@seked/sky/browser';
import type { SkyData } from './sky';
import { bce } from './texts';

const DEG = Math.PI / 180;

/** Ecliptic longitude and latitude of date, in degrees, from right ascension and declination of date. */
export function ecliptic(raDeg: number, decDeg: number, epsDeg: number): [number, number] {
  const a = raDeg * DEG, d = decDeg * DEG, e = epsDeg * DEG;
  const lam = Math.atan2(Math.sin(a) * Math.cos(e) + Math.tan(d) * Math.sin(e), Math.cos(a)) / DEG;
  const beta = Math.asin(Math.sin(d) * Math.cos(e) - Math.cos(d) * Math.sin(e) * Math.sin(a)) / DEG;
  return [((lam % 360) + 360) % 360, beta];
}

export interface VultureChart {
  epoch: number;
  figures: { key: string; name: string; animal: string; segments: [number, number][][]; centre: [number, number] }[];
  star: { name: string; at: [number, number] };
  /** The star's longitude less the solstice sun's 90 degrees, folded: what C8 compares with zero. */
  residual: number;
}

/** The chart for a claim whose overlay names its constellations and star, from the sky's catalogue, figures and named stars. */
export function vultureChart(data: SkyData, claimId = 'C8'): VultureChart | null {
  const c = data.claims[claimId];
  if (!c?.chart || c.epoch === null) return null;
  const epoch = c.epoch, eps = obliquityOfDate(epoch);
  const byId = new Map(data.stars.map((s) => [s[0], s]));
  const figures = Object.entries(c.chart.figures).flatMap(([key, animal]) => {
    const fig = data.figures[key];
    if (!fig) return [];
    const ids = [...new Set(fig.lines.flat())].filter((id) => byId.has(id));
    const at = new Map(ids.map((id, i) => [id, i]));
    const pos = positionsAtEpoch(ids.map((id) => { const s = byId.get(id)!; return { raDeg: s[3], decDeg: s[4], pmRaMasYr: s[5], pmDecMasYr: s[6] }; }), epoch)
      .map((p) => ecliptic(p.raDeg, p.decDeg, eps));
    // a line breaks where a star is fainter than the catalogue's cut
    const segments = fig.lines.flatMap((line) => {
      const runs: [number, number][][] = [[]];
      for (const id of line) { const i = at.get(id); if (i === undefined) runs.push([]); else runs[runs.length - 1]!.push(pos[i]!); }
      return runs.filter((r) => r.length > 1);
    });
    const centre: [number, number] = [pos.reduce((t, p) => t + p[0], 0) / pos.length, pos.reduce((t, p) => t + p[1], 0) / pos.length];
    return pos.length ? [{ key, name: fig.name, animal, segments, centre }] : [];
  });
  const named = data.named.find((s) => s.id === c.chart!.star);
  if (!named) throw new Error(`no named star ${c.chart.star}`);
  const p = positionsAtEpoch([named], epoch)[0]!;
  const at = ecliptic(p.raDeg, p.decDeg, eps);
  const residual = Math.atan2(Math.sin((at[0] - 90) * DEG), Math.cos((at[0] - 90) * DEG)) / DEG;
  return { epoch, figures, star: { name: named.name, at }, residual };
}

/** Longitude rising to the left, as the sky faces a watcher looking south; the ecliptic across, the sun on it at 90. */
export function vultureChartSvg(v: VultureChart, width = 300): string {
  const all = v.figures.flatMap((f) => f.segments.flat());
  const lamLo = Math.floor(Math.min(...all.map((p) => p[0])) / 10) * 10, lamHi = Math.ceil(Math.max(...all.map((p) => p[0]), 100) / 10) * 10;
  const bLo = Math.floor(Math.min(...all.map((p) => p[1])) / 10) * 10, bHi = Math.ceil(Math.max(...all.map((p) => p[1])) / 10) * 10;
  const pad = 10, k = (width - 2 * pad) / (lamHi - lamLo), h = Math.round((bHi - bLo) * k + 2 * pad + 16);
  const X = (lam: number) => (width - pad - (lam - lamLo) * k).toFixed(1), Y = (b: number) => (pad + (bHi - b) * k).toFixed(1);
  const sun = [X(90), Y(0)];
  return `<svg viewBox="0 0 ${width} ${h}" width="${width}" height="${h}" role="img" aria-label="The sky along the ecliptic in ${bce(v.epoch)}, with the constellations read on Pillar 43">
  <line class="dim" x1="${X(lamHi)}" y1="${Y(0)}" x2="${X(lamLo)}" y2="${Y(0)}"/>
  <text class="north" x="${X(lamHi)}" y="${(Number(Y(0)) + 12).toFixed(1)}">ecliptic</text>
  ${v.figures.map((f) => {
    // a label kept inside the frame: half its longer line, at about 6.4 px a character
    const half = (Math.max(f.name.length, f.animal.length) * 6.4) / 2;
    const lx = Math.min(width - pad - half, Math.max(pad + half, Number(X(f.centre[0])))).toFixed(1);
    return `${f.segments.map((s) => `<polyline class="wall draw-on" fill="none" points="${s.map((p) => `${X(p[0])},${Y(p[1])}`).join(' ')}" pathLength="1"/>`).join('')}
  <text class="here-lab halo" x="${lx}" y="${(Number(Y(f.centre[1])) + 16).toFixed(1)}" text-anchor="middle">${f.name}</text>
  <text class="lab halo" x="${lx}" y="${(Number(Y(f.centre[1])) + 28).toFixed(1)}" text-anchor="middle">${f.animal}</text>`;
  }).join('\n  ')}
  <circle class="star" cx="${X(v.star.at[0])}" cy="${Y(v.star.at[1])}" r="3"/>
  <text class="here-lab halo" x="${(Number(X(v.star.at[0])) + 5).toFixed(1)}" y="${(Number(Y(v.star.at[1])) + 13).toFixed(1)}" text-anchor="start">${v.star.name}, the spout</text>
  <circle cx="${sun[0]}" cy="${sun[1]}" r="6" fill="rgba(255, 214, 140, 0.9)"/>
  <text class="lab halo" x="${sun[0]}" y="${(Number(sun[1]) - 10).toFixed(1)}" text-anchor="middle">solstice sun</text>
  <text class="north" x="${pad}" y="${h - 4}">${bce(v.epoch)}, along the ecliptic of date</text>
</svg>`;
}
