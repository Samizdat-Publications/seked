/**
 * Playing a shot: the frame of motion written into the view store.
 *
 * Everything a shot moves is written through the store's own actions, so a
 * frame of a sequence is a view a reader could have reached by hand and the
 * address bar keeps mirroring it. Nothing here draws, nothing here reads
 * three, and nothing here knows what clock it is on: the caller hands in the
 * second of the shot it wants, whether that came from a frame's delta or from
 * a film stepping one twenty-fourth at a time.
 *
 * Two things are not written every frame.
 *
 * The sun and the epoch are expensive. Moving the sun relights the scene and
 * rebuilds the environment map; moving the epoch precesses five thousand
 * stars. Both are changes the eye reads as continuous well below the frame
 * rate, so they are written twelve times a second of shot time and no more.
 * Twelve is of the shot's clock and not of the wall's, so a film at twenty
 * four frames a second sees exactly the same twelve as a browser at sixty,
 * and a film is the sequence the reader watched.
 *
 * The camera is written every frame, because it is the one thing the eye does
 * read frame by frame and it costs a vector.
 *
 * What was last written is remembered in a `Scratch` the caller owns rather
 * than read back off the store, so a value the shot has not moved is not
 * written again, and the store's own rounding (the day is an integer) cannot
 * be mistaken for the shot having moved.
 */
import type { ViewStore } from '../store';
import { EPOCH_STEP, LST_STEP, stateById, type CameraView, type LayerId, type Moment } from '../view';
import { lerpAngleDeg, lerpMoment, lerpNumber, sample } from './ease';
import { cameraAt } from './path';
import type { Shot } from './types';

/** How often a shot may move the sun or the epoch, per second of its own time. */
export const WRITES_PER_SECOND = 12;

const WRITE_INTERVAL = 1 / WRITES_PER_SECOND;

/**
 * The smallest move of the sun worth a write, in hours: a quarter of a minute
 * of solar time, which is well under the width of the sun itself.
 */
const HOUR_EPSILON = 1 / 240;

/** What has already been written for the shot being played. */
export interface Scratch {
  /** The shot these values belong to, by its id, or null before any shot has begun. */
  shot: string | null;
  /** Whether the shot's change of state has landed. */
  stateDone: boolean;
  /** Whether the epoch has been handed back to the view (see `applyShot`). */
  epochHandedBack: boolean;
  moment: Moment | null;
  /** The second of the shot the moment was last written at. */
  momentAt: number;
  epoch: number | null;
  epochAt: number;
  lst: number | null;
}

export function newScratch(): Scratch {
  return { shot: null, stateDone: false, epochHandedBack: false, moment: null, momentAt: 0, epoch: null, epochAt: 0, lst: null };
}

/** Forget everything, in place, so the player can keep one scratch for the whole run. */
export function resetScratch(scratch: Scratch): void {
  Object.assign(scratch, newScratch());
}

export interface ApplyOptions {
  /**
   * The sidereal time at which a named star crosses the meridian at an epoch,
   * for a shot that holds one there. It is an argument rather than an import
   * because the catalogue lives in the viewer's bundle and the tests want to
   * hold a star still without one.
   */
  meridianLst?: (starId: string, epoch: number) => number | undefined;
  /**
   * Called immediately before the shot's change of state lands, which is
   * where the player lengthens the dissolve for a shot that asks for it.
   */
  onStateChange?: (shot: Shot) => void;
}

/**
 * The epoch the sky is at, as the shot has left it: what the shot last wrote,
 * else the reader's override, else the timeline stop's own. A claim's own
 * epoch is not consulted, because a shot that cares which epoch its star is
 * held at states it.
 */
function epochNow(store: ViewStore, scratch: Scratch): number {
  return scratch.epoch ?? store.epoch ?? stateById(store.state).epoch;
}

/**
 * Everything a shot sets once, at its start: the claim, the layers, the cut,
 * the Sphinx, the camera mode, and the state when the shot's change of state
 * has already come due. A shot begun part way through, which is what a seek
 * does, takes its sun, epoch and sidereal time from that second rather than
 * from its first key.
 */
function beginShot(shot: Shot, time: number, store: ViewStore, scratch: Scratch, options: ApplyOptions): void {
  // `setClaim` toggles, and hands the epoch back to the claims as it goes, so
  // it is guarded and it comes before anything that sets the epoch.
  if (shot.claim !== undefined && store.claim !== shot.claim) store.setClaim(shot.claim);
  for (const [id, on] of Object.entries(shot.layers ?? {}) as [LayerId, boolean][]) {
    if (store.layers[id] !== on) store.toggleLayer(id);
  }
  store.setSection({ on: false, ...shot.section });
  if (shot.sphinx !== undefined) store.setSphinx(shot.sphinx);
  if (shot.state && shot.state.at <= time) {
    options.onStateChange?.(shot);
    store.setState(shot.state.to);
    scratch.stateDone = true;
  }
  if (shot.epoch && shot.epoch.length > 0) {
    const epoch = sample(shot.epoch, time, lerpNumber);
    store.setEpoch(epoch);
    scratch.epoch = epoch;
    scratch.epochAt = time;
  }
  if (Array.isArray(shot.lst) && shot.lst.length > 0) {
    const lst = sample(shot.lst, time, lerpAngleDeg);
    store.setLst(lst);
    scratch.lst = lst;
  }
  if (shot.moment && shot.moment.length > 0) {
    const moment = sample(shot.moment, time, lerpMoment);
    store.setMoment(moment);
    scratch.moment = moment;
    scratch.momentAt = time;
  }
  store.setMode('orbit');
}

/** Whether the sun has moved far enough since the last write to be worth another. */
function momentMoved(want: Moment, was: Moment | null): boolean {
  if (!was) return true;
  return Math.round(want.day) !== Math.round(was.day) || Math.abs(want.hour - was.hour) > HOUR_EPSILON;
}

/**
 * Whether the shot has reached its last key of this kind. A value that has
 * arrived is written exactly even when the move that brought it there was
 * smaller than the gate above, so a shot ends on the value it states rather
 * than a gate's width short of it.
 */
const arrivedAt = (keys: readonly { at: number }[], time: number): boolean => time >= (keys[keys.length - 1] as { at: number }).at;

/**
 * Write one frame of a shot into the view.
 *
 * `time` is seconds from the shot's start. The first call for a shot, at
 * whatever second, does the shot's one-time settings; every call moves the
 * camera and whatever the shot is tweening.
 */
export function applyShot(shot: Shot, time: number, store: ViewStore, scratch: Scratch, options: ApplyOptions = {}): void {
  if (scratch.shot !== shot.id) {
    resetScratch(scratch);
    scratch.shot = shot.id;
    beginShot(shot, time, store, scratch, options);
  }

  if (shot.state && !scratch.stateDone && time >= shot.state.at) {
    options.onStateChange?.(shot);
    store.setState(shot.state.to);
    scratch.stateDone = true;
  }

  const camera: CameraView = cameraAt(shot.camera, time);
  store.showCamera(camera);

  if (shot.moment && shot.moment.length > 0) {
    const want = sample(shot.moment, time, lerpMoment);
    const landed = arrivedAt(shot.moment, time) && (scratch.moment === null || want.day !== scratch.moment.day || want.hour !== scratch.moment.hour);
    if (time - scratch.momentAt >= WRITE_INTERVAL && (momentMoved(want, scratch.moment) || landed)) {
      store.setMoment(want);
      scratch.moment = want;
      scratch.momentAt = time;
    }
  }

  if (shot.epoch && shot.epoch.length > 0) {
    const last = shot.epoch[shot.epoch.length - 1] as { at: number; value: number };
    // A shot that rolls the sky to the stop's own epoch and then runs on is
    // holding the sky at a year the timeline would have chosen anyway, so the
    // override is handed back and the caption stops saying it is held.
    if (!scratch.epochHandedBack && time > last.at && last.value === stateById(store.state).epoch) {
      store.setEpoch(null);
      scratch.epochHandedBack = true;
    } else if (!scratch.epochHandedBack) {
      const want = sample(shot.epoch, time, lerpNumber);
      const moved = scratch.epoch === null || Math.abs(want - scratch.epoch) >= EPOCH_STEP || (arrivedAt(shot.epoch, time) && want !== scratch.epoch);
      if (time - scratch.epochAt >= WRITE_INTERVAL && moved) {
        store.setEpoch(want);
        scratch.epoch = want;
        scratch.epochAt = time;
      }
    }
  }

  if (shot.lst) {
    // Keys turn the sky on their own clock; a named star instead pins it, so
    // the star stays on the meridian while the epoch rolls under it.
    const keyed = Array.isArray(shot.lst) && shot.lst.length > 0 ? shot.lst : undefined;
    const want = keyed
      ? sample(keyed, time, lerpAngleDeg)
      : Array.isArray(shot.lst)
        ? undefined
        : options.meridianLst?.(shot.lst.meridian, epochNow(store, scratch));
    // The sidereal control's own step is the smallest move worth drawing.
    const moved =
      want !== undefined &&
      (scratch.lst === null || Math.abs(want - scratch.lst) >= LST_STEP || (keyed !== undefined && arrivedAt(keyed, time) && want !== scratch.lst));
    if (want !== undefined && moved) {
      store.setLst(want);
      scratch.lst = want;
    }
  }
}
