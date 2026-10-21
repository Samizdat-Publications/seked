/**
 * The small Markdown the site's generated pages are written in: headings,
 * paragraphs, tables, lists (nested by indentation, bulleted or numbered),
 * fenced code, rules, and inline code, bold, italic and links. HTML comments
 * are dropped. Enough for the dossier, the shaft solutions, the script and the
 * research briefs, and nothing more; `scripts/site.ts` renders them with it.
 */

export const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const inline = (s: string) => escape(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

const ITEM = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

/** A run of list lines as nested lists: a deeper indent opens a list inside the item above it. */
function list(lines: string[]): string {
  const out: string[] = [];
  const open: { indent: number; tag: 'ul' | 'ol' }[] = [];
  for (const line of lines) {
    const m = ITEM.exec(line);
    if (!m) {
      // A continuation line of the item above.
      out.push(` ${inline(line.trim())}`);
      continue;
    }
    const indent = m[1]!.length;
    const tag = /\d/.test(m[2]!) ? 'ol' : 'ul';
    while (open.length && indent < open[open.length - 1]!.indent) out.push(`</li></${open.pop()!.tag}>`);
    const top = open[open.length - 1];
    if (!top || indent > top.indent) {
      out.push(`<${tag}>`);
      open.push({ indent, tag });
    } else {
      out.push('</li>');
    }
    out.push(`<li>${inline(m[3]!)}`);
  }
  while (open.length) out.push(`</li></${open.pop()!.tag}>`);
  return out.join('');
}

export function markdown(md: string): string {
  const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const out: string[] = [];
  const lines = md.split(/\r?\n/);
  for (let i = 0; i < lines.length; ) {
    const line = lines[i] as string;
    if (line.trimStart().startsWith('<!--')) {
      for (; i < lines.length && !lines[i]!.includes('-->'); i++);
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i]!.startsWith('```'); i++) code.push(lines[i]!);
      out.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`);
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { out.push(`<h${h[1]!.length}>${inline(h[2]!)}</h${h[1]!.length}>`); i++; continue; }
    if (line.startsWith('|') && /^\|[\s:|-]+\|$/.test((lines[i + 1] ?? '').trim())) {
      const head = cells(line);
      const align = cells(lines[i + 1]!).map((a) => (a.endsWith(':') ? (a.startsWith(':') ? 'c' : 'r') : ''));
      const cls = (j: number) => (align[j] ? ` class="${align[j]}"` : '');
      const rows: string[] = [];
      for (i += 2; i < lines.length && (lines[i] as string).startsWith('|'); i++) {
        rows.push(`<tr>${cells(lines[i]!).map((c, j) => `<td${cls(j)}>${inline(c)}</td>`).join('')}</tr>`);
      }
      out.push(`<div class="scroll"><table><thead><tr>${head.map((c, j) => `<th${cls(j)}>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`);
      continue;
    }
    if (ITEM.test(line)) {
      const items: string[] = [];
      // An item runs on over indented lines that are not items themselves.
      for (; i < lines.length && (ITEM.test(lines[i]!) || /^\s+\S/.test(lines[i]!)); i++) items.push(lines[i]!);
      out.push(list(items));
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const para: string[] = [];
    for (; i < lines.length && lines[i]!.trim() && !/^(#|\||```|<!--|-{3,}\s*$)/.test(lines[i]!) && !ITEM.test(lines[i]!); i++) para.push(lines[i]!);
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}
