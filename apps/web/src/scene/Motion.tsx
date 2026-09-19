/**
 * The player. Runs inside the Canvas, reads the motion store each frame and
 * writes the view store so the scene follows.
 *
 * It draws nothing and it holds nothing of its own but a scratch pad. One
 * frame is: move the clock on, if the clock is the wall's and something is
 * playing; then hand the shot and the second it is at to `applyShot`, which
 * writes the camera, the sun, the epoch and the sidereal time through the
 * view store's own actions. Which clock it is makes no difference here: on
 * the wall clock `useFrame` brings the delta, and for a film the exporter
 * advances the motion store and asks for a frame, so the same line of code
 * plays both and a film is the sequence the reader watched.
 *
 * The only wall clock is `useFrame`'s delta. Nothing here reads the time of
 * day, so a film rendered twice is the same film twice.
 *
 * Two things the engine needs that the store does not carry. The named stars,
 * for a shot holding one on the meridian: they come from the same catalogue
 * the claims are evaluated against, which `load.ts` has already registered
 * with `@seked/sky`, so the player does not need the bundle. And the
 * dissolve's length, for a shot that asks for a longer change of world: the
 * player sets it before the change and puts it back when the dissolve has
 * run, counting it down on the same delta so a film sees the same dissolve.
 */
import { useFrame, useStore } from '@react-three/fiber';
import { defaultStars, positionAtEpoch, transitLst, type Star } from '@seked/sky/browser';
import { useEffect, useMemo, useRef } from 'react';
import { r3f, setR3F } from '../film/handle';
import { LOOKS } from '../looks';
import { applyShot, newScratch, resetScratch } from '../motion/apply';
import { useMotion } from '../motion/store';
import type { StateChange } from '../motion/types';
import { useView } from '../store';
import { resetDissolveSeconds, setDissolveSeconds } from './fade';
import { measureCost, measureFrames, type FrameCost } from './frames';

/** The handle the console gets in development, and nothing in the app reads. */
export interface SekedHandle {
  motion: typeof useMotion;
  view: typeof useView;
  looks: typeof LOOKS;
  /** The R3F root, for reading the renderer and the scene from the console. */
  r3f: typeof r3f;
  /** The one frame counter, so every rate this project quotes was taken the same way. */
  frames: typeof measureFrames;
  /**
   * What a frame costs to draw, in milliseconds. NOT VALIDATED: see the long
   * note over `measureCost`, and do not quote a number from it until the
   * three checks there have been run in a visible window.
   */
  cost: (frames?: number, runs?: number) => FrameCost;
}

declare global {
  interface Window {
    __seked?: SekedHandle;
  }
}

/** The named stars, if the bundle has been in long enough to register them. */
function namedStars(): Star[] | undefined {
  try {
    return defaultStars();
  } catch {
    return undefined;
  }
}

/**
 * Where a named star crosses the meridian at an epoch, in degrees of sidereal
 * time. The star is precessed to the epoch first, which is the whole point of
 * holding one there while the ages roll: Alnitak's right ascension in 10,500
 * BCE is not its right ascension now.
 */
function meridianLookup(): (starId: string, epoch: number) => number | undefined {
  const stars = namedStars();
  // Before the bundle is in, a shot that wants a star simply leaves the
  // sidereal time where the reader had it.
  if (!stars) return () => undefined;
  return (starId, epoch) => {
    const star = stars.find((s) => s.id === starId);
    if (!star) return undefined;
    return transitLst(positionAtEpoch(star, epoch).raDeg);
  };
}

export function Motion(): null {
  // The film draws its own frames and needs R3F's own store to do it, which
  // only something inside the Canvas can hand out (`film/handle.ts`).
  //
  // One thing to know before hunting this as a bug, because it was hunted as
  // one on 2026-09-19: in a browser window nobody is looking at, `r3f()`
  // comes back null on a freshly loaded page even with the scene apparently
  // drawing. Nothing inside a Canvas runs until something forces a paint,
  // and a hidden window is not painted, so this effect has not flushed yet.
  // Take one screenshot and the handle is there. It is not the film's "no
  // renderer" and it wants no belt-and-braces write from the frame loop; it
  // wants a paint.
  const r3f = useStore();
  useEffect(() => {
    setR3F(r3f);
    return () => setR3F(null);
  }, [r3f]);

  const scratch = useRef(newScratch()).current;
  /** The sequence and shot last played, so a change of either begins the shot afresh. */
  const at = useRef<string>('');
  /** Seconds left of a dissolve this player lengthened, or zero when none is. */
  const dissolve = useRef(0);
  const meridianLst = useMemo(meridianLookup, []);

  const options = useMemo(
    () => ({
      meridianLst,
      onStateChange: (change: StateChange) => {
        const seconds = change.dissolveSeconds;
        if (seconds === undefined) return;
        setDissolveSeconds(seconds);
        dissolve.current = seconds;
      },
    }),
    [meridianLst],
  );

  useFrame((_, delta) => {
    if (dissolve.current > 0) {
      dissolve.current -= delta;
      if (dissolve.current <= 0) resetDissolveSeconds();
    }

    const motion = useMotion.getState();
    if (motion.clock === 'wall' && motion.playing) motion.advance(delta);
    const { sequence, shot: index, time } = useMotion.getState();
    if (!sequence) {
      // Stopping leaves the reader wherever the last frame put them, as the
      // old tour did, but nothing of the sequence is held on to.
      if (at.current !== '') {
        at.current = '';
        resetScratch(scratch);
      }
      return;
    }
    const shot = sequence.shots[index];
    if (!shot) return;
    // Two shots in different sequences can share an id, and seeking to a shot
    // should begin it again, so the scratch is cleared on either change.
    const here = `${sequence.id}:${index}`;
    if (at.current !== here) {
      at.current = here;
      resetScratch(scratch);
    }
    applyShot(shot, time, useView.getState(), scratch, options);
  });

  return null;
}

// A handle for the console, in development only: the two stores and the hero
// stands, so a sequence can be played by hand before the drawers that drive
// it exist.
/**
 * Step the renderer by hand and time it. The root and the sync point are
 * found here rather than in `frames.ts`, so the measure itself stays a pure
 * function of something that can be stepped and can be tested without a GPU.
 */
function costOfAFrame(frames = 60, runs = 3): FrameCost {
  const root = r3f();
  if (!root) throw new Error('cost: the scene is not mounted, so there is nothing to draw.');
  const state = root.getState();
  const gl = state.gl.getContext();
  return measureCost(
    {
      // `false` is what makes this a measure of drawing. R3F's second
      // argument runs the global effects, which here means every `useFrame`
      // in the scene: the motion player, which writes the view store, which
      // rebuilds the model. Stepping with them on timed 45 to 90 ms a frame
      // and was timing a state rebuild, not a draw. With them off, and the
      // same timestamp every time so nothing in the scene moves, what is
      // left is the render.
      advance: (timestamp) => state.advance(timestamp, false),
      // `finish` blocks until the commands are drawn, which is what makes the
      // timer measure drawing and not queueing. It returns whether there was
      // a context to ask.
      finish: () => {
        gl.finish();
        return true;
      },
    },
    frames,
    runs,
  );
}

if (import.meta.env.DEV) {
  window.__seked = { motion: useMotion, view: useView, looks: LOOKS, r3f, frames: measureFrames, cost: costOfAFrame };
}
