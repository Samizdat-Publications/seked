/**
 * Chapter 6's draw-on profile on the stage (src/profile.ts). Two figures, each
 * drawn on by the scroll through its beat:
 *
 * - `pi`: a point walks once round the base, drawing the perimeter; then the
 *   section stands inside a circle whose radius is the height, and the walked
 *   perimeter is laid round that circle. It closes it, to A1's residual.
 * - `phi`: the section is drawn and its right half, the Kepler triangle, is
 *   named (half-base, height, apothem); then one face stands beside the square
 *   on the height, the two areas A2's second comparison sets side by side.
 *
 * Both are true to scale, one scale a figure, from the environment's lengths.
 */
import { formatResidual, formatValue } from '@seked/claims/browser';
import { alongSquare, type Profile } from './profile';

const W = 160;
const H = 100;
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const f2 = (x: number) => x.toFixed(2);
const metres = (x: number) => `${Math.round(x).toLocaleString('en-GB')} m`;

export type ProfileMode = 'pi' | 'phi';

export interface ProfileWidget {
  el: HTMLElement;
  /** Which figure, and how far through its beat the reader is, 0 to 1. */
  progress(mode: ProfileMode, p: number): void;
}

export function profileWidget(g: Profile): ProfileWidget {
  // pi: the circle on the height is the tallest thing, so it sets the scale
  const s = 80 / (2 * g.height);
  const sq = { x: 38, y: 52, h: (g.side / 2) * s };
  const c = { x: 114, y: 52, r: g.height * s };
  // phi: the face, the section and the square on the height side by side on one ground line
  const t = 140 / (2.2 * g.side + g.height);
  const x0 = (W - 140) / 2;
  const ground = 78;
  const sec = { x: x0 + g.half * t, hw: g.half * t, h: g.height * t };
  const sqx = x0 + g.side * t + 0.1 * g.side * t;
  const face = { x: sqx + g.height * t + 0.1 * g.side * t + g.half * t, h: g.apothem * t };
  const top = ground - face.h - 4;         // the phi figure's frame: the face is its tallest part

  const el = document.createElement('div');
  el.className = 'profile';
  el.innerHTML = `
    <svg class="pi" viewBox="0 0 ${W} ${H}" role="img" aria-label="The Great Pyramid's perimeter laid round a circle whose radius is its height">
      <path class="walked" pathLength="${g.perimeter}" d="M${f2(sq.x - sq.h)},${f2(sq.y + sq.h)} h${f2(2 * sq.h)} v${f2(-2 * sq.h)} h${f2(-2 * sq.h)} z" />
      <circle class="walker" r="1" />
      <text class="label" x="${sq.x}" y="${f2(sq.y + sq.h + 6)}">the base, from above</text>
      <g class="stand">
        <circle class="claim" cx="${c.x}" cy="${c.y}" r="${f2(c.r)}" />
        <path class="stone" d="M${f2(c.x - g.half * s)},${c.y} L${c.x},${f2(c.y - c.r)} L${f2(c.x + g.half * s)},${c.y} Z" />
        <line class="height" x1="${c.x}" y1="${c.y}" x2="${c.x}" y2="${f2(c.y - c.r)}" />
        <text class="label" x="${c.x + 1.5}" y="${f2(c.y - c.r / 2)}" text-anchor="start">height</text>
        <text class="label" x="${c.x}" y="${f2(c.y + c.r + 6)}">a circle whose radius is the height</text>
      </g>
      <path class="wrapped" pathLength="${2 * Math.PI * g.height}"
        d="M${c.x},${f2(c.y - c.r)} A${f2(c.r)} ${f2(c.r)} 0 1 1 ${c.x},${f2(c.y + c.r)} A${f2(c.r)} ${f2(c.r)} 0 1 1 ${c.x},${f2(c.y - c.r)}" />
    </svg>
    <svg class="phi" viewBox="0 ${f2(top)} ${W} ${f2(ground + 12 - top)}" role="img" aria-label="The Great Pyramid's section, its Kepler triangle, and one face beside the square on its height">
      <path class="stone section" pathLength="1" d="M${f2(sec.x - sec.hw)},${ground} L${f2(sec.x)},${f2(ground - sec.h)} L${f2(sec.x + sec.hw)},${ground} Z" />
      <g class="kepler">
        <line class="height" x1="${f2(sec.x)}" y1="${ground}" x2="${f2(sec.x)}" y2="${f2(ground - sec.h)}" />
        <line class="apothem" x1="${f2(sec.x)}" y1="${f2(ground - sec.h)}" x2="${f2(sec.x + sec.hw)}" y2="${ground}" />
        <text class="label" x="${f2(sec.x + sec.hw / 2)}" y="${ground + 4}">1</text>
        <text class="label" x="${f2(sec.x - 1.5)}" y="${f2(ground - sec.h / 2)}" text-anchor="end">√φ</text>
        <text class="label claimed" x="${f2(sec.x + sec.hw / 2 + 2)}" y="${f2(ground - sec.h / 2 - 1)}" text-anchor="start">φ</text>
        <text class="label" x="${f2(sec.x)}" y="${ground + 9}">the section through the apex</text>
      </g>
      <g class="areas">
        <rect class="square" x="${f2(sqx)}" y="${f2(ground - g.height * t)}" width="${f2(g.height * t)}" height="${f2(g.height * t)}" />
        <text class="label" x="${f2(sqx + (g.height * t) / 2)}" y="${ground + 4}">the square on the height</text>
        <path class="face" d="M${f2(face.x - g.half * t)},${ground} L${f2(face.x)},${f2(ground - face.h)} L${f2(face.x + g.half * t)},${ground} Z" />
        <text class="label" x="${f2(face.x)}" y="${ground + 9}">one face, laid flat</text>
      </g>
    </svg>
    <div class="readouts"><div class="r1"></div><div class="r2"></div><div class="r3"></div>
      <div class="small">True to scale, from the database's Great Pyramid (mean side ${formatValue(g.side, 'm')}, original height
        ${formatValue(g.height, 'm')}). The original height is not measured: the apex is gone.</div></div>`;
  const q = <T extends Element>(sel: string) => el.querySelector<T>(sel)!;
  const r = [q('.r1'), q('.r2'), q('.r3')];
  const dash = (sel: string, len: number) => q(sel).setAttribute('stroke-dasharray', `${Math.max(0, len)} 1e6`);
  let last = '';

  function pi(p: number) {
    const walk = clamp(p / 0.4);
    const stand = clamp((p - 0.4) / 0.1);
    const wrap = clamp((p - 0.5) / 0.4);
    dash('.pi .walked', g.perimeter * walk);
    const [e, n] = alongSquare(2 * sq.h, (g.perimeter * walk * s) % (8 * sq.h));
    q('.walker').setAttribute('cx', f2(sq.x + e));
    q('.walker').setAttribute('cy', f2(sq.y - n));
    q('.walker').classList.toggle('gone', walk >= 1);
    (q('.pi .stand') as SVGElement).style.opacity = String(stand);
    dash('.pi .wrapped', g.perimeter * wrap);
    r[0]!.textContent = `Once round the base: ${walk < 1 ? metres(g.perimeter * walk) : formatValue(g.perimeter, 'm')}`;
    r[1]!.textContent = stand > 0 ? `The original height: ${formatValue(g.height, 'm')}; the circle round it, ${formatValue(2 * Math.PI * g.height, 'm')}` : '';
    r[2]!.textContent = wrap >= 1 ? `Perimeter ÷ height: ${formatValue(g.a1.value, '')} against 2π, ${formatValue(g.a1.targetValue, '')}: ${formatResidual(g.a1)}` : '';
  }

  function phi(p: number) {
    const draw = clamp(p / 0.3);
    const name = clamp((p - 0.3) / 0.15);
    const areas = clamp((p - 0.6) / 0.15);
    q('.phi .section').setAttribute('stroke-dasharray', `${draw} 2`);
    (q('.phi .kepler') as SVGElement).style.opacity = String(name);
    (q('.phi .areas') as SVGElement).style.opacity = String(areas);
    const [ratio, area] = g.a2;
    r[0]!.textContent = `Half the base ${formatValue(g.half, 'm')}; the height ${formatValue(g.height, 'm')}; the apothem ${formatValue(g.apothem, 'm')}`;
    r[1]!.textContent = name >= 1 ? `Apothem ÷ half the base: ${formatValue(ratio!.value, '')} against φ, ${formatValue(ratio!.targetValue, '')}: ${formatResidual(ratio!)}` : '';
    r[2]!.textContent = areas >= 1 ? `One face ÷ the square on the height: ${formatValue(area!.value, '')} against 1: ${formatResidual(area!)}` : '';
  }

  return {
    el,
    progress(mode, p) {
      const key = `${mode}:${p.toFixed(3)}`;
      if (key === last) return;
      last = key;
      el.dataset.mode = mode;
      (mode === 'pi' ? pi : phi)(clamp(p));
    },
  };
}
