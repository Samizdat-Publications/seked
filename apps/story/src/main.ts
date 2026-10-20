/**
 * The scroll documentary, first step (docs/plan.html, phase 2): the script's
 * ten chapters as text, each with its receipts and its reply collapsed under
 * it, quieter than the claim and never omitted. The stage is a sticky panel
 * that follows the chapter in view; the stills and the live receipts come next.
 */
import script from '../../../docs/script.md?raw';
import { block, inline } from './markdown';
import { parseScript, type Chapter } from './script';
import './style.css';

const chapters = parseScript(script);

function chapterHtml(c: Chapter): string {
  const receipts = c.receipts && !/^- None\b/.test(c.receipts)
    ? `<details class="receipts"><summary>Receipts${c.claims.length ? ` · ${c.claims.join(', ')}` : ''}</summary>${block(c.receipts)}</details>`
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
