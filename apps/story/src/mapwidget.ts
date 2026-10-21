/**
 * Chapter 7's map inset on the stage (src/map.ts): today's coast and rivers
 * between the Nile and the Euphrates, and the scroll naming the places in the
 * narration's order. Abu Hureyra first, where the impact's authors report
 * their glass; then Göbekli Tepe; then Giza, with the distance between Giza and
 * Göbekli Tepe drawn and computed as a great circle on the mean Earth.
 */
import { BASEMAP, greatCircleKm, place, projector } from './map';

const W = 160;
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const f2 = (x: number) => x.toFixed(2);
const km = (x: number) => `${(Math.round(x / 10) * 10).toLocaleString('en-GB')} km`;

export interface MapWidget {
  el: HTMLElement;
  progress(p: number): void;
}

/** `radius` is the mean Earth's, in metres, from the environment (earth.radius.mean). */
export function mapWidget(radius: number): MapWidget {
  const { xy, height: H } = projector(W);
  const path = (line: [number, number][]) => line.map(([lon, lat], i) => `${i ? 'L' : 'M'}${xy(lon, lat).map(f2).join(',')}`).join(' ');
  const abu = place('abu-hureyra');
  const gob = place('gobekli-tepe');
  const giza = place('giza');
  const gizaGob = greatCircleKm(giza, gob, radius);
  const abuGob = greatCircleKm(abu, gob, radius);
  const at = (p: typeof abu) => xy(p.longitude, p.latitude).map(f2) as [string, string];
  // labels sit beside their dots, away from the line between Giza and Göbekli Tepe, whose own label is out at sea
  const label = (p: typeof abu, dx: number, dy: number, anchor: string) => {
    const [x, y] = at(p);
    return `<g class="place" data-id="${p.id}"><circle cx="${x}" cy="${y}" r="1.3" />` +
      `<text x="${x}" y="${y}" dx="${dx}" dy="${dy}" text-anchor="${anchor}">${p.name}</text></g>`;
  };
  const [gx, gy] = at(giza);
  const [tx, ty] = at(gob);

  const el = document.createElement('div');
  el.className = 'map';
  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${f2(H)}" role="img" aria-label="A map of the eastern Mediterranean: Abu Hureyra, Göbekli Tepe and Giza">
      ${BASEMAP.coast.map((l) => `<path class="coast" d="${path(l)}" />`).join('')}
      ${BASEMAP.rivers.map((r) => `<path class="river" d="${path(r.line)}" />`).join('')}
      <line class="span" x1="${gx}" y1="${gy}" x2="${tx}" y2="${ty}" />
      <text class="span-label" x="${f2(+gx + 0.35 * (+tx - +gx))}" y="${f2(+gy + 0.35 * (+ty - +gy))}" dx="-2" text-anchor="end">${km(gizaGob)}</text>
      ${label(abu, 0, 5, 'middle')}
      ${label(gob, 2.5, -1.5, 'start')}
      ${label(giza, -2.5, 1, 'end')}
    </svg>
    <div class="readouts"><div class="r1"></div>
      <div class="small">Today's coast and rivers, from Natural Earth (public domain). Göbekli Tepe as UNESCO's list places it,
        Abu Hureyra as an encyclopedia does (the tell is under Lake Assad), Giza at the Great Pyramid. The distance is a great
        circle on the mean Earth.</div></div>`;
  const r1 = el.querySelector<HTMLElement>('.r1')!;
  let last = '';

  return {
    el,
    progress(p) {
      const key = p.toFixed(3);
      if (key === last) return;
      last = key;
      const k = clamp(p);
      // the places come in the narration's order, each fully in a third of the way
      const shown = (from: number) => clamp((k - from) / 0.15);
      const a = shown(0);
      const g = shown(0.3);
      const z = shown(0.6);
      const set = (sel: string, o: number) => el.querySelectorAll<SVGElement>(sel).forEach((e) => (e.style.opacity = String(o)));
      set('[data-id="abu-hureyra"]', 0.35 + 0.65 * a);
      set('[data-id="gobekli-tepe"]', 0.35 + 0.65 * g);
      set('[data-id="giza"]', 0.35 + 0.65 * z);
      set('.span, .span-label', z);
      r1.textContent = z > 0 ? `Giza to Göbekli Tepe: ${km(gizaGob)}`
        : g > 0 ? `Göbekli Tepe, south-east Turkey: ${km(abuGob)} north of Abu Hureyra`
        : 'Abu Hureyra, on the Euphrates in Syria';
    },
  };
}
