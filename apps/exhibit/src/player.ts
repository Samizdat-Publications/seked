/**
 * Narrated play: each leaf is put on the stage, speaks its words (the browser's own voice until the recorded one
 * exists, its word-boundary events the timing), shows them as the caption, holds, and moves on. Any drag or key
 * on the view pauses play and hands the visitor the view; play resumes from that leaf.
 */
import { type Leaf, cueIndex, drawCue } from './leaves';
import type { Manifest } from './manifest';
import { type Chapter, chapterStarts, flightFile, searchWithLeaf, wordTimes } from './play';
import { DEG } from './projection';
import type { Other, Shot, Stage } from './stage';

/** How long play waits for a leaf's panorama before speaking over the blank anyway. */
const READY_WAIT_MS = 8000;

export interface PlayerUi {
  caption: HTMLElement;
  place: HTMLElement;
  when: HTMLElement;
  pill: HTMLElement;
  play: HTMLButtonElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  chapterBtn: HTMLButtonElement;
  chapterList: HTMLElement;
  count: HTMLElement;
  flight: HTMLVideoElement;
}

const HONESTY: Record<string, string> = { claim: 'Theorized', reconstruction: 'Reconstruction', survey: 'Survey' };

export class Player {
  index = 0;
  playing = false;
  /** Each word's start in seconds as last spoken: the voice's own times, or the estimate. E4 draws lines on by it. */
  words: { word: string; at: number }[] = [];
  /** Called as each word of the leaf is reached, with its index. */
  onWord: (i: number) => void = () => {};
  /** Called when a leaf is put on the stage. */
  onLeaf: (leaf: Leaf) => void = () => {};

  private token = 0;
  /** The word index that starts the leaf's overlay, in play. */
  private cueAt = -1;
  private timers: number[] = [];
  private shown = -1;

  private word(k: number): void {
    if (k >= this.cueAt && this.cueAt >= 0) { this.cueAt = -1; this.stage.startOverlay(); }
    this.onWord(k);
  }

  constructor(private stage: Stage, private manifest: Manifest, private leaves: readonly Leaf[], private chapters: readonly Chapter[],
    private ui: PlayerUi, private panoramas: (leaf: Leaf) => string[]) {
    stage.onHandsOn = () => { if (this.playing) this.pause(); };
    ui.play.addEventListener('click', () => (this.playing ? this.pause() : this.play()));
    ui.prev.addEventListener('click', () => this.go(this.index - 1));
    ui.next.addEventListener('click', () => this.go(this.index + 1));
    ui.chapterBtn.addEventListener('click', () => this.toggleChapters());
    document.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && t !== document.body && t.tagName !== 'CANVAS' && t !== document.documentElement) return;
      if (e.key === ' ') { e.preventDefault(); this.playing ? this.pause() : this.play(); }
      else if (e.key === 'PageDown') { e.preventDefault(); this.go(this.index + 1); }
      else if (e.key === 'PageUp') { e.preventDefault(); this.go(this.index - 1); }
      else if (e.key === 'Escape') this.toggleChapters(false);
    });
    this.buildChapters();
    window.speechSynthesis?.getVoices();   // Chrome loads its voices on first asking
  }

  get leaf(): Leaf { return this.leaves[this.index]!; }

  shot(L: Leaf): Shot {
    const station = this.manifest.byId[L.station]!;
    const cue = L.draw[0] ? drawCue(L.draw[0]) : null;
    return {
      station, era: L.era, yaw: L.view.yaw * DEG, pitch: L.view.pitch * DEG, fov: L.view.fov * DEG, panoramas: this.panoramas(L),
      // in play a cued line waits for its word; stepping by hand, or paused, it draws at once
      overlay: cue?.overlay ?? null, overlayCued: !!cue?.word && this.playing,
    };
  }

  /** Show a leaf; if playing, speak it and go on. The arrival is a turn when the leaf stays in the panorama on screen. */
  go(i: number): void {
    if (i < 0 || i >= this.leaves.length) return;
    const from = this.shown >= 0 ? this.leaves[this.shown] : undefined;
    this.index = i;
    this.shown = i;
    const L = this.leaf;
    this.cancel();
    const token = this.token;
    this.label(L);
    this.onLeaf(L);
    history.replaceState(null, '', searchWithLeaf(location.search, L.id));
    const samePlace = !!from && from.station === L.station && from.moment === L.moment;
    const begin = () => { if (token === this.token && this.playing) this.whenReady(token, () => this.speak(token)); };
    // the way in follows from what is on screen, so a jump through the chapter list arrives as sensibly as play
    if (samePlace && from.era === L.era) this.stage.turn(this.shot(L), begin);
    else if (samePlace) this.stage.wipe(this.shot(L), this.otherFor(from), begin);
    else if (from && L.arrive === 'flight' && from === this.leaves[i - 1] && this.playing) this.fly(from, L, token, begin);
    else { this.stage.show(this.shot(L)); begin(); }
    this.offerCompare();
    const next = this.leaves[i + 1];
    if (next) for (const p of this.panoramas(next)) this.stage.prefetch(this.manifest.byId[next.station]!, next.era, p);
  }

  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.stage.compare(null);
    if (this.leaf.draw[0] && drawCue(this.leaf.draw[0]).word) this.stage.cueOverlay();
    this.ui.play.setAttribute('aria-pressed', 'true');
    this.ui.play.setAttribute('aria-label', 'Pause');
    document.body.classList.add('playing');
    this.cancel();
    const token = this.token;
    // back to the leaf's own view if the visitor looked away, then its words from the start
    this.stage.turn(this.shot(this.leaf), () => { if (token === this.token && this.playing) this.whenReady(token, () => this.speak(token)); });
  }

  pause(): void {
    this.playing = false;
    this.ui.play.setAttribute('aria-pressed', 'false');
    this.ui.play.setAttribute('aria-label', 'Play');
    document.body.classList.remove('playing');
    this.cancel();
    this.stage.startOverlay();   // a line still waiting for its word is drawn now
    this.offerCompare();
  }

  /** The era a leaf is in, as the other side of a wipe or a comparison. */
  private otherFor(L: Leaf): Other {
    return { era: L.era, title: this.manifest.stateById[L.era]?.title ?? L.era, panoramas: this.panoramas(L) };
  }

  /**
   * Paused on a leaf the visitor may compare eras on, the edge comes out at the side: dragging it shows the era
   * this panorama was last in, the nearest leaf before at the same station and moment in another era.
   */
  private offerCompare(): void {
    const L = this.leaf;
    if (this.playing || L.interact !== 'era') { this.stage.compare(null); return; }
    for (let i = this.index - 1; i >= 0; i--) {
      const P = this.leaves[i]!;
      if (P.station !== L.station || P.moment !== L.moment) break;
      if (P.era !== L.era) { this.stage.compare(this.otherFor(P)); return; }
    }
    this.stage.compare(null);
  }

  /**
   * Play the flight into a leaf full screen, the panorama set to the leaf's view behind it, and hand over on its
   * last frame. No film yet (or one that will not play) is a cut. Flights play only in narrated play: stepping
   * by hand goes straight to the leaf.
   */
  private fly(from: Leaf, to: Leaf, token: number, then: () => void): void {
    const v = this.ui.flight;
    const land = () => {
      v.onended = v.onerror = v.oncanplay = null;
      v.hidden = true;
      v.removeAttribute('src');
      v.load();
      if (token === this.token) then();
    };
    this.stage.show(this.shot(to));   // behind the film, so the last frame hands over to the same view
    if (this.stage.still) { land(); return; }
    v.onerror = land;
    v.onended = land;
    v.oncanplay = () => {
      v.oncanplay = null;
      if (token !== this.token) return land();
      v.hidden = false;
      v.play().catch(land);
    };
    v.src = new URL(flightFile(from, to), location.href).href;
    this.landing = land;
  }

  private landing: (() => void) | null = null;

  private cancel(): void {
    const land = this.landing;
    this.landing = null;
    this.token++;
    land?.();   // after the token moves on, so a flight cut short does not start the next words
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    window.speechSynthesis?.cancel();
  }

  private later(ms: number, f: () => void): void { this.timers.push(window.setTimeout(f, ms)); }

  private whenReady(token: number, f: () => void): void {
    const t0 = performance.now();
    const check = () => {
      if (token !== this.token) return;
      if (this.stage.ready || performance.now() - t0 > READY_WAIT_MS) f();
      else this.later(120, check);
    };
    check();
  }

  /** Say the leaf's words; when they end, hold, then go on. */
  private speak(token: number): void {
    const L = this.leaf;
    const cue = L.draw[0] ? drawCue(L.draw[0]) : null;
    this.cueAt = cue?.word ? cueIndex(L.say, cue.word) : -1;
    let ended = false;
    const end = () => {
      if (ended || token !== this.token) return;
      ended = true;
      this.later(L.hold * 1000, () => {
        if (token !== this.token || !this.playing) return;
        if (this.index + 1 < this.leaves.length) this.go(this.index + 1);
        else this.pause();
      });
    };
    // the estimate, used as it stands when there is no voice, and as a watchdog when the voice goes quiet
    const estimate = wordTimes(L.say);
    const last = estimate[estimate.length - 1];
    const estimated = (last ? last.at : 0) + 0.6;
    const timed = () => {
      this.words = estimate;
      estimate.forEach((w, k) => this.later(w.at * 1000, () => { if (token === this.token) this.word(k); }));
      this.later(estimated * 1000, end);
    };
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') { timed(); return; }
    const u = new SpeechSynthesisUtterance(L.say);
    const voice = pickVoice(synth.getVoices());
    if (voice) u.voice = voice;
    u.rate = 0.95;
    const starts = wordStarts(L.say);
    const heard: { word: string; at: number }[] = [];
    let t0 = 0, started = false;
    u.onstart = () => { started = true; t0 = performance.now(); };
    u.onboundary = (e) => {
      if (token !== this.token || e.name !== 'word') return;
      const k = starts.findIndex((s) => s >= e.charIndex);
      if (k < 0) return;
      heard[k] = { word: estimate[k]!.word, at: (performance.now() - t0) / 1000 };
      this.words = estimate.map((w, j) => heard[j] ?? w);
      this.word(k);
    };
    u.onend = end;
    u.onerror = () => { if (!started) timed(); else end(); };
    synth.speak(u);
    // no voice at all (some browsers, a machine without voices): the caption still runs on the estimate
    this.later(1500, () => { if (!started && token === this.token) { synth.cancel(); timed(); } });
    // a voice that stalls mid-leaf (Chrome drops long utterances) still lets play go on
    this.later((estimated / 0.95 + 4) * 1000, end);
  }

  private label(L: Leaf): void {
    const st = this.manifest.byId[L.station];
    const state = this.manifest.stateById[L.era];
    this.ui.caption.textContent = L.say;
    this.ui.place.textContent = st?.name ?? L.station;
    this.ui.when.textContent = state ? `${state.title}, ${state.label}` : L.era;
    const h = state?.honesty ?? '';
    this.ui.pill.textContent = HONESTY[h] ?? '';
    this.ui.pill.className = `pill ${h}`;
    this.ui.pill.hidden = !this.ui.pill.textContent;
    this.ui.prev.disabled = this.index === 0;
    this.ui.next.disabled = this.index === this.leaves.length - 1;
    const ch = this.chapters.find((c) => c.n === L.chapter);
    this.ui.chapterBtn.textContent = ch ? `${ch.n}. ${ch.title}` : `Chapter ${L.chapter}`;
    this.ui.count.textContent = `${this.index + 1} / ${this.leaves.length}`;
    for (const b of this.ui.chapterList.querySelectorAll('button')) {
      if (Number(b.dataset.chapter) === L.chapter) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    }
    document.title = ch ? `${ch.title}: Seked` : 'Seked';
  }

  private buildChapters(): void {
    const list = this.ui.chapterList;
    list.replaceChildren();
    for (const { chapter, index } of chapterStarts(this.leaves, this.chapters)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.chapter = String(chapter.n);
      b.innerHTML = `<span class="n"></span><span class="t"></span>`;
      b.querySelector('.n')!.textContent = String(chapter.n);
      b.querySelector('.t')!.textContent = chapter.title;
      b.addEventListener('click', () => { this.toggleChapters(false); this.go(index); });
      list.append(b);
    }
  }

  private toggleChapters(open?: boolean): void {
    const list = this.ui.chapterList;
    const show = open ?? list.hidden;
    list.hidden = !show;
    this.ui.chapterBtn.setAttribute('aria-expanded', String(show));
  }
}

/** Where each word of a text begins, as a character index, to match the voice's boundary events. */
export function wordStarts(text: string): number[] {
  return [...text.matchAll(/\S+/g)].map((m) => m.index ?? 0);
}

/** An English voice, a natural-sounding one where the browser has it. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
  return en.find((v) => /natural|neural|premium|enhanced/i.test(v.name) && /GB|UK/i.test(v.lang + v.name))
    ?? en.find((v) => /natural|neural|premium|enhanced/i.test(v.name))
    ?? en.find((v) => /GB/i.test(v.lang))
    ?? en[0] ?? null;
}
