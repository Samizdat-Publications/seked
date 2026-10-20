/**
 * The sky slider on the stage: the southern sky at Giza at the moment Alnitak
 * crosses the meridian, the belt drawn larger than life about Alnitak (angles
 * kept), the pyramids' G1 to G3 diagonal as a dashed ghost through it, and the
 * readouts the script names. Scrolling sets the epoch; the reader can drag it.
 */
import { formatValue, type Claim } from '@seked/claims/browser';
import { beltAt, lowestTransit, yearLabel, type BeltReading } from './sky';

/** The belt spans under three degrees; drawn at this many times its size about Alnitak, so its angle can be read. */
const BELT_SCALE = 6;
const W = 160;
const H = 100;
const HORIZON = 92;
const PER_DEG = 1.1; // drawing units a degree of altitude
const EARLIEST = -13000;
const LATEST = 2026;

const dms = (deg: number) => formatValue(deg, 'deg');

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
    <div class="readouts">
      <div class="epoch"></div>
      <div class="transit"></div>
      <div class="angle"></div>
      <input type="range" min="${EARLIEST}" max="${LATEST}" step="1" aria-label="Epoch" />
      <div class="small">The belt drawn ${BELT_SCALE} times its size about Alnitak, its angle kept. Alnitak crosses lowest in
        ${yearLabel(lowest)}; the claim's epoch is ${yearLabel(claimEpoch)}.</div>
    </div>`;
  const q = <T extends Element>(s: string) => el.querySelector<T>(s)!;
  const input = q<HTMLInputElement>('input');

  function draw(r: BeltReading) {
    const alnitak = r.stars[0]!;
    const ax = W / 2;
    const ay = HORIZON - alnitak.altDeg * PER_DEG;
    const pts = r.stars.map((s) => {
      const dx = (s.azDeg - alnitak.azDeg) * Math.cos((s.altDeg * Math.PI) / 180) * BELT_SCALE * PER_DEG;
      const dy = (s.altDeg - alnitak.altDeg) * BELT_SCALE * PER_DEG;
      return { id: s.id, x: ax + dx, y: ay - dy };
    });
    q('.stars').innerHTML = pts.map((p) => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="1.2" />` +
      `<text x="${(p.x + 2).toFixed(2)}" y="${(p.y + 0.8).toFixed(2)}">${p.id[0]!.toUpperCase()}${p.id.slice(1)}</text>`).join('');
    const [a, , m] = pts;
    q('.belt').setAttribute('x1', a!.x.toFixed(2));
    q('.belt').setAttribute('y1', a!.y.toFixed(2));
    q('.belt').setAttribute('x2', m!.x.toFixed(2));
    q('.belt').setAttribute('y2', m!.y.toFixed(2));
    // the diagonal's ghost through the belt's middle, leaning the way the belt leans (the claim is unsigned)
    const cx = (a!.x + m!.x) / 2;
    const cy = (a!.y + m!.y) / 2;
    const len = Math.hypot(m!.x - a!.x, m!.y - a!.y) / 2;
    const lean = -Math.sign((m!.x - a!.x) * (m!.y - a!.y)) || 1; // screen y runs down
    const t = (r.diagonalDeg * Math.PI) / 180;
    const gx = Math.sin(t) * len * lean;
    const gy = -Math.cos(t) * len;
    const ghost = q('.ghost');
    ghost.setAttribute('x1', (cx - gx).toFixed(2));
    ghost.setAttribute('y1', (cy - gy).toFixed(2));
    ghost.setAttribute('x2', (cx + gx).toFixed(2));
    ghost.setAttribute('y2', (cy + gy).toFixed(2));
    const label = q('.ghost-label');
    label.setAttribute('x', (cx + gx + 1).toFixed(2));
    label.setAttribute('y', (cy + gy).toFixed(2));
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
