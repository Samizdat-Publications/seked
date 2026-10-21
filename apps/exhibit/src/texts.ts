/**
 * Figures drawn from what ancient texts say (data/texts/): chapter 4's king lists counted back from the first king,
 * and chapter 6's Rhind problem 56 in the scribe's steps. A text's figure is never a measurement; what follows from it
 * (a date counted back, a seked) is worked out here, from the figures and the records, never stored.
 */
import { sekedToDegrees } from '@seked/units';

export interface TextFigureIn { key: string; text: string; locus: string; value: number; unit: string; plus_x?: boolean; source: string; verified?: boolean }

const need = (texts: TextFigureIn[], key: string): TextFigureIn => {
  const f = texts.find((t) => t.key === key);
  if (!f) throw new Error(`data/texts lacks ${key}`);
  return f;
};

/** One span of years before the first king, as a text gives it (or as a reader adds it up), counted back from his accession. */
export interface KingSpan { label: string; years: number; plusX: boolean; from: number; to: number; summed: boolean; source: string; locus: string; verified: boolean }
export interface KingListsData {
  /** The first king's accession, the median of its radiocarbon model, in astronomical years. */
  anchor: { king: string; year: number; source: string; verified: boolean };
  /** The epoch the chapters name, read from its claim (C5's -10499, 10,500 BCE). */
  epoch: number;
  spans: KingSpan[];
  /** Manetho's own total, in the lunar years Eusebius gives before converting them. */
  lunar: number;
  citations: Record<string, string>;
}

/**
 * The spans from data/texts/kinglists.json: the Turin list's Followers alone, its two totals added (Schwaller de
 * Lubicz's sum, not on the papyrus) and Manetho's in Eusebius's conversion, each ending at Aha's median accession.
 */
export function kingListsData(texts: TextFigureIn[], chronology: { key: string; value: number; source: string; verified?: boolean }[],
  sources: { id: string; citation: string }[], epoch: number): KingListsData {
  const aha = chronology.find((r) => r.key === 'chronology.aha.accession.median');
  if (!aha) throw new Error('chronology lacks Aha\'s median accession');
  const turin = need(texts, 'turin.followers.years'), lifetime = need(texts, 'turin.followers.lifetime.years');
  const manetho = need(texts, 'manetho.eusebius.before_kings.years'), lunar = need(texts, 'manetho.eusebius.before_kings.lunar_years');
  const span = (label: string, years: number, plusX: boolean, summed: boolean, f: TextFigureIn, locus = f.locus, verified = !!f.verified): KingSpan =>
    ({ label, years, plusX, from: aha.value - years, to: aha.value, summed, source: f.source, locus, verified });
  const spans = [
    span('Turin: the spirits and Followers of Horus', turin.value, !!turin.plus_x, false, turin),
    span("Turin: both lines added (Schwaller's sum)", turin.value + lifetime.value, !!turin.plus_x || !!lifetime.plus_x, true, turin,
      `${turin.locus}, and line 9`, !!turin.verified && !!lifetime.verified),
    span('Manetho, as Eusebius converts it', manetho.value, !!manetho.plus_x, false, manetho),
  ];
  const citations: Record<string, string> = {};
  for (const id of new Set([aha.source, ...spans.map((s) => s.source)])) {
    const c = sources.find((s) => s.id === id)?.citation;
    if (!c) throw new Error(`no source ${id}`);
    citations[id] = c;
  }
  return { anchor: { king: 'Aha', year: aha.value, source: aha.source, verified: !!aha.verified }, epoch, spans, lunar: lunar.value, citations };
}

const thousands = (n: number) => n.toLocaleString('en-GB');
/** A year before the common era with its thousands marked, as the script writes 10,500 BCE (astronomical years in). */
export const bce = (y: number) => `${thousands(1 - Math.round(y))} BCE`;

/** Each span a bar unrolled back from Aha, a "+ x" tail where the total is a minimum, and a thin line at the claims' epoch. */
export function kingListsSvg(d: KingListsData, width = 300): string {
  const lo = Math.floor(Math.min(...d.spans.map((s) => s.from)) / 5000) * 5000;
  const hi = Math.ceil(d.anchor.year / 1000) * 1000;
  const pad = 14, row = 46, top = 22, h = top + d.spans.length * row + 26;
  const X = (y: number) => pad + ((y - lo) / (hi - lo)) * (width - 2 * pad);
  const f = (x: number) => x.toFixed(1);
  // every 10,000 years (10,000 BCE is -9999), but not at the frame's edge or under the epoch's own label
  const ticks: number[] = [];
  for (let k = 1; 1 - k * 10000 >= lo; k++) {
    const t = 1 - k * 10000;
    if (X(t) > 30 && Math.abs(X(t) - X(d.epoch)) > 44) ticks.push(t);
  }
  const tail = 14, ax = X(d.anchor.year);
  return `<svg viewBox="0 0 ${width} ${h}" width="${width}" height="${h}" role="img" aria-label="The king lists' years before ${d.anchor.king}, counted back from his accession">
  <circle class="star" cx="${f(ax)}" cy="${top - 14}" r="3"/>
  <text class="here-lab halo" x="${f(ax - 7)}" y="${top - 10}" text-anchor="end">${d.anchor.king}'s accession, ${bce(d.anchor.year)}</text>
  <line class="dim" x1="${f(ax)}" y1="${top - 8}" x2="${f(ax)}" y2="${h - 20}"/>
  <line class="dim" x1="${f(X(d.epoch))}" y1="${top}" x2="${f(X(d.epoch))}" y2="${h - 20}"/>
  ${d.spans.map((s, i) => {
    const y = top + i * row + 22, x0 = X(s.from), x1 = X(s.to);
    // the words sit over the bar's old end, or back from Aha where the bar is too short to carry them
    const short = x1 - x0 < 150;
    const at = `x="${f(short ? x1 - 4 : x0)}" text-anchor="${short ? 'end' : 'start'}"`;
    return `<text class="here-lab halo" ${at} y="${y - 8}">${s.label}</text>
  <line class="${s.summed ? 'claimed' : 'wall'} draw-on" x1="${f(x1)}" y1="${y}" x2="${f(x0)}" y2="${y}" pathLength="1"/>${s.plusX ? `
  <line class="dim" x1="${f(x0)}" y1="${y}" x2="${f(Math.max(pad - 6, x0 - tail))}" y2="${y}"/>` : ''}
  <text class="lab halo" ${at} y="${y + 15}">${thousands(s.years)}${s.plusX ? ' + x' : ''} years: ${bce(s.from)}</text>`;
  }).join('\n  ')}
  <line class="dim" x1="${f(X(lo))}" y1="${h - 20}" x2="${f(X(hi))}" y2="${h - 20}"/>
  <text class="lab" x="${f(X(d.epoch))}" y="${h - 6}" text-anchor="middle">${bce(d.epoch)}</text>
  ${ticks.map((t) => `<text class="north" x="${f(X(t))}" y="${h - 6}" text-anchor="middle">${bce(t)}</text>`).join('')}
</svg>`;
}

/** A fraction as the scribes wrote it: a whole part, then distinct unit fractions, largest first (greedy). */
export function unitFractions(num: number, den: number): { whole: number; parts: number[] } {
  if (!Number.isInteger(num) || !Number.isInteger(den) || den <= 0 || num < 0) throw new Error('a fraction of whole numbers');
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const whole = Math.floor(num / den);
  let n = num - whole * den, d = den;
  const parts: number[] = [];
  while (n > 0) {
    const g = gcd(n, d); n /= g; d /= g;
    const u = Math.ceil(d / n);
    parts.push(u);
    n = n * u - d; d = d * u;
    if (parts.length > 8) throw new Error('too many parts');
  }
  return { whole, parts };
}

const fractionText = (x: { whole: number; parts: number[] }, unit: string) =>
  `${[x.whole ? String(x.whole) : '', ...x.parts.map((u) => `1/${u}`)].filter(Boolean).join(' + ')} ${unit}`;

export interface Rhind56 {
  base: number; height: number; half: number;
  /** The run for one cubit of rise, in cubits, as the scribe's unit fractions. */
  run: { whole: number; parts: number[] };
  /** The seked in palms (seven to the cubit): whole palms and unit fractions. */
  seked: { whole: number; parts: number[] };
  sekedPalms: number;
  /** The face angle that seked makes, and the one the Great Pyramid's 5 1/2 makes, in degrees. */
  angle: number; khufuSeked: number; khufuAngle: number;
  source: string; verified: boolean;
}

/** Problem 56 worked from its base and height, beside the Great Pyramid's seked (A3's target, read from the claim). */
export function rhind56(texts: TextFigureIn[], khufuSeked: number): Rhind56 {
  const b = need(texts, 'rhind.p56.base'), hgt = need(texts, 'rhind.p56.height');
  if (b.unit !== 'cubit' || hgt.unit !== 'cubit') throw new Error('problem 56 is in cubits');
  const half = b.value / 2;
  const deg = sekedToDegrees;
  return {
    base: b.value, height: hgt.value, half,
    run: unitFractions(half, hgt.value), seked: unitFractions(7 * half, hgt.value), sekedPalms: (7 * half) / hgt.value,
    angle: deg((7 * half) / hgt.value), khufuSeked, khufuAngle: deg(khufuSeked),
    source: b.source, verified: !!b.verified && !!hgt.verified,
  };
}

/** The scribe's steps, then the two slopes beneath, each a seked's palms of run against a cubit's seven of rise. */
export function rhind56Svg(r: Rhind56, width = 300): string {
  const f = (x: number) => x.toFixed(1);
  const steps = [
    `Base ${r.base}, height ${r.height} cubits.`,
    `Half the base: ${r.half}.`,
    `${r.half} over ${r.height}: ${fractionText(r.run, 'cubit')}.`,
    `Times 7 palms: a seked of ${fractionText(r.seked, 'palms')}.`,
  ];
  const s = 9, gx = 4, gy = 34 + steps.length * 20 + 7 * s, h = gy + 10;
  const tri = (seked: number, cls: string) => `<path class="${cls} draw-on"${cls === 'wall' ? ' fill="none"' : ''} d="M${f(gx)} ${gy} L${f(gx + seked * s)} ${gy} L${f(gx)} ${gy - 7 * s} Z" pathLength="1"/>`;
  const khufu = unitFractions(Math.round(r.khufuSeked * 1000), 1000);
  const lx = gx + Math.max(r.sekedPalms, r.khufuSeked) * s + 14;
  return `<svg viewBox="0 0 ${width} ${h}" width="${width}" height="${h}" role="img" aria-label="Rhind problem 56: the seked of a pyramid ${r.base} cubits wide and ${r.height} high">
  <text class="here-lab" x="0" y="12">RHIND PAPYRUS, PROBLEM 56</text>
  ${steps.map((t, i) => `<text class="lab" x="0" y="${34 + i * 20}">${i + 1}. ${t}</text>`).join('\n  ')}
  ${tri(r.khufuSeked, 'statue')}
  ${tri(r.sekedPalms, 'wall')}
  <text class="lab" x="${f(lx)}" y="${gy - 30}">Problem 56: ${f(r.angle)}&#176;</text>
  <text class="here-lab" x="${f(lx)}" y="${gy - 14}">Khufu, seked ${fractionText(khufu, 'palms')}: ${f(r.khufuAngle)}&#176;</text>
  <text class="north" x="${f(lx)}" y="${gy}">rise 1 cubit, 7 palms</text>
</svg>`;
}
