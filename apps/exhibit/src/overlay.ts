/**
 * The registered overlays drawn over the panorama: lines between points in the frame, suns and labels pinned
 * to points, projected from the station camera each frame so they hold still on the stone as the view turns.
 * The lines draw themselves on and the labels come in one at a time, as the walkthrough's tour did.
 */
import type { Overlay, OverlayPoint } from './manifest';

export const GROW_MS = 1200, LABEL_STEP = 1800, LABEL_FADE = 600;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export type At = (p: OverlayPoint) => [number, number] | null;

/** How far each part of an overlay is along, `since` ms after it was first shown. */
export function overlayTiming(since: number, still: boolean) {
  if (still) return { grow: 1, glow: 1, label: (_k: number) => 1, busy: false };
  const grow = ease(clamp(since / GROW_MS, 0, 1)), glow = clamp((since - 300) / 900, 0, 1);
  const label = (k: number) => clamp((since - LABEL_STEP * k) / LABEL_FADE, 0, 1);
  return { grow, glow, label, busy: grow < 1 || glow < 1 };
}

/** Draw an overlay; returns true while something in it is still animating. */
export function drawOverlay(ctx: CanvasRenderingContext2D, o: Overlay, at: At, era: string | null, since: number, still: boolean, font: string, keepOut: readonly Rect[] = []): boolean {
  const t = overlayTiming(since, still);
  let busy = t.busy;
  ctx.lineCap = 'round';
  for (const L of o.lines) {
    const a = at(L.from);
    let b = at(L.to);
    if (!a || !b) continue;
    if (t.grow < 1) b = [a[0] + (b[0] - a[0]) * t.grow, a[1] + (b[1] - a[1]) * t.grow];
    ctx.setLineDash(L.style === 'edge' ? [] : L.style === 'faint' ? [3, 7] : [6, 6]);
    ctx.strokeStyle = L.style === 'edge' ? 'rgba(242, 181, 68, 0.95)' : L.style === 'faint' ? 'rgba(239, 232, 220, 0.6)' : 'rgba(248, 214, 140, 0.9)';
    ctx.lineWidth = L.style === 'edge' ? 2 : L.style === 'faint' ? 1.2 : 1.6;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const S of o.suns) {
    let p = at(S.at);
    if (!p || t.glow <= 0) continue;
    // a sun with a `from` sets: it slides down its own path into its place, a faint trail behind it
    const q = S.from ? at(S.from) : null;
    if (q) {
      const k = still ? 1 : clamp((since - GROW_MS) / ((S.seconds ?? 10) * 1000), 0, 1);
      if (k < 1) busy = true;
      const e = 1 - (1 - k) * (1 - k);
      const cx = q[0] + (p[0] - q[0]) * e, cy = q[1] + (p[1] - q[1]) * e;
      ctx.globalAlpha = t.glow * 0.5;
      ctx.setLineDash([2, 5]);
      ctx.strokeStyle = 'rgba(255, 200, 96, 0.8)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(q[0], q[1]);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.setLineDash([]);
      p = [cx, cy];
    }
    ctx.globalAlpha = t.glow;
    const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], S.radius * 3);
    g.addColorStop(0, 'rgba(255, 214, 120, 0.55)');
    g.addColorStop(1, 'rgba(255, 180, 80, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p[0], p[1], S.radius * 3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 200, 96, 0.95)';
    ctx.beginPath();
    ctx.arc(p[0], p[1], S.radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  let shown = 0;
  const placed: Rect[] = [];
  for (const L of o.labels) {
    if (L.eras && era && !L.eras.includes(era)) continue;
    const alpha = t.label(shown++);
    if (alpha < 1) busy = true;
    if (alpha <= 0) continue;
    const p = at(L.at);
    if (!p) continue;
    ctx.globalAlpha = alpha;
    let dx = 0, dy = 0, align: CanvasTextAlign = 'center';
    if (L.place === 'above') dy = -30;
    else if (L.place === 'below') dy = 22;
    if (typeof L.dy === 'number') dy = L.dy;
    if (Math.abs(dy) > 34) {
      // a label stood off from its point keeps a leader to it
      ctx.strokeStyle = 'rgba(242, 181, 68, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(p[0], p[1] + dy + (dy < 0 ? 19 : -19));
      ctx.stroke();
    } else if (L.place === 'right') { dx = 12; align = 'left'; } else if (L.place === 'left') { dx = -12; align = 'right'; }
    ctx.beginPath();
    ctx.arc(p[0], p[1], 3, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(242, 181, 68, 0.95)';
    ctx.fill();
    placed.push(tag(ctx, L.text, L.sub, p[0] + dx, p[1] + dy, align, font, placed, keepOut));
  }
  ctx.globalAlpha = 1;
  return busy;
}

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * How much larger than their phone size the labels are drawn on a stage `width` CSS pixels wide: they were sized for
 * a phone and read small on a laptop (the laptop's review at 1280 by 720), so they grow with the stage to a limit.
 */
export function labelScale(width: number): number {
  return clamp(width / 1000, 1, 1.4);
}

/**
 * Where a label's plate goes so it does not cover one already drawn: moved down, or up when there is no room below,
 * past each plate it would overlap, `gap` apart, kept inside a stage `H` high.
 */
export function nudge(r: Rect, placed: readonly Rect[], H: number, gap = 6): Rect {
  const hits = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
  for (const dir of [1, -1]) {
    let y = r.y;
    for (let n = 0; n <= placed.length; n++) {
      const hit = placed.find((b) => hits({ ...r, y }, b));
      if (!hit) {
        if (y >= 6 && y + r.h <= H - 6) return { ...r, y };
        break;
      }
      y = dir > 0 ? hit.y + hit.h + gap : hit.y - r.h - gap;
    }
  }
  return r;
}

/**
 * Where a label's plate goes so it is not under a panel the page lays over the stage: stepped sideways off it, to the
 * right of a panel in the left half and to the left of one in the right half, kept on a stage `W` wide.
 */
export function sideStep(r: Rect, keepOut: readonly Rect[], W: number, gap = 8): Rect {
  let x = r.x;
  for (const k of keepOut) {
    if (!(x < k.x + k.w && k.x < x + r.w && r.y < k.y + k.h && k.y < r.y + r.h)) continue;
    x = k.x + k.w / 2 < W / 2 ? k.x + k.w + gap : k.x - r.w - gap;
  }
  return { ...r, x: clamp(x, 6, W - r.w - 6) };
}

/** A label on a dark plate, so it reads over bright stone and sky alike; kept on screen and off the plates before it. */
function tag(ctx: CanvasRenderingContext2D, text: string, sub: string | undefined, x: number, y: number, align: CanvasTextAlign, font: string, placed: readonly Rect[], keepOut: readonly Rect[]): Rect {
  const W = ctx.canvas.width / (ctx.getTransform().a || 1), H = ctx.canvas.height / (ctx.getTransform().d || 1);
  const k = labelScale(W), big = 13 * k, small = 11.5 * k, pad = 8 * k;
  ctx.font = `600 ${big}px ${font}`;
  const w1 = ctx.measureText(text).width;
  ctx.font = `400 ${small}px ${font}`;
  const w2 = sub ? ctx.measureText(sub).width : 0;
  const w = Math.max(w1, w2) + 2 * pad, h = (sub ? 38 : 22) * k;
  const top = clamp(y - h / 2, 6, H - h - 6);
  const x0 = sideStep({ x: clamp(align === 'left' ? x : align === 'right' ? x - w : x - w / 2, 6, W - w - 6), y: top, w, h }, keepOut, W).x;
  const y0 = nudge({ x: x0, y: top, w, h }, placed, H).y;
  ctx.fillStyle = 'rgba(17, 15, 12, 0.78)';
  ctx.strokeStyle = 'rgba(242, 181, 68, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x0, y0, w, h, 6);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(248, 214, 140, 1)';
  ctx.font = `600 ${big}px ${font}`;
  ctx.fillText(text, x0 + pad, y0 + 11 * k);
  if (sub) {
    ctx.fillStyle = 'rgba(239, 232, 220, 0.9)';
    ctx.font = `400 ${small}px ${font}`;
    ctx.fillText(sub, x0 + pad, y0 + 27 * k);
  }
  return { x: x0, y: y0, w, h };
}
