/**
 * The stepped run: a sequence drawn one frame at a time, at full quality,
 * with nothing left to chance.
 *
 * A film is not a screen recording. The reader's clock is the browser's, and
 * a frame that took two hundred milliseconds to draw would eat two hundred
 * milliseconds of the tour; the same run on another machine would cut
 * somewhere else. So the film takes the clock away from the browser. The
 * motion store is put on its stepped clock and moved on by exactly one
 * frame's worth of seconds; the Canvas is put on R3F's `frameloop="never"`,
 * where nothing draws unless this file asks; and the ask carries the frame's
 * own timestamp, so `useFrame`'s delta is exactly one over the rate whatever
 * the wall clock did in between. The dissolve in `scene/fade.ts` runs off
 * that delta, and so lands on the same frames every run.
 *
 * Two details of R3F 9 are load-bearing and neither is obvious.
 *
 * The first is the unit. `update()` in `@react-three/fiber`'s loop does
 * `delta = timestamp - state.clock.elapsedTime` while `frameloop` is
 * `never`, and `elapsedTime` is a `THREE.Clock`'s, which is in seconds. So
 * the timestamp handed to `advance` is seconds, not the milliseconds a
 * `requestAnimationFrame` timestamp would be. Milliseconds would hand the
 * scene a delta of forty-one seconds a frame at 24 fps, which would finish
 * every dissolve in its first frame. (Reported to the director: the plan's
 * O1 says `frame * 1000 / fps`.)
 *
 * The second is that the same `update()` calls `state.clock.getDelta()`
 * before it overrides the delta, and `getDelta` adds the wall time since the
 * last call to `elapsedTime`. Left alone, that wall time would be subtracted
 * from every frame's delta, which is the very drift the stepped clock exists
 * to remove. So the run stops the clock for its duration: a stopped
 * `THREE.Clock` returns a zero delta and does not move its own elapsed time,
 * and the override then has the field to itself.
 */
import { useMotion } from '../motion/store';
import { sequenceSeconds, type Sequence } from '../motion/types';
import { useView } from '../store';
import { r3f } from './handle';
import { holdSize } from './size';

export interface FilmOptions {
  sequence: Sequence;
  /** Frames a second. The film's whole timebase: everything else follows it. */
  fps: number;
  width: number;
  height: number;
  /**
   * What to do with the frame that has just been drawn, which is the encoder.
   * It is awaited, so an encoder that is behind holds the run back rather than
   * dropping a frame.
   */
  onFrame: (frame: number, total: number) => Promise<void>;
  signal: AbortSignal;
}

/**
 * How many frames a sequence is at a rate. Rounded, because a sequence whose
 * shots sum to a fraction of a frame should not leave a fraction of a frame
 * at the end, and never less than one.
 */
export function frameCount(sequence: Sequence, fps: number): number {
  return Math.max(1, Math.round(sequenceSeconds(sequence) * fps));
}

/**
 * The timestamp, in seconds, handed to R3F for a frame. The run advances the
 * motion store before it draws, so frame 0 is already one frame into the
 * sequence and the schedule starts at one over the rate; the difference
 * between one timestamp and the next is exactly one over the rate, which is
 * the delta every `useFrame` in the scene then sees.
 */
export function frameTimestamp(frame: number, fps: number): number {
  return (frame + 1) / fps;
}

/**
 * Hand the browser back its turn, so it can lay out, fetch and paint.
 *
 * An animation frame is the natural way to wait for a browser and is what
 * this was, until a window behind another window turned out to have its
 * animation frames throttled to a standstill: the film stopped whenever the
 * reader looked at something else. A task does not care where the window is.
 * Nothing is timed by it either way. The film's own clock is the frame
 * number, and no delta anywhere is read from how long a wait took.
 */
const pause = (ms = 0): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** How often a frame that is waiting on its assets looks again. */
const LOADING_LOOK_MS = 16;

/** How many looks it gives them: about half a minute, and then it draws anyway. */
const LOADING_PATIENCE = 1800;

/** Thrown when the reader presses Cancel. */
export class FilmStopped extends Error {
  constructor() {
    super('The film was stopped');
    this.name = 'FilmStopped';
  }
}

function stopIfAsked(signal: AbortSignal): void {
  if (signal.aborted) throw new FilmStopped();
}

/**
 * Wait until nothing is loading. A stand-in still streaming in would be
 * caught half in the frame, and unlike a dropped frame in a reader's session
 * that would be in the file for good.
 */
async function waitForLoaded(signal: AbortSignal): Promise<void> {
  for (let tick = 0; tick < LOADING_PATIENCE; tick++) {
    stopIfAsked(signal);
    if (useView.getState().loading.size === 0) return;
    await pause(LOADING_LOOK_MS);
  }
}

/** What the run took from `THREE.Clock` and has to give back. */
interface ClockHold {
  autoStart: boolean;
  running: boolean;
  elapsedTime: number;
}

/**
 * Record a sequence. Resolves when the last frame has been handed to
 * `onFrame`; throws `FilmStopped` if the reader cancels. Whatever happens,
 * the viewer is put back on the wall clock with nothing loaded, so a failed
 * run leaves a live scene rather than a frozen one.
 */
export async function renderFilm(options: FilmOptions): Promise<void> {
  const { sequence, fps, width, height, onFrame, signal } = options;
  const root = r3f();
  if (!root) throw new Error('The film has no renderer: the scene is not mounted.');

  const canvas = root.getState().gl.domElement;
  const stage = canvas.closest('.stage') as HTMLElement | null;
  if (!stage) throw new Error('The film cannot find the stage the canvas stands on.');
  // The rail and the instruments come off the stage for the run. They are not
  // in the film either way, which is drawn off the canvas and not off the
  // page, but a reader watching a long run should see the frame and not the
  // furniture. The class goes on by hand because `App.tsx` is the trunk's.
  const shell = stage.closest('.shell');
  shell?.classList.add('is-filming');

  const motion = useMotion.getState();
  motion.setClock('stepped');
  motion.play(sequence);
  // Two turns of the browser's own loop: one for React to re-render the
  // Canvas with `frameloop="never"`, one for that to reach the store.
  await pause();
  await pause();

  // The size after the frameloop, so R3F's own re-measure of the container on
  // that render cannot land on top of it.
  const size = await holdSize(root, stage, width, height);

  const clock = root.getState().clock;
  const held: ClockHold = {
    autoStart: clock.autoStart,
    running: clock.running,
    elapsedTime: clock.elapsedTime,
  };
  clock.autoStart = false;
  clock.running = false;
  clock.elapsedTime = 0;

  const total = frameCount(sequence, fps);
  try {
    for (let frame = 0; frame < total; frame++) {
      stopIfAsked(signal);
      useMotion.getState().advance(1 / fps);
      await waitForLoaded(signal);
      stopIfAsked(signal);
      size.hold();
      root.getState().advance(frameTimestamp(frame, fps));
      await onFrame(frame, total);
    }
  } finally {
    // `start()` is what puts the clock's own `oldTime` back on the browser's
    // clock, without this file reading it: without that the first frame after
    // the run would carry a delta of however long the whole run took.
    clock.autoStart = held.autoStart;
    clock.start();
    clock.elapsedTime = held.elapsedTime;
    if (!held.running) clock.stop();
    size.restore();
    const after = useMotion.getState();
    after.setClock('wall');
    after.stop();
    shell?.classList.remove('is-filming');
  }
}
