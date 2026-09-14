import { squarePyramid } from './profile';

const DEG = Math.PI / 180;

/**
 * The four ways an offset from the site origin can already be stored. A
 * structure that carries any of them was placed by a survey, and a survey
 * beats an arithmetic on coordinates every time, so nothing is derived for it.
 */
const OFFSET_DIRECTIONS = ['east', 'north', 'west', 'south'] as const;

/**
 * Place the structures whose position the database gives as a geodetic
 * coordinate rather than as an offset measured on the ground.
 *
 * Petrie triangulated G2 and G3 from G1 and the database stores those as
 * metres south and west; the Sphinx has no such measurement here, only a
 * latitude and a longitude. This turns the second kind into the first, so a
 * claim can name `sphinx.centre.offset.east` beside `g2.centre.offset.west`
 * and not care which way the position was come by.
 *
 * The conversion is the flat one D1 uses for the bearing to Heliopolis:
 * north is the difference in latitude and east the difference in longitude
 * times the cosine of the origin's latitude, both scaled by the mean Earth
 * radius. It ignores the ellipsoid, which at 30° N has a meridional radius of
 * curvature about 0.3 % smaller than the mean radius and a transverse one
 * about 0.2 % larger. Over the 450 m from the Great Pyramid's base centre to
 * the Sphinx that is under 1.5 m, against the 55 m sigma the cited
 * coordinates themselves carry, so the approximation is not what limits this
 * number. It would be over ten kilometres.
 *
 * The origin is `g1.center.latitude` and `g1.center.longitude`, which is the
 * frame's own origin, so the Great Pyramid falls out of it at (0, 0) exactly.
 */
function deriveCentreOffsets(env: Environment): void {
  const lat0 = env['g1.center.latitude'];
  const lon0 = env['g1.center.longitude'];
  const radius = env['earth.radius.mean'];
  if (lat0 === undefined || lon0 === undefined || radius === undefined) return;
  const metresPerDegree = radius * DEG;
  for (const key of Object.keys(env)) {
    const match = /^(.+)\.center\.latitude$/.exec(key);
    if (!match) continue;
    const structure = match[1] as string;
    const latitude = env[key] as number;
    const longitude = env[`${structure}.center.longitude`];
    if (longitude === undefined) continue;
    if (OFFSET_DIRECTIONS.some((d) => env[`${structure}.centre.offset.${d}`] !== undefined)) continue;
    env[`${structure}.centre.offset.east`] = (longitude - lon0) * Math.cos(lat0 * DEG) * metresPerDegree;
    env[`${structure}.centre.offset.north`] = (latitude - lat0) * metresPerDegree;
  }
}

/**
 * The flat numeric environment claims evaluate against: every resolved
 * measurement plus the derived quantities, all in metres and degrees.
 * Derived keys are computed here so they can never drift from their inputs.
 */
export type Environment = Record<string, number>;

const STRUCTURES = ['g1', 'g2', 'g3'] as const;

export function buildEnvironment(measured: Record<string, number>): Environment {
  const env: Environment = { ...measured };

  for (const s of STRUCTURES) {
    const base = env[`${s}.base.side.mean`];
    const height = env[`${s}.height.original`];
    if (base === undefined || height === undefined) continue;
    const p = squarePyramid({ base, height });
    env[`${s}.base.half`] = p.half;
    env[`${s}.base.perimeter`] = p.perimeter;
    env[`${s}.base.area`] = p.baseArea;
    env[`${s}.apothem`] = p.apothem;
    env[`${s}.face.angle.derived`] = p.faceAngleDeg;
    env[`${s}.arris.length`] = p.arrisLength;
    env[`${s}.arris.angle`] = p.arrisAngleDeg;
    env[`${s}.volume`] = p.volume;
    env[`${s}.face.area`] = p.faceArea;
    env[`${s}.lateral.area`] = p.lateralArea;
    env[`${s}.height.squared`] = height * height;
  }

  // The socket base line, if a preset carries the four socket sides but no mean.
  if (env['g1.base.socket.mean'] === undefined) {
    const sides = ['north', 'east', 'south', 'west'].map((d) => env[`g1.base.socket.${d}`]);
    if (sides.every((v): v is number => v !== undefined)) {
      env['g1.base.socket.mean'] = sides.reduce((a, b) => a + b, 0) / 4;
    }
  }
  if (env['g1.base.socket.mean'] !== undefined) {
    env['g1.base.socket.perimeter'] = 4 * env['g1.base.socket.mean'];
  }

  deriveCentreOffsets(env);

  return env;
}
