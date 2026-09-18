/**
 * The camera's path between its keys.
 *
 * A straight line from one stand to another is the wrong line on this
 * plateau. The stands that matter are around and between three pyramids, so
 * the straight line from the southern panorama to the harbour goes through
 * Khafre, and a move over a kilometre of ground with no rise in it reads as a
 * dolly on rails rather than as a look at a place. So the position takes a
 * quadratic Bezier whose control point is the midpoint lifted, which arcs the
 * camera up and over, and the target keeps to its straight eased line, which
 * is what holds the subject still in the frame while the camera swings.
 *
 * The lift is a fraction of the distance between the two keys, so the arc
 * scales with the move: a long crossing rises high and a short adjustment
 * hardly rises at all. A quadratic Bezier reaches half its control point's
 * lift at the halfway mark, so a two kilometre move with the default lift
 * tops out about 250 m over the line between its stands, which clears the
 * Great Pyramid from any stand on the plateau.
 *
 * Nothing here is a measurement. Every number in this file is a look choice,
 * named as one where it stands.
 */
import type { CameraView, Vec3 } from '../view';
import { ease, lerpVec3 } from './ease';
import type { CameraKey } from './types';

/**
 * A look choice: two stands closer together than this are a small adjustment
 * rather than a crossing, and arcing them would read as a bounce.
 */
export const ARC_DISTANCE_M = 150;

/** A look choice: how far a move's control point is lifted, as a fraction of its own length. */
export const DEFAULT_LIFT = 0.25;

/**
 * A look choice: the lowest the path is taken, in metres in the world frame.
 * The ground is near zero at the datum and the harbour floor is below it, so
 * an arc between two stands either side of a dip must not follow the dip. A
 * shot that means to stand lower than this puts both its keys there, and then
 * the floor is the lower of those two keys and the shot keeps what it asked
 * for: the clamp shapes the path between stands, never a stand itself.
 */
export const MIN_CAMERA_Y = 2;

const distanceOf = (a: Vec3, b: Vec3): number => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

/**
 * The position along one arc, at a fraction of the way through the move. The
 * control point is the midpoint raised straight up, so the arc stays in the
 * vertical plane the two stands share and the move reads as a rise and a fall
 * rather than as a swerve.
 */
export function arcPosition(from: Vec3, to: Vec3, lift: number, u: number): Vec3 {
  const rise = lift * distanceOf(from, to);
  const control: Vec3 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + rise, (from[2] + to[2]) / 2];
  const v = 1 - u;
  const at = (i: 0 | 1 | 2): number => v * v * from[i] + 2 * v * u * control[i] + u * u * to[i];
  const floor = Math.min(MIN_CAMERA_Y, from[1], to[1]);
  return [at(0), Math.max(at(1), floor), at(2)];
}

/** How high this move arcs: what the key asks for, or the default for a move long enough to need one. */
export function liftOf(key: CameraKey, from: Vec3, to: Vec3): number {
  if (key.lift !== undefined) return key.lift;
  return distanceOf(from, to) > ARC_DISTANCE_M ? DEFAULT_LIFT : 0;
}

/**
 * Where the camera is at a second into the shot. One key is a stand and is
 * returned exactly; before the first key and after the last the nearest is
 * held, as `sample` holds any other key list.
 */
export function cameraAt(keys: readonly CameraKey[], t: number): CameraView {
  const first = keys[0];
  if (!first) throw new Error('cameraAt: a shot with no camera in it');
  if (t <= first.at) return first.value;
  const last = keys[keys.length - 1] as CameraKey;
  if (t >= last.at) return last.value;
  for (let i = 1; i < keys.length; i++) {
    const to = keys[i] as CameraKey;
    if (t > to.at) continue;
    const from = keys[i - 1] as CameraKey;
    const span = to.at - from.at;
    const u = span <= 0 ? 1 : ease(to.ease ?? 'inOut', (t - from.at) / span);
    return {
      position: arcPosition(from.value.position, to.value.position, liftOf(to, from.value.position, to.value.position), u),
      target: lerpVec3(from.value.target, to.value.target, u),
    };
  }
  return last.value;
}
