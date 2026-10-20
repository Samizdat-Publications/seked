/**
 * Assemble the static site: the landing page (apps/home) at the root, the
 * path-traced walkthrough, films and sky alignments beside it, the realtime
 * viewer under /viewer/, the milestone snapshots under /progress/ with a
 * generated index, and the generated documents under /docs/, as Markdown and
 * as pages. Run after `pnpm build:web`.
 *
 * The walkthrough's panoramas and the films are build outputs (gitignored),
 * so a checkout without them, such as CI, still assembles the rest and says
 * what it left out.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { REPO_ROOT } from '@seked/data';
import { escape, markdown } from './markdown';

const apps = join(REPO_ROOT, 'apps');
const dist = join(apps, 'web', 'dist');
const site = join(REPO_ROOT, 'site');
if (!existsSync(join(dist, 'index.html'))) throw new Error(`no viewer build at ${dist}; run pnpm build:web first`);

rmSync(site, { recursive: true, force: true });
cpSync(join(apps, 'home'), site, { recursive: true });
cpSync(dist, join(site, 'viewer'), { recursive: true });

// The pages that were first published as claude.ai artifacts link to each
// other by artifact URL; on the site they link by path instead.
const ARTIFACTS: Record<string, string> = {
  'https://claude.ai/artifact/T3KjtoXBU4HPGpdTwThPjm': '../walk/',
  'https://claude.ai/artifact/6si9SFFKc5drsxbpzdhfBN': '../films/',
  'https://claude.ai/artifact/EhViyh79Z58gmX1xnZy2oE': '../alignments/',
};
const relink = (html: string) => Object.entries(ARTIFACTS).reduce((s, [from, to]) => s.split(from).join(to), html)
  // The walkthrough's toolbar gains a way back to the landing page, which only the site has.
  .replace('<a class="btn" href="rethink.html">About</a>', '<a class="btn" href="rethink.html">About</a>\n        <a class="btn" href="../">Home</a>');

const skipped: string[] = [];
for (const page of ['walk', 'films', 'alignments']) {
  const src = join(apps, page);
  cpSync(src, join(site, page), { recursive: true });
  for (const f of readdirSync(src)) {
    if (f.endsWith('.html')) writeFileSync(join(site, page, f), relink(readFileSync(join(src, f), 'utf8')));
  }
}
if (!existsSync(join(apps, 'walk', 'pano'))) skipped.push('walkthrough panoramas (python render/publish.py)');
if (!existsSync(join(apps, 'films', 'films'))) skipped.push('films (render/film.py)');


/** The page shell every generated page shares: the landing page's dark look, kept small. */
const shell = (title: string, body: string, home = '../') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Marcellus&display=swap">
<style>
  :root { color-scheme: dark; --stage: #0f0e0c; --ink: #efe8dc; --muted: #b3a896; --rule: rgba(239, 232, 220, 0.18); --claim: #f2b544; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--stage); color: var(--ink); font: 400 16px/1.6 "IBM Plex Sans", "Segoe UI", system-ui, sans-serif; }
  main { max-width: 72rem; margin: 0 auto; padding: 32px 16px 64px; }
  a { color: var(--claim); }
  .home { display: inline-block; margin-bottom: 24px; font: 500 12px/1 "IBM Plex Mono", monospace; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
  .home:hover { color: var(--ink); }
  h1, h2, h3 { font-family: "Marcellus", Georgia, serif; font-weight: 400; line-height: 1.2; }
  h1 { font-size: clamp(30px, 4.6vw, 44px); margin: 0 0 16px; }
  h2 { font-size: 28px; margin: 48px 0 12px; padding-top: 16px; border-top: 1px solid var(--rule); }
  h3 { font-size: 21px; margin: 32px 0 8px; }
  p, li { max-width: 80ch; }
  code { font: 400 .9em "IBM Plex Mono", monospace; color: var(--muted); }
  .scroll { overflow-x: auto; max-width: 100%; margin: 12px 0; }
  table { border-collapse: collapse; font-size: 14px; font-variant-numeric: tabular-nums; }
  th, td { padding: 6px 14px 6px 0; border-bottom: 1px solid var(--rule); vertical-align: top; }
  th { font-weight: 600; text-align: left; }
  .r { text-align: right; } .c { text-align: center; }
  figure { margin: 0 0 40px; }
  figure img { width: 100%; height: auto; border-radius: 6px; display: block; }
  figcaption { margin-top: 10px; color: var(--muted); }
  time { margin-left: 8px; }
</style>
</head>
<body>
<main>
<a class="home" href="${home}">&larr; Seked</a>
${body}
</main>
</body>
</html>
`;

// Progress snapshots: copy the images and turn the README's table into a page.
const progressDir = join(REPO_ROOT, 'docs', 'progress');
const outProgress = join(site, 'progress');
mkdirSync(outProgress, { recursive: true });
// The snapshots, and the film a snapshot row links to beside its frame.
for (const f of readdirSync(progressDir)) if (f.endsWith('.png') || f.endsWith('.mp4')) cpSync(join(progressDir, f), join(outProgress, f));

interface Row { id: string; file: string; alt: string; date: string; caption: string }
const rows: Row[] = [];
for (const line of readFileSync(join(progressDir, 'README.md'), 'utf8').split(/\r?\n/)) {
  const m = /^\|\s*(\d{4})\s*\|\s*!\[([^\]]*)\]\(([^)]+)\)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|$/.exec(line);
  if (m && /^[\w.-]+\.png$/.test(m[3] as string)) rows.push({ id: m[1] as string, alt: m[2] as string, file: m[3] as string, date: m[4] as string, caption: m[5] as string });
}
const cards = rows.map((r) => `
<figure>
  <a href="${escape(r.file)}"><img src="${escape(r.file)}" alt="${escape(r.alt)}" loading="lazy"></a>
  <figcaption><strong>${escape(r.id)}</strong> <time>${escape(r.date)}</time><br>${escape(r.caption)}</figcaption>
</figure>`).join('\n');
writeFileSync(join(outProgress, 'index.html'), shell('Seked progress', `<h1>Seked, in progress</h1>
<p>Milestone renders and screenshots, oldest first, from the first low-poly plateau onward. <a href="../walk/">Walk the plateau</a> or <a href="../viewer/">open the realtime viewer</a>.</p>
${cards}`));

// Generated documents, as their Markdown and as pages.
const outDocs = join(site, 'docs');
mkdirSync(outDocs, { recursive: true });
// The plan, and the September plan it superseded, which it links.
for (const f of ['plan.html', 'plan-2026-09.html']) {
  if (existsSync(join(REPO_ROOT, 'docs', f))) cpSync(join(REPO_ROOT, 'docs', f), join(outDocs, f));
}
const research = join(REPO_ROOT, 'docs', 'research');
// A chapter's brief is chN.md; a topic the plan adds beside a chapter is titled by its own heading.
const briefs = existsSync(research) ? readdirSync(research).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).sort() : [];
const briefTitle = (b: string): string => /^ch\d+$/.test(b)
  ? `Seked research, chapter ${b.slice(2)}`
  : `Seked research: ${(/^# (.+)$/m.exec(readFileSync(join(research, `${b}.md`), 'utf8'))?.[1] ?? b)}`;
const pages: [string, string][] = [
  ['dossier', 'Seked claims dossier'],
  ['shafts', 'Seked shaft alignments'],
  ['script', 'Seked: the script'],
  ...briefs.map((b): [string, string] => [`research/${b}`, briefTitle(b)]),
];
for (const [f, title] of pages) {
  const src = join(REPO_ROOT, 'docs', `${f}.md`);
  if (!existsSync(src)) continue;
  mkdirSync(dirname(join(outDocs, f)), { recursive: true });
  cpSync(src, join(outDocs, `${f}.md`));
  writeFileSync(join(outDocs, `${f}.html`), shell(title, markdown(readFileSync(src, 'utf8')), f.includes('/') ? '../../' : '../'));
}

writeFileSync(join(site, '.nojekyll'), '');
console.log(`site assembled at ${site}: landing page, walkthrough, films, alignments, viewer, ${rows.length} progress snapshots, docs`);
if (skipped.length) console.log(`left out, not built in this checkout: ${skipped.join('; ')}`);
