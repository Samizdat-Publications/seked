/**
 * The sky slider on the stage: the southern sky at Giza at the moment Alnitak
 * crosses the meridian, the belt drawn larger than life about Alnitak (angles
 * kept), the pyramids' G1 to G3 diagonal as a dashed ghost through it, and the
 * readouts the script names. Scrolling sets the epoch; the reader can drag it.
 */
import { formatValue, type Claim } from '@seked/claims/browser';
import { beltAt, beltOnLens, lowestTransit, NIGHT_LENS, yearLabel, type BeltReading } from './sky';
import nightUrl from './orion-sky.webp';

/** The belt spans under three degrees; drawn at this many times its size about Alnitak, so its angle can be read. */
const BELT_SCALE = 6;
const W = 160;
const H = 100;
const HORIZON = 92;
const PER_DEG = 1.1; // drawing units a degree of altitude
const EARLIEST = -13000;
const LATEST = 2026;

const dms = (deg: number) => formatValue(deg, 'deg');
/** The night render's frame in drawing units: as wide as the schematic, as tall as the lens's aspect gives. */
const NW = 100;
const NH = NW / NIGHT_LENS.aspect;

export interface SkyWidget {
  el: HTMLElement;
  /** Set the epoch from the scroll: 0 is today, 1 is the claim's epoch. */
  progress(p: number): void;
}

export function skyWidget(c4: Claim, env: Record<string, number>): SkyWidget {
  const claimEpoch = c4.epoch ?? LATEST;
  const lowest = lowestTransit(env, EARLIEST, 0, 20);
  const el = document.createElement('div');
  el.className = 'sky';
  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="The belt of Orion on the southern meridian at Giza">
      <line class="meridian" x1="${W / 2}" y1="4" x2="${W / 2}" y2="${HORIZON}" />
      ${[10, 30, 50].map((a) => `<g class="tick"><line x1="${W / 2 - 2}" x2="${W / 2 + 2}" y1="${HORIZON - a * PER_DEG}" y2="${HORIZON - a * PER_DEG}" />` +
        `<text x="${W / 2 + 3}" y="${HORIZON - a * PER_DEG + 1}">${a}°</text></g>`).join('')}
      <rect class="ground" x="0" y="${HORIZON}" width="${W}" height="${H - HORIZON}" />
      <text class="south" x="${W / 2}" y="${H - 3}">south</text>
      <line class="ghost" /><text class="ghost-label">G1–G3</text>
      <line class="belt" />
      <g class="stars"></g>
    </svg>
    <svg class="night" viewBox="0 0 ${NW} ${NH}" role="img" aria-label="The belt of Orion over the pyramids, looking south from Giza">
      <defs>
        <linearGradient id="night-sides"><stop offset="0" stop-color="#000" /><stop offset="0.12" stop-color="#fff" />
          <stop offset="0.88" stop-color="#fff" /><stop offset="1" stop-color="#000" /></linearGradient>
        <linearGradient id="night-top" x2="0" y2="1"><stop offset="0" stop-color="#000" />
          <stop offset="0.25" stop-color="#000" stop-opacity="0" /></linearGradient>
        <!-- the render's haze is faintly opaque, so its sides and top fade into the page's own sky -->
        <mask id="night-fade"><rect width="${NW}" height="${NH}" fill="url(#night-sides)" />
          <rect width="${NW}" height="${NH}" fill="url(#night-top)" /></mask>
      </defs>
      <image href="${nightUrl}" x="0" y="0" width="${NW}" height="${NH}" mask="url(#night-fade)" />
      <line class="ghost" /><text class="ghost-label">G1–G3</text>
      <line class="belt" />
      <g class="stars"></g>
      <g class="above"><text x="${NW / 2}" y="4">↑ the belt, higher than the picture</text></g>
    </svg>
    <div class="readouts">
      <div class="epoch"></div>
      <div class="transit"></div>
      <div class="angle"></div>
      <input type="range" min="${EARLIEST}" max="${LATEST}" step="1" aria-label="Epoch" />
      <div class="small"><span class="scale">The belt drawn ${BELT_SCALE} times its size about Alnitak, its angle kept.</span>
        <span class="true">The belt at its true size, through the render's own lens; the pyramids are a render of the
        site as built.</span> Alnitak crosses lowest in ${yearLabel(lowest)}; the claim's epoch is ${yearLabel(claimEpoch)}.</div>
    </div>`;
  const q = <T extends Element>(s: string) => el.querySelector<T>(s)!;
  const input = q<HTMLInputElement>('input');
  // the schematic until the night render has loaded, and for good if it cannot
  const img = new Image();
  img.onload = () => el.classList.add('night-on');
  img.src = nightUrl;

  /** The belt line, its stars and the diagonal's ghost, in one of the two figures. */
  function figure(svg: Element, pts: { id: string; x: number; y: number }[], r: BeltReading, dot: number, ends = false) {
    const f = <T extends Element>(s: string) => svg.querySelector<T>(s)!;
    // at true size the three names would overlap, so only the belt's two ends are named
    f('.stars').innerHTML = pts.map((p, i) => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${dot}" />` +
      (ends && i === 1 ? '' : `<text x="${(p.x + 2).toFixed(2)}" y="${(p.y + 0.8).toFixed(2)}">${p.id[0]!.toUpperCase()}${p.id.slice(1)}</text>`)).join('');
    const [a, , m] = pts;
    f('.belt').setAttribute('x1', a!.x.toFixed(2));
    f('.belt').setAttribute('y1', a!.y.toFixed(2));
    f('.belt').setAttribute('x2', m!.x.toFixed(2));
    f('.belt').setAttribute('y2', m!.y.toFixed(2));
    // the diagonal's ghost through the belt's middle, leaning the way the belt leans (the claim is unsigned)
    const cx = (a!.x + m!.x) / 2;
    const cy = (a!.y + m!.y) / 2;
    const len = Math.hypot(m!.x - a!.x, m!.y - a!.y) / 2;
    const lean = -Math.sign((m!.x - a!.x) * (m!.y - a!.y)) || 1; // screen y runs down
    const t = (r.diagonalDeg * Math.PI) / 180;
    const gx = Math.sin(t) * len * lean;
    const gy = -Math.cos(t) * len;
    const ghost = f('.ghost');
    ghost.setAttribute('x1', (cx - gx).toFixed(2));
    ghost.setAttribute('y1', (cy - gy).toFixed(2));
    ghost.setAttribute('x2', (cx + gx).toFixed(2));
    ghost.setAttribute('y2', (cy + gy).toFixed(2));
    // at true size the ghost's upper end is crowded by Mintaka's name, so there it is named at its lower end
    const label = f('.ghost-label');
    label.setAttribute('x', (ends ? cx - gx - 1 : cx + gx + 1).toFixed(2));
    label.setAttribute('y', (ends ? cy - gy + 2 : cy + gy).toFixed(2));
    label.setAttribute('text-anchor', ends ? 'end' : 'start');
  }

  function draw(r: BeltReading) {
    const alnitak = r.stars[0]!;
    const ax = W / 2;
    const ay = HORIZON - alnitak.altDeg * PER_DEG;
    const pts = r.stars.map((s) => {
      const dx = (s.azDeg - alnitak.azDeg) * Math.cos((s.altDeg * Math.PI) / 180) * BELT_SCALE * PER_DEG;
      const dy = (s.altDeg - alnitak.altDeg) * BELT_SCALE * PER_DEG;
      return { id: s.id, x: ax + dx, y: ay - dy };
    });
    figure(q('svg:not(.night)'), pts, r, 1.2);
    const night = beltOnLens(r);
    const seen = night.stars.map((s) => ({ id: s.id, x: (s.at?.x ?? 0.5) * NW, y: (s.at?.y ?? -1) * NH }));
    figure(q('svg.night'), seen, r, 0.45, true);
    q('svg.night').classList.toggle('high', seen.every((p) => p.y < 0));
    q('.epoch').textContent = yearLabel(r.epoch);
    q('.transit').textContent = `Alnitak crosses the meridian ${dms(r.transitDeg)} above the horizon`;
    q('.angle').textContent = `The belt leans ${dms(r.angleDeg)} from the meridian; the pyramids' diagonal, ${dms(r.diagonalDeg)}`;
    input.value = String(Math.round(r.epoch));
  }

  const set = (epoch: number) => draw(beltAt(c4, env, epoch));
  input.addEventListener('input', () => set(Number(input.value)));
  set(LATEST);
  let last = -1;
  return {
    el,
    progress(p) {
      const k = Math.min(1, Math.max(0, p));
      if (Math.abs(k - last) < 0.002) return;
      last = k;
      set(LATEST + k * (claimEpoch - LATEST));
    },
  };
}
