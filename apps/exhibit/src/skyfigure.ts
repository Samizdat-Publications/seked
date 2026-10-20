/**
 * The live sky on a leaf that names one (`sky` in leaves.json): drawn over the panorama by the stage, with a year
 * readout and a slider in a small panel. In play a leaf whose sky has a `from` winds the years from it to its own
 * over SKY_RUN seconds; paused, the visitor drags the slider, which pauses play like any other hand on the view.
 */
import type { Leaf } from './leaves';
import { type Moment, type SkyAt, type SkyData, type SkyView, SKY_RUN, TODAY, drawSky, epochAt, epochOf, skyAt, yearLabel } from './sky';
import type { Stage } from './stage';

/** The slider's reach: from before the claims' earliest epoch to today. A look choice. */
const EARLIEST = -13000;

export class SkyFigure {
  /** Called when the visitor drags the year, so play can pause. */
  onHandsOn: () => void = () => {};
  private run: { from: number | null; to: number; moment: Moment; t0: number } | null = null;
  private manual: number | null = null;
  private cached: { key: string; view: SkyView } | null = null;
  private year: HTMLElement;
  private input: HTMLInputElement;

  constructor(private stage: Stage, private data: SkyData, private moments: Record<string, Moment>, private bar: HTMLElement) {
    bar.innerHTML = `<p class="sky-year"><span class="sky-k">The sky in</span> <span class="sky-v"></span></p>
      <input type="range" min="${EARLIEST}" max="${TODAY}" step="1" aria-label="The sky's year">
      <p class="sky-note">The ${data.stars.length} stars of the HYG catalogue to magnitude ${data.magnitudeLimit}, precessed
      (Vondrák 2011) to the year shown and drawn where they stood at this picture's moment, Leo's in gold with
      ${Object.keys(data.figures).length ? "Stellarium's modern figure drawn through them" : 'no figure drawn'}. By day none would be seen. Ticks on
      the horizon: C5's bearings. Stars: HYG 4.2, by astronexus; figure: Stellarium; both CC BY-SA 4.0.</p>`;
    this.year = bar.querySelector('.sky-v')!;
    this.input = bar.querySelector('input')!;
    this.input.addEventListener('input', () => {
      this.manual = Number(this.input.value);
      this.onHandsOn();
      this.stage.request();
    });
  }

  /** Put a leaf's sky up (or take it down). Playing, a sky with a `from` winds from it again. */
  show(L: Leaf, playing: boolean): void {
    if (!L.sky) {
      this.run = null;
      this.stage.setSky(null);
      this.bar.hidden = true;
      return;
    }
    const to = epochOf(L.sky.at, this.data);
    const from = playing && L.sky.from ? epochOf(L.sky.from, this.data) : null;
    const moment = this.moments[L.moment] ?? {};
    // the same sky carried on from the leaf before stays up; a new one draws on
    const carried = !!this.run && from === null && this.run.to === to && this.run.moment === moment && this.manual === null;
    this.run = { from, to, moment, t0: performance.now() };
    this.manual = null;
    this.bar.hidden = false;
    if (carried) this.stage.request();
    else this.stage.setSky((ctx, at, since, still, font) => this.draw(ctx, at, since, still, font));
  }

  /** The year on show now. */
  epoch(): number {
    const r = this.run;
    if (!r) return TODAY;
    if (this.manual !== null) return this.manual;
    return r.from === null ? r.to : epochAt(r.from, r.to, (performance.now() - r.t0) / 1000);
  }

  private draw(ctx: CanvasRenderingContext2D, at: SkyAt, since: number, still: boolean, font: string): boolean {
    const r = this.run;
    if (!r) return false;
    const e = Math.round(this.epoch());
    const key = `${e} ${r.moment.date} ${r.moment.solar}`;
    if (this.cached?.key !== key) this.cached = { key, view: skyAt(this.data, e, r.moment) };
    this.year.textContent = yearLabel(e);
    if (this.manual === null) this.input.value = String(e);
    const winding = this.manual === null && r.from !== null && (performance.now() - r.t0) / 1000 < SKY_RUN;
    return drawSky(ctx, this.cached.view, at, since, still, font) || winding;
  }
}
