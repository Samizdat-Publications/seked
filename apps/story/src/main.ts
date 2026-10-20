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
import type { Database } from '@seked/data/browser';
import { setDefaultStars, type Star } from '@seked/sky/browser';
import script from '../../../docs/script.md?raw';
import { block, inline } from './markdown';
import { chapterReceipts, receiptLine } from './receipts';
import { parseScript, type Chapter } from './script';
import { STILLS, markAnchors, markers, stillFile, type Still } from './stills';
import './style.css';

const chapters = parseScript(script);
const stillsOf = (c: Chapter) => STILLS.filter((s) => s.chapter === c.n);

/** A narration paragraph with an empty marker span before each still's anchor. */
function narrationHtml(c: Chapter, p: string): string {
  const mine = stillsOf(c);
  const { text } = markAnchors(p, mine.map((s) => s.anchor));
  return markers(inline(text), (i) => `data-still="${STILLS.indexOf(mine[i]!)}"`);
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
      <div class="narration">${c.narration.map((p) => `<p>${narrationHtml(c, p)}</p>`).join('')}</div>
      ${receipts}
      <details class="reply"><summary>The reply</summary>
        ${c.reply.map((p) => `<p>${inline(p)}</p>`).join('')}
        ${c.sources.length ? `<p class="sources">Sources: ${c.sources.map((s) => `<code>${inline(s)}</code>`).join(', ')}</p>` : ''}
      </details>
    </section>`;
}

const app = document.querySelector<HTMLElement>('#app')!;
app.innerHTML = `
  <aside class="stage">
    <div class="card"><div class="stage-num"></div><div class="stage-title"></div></div>
    <figure class="still"><img alt="" /><img alt="" /><div class="tags"></div><figcaption></figcaption></figure>
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
  caption.textContent = still.alt;
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
  for (const m of marks) {
    if (m.getBoundingClientRect().top > line) break;
    if (m.classList.contains('chapter')) {
      chapter = chapters.find((ch) => ch.n === Number(m.dataset.n)) ?? chapter;
      still = null;
    } else {
      still = STILLS[Number(m.dataset.still)] ?? null;
    }
  }
  if (chapter) show(chapter, still);
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
