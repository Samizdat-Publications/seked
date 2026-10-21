/**
 * Autoplay (docs/plan.html, "Autoplay"): one button plays the narration and scrolls the page in time with it.
 * The page is a pure function of time, so a capture script can step the clock frame by frame for the trailer.
 *
 * Until the voice is recorded there are no word timings, so every word takes the same time at the script's
 * own rate (docs/script.md, "Running time": 150 words a minute). The voice's timestamps replace `rate` with a
 * time for each word, and nothing else here changes. After each chapter's narration its spoken reply runs, in
 * the plan's second, quieter voice, with the page held at the chapter's end and the reply shown as a subtitle.
 */

/** The script's speaking rate, in words a second. */
export const WORDS_PER_SECOND = 150 / 60;
/** A breath between paragraphs, and a longer one between a chapter's reply and the next chapter. */
export const PARAGRAPH_GAP = 0.6;
export const CHAPTER_GAP = 1.5;

export const words = (text: string) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export interface Schedule {
  /** Each narration paragraph as the page draws it, in document order: its chapter and its spoken span. */
  paragraphs: { chapter: number; t0: number; t1: number }[];
  /** Each chapter's spoken reply, after its narration. */
  replies: { chapter: number; t0: number; t1: number; text: string }[];
  duration: number;
}

/** Times for every paragraph and reply, from their word counts. */
export function schedule(chapters: { n: number; paragraphs: string[]; reply?: string }[], rate = WORDS_PER_SECOND): Schedule {
  const paragraphs: Schedule['paragraphs'] = [];
  const replies: Schedule['replies'] = [];
  let t = 0;
  for (const c of chapters) {
    c.paragraphs.forEach((p, i) => {
      if (i) t += PARAGRAPH_GAP;
      const t0 = t;
      t += words(p) / rate;
      paragraphs.push({ chapter: c.n, t0, t1: t });
    });
    if (c.reply) {
      t += PARAGRAPH_GAP;
      const t0 = t;
      t += words(c.reply) / rate;
      replies.push({ chapter: c.n, t0, t1: t, text: c.reply });
    }
    t += CHAPTER_GAP;
  }
  return { paragraphs, replies, duration: t - CHAPTER_GAP };
}

/**
 * Where the reading line stands at time `t`, in document pixels: through each paragraph from its top to its
 * bottom as it is spoken (a paragraph that holds a live figure includes its room, so the figure plays under the
 * voice), held at a paragraph's bottom through a pause or a reply, and moved on to the next paragraph's top in
 * the pause before it. `boxes` are the paragraphs' [top, bottom], in the schedule's order.
 */
export function lineAt(t: number, s: Schedule, boxes: [number, number][]): number {
  const ps = s.paragraphs;
  if (!ps.length) return 0;
  if (t <= ps[0]!.t0) return boxes[0]![0];
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]!;
    const [top, bottom] = boxes[i]!;
    if (t <= p.t1) return top + (bottom - top) * ((t - p.t0) / Math.max(p.t1 - p.t0, 1e-9));
    const next = ps[i + 1];
    if (!next || t < next.t0) {
      // the pause after a paragraph: held through its chapter's reply, then carried to the next paragraph's top
      if (!next) return bottom;
      const reply = s.replies.find((r) => r.chapter === p.chapter && r.t0 >= p.t1 && r.t1 <= next.t0);
      const from = reply ? reply.t1 : p.t1;
      if (t <= from) return bottom;
      return bottom + (boxes[i + 1]![0] - bottom) * ((t - from) / Math.max(next.t0 - from, 1e-9));
    }
  }
  return boxes[boxes.length - 1]![1];
}

/** The time at which the reading line passes `y`: where to start playing from a reader's own scroll. */
export function timeAt(y: number, s: Schedule, boxes: [number, number][]): number {
  for (let i = 0; i < s.paragraphs.length; i++) {
    const [top, bottom] = boxes[i]!;
    const p = s.paragraphs[i]!;
    if (y < top) return p.t0;
    if (y <= bottom) return p.t0 + (p.t1 - p.t0) * ((y - top) / Math.max(bottom - top, 1e-9));
  }
  return s.duration;
}

/** The reply being spoken at `t`, if any. */
export const replyAt = (t: number, s: Schedule) => s.replies.find((r) => t >= r.t0 && t <= r.t1);

/** m:ss */
export const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
