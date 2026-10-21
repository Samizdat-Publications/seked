/**
 * The little Markdown the script's receipts use: paragraphs, nested lists,
 * tables, bold, italics and code. Everything is escaped first, so a script
 * line can never inject markup.
 */

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function inline(s: string): string {
  return escape(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, '$1<em>$2</em>');
}

export function block(md: string): string {
  const out: string[] = [];
  const lines = md.split('\n');
  let i = 0;
  const at = (k: number) => lines[k] ?? '';
  while (i < lines.length) {
    const line = at(i);
    if (!line.trim()) {
      i++;
    } else if (/^\s*\|/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(at(i))) {
        const cells = at(i).trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [headRow = [], ...body] = rows;
      out.push(
        '<table><thead><tr>' + headRow.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
          body.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
          '</tbody></table>',
      );
    } else if (/^\s*- /.test(line)) {
      const items: { depth: number; text: string }[] = [];
      while (i < lines.length && (/^\s*- /.test(at(i)) || (/^\s{2,}\S/.test(at(i)) && !/^\s*\|/.test(at(i))))) {
        const m = at(i).match(/^(\s*)- (.*)$/);
        const last = items[items.length - 1];
        if (m) items.push({ depth: Math.floor((m[1] ?? '').length / 2), text: m[2] ?? '' });
        else if (last) last.text += ' ' + at(i).trim();
        i++;
      }
      out.push(list(items));
    } else {
      const para: string[] = [];
      while (i < lines.length && at(i).trim() && !/^\s*(- |\|)/.test(at(i))) para.push(at(i++).trim());
      out.push(`<p>${inline(para.join(' '))}</p>`);
    }
  }
  return out.join('\n');
}

function list(items: { depth: number; text: string }[]): string {
  let html = '<ul>';
  let i = 0;
  while (i < items.length) {
    let j = i + 1;
    const it = items[i]!;
    while (j < items.length && items[j]!.depth > it.depth) j++;
    html += `<li>${inline(it.text)}${j > i + 1 ? list(items.slice(i + 1, j)) : ''}</li>`;
    i = j;
  }
  return html + '</ul>';
}
