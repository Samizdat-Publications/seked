/**
 * The receipt and the reply: a small tab at the edge of the screen on every leaf that has them, closed by
 * default. Open, it gives the archaeologists' reply from docs/script.md, quieter than the claim and never
 * omitted, and the receipts of the claims the leaf names, computed live from the bundled database.
 */
import type { Claim } from '@seked/claims/browser';
import type { Database } from '@seked/data/browser';
import type { Leaf } from './leaves';
import { scriptPart } from './play';
import { leafReceipts, receiptLine } from './receipts';

type Bundle = Database & { claims: Claim[] };

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** The script's inline marks: code, bold and italics, everything escaped first. */
export function inline(s: string): string {
  return escape(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, '$1<em>$2</em>');
}

/** A chapter's reply in the script: the spoken line, and the full reply behind it. */
export function chapterReply(script: string, chapter: number): { spoken: string; full: string } {
  return { spoken: scriptPart(script, chapter, 'Spoken reply'), full: scriptPart(script, chapter, 'The reply') };
}

let bundle: Promise<Bundle | null> | null = null;
/** The bundled database (`pnpm bundle`), beside the page or beside the viewer on the site; null without it. */
function loadBundle(): Promise<Bundle | null> {
  bundle ??= (async () => {
    for (const url of ['./seked.json', '../viewer/seked.json']) {
      try {
        const r = await fetch(url);
        if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) return (await r.json()) as Bundle;
      } catch { /* try the next place */ }
    }
    return null;
  })();
  return bundle;
}

export class Panel {
  /** Called when the visitor opens the panel, so play can pause while they read. */
  onOpen: () => void = () => {};
  private tab: HTMLButtonElement;
  private aside: HTMLElement;
  private leaf: Leaf | null = null;

  constructor(root: HTMLElement, private script: string) {
    this.tab = document.createElement('button');
    this.tab.type = 'button';
    this.tab.className = 'tab';
    this.tab.setAttribute('aria-expanded', 'false');
    this.tab.setAttribute('aria-controls', 'reply');
    this.tab.hidden = true;
    this.tab.addEventListener('click', () => this.toggle());
    this.aside = document.createElement('aside');
    this.aside.className = 'reply';
    this.aside.id = 'reply';
    this.aside.hidden = true;
    this.aside.setAttribute('aria-label', "The receipt and the archaeologists' reply");
    root.append(this.tab, this.aside);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !this.aside.hidden) this.toggle(false); });
  }

  /** Put the tab on a leaf: shown when the leaf has a reply or receipts; an open panel follows the leaf. */
  show(leaf: Leaf): void {
    this.leaf = leaf;
    const reply = chapterReply(this.script, Number(leaf.reply.slice(2)));
    const has = !!(reply.full || reply.spoken), receipts = leaf.receipts.length > 0;
    this.tab.hidden = !has && !receipts;
    this.tab.textContent = receipts ? (has ? 'Receipt and reply' : 'Receipt') : 'The reply';
    if (this.tab.hidden) this.toggle(false);
    else if (!this.aside.hidden) this.fill();
  }

  toggle(open?: boolean): void {
    const show = open ?? this.aside.hidden === true;
    if (show === (this.aside.hidden !== true)) return;
    this.aside.hidden = !show;
    this.tab.setAttribute('aria-expanded', String(show));
    document.body.classList.toggle('reading', show);
    if (show) { this.fill(); this.onOpen(); }
  }

  private fill(): void {
    const L = this.leaf;
    if (!L) return;
    const reply = chapterReply(this.script, Number(L.reply.slice(2)));
    const paras = reply.full.split(/\n\s*\n/).map((p) => `<p>${inline(p.trim())}</p>`).join('');
    this.aside.innerHTML = `
      <button type="button" class="reply-x" aria-label="Close">&times;</button>
      ${L.receipts.length ? '<section class="receipts"><h2>The receipt</h2><div class="live"><p class="quiet">Computing from the database</p></div></section>' : ''}
      ${reply.spoken || reply.full ? `<section class="answer"><h2>The archaeologists' reply</h2>
        ${reply.spoken ? `<p class="spoken">${inline(reply.spoken)}</p>` : ''}${paras}</section>` : ''}`;
    this.aside.querySelector('.reply-x')!.addEventListener('click', () => this.toggle(false));
    if (L.receipts.length) void this.receipts(L);
  }

  private async receipts(L: Leaf): Promise<void> {
    const el = this.aside.querySelector('.live');
    const b = await loadBundle();
    if (!el || this.leaf !== L) return;
    if (!b) { el.innerHTML = '<p class="quiet">The receipts are computed from the bundled database (pnpm bundle), which this copy of the site lacks.</p>'; return; }
    const { sources, sites, structures, measurements, presets, materials } = b;
    const results = leafReceipts({ sources, sites, structures, measurements, presets, materials }, b.claims, L.receipts);
    el.innerHTML = results.length ? results.map((r) => `<p><strong>${inline(r.id)}, ${inline(r.title)}</strong>: ` +
      `${r.fits === undefined ? 'not computed yet' : r.fits ? 'holds' : 'does not hold'}, ` +
      `${r.freeChoices} free choice${r.freeChoices === 1 ? '' : 's'}</p>` +
      `<ul>${r.comparisons.map((c) => `<li>${inline(receiptLine(c))}</li>`).join('')}</ul>`).join('')
      : '<p class="quiet">None of the claims this leaf names is in the database yet.</p>';
  }
}
