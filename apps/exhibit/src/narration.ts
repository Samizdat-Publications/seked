/**
 * The recorded voice: each chapter of docs/script.md is one recording (assets/narration/chN.mp3) with the time of
 * every character it speaks (chN.json, scripts/narrate_script.py). A leaf is a range of its chapter's text, so
 * its words are found in that text, in order, and their times give the span of audio to play and the moment
 * each word is said.
 */

export interface Alignment { characters: string[]; start: number[]; end: number[] }
export interface Recording { file: string; text: string; seconds: number; alignment: Alignment }
export interface ChapterRecording { chapter: number; files: { narration?: Recording; reply?: Recording } }

/** A leaf's stretch of a recording: from `start` to `end` seconds, each word at `at` seconds after `start`. */
export interface Span { start: number; end: number; words: { word: string; at: number }[] }

/** The text with every run of whitespace made one space, and where each of its characters came from. */
function squeeze(s: string): { text: string; from: number[] } {
  let text = '';
  const from: number[] = [];
  let space = false;
  for (let i = 0; i < s.length; i++) {
    if (/\s/.test(s[i]!)) { space = text.length > 0; continue; }
    if (space) { text += ' '; from.push(i - 1); space = false; }
    text += s[i];
    from.push(i);
  }
  return { text, from };
}

/**
 * Each leaf's span in a recording, found in order (a leaf is looked for after the one before it); null for a
 * leaf whose words are not in the recording, which then falls back to the browser's voice.
 */
export function leafSpans(rec: Recording, says: readonly string[]): (Span | null)[] {
  const { text, from } = squeeze(rec.text);
  const { start, end } = rec.alignment;
  let cursor = 0;
  return says.map((say) => {
    const want = squeeze(say).text;
    const i = want ? text.indexOf(want, cursor) : -1;
    if (i < 0) return null;
    cursor = i + want.length;
    const first = from[i]!, last = from[i + want.length - 1]!;
    const t0 = start[first] ?? 0, t1 = end[last] ?? t0;
    const words: { word: string; at: number }[] = [];
    const re = /\S+/g;
    for (let m = re.exec(want); m; m = re.exec(want)) words.push({ word: m[0], at: Math.max(0, (start[from[i + m.index]!] ?? t0) - t0) });
    return { start: t0, end: t1, words };
  });
}

/** Where a chapter's files are, relative to the exhibit. */
export const recordingUrl = (chapter: number, file = `ch${chapter}.json`) => `narration/${file}`;
