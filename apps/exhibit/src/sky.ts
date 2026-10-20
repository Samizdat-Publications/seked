/**
 * The live sky over a panorama (chapter 2's sky leaves, and chapter 5's after them): the bright catalogue
 * precessed with Vondrák 2011 to a year and placed where it stood at the picture's own moment, so the drawn sun
 * falls on the rendered one. Directions only, so it registers with any station's camera. The bearings at the
 * horizon are a claim's own overlay (C5's `sun-ribbon`), evaluated in the same sky environment the claims engine
 * uses; nothing here is typed from a claim.
 */
import { evaluate } from '@seked/claims/browser';
import { altAz, normalizeDeg, obliquityOfDate, positionsAtEpoch, skyEnvironment, sunEnvironment, type Star } from '@seked/sky/browser';

/** The sky's year for the `today` era: the present calendar, which render/giza/sun.py's moments are written in. */
export const TODAY = 2026;
/** How long, in seconds, a leaf whose sky has a `from` takes to wind from that year to its own. */
export const SKY_RUN = 6;

/** What the build cuts out of data/ for the sky (`virtual:sky`). */
export interface SkyData {
  latitudeDeg: number;
  longitudeDeg: number;
  /** The bright catalogue to `magnitudeLimit`: id, proper name, Bayer and Flamsteed, ra, dec, proper motions, magnitude. */
  magnitudeLimit: number;
  stars: [string, string | null, string | null, number, number, number, number, number][];
  /** data/stars/named.json, for the rising keys the bearings name. */
  named: Star[];
  /** Each claim with an epoch or a sun-ribbon overlay: its epoch and its bearings as written. */
  claims: Record<string, { epoch: number | null; bearings: { label: string; azimuth: string }[] }>;
  attribution: string;
}

/** A moment as render/stations.json writes one: a day of the year in the present calendar and a local solar time. */
export interface Moment { date?: string; solar?: number }

/** A year named by a leaf: `today`, or a claim id, whose epoch it takes. */
export function epochOf(ref: string, data: SkyData): number {
  if (ref === 'today') return TODAY;
  const e = data.claims[ref]?.epoch;
  if (e === undefined || e === null) throw new Error(`the sky's year "${ref}" is neither today nor a claim with an epoch`);
  return e;
}

const D = Math.PI / 180;

/**
 * Refraction as the renderer lifts its sun (render/giza/sun.py, Saemundsson's formula, nothing below -1 degree),
 * applied to the stars as well so that everything drawn stands where the picture would show it.
 */
export function refracted(altDeg: number): number {
  if (altDeg < -1) return altDeg;
  return altDeg + 1.02 / Math.tan((altDeg + 10.3 / (altDeg + 5.11)) * D) / 60;
}

/**
 * The sun and the sidereal time at a moment, as render/giza/sun.py lights the panorama: the sun's ecliptic
 * longitude for the day from the Almanac's low-precision formula in the present calendar, the epoch's obliquity,
 * and the solar time as the hour angle. Its altitude is refracted as the renderer's is.
 */
export function sunAt(moment: Moment, epoch: number, latDeg: number): { lstDeg: number; altDeg: number; azDeg: number } {
  const [month, day] = (moment.date ?? '03-20').split('-').map(Number) as [number, number];
  const n = (Date.UTC(2026, month - 1, day, 12) - Date.UTC(2000, 0, 1, 12)) / 86400000;
  const g = (357.528 + 0.9856003 * n) * D;
  const lam = (280.46 + 0.9856474 * n + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D;
  const eps = obliquityOfDate(epoch) * D;
  const raDeg = normalizeDeg(Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) / D);
  const decDeg = Math.asin(Math.sin(eps) * Math.sin(lam)) / D;
  const lstDeg = normalizeDeg(raDeg + 15 * ((moment.solar ?? 12) - 12));
  const { altDeg, azDeg } = altAz({ raDeg, decDeg, latDeg, lstDeg });
  return { lstDeg, altDeg: refracted(altDeg), azDeg };
}

export interface SkyStar { id: string; name: string | null; leo: boolean; mag: number; altDeg: number; azDeg: number }
export interface SkyView {
  epoch: number;
  sun: { altDeg: number; azDeg: number };
  stars: SkyStar[];
  bearings: { label: string; azDeg: number }[];
}

/** Whether a Bayer or Flamsteed designation (HYG's `bf`, as "32Alp Leo") puts a star in Leo. */
export const inLeo = (bf: string | null) => !!bf && /\bLeo$/.test(bf.trim());

/** The sky at a year and a moment: every catalogue star above the horizon, the sun, and a claim's bearings. */
export function skyAt(data: SkyData, epoch: number, moment: Moment, bearingsOf = 'C5'): SkyView {
  const lat = data.latitudeDeg;
  const sun = sunAt(moment, epoch, lat);
  const motions = data.stars.map(([, , , raDeg, decDeg, pmRaMasYr, pmDecMasYr]) => ({ raDeg, decDeg, pmRaMasYr, pmDecMasYr }));
  const stars: SkyStar[] = [];
  positionsAtEpoch(motions, epoch).forEach((eq, i) => {
    const [id, name, bf, , , , , mag] = data.stars[i]!;
    const h = altAz({ raDeg: eq.raDeg, decDeg: eq.decDeg, latDeg: lat, lstDeg: sun.lstDeg });
    const altDeg = refracted(h.altDeg);
    if (altDeg > -1) stars.push({ id, name, leo: inLeo(bf), mag, altDeg, azDeg: h.azDeg });
  });
  const env = { ...skyEnvironment({ epoch, latitudeDeg: lat, longitudeDeg: data.longitudeDeg, stars: data.named }), ...sunEnvironment({ epoch, latitudeDeg: lat }) };
  const bearings = (data.claims[bearingsOf]?.bearings ?? []).map((b) => ({ label: b.label, azDeg: evaluate(b.azimuth, env) }));
  return { epoch, sun, stars, bearings };
}

/** The year `t` seconds into a leaf whose sky winds from `from` to `to`, eased; `to` once the run is over. */
export function epochAt(from: number, to: number, t: number, run = SKY_RUN): number {
  const k = Math.min(1, Math.max(0, t / run));
  const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  return from + (to - from) * e;
}

/** An astronomical year as the exhibit says it: −10499 is 10,500 BCE, 2026 is 2026 CE. */
export const yearLabel = (epoch: number) => {
  const y = Math.round(epoch);
  return y <= 0 ? `${(1 - y).toLocaleString('en-GB')} BCE` : `${y} CE`;
};

/** Where a direction (altitude and azimuth, degrees) falls on screen, or null behind the viewer. */
export type SkyAt = (altDeg: number, azDeg: number) => [number, number] | null;

const STAR_IN_MS = 1400;

/**
 * Draw a sky onto the stage's ink: the stars appear brightest first over STAR_IN_MS (drawn on, not faded in), Leo's
 * in gold with its name and Regulus's; the bearings stand as ticks on the horizon; the sun is a ring. Returns
 * whether it is still drawing on.
 */
export function drawSky(ctx: CanvasRenderingContext2D, sky: SkyView, at: SkyAt, since: number, still: boolean, font: string): boolean {
  const k = still ? 1 : Math.min(1, since / STAR_IN_MS);
  const order = [...sky.stars].sort((a, b) => a.mag - b.mag);
  const shown = order.slice(0, Math.ceil(order.length * k));
  ctx.save();
  ctx.lineCap = 'round';
  for (const s of shown) {
    const p = at(s.altDeg, s.azDeg);
    if (!p) continue;
    const r = Math.max(0.7, 2.6 - 0.45 * s.mag) * (s.leo ? 1.25 : 1);
    ctx.fillStyle = s.leo ? 'rgba(255, 214, 140, 0.95)' : 'rgba(235, 240, 255, 0.78)';
    ctx.shadowColor = s.leo ? 'rgba(255, 190, 90, 0.9)' : 'rgba(180, 200, 255, 0.6)';
    ctx.shadowBlur = s.leo ? 8 : 4;
    ctx.beginPath();
    ctx.arc(p[0], p[1], r, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.font = `500 12px ${font}`;
  ctx.textBaseline = 'middle';
  const label = (text: string, p: [number, number], colour: string, dx = 9, dy = 0) => {
    ctx.fillStyle = 'rgba(10, 10, 12, 0.55)';
    const w = ctx.measureText(text).width;
    // a label that would run off the right edge stands on the other side of its point
    const x = p[0] + dx + w + 8 > (ctx.canvas.clientWidth || Infinity) ? p[0] - Math.abs(dx) - w : p[0] + dx;
    ctx.fillRect(x - 4, p[1] + dy - 9, w + 8, 18);
    ctx.fillStyle = colour;
    ctx.fillText(text, x, p[1] + dy);
  };
  if (k >= 1) {
    const leo = sky.stars.filter((s) => s.leo && s.mag < 4);
    const regulus = sky.stars.find((s) => s.name === 'Regulus');
    const rp = regulus && at(regulus.altDeg, regulus.azDeg);
    if (rp) label('Regulus', rp, 'rgba(255, 220, 160, 0.95)');
    const pts = leo.map((s) => at(s.altDeg, s.azDeg)).filter((p): p is [number, number] => !!p);
    if (pts.length >= 3) {
      const top = pts.reduce((a, b) => (b[1] < a[1] ? b : a));
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      label('Leo', [cx, top[1]], 'rgba(255, 220, 160, 0.95)', -12, -22);
    }
    // the bearings, as ticks standing on the horizon
    sky.bearings.forEach((b, i) => {
      const foot = at(0, b.azDeg), head = at(2.5 + i * 1.8, b.azDeg);
      if (!foot || !head) return;
      ctx.strokeStyle = 'rgba(255, 236, 200, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(foot[0], foot[1]);
      ctx.lineTo(head[0], head[1]);
      ctx.stroke();
      label(b.label, head, 'rgba(255, 240, 215, 0.95)', 5, -8);
    });
    const sp = at(sky.sun.altDeg, sky.sun.azDeg);
    if (sp) {
      ctx.strokeStyle = 'rgba(255, 245, 225, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sp[0], sp[1], 14, 0, 2 * Math.PI);
      ctx.stroke();
      label('the sun', sp, 'rgba(255, 245, 225, 0.95)', 19);
    }
  }
  ctx.restore();
  return k < 1;
}

