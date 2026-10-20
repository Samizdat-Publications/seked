/**
 * The documentary's script, read out of docs/script.md, so the page and the
 * narration are built from one text. A chapter is a `## N. Title` heading
 * followed by its sections: the narration, the beats, the receipts, the
 * reply, the spoken reply and the sources. Any other `## ` heading (the
 * running time, the open questions) ends the chapters.
 */

export interface Chapter {
  n: number;
  title: string;
  /** A line in italics under the heading, such as chapter 8's draft note. */
  note?: string;
  /** The narration, one string a paragraph. */
  narration: string[];
  /** Each beat: the words it is anchored to, and what the stage does. */
  beats: { anchor: string; does: string }[];
  /** The receipts' Markdown, as written. */
  receipts: string;
  /** The claims the receipts name (C5, D4, ...), in order, once each. */
  claims: string[];
  /** The reply, one string a paragraph. */
  reply: string[];
  spokenReply?: string;
  /** The source ids, in order. */
  sources: string[];
}

const CHAPTER = /^## (\d+)\. (.+)$/;
const SECTION = /^\*\*(Narration|Beats|Receipts|The reply)\*\*/;
const INLINE = /^\*\*(Spoken reply|Sources)\*\*:\s*(.*)$/;
const CLAIM_ID = /\b([A-D]\d{1,2})\b(?=[,.:\s*)])/g;

const paragraphs = (lines: string[]): string[] =>
  lines.join('\n').split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);

export function parseScript(md: string): Chapter[] {
  const chapters: Chapter[] = [];
  let lines: string[] | null = null;
  let head: RegExpMatchArray | null = null;
  const flush = () => {
    if (head && lines) chapters.push(parseChapter(Number(head[1]), (head[2] ?? '').trim(), lines));
  };
  for (const line of md.split(/\r?\n/)) {
    const m = line.match(CHAPTER);
    if (m) {
      flush();
      head = m;
      lines = [];
    } else if (line.startsWith('## ')) {
      flush();
      head = null;
      lines = null;
    } else if (lines) {
      lines.push(line);
    }
  }
  flush();
  return chapters;
}

function parseChapter(n: number, title: string, lines: string[]): Chapter {
  const sections: Record<string, string[]> = { intro: [] };
  const inline: Record<string, string> = {};
  let current = 'intro';
  for (const line of lines) {
    const s = line.match(SECTION);
    const i = line.match(INLINE);
    if (s) {
      current = s[1] ?? 'intro';
      sections[current] = [];
    } else if (i) {
      inline[i[1] ?? ''] = (i[2] ?? '').trim();
      current = 'after';
      sections[current] = [];
    } else {
      (sections[current] ??= []).push(line);
    }
  }
  const intro = paragraphs(sections.intro ?? []);
  const note = intro.find((p) => /^\*[^*].*\*$/.test(p))?.replace(/^\*|\*$/g, '');
  const beats = (sections.Beats ?? [])
    .filter((l) => l.startsWith('- '))
    .map((l) => {
      const m = l.match(/^- "(.+?)" → (.*)$/);
      return m ? { anchor: m[1] ?? '', does: (m[2] ?? '').trim() } : { anchor: '', does: l.slice(2).trim() };
    });
  const receipts = (sections.Receipts ?? []).join('\n').trim();
  const claims = [...new Set([...receipts.matchAll(CLAIM_ID)].map((m) => m[1] ?? ''))];
  const sources = (inline.Sources ?? '').match(/`([^`]+)`/g)?.map((s) => s.slice(1, -1)) ?? [];
  return {
    n,
    title,
    note,
    narration: paragraphs(sections.Narration ?? []),
    beats,
    receipts,
    claims,
    reply: paragraphs(sections['The reply'] ?? []),
    spokenReply: inline['Spoken reply'],
    sources,
  };
}
