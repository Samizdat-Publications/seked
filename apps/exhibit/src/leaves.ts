/**
 * The leaves (`apps/exhibit/leaves.json`): the one file the player, the render queue and the narration are built
 * from. Each leaf puts the visitor at a station, in an era and a moment, looking a certain way, while one or two
 * sentences of the script are spoken. Plan: docs/exhibit-2026-10.md, "The leaves file".
 */
import { z } from 'zod';

/**
 * How a leaf arrives from the one before:
 * - `cut` straight to it (the first leaf, or until a flight is rendered);
 * - `flight` a rendered camera move from the last leaf's view, so the two must share an era and a moment;
 * - `wipe` the same station and moment in another era, the new era swept in behind a hard edge;
 * - `turn` the same panorama, the view swinging to the new one.
 */
export const ARRIVALS = ['cut', 'flight', 'wipe', 'turn'] as const;

const Interact = z.union([z.enum(['look', 'era', 'sky']), z.string().regex(/^object:[\w-]+$/)]);

/** Degrees: yaw clockwise from north, pitch up from the horizon, the vertical field of view. */
const View = z.object({ yaw: z.number().min(0).max(360), pitch: z.number().min(-80).max(80), fov: z.number().min(20).max(100) });

export const LeafSchema = z.object({
  id: z.string().regex(/^ch\d+-[\w-]+$/),
  chapter: z.number().int().min(0),
  station: z.string().min(1),
  era: z.string().min(1),
  moment: z.string().min(1),
  view: View,
  arrive: z.enum(ARRIVALS),
  say: z.string().min(1),
  /**
   * Overlays (overlays.json) drawn on during the leaf: `name` from the leaf's start, or `name@word` from when
   * the first word starting with `word` is spoken, so a line draws itself as its word is said.
   */
  draw: z.array(z.string().regex(/^[\w-]+(@[\w'-]+)?$/)),
  /** Seconds held after the words end. */
  hold: z.number().min(0),
  interact: Interact,
  /** Claim ids in data/claims/ whose receipts this leaf shows. */
  receipts: z.array(z.string()),
  /** The script chapter whose reply sits behind this leaf. */
  reply: z.string().regex(/^ch\d+$/),
  /**
   * What stands in until the leaf's own station is rendered and published: a station the walkthrough has and a
   * view from it. The player uses it only while the walkthrough's manifest lacks the leaf's station.
   */
  until: z.object({ station: z.string().min(1), view: View }).strict().optional(),
  /**
   * A live sky drawn over the panorama at the leaf's moment (src/sky.ts): `at` the year, `today` or a claim id whose
   * epoch it takes; `from` a year it winds from in play; `figure` the constellation picked out in gold (as
   * data/stars/figures.json keys it); `bearings` a claim whose sun-ribbon bearings stand on the horizon; `marks` a
   * claim whose shafts are drawn across the meridian; `readout` a claim whose comparisons are read out at the year.
   */
  sky: z.object({
    at: z.string().min(1), from: z.string().min(1).optional(), figure: z.string().regex(/^[A-Z][a-z]{2}$/).optional(),
    bearings: z.string().min(1).optional(), marks: z.string().min(1).optional(), readout: z.string().min(1).optional(),
  }).strict().optional(),
}).strict();

export type Leaf = z.infer<typeof LeafSchema>;

export const LeavesSchema = z.object({ about: z.string(), leaves: z.array(LeafSchema).min(1) }).strict();

/** Parse leaves.json; throws with zod's account of the first thing wrong. */
export function readLeaves(raw: unknown): Leaf[] {
  return LeavesSchema.parse(raw).leaves;
}

/**
 * The leaves as they can be shown now: a leaf whose station the walkthrough has not published yet stands at its
 * `until` station and view, keeping its words, era and moment. `has(station)` says whether a station is published.
 */
export function withStandIns(leaves: readonly Leaf[], has: (station: string) => boolean): Leaf[] {
  return leaves.map((L) => (has(L.station) || !L.until ? L : { ...L, station: L.until.station, view: L.until.view }));
}

/** The rules that keep the joins clean, as a list of what breaks them (empty when none do). */
export function joinProblems(leaves: readonly Leaf[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  leaves.forEach((L, i) => {
    if (seen.has(L.id)) out.push(`${L.id}: the id is used twice`);
    seen.add(L.id);
    const prev = leaves[i - 1];
    if (!prev) {
      if (L.arrive !== 'cut') out.push(`${L.id}: the first leaf can only arrive by cut`);
      return;
    }
    if (L.chapter < prev.chapter) out.push(`${L.id}: chapter ${L.chapter} comes after chapter ${prev.chapter}`);
    const same = L.station === prev.station;
    if (L.arrive === 'flight') {
      if (same) out.push(`${L.id}: a flight goes somewhere; the station is ${L.station} on both sides`);
      if (L.era !== prev.era || L.moment !== prev.moment) out.push(`${L.id}: two leaves joined by a flight share an era and a moment`);
    }
    if (L.arrive === 'wipe' && (!same || L.moment !== prev.moment || L.era === prev.era)) {
      out.push(`${L.id}: a wipe changes the era in place, at the same station and moment`);
    }
    if (L.arrive === 'turn' && (!same || L.era !== prev.era || L.moment !== prev.moment)) {
      out.push(`${L.id}: a turn stays in the same panorama (station, era and moment)`);
    }
  });
  return out;
}

/** render/stations.json, as far as the moments go. */
export interface RenderStations {
  stations: { id: string; moment?: string; by_state?: Record<string, { moment?: string }> }[];
  moments: Record<string, unknown>;
}

/** The moment a station is rendered at in an era for the walkthrough: its by_state moment, else its own. */
export function stationMoment(render: RenderStations, station: string, era: string): string | null {
  const st = render.stations.find((s) => s.id === station);
  if (!st) return null;
  return st.by_state?.[era]?.moment ?? st.moment ?? null;
}

/**
 * The panorama a leaf needs, relative to the walkthrough's folder: the walkthrough's own when the leaf's moment
 * is the one the station is rendered at in that era, else `pano/<station>-<era>-<moment>.jpg`, which the render
 * queue (scripts/exhibit_queue.py) asks the laptop for.
 */
export function leafPanorama(leaf: Pick<Leaf, 'station' | 'era' | 'moment'>, render: RenderStations): string {
  const own = stationMoment(render, leaf.station, leaf.era);
  // a station rendered at no moment (inside, by the era's lamps) looks the same at any hour
  return own === leaf.moment || (own === null && render.stations.some((s) => s.id === leaf.station))
    ? `pano/${leaf.station}-${leaf.era}.jpg`
    : `pano/${leaf.station}-${leaf.era}-${leaf.moment}.jpg`;
}

/** A draw entry's overlay and the word that cues it (null: from the leaf's start). */
export function drawCue(entry: string): { overlay: string; word: string | null } {
  const [overlay, word] = entry.split('@');
  return { overlay: overlay as string, word: word ?? null };
}

/** The index of the word in `say` that a cue names: the first word that starts with it, ignoring case and punctuation. */
export function cueIndex(say: string, word: string | null): number {
  if (!word) return 0;
  const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, '');
  const want = bare(word);
  return say.split(/\s+/).filter(Boolean).findIndex((w) => bare(w).startsWith(want));
}

/**
 * Every figure a leaf draws, in order, each with the index of the word that shows it (-1 for one shown from the leaf's
 * start, `cued` false). In play each replaces the one before at its word; paused, the last is shown.
 */
export function figureCues(L: Pick<Leaf, 'draw' | 'say'>, isFigure: (id: string) => boolean): { id: string; at: number; cued: boolean }[] {
  return L.draw.map(drawCue).filter((c) => isFigure(c.overlay))
    .map((c) => ({ id: c.overlay, at: c.word ? cueIndex(L.say, c.word) : -1, cued: !!c.word }));
}

/**
 * The words that cue a leaf's line and its figure in play (-1: not cued, drawn from the start). The stage draws the
 * first entry when it is an overlay; the figure is the first entry that is one, wherever it stands in `draw`, so a
 * figure listed after the leaf's line still waits for its own word.
 */
export function leafCues(L: Pick<Leaf, 'draw' | 'say'>, isFigure: (id: string) => boolean): { line: number; figure: number } {
  const first = L.draw[0] ? drawCue(L.draw[0]) : null;
  const figure = L.draw.map(drawCue).find((c) => isFigure(c.overlay));
  return {
    line: first?.word && !isFigure(first.overlay) ? cueIndex(L.say, first.word) : -1,
    figure: figure?.word ? cueIndex(L.say, figure.word) : -1,
  };
}
