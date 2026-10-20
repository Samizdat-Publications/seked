/**
 * The scroll documentary, first step (docs/plan.html, phase 2): the script's
 * ten chapters as text, each with its receipts and its reply collapsed under
 * it, quieter than the claim and never omitted. The stage is a sticky panel
 * that follows the chapter in view. Each chapter's receipts are computed live
 * from the bundled database (seked.json, written by `pnpm bundle`) when it can
 * be fetched. The stage shows the committed stills (./stills), each from the
 * beat it illustrates, crossfaded, and the chapter's number and title where
 * no still has begun.
 */
import type { Claim } from '@seked/claims/browser';
import { resolve, type Database } from '@seked/data/browser';
import { buildEnvironment } from '@seked/geometry';
import { setDefaultStars, type Star } from '@seked/sky/browser';
import script from '../../../docs/script.md?raw';
import { clock, lineAt, replyAt, schedule, timeAt, type Schedule } from './autoplay';
import { block, inline } from './markdown';
import { chapterReceipts, receiptLine } from './receipts';
import { depthRows, undrawn } from './depths';
import { depthsWidget, type DepthsWidget } from './depthswidget';
import { mapWidget, type MapWidget } from './mapwidget';
import { methodWidget, type MethodWidget } from './methodwidget';
import { PLAN_STILL, planFootprints } from './plan';
import { parseScript, type Chapter } from './script';
import { profileOf } from './profile';
import { profileWidget, type ProfileMode, type ProfileWidget } from './profilewidget';
import { SEQUENCES } from './sequence';
import { sequenceWidget, type SequenceWidget } from './sequencewidget';
import { skyWidget, type SkyWidget } from './skywidget';
import { timelineWidget, type TimelineMode, type TimelineWidget } from './timelinewidget';
import { REPLY_STILLS, STILLS, keyFrames, markAnchors, markers, splitAtFigures, stillFile, type Still } from './stills';
import './style.css';

const chapters = parseScript(script);
const stillsOf = (c: Chapter) => STILLS.filter((s) => s.chapter === c.n);

/** A narration paragraph with an empty marker span before each still's anchor. */
function narrationHtml(c: Chapter, p: string): string {
  const mine = stillsOf(c);
  const { text } = markAnchors(p, mine.map((s) => s.anchor));
  return markers(inline(text), (i) => `data-still="${STILLS.indexOf(mine[i]!)}"`);
}

/** A paragraph holding a live figure's beat is followed by room to scroll it through. */
const holds = (c: Chapter, p: string) => markAnchors(p, stillsOf(c).filter((s) => s.widget).map((s) => s.anchor)).found.length > 0;

/** The reply's pictures that follow this paragraph, captioned and tagged as the stage's are. */
function replyStillsAfter(c: Chapter, p: string): string {
  return REPLY_STILLS.filter((r) => r.chapter === c.n && markAnchors(p, [r.anchor]).found.length)
    .map((r) => `<figure class="reply-still"><img src="./${stillFile(r.src)}" alt="${r.alt}" loading="lazy" />` +
      `<figcaption>${r.alt}${r.tags.length ? ` <span class="tags">${r.tags.map((t) => `<span>${t}</span>`).join('')}</span>` : ''}` +
      `</figcaption></figure>`).join('');
}

function chapterHtml(c: Chapter): string {
  const receipts = c.receipts && !/^- None\b/.test(c.receipts)
    ? `<details class="receipts"><summary>Receipts${c.claims.length ? ` · ${c.claims.join(', ')}` : ''}</summary>` +
      `<div class="live" data-claims="${c.claims.join(',')}"></div>${block(c.receipts)}</details>`
    : '';
  return `
    <section class="chapter" id="ch${c.n}" data-n="${c.n}">
      <header><span class="num">${c.n}</span><h2>${inline(c.title)}</h2></header>
      ${c.note ? `<p class="note">${inline(c.note)}</p>` : ''}
      <div class="narration">${c.narration.flatMap((p) => splitAtFigures(p, stillsOf(c)))
        .map((p) => `<p${holds(c, p) ? ' class="hold"' : ''}>${narrationHtml(c, p)}</p>`).join('')}</div>
      ${receipts}
      <details class="reply"><summary>The reply</summary>
        ${c.reply.map((p) => `<p>${inline(p)}</p>${replyStillsAfter(c, p)}`).join('')}
        ${c.sources.length ? `<p class="sources">Sources: ${c.sources.map((s) => `<code>${inline(s)}</code>`).join(', ')}</p>` : ''}
      </details>
    </section>`;
}

const app = document.querySelector<HTMLElement>('#app')!;
app.innerHTML = `
  <aside class="stage">
    <div class="card"><div class="stage-num"></div><div class="stage-title"></div></div>
    <figure class="still"><img alt="" /><img alt="" /><div class="tags"></div><figcaption></figcaption></figure>
    <div class="caption-stage"></div>
    <div class="strip">${keyFrames().map((k) => `<figure><img src="./${stillFile(k.src)}" alt="${k.alt}" loading="lazy" />` +
      `<figcaption>${k.chapter}</figcaption></figure>`).join('')}</div>
  </aside>
  <main>
    <header class="masthead"><h1>How old is the Sphinx?</h1>
      <p>The strongest case for an older Giza, and the archaeologists' answer to it, in ten chapters.</p></header>
    ${chapters.map(chapterHtml).join('')}
  </main>`;

const stage = app.querySelector<HTMLElement>('.stage')!;
const stageNum = stage.querySelector<HTMLElement>('.stage-num')!;
const stageTitle = stage.querySelector<HTMLElement>('.stage-title')!;
const layers = [...stage.querySelectorAll<HTMLImageElement>('.still img')];
const tags = stage.querySelector<HTMLElement>('.tags')!;
const caption = stage.querySelector<HTMLElement>('figcaption')!;
let front = 0;
let shown: Still | null | undefined;
/** Chapter 5's live sky, once the bundle has loaded; until then its still stands in. */
let sky: SkyWidget | undefined;
/** Chapter 6's draw-on profile, likewise. */
let profile: ProfileWidget | undefined;
const PROFILE_MODES: (Still['widget'] & ProfileMode)[] = ['pi', 'phi', 'earth', 'north', 'row'];
const isProfile = (s: Still | null | undefined) => PROFILE_MODES.some((m) => m === s?.widget);
/** Chapter 7's timeline, likewise. */
let timeline: TimelineWidget | undefined;
const isTimeline = (s: Still | null | undefined) => s?.widget === 'ice' || s?.widget === 'dryas';
/** Chapter 8's method schematic, likewise. */
let method: MethodWidget | undefined;
/** Chapter 8's depth scale, likewise. */
let depths: DepthsWidget | undefined;
/** Chapter 7's map inset, likewise. */
let map: MapWidget | undefined;
/** Chapter 7's plan over the First Time, likewise: drawn once, through the still's own camera. */
let planEl: HTMLElement | undefined;

/** The stage's sequences, one canvas each; a beat's still stands in until its frames have loaded. */
const sequences = new Map<string, SequenceWidget>(Object.values(SEQUENCES).map((q) => [q.id, sequenceWidget(q)]));
for (const w of sequences.values()) stage.append(w.el);
const sequenceOf = (s: Still | null | undefined) => (s?.widget === 'sequence' && s.sequence ? sequences.get(s.sequence) : undefined);
/** A sequence's frames start loading once the reader reaches the chapter before its own. */
function loadAhead(n: number) {
  for (const s of STILLS) {
    const w = sequenceOf(s);
    if (w && !w.ready() && s.chapter <= n + 1) {
      w.load().then(() => {
        shown = undefined;
        follow();
      }, (err) => console.warn('the still stands in for the sequence:', err));
    }
  }
}

/** The page's own lighter copy of each still (vite.config.ts). */
const url = (s: Still) => `./${stillFile(s.src)}`;

/** Show a still, crossfading from the last, or the chapter's card when `still` is null. */
function show(c: Chapter, still: Still | null) {
  stageNum.textContent = String(c.n);
  stageTitle.textContent = c.title;
  if (still === shown) return;
  shown = still;
  stage.classList.toggle('has-still', !!still);
  stage.classList.toggle('whole', !!still?.whole);
  stage.classList.toggle('sky-on', still?.widget === 'sky' && !!sky);
  stage.classList.toggle('strip-on', still?.widget === 'strip');
  stage.classList.toggle('caption-on', still?.widget === 'caption');
  if (still?.caption) stage.querySelector<HTMLElement>('.caption-stage')!.textContent = still.caption;
  stage.classList.toggle('profile-on', isProfile(still) && !!profile);
  stage.classList.toggle('timeline-on', isTimeline(still) && !!timeline);
  stage.classList.toggle('map-on', still?.widget === 'map' && !!map);
  stage.classList.toggle('depths-on', still?.widget === 'depths' && !!depths);
  stage.classList.toggle('method-on', still?.widget === 'method' && !!method);
  stage.classList.toggle('plan-on', still?.widget === 'plan' && !!planEl);
  const seq = sequenceOf(still);
  for (const w of sequences.values()) w.el.classList.toggle('on', w === seq && w.ready());
  if (!still) {
    layers.forEach((l) => l.classList.remove('on'));
    return;
  }
  const back = layers[1 - front]!;
  const reveal = () => {
    if (shown !== still) return;
    back.classList.add('on');
    layers[front]!.classList.remove('on');
    front = 1 - front;
  };
  back.alt = still.alt;
  back.classList.toggle('whole', !!still.whole);
  caption.textContent = seq?.ready() ? seq.sequence.alt : still.alt;
  tags.innerHTML = still.tags.map((t) => `<span>${t}</span>`).join('');
  if (back.getAttribute('src') === url(still) && back.complete) reveal();
  else {
    back.onload = reveal;
    back.src = url(still);
  }
}

/**
 * The stage follows the last marker above the middle of the window: a chapter's top shows its card, a
 * beat's marker its still. Markers are read in document order, so a still holds until the next beat.
 */
const marks = [...app.querySelectorAll<HTMLElement>('.chapter, .beat')];
function follow() {
  const line = innerHeight * 0.55;
  let chapter = chapters[0];
  let still: Still | null = null;
  let since = 0;
  let until = Infinity;
  for (const m of marks) {
    const top = m.getBoundingClientRect().top;
    if (top > line) {
      until = top - line;
      break;
    }
    since = line - top;
    if (m.classList.contains('chapter')) {
      chapter = chapters.find((ch) => ch.n === Number(m.dataset.n)) ?? chapter;
      still = null;
    } else {
      still = STILLS[Number(m.dataset.still)] ?? null;
    }
  }
  if (chapter) {
    loadAhead(chapter.n);
    show(chapter, still);
  }
  // a sequence runs once through over the same share of the way to the next beat as the figures below
  const seq = sequenceOf(still);
  if (seq) seq.progress(since / (0.8 * Math.min(since + until, 0.9 * innerHeight)));
  // the live sky runs from today to the claim's epoch over the first 80 per cent of the way to the next beat
  if (still?.widget === 'sky' && sky) sky.progress(since / (0.8 * (since + until)));
  // the profile is drawn on over the same share of the way to the next beat, or of most of a screen if that is
  // nearer: chapter 6's later beats have no still of their own, so its next beat is chapter 7's
  if (isTimeline(still) && timeline) timeline.progress(still!.widget as TimelineMode, since / (0.8 * Math.min(since + until, 0.9 * innerHeight)));
  if (still?.widget === 'method' && method) method.progress(since / (0.8 * Math.min(since + until, 0.9 * innerHeight)));
  if (still?.widget === 'depths' && depths) depths.progress(since / (0.8 * Math.min(since + until, 0.9 * innerHeight)));
  if (still?.widget === 'map' && map) map.progress(since / (0.8 * Math.min(since + until, 0.9 * innerHeight)));
  if (isProfile(still) && profile) profile.progress(still!.widget as ProfileMode, since / (0.8 * Math.min(since + until, 0.9 * innerHeight)));
}
let queued = false;
addEventListener('scroll', () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    follow();
  });
}, { passive: true });
addEventListener('resize', follow);
follow();

/**
 * The bundle sits beside the page in development (Vite serves apps/web/public) and beside the viewer on the
 * site (viewer/seked.json). Without it the receipts stay as the script writes them, and the page says so.
 */
async function liveReceipts() {
  type Bundle = Database & { claims: Claim[]; stars: Star[] };
  let bundle: Bundle | undefined;
  for (const url of ['./seked.json', '../viewer/seked.json']) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        bundle = (await r.json()) as Bundle;
        break;
      }
    } catch {
      // try the next place
    }
  }
  // the dated claims read the named stars, which the bundle carries, as the viewer registers them
  if (bundle) setDefaultStars(bundle.stars);
  const c4 = bundle?.claims.find((c) => c.id === 'C4');
  if (bundle && c4) {
    const { sources, sites, structures, measurements, presets, materials } = bundle;
    const env = buildEnvironment(resolve({ sources, sites, structures, measurements, presets, materials }, 'canonical').values);
    sky = skyWidget(c4, env);
    stage.append(sky.el);
    timeline = timelineWidget(bundle.claims);
    stage.append(timeline.el);
    map = mapWidget(env['earth.radius.mean']!);
    stage.append(map.el);
    try {
      const { width: W, height: H } = PLAN_STILL;
      planEl = document.createElement('div');
      planEl.className = 'plan';
      planEl.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img"
        aria-label="The three pyramids' bases drawn where the claim says the plan lay">
        ${planFootprints(env as Record<string, number>).map((f) => {
          const pts = f.corners.map((c) => `${(c.x * W).toFixed(1)},${(c.y * H).toFixed(1)}`).join(' ');
          const low = f.corners.reduce((a, c) => (c.y > a.y ? c : a));
          return `<polygon points="${pts}" /><text x="${(low.x * W).toFixed(1)}" y="${(low.y * H + 22).toFixed(1)}">${f.name}</text>`;
        }).join('')}
        <text class="title" x="${W / 2}" y="${H * 0.36}">the plan, as the claim has it</text></svg>`;
      stage.append(planEl);
    } catch (err) {
      console.warn('chapter 7 keeps its still without the plan:', err);
    }
    if (env['g2.sar.radar.penetration.max'] !== undefined && env['g2.height.original'] !== undefined) {
      method = methodWidget(env['g2.sar.radar.penetration.max'], env['g2.height.original']);
      stage.append(method.el);
    }
    try {
      depths = depthsWidget(depthRows(env, structures), undrawn(structures));
      stage.append(depths.el);
    } catch (err) {
      console.warn('chapter 8 keeps its still without the depth scale:', err); // a record missing from the bundle
    }
    try {
      profile = profileWidget(profileOf(env, bundle.claims));
      stage.append(profile.el);
    } catch (err) {
      console.warn('chapter 6 keeps its stills:', err); // a claim or a length missing from the bundle
    }
    shown = undefined;
    follow();
  }
  for (const el of app.querySelectorAll<HTMLElement>('.live')) {
    const ids = (el.dataset.claims ?? '').split(',').filter(Boolean);
    if (!ids.length) continue;
    if (!bundle) {
      el.innerHTML = '<p class="quiet">Live receipts need the bundled database (pnpm bundle).</p>';
      continue;
    }
    const { sources, sites, structures, measurements, presets, materials } = bundle;
    const results = chapterReceipts({ sources, sites, structures, measurements, presets, materials }, bundle.claims, ids);
    el.innerHTML = results
      .map((r) => `<p><strong>${inline(r.id)}, ${inline(r.title)}</strong>: ` +
        `${r.fits === undefined ? 'not computed yet' : r.fits ? 'holds' : 'does not hold'}, ` +
        `${r.freeChoices} free choice${r.freeChoices === 1 ? '' : 's'}</p>` +
        `<ul>${r.comparisons.map((c) => `<li>${inline(receiptLine(c))}</li>`).join('')}</ul>`)
      .join('');
  }
}
void liveReceipts();

/**
 * Autoplay: the play button runs the page's clock, and the scroll follows the narration's schedule
 * (src/autoplay.ts). Any hand on the page pauses it. Until the voice is recorded it is silent and timed at the
 * script's rate, which the button's note says. `window.seked.seek(t)` sets the clock for a capture script.
 */
const reading = () => innerHeight * 0.55;
const paragraphEls = [...app.querySelectorAll<HTMLElement>('.narration p')];
const plan: Schedule = schedule(chapters.map((c) => ({
  n: c.n,
  paragraphs: paragraphEls.filter((p) => p.closest<HTMLElement>('.chapter')?.dataset.n === String(c.n)).map((p) => p.textContent ?? ''),
  reply: c.spokenReply,
})));
const boxes = (): [number, number][] => paragraphEls.map((p) => {
  const r = p.getBoundingClientRect();
  return [r.top + scrollY, r.bottom + scrollY];
});
const player = document.createElement('div');
player.className = 'player';
player.innerHTML = '<button type="button" aria-label="Play">▶</button><span class="clock"></span>' +
  '<span class="player-note">silent, timed at 150 words a minute until the voice is recorded</span>';
stage.append(player);   // on the stage's top right, over the picture, so it never covers the text
const button = player.querySelector('button')!;
const clockEl = player.querySelector<HTMLElement>('.clock')!;
const subtitle = document.createElement('div');
subtitle.className = 'subtitle';
stage.append(subtitle);
let now = 0;
let playing = false;
let lastFrame = 0;

function seek(t: number) {
  now = Math.min(Math.max(t, 0), plan.duration);
  scrollTo(0, lineAt(now, plan, boxes()) - reading());
  const reply = replyAt(now, plan);
  subtitle.textContent = reply ? reply.text : '';
  stage.classList.toggle('subtitle-on', !!reply);
  clockEl.textContent = `${clock(now)} / ${clock(plan.duration)}`;
  follow();
}
function tick(at: number) {
  if (!playing) return;
  seek(now + (at - lastFrame) / 1000);
  lastFrame = at;
  if (now >= plan.duration) pause();
  else requestAnimationFrame(tick);
}
function play() {
  if (playing) return;
  playing = true;
  button.textContent = '❚❚';
  button.setAttribute('aria-label', 'Pause');
  now = scrollY < 10 ? 0 : timeAt(scrollY + reading(), plan, boxes());
  lastFrame = performance.now();
  requestAnimationFrame(tick);
}
function pause() {
  playing = false;
  button.textContent = '▶';
  button.setAttribute('aria-label', 'Play');
  stage.classList.remove('subtitle-on');
}
button.addEventListener('click', () => (playing ? pause() : play()));
for (const e of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) {
  addEventListener(e, (ev) => {
    // the button's own click and keys are the player's; a wheel or a touch anywhere is the reader's hand
    if (playing && (e === 'wheel' || e === 'touchstart' || !player.contains(ev.target as Node))) pause();
  }, { passive: true });
}
clockEl.textContent = `0:00 / ${clock(plan.duration)}`;
(window as unknown as { seked: unknown }).seked = { duration: plan.duration, schedule: plan, seek, play, pause };
