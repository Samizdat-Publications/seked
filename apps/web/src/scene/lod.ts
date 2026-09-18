/**
 * Which level of detail a thing is drawn at, and when it is allowed to change.
 *
 * `Standins.tsx` and `Props.tsx` both swapped levels at a hard distance: the
 * level was whichever band the camera's distance fell in this frame, and the
 * swap happened the frame the distance crossed the line. Standing still that
 * is invisible. In a slow move it is the one thing on the plateau that pops,
 * because a camera creeping toward the valley temple crosses the line at a
 * few centimetres a frame and the statue changes shape between two frames
 * that are otherwise identical. Worse, a camera sitting on the line with the
 * least drift in it swaps back and forth every frame.
 *
 * Two rules fix both, and they are the same two a hysteresis always is.
 *
 * The line is not one line. Going out, the coarser level takes over at the
 * distance itself; coming back in, the finer one does not return until the
 * camera is inside `RETURN` times that distance. So a camera loitering on the
 * line stays on whichever side it arrived from and cannot flutter.
 *
 * And a level has to be asked for `SETTLE` frames running before it is drawn,
 * so a single frame of a jittering distance, which is what a reflection pass
 * or a dropped frame can produce, never swaps anything.
 *
 * Both numbers are look choices and neither is a measurement.
 */

/**
 * How far back inside the line a camera has to come before the finer level
 * returns, as a share of the line. A look choice: at 0.85 the band a level
 * holds through is about a seventh wider coming in than going out, which is
 * wide enough that no move at a walking pace crosses it twice and narrow
 * enough that nothing is drawn coarse where it fills the frame.
 */
export const LOD_RETURN = 0.85;

/**
 * How many frames running a level has to be asked for before it is drawn. A
 * look choice, and the smallest number that is more than one: two frames is
 * a thirtieth of a second at the rate a shot plays and is not a wait, and it
 * is enough to throw away the single odd frame.
 */
export const LOD_SETTLE = 2;

/** What one thing's level of detail remembers between frames. */
export interface Lod {
  /** The level being drawn, or -1 before the first frame has chosen one. */
  level: number;
  /** The level the distance has been asking for, and for how many frames running. */
  wanted: number;
  frames: number;
}

/** A level of detail that has not chosen yet, so its first frame is not a swap. */
export function newLod(): Lod {
  return { level: -1, wanted: -1, frames: 0 };
}

/**
 * The level to draw, given how far the camera is and the distances at which
 * each level gives way to the next. `lines[i]` is where level `i` gives way
 * to level `i + 1`, so a thing with `levels` levels reads `levels - 1` of
 * them and anything beyond the last line is the coarsest level there is.
 *
 * The state is written in place, because this is called once a frame for
 * every stand-in and every emplacement on the plateau and an object a frame
 * each is not worth it.
 */
export function chooseLod(lod: Lod, distance: number, lines: readonly number[], levels: number): number {
  const last = levels - 1;
  let wanted = lod.level < 0 ? 0 : Math.min(lod.level, last);
  // Out past the line the level is standing on, one level at a time.
  while (wanted < last && wanted < lines.length && distance >= (lines[wanted] as number)) wanted++;
  // And back in, but only once well inside the line that was crossed.
  while (wanted > 0 && distance < (lines[wanted - 1] as number) * LOD_RETURN) wanted--;

  if (lod.level < 0) {
    // The first frame is not a swap: whatever the distance says is what the
    // thing has always been drawn at.
    lod.level = wanted;
    lod.wanted = wanted;
    lod.frames = 0;
    return wanted;
  }
  if (wanted === lod.level) {
    lod.wanted = wanted;
    lod.frames = 0;
    return lod.level;
  }
  lod.frames = wanted === lod.wanted ? lod.frames + 1 : 1;
  lod.wanted = wanted;
  if (lod.frames >= LOD_SETTLE) {
    lod.level = wanted;
    lod.frames = 0;
  }
  return lod.level;
}
