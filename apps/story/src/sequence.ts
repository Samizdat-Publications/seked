/**
 * The stage's sequences (docs/plan.html, "Three kinds of stage"): frames rendered in Blender and scrubbed by
 * the scroll, drawn to a canvas with the two nearest frames blended. Every sequence starts as a still and is
 * replaced when its frames exist; until they load, the beat's still stands in.
 *
 * `dir` names the committed frames under assets/sequences/, `f000.jpg` on. They are previews, rendered in the
 * cloud; the finals, rendered on the laptop, replace them in place. The page shows a lighter copy of each frame,
 * `frameFile`, which its build writes and its dev server makes, as it does for the stills.
 */

export interface Sequence {
  id: string;
  /** The committed frames' directory, from the repo's root. */
  dir: string;
  frames: number;
  /** A sequence that comes back to its first frame, as an orbit does, blends its last frame into its first. */
  loop: boolean;
  /** Where the picture's subject lies across the frame (0 left, 1 right), kept in view when a phone crops it. */
  focus: number;
  /** A diagram is shown whole on the stage's dark ground, as its still is; a scene covers the stage. */
  whole?: true;
  /** The caption while it plays; the beat's still keeps its own until the frames have loaded. */
  alt: string;
  /** What made it, for the reader: the render script and the view. */
  made: string;
}

export const SEQUENCES: Record<string, Sequence> = {
  'enclosure-d-orbit': {
    id: 'enclosure-d-orbit', dir: 'assets/sequences/enclosure-d-orbit', frames: 96, loop: true, focus: 0.5,
    alt: 'Enclosure D at Göbekli Tepe, circled from its rim at eye height, a person for scale; its pillars placed from the excavators’ plan',
    made: 'render/enclosure_d.py --view orbit:T, T = i/96, at 960 by 540 and 16 samples',
  },
  'enclosure-d-fill': {
    id: 'enclosure-d-fill', dir: 'assets/sequences/enclosure-d-fill', frames: 32, loop: false, focus: 0.5,
    alt: 'Enclosure D filled level, as Schmidt read it, to a look-choice depth. Since revised: now read as slope slides',
    made: 'render/enclosure_d.py --view air --fill level --level L, L = 2.6 i/31 m, at 960 by 540 and 16 samples',
  },
  'underground-descent': {
    id: 'underground-descent', dir: 'assets/sequences/underground-descent', frames: 48, loop: false, focus: 0.55, whole: true,
    alt: 'Down the claimed wells to the two cubes at their foot; diameter, spacing and spirals a look choice',
    made: 'render/underground.py --shot descent:T, T = i/47, at 960 by 540 and 16 samples',
  },
};

const pad = (i: number) => String(i).padStart(3, '0');

/** A committed frame, from the repo's root. */
export const frameSource = (s: Sequence, i: number) => `${s.dir}/f${pad(i)}.jpg`;

/** The page's copy of a frame. */
export const frameFile = (s: Sequence, i: number) => `sequences/${s.id}/f${pad(i)}.webp`;

/** Every frame's page copy and the committed file it is made from. */
export const sequenceFiles = (): { file: string; source: string }[] =>
  Object.values(SEQUENCES).flatMap((s) =>
    Array.from({ length: s.frames }, (_, i) => ({ file: frameFile(s, i), source: frameSource(s, i) })));

/**
 * The two frames either side of the scroll's share `p` (0 to 1) and how far it is from the first to the second.
 * A loop runs once round, its last frame blending into its first; an open sequence stops on its last frame.
 */
export function frameAt(p: number, frames: number, loop: boolean): { a: number; b: number; mix: number } {
  const t = Math.min(1, Math.max(0, p)) * (loop ? frames : frames - 1);
  const a = Math.min(Math.floor(t), frames - 1);
  const b = loop ? (a + 1) % frames : Math.min(a + 1, frames - 1);
  return { a, b, mix: t - a };
}

/** Where to draw a `w` by `h` frame whole inside a `cw` by `ch` canvas, centred. */
export function contain(w: number, h: number, cw: number, ch: number): { x: number; y: number; w: number; h: number } {
  const k = Math.min(cw / w, ch / h);
  return { x: (cw - w * k) / 2, y: (ch - h * k) / 2, w: w * k, h: h * k };
}

/**
 * Where to draw a `w` by `h` frame so it covers a `cw` by `ch` canvas, the frame's `focus` kept as near the
 * middle as covering allows: a wide frame on a phone loses its sides, not its subject.
 */
export function cover(w: number, h: number, cw: number, ch: number, focus: number): { x: number; y: number; w: number; h: number } {
  const k = Math.max(cw / w, ch / h);
  const dw = w * k;
  const dh = h * k;
  const x = Math.min(0, Math.max(cw - dw, cw / 2 - focus * dw));
  return { x, y: (ch - dh) / 2, w: dw, h: dh };
}
