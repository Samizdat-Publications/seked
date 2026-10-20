/**
 * Chapter 7's timeline on the stage (src/timeline.ts). Two figures on one strip,
 * 15,000 to 8,000 years before 2000 CE, oldest on the left:
 *
 * - `ice`: Greenland's oxygen isotope curve drawn on by the scroll, a cursor
 *   reading the year and the value where it has got to.
 * - `dryas`: the whole curve, the Younger Dryas shaded between GICC05's
 *   boundaries, and the epochs C4 and C5 name dropped onto it.
 */
import type { Claim } from '@seked/claims/browser';
import { yearLabel } from './sky';
import { fromB2k, ICE, iceBetween, toB2k, YOUNGER_DRYAS } from './timeline';

const W = 160;
const H = 100;
const OLD = 15000;
const YOUNG = 8000;
const X0 = 12;
const X1 = 152;
const Y0 = 16;
const Y1 = 76;
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const f2 = (x: number) => x.toFixed(2);

export type TimelineMode = 'ice' | 'dryas';

export interface TimelineWidget {
  el: HTMLElement;
  progress(mode: TimelineMode, p: number): void;
}

export function timelineWidget(claims: Claim[]): TimelineWidget {
  const pts = iceBetween(OLD, YOUNG);
  const lo = Math.min(...pts.map((p) => p.d18o));
  const hi = Math.max(...pts.map((p) => p.d18o));
  const x = (b2k: number) => X0 + ((OLD - b2k) / (OLD - YOUNG)) * (X1 - X0);
  const y = (d: number) => Y1 - ((d - lo) / (hi - lo)) * (Y1 - Y0);
  const curve = pts.map((p, i) => `${i ? 'L' : 'M'}${f2(x(p.ageB2k))},${f2(y(p.d18o))}`).join(' ');
  // ticks every thousand years BCE that falls on the strip
  const ticks: number[] = [];
  for (let bce = 13000; bce >= 6000; bce -= 1000) if (toB2k(1 - bce) <= OLD && toB2k(1 - bce) >= YOUNG) ticks.push(bce);
  const { start, end } = YOUNGER_DRYAS;
  const dated = ['C4', 'C5'].map((id) => claims.find((c) => c.id === id)).filter((c): c is Claim => c?.epoch !== undefined);

  const el = document.createElement('div');
  el.className = 'timeline';
  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Greenland's ice from 15,000 to 8,000 years ago: the Younger Dryas">
      <rect class="dryas" x="${f2(x(start.age_b2k))}" y="${Y0 - 4}" width="${f2(x(end.age_b2k) - x(start.age_b2k))}" height="${Y1 - Y0 + 8}" />
      <text class="label dryas-label" x="${f2((x(start.age_b2k) + x(end.age_b2k)) / 2)}" y="${Y0 - 6}">the Younger Dryas</text>
      ${[start, end].map((e) => `<g class="bound"><line x1="${f2(x(e.age_b2k))}" x2="${f2(x(e.age_b2k))}" y1="${Y0 - 4}" y2="${Y1 + 4}" />` +
        `<text x="${f2(x(e.age_b2k))}" y="${Y1 + 15}">${yearLabel(fromB2k(e.age_b2k))}</text></g>`).join('')}
      ${ticks.map((bce) => `<g class="tick"><line x1="${f2(x(toB2k(1 - bce)))}" x2="${f2(x(toB2k(1 - bce)))}" y1="${Y1 + 4}" y2="${Y1 + 6}" />` +
        `<text x="${f2(x(toB2k(1 - bce)))}" y="${Y1 + 10}">${bce.toLocaleString('en-GB')}</text></g>`).join('')}
      <text class="label" x="${X1}" y="${Y1 + 10}" text-anchor="start" dx="1">BCE</text>
      <text class="label" x="${X0 - 2}" y="${Y0 + 2}" text-anchor="end">warmer</text>
      <text class="label" x="${X0 - 2}" y="${Y1}" text-anchor="end">colder</text>
      <clipPath id="ice-drawn"><rect class="drawn" x="${X0 - 1}" y="0" height="${H}" width="${X1 - X0 + 2}" /></clipPath>
      <path class="ice" d="${curve}" clip-path="url(#ice-drawn)" />
      <line class="cursor" y1="${Y0 - 4}" y2="${Y1 + 4}" />
      ${dated.map((c) => `<g class="epoch" data-id="${c.id}"><line x1="${f2(x(toB2k(c.epoch!)))}" x2="${f2(x(toB2k(c.epoch!)))}" y1="${Y0}" y2="${Y1}" />` +
        `<text x="${f2(x(toB2k(c.epoch!)))}" y="${c.id === 'C4' ? Y0 + 4 : Y0 + 9}">${c.id}</text></g>`).join('')}
    </svg>
    <div class="readouts"><div class="r1"></div><div class="r2"></div>
      <div class="small">NGRIP δ¹⁸O in 20-year means on the GICC05 time scale (NGRIP dating group 2006), a proxy for the air's
        temperature over Greenland; imported, not drawn. The boundaries are GICC05's, as Walker et al. (2009) date them.</div></div>`;
  const q = <T extends Element>(s: string) => el.querySelector<T>(s)!;
  const r1 = q('.r1');
  const r2 = q('.r2');
  let last = '';

  function ice(p: number) {
    const k = clamp(p / 0.85);
    const age = OLD - k * (OLD - YOUNG);
    const at = ICE.reduce((best, pt) => (Math.abs(pt.ageB2k - age) < Math.abs(best.ageB2k - age) ? pt : best));
    q('.cursor').setAttribute('x1', f2(x(at.ageB2k)));
    q('.cursor').setAttribute('x2', f2(x(at.ageB2k)));
    // the curve is drawn as far as the cursor, in time, not along its own length
    q('.drawn').setAttribute('width', f2(x(at.ageB2k) - X0 + 1));
    r1.textContent = `${yearLabel(fromB2k(at.ageB2k))}, ±${at.mce} years: δ¹⁸O ${at.d18o.toFixed(2).replace('-', '−')} ‰`;
    r2.textContent = '';
  }

  function dryas(p: number) {
    q('.drawn').setAttribute('width', f2(X1 - X0 + 2));
    const shade = clamp(p / 0.3);
    const drop = clamp((p - 0.4) / 0.3);
    for (const g of el.querySelectorAll<SVGGElement>('.dryas, .dryas-label, .bound')) g.style.opacity = String(shade);
    for (const g of el.querySelectorAll<SVGGElement>('.epoch')) {
      g.style.opacity = String(drop);
      g.style.transform = `translateY(${f2(-12 * (1 - drop))}px)`;
    }
    r1.textContent = `The Younger Dryas: ${yearLabel(fromB2k(start.age_b2k))} to ${yearLabel(fromB2k(end.age_b2k))}, ` +
      `${(start.age_b2k - end.age_b2k).toLocaleString('en-GB')} years`;
    r2.textContent = drop > 0 ? dated.map((c) => `${c.id}'s epoch, ${yearLabel(c.epoch!)}`).join(', and ') + ', inside it' : '';
  }

  return {
    el,
    progress(mode, p) {
      const key = `${mode}:${p.toFixed(3)}`;
      if (key === last) return;
      last = key;
      el.dataset.mode = mode;
      if (mode === 'ice') for (const g of el.querySelectorAll<SVGGElement>('.dryas, .dryas-label, .bound, .epoch')) g.style.opacity = '0';
      q<SVGLineElement>('.cursor').style.display = mode === 'ice' ? '' : 'none';
      (mode === 'ice' ? ice : dryas)(clamp(p));
    },
  };
}
