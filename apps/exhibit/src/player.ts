/**
 * Narrated play: each leaf is put on the stage, speaks its words (its span of the chapter's recording, with each
 * word's recorded time; the browser's own voice only for words not in the recording), shows them as the caption,
 * holds, and moves on. Any drag or key
 * on the view pauses play and hands the visitor the view; play resumes from that leaf.
 */
import { isFigure } from './figures';
import { type Leaf, drawCue, figureCues, leafCues } from './leaves';
import { type ChapterRecording, type Span, leafSpans, recordingUrl } from './narration';
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
  /** Called when play starts, before the first word. */
  onPlay: () => void = () => {};
  /** Called when a leaf is put on the stage. */
  onLeaf: (leaf: Leaf) => void = () => {};
  /** Show one of the exhibit's own figures (src/figures.ts), or put it away with null. */
  onFigure: (id: string | null) => void = () => {};
  /** Figures waiting for their words, in order. */
  private pendingFigures: { id: string; at: number; cued: boolean }[] = [];

  private token = 0;
  /** The recorded voice's element (public for capture and test scripts, through window.seked). */
  readonly audio = new Audio();
  /** Each chapter's recording, loaded once: its audio's address and each leaf's span in it (null without one). */
  private recordings = new Map<number, Promise<{ url: string; spans: Map<string, Span> } | null>>();
  /** The word index that starts the leaf's overlay, in play. */
  private cueAt = -1;
  private timers: number[] = [];
  private shown = -1;

  private word(k: number): void {
    if (k >= this.cueAt && this.cueAt >= 0) { this.cueAt = -1; this.stage.startOverlay(); }
    while (this.pendingFigures[0] && this.pendingFigures[0].at >= 0 && k >= this.pendingFigures[0].at) this.onFigure(this.pendingFigures.shift()!.id);
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
    const drawn = L.draw[0] ? drawCue(L.draw[0]) : null;
    const cue = drawn && !isFigure(drawn.overlay) ? drawn : null;   // a figure is the page's, not the stage's
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
    this.setFigure(L);
    history.replaceState(null, '', searchWithLeaf(location.search, L.id));
    const samePlace = !!from && from.station === L.station && from.moment === L.moment;
    const begin = () => { if (token === this.token && this.playing) this.whenReady(token, () => this.speak(token)); };
    // the way in follows from what is on screen, so a jump through the chapter list arrives as sensibly as play
    if (samePlace && from.era === L.era) this.stage.turn(this.shot(L), begin);
    else if (samePlace) this.stage.wipe(this.shot(L), this.otherFor(from), begin);
    else if (from && L.arrive === 'flight' && from === this.leaves[i - 1] && this.playing) this.fly(from, L, token, begin);
    else { this.stage.show(this.shot(L)); begin(); }
    this.offerCompare();
    void this.recording(L.chapter);
    const next = this.leaves[i + 1];
    if (next) void this.recording(next.chapter);
    const ahead = next && { yaw: next.view.yaw * DEG, pitch: next.view.pitch * DEG, fov: next.view.fov * DEG };
    if (next) for (const p of this.panoramas(next)) this.stage.prefetch(this.manifest.byId[next.station]!, next.era, p, ahead);
  }

  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.onPlay();
    this.stage.compare(null);
    if (this.leaf.draw[0] && drawCue(this.leaf.draw[0]).word) this.stage.cueOverlay();
    this.setFigure(this.leaf);
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
    this.showPendingFigure();
    this.offerCompare();
  }

  /**
   * A leaf's figures: paused, the last of them now; in play, the last one with no cue now and each cued one put away
   * until its word.
   */
  private setFigure(L: Leaf): void {
    const cues = figureCues(L, isFigure);
    const now = this.playing ? cues.filter((c) => !c.cued) : cues;
    this.pendingFigures = this.playing ? cues.filter((c) => !now.includes(c)) : [];
    this.onFigure(now[now.length - 1]?.id ?? null);
  }

  private showPendingFigure(): void {
    const last = this.pendingFigures[this.pendingFigures.length - 1];
    this.pendingFigures = [];
    if (last) this.onFigure(last.id);
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

  /** A chapter's recording (narration/chN.json and its mp3), with each of its leaves' spans; null without one. */
  private recording(chapter: number): Promise<{ url: string; spans: Map<string, Span> } | null> {
    let r = this.recordings.get(chapter);
    if (!r) {
      r = (async () => {
        try {
          const res = await fetch(new URL(recordingUrl(chapter), location.href));
          if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null;
          const rec = ((await res.json()) as ChapterRecording).files.narration;
          if (!rec) return null;
          const mine = this.leaves.filter((L) => L.chapter === chapter);
          const spans = new Map<string, Span>();
          leafSpans(rec, mine.map((L) => L.say)).forEach((s, k) => { if (s) spans.set(mine[k]!.id, s); });
          // the whole file, played from memory: a blob can always be sought, whatever the server does with ranges
          const audio = await fetch(new URL(recordingUrl(chapter, rec.file), location.href));
          if (!audio.ok) return null;
          return { url: URL.createObjectURL(await audio.blob()), spans };
        } catch {
          return null;
        }
      })();
      this.recordings.set(chapter, r);
    }
    return r;
  }

  /**
   * Play a leaf's span of its chapter's recording, the words cued from the audio's own clock; `fallback` if the
   * audio will not play. Stops at the span's end and calls `end`.
   */
  private playSpan(token: number, url: string, span: Span, end: () => void, fallback: () => void): void {
    const a = this.audio;
    this.words = span.words;
    let k = 0, failed = false;
    const fail = () => { if (failed || token !== this.token) return; failed = true; a.pause(); fallback(); };
    const tick = () => {
      if (token !== this.token || failed) return;
      const t = a.currentTime - span.start;
      while (k < span.words.length && span.words[k]!.at <= t) this.word(k++);
      if (a.currentTime >= span.end || a.ended) { a.pause(); end(); return; }
      requestAnimationFrame(tick);
    };
    const go = () => {
      if (token !== this.token) return;
      a.currentTime = span.start;
      a.play().then(tick, fail);
    };
    a.onerror = fail;
    if (a.src !== url) { a.src = url; a.preload = 'auto'; }
    if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true });
    // audio that stalls still lets play go on
    this.later((span.end - span.start + 6) * 1000, () => { if (token === this.token && !failed) { a.pause(); end(); } });
  }

  private cancel(): void {
    this.audio.pause();
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
    this.cueAt = leafCues(L, isFigure).line;
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
    void this.recording(L.chapter).then((r) => {
      if (token !== this.token) return;
      const span = r?.spans.get(L.id);
      if (r && span) this.playSpan(token, r.url, span, end, () => { console.info(`${L.id}: the recording would not play, so the browser's voice says it`); this.speakAloud(token, L, end); });
      else {
        if (r) console.info(`${L.id}: its words are not in chapter ${L.chapter}'s recording, so the browser's voice says them`);
        this.speakAloud(token, L, end);
      }
    });
  }

  /** The browser's own voice, its word boundaries the timing; an estimate when there is no voice or it stalls. */
  private speakAloud(token: number, L: Leaf, end: () => void): void {
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
