/**
 * The scroll documentary, first step (docs/plan.html, phase 2): the script's
 * ten chapters as text, each with its receipts and its reply collapsed under
 * it, quieter than the claim and never omitted. The stage is a sticky panel
 * that follows the chapter in view. Each chapter's receipts are computed live
 * from the bundled database (seked.json, written by `pnpm bundle`) when it can
 * be fetched; the stills come next.
 */
import type { Claim } from '@seked/claims/browser';
import type { Database } from '@seked/data/browser';
import { setDefaultStars, type Star } from '@seked/sky/browser';
import script from '../../../docs/script.md?raw';
import { block, inline } from './markdown';
import { chapterReceipts, receiptLine } from './receipts';
import { parseScript, type Chapter } from './script';
import './style.css';

const chapters = parseScript(script);

function chapterHtml(c: Chapter): string {
  const receipts = c.receipts && !/^- None\b/.test(c.receipts)
    ? `<details class="receipts"><summary>Receipts${c.claims.length ? ` · ${c.claims.join(', ')}` : ''}</summary>` +
      `<div class="live" data-claims="${c.claims.join(',')}"></div>${block(c.receipts)}</details>`
    : '';
  return `
    <section class="chapter" id="ch${c.n}" data-n="${c.n}">
      <header><span class="num">${c.n}</span><h2>${inline(c.title)}</h2></header>
      ${c.note ? `<p class="note">${inline(c.note)}</p>` : ''}
      <div class="narration">${c.narration.map((p) => `<p>${inline(p)}</p>`).join('')}</div>
      ${receipts}
      <details class="reply"><summary>The reply</summary>
        ${c.reply.map((p) => `<p>${inline(p)}</p>`).join('')}
        ${c.sources.length ? `<p class="sources">Sources: ${c.sources.map((s) => `<code>${inline(s)}</code>`).join(', ')}</p>` : ''}
      </details>
    </section>`;
}

const app = document.querySelector<HTMLElement>('#app')!;
app.innerHTML = `
  <aside class="stage" aria-hidden="true"><div class="stage-num"></div><div class="stage-title"></div></aside>
  <main>
    <header class="masthead"><h1>How old is the Sphinx?</h1>
      <p>The strongest case for an older Giza, and the archaeologists' answer to it, in ten chapters.</p></header>
    ${chapters.map(chapterHtml).join('')}
  </main>`;

const stageNum = app.querySelector<HTMLElement>('.stage-num')!;
const stageTitle = app.querySelector<HTMLElement>('.stage-title')!;
const show = (c: Chapter) => {
  stageNum.textContent = String(c.n);
  stageTitle.textContent = c.title;
};
if (chapters[0]) show(chapters[0]);
const seen = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      const c = chapters.find((ch) => ch.n === Number((e.target as HTMLElement).dataset.n));
      if (e.isIntersecting && c) show(c);
    }
  },
  { rootMargin: '-45% 0px -45% 0px' },
);
app.querySelectorAll('.chapter').forEach((el) => seen.observe(el));

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
