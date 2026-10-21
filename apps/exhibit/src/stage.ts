/**
 * The stage: the panorama filling the screen, the overlay canvas over it, and the visitor's hands on the view
 * (drag and pinch to look and zoom, the wheel and + and - to zoom, the arrow keys to turn). It shows one
 * station in one era at a time; the player (E3) tells it which.
 */
import { cameraFor, type Manifest, type Overlay, type OverlayPoint, type Station, patchesByPanorama } from './manifest';
import { type Rect, drawOverlay } from './overlay';
import { type Aim, WIPE_SECONDS, turnAt, turnSeconds, wipeAt } from './play';
import {
  DEG, MAX_FOV, MIN_FOV, PITCH_MAX, type Patch, clamp, fitFov, frameAim, fromCamera, nearestPatch, project, wantsPatch, wrapAngle,
  type Vec3,
} from './projection';
import { TextureCache } from './textures';
import { type Layer, PanoramaViewer } from './viewer';

const FADE_MS = 320;
const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

/** Draws a sky onto the ink, given where a direction falls on screen; true while it is still moving. */
export type SkyDrawer = (ctx: CanvasRenderingContext2D, at: (altDeg: number, azDeg: number) => [number, number] | null, since: number, still: boolean, font: string) => boolean;

export interface Shot {
  station: Station; era: string; yaw?: number; pitch?: number; fov?: number; overlay?: string | null;
  /** Panoramas to try in order, relative to the walkthrough's folder; the first that loads is shown. Default: the station's own for the era. */
  panoramas?: string[];
  /** The overlay waits for startOverlay() (its word) rather than drawing at once. */
  overlayCued?: boolean;
}

/** The era a wipe comes from, or a comparison shows beside the one on stage. */
export interface Other { era: string; title: string; panoramas: string[] }

export class Stage {
  station: Station | null = null;
  era: string | null = null;
  readonly view = { yaw: 0, pitch: 0, zoom: 1, vy: 0, vp: 0 };
  /** Called when the visitor takes the view (a drag, a pinch, the wheel or a key), so play can pause. */
  onHandsOn: () => void = () => {};
  /** What the page lays over the stage (a figure's panel), in stage pixels: the scene's labels keep off it. */
  keepOut: () => Rect[] = () => [];
  /** Called when the panorama on screen changes status: loading, ready, missing or error. */
  onStatus: (s: 'loading' | 'ready' | 'missing' | 'error') => void = () => {};

  private viewer: PanoramaViewer | null = null;
  private cache: TextureCache | null = null;
  private ctx: CanvasRenderingContext2D;
  private W = 1;
  private H = 1;
  private fitted = 58 * DEG;
  private overlay: Overlay | null = null;
  private candidates: string[] = [];
  /** Detail patches by the absolute address of the panorama each registers with. */
  private patches: Record<string, Patch[]> = {};
  private tween: { from: Aim; to: Aim; t0: number; ms: number; done: () => void } | null = null;
  /** The other era on screen during a wipe or a comparison: to the right of the edge, the stage's era to the left. */
  private other: Other | null = null;
  private edge = 1.12;
  private wipeRun: { t0: number; done: () => void } | null = null;
  private comparing = false;
  private handle: HTMLElement;
  private overlayT0 = 0;
  /** A sky drawn over the panorama (src/skyfigure.ts), and when it was put up. */
  private sky: SkyDrawer | null = null;
  private skyT0 = 0;
  private frame = 0;
  private last = 0;
  private keys = new Set<string>();
  private font = 'sans-serif';
  private reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;

  constructor(private root: HTMLElement, private canvas: HTMLCanvasElement, private ink: HTMLCanvasElement,
    private flat: HTMLElement, private manifest: Manifest, private overlays: Record<string, Overlay>, private base: URL) {
    this.ctx = ink.getContext('2d')!;
    this.handle = this.makeHandle();
    try {
      this.viewer = new PanoramaViewer(canvas);
      this.cache = new TextureCache(this.viewer, () => this.request());
    } catch (e) {
      console.warn('The panorama viewer is unavailable, so the flat picture is shown instead.', e);
      canvas.hidden = true;
      flat.hidden = false;
    }
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.cache?.forgetAll(); });
    canvas.addEventListener('webglcontextrestored', () => {
      try {
        this.viewer = new PanoramaViewer(canvas);
        this.cache = new TextureCache(this.viewer, () => this.request());
      } catch { /* stays on the last frame */ }
      this.request();
    });
    this.font = getComputedStyle(document.body).getPropertyValue('--body') || 'sans-serif';
    this.setPatches(patchesByPanorama(manifest));
    this.bindInput();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  get still(): boolean { return !!this.reduced?.matches; }

  fov(): number { return clamp(this.fitted * this.view.zoom, MIN_FOV, MAX_FOV); }
  setFov(f: number): void { this.view.zoom = clamp(f, MIN_FOV, MAX_FOV) / this.fitted; }

  url(path: string): string { return new URL(path, this.base).href; }

  /** The detail patches, by the panorama each registers with (paths relative to the base). */
  setPatches(byPanorama: Record<string, Patch[]>): void {
    this.patches = Object.fromEntries(Object.entries(byPanorama).map(([p, list]) => [this.url(p), list]));
    this.request();
  }

  /** Put a station on the stage in an era, looking where the shot says (or where the station opens). */
  show(shot: Shot): void {
    const st = shot.station;
    const own = st.panoramas[shot.era];
    const candidates = shot.panoramas ?? (own ? [own] : []);
    const changed = st !== this.station || shot.era !== this.era || candidates.join() !== this.candidates.join();
    this.candidates = candidates;
    this.tween = null;
    this.finishWipe();
    this.other = null;
    this.comparing = false;
    this.placeHandle();
    this.station = st;
    this.era = shot.era;
    this.view.yaw = wrapAngle(shot.yaw ?? st.view.yaw);
    const framed = frameAim(shot.pitch ?? st.view.pitch, shot.fov ?? st.view.fov, this.W, this.H);
    this.view.pitch = framed.pitch;
    this.fitted = framed.fov;
    this.view.zoom = 1;
    this.view.vy = this.view.vp = 0;
    this.setOverlay(shot);
    if (changed) this.showFlat();
    this.request();
  }

  /**
   * Swing the view to a shot's aim in the same panorama, eased; `done` runs when it arrives, or at once if the
   * visitor takes the view first (the turn is dropped) or prefers reduced motion. Returns the seconds it takes.
   */
  /** Start drawing the overlay on stage now (it waits when the shot's `overlayCued` is set). */
  startOverlay(): void {
    if (this.overlay && !Number.isFinite(this.overlayT0)) { this.overlayT0 = performance.now(); this.request(); }
  }

  /** Take the overlay down until startOverlay() again, so it can draw on with its word once more. */
  cueOverlay(): void {
    if (this.overlay) { this.overlayT0 = Infinity; this.request(); }
  }

  /** Draw a sky over the panorama from now (directions only, so it registers from any station), or none. */
  setSky(draw: SkyDrawer | null): void {
    this.sky = draw;
    this.skyT0 = performance.now();
    this.request();
  }

  private setOverlay(shot: Shot): void {
    const o = shot.overlay ? this.overlays[shot.overlay] ?? null : null;
    if (o !== this.overlay) { this.overlay = o; this.overlayT0 = shot.overlayCued ? Infinity : performance.now(); }
  }

  turn(shot: Shot, done: () => void = () => {}): number {
    if (!this.station) { this.show(shot); done(); return 0; }
    const st = shot.station;
    const to: Aim = { yaw: wrapAngle(shot.yaw ?? st.view.yaw), ...frameAim(shot.pitch ?? st.view.pitch, shot.fov ?? st.view.fov, this.W, this.H) };
    const from: Aim = { yaw: this.view.yaw, pitch: this.view.pitch, fov: this.fov() };
    this.setOverlay(shot);
    this.view.vy = this.view.vp = 0;
    this.tween?.done();
    const secs = this.still ? 0 : turnSeconds(from, to);
    if (secs <= 0) { this.tween = null; this.aim(to); done(); this.request(); return 0; }
    this.tween = { from, to, t0: performance.now(), ms: secs * 1000, done };
    this.request();
    return secs;
  }

  /**
   * Show a shot in another era of the panorama on stage by a wipe: a hard edge sweeps across the view from the
   * left with the shot's era behind it. It waits for both pictures, then takes WIPE_SECONDS; `done` runs at the
   * end, or at once if the visitor takes the view first or prefers reduced motion.
   */
  wipe(shot: Shot, from: Other, done: () => void = () => {}): void {
    this.show(shot);
    if (this.still || !this.viewer) { done(); return; }
    this.other = from;
    this.edge = -1.12;
    this.wipeRun = { t0: 0, done };
    this.request();
  }

  /** Keep another era beside the one on stage, behind an edge the visitor can drag; null puts it away. */
  compare(other: Other | null): void {
    if (!other) {
      this.comparing = false;
      if (!this.wipeRun) this.other = null;
    } else {
      this.comparing = true;
      if (!this.other) { this.other = other; this.edge = 1.12; }
    }
    this.placeHandle();
    this.request();
  }

  private finishWipe(): void {
    const w = this.wipeRun;
    if (!w) return;
    this.wipeRun = null;
    this.edge = 1.12;
    if (!this.comparing) this.other = null;
    this.placeHandle();
    w.done();
  }

  private makeHandle(): HTMLElement {
    const h = document.createElement('div');
    h.className = 'edge';
    h.hidden = true;
    h.innerHTML = '<button type="button" class="edge-grip" aria-label="Drag to compare the eras"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M7 4 2.5 9 7 14M11 4l4.5 5L11 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button><span class="edge-now"></span><span class="edge-then"></span>';
    const grip = h.querySelector('button')!;
    let dragging = false;
    const at = (x: number) => { this.edge = clamp((x / this.W) * 2 - 1, -1, 1.12); this.placeHandle(); this.request(); };
    grip.addEventListener('pointerdown', (e) => { dragging = true; grip.setPointerCapture(e.pointerId); e.stopPropagation(); });
    grip.addEventListener('pointermove', (e) => { if (dragging) at(e.clientX - this.root.getBoundingClientRect().left); });
    const stop = () => { dragging = false; };
    grip.addEventListener('pointerup', stop);
    grip.addEventListener('pointercancel', stop);
    grip.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowLeft' ? -0.1 : e.key === 'ArrowRight' ? 0.1 : 0;
      if (!step) return;
      e.preventDefault();
      e.stopPropagation();
      this.edge = clamp(this.edge + step, -1, 1.12);
      this.placeHandle();
      this.request();
    });
    this.root.append(h);
    return h;
  }

  private placeHandle(): void {
    const show = !!this.other && this.comparing && !this.wipeRun && !!this.viewer;
    this.handle.hidden = !show;
    if (!show) return;
    // at rest the handle waits at the right edge, where the other era is all but hidden
    const x = clamp((this.edge + 1) / 2, 0, 1) * this.W;
    this.handle.style.transform = `translateX(${Math.min(x, this.W - 28).toFixed(1)}px)`;
    const now = this.manifest.stateById[this.era ?? ''];
    const rest = this.edge > 0.98;
    this.handle.querySelector('.edge-now')!.textContent = rest ? `Drag for ${this.other!.title}` : now ? now.title : '';
    this.handle.querySelector('.edge-then')!.textContent = this.other!.title;
    this.handle.classList.toggle('at-rest', rest);
  }

  /** Where the view is pointed now. */
  aimNow(): Aim { return { yaw: this.view.yaw, pitch: this.view.pitch, fov: this.fov() }; }

  private aim(a: Aim): void {
    this.view.yaw = a.yaw;
    this.view.pitch = a.pitch;
    this.fitted = clamp(a.fov, MIN_FOV, MAX_FOV);
    this.view.zoom = 1;
  }

  /** The visitor has taken the view: a turn under way stops where it is. */
  private handsOn(): void {
    const t = this.tween;
    this.tween = null;
    t?.done();
    this.finishWipe();
    this.onHandsOn();
  }

  /**
   * Fetch a panorama ahead of time: the given path, else the station's own for the era; and, given the view it
   * will be seen at, the detail patch that view will want.
   */
  prefetch(st: Station, era: string, path?: string, view?: { yaw: number; pitch: number; fov: number }): void {
    const p = path ?? st.panoramas[era];
    if (!p || !this.cache) return;
    const url = this.url(p);
    this.cache.prefetch(url);
    if (!view) return;
    const aim = frameAim(view.pitch, view.fov, this.W, this.H);
    const q = wantsPatch(aim.fov, this.canvas.height) ? nearestPatch(this.patches[url], { yaw: view.yaw, pitch: aim.pitch }) : null;
    if (q) this.cache.prefetch(this.url(q.src), false);
  }

  /** Whether the panorama on stage is on screen (always, for the flat picture, which reports its own status). */
  get ready(): boolean { return !this.cache || this.cache.status(this.current()) === 'ready'; }

  request(): void {
    if (!this.frame) this.frame = requestAnimationFrame((t) => this.tick(t));
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = Math.max(1, this.root.clientWidth);
    this.H = Math.max(1, this.root.clientHeight);
    this.canvas.width = Math.round(this.W * dpr);
    this.canvas.height = Math.round(this.H * dpr);
    this.ink.width = Math.round(this.W * dpr);
    this.ink.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.station) {
      const f = this.fov();
      this.fitted = fitFov(this.station.view.fov, this.W, this.H);
      this.setFov(f);
    }
    this.request();
  }

  /** The first candidate panorama that has not failed (a missing one hands over to the next). */
  private current(candidates = this.candidates): string {
    const urls = candidates.map((p) => this.url(p));
    return urls.find((u) => { const st = this.cache?.status(u); return st !== 'missing' && st !== 'error'; }) ?? urls[urls.length - 1] ?? '';
  }

  /** Whether the panorama shown is a stand-in for the first one asked for. */
  get standIn(): boolean { return this.candidates.length > 1 && this.current() !== this.url(this.candidates[0]!); }

  private layer(st: Station, era: string, now: number, candidates = this.candidates): { layer: Layer; url: string } {
    const url = this.current(candidates);
    const pano = this.cache!.get(url);
    let patch: Layer['patch'] = null;
    if (pano && wantsPatch(this.fov(), this.canvas.height)) {
      const q = nearestPatch(this.patches[url], this.view);
      if (q) {
        const purl = this.url(q.src);
        const tex = this.cache!.get(purl, false);
        if (tex) patch = { tex, q, on: this.still ? 1 : this.cache!.presence(purl, now, FADE_MS) };
      }
    }
    return { layer: { pano, patch }, url };
  }

  private tick(t: number): void {
    this.frame = 0;
    const dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0;
    this.last = t;
    let busy = this.move(dt);
    const st = this.station, era = this.era;
    this.ctx.clearRect(0, 0, this.W, this.H);
    if (!st || !era) return;
    const fov = this.fov();
    if (this.viewer && this.cache) {
      const a = this.layer(st, era, t);
      // the panorama eases in from the blank as it arrives, rather than snapping
      const on = this.still ? 1 : this.cache.presence(a.url, t, FADE_MS);
      const o = this.other;
      if (o) {
        const b = this.layer(st, o.era, t, o.panoramas);
        const w = this.wipeRun;
        if (w) {
          const settled = (u: string) => { const x = this.cache!.status(u); return x === 'ready' || x === 'missing' || x === 'error'; };
          if (!w.t0 && settled(a.url) && settled(b.url)) w.t0 = t;
          if (w.t0) {
            const k = (t - w.t0) / (WIPE_SECONDS * 1000);
            this.edge = wipeAt(k);
            if (k >= 1) this.finishWipe();
          }
          busy = true;
        }
        this.viewer.draw(this.view, fov, a.layer, b.layer, 0, this.edge);
      } else if (a.layer.pano && on < 1) {
        busy = true;
        this.viewer.draw(this.view, fov, { pano: null, patch: null }, a.layer, on);
      } else {
        this.viewer.draw(this.view, fov, a.layer, null, 0);
      }
      if (a.layer.patch && a.layer.patch.on < 1) busy = true;
      this.onStatus(this.cache.status(a.url) ?? 'loading');
    }
    if (this.overlay && Number.isFinite(this.overlayT0) && (!this.cache || this.cache.status(this.current()) === 'ready')) {
      const camera = cameraFor(st, era);
      const at = (p: OverlayPoint) => this.project(Array.isArray(p) ? p : fromCamera(camera, p.dir), camera, fov);
      if (drawOverlay(this.ctx, this.overlay, at, era, t - this.overlayT0, this.still, this.font, this.keepOut())) busy = true;
    }
    if (this.sky && (!this.cache || this.cache.status(this.current()) === 'ready')) {
      const camera = cameraFor(st, era);
      const at = (altDeg: number, azDeg: number) => this.project(fromCamera(camera, [azDeg, altDeg, 1e5]), camera, fov);
      if (this.sky(this.ctx, at, t - this.skyT0, this.still, this.font)) busy = true;
    }
    if (busy) this.request();
  }

  private project(p: Vec3, camera: Vec3, fov: number) { return project(p, camera, this.view, fov, this.W, this.H); }

  /** Inertia after a fling, and the arrow keys held down; true while the view is still moving. */
  private move(dt: number): boolean {
    const v = this.view;
    let moving = false;
    if (this.tween) {
      const tw = this.tween, k = (performance.now() - tw.t0) / tw.ms;
      this.aim(turnAt(tw.from, tw.to, k));
      if (k >= 1) { this.tween = null; tw.done(); }
      return true;
    }
    if (this.keys.size) {
      const rate = 1.1 * this.fov();
      if (this.keys.has('ArrowLeft')) v.yaw -= rate * dt;
      if (this.keys.has('ArrowRight')) v.yaw += rate * dt;
      if (this.keys.has('ArrowUp')) v.pitch += rate * dt;
      if (this.keys.has('ArrowDown')) v.pitch -= rate * dt;
      moving = true;
    } else if (!this.drag && (Math.abs(v.vy) > 1e-3 || Math.abs(v.vp) > 1e-3)) {
      v.yaw += v.vy * dt;
      v.pitch += v.vp * dt;
      const k = Math.exp(-4 * dt);
      v.vy *= k;
      v.vp *= k;
      moving = true;
    }
    v.yaw = wrapAngle(v.yaw);
    v.pitch = clamp(v.pitch, -PITCH_MAX, PITCH_MAX);
    return moving;
  }

  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { x: number; y: number; t: number } | null = null;
  private pinch: { d: number; fov: number } | null = null;

  private spread(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 1;
  }

  private bindInput(): void {
    const c = this.canvas, v = this.view;
    c.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try { c.setPointerCapture(e.pointerId); } catch { /* not a live pointer */ }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) { this.drag = null; this.pinch = { d: this.spread(), fov: this.fov() }; }
      else if (this.pointers.size === 1) this.drag = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      v.vy = v.vp = 0;
      c.classList.add('grabbing');
      this.handsOn();
      this.request();
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.pinch) {
        if (this.pointers.size >= 2) { this.setFov(this.pinch.fov * this.pinch.d / Math.max(this.spread(), 1)); this.request(); }
        return;
      }
      const d = this.drag;
      if (!d) return;
      const k = 2 * Math.tan(this.fov() / 2) / this.H;   // radians per pixel at the centre: the scene stays under the finger
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      const dts = Math.max(8, e.timeStamp - d.t) / 1000;
      v.yaw = wrapAngle(v.yaw - dx * k);
      v.pitch = clamp(v.pitch + dy * k, -PITCH_MAX, PITCH_MAX);
      v.vy = 0.6 * (-dx * k / dts) + 0.4 * v.vy;
      v.vp = 0.6 * (dy * k / dts) + 0.4 * v.vp;
      d.x = e.clientX;
      d.y = e.clientY;
      d.t = e.timeStamp;
      this.request();
    });
    const release = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (this.pointers.size === 1) {
        const rest = this.pointers.values().next().value!;
        this.drag = { x: rest.x, y: rest.y, t: e.timeStamp };
        v.vy = v.vp = 0;
      } else if (this.pointers.size === 0) {
        if (!this.drag || e.timeStamp - this.drag.t > 90 || this.still) v.vy = v.vp = 0;
        v.vy = clamp(v.vy, -5, 5);
        v.vp = clamp(v.vp, -5, 5);
        this.drag = null;
        c.classList.remove('grabbing');
      }
      this.request();
    };
    c.addEventListener('pointerup', release);
    c.addEventListener('pointercancel', release);
    c.addEventListener('lostpointercapture', release);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.H : 1);
      this.setFov(this.fov() * Math.exp(d * 0.0012));
      this.handsOn();
      this.request();
    }, { passive: false });
    document.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (!(t === c || t === document.body || t === document.documentElement)) return;
      if (ARROWS.has(e.key)) { this.keys.add(e.key); v.vy = v.vp = 0; }
      else if (e.key === '+' || e.key === '=') this.setFov(this.fov() * 0.88);
      else if (e.key === '-' || e.key === '_') this.setFov(this.fov() / 0.88);
      else return;
      e.preventDefault();
      this.handsOn();
      this.request();
    });
    document.addEventListener('keyup', (e) => { if (this.keys.delete(e.key)) this.request(); });
    window.addEventListener('blur', () => this.keys.clear());
    // the flat picture's middle is the compass when there is no WebGL
    this.flat.addEventListener('scroll', () => {
      const img = this.flat.querySelector('img');
      if (!img?.clientWidth) return;
      v.yaw = wrapAngle(((this.flat.scrollLeft + this.flat.clientWidth / 2) / img.clientWidth - 0.5) * 2 * Math.PI);
    }, { passive: true });
  }

  /** Without WebGL: the panorama laid out flat, scrolled to the view. */
  private showFlat(): void {
    if (this.viewer || !this.station || !this.era) return;
    const src = this.candidates[this.candidates.length - 1];
    this.flat.replaceChildren();
    if (!src) return;
    const img = new Image();
    img.alt = `${this.station.name}, laid out flat. Scroll sideways to look around.`;
    img.onload = () => {
      this.flat.scrollLeft = (0.5 + this.view.yaw / (2 * Math.PI)) * img.clientWidth - this.flat.clientWidth / 2;
      this.onStatus('ready');
    };
    img.onerror = () => this.onStatus('missing');
    img.src = this.url(src);
    this.flat.append(img);
  }
}

