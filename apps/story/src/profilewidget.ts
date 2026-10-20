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
 * - `earth`: A1's circle again, now the northern hemisphere at its polar
 *   radius, with the section grown by B1's factor until its apex nears the pole.
 *   It is the same figure at a scale, which is the claim's own note.
 * - `north`: the base from above against true north, its turn (C1) drawn at
 *   true size and then exaggerated up to 120 times, the screen saying by how much.
 * - `row`: the four as small multiples, each with its residual and its count of
 *   free choices.
 *
 * All are true to scale, one scale a figure, from the environment's lengths,
 * but for the north figure's stated exaggeration.
 */
import { formatResidual, formatValue, type ComparisonResult } from '@seked/claims/browser';
import { alongSquare, PROFILE_CLAIMS, type Profile } from './profile';

const W = 160;
const H = 100;
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const f2 = (x: number) => x.toFixed(2);
const metres = (x: number) => `${Math.round(x).toLocaleString('en-GB')} m`;
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

export type ProfileMode = 'pi' | 'phi' | 'earth' | 'north' | 'row';
const FIGURES = ['pi', 'phi', 'earth', 'north'] as const;
/** C1's overlay draws the turn 120 times larger than life (data/claims/C1.yaml, `exaggeration`). */
const EXAGGERATION = 120;

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
  // earth: the hemisphere fills the frame; the pyramid grows into it
  const e = { x: W / 2, y: 88, r: 74 };
  const es = e.r / g.polarRadius;
  // north: the base from above, about the frame's middle
  const n = { x: W / 2, y: 52, h: 34 };

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
    <svg class="earth" viewBox="0 0 ${W} ${H}" role="img" aria-label="The Great Pyramid's section grown 43,200 times inside the northern hemisphere">
      <path class="claim" d="M${f2(e.x - e.r)},${e.y} A${f2(e.r)} ${f2(e.r)} 0 0 1 ${f2(e.x + e.r)},${e.y}" />
      <line class="height" x1="${f2(e.x - e.r - 2)}" y1="${e.y}" x2="${f2(e.x + e.r + 2)}" y2="${e.y}" />
      <text class="label" x="${f2(e.x + e.r - 2)}" y="${e.y + 4}" text-anchor="end">the equator</text>
      <text class="label" x="${e.x}" y="${f2(e.y - e.r - 2)}">the pole</text>
      <path class="stone grown" />
    </svg>
    <svg class="north" viewBox="0 0 ${W} ${H}" role="img" aria-label="The Great Pyramid's base from above against true north">
      <line class="height" x1="${n.x}" y1="${f2(n.y + n.h + 8)}" x2="${n.x}" y2="${f2(n.y - n.h - 10)}" />
      <text class="label" x="${n.x}" y="${f2(n.y - n.h - 12)}">true north</text>
      <g class="turned">
        <rect class="stone" x="${f2(n.x - n.h)}" y="${f2(n.y - n.h)}" width="${f2(2 * n.h)}" height="${f2(2 * n.h)}" />
        <line class="apothem" x1="${n.x}" y1="${n.y}" x2="${n.x}" y2="${f2(n.y - n.h - 8)}" />
      </g>
      <path class="claim arc" />
      <text class="label claimed turn" y="${f2(n.y - n.h - 4)}" text-anchor="end"></text>
    </svg>
    <div class="row">${FIGURES.map((m, i) => `<figure data-fig="${m}"><figcaption><b>${PROFILE_CLAIMS[i]}</b>, ${g.claims[PROFILE_CLAIMS[i]!].title}
      <span class="res"></span><span class="free"></span></figcaption></figure>`).join('')}</div>
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

  function earth(p: number) {
    const grow = clamp(p / 0.7);
    const k = g.scale * grow;
    const hw = g.half * k * es;
    const h = g.height * k * es;
    q('.earth .grown').setAttribute('d', `M${f2(e.x - hw)},${e.y} L${e.x},${f2(e.y - h)} L${f2(e.x + hw)},${e.y} Z`);
    const [radius, round] = g.b1;
    r[0]!.textContent = `Scaled up ${Math.round(k).toLocaleString('en-GB')} times: the height becomes ${formatValue(g.height * k, 'm')}`;
    r[1]!.textContent = grow >= 1 ? `${cap(radius!.label)}: ${formatValue(radius!.value, 'm')} against ${formatValue(radius!.targetValue, 'm')}, ${formatResidual(radius!)}` : '';
    r[2]!.textContent = grow >= 1 ? `${cap(round!.label)}: ${formatValue(round!.value, 'm')} against ${formatValue(round!.targetValue, 'm')}, ${formatResidual(round!)}` : '';
    q('.small').textContent = `Two free choices: the factor, and which radius and which circumference. Any factor turns A1's perimeter and height ` +
      `into a circumference and its radius; the choice of 43,200 is what fits the Earth.`;
  }

  function north(p: number) {
    const times = Math.pow(EXAGGERATION, clamp((p - 0.25) / 0.55));
    const turn = g.c1.value * times;                    // degrees, west of north negative; SVG turns clockwise
    q('.north .turned').setAttribute('transform', `rotate(${turn.toFixed(4)} ${n.x} ${n.y})`);
    const len = n.h + 8;
    const a = (turn * Math.PI) / 180;
    q('.north .arc').setAttribute('d', `M${n.x},${f2(n.y - len)} A${f2(len)} ${f2(len)} 0 0 ${turn < 0 ? 0 : 1} ${f2(n.x + len * Math.sin(a))},${f2(n.y - len * Math.cos(a))}`);
    const label = q('.north .turn');
    label.setAttribute('x', f2(n.x + len * Math.sin(a / 2) - 3));
    label.textContent = formatResidual(g.c1);
    r[0]!.textContent = times < 1.5 ? 'The turn from true north at its true size' : `The turn drawn ${Math.round(times)} times larger than life`;
    r[1]!.textContent = `${cap(g.c1.label)}: ${formatResidual(g.c1)}, ${g.c1.within ? 'inside' : 'outside'} the claim's ±${Math.round((g.c1.toleranceAbs ?? NaN) * 60)}′`;
    r[2]!.textContent = `Over a side of ${formatValue(g.side, 'm')} that is ${formatValue(g.side * Math.tan(Math.abs(g.c1.value) * Math.PI / 180), 'm')}`;
    q('.small').textContent = 'The base from above; the angle exaggerated as the line above says, the square true to scale.';
  }

  let rowBuilt = false;
  function row() {
    if (!rowBuilt) {
      // each figure at its last frame, shrunk into the row
      for (const m of FIGURES) {
        draw(m, 1);
        const mini = q(`svg.${m}`).cloneNode(true) as SVGElement;
        mini.setAttribute('class', `mini ${m}`);
        q(`.row [data-fig="${m}"]`).prepend(mini);
      }
      const res: Record<string, ComparisonResult[]> = { A1: [g.a1], A2: g.a2.slice(0, 1), B1: g.b1, C1: [g.c1] };
      PROFILE_CLAIMS.forEach((id, i) => {
        const fig = q(`.row [data-fig="${FIGURES[i]}"]`);
        fig.querySelector('.res')!.textContent = res[id]!.map((c) => formatResidual(c)).join(', ');
        const n = g.claims[id].freeChoices;
        fig.querySelector('.free')!.textContent = n ? `${n} free choice${n === 1 ? '' : 's'}` : 'no free choices';
      });
      rowBuilt = true;
    }
    const all = [[g.a1], g.a2, g.b1, [g.c1]];
    const hold = all.filter((cs) => cs.every((c) => c.within)).length;
    r[0]!.textContent = `${hold} of ${all.length} hold inside their own bands`;
    r[1]!.textContent = `Free choices: ${PROFILE_CLAIMS.filter((id) => g.claims[id].freeChoices).map((id) => `${id}, ${g.claims[id].freeChoices}`).join('; ') || 'none'}`;
    r[2]!.textContent = '';
    q('.small').textContent = small;
  }

  const small = q('.small').textContent ?? '';
  function draw(mode: ProfileMode, p: number) {
    if (mode !== 'earth' && mode !== 'north') q('.small').textContent = small;
    ({ pi, phi, earth, north, row })[mode](p);
  }

  return {
    el,
    progress(mode, p) {
      const key = `${mode}:${p.toFixed(3)}`;
      if (key === last) return;
      last = key;
      el.dataset.mode = mode;
      draw(mode, clamp(p));
    },
  };
}
