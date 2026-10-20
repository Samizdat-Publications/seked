/**
 * Chapter 5's sky slider (docs/plan.html, phase 7): the belt of Orion on the
 * southern meridian at Giza at any epoch. Every number is the claims engine's
 * or the sky package's: the belt's angle and the pyramids' diagonal are C4's
 * own first comparison evaluated at the slider's epoch, so at C4's epoch the
 * readout is the dossier's; the stars' places are the same Vondrák precession
 * at the latitude the environment carries for the Great Pyramid.
 */
import { evaluateClaim, type Claim } from '@seked/claims/browser';
import { altAz, skyEnvironment } from '@seked/sky/browser';

export const BELT = ['alnitak', 'alnilam', 'mintaka'] as const;

export interface BeltReading {
  epoch: number;
  /** C4's first comparison at this epoch: the belt's angle from the meridian, and the G1 to G3 diagonal. */
  angleDeg: number;
  diagonalDeg: number;
  /** Alnitak's altitude as it crosses the meridian. */
  transitDeg: number;
  /** Each belt star's altitude and azimuth at the moment Alnitak transits. */
  stars: { id: (typeof BELT)[number]; altDeg: number; azDeg: number }[];
}

export function beltAt(c4: Claim, env: Record<string, number>, epoch: number): BeltReading {
  const latitudeDeg = env['g1.center.latitude'];
  if (latitudeDeg === undefined) throw new Error('the environment carries no g1.center.latitude');
  const [angle] = evaluateClaim({ ...c4, epoch }, env).comparisons;
  const sky = skyEnvironment({ epoch, latitudeDeg, longitudeDeg: env['g1.center.longitude'] ?? 0 });
  const at = (id: string, k: string) => sky[`star.${id}.${k}`] ?? NaN;
  const lstDeg = at('alnitak', 'ra');
  return {
    epoch,
    angleDeg: angle?.value ?? NaN,
    diagonalDeg: angle?.targetValue ?? NaN,
    transitDeg: at('alnitak', 'transit.altitude'),
    stars: BELT.map((id) => ({ id, ...altAz({ raDeg: at(id, 'ra'), decDeg: at(id, 'dec'), latDeg: latitudeDeg, lstDeg }) })),
  };
}

/** The epoch, to the nearest `step` years in [from, to], at which Alnitak crosses the meridian lowest. */
export function lowestTransit(env: Record<string, number>, from: number, to: number, step = 10): number {
  const latitudeDeg = env['g1.center.latitude'] ?? NaN;
  const transit = (e: number) => skyEnvironment({ epoch: e, latitudeDeg, longitudeDeg: 0 })['star.alnitak.transit.altitude'] ?? NaN;
  let best = from;
  for (let e = from; e <= to; e += step) if (transit(e) < transit(best)) best = e;
  return best;
}

/** An astronomical year as the page says it: −10449 is 10,450 BCE, 2026 is 2026 CE. */
export const yearLabel = (epoch: number) => {
  const y = Math.round(epoch);
  return y <= 0 ? `${(1 - y).toLocaleString('en-GB')} BCE` : `${y} CE`;
};

/** A rectilinear view as render/giza/cameras.py `aim` sets one: yaw a compass bearing, pitch up, fov the vertical field. */
export interface Lens {
  yaw: number;
  pitch: number;
  fov: number;
  aspect: number;
}

const RAD = Math.PI / 180;

/**
 * Where a direction (altitude, azimuth) falls on a picture rendered through `lens`, as fractions across from
 * the left and down from the top, or null if it is behind the camera. Stars are at infinity, so only the
 * direction counts; refraction is left out (six arcminutes at ten degrees up).
 */
export function project(lens: Lens, altDeg: number, azDeg: number): { x: number; y: number } | null {
  const dir = (alt: number, az: number) => [Math.cos(alt * RAD) * Math.sin(az * RAD), Math.cos(alt * RAD) * Math.cos(az * RAD), Math.sin(alt * RAD)];
  const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
  const f = dir(lens.pitch, lens.yaw);
  const r = [Math.cos(lens.yaw * RAD), -Math.sin(lens.yaw * RAD), 0]; // forward × up: the picture's right
  const u = [r[1]! * f[2]! - r[2]! * f[1]!, r[2]! * f[0]! - r[0]! * f[2]!, r[0]! * f[1]! - r[1]! * f[0]!];
  const d = dir(altDeg, azDeg);
  const depth = dot(d, f);
  if (depth <= 0) return null;
  const t = Math.tan((lens.fov / 2) * RAD);
  return { x: 0.5 + dot(d, r) / depth / (t * lens.aspect) / 2, y: 0.5 - dot(d, u) / depth / t / 2 };
}
