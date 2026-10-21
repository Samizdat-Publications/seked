/**
 * Chapter 7's "a plan laid out at Giza in the eleventh millennium BCE": the three pyramids' footprints drawn on the
 * First Time from the air (progress 0041), where the claim says their plan already lay with no pyramid on it. They
 * are projected through that render's own camera, the `overview` shot imported from render/shots.json, so the lens
 * is not typed twice; the centres and sides come from the environment. Footprints are drawn at the frame's z = 0:
 * Khafre's base stands about ten metres higher, a few pixels at two kilometres.
 */
import shots from '../../../render/shots.json';

export interface Shot { x: number; y: number; z: number; target: number[]; lens: number }
export const OVERVIEW = shots.shots.find((s) => s.id === 'overview') as unknown as Shot;
/** The still the plan is drawn on, and its size: the camera's aspect. */
export const PLAN_STILL = { src: 'progress/0041-first-time-overview.png', width: 960, height: 540 };

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V): V => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * A point in the Giza frame (x east, y north, z up, metres) as fractions of the picture, or null behind the camera.
 * Blender's camera as render/giza/cameras.py frames it: aimed at its target with world up kept up, a 36 mm sensor
 * fitted to the picture's wider side.
 */
export function projectShot(shot: Shot, aspect: number, p: V): { x: number; y: number } | null {
  const eye: V = [shot.x, shot.y, shot.z];
  const f = unit(sub(shot.target as V, eye));
  const r = unit(cross(f, [0, 0, 1]));
  const u = cross(r, f);
  const d = sub(p, eye);
  const depth = dot(d, f);
  if (depth <= 0) return null;
  const t = 18 / shot.lens; // the half-width of the sensor over the focal length
  return { x: 0.5 + dot(d, r) / depth / t / 2, y: 0.5 - (dot(d, u) / depth / t) * aspect / 2 };
}

export interface Footprint { id: string; name: string; corners: { x: number; y: number }[] }

/** The three pyramids' bases, as four projected corners each, from the environment's centres and sides. */
export function planFootprints(env: Record<string, number>, shot = OVERVIEW, aspect = PLAN_STILL.width / PLAN_STILL.height): Footprint[] {
  const need = (k: string) => {
    const v = env[k];
    if (v === undefined) throw new Error(`the environment has no ${k}`);
    return v;
  };
  const bases = [
    { id: 'g1', name: 'Khufu', x: need('g1.centre.offset.east'), y: need('g1.centre.offset.north'), ew: need('g1.base.side.mean'), ns: need('g1.base.side.mean') },
    { id: 'g2', name: 'Khafre', x: -need('g2.centre.offset.west'), y: -need('g2.centre.offset.south'), ew: need('g2.base.side.mean'), ns: need('g2.base.side.mean') },
    { id: 'g3', name: 'Menkaure', x: -need('g3.centre.offset.west'), y: -need('g3.centre.offset.south'), ew: need('g3.base.side.ew'), ns: need('g3.base.side.ns') },
  ];
  return bases.map((b) => ({
    id: b.id,
    name: b.name,
    corners: ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sy]) =>
      projectShot(shot, aspect, [b.x + (sx * b.ew) / 2, b.y + (sy * b.ns) / 2, 0])!),
  }));
}
