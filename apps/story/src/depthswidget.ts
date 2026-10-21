/**
 * Chapter 8's depth scale on the stage (src/depths.ts). On the right, the top 35 m at Giza and Hawara, where
 * everything anyone has dug or measured lies, drawn in as the scroll goes deeper; on the left, the whole scale to
 * the claim's deepest figure, true to scale, where all of that is a hairline at the top and the claimed wells and
 * what lies below them run on down. Coloured by tier, as the renders are.
 */
import { type DepthRow, type Tier } from './depths';

const W = 140;
const H = 106;
const TOP = 16;
const FOOT = 84;
const ZOOM = 35;
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const f1 = (x: number) => x.toFixed(1);
const m = (x: number) => `${x.toLocaleString('en-GB', { maximumFractionDigits: 1 })} m`;

export interface DepthsWidget {
  el: HTMLElement;
  progress(p: number): void;
}

export function depthsWidget(rows: DepthRow[], undrawn: { name: string; tier: Tier }[]): DepthsWidget {
  const deepest = Math.max(...rows.map((r) => r.bottom));
  const zy = (d: number) => TOP + (FOOT - TOP) * (d / ZOOM);
  const fy = (d: number) => TOP + (FOOT - TOP) * (d / deepest);
  const near = rows.filter((r) => r.bottom <= ZOOM).sort((a, b) => a.top - b.top);
  const far = rows.filter((r) => r.bottom > ZOOM && !r.line).sort((a, b) => a.bottom - b.bottom);
  // each far row runs on from the one above it: the wells from the ground, what lies below them from the wells' foot
  const from = far.map((_, i) => (i ? fy(far[i - 1]!.bottom) : TOP));
  const columns: Record<DepthRow['site'], number> = { Giza: 59, Hawara: 95 };

  // the near rows: a bar each in its site's column, side by side where they overlap; labels kept 4.2 apart
  const placed: string[] = [];
  const lastLabel: Record<string, number> = {};
  const slot: Record<string, number> = {};
  for (const [i, r] of near.entries()) {
    const x0 = columns[r.site];
    const y0 = zy(r.top);
    const y1 = Math.max(zy(r.bottom), y0 + 0.8);
    let label = (y0 + y1) / 2 + 1;
    label = Math.max(label, (lastLabel[r.site] ?? -Infinity) + 4.2);
    lastLabel[r.site] = label;
    const depth = r.top === r.bottom ? m(r.top) : `${r.top.toLocaleString('en-GB', { maximumFractionDigits: 1 })}–${m(r.bottom)}`;
    if (r.line) {
      placed.push(`<g class="row ${r.tier} line" data-i="${i}"><line x1="${x0 - 4}" x2="${x0 + 38}" y1="${f1(y0)}" y2="${f1(y0)}" />` +
        // its words after the first comma on a second line, so a phone's larger type keeps out of Hawara's column
        `<text x="${x0 + 9}" y="${f1(y0 - 3.6)}"><tspan>${r.label.split(', ')[0]}, ${depth}</tspan>` +
        `<tspan x="${x0 + 9}" dy="2.6">${r.label.split(', ').slice(1).join(', ')}</tspan></text></g>`);
      continue;
    }
    const k = slot[r.site] ?? 0;
    slot[r.site] = k + 1;
    const x = x0 + k * 2.2;
    placed.push(`<g class="row ${r.tier}" data-i="${i}"><rect x="${f1(x)}" y="${f1(y0)}" width="1.8" height="${f1(y1 - y0)}" />` +
      `<line class="lead" x1="${f1(x + 1.8)}" x2="${x0 + 8.5}" y1="${f1((y0 + y1) / 2)}" y2="${f1(label - 1)}" />` +
      `<text x="${x0 + 9}" y="${f1(label)}">${r.label}, ${depth}</text></g>`);
  }

  const ticks = [0, 500, 1000, 1500, 2000].filter((d) => d <= deepest);
  const zticks = [0, 10, 20, 30];
  const tierKey: Tier[] = ['excavated', 'instrumented', 'claimed'];

  const el = document.createElement('div');
  el.className = 'depths';
  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Every underground thing the chapter names on one depth scale, by tier">
      <text class="head" x="8" y="9">to ${m(deepest)}, true to scale</text>
      <text class="head" x="47" y="9">the top ${ZOOM} m</text>
      <text class="site" x="${columns.Giza}" y="${TOP - 2}">Giza</text>
      <text class="site" x="${columns.Hawara}" y="${TOP - 2}">Hawara</text>
      <g class="axis">
        <line x1="20" x2="20" y1="${TOP}" y2="${FOOT}" />
        ${ticks.map((d) => `<line x1="18.8" x2="20" y1="${f1(fy(d))}" y2="${f1(fy(d))}" /><text x="18" y="${f1(fy(d) + 1)}" text-anchor="end">${d ? m(d) : 'ground'}</text>`).join('')}
        <line x1="53" x2="53" y1="${TOP}" y2="${FOOT}" />
        ${zticks.map((d) => `<line x1="51.8" x2="53" y1="${f1(zy(d))}" y2="${f1(zy(d))}" /><text x="51" y="${f1(zy(d) + 1)}" text-anchor="end">${d ? m(d) : 'ground'}</text>`).join('')}
      </g>
      <path class="zoom" d="M23,${f1(TOP)} L47,${f1(TOP)} M23,${f1(fy(ZOOM))} L47,${f1(FOOT)}" />
      <rect class="known" x="21" y="${f1(TOP)}" width="3" height="${f1(Math.max(fy(ZOOM) - TOP, 0.5))}" />
      ${far.map((r, i) => `<rect class="far ${r.tier}" x="26" y="${f1(from[i]!)}" width="3" height="${f1(fy(r.bottom) - from[i]!)}" />` +
        `<text class="far-label" x="30.5" y="${f1(fy(r.bottom) - 1.4)}"><tspan>${r.label}</tspan><tspan x="30.5" dy="2.6">${m(r.bottom)}</tspan></text>`).join('')}
      ${placed.join('')}
      <g class="key">${tierKey.map((t, i) => `<rect class="${t}" x="${8 + i * 26}" y="${H - 15}" width="3" height="2.4" /><text x="${12 + i * 26}" y="${H - 13}">${t}</text>`).join('')}</g>
      ${undrawnLines(undrawn).map((t, i, all) => `<text class="undrawn" x="8" y="${f1(H - 3.6 - (all.length - 1 - i) * 3.4)}">${t}</text>`).join('')}
    </svg>`;
  const rowsEl = [...el.querySelectorAll<SVGGElement>('.row')];
  const farBars = [...el.querySelectorAll<SVGRectElement>('rect.far')];
  const farLabels = [...el.querySelectorAll<SVGTextElement>('text.far-label')];

  return {
    el,
    progress(p: number) {
      // the near rows come in shallowest first over the first half, then the claim runs down the whole scale
      rowsEl.forEach((g, i) => g.style.setProperty('opacity', String(clamp(p * 2 * near.length - i))));
      farBars.forEach((b, i) => {
        const r = far[i]!;
        const grow = clamp((p - 0.5 - i * 0.2) / 0.25);
        b.setAttribute('height', f1((fy(r.bottom) - from[i]!) * grow));
        farLabels[i]!.style.setProperty('opacity', String(grow >= 1 ? 1 : 0));
      });
    },
  };
}

/** "No depth in the records: ..." two names to a line, the last line on the figure's foot. */
function undrawnLines(undrawn: { name: string; tier: Tier }[]): string[] {
  if (!undrawn.length) return [];
  const names = undrawn.map((u) => `${u.name} (${u.tier})`);
  const lines: string[] = [];
  for (let i = 0; i < names.length; i += 2) lines.push(names.slice(i, i + 2).join(', ') + (i + 2 < names.length ? ',' : '.'));
  lines[0] = `No depth in the records: ${lines[0]}`;
  return lines;
}
