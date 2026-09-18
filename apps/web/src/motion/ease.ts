/**
 * Easing, and the keys it moves between.
 *
 * A shot states its camera, its sun, its epoch and its sidereal time as keys:
 * a value at a second from the shot's start. Everything between two keys is
 * this file's business. Nothing here knows what it is interpolating, so the
 * same `sample` serves a number, a moment, a camera and an angle, and the
 * player has one rule to read rather than four.
 *
 * Two of the four lerps are not the obvious one.
 *
 * The sun's hour is a clock and not a number: 18:30 to 6:30 the short way is
 * through midnight, which is what a shot that runs into the night means, but
 * 6:30 to 18:30 the short way would also be through midnight and that is not
 * what a shot sweeping a day means. The day settles it: a moment that keeps
 * its day cannot have crossed midnight, so its hour moves the long way round
 * the clock face, and only a moment whose day moves takes the short way.
 *
 * Sidereal time is an angle with no such tell, so it always goes the short
 * way: 350 degrees to 10 passes through 0, because the sky turns one way and
 * twenty degrees of it is twenty degrees whichever side of the origin it
 * falls.
 */
import { normaliseLst, type CameraView, type Moment, type Vec3 } from '../view';
import type { Ease, Key } from './types';

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

/**
 * How far along a move is, at a fraction of the way through it.
 *
 * `inOut` is the smoothstep, which leaves and arrives at rest. `in` and `out`
 * are its halves stretched back over the whole move, so a move that eases in
 * arrives at speed and one that eases out leaves at speed; putting the two
 * either side of a hold gives a stand that is left and returned to smoothly
 * with no stall in the middle. `linear` is for a value that should not be
 * shaped at all, such as an epoch rolling at a steady rate.
 */
export function ease(kind: Ease, t: number): number {
  const u = clamp01(t);
  switch (kind) {
    case 'linear':
      return u;
    // The first half of the smoothstep, doubled: flat at 0, at speed at 1.
    case 'in':
      return (3 * u * u - u * u * u) / 2;
    // The second half, likewise: at speed at 0, flat at 1.
    case 'out':
      return (3 * u - u * u * u) / 2;
    default:
      return u * u * (3 - 2 * u);
  }
}

/**
 * The value of a list of keys at a second into the shot. Before the first key
 * and after the last one the nearest key's value is held, so a key list is a
 * statement about a stretch of the shot and not about all of it. The ease that
 * governs a move is the ease of the key it arrives at.
 */
export function sample<T>(keys: readonly Key<T>[], t: number, lerp: (a: T, b: T, u: number) => T): T {
  const first = keys[0];
  if (!first) throw new Error('sample: a key list with no keys in it');
  if (t <= first.at) return first.value;
  const last = keys[keys.length - 1] as Key<T>;
  if (t >= last.at) return last.value;
  for (let i = 1; i < keys.length; i++) {
    const to = keys[i] as Key<T>;
    if (t > to.at) continue;
    const from = keys[i - 1] as Key<T>;
    const span = to.at - from.at;
    // Two keys at the same second are a cut: the later one wins.
    const u = span <= 0 ? 1 : ease(to.ease ?? 'inOut', (t - from.at) / span);
    return lerp(from.value, to.value, u);
  }
  return last.value;
}

export const lerpNumber = (a: number, b: number, u: number): number => a + (b - a) * u;

export const lerpVec3 = (a: Vec3, b: Vec3, u: number): Vec3 => [
  lerpNumber(a[0], b[0], u),
  lerpNumber(a[1], b[1], u),
  lerpNumber(a[2], b[2], u),
];

/** Position and target each on their own straight line. The arc is `path.ts`'s. */
export const lerpCameraView = (a: CameraView, b: CameraView, u: number): CameraView => ({
  position: lerpVec3(a.position, b.position, u),
  target: lerpVec3(a.target, b.target, u),
});

/** The signed short way from `a` to `b` round a circle of `size`. */
const shortWay = (a: number, b: number, size: number): number => {
  const half = size / 2;
  return ((((b - a) % size) + size + half) % size) - half;
};

/**
 * Sidereal time in degrees, the short way round, normalised the way the view
 * store normalises it so a tween and a drag cannot disagree.
 */
export const lerpAngleDeg = (a: number, b: number, u: number): number => normaliseLst(a + shortWay(a, b, 360) * u);

const HOURS_IN_A_DAY = 24;

/**
 * The sun's day and hour. The day is a plain number; the hour goes the short
 * way round the clock only when the day moves as well, which is the only way
 * a moment can have crossed midnight (see the head of this file).
 */
export function lerpMoment(a: Moment, b: Moment, u: number): Moment {
  const day = lerpNumber(a.day, b.day, u);
  const hour =
    Math.round(a.day) === Math.round(b.day)
      ? lerpNumber(a.hour, b.hour, u)
      : (((a.hour + shortWay(a.hour, b.hour, HOURS_IN_A_DAY) * u) % HOURS_IN_A_DAY) + HOURS_IN_A_DAY) % HOURS_IN_A_DAY;
  return { day, hour };
}
