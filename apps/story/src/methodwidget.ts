/**
 * Chapter 8's beat "the way an ultrasound reads a body": the Khafre Project's method as its authors describe it,
 * a schematic (docs/script.md). A satellite's radar returns off the ground; the authors read, in the ground's
 * tiny movements, vibrations spreading through the rock below. Nothing in it is to scale but one line, the
 * claimant's own figure for how far radar reaches into rock (`g2.sar.radar.penetration.max`), drawn against the
 * pyramid's own height so the reader sees how shallow that is. The scroll sends the pulse, then the rings.
 */

const W = 140;
const H = 100;
const GROUND = 52;
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const f1 = (x: number) => x.toFixed(1);

export interface MethodWidget {
  el: HTMLElement;
  progress(p: number): void;
}

/** `reach` and `height` in metres: the claimant's radar reach and Khafre's height, from the environment. */
export function methodWidget(reach: number, height: number): MethodWidget {
  // the pyramid is drawn 30 units high; the reach line is at the same scale under the ground
  const k = 30 / height;
  const px = 92;
  const reachY = GROUND + reach * k;
  const sat: [number, number] = [18, 10];
  const hit: [number, number] = [px - 24, GROUND];
  const rings = [6, 11, 16, 21];

  const el = document.createElement('div');
  el.className = 'method';
  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="The method as its authors describe it: radar off the ground, vibrations read in the rock below">
      <text class="title" x="${W / 2}" y="7">the method as its authors describe it</text>
      <rect class="rock" x="4" y="${GROUND}" width="${W - 8}" height="${H - GROUND - 12}" />
      <line class="ground" x1="4" x2="${W - 4}" y1="${GROUND}" y2="${GROUND}" />
      <path class="pyramid" d="M${px - 23},${GROUND} L${px},${f1(GROUND - 30)} L${px + 23},${GROUND} Z" />
      <g class="sat" transform="translate(${sat[0]},${sat[1]})"><rect x="-2.2" y="-1.4" width="4.4" height="2.8" /><rect x="-7" y="-0.6" width="4" height="1.2" /><rect x="3" y="-0.6" width="4" height="1.2" /></g>
      <text class="label" x="${sat[0] + 9}" y="${sat[1] + 1}">a radar satellite</text>
      <line class="pulse down" x1="${sat[0] + 1}" y1="${sat[1] + 2}" x2="${hit[0]}" y2="${hit[1] - 0.6}" />
      <line class="pulse up" x1="${hit[0] - 1}" y1="${hit[1] - 0.6}" x2="${sat[0] - 1}" y2="${sat[1] + 2}" />
      <text class="label echo" x="${hit[0] - 42}" y="${GROUND - 2.5}">its echo, off the surface</text>
      ${rings.map((r, i) => `<path class="ring" data-i="${i}" d="M${f1(px - r * 1.6)},${GROUND} A${f1(r * 1.6)},${r} 0 0 0 ${f1(px + r * 1.6)},${GROUND}" />`).join('')}
      <text class="label rings" x="${px}" y="${GROUND + 27}" text-anchor="middle">vibrations in the rock, read in the ground’s tiny movements</text>
      <line class="reach" x1="8" x2="${f1(px - rings[rings.length - 1]! * 1.6 - 3)}" y1="${f1(reachY)}" y2="${f1(reachY)}" />
      <text class="label reach-label" x="8" y="${f1(reachY + 3.6)}"><tspan>radar’s own reach into rock,</tspan>
        <tspan x="8" dy="3">by the claimant: ${reach} m,</tspan><tspan x="8" dy="3">at the pyramid’s scale</tspan></text>
      <text class="note" x="${W / 2}" y="${H - 4}">a schematic, not to scale but for the reach</text>
    </svg>`;
  const down = el.querySelector<SVGLineElement>('.pulse.down')!;
  const up = el.querySelector<SVGLineElement>('.pulse.up')!;
  const echo = el.querySelector<SVGTextElement>('.echo')!;
  const ringEls = [...el.querySelectorAll<SVGPathElement>('.ring')];
  const ringLabel = el.querySelector<SVGTextElement>('.rings')!;
  const reachEls = [...el.querySelectorAll<SVGElement>('.reach, .reach-label')];
  const show = (e: SVGElement, a: number) => e.style.setProperty('opacity', String(clamp(a)));

  return {
    el,
    progress(p: number) {
      // the pulse goes down and comes back over the first third; the rings spread over the next; then the reach line
      show(down, p / 0.12);
      show(up, (p - 0.15) / 0.12);
      show(echo, (p - 0.2) / 0.1);
      ringEls.forEach((r, i) => show(r, (p - 0.35 - i * 0.07) / 0.08));
      show(ringLabel, (p - 0.6) / 0.1);
      reachEls.forEach((r) => show(r, (p - 0.75) / 0.1));
    },
  };
}
