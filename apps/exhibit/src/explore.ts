/**
 * Explore: what the visitor can do once the narrated exhibit is over, from the same stage and the same data
 * (Stewart, 28 October: "what can we offer the reader after they have completed the narrated walkthrough").
 *
 * - Time Machine: the most striking views, each looked round freely and carried through every era the station was
 *   rendered in, an era chip wiping to it and the stage's drag edge holding the era it came from.
 * - Sky Machine: the exhibit's own sky leaves, the sky winding to a claim's year, then the year the visitor's to drag.
 * - Test a Claim: any claim's comparisons evaluated live, with the measurements' preset and the tolerance the
 *   visitor's to change: what the claims engine computes, the page only asks it.
 * - Free Walk: the walkthrough, at the station the visitor is standing at.
 */
import { type Claim, evaluateClaim, formatResidual, formatValue } from '@seked/claims/browser';
import { buildEnvironment } from '@seked/geometry';
import { resolve, type Database } from '@seked/data/browser';
import type { Leaf } from './leaves';
import type { Manifest, Station } from './manifest';
import { DEG } from './projection';
import type { SkyFigure } from './skyfigure';
import type { Shot, Stage } from './stage';

export type ExploreBundle = Database & { claims: Claim[] };

/** A curated view: its station and how it looks, in degrees; the era it opens in, when not the station's newest. */
interface View { station: string; title: string; yaw?: number; pitch?: number; fov?: number; era?: string }

/** The Time Machine's views, after the exhibit's strongest frames (a look choice). */
const VIEWS: View[] = [
  { station: 'sphinx', title: 'The Sphinx from its enclosure', yaw: 280, pitch: -2, fov: 44 },
  { station: 'sphinx-flank', title: 'Along the flank', yaw: 340, pitch: 15, fov: 60 },
  { station: 'sphinx-face', title: 'Between the paws', yaw: 270, pitch: 8, fov: 70 },
  { station: 'sphinx-side', title: "The lion's side", yaw: 356, pitch: 8, fov: 66 },
  { station: 'south', title: 'South of Khufu' },
  { station: 'north', title: 'The north face', yaw: 180, pitch: 14, fov: 66 },
  { station: 'east', title: 'East of the Great Pyramid' },
  { station: 'panorama', title: 'The panorama stand' },
  { station: 'menkaure', title: "Menkaure's pyramid" },
  { station: 'valley-temple', title: 'The Valley Temple', yaw: 22, pitch: -15, fov: 60 },
  { station: 'gallery', title: 'The Grand Gallery' },
  { station: 'kings-chamber', title: "The King's Chamber" },
];

/** The Sky Machine's skies: the exhibit's sky leaves, by id, each with what it shows. */
const SKIES: { leaf: string; title: string; note: string }[] = [
  { leaf: 'ch2-leo', title: 'Leo at the equinox', note: 'From today back to 10,500 BCE at the spring equinox: Leo rising in the east as the Sphinx looks out.' },
  { leaf: 'ch5-sinks', title: "Orion's belt over the pyramids", note: "The belt's three stars against the three pyramids, the fit read live as the years run." },
  { leaf: 'ch5-alnitak', title: 'The shafts and their stars', note: "Where the Great Pyramid's shafts point on the meridian, and which stars cross them in which year." },
];

const TOLERANCE_STEPS = [0.25, 0.5, 1, 2, 4];

export interface ExploreDeps {
  stage: Stage;
  manifest: Manifest;
  sky: SkyFigure;
  leaves: Leaf[];
  walk: URL;
  /** A leaf's panoramas, its own first (main.ts panoramasFor). */
  panoramas: (L: Leaf) => string[];
  bundle: () => ExploreBundle | null;
  /** The mask URL for a sky leaf's panorama. */
  mask: (L: Leaf) => string | null;
  /** Leave Explore, back to the exhibit. */
  back: () => void;
}

type Mode = 'time' | 'sky' | 'claim' | 'splat';

/** The walkable splats (render/splat_views.py, Brush, scripts/splat_pack.py into splats/), where the camera starts. */
const SPLATS = [
  { file: 'splats/sphinx-today.splat', title: 'The Sphinx enclosure today', from: [372, -480, -26], at: [322, -433, -32] },
];

export class Explore {
  private root: HTMLElement;
  private panel: HTMLElement;
  private sheet: HTMLElement;
  private mode: Mode = 'time';
  private view = 0;
  private era: string | null = null;
  private skyIndex = 0;
  private claimId: string | null = null;
  private preset = 'canonical';
  private tolerance = 2;   // index into TOLERANCE_STEPS: as filed
  private splatBox: HTMLElement;
  private splatViewer: { dispose: () => Promise<void> | void } | null = null;

  constructor(private d: ExploreDeps) {
    this.root = document.createElement('div');
    this.root.className = 'explore';
    this.root.hidden = true;
    this.root.innerHTML = `
      <header class="ex-top">
        <span class="ex-title">Explore</span>
        <nav class="ex-modes" aria-label="Explore">
          <button type="button" class="ex-mode" data-mode="time">Time Machine</button>
          <button type="button" class="ex-mode" data-mode="sky">Sky Machine</button>
          <button type="button" class="ex-mode" data-mode="claim">Test a Claim</button>
          <button type="button" class="ex-mode" data-mode="splat">Walk the Sphinx</button>
          <a class="ex-mode" id="ex-walk" href="${d.walk.href}">Free Walk</a>
        </nav>
        <button type="button" class="ex-close" id="ex-close">Back to the exhibit</button>
      </header>
      <section class="ex-panel" aria-live="polite"></section>
      <section class="ex-sheet" hidden></section>
      <div class="ex-splat" hidden></div>`;
    this.panel = this.root.querySelector('.ex-panel')!;
    this.sheet = this.root.querySelector('.ex-sheet')!;
    this.splatBox = this.root.querySelector('.ex-splat')!;
    this.root.querySelectorAll<HTMLButtonElement>('button.ex-mode').forEach((b) => {
      b.onclick = () => this.setMode(b.dataset.mode as Mode);
    });
    this.root.querySelector<HTMLButtonElement>('#ex-close')!.onclick = () => d.back();
    d.stage.root.appendChild(this.root);
  }

  get open(): boolean { return !this.root.hidden; }

  show(mode: Mode = 'time'): void {
    this.root.hidden = false;
    document.body.classList.add('exploring');
    this.setMode(mode);
  }

  hide(): void {
    this.closeSplat();
    this.root.hidden = true;
    document.body.classList.remove('exploring');
    this.d.stage.compare(null);
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    this.root.querySelectorAll<HTMLElement>('.ex-mode').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    this.sheet.hidden = mode !== 'claim';
    this.panel.hidden = mode === 'claim';
    document.body.classList.toggle('exploring-sky', mode === 'sky');
    if (mode !== 'sky') this.d.sky.hide();
    if (mode !== 'splat') this.closeSplat();
    this.splatBox.hidden = mode !== 'splat';
    this.d.stage.compare(null);
    if (mode === 'time') this.showView(this.view, true);
    if (mode === 'sky') this.showSky(this.skyIndex);
    if (mode === 'claim') this.showClaims();
    if (mode === 'splat') void this.showSplat(0);
  }

  // ---- Walk the Sphinx: a Gaussian splat, moved through in real time --------------------------------------

  private async showSplat(k: number): Promise<void> {
    const S = SPLATS[k]!;
    this.panel.innerHTML = `<div class="ex-what"><p class="ex-name">${S.title}</p>
      <p class="ex-sub">Drag to turn round it, right-drag to slide, scroll to move in. A Gaussian splat learned from 272
      path-traced renders of the plateau: it moves in real time, and is softer than the panoramas close up.</p></div>`;
    this.closeSplat();
    const G = await import('@mkkellogg/gaussian-splats-3d');
    if (this.mode !== 'splat') return;
    // a splat learns surfaces, not the sky, so what is not ground draws dark (a transparent canvas over a sky is to try)
    const viewer = new G.Viewer({
      rootElement: this.splatBox, cameraUp: [0, 0, 1], initialCameraPosition: S.from, initialCameraLookAt: S.at,
      sharedMemoryForWorkers: false, selfDrivenMode: true, dynamicScene: false,
    });
    this.splatViewer = viewer;
    await viewer.addSplatScene(S.file, { format: G.SceneFormat.Splat, showLoadingUI: true, progressiveLoad: true });
    if (this.splatViewer === viewer) viewer.start();
  }

  private closeSplat(): void {
    const v = this.splatViewer;
    this.splatViewer = null;
    if (v) void v.dispose();
    this.splatBox.replaceChildren();
  }

  // ---- Time Machine ----------------------------------------------------------------------------------

  private views(): (View & { st: Station })[] {
    return VIEWS.map((v) => ({ ...v, st: this.d.manifest.byId[v.station]! })).filter((v) => v.st && v.st.eras.length > 0);
  }

  private shot(v: View & { st: Station }, era: string): Shot {
    const deg = (x: number | undefined) => (x === undefined ? undefined : x * DEG);
    return { station: v.st, era, yaw: deg(v.yaw), pitch: deg(v.pitch), fov: deg(v.fov) };
  }

  private title(era: string): string {
    const s = this.d.manifest.stateById[era];
    return s ? s.title : era;
  }

  private showView(k: number, fresh = false): void {
    const list = this.views();
    if (!list.length) return;
    this.view = (k + list.length) % list.length;
    const v = list[this.view]!;
    // the era carried over from the last view where this station has it, else the station's newest
    const era = (!fresh && this.era && v.st.eras.includes(this.era)) ? this.era : (v.era ?? v.st.eras[v.st.eras.length - 1]!);
    this.era = era;
    this.d.stage.compare(null);
    this.d.stage.show(this.shot(v, era));
    this.drawTime();
    // the views either side, so stepping is quick
    for (const n of [list[(this.view + 1) % list.length]!, list[(this.view - 1 + list.length) % list.length]!]) {
      const p = n.st.panoramas[era] ?? n.st.panoramas[n.st.eras[n.st.eras.length - 1]!];
      if (p) this.d.stage.prefetch(n.st, era, p);
    }
  }

  private toEra(era: string): void {
    const v = this.views()[this.view]!;
    const from = this.era;
    if (!from || era === from) return;
    this.era = era;
    const other = { era: from, title: this.title(from), panoramas: [v.st.panoramas[from]!] };
    this.d.stage.wipe(this.shot(v, era), other, () => {
      // the era it came from stays behind the drag edge, to compare
      if (this.mode === 'time' && this.era === era) this.d.stage.compare(other);
    });
    this.drawTime();
  }

  private drawTime(): void {
    const list = this.views();
    const v = list[this.view]!;
    const eras = v.st.eras;
    this.panel.innerHTML = `
      <div class="ex-row">
        <button type="button" class="ctl ex-step" data-step="-1" aria-label="Previous view">&#8249;</button>
        <div class="ex-what"><p class="ex-name">${v.title}</p><p class="ex-sub">${v.st.where} &middot; ${this.view + 1} of ${list.length}</p></div>
        <button type="button" class="ctl ex-step" data-step="1" aria-label="Next view">&#8250;</button>
      </div>
      <div class="ex-eras" role="group" aria-label="Era">${eras.map((e) => {
        const s = this.d.manifest.stateById[e];
        return `<button type="button" class="ex-era${e === this.era ? ' on' : ''}" data-era="${e}" aria-pressed="${e === this.era}">
          <span class="ex-era-t">${s?.title ?? e}</span><span class="ex-era-l">${s?.label ?? ''}</span></button>`;
      }).join('')}</div>
      <p class="ex-hint">Drag to look round. ${eras.length > 1 ? 'Pick an era, then drag the edge to compare it with the last.' : 'This view was rendered in one era.'}</p>`;
    this.panel.querySelectorAll<HTMLButtonElement>('.ex-step').forEach((b) => { b.onclick = () => this.showView(this.view + Number(b.dataset.step)); });
    this.panel.querySelectorAll<HTMLButtonElement>('.ex-era').forEach((b) => { b.onclick = () => this.toEra(b.dataset.era!); });
    const walk = this.root.querySelector<HTMLAnchorElement>('#ex-walk')!;
    walk.href = new URL(`#${v.st.id}/${this.era}`, this.d.walk).href;
  }

  // ---- Sky Machine -----------------------------------------------------------------------------------

  private skies(): { L: Leaf; title: string; note: string }[] {
    return SKIES.map((s) => ({ ...s, L: this.d.leaves.find((L) => L.id === s.leaf)! })).filter((s) => s.L?.sky);
  }

  private showSky(k: number): void {
    const list = this.skies();
    if (!list.length) { this.panel.innerHTML = '<p class="ex-hint">No sky is set up in this copy of the exhibit.</p>'; return; }
    this.skyIndex = (k + list.length) % list.length;
    const { L, title, note } = list[this.skyIndex]!;
    const st = this.d.manifest.byId[L.station]!;
    this.d.stage.show({ station: st, era: L.era, yaw: L.view.yaw * DEG, pitch: L.view.pitch * DEG, fov: L.view.fov * DEG, panoramas: this.d.panoramas(L) });
    this.d.sky.setMask(this.d.mask(L));
    this.d.sky.show(L, true);   // winds from its `from` to its claim's year, then the slider is the visitor's
    this.panel.innerHTML = `
      <div class="ex-skies" role="group" aria-label="Sky">${list.map((s, i) =>
        `<button type="button" class="ex-era${i === this.skyIndex ? ' on' : ''}" data-sky="${i}"><span class="ex-era-t">${s.title}</span></button>`).join('')}</div>
      <p class="ex-sub ex-note">${note}</p>
      <div class="ex-row ex-row-left">
        <button type="button" class="ctl" id="ex-rewind">Wind it again</button>
        <span class="ex-hint">Drag the year, top left, to any year from 13,000 BCE to today.</span>
      </div>`;
    this.panel.querySelectorAll<HTMLButtonElement>('[data-sky]').forEach((b) => { b.onclick = () => this.showSky(Number(b.dataset.sky)); });
    this.panel.querySelector<HTMLButtonElement>('#ex-rewind')!.onclick = () => this.d.sky.show(L, true);
    void title;
  }

  // ---- Test a Claim ----------------------------------------------------------------------------------

  private showClaims(): void {
    const b = this.d.bundle();
    if (!b) {
      this.sheet.innerHTML = `<div class="ex-card"><p class="ex-hint">The claims load with the site's database; it has not arrived yet. Try again in a moment.</p></div>`;
      return;
    }
    const computed = b.claims.filter((c) => c.status === 'computed' && c.comparisons.length > 0);
    if (!this.claimId || !computed.some((c) => c.id === this.claimId)) this.claimId = computed[0]?.id ?? null;
    const presets = (b as unknown as { presets: { id: string; name?: string; label?: string }[] }).presets ?? [];
    const claim = computed.find((c) => c.id === this.claimId)!;
    const scale = TOLERANCE_STEPS[this.tolerance]!;
    let html = '';
    try {
      const env = buildEnvironment(resolve(b, this.preset).values) as Record<string, number>;
      // the tolerance scaled, the claim's own and each comparison's that sets one
      const scaled: Claim = {
        ...claim,
        tolerance_pct: claim.tolerance_pct * scale,
        comparisons: claim.comparisons.map((c) => ({
          ...c,
          ...(c.tolerance_pct !== undefined ? { tolerance_pct: c.tolerance_pct * scale } : {}),
          ...(c.tolerance_abs !== undefined ? { tolerance_abs: c.tolerance_abs * scale } : {}),
        })),
      };
      const r = evaluateClaim(scaled, env);
      const rows = r.comparisons.map((c) => {
        const band = c.toleranceAbs !== undefined ? `±${formatValue(c.toleranceAbs, c.unit ?? '')}` : `±${+c.tolerancePct.toFixed(3)} %`;
        return `<tr class="${c.within ? 'holds' : 'fails'}"><th scope="row">${c.label}</th>
          <td>${formatValue(c.value, c.unit ?? '')}</td><td>${formatValue(c.targetValue, c.unit ?? '')}</td>
          <td>${formatResidual(c)}</td><td>${band}</td><td class="ex-verdict">${c.within ? 'holds' : 'does not hold'}</td></tr>`;
      }).join('');
      const free = claim.free_choices.length ? `<p class="ex-sub"><strong>Free choices the claim makes:</strong> ${claim.free_choices.join('; ')}</p>` : '';
      html = `
        <p class="ex-verdict-big ${r.fits ? 'holds' : 'fails'}">${r.fits ? 'It holds' : 'It does not hold'} <span>with these measurements and this tolerance</span></p>
        <table class="ex-table"><thead><tr><th>Comparison</th><th>Measured</th><th>Claimed</th><th>Off by</th><th>Band</th><th></th></tr></thead><tbody>${rows}</tbody></table>
        ${free}`;
    } catch (e) {
      html = `<p class="ex-hint">This claim could not be evaluated with these measurements (${(e as Error).message}).</p>`;
    }
    this.sheet.innerHTML = `
      <div class="ex-card ex-claims">
        <nav class="ex-list" aria-label="Claims">${computed.map((c) =>
          `<button type="button" class="ex-claim${c.id === this.claimId ? ' on' : ''}" data-claim="${c.id}"><span class="ex-id">${c.id}</span> ${c.title}</button>`).join('')}</nav>
        <div class="ex-detail">
          <h2>${claim.title}</h2>
          <p class="ex-summary">${claim.summary}</p>
          <div class="ex-controls">
            <label>Whose measurements <select id="ex-preset">${presets.map((p) =>
              `<option value="${p.id}"${p.id === this.preset ? ' selected' : ''}>${p.name ?? p.label ?? p.id}</option>`).join('')}</select></label>
            <label>Tolerance <input type="range" id="ex-tol" min="0" max="${TOLERANCE_STEPS.length - 1}" step="1" value="${this.tolerance}">
              <span class="ex-tol">${scale === 1 ? 'as the claim files it' : `${scale} times the claim's own`}</span></label>
          </div>
          ${html}
        </div>
      </div>`;
    this.sheet.querySelectorAll<HTMLButtonElement>('[data-claim]').forEach((el) => { el.onclick = () => { this.claimId = el.dataset.claim!; this.showClaims(); }; });
    this.sheet.querySelector<HTMLSelectElement>('#ex-preset')!.onchange = (e) => { this.preset = (e.target as HTMLSelectElement).value; this.showClaims(); };
    this.sheet.querySelector<HTMLInputElement>('#ex-tol')!.oninput = (e) => { this.tolerance = Number((e.target as HTMLInputElement).value); this.showClaims(); };
    this.sheet.querySelector('.ex-claim.on')?.scrollIntoView({ block: 'nearest' });
  }
}
