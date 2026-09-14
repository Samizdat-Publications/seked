/**
 * Assemble the static site that GitHub Pages serves: the built viewer at the
 * root, the milestone snapshots under /progress/ with a generated index, and
 * the generated documents under /docs/. Run after `pnpm build:web`.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '@seked/data';

const dist = join(REPO_ROOT, 'apps', 'web', 'dist');
const site = join(REPO_ROOT, 'site');
if (!existsSync(join(dist, 'index.html'))) throw new Error(`no viewer build at ${dist}; run pnpm build:web first`);

rmSync(site, { recursive: true, force: true });
cpSync(dist, site, { recursive: true });

// Progress snapshots: copy the images and turn the README's table into a page.
const progressDir = join(REPO_ROOT, 'docs', 'progress');
const outProgress = join(site, 'progress');
mkdirSync(outProgress, { recursive: true });
for (const f of readdirSync(progressDir)) if (f.endsWith('.png')) cpSync(join(progressDir, f), join(outProgress, f));

interface Row { id: string; file: string; alt: string; date: string; caption: string }
const rows: Row[] = [];
for (const line of readFileSync(join(progressDir, 'README.md'), 'utf8').split(/\r?\n/)) {
  const m = /^\|\s*(\d{4})\s*\|\s*!\[([^\]]*)\]\(([^)]+)\)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|$/.exec(line);
  if (m && /^[\w.-]+\.png$/.test(m[3] as string)) rows.push({ id: m[1] as string, alt: m[2] as string, file: m[3] as string, date: m[4] as string, caption: m[5] as string });
}
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cards = rows.map((r) => `
      <figure>
        <a href="${escape(r.file)}"><img src="${escape(r.file)}" alt="${escape(r.alt)}" loading="lazy"></a>
        <figcaption><strong>${escape(r.id)}</strong> <time>${escape(r.date)}</time><br>${escape(r.caption)}</figcaption>
      </figure>`).join('\n');
writeFileSync(join(outProgress, 'index.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Seked progress</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 2rem clamp(1rem, 4vw, 3rem) 4rem; font: 16px/1.5 system-ui, sans-serif; max-width: 72rem; margin-inline: auto; }
  h1 { font-size: 1.8rem; margin: 0 0 .25rem; }
  p.lede { margin: 0 0 2rem; opacity: .8; }
  figure { margin: 0 0 2.5rem; }
  img { width: 100%; height: auto; border-radius: 6px; display: block; }
  figcaption { margin-top: .6rem; }
  time { opacity: .7; margin-left: .5rem; }
  a { color: inherit; }
</style>
</head>
<body>
  <h1>Seked, in progress</h1>
  <p class="lede">Milestone renders and screenshots, oldest first, from the first low-poly plateau onward. <a href="../">Open the viewer</a>.</p>
${cards}
</body>
</html>
`);

// Generated documents.
const outDocs = join(site, 'docs');
mkdirSync(outDocs, { recursive: true });
for (const f of ['plan.html', 'dossier.md', 'shafts.md']) {
  const src = join(REPO_ROOT, 'docs', f);
  if (existsSync(src)) cpSync(src, join(outDocs, f));
}
writeFileSync(join(site, '.nojekyll'), '');
console.log(`site assembled at ${site}: viewer, ${rows.length} progress snapshots, docs`);
