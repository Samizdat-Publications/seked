/**
 * The live sky over a panorama (chapter 2's sky leaves, and chapter 5's after them): the bright catalogue
 * precessed with Vondrák 2011 to a year and placed where it stood at the picture's own moment, so the drawn sun
 * falls on the rendered one. Directions only, so it registers with any station's camera. The bearings at the
 * horizon are a claim's own overlay (C5's `sun-ribbon`), evaluated in the same sky environment the claims engine
 * uses; nothing here is typed from a claim.
 */
import { evaluate, formatValue } from '@seked/claims/browser';
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
  /** Each claim with an epoch or a sun-ribbon overlay: its epoch, its bearings and its comparisons as written. */
  claims: Record<string, { epoch: number | null; bearings: { label: string; azimuth: string }[]; comparisons: { label: string; formula: string; target: string; unit: string }[] }>;
  /** The sky bake's nights (scripts/sky-bake.ts NIGHTS): the named star each puts on the meridian. */
  nights: Record<string, string>;
  /** The figures drawn (data/stars/figures.json, Stellarium's modern sky culture): runs of catalogue ids. */
  figures: Record<string, { name: string; lines: string[][] }>;
  attribution: string;
}

/**
 * A moment as render/stations.json writes one: a day of the year in the present calendar and a local solar time,
 * or a night of the sky bake, whose meridian star is on the meridian (`stars: false`: rendered without its stars).
 */
export interface Moment { date?: string; solar?: number; night?: string; stars?: boolean }

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

/** A star as drawn; `hi` when it belongs to the constellation the leaf picks out. */
export interface SkyStar { id: string; name: string | null; hi: boolean; mag: number; altDeg: number; azDeg: number }
export interface SkyView {
  epoch: number;
  /** The constellation picked out (an IAU abbreviation, as data/stars/figures.json keys them), and its figure if imported. */
  figure: { key: string; name: string; lines: string[][] | null } | null;
  /** The sun, or null by night (below the horizon, and not drawn). */
  sun: { altDeg: number; azDeg: number } | null;
  stars: SkyStar[];
  bearings: { label: string; azDeg: number }[];
  /**
   * At a night, the meridian star: the southern meridian is drawn and the star named on it, with its true altitude
   * as the claims engine gives it (drawn where refraction lifts it, quoted as the receipts quote it).
   */
  meridian: { name: string; altDeg: number } | null;
  /** Lines a claim sets on the meridian (C2's shafts): an altitude and the side of the sky. */
  marks: { label: string; altDeg: number; azDeg: number }[];
}

/** Whether a Bayer or Flamsteed designation (HYG's `bf`, as "32Alp Leo") puts a star in a constellation. */
export const inFigure = (bf: string | null, key: string) => !!bf && new RegExp(`\\b${key}$`).test(bf.trim());
export const inLeo = (bf: string | null) => inFigure(bf, 'Leo');

/** What a leaf's sky picks out: a constellation, a claim's horizon bearings, a claim's lines on the meridian. */
export interface SkyPick { figure?: string; bearings?: string; marks?: string }

/** The sky environment (stars and sun) at a year, as the claims engine evaluates it. */
export function skyEnv(data: SkyData, epoch: number): Record<string, number> {
  const lat = data.latitudeDeg;
  return { ...skyEnvironment({ epoch, latitudeDeg: lat, longitudeDeg: data.longitudeDeg, stars: data.named }), ...sunEnvironment({ epoch, latitudeDeg: lat }) };
}

/** An expression, or null when the environment lacks something it reads (the ground, before the bundle loads). */
function tryEvaluate(src: string, env: Record<string, number>): number | null {
  try {
    const v = evaluate(src, env);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * The sidereal time of a night moment: the night's meridian star on the meridian at the sky's year, as the sky bake
 * turns its nights, so the drawn sky at the night's own epoch is the one the renderer would have drawn.
 */
export function nightLst(data: SkyData, night: string, epoch: number): { lstDeg: number; star: string; id: string } {
  const id = data.nights[night];
  const star = data.named.find((s) => s.id === id);
  if (!star) throw new Error(`the night "${night}" puts no named star on the meridian`);
  return { lstDeg: positionsAtEpoch([star], epoch)[0]!.raDeg, star: star.name, id: star.id };
}

/**
 * The sky at a year and a moment: every catalogue star above the horizon, the sun by day, the meridian star by
 * night, and what the leaf picks out. `ground` (the bundle's environment) lets a claim's lines that read the
 * monuments be drawn; without it they are left out.
 */
export function skyAt(data: SkyData, epoch: number, moment: Moment, pick: SkyPick = {}, ground: Record<string, number> = {}): SkyView {
  const lat = data.latitudeDeg;
  const night = moment.night ? nightLst(data, moment.night, epoch) : null;
  const day = night ? null : sunAt(moment, epoch, lat);
  const lstDeg = night ? night.lstDeg : day!.lstDeg;
  const key = pick.figure ?? null;
  const motions = data.stars.map(([, , , raDeg, decDeg, pmRaMasYr, pmDecMasYr]) => ({ raDeg, decDeg, pmRaMasYr, pmDecMasYr }));
  const stars: SkyStar[] = [];
  positionsAtEpoch(motions, epoch).forEach((eq, i) => {
    const [id, name, bf, , , , , mag] = data.stars[i]!;
    const h = altAz({ raDeg: eq.raDeg, decDeg: eq.decDeg, latDeg: lat, lstDeg });
    const altDeg = refracted(h.altDeg);
    if (altDeg > -1) stars.push({ id, name, hi: !!key && inFigure(bf, key), mag, altDeg, azDeg: h.azDeg });
  });
  const env = { ...ground, ...skyEnv(data, epoch) };
  const bearings = pick.bearings ? (data.claims[pick.bearings]?.bearings ?? []).map((b) => ({ label: b.label, azDeg: evaluate(b.azimuth, env) })) : [];
  const meridian = night ? { name: night.star, altDeg: env[`star.${night.id}.transit.altitude`] ?? NaN } : null;
  const marks = pick.marks ? meridianMarks(data, pick.marks, env) : [];
  const fig = key ? data.figures[key] : undefined;
  const figure = key ? { key, name: fig?.name ?? key, lines: fig?.lines ?? null } : null;
  return { epoch, figure, sun: day && { altDeg: day.altDeg, azDeg: day.azDeg }, stars, bearings, meridian, marks };
}

/**
 * A claim's lines on the meridian: each comparison of a monument's angle against a star's meridian altitude (C2's
 * shafts) gives a line at the monument's angle, on the side of the sky the star culminates. Not refracted: a shaft
 * is a line in stone, and the comparison is against the star's true altitude.
 */
export function meridianMarks(data: SkyData, claim: string, env: Record<string, number>): SkyView['marks'] {
  return (data.claims[claim]?.comparisons ?? []).flatMap((c) => {
    const star = /^star\.(\w+)\.transit\.altitude$/.exec(c.target.trim())?.[1];
    const altDeg = star ? tryEvaluate(c.formula, env) : null;
    if (!star || altDeg === null) return [];
    return [{ label: c.label.split(' against ')[0]!, altDeg, azDeg: env[`star.${star}.transit.north`] ? 0 : 180 }];
  });
}

/**
 * A claim's comparisons at a year, as the claims engine would evaluate them with the claim's epoch moved there: the
 * sky from the year, the ground from the bundle; a side that reads what the environment lacks is null.
 */
export function comparisonsAt(data: SkyData, claim: string, epoch: number, ground: Record<string, number> = {}) {
  const env = { ...ground, ...skyEnv(data, epoch) };
  return (data.claims[claim]?.comparisons ?? []).map((c) => ({ label: c.label, unit: c.unit, value: tryEvaluate(c.formula, env), target: tryEvaluate(c.target, env) }));
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

const STAR_IN_MS = 1400, LINES_MS = 1000;
const GOLD = 'rgba(255, 220, 160, 0.95)';

/**
 * Draw a sky onto the stage's ink: the stars appear brightest first over STAR_IN_MS (drawn on, not faded in), the
 * picked-out constellation's in gold with its figure, its name and its stars the claims name; by night the southern
 * meridian, the meridian star on it and a claim's lines across it; by day the bearings as ticks on the horizon and
 * the sun as a ring. `named` is the stars the claims name (data/stars/named.json). Returns whether it is still
 * drawing on.
 */
export function drawSky(ctx: CanvasRenderingContext2D, sky: SkyView, at: SkyAt, since: number, still: boolean, font: string,
  named: ReadonlySet<string> = new Set(['Regulus'])): boolean {
  const k = still ? 1 : Math.min(1, since / STAR_IN_MS);
  // the figures draw on once the stars are in
  const g = still ? 1 : Math.min(1, Math.max(0, (since - STAR_IN_MS) / LINES_MS));
  const byId = new Map(sky.stars.map((s) => [s.id, s]));
  const order = [...sky.stars].sort((a, b) => a.mag - b.mag);
  const shown = order.slice(0, Math.ceil(order.length * k));
  ctx.save();
  ctx.lineCap = 'round';
  // a line along the sky, sampled so that a stretch behind the viewer drops out rather than wrapping
  const along = (pts: [number, number][], upTo = 1) => {
    ctx.beginPath();
    let pen = false;
    const n = Math.max(1, Math.round((pts.length - 1) * upTo));
    for (const [alt, az] of pts.slice(0, n + 1)) {
      const p = at(alt, az);
      if (!p) { pen = false; continue; }
      if (pen) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
      pen = true;
    }
    ctx.stroke();
  };
  if (sky.meridian && g > 0) {
    ctx.strokeStyle = 'rgba(200, 215, 255, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 6]);
    along(Array.from({ length: 18 }, (_, i) => [i * 5, 180] as [number, number]), g);
    ctx.setLineDash([]);
  }
  if (g > 0) {
    ctx.strokeStyle = 'rgba(255, 210, 130, 0.85)';
    ctx.lineWidth = 1.7;
    for (const run of sky.figure?.lines ?? []) {
      for (let i = 1; i < run.length; i++) {
        const a = byId.get(run[i - 1]!), b = byId.get(run[i]!);
        const pa = a && at(a.altDeg, a.azDeg), pb = b && at(b.altDeg, b.azDeg);
        if (!pa || !pb) continue;
        ctx.beginPath();
        ctx.moveTo(pa[0], pa[1]);
        ctx.lineTo(pa[0] + (pb[0] - pa[0]) * g, pa[1] + (pb[1] - pa[1]) * g);
        ctx.stroke();
      }
    }
    // a claim's lines across the meridian, drawn on from the meridian outwards
    ctx.strokeStyle = 'rgba(255, 236, 200, 0.9)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 4]);
    for (const m of sky.marks) along(Array.from({ length: 13 }, (_, i) => [m.altDeg, m.azDeg - 6 * g + i * g] as [number, number]));
    ctx.setLineDash([]);
  }
  for (const s of shown) {
    const p = at(s.altDeg, s.azDeg);
    if (!p) continue;
    const r = Math.max(0.7, 2.6 - 0.45 * s.mag) * (s.hi ? 1.25 : 1);
    ctx.fillStyle = s.hi ? 'rgba(255, 214, 140, 0.95)' : 'rgba(235, 240, 255, 0.78)';
    ctx.shadowColor = s.hi ? 'rgba(255, 190, 90, 0.9)' : 'rgba(180, 200, 255, 0.6)';
    ctx.shadowBlur = s.hi ? 8 : 4;
    ctx.beginPath();
    ctx.arc(p[0], p[1], r, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  const narrow = (ctx.canvas.clientWidth || Infinity) < 600;
  ctx.font = `500 ${narrow ? 11 : 12}px ${font}`;
  ctx.textBaseline = 'middle';
  // a star's name gives way: one that would cover a label already set is left out
  const taken: [number, number, number, number][] = [];
  const label = (text: string, p: [number, number], colour: string, dx = 9, dy = 0, yields = false, before = false) => {
    const w = ctx.measureText(text).width;
    // a label that would run off its edge stands on the other side of its point; `before` sets it left of the point
    const right = ctx.canvas.clientWidth || Infinity;
    const after = p[0] + Math.abs(dx), ahead = p[0] - Math.abs(dx) - w;
    const want = before ? (ahead < 4 ? after : ahead) : (after + w + 8 > right ? ahead : p[0] + dx);
    const x = Math.max(4, Math.min(right - w - 8, want));
    const box: [number, number, number, number] = [x - 4, p[1] + dy - 9, w + 8, 18];
    if (yields && taken.some((b) => box[0] < b[0] + b[2] && b[0] < box[0] + box[2] && box[1] < b[1] + b[3] && b[1] < box[1] + box[3])) return;
    taken.push(box);
    ctx.fillStyle = 'rgba(10, 10, 12, 0.55)';
    ctx.fillRect(...box);
    ctx.fillStyle = colour;
    ctx.fillText(text, x, p[1] + dy);
  };
  if (k >= 1) {
    if (sky.meridian) {
      // named left of the line, at a height the belt passes in neither 2450 nor 10,450 BCE (a look choice)
      const foot = at(30, 180);
      if (foot) label('the meridian, due south', foot, 'rgba(210, 222, 255, 0.9)', 6, 0, false, true);
      const star = sky.stars.find((s) => s.name === sky.meridian!.name);
      const sp = star && at(star.altDeg, star.azDeg);
      // below the star, where a line across the meridian at its height does not run
      // a phone's field is wide and its labels short
      const text = narrow ? `${star!.name}, ${formatValue(sky.meridian.altDeg, 'deg')}` : `${star!.name} on the meridian, ${formatValue(sky.meridian.altDeg, 'deg')} up`;
      if (sp) label(text, sp, GOLD, 10, 18);
    }
    // a claim's lines are named at their eastern (left) end, the meridian star to its right
    sky.marks.forEach((m) => {
      const p = at(m.altDeg, m.azDeg - 6);
      const name = narrow ? m.label.replace(/ (south|north) shaft$/, '') : m.label;
      if (p) label(`${name}, ${formatValue(m.altDeg, 'deg')}`, p, 'rgba(255, 240, 215, 0.95)', 6, 0, false, true);
    });
    for (const s of sky.stars) {
      if (!s.hi || !s.name || !named.has(s.name) || s.name === sky.meridian?.name) continue;
      const p = at(s.altDeg, s.azDeg);
      if (p) label(s.name, p, GOLD, 9, 0, true);
    }
    const fig = sky.stars.filter((s) => s.hi && s.mag < 4);
    const pts = fig.map((s) => at(s.altDeg, s.azDeg)).filter((p): p is [number, number] => !!p);
    if (sky.figure && pts.length >= 3) {
      const top = pts.reduce((a, b) => (b[1] < a[1] ? b : a));
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      label(sky.figure.lines ? `${sky.figure.name}, a modern figure` : sky.figure.name, [cx, top[1]], GOLD, -12, -22, true);
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
    const sp = sky.sun && at(sky.sun.altDeg, sky.sun.azDeg);
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
  return k < 1 || g < 1;
}
