import { squarePyramid } from './profile';

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

  return env;
}
