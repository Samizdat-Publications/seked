/**
 * The stage: the panorama filling the screen, the overlay canvas over it, and the visitor's hands on the view
 * (drag and pinch to look and zoom, the wheel and + and - to zoom, the arrow keys to turn). It shows one
 * station in one era at a time; the player (E3) tells it which.
 */
import { cameraFor, type Manifest, type Overlay, type OverlayPoint, type Station } from './manifest';
import { drawOverlay } from './overlay';
import { type Aim, turnAt, turnSeconds } from './play';
import {
  DEG, MAX_FOV, MIN_FOV, PITCH_MAX, clamp, fitFov, fromCamera, nearestPatch, project, wantsPatch, wrapAngle,
  type Vec3,
} from './projection';
import { TextureCache } from './textures';
import { type Layer, PanoramaViewer } from './viewer';

const FADE_MS = 320;
const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

export interface Shot {
  station: Station; era: string; yaw?: number; pitch?: number; fov?: number; overlay?: string | null;
  /** Panoramas to try in order, relative to the walkthrough's folder; the first that loads is shown. Default: the station's own for the era. */
  panoramas?: string[];
}

export class Stage {
  station: Station | null = null;
  era: string | null = null;
  readonly view = { yaw: 0, pitch: 0, zoom: 1, vy: 0, vp: 0 };
  /** Called when the visitor takes the view (a drag, a pinch, the wheel or a key), so play can pause. */
  onHandsOn: () => void = () => {};
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
  private tween: { from: Aim; to: Aim; t0: number; ms: number; done: () => void } | null = null;
  private overlayT0 = 0;
  private frame = 0;
  private last = 0;
  private keys = new Set<string>();
  private font = 'sans-serif';
  private reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;

  constructor(private root: HTMLElement, private canvas: HTMLCanvasElement, private ink: HTMLCanvasElement,
    private flat: HTMLElement, private manifest: Manifest, private overlays: Record<string, Overlay>, private base: URL) {
    this.ctx = ink.getContext('2d')!;
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
    this.bindInput();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  get still(): boolean { return !!this.reduced?.matches; }

  fov(): number { return clamp(this.fitted * this.view.zoom, MIN_FOV, MAX_FOV); }
  setFov(f: number): void { this.view.zoom = clamp(f, MIN_FOV, MAX_FOV) / this.fitted; }

  url(path: string): string { return new URL(path, this.base).href; }

  /** Put a station on the stage in an era, looking where the shot says (or where the station opens). */
  show(shot: Shot): void {
    const st = shot.station;
    const own = st.panoramas[shot.era];
    const candidates = shot.panoramas ?? (own ? [own] : []);
    const changed = st !== this.station || shot.era !== this.era || candidates.join() !== this.candidates.join();
    this.candidates = candidates;
    this.tween = null;
    this.station = st;
    this.era = shot.era;
    this.view.yaw = wrapAngle(shot.yaw ?? st.view.yaw);
    this.view.pitch = clamp(shot.pitch ?? st.view.pitch, -PITCH_MAX, PITCH_MAX);
    this.fitted = fitFov(shot.fov ?? st.view.fov, this.W, this.H);
    this.view.zoom = 1;
    this.view.vy = this.view.vp = 0;
    const o = shot.overlay ? this.overlays[shot.overlay] ?? null : null;
    if (o !== this.overlay) { this.overlay = o; this.overlayT0 = performance.now(); }
    if (changed) this.showFlat();
    this.request();
  }

  /**
   * Swing the view to a shot's aim in the same panorama, eased; `done` runs when it arrives, or at once if the
   * visitor takes the view first (the turn is dropped) or prefers reduced motion. Returns the seconds it takes.
   */
  turn(shot: Shot, done: () => void = () => {}): number {
    if (!this.station) { this.show(shot); done(); return 0; }
    const st = shot.station;
    const to: Aim = { yaw: wrapAngle(shot.yaw ?? st.view.yaw), pitch: clamp(shot.pitch ?? st.view.pitch, -PITCH_MAX, PITCH_MAX), fov: fitFov(shot.fov ?? st.view.fov, this.W, this.H) };
    const from: Aim = { yaw: this.view.yaw, pitch: this.view.pitch, fov: this.fov() };
    const o = shot.overlay ? this.overlays[shot.overlay] ?? null : null;
    if (o !== this.overlay) { this.overlay = o; this.overlayT0 = performance.now(); }
    this.view.vy = this.view.vp = 0;
    this.tween?.done();
    const secs = this.still ? 0 : turnSeconds(from, to);
    if (secs <= 0) { this.tween = null; this.aim(to); done(); this.request(); return 0; }
    this.tween = { from, to, t0: performance.now(), ms: secs * 1000, done };
    this.request();
    return secs;
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
    this.onHandsOn();
  }

  /** Fetch a panorama ahead of time: the given path, else the station's own for the era. */
  prefetch(st: Station, era: string, path?: string): void {
    const p = path ?? st.panoramas[era];
    if (p && this.cache) this.cache.prefetch(this.url(p));
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
  private current(): string {
    const urls = this.candidates.map((p) => this.url(p));
    return urls.find((u) => { const st = this.cache?.status(u); return st !== 'missing' && st !== 'error'; }) ?? urls[urls.length - 1] ?? '';
  }

  /** Whether the panorama shown is a stand-in for the first one asked for. */
  get standIn(): boolean { return this.candidates.length > 1 && this.current() !== this.url(this.candidates[0]!); }

  private layer(st: Station, era: string, now: number): { layer: Layer; url: string } {
    const url = this.current();
    const pano = this.cache!.get(url);
    let patch: Layer['patch'] = null;
    if (pano && wantsPatch(this.fov(), this.canvas.height)) {
      const q = nearestPatch(st.patches[era], this.view);
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
      if (a.layer.pano && on < 1) {
        busy = true;
        this.viewer.draw(this.view, fov, { pano: null, patch: null }, a.layer, on);
      } else {
        this.viewer.draw(this.view, fov, a.layer, null, 0);
      }
      if (a.layer.patch && a.layer.patch.on < 1) busy = true;
      this.onStatus(this.cache.status(a.url) ?? 'loading');
    }
    if (this.overlay && (!this.cache || this.cache.status(this.current()) === 'ready')) {
      const camera = cameraFor(st, era);
      const at = (p: OverlayPoint) => this.project(Array.isArray(p) ? p : fromCamera(camera, p.dir), camera, fov);
      if (drawOverlay(this.ctx, this.overlay, at, era, t - this.overlayT0, this.still, this.font)) busy = true;
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

