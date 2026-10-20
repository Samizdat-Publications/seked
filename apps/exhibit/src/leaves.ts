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

export const LeafSchema = z.object({
  id: z.string().regex(/^ch\d+-[\w-]+$/),
  chapter: z.number().int().min(0),
  station: z.string().min(1),
  era: z.string().min(1),
  moment: z.string().min(1),
  /** Degrees: yaw clockwise from north, pitch up from the horizon, the vertical field of view. */
  view: z.object({ yaw: z.number().min(0).max(360), pitch: z.number().min(-80).max(80), fov: z.number().min(20).max(100) }),
  arrive: z.enum(ARRIVALS),
  say: z.string().min(1),
  /** Overlays (overlays.json) drawn on during the leaf. */
  draw: z.array(z.string()),
  /** Seconds held after the words end. */
  hold: z.number().min(0),
  interact: Interact,
  /** Claim ids in data/claims/ whose receipts this leaf shows. */
  receipts: z.array(z.string()),
  /** The script chapter whose reply sits behind this leaf. */
  reply: z.string().regex(/^ch\d+$/),
}).strict();

export type Leaf = z.infer<typeof LeafSchema>;

export const LeavesSchema = z.object({ about: z.string(), leaves: z.array(LeafSchema).min(1) }).strict();

/** Parse leaves.json; throws with zod's account of the first thing wrong. */
export function readLeaves(raw: unknown): Leaf[] {
  return LeavesSchema.parse(raw).leaves;
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
  return stationMoment(render, leaf.station, leaf.era) === leaf.moment
    ? `pano/${leaf.station}-${leaf.era}.jpg`
    : `pano/${leaf.station}-${leaf.era}-${leaf.moment}.jpg`;
}
