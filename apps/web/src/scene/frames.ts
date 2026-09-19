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

/* ------------------------------------------------- what a frame costs to draw */

/**
 * NOT VALIDATED. Do not quote a number from this yet.
 *
 * The idea, and it is a good one. `countFrames` above counts vertical
 * blanks, which is the right number for "is it smooth" and the wrong one for
 * two questions this project keeps asking. A frame cannot be counted faster
 * than the screen refreshes, so every `today` stand on this machine comes
 * back 239 or 240 and says only that it beat the monitor: two scenes an
 * order of magnitude apart in cost report the same number. And the browser
 * stops `requestAnimationFrame` for a window nobody is looking at, so a
 * session driving the viewer from a hidden pane cannot count anything.
 *
 * So: step the renderer by hand, N frames in a row with the scene held
 * still, end on a real sync point, and divide. No ceiling, no blank needed.
 *
 * What happened when it was tried, on 2026-09-19, in a hidden pane.
 *
 * Stepping with R3F's global effects on timed 45 to 90 ms a frame, because
 * every `useFrame` in the scene ran too: the motion player writes the view
 * store and the store rebuilds the model, which the model's own comment says
 * costs about a tenth of a second. That is a state rebuild and not a draw, so
 * the caller now passes `false` and the same timestamp every frame.
 *
 * With the effects off it still timed about 50 ms, and `gl.info.render`
 * reported one call and one triangle. One triangle is not this plateau. So
 * either the step is not drawing the scene at all, or a hidden surface's GPU
 * work is throttled and `finish()` is waiting on a composite that will not
 * come until somebody looks at the window. Both are consistent with what was
 * seen and neither could be told apart from a pane that cannot be painted.
 *
 * What the next session has to do before any number from here is quoted, and
 * it needs a visible window, which is what `scripts/frames.md` has always
 * said: check that `gl.info.render.calls` after a step is the scene's own
 * count and not one; check that the cost tracks something known, by hiding
 * the 700 instanced plants and watching it fall; and check it against
 * `countFrames` on a stand slow enough to be under the display's refresh,
 * where the two should agree to within what the compositor costs. Until all
 * three pass, this is a hypothesis with tests round it.
 *
 * The three things it does do right, whatever the above turns out to be. It
 * warms up first, because the first frames after a change of state compile
 * programs and upload textures. It ends each run on `finish()`, because
 * without a sync point the timer stops when the commands are queued and not
 * when they are drawn. And it takes several runs and gives the median,
 * because a garbage collection inside one run is not the frame's cost.
 *
 * Whatever it becomes, it is never the rate a reader sees: it leaves out the
 * compositor, the wait for the blank and everything else between frames.
 */
export interface FrameCost {
  /** Milliseconds a frame, the median run. */
  ms: number;
  /** Frames counted in each run. */
  frames: number;
  /** Every run's own millisecond figure, so the spread is visible and not averaged away. */
  runs: number[];
  /** Whether the sync point was real. False means the timer may have stopped early. */
  synced: boolean;
}

/** What this needs of an R3F root, so the measure can be tested without one. */
export interface Steppable {
  advance(timestamp: number): void;
  finish(): boolean;
}

export function measureCost(root: Steppable, frames = 60, runs = 3): FrameCost {
  // The same timestamp every time, on purpose: the scene must not move
  // between frames, or what is timed is the scene changing and not the
  // renderer drawing. The caller's `advance` is expected to skip the frame
  // callbacks for the same reason.
  const at = performance.now();
  // Warm up: the first frames after a change of state compile and upload.
  for (let i = 0; i < 10; i++) root.advance(at);
  const synced = root.finish();

  const each: number[] = [];
  for (let r = 0; r < runs; r++) {
    const start = performance.now();
    for (let i = 0; i < frames; i++) root.advance(at);
    root.finish();
    each.push((performance.now() - start) / frames);
  }
  const sorted = [...each].sort((a, b) => a - b);
  return { ms: Math.round((sorted[Math.floor(sorted.length / 2)] as number) * 100) / 100, frames, runs: each.map((v) => Math.round(v * 100) / 100), synced };
}
