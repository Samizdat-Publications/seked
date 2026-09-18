/**
 * How fast the viewer is drawing, counted the one way this project counts it.
 *
 * Stage 5's rule is that a frame rate is a number in a commit message, and a
 * number is worth nothing unless every commit took it the same way. So there
 * is exactly one counter and it lives here: count `requestAnimationFrame`
 * callbacks over a span of seconds and divide by the seconds that actually
 * passed, which is the rate the reader sees and not the rate a renderer
 * reports about itself.
 *
 * Three things it deliberately does not do. It does not start its own loop
 * beside the scene's: `requestAnimationFrame` hands every caller the same
 * vertical blank, so counting callbacks counts the frames the canvas drew and
 * costs one increment a frame. It does not average away the first frame: the
 * clock starts on the first callback rather than on the call, so a measure
 * asked for in the middle of a long frame does not carry that frame's wait.
 * And it does not touch the scene, the store or the renderer, so measuring
 * cannot change what is being measured.
 *
 * The browser stops `requestAnimationFrame` for a hidden tab, so a measure
 * taken in a background window reports a few frames a second and is not a
 * measurement of anything. `measureFrames` says so rather than returning it.
 *
 * `scripts/frames.md` is the procedure the track's numbers were taken by.
 */

/** What one measurement saw: the rate, and the two numbers it came from. */
export interface FrameCount {
  /** Frames a second, the counted frames over the seconds that actually passed. */
  fps: number;
  /** Frames counted after the first, which is the one that starts the clock. */
  frames: number;
  /** How long the count really ran, in seconds; a hair over what was asked for. */
  seconds: number;
}

/**
 * Count frames for `seconds` and give the rate. The promise settles a little
 * after the span asked for, because it ends on the first callback past it.
 *
 * Rejects if the document is hidden when the count ends, because a hidden
 * tab's rate is the browser's throttle and not the scene's cost.
 */
export function countFrames(seconds = 2): Promise<FrameCount> {
  return new Promise((resolve, reject) => {
    let started = 0;
    let frames = 0;
    const tick = (now: number): void => {
      if (started === 0) {
        // The first callback is the start line and not a frame: the wait for
        // it belongs to whatever was running when the count was asked for.
        started = now;
        requestAnimationFrame(tick);
        return;
      }
      frames++;
      const elapsed = (now - started) / 1000;
      if (elapsed < seconds) {
        requestAnimationFrame(tick);
        return;
      }
      if (document.hidden) {
        reject(new Error('frames: the tab was hidden while counting, so the rate is the browser’s throttle and not the scene’s'));
        return;
      }
      resolve({ fps: frames / elapsed, frames, seconds: elapsed });
    };
    requestAnimationFrame(tick);
  });
}

/**
 * The rate alone, rounded to a tenth, which is the number a commit message
 * carries. This is what the dev handle exposes as `__seked.frames()`.
 */
export async function measureFrames(seconds = 2): Promise<number> {
  const count = await countFrames(seconds);
  return Math.round(count.fps * 10) / 10;
}
