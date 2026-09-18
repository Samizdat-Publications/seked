/**
 * What is playing, where it is up to, and which clock moves it.
 *
 * The motion store holds the sequence, the shot index and the seconds into
 * that shot. It does not hold a camera or a moment: those are the view
 * store's, and the player writes them there every frame. So nothing in the
 * scene reads this store to draw; a scene file reads it at most to spend
 * less while something is moving.
 *
 * Two clocks. `wall` is the reader pressing play: the player advances by
 * `useFrame`'s delta. `stepped` is the film: nothing advances unless the
 * exporter calls `advance` with the frame's own length, and the canvas is
 * drawn only when it asks, so every frame is the same run to run.
 */
import { create } from 'zustand';
import type { Sequence } from './types';

export type Clock = 'wall' | 'stepped';

export interface MotionStore {
  /** The sequence loaded, or null when nothing is. */
  sequence: Sequence | null;
  /** Index into the sequence's shots. */
  shot: number;
  /** Seconds into the current shot. */
  time: number;
  playing: boolean;
  clock: Clock;
  /** Load a sequence at a shot and start it. */
  play: (sequence: Sequence, shot?: number) => void;
  pause: () => void;
  resume: () => void;
  /** Unload. The view is left where the last frame put it. */
  stop: () => void;
  /** Go to a shot at a second into it, keeping whatever the playing flag was. */
  seek: (shot: number, time?: number) => void;
  /**
   * Move the clock on by `dt` seconds. A shot that runs out rolls into the
   * next; the last shot running out stops the sequence at its final second,
   * still loaded, so the narration of the last shot stays up.
   */
  advance: (dt: number) => void;
  setClock: (clock: Clock) => void;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export const useMotion = create<MotionStore>((set, get) => ({
  sequence: null,
  shot: 0,
  time: 0,
  playing: false,
  clock: 'wall',
  play: (sequence, shot = 0) => set({ sequence, shot: clamp(shot, 0, Math.max(0, sequence.shots.length - 1)), time: 0, playing: true }),
  pause: () => set({ playing: false }),
  resume: () => set((s) => (s.sequence ? { playing: true } : {})),
  stop: () => set({ sequence: null, shot: 0, time: 0, playing: false }),
  seek: (shot, time = 0) =>
    set((s) => {
      if (!s.sequence) return {};
      const index = clamp(shot, 0, s.sequence.shots.length - 1);
      const length = s.sequence.shots[index]?.seconds ?? 0;
      return { shot: index, time: clamp(time, 0, length) };
    }),
  advance: (dt) => {
    const { sequence, playing } = get();
    if (!sequence || !playing || dt <= 0) return;
    let { shot, time } = get();
    time += dt;
    for (;;) {
      const length = sequence.shots[shot]?.seconds ?? 0;
      if (time < length) break;
      if (shot + 1 >= sequence.shots.length) {
        set({ shot, time: length, playing: false });
        return;
      }
      time -= length;
      shot += 1;
    }
    set({ shot, time });
  },
  setClock: (clock) => set({ clock }),
}));
