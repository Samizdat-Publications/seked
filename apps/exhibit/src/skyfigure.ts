/**
 * The live sky on a leaf that names one (`sky` in leaves.json): drawn over the panorama by the stage, with a year
 * readout and a slider in a small panel. In play a leaf whose sky has a `from` winds the years from it to its own
 * over SKY_RUN seconds; paused, the visitor drags the slider, which pauses play like any other hand on the view.
 * A leaf's sky may also name a claim whose comparisons are read out at the year on show (C4 on chapter 5's belt),
 * computed as the claims engine would with the claim's epoch moved to that year.
 */
import { formatValue } from '@seked/claims/browser';
import type { Leaf } from './leaves';
import { type Moment, type SkyAt, type SkyData, type SkyPick, type SkyView, SKY_RUN, TODAY, comparisonsAt, drawSky, epochAt, epochOf, skyAt, yearLabel } from './sky';
import type { Stage } from './stage';

/** The slider's reach: from before the claims' earliest epoch to today. A look choice. */
const EARLIEST = -13000;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export class SkyFigure {
  /** Called when the visitor drags the year, so play can pause. */
  onHandsOn: () => void = () => {};
  private run: { from: number | null; to: number; moment: Moment; pick: SkyPick; readout: string | null; t0: number } | null = null;
  private manual: number | null = null;
  private cached: { key: string; view: SkyView } | null = null;
  private ground: Record<string, number> = {};
  private named: Set<string>;
  private year: HTMLElement;
  private input: HTMLInputElement;
  private reading: HTMLElement;
  private note: HTMLElement;

  constructor(private stage: Stage, private data: SkyData, private moments: Record<string, Moment>, private bar: HTMLElement) {
    bar.innerHTML = `<p class="sky-year"><span class="sky-k">The sky in</span> <span class="sky-v"></span></p>
      <input type="range" min="${EARLIEST}" max="${TODAY}" step="1" aria-label="The sky's year">
      <div class="sky-reading" hidden></div>
      <p class="sky-note"></p>`;
    this.year = bar.querySelector('.sky-v')!;
    this.input = bar.querySelector('input')!;
    this.reading = bar.querySelector('.sky-reading')!;
    this.note = bar.querySelector('.sky-note')!;
    this.named = new Set(data.named.map((s) => s.name));
    this.input.addEventListener('input', () => {
      this.manual = Number(this.input.value);
      this.onHandsOn();
      this.stage.request();
    });
  }

  /** The monuments' environment from the bundle, once it loads: a claim's lines and targets that read the ground. */
  setGround(env: Record<string, number>): void {
    this.ground = env;
    this.cached = null;
    this.stage.request();
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
    const pick: SkyPick = { figure: L.sky.figure, bearings: L.sky.bearings, marks: L.sky.marks };
    const same = (a: SkyPick, b: SkyPick) => a.figure === b.figure && a.bearings === b.bearings && a.marks === b.marks;
    // the same sky carried on from the leaf before stays up; a new one draws on
    const carried = !!this.run && from === null && this.run.to === to && this.run.moment === moment && same(this.run.pick, pick) && this.manual === null;
    this.run = { from, to, moment, pick, readout: L.sky.readout ?? null, t0: performance.now() };
    this.manual = null;
    this.cached = null;
    this.bar.hidden = false;
    this.note.textContent = this.noteFor(moment, pick);
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

  /** What the panel says the drawing is, from what the leaf picks out. */
  private noteFor(moment: Moment, pick: SkyPick): string {
    const d = this.data;
    const fig = pick.figure ? d.figures[pick.figure] : undefined;
    const gold = pick.figure ? ` ${fig?.name ?? pick.figure}'s in gold${fig ? " with Stellarium's modern figure drawn through them" : ''}.` : '';
    const star = moment.night ? d.named.find((s) => s.id === d.nights[moment.night!])?.name ?? 'its star' : null;
    const when = star ? ` The sky is turned to the hour ${star} crosses the meridian in the year shown.` : ' By day none would be seen.';
    const ticks = pick.bearings ? ` Ticks on the horizon: ${pick.bearings}'s bearings.` : '';
    const marks = pick.marks ? ` Dashed across the meridian: ${pick.marks}'s shafts, at their surveyed angles.` : '';
    return `The ${d.stars.length} stars of the HYG catalogue to magnitude ${d.magnitudeLimit}, precessed (Vondrák 2011) to the year shown and drawn where they stood at this picture's moment.${gold}${when}${ticks}${marks} Stars: HYG 4.2, by astronexus; figures: Stellarium; both CC BY-SA 4.0.`;
  }

  /** The leaf's claim read out at the year on show: each comparison whose two sides the environment can give. */
  private readOut(r: NonNullable<SkyFigure['run']>, e: number): void {
    if (!r.readout) { this.reading.hidden = true; return; }
    const rows = comparisonsAt(this.data, r.readout, e, this.ground).filter((c) => c.value !== null);
    this.reading.hidden = rows.length === 0;
    this.reading.innerHTML = rows.map((c) => {
      const [measured, against] = c.label.split(' against ');
      const v = formatValue(c.value!, c.unit);
      const t = c.target === null ? '' : `, against ${esc(against ?? 'the target')} ${formatValue(c.target, c.unit)}`;
      return `<p><span class="sky-k">${esc(r.readout!)}</span> ${esc(measured ?? c.label)} ${v}${t}</p>`;
    }).join('');
  }

  private draw(ctx: CanvasRenderingContext2D, at: SkyAt, since: number, still: boolean, font: string): boolean {
    const r = this.run;
    if (!r) return false;
    const e = Math.round(this.epoch());
    const key = `${e} ${r.moment.date} ${r.moment.solar} ${r.moment.night}`;
    if (this.cached?.key !== key) {
      this.cached = { key, view: skyAt(this.data, e, r.moment, r.pick, this.ground) };
      this.readOut(r, e);
    }
    this.year.textContent = yearLabel(e);
    if (this.manual === null) this.input.value = String(e);
    const winding = this.manual === null && r.from !== null && (performance.now() - r.t0) / 1000 < SKY_RUN;
    return drawSky(ctx, this.cached.view, at, since, still, font, this.named) || winding;
  }
}
