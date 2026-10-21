/**
 * The panorama maths, shared by the shader and the 2D overlay so the two cannot disagree.
 *
 * Frame: metres, +x east, +y north, +z up, origin at the Great Pyramid's base centre.
 * Panoramas: equirectangular, image centre on true north, azimuth increasing to the right,
 * so u = 0.5 + az / 2pi and v = 0.5 - el / pi.
 *
 * A view is a yaw (radians clockwise from north), a pitch (radians up from the horizon) and a vertical field of
 * view. Screen coordinates are CSS pixels from the top left.
 */

export type Vec3 = [number, number, number];
export interface View { yaw: number; pitch: number }

export const DEG = Math.PI / 180;
export const MIN_FOV = 20 * DEG;
export const MAX_FOV = 100 * DEG;
/** The narrowest horizontal field a portrait screen is given, so a phone still sees the subject. */
export const MIN_HFOV = 55 * DEG;
export const PITCH_MAX = 80 * DEG;

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/** An angle in (-pi, pi]. */
export function wrapAngle(a: number): number {
  a = (a + Math.PI) % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a - Math.PI;
}

/** The world direction (unit) through a point on screen, in normalised device coordinates (-1 to 1, y up). */
export function rayDirection(ndcX: number, ndcY: number, view: View, fov: number, aspect: number): Vec3 {
  const t = Math.tan(fov / 2);
  let x = ndcX * t * aspect, y = ndcY * t, z = 1;
  const n = Math.hypot(x, y, z);
  x /= n; y /= n; z /= n;
  const cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  const y2 = y * cp + z * sp, z2 = -y * sp + z * cp;
  const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw);
  return [x * cy + z2 * sy, -x * sy + z2 * cy, y2];
}

/** Where a world direction falls in an equirectangular panorama centred on north. */
export function directionToUv(w: Vec3): [number, number] {
  const az = Math.atan2(w[0], w[1]);
  const el = Math.asin(clamp(w[2], -1, 1));
  return [0.5 + az / (2 * Math.PI), 0.5 - el / Math.PI];
}

/**
 * Where a point in the frame falls on screen, seen from `camera`; null behind the viewer or at the very edge of
 * what is ahead (the overlay would draw a line to infinity).
 */
export function project(p: Vec3, camera: Vec3, view: View, fov: number, width: number, height: number): [number, number] | null {
  let dx = p[0] - camera[0], dy = p[1] - camera[1], dz = p[2] - camera[2];
  const n = Math.hypot(dx, dy, dz) || 1;
  dx /= n; dy /= n; dz /= n;
  const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw);
  const rx = dx * cy - dy * sy;          // to the right
  const fz = dx * sy + dy * cy;          // ahead, before pitch
  const cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  const ry = dz * cp - fz * sp;          // up
  const rz = dz * sp + fz * cp;          // ahead
  if (rz <= 0.02) return null;
  const t = Math.tan(fov / 2);
  return [(rx / (rz * t * (width / height)) * 0.5 + 0.5) * width, (0.5 - ry / (rz * t) * 0.5) * height];
}

/** A point given as a bearing from the camera: azimuth and altitude in degrees and a distance in metres. */
export function fromCamera(camera: Vec3, dir: Vec3): Vec3 {
  const az = dir[0] * DEG, al = dir[1] * DEG, d = dir[2];
  return [camera[0] + d * Math.cos(al) * Math.sin(az), camera[1] + d * Math.cos(al) * Math.cos(az), camera[2] + d * Math.sin(al)];
}

/** A station's vertical field, widened on a narrow screen so the horizontal field is at least MIN_HFOV. */
export function fitFov(vfov: number, width: number, height: number): number {
  const need = 2 * Math.atan(Math.tan(MIN_HFOV / 2) / (width / Math.max(height, 1)));
  return clamp(Math.max(vfov, need), MIN_FOV, MAX_FOV);
}

/**
 * Where a shot's subject sits on screen, as a fraction of the height from the top: above the middle, clear of the
 * caption band along the bottom, as a photographer frames over a caption.
 */
export const FRAME_PIVOT = 0.4;

/**
 * How a shot framed for a wide screen is framed on this one: the vertical field fitted to it (a narrow screen
 * widens it, fitFov), and the pitch moved so what the shot put FRAME_PIVOT of the way down stays there. Without
 * it the extra field of a phone splits evenly and the subject sinks under a tall empty sky.
 */
export function frameAim(pitch: number, vfov: number, width: number, height: number): { pitch: number; fov: number } {
  const fov = fitFov(vfov, width, height);
  const up = 1 - 2 * FRAME_PIVOT;
  const subject = pitch + Math.atan(up * Math.tan(clamp(vfov, MIN_FOV, MAX_FOV) / 2));
  return { pitch: clamp(subject - Math.atan(up * Math.tan(fov / 2)), -PITCH_MAX, PITCH_MAX), fov };
}

/** The mip level that puts about one texel under each pixel at the centre of the view. */
export function lodFor(textureWidth: number, canvasHeight: number, fov: number): number {
  const texelsPerPixel = (textureWidth / (2 * Math.PI)) / (canvasHeight / fov);
  return Math.max(0, Math.log2(Math.max(texelsPerPixel, 1e-3)));
}

/** A detail patch (render/patches.py): a sharper picture of part of the view, from the same place in the same light. */
export interface Patch { src: string; yaw: number; pitch: number; fov: number; aspect: number }

/** The patch whose middle is nearest the view, or null when there is none. */
export function nearestPatch(list: readonly Patch[] | undefined, view: View): Patch | null {
  let best: Patch | null = null, d = Infinity;
  for (const p of list ?? []) {
    const dd = Math.abs(wrapAngle(p.yaw - view.yaw)) + Math.abs(p.pitch - view.pitch);
    if (dd < d) { d = dd; best = p; }
  }
  return best;
}

/** A patch is only worth fetching when the view is closer than a 4096-wide panorama's pixels hold. */
export function wantsPatch(fov: number, canvasHeight: number, panoramaWidth = 4096): boolean {
  return canvasHeight > 0 && (panoramaWidth / (2 * Math.PI)) * fov / canvasHeight <= 0.8;
}

/**
 * Where a world direction falls in a patch, as -1 to 1 across and up its picture; null when it is behind the
 * patch's camera. The shader's `patched` does the same sum; this is its reference.
 */
export function patchCoords(w: Vec3, patch: Patch): [number, number] | null {
  const cy = Math.cos(patch.yaw), sy = Math.sin(patch.yaw), cp = Math.cos(patch.pitch), sp = Math.sin(patch.pitch);
  const a: Vec3 = [w[0] * cy - w[1] * sy, w[2], w[0] * sy + w[1] * cy];
  const r: Vec3 = [a[0], cp * a[1] - sp * a[2], sp * a[1] + cp * a[2]];
  if (r[2] <= 0) return null;
  const tq = Math.tan(patch.fov / 2);
  return [r[0] / (r[2] * tq * patch.aspect), r[1] / (r[2] * tq)];
}
