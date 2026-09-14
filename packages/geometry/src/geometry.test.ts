import { describe, expect, it } from 'vitest';
import { formatDms } from '@seked/units';
import { buildEnvironment, frustumVolume, meshVolume, pyramidLandmarks, pyramidMesh, squarePyramid } from './index';

const G1 = { base: 230.33, height: 146.59 };

describe('square pyramid profile (Petrie-derived numbers come out of the model)', () => {
  const p = squarePyramid(G1);
  it('perimeter, apothem and volume', () => {
    expect(p.perimeter).toBeCloseTo(921.32, 2);
    expect(p.apothem).toBeCloseTo(186.42, 1);
    expect(p.volume / 1e6).toBeCloseTo(2.592, 2);
  });
  it('face and arris angles', () => {
    expect(formatDms(p.faceAngleDeg)).toBe('51°50′45″'); // Lehner tabulates 51°50′40″ from the unrounded survey
    expect(formatDms(p.arrisAngleDeg)).toBe('41°59′20″');
  });
  it('perimeter over height is 2π to 0.03 %', () => {
    const ratio = p.perimeter / p.height;
    expect(Math.abs(ratio - 2 * Math.PI) / (2 * Math.PI)).toBeLessThan(0.0003);
  });
  it('apothem over half-base is φ to 0.05 %', () => {
    const phi = (1 + Math.sqrt(5)) / 2;
    expect(Math.abs(p.apothem / p.half - phi) / phi).toBeLessThan(0.0005);
  });
});

describe('pyramid mesh', () => {
  it('closed mesh volume equals b²h/3 with no concavity', () => {
    const m = pyramidMesh(G1);
    expect(m.triangleCount).toBe(16);
    const v = squarePyramid(G1).volume;
    expect(Math.abs(meshVolume(m) - v) / v).toBeLessThan(1e-6); // positions are float32
  });
  it('truncated mesh volume equals the frustum formula', () => {
    const m = pyramidMesh({ ...G1, truncateAt: 138.75 });
    expect(m.triangleCount).toBe(32);
    const v = frustumVolume(G1.base, G1.height, 138.75);
    expect(Math.abs(meshVolume(m) - v) / v).toBeLessThan(1e-6);
  });
  it('concavity removes a small volume', () => {
    const flat = meshVolume(pyramidMesh(G1));
    const hollow = meshVolume(pyramidMesh({ ...G1, concavity: 0.94 }));
    expect(hollow).toBeLessThan(flat);
    expect((flat - hollow) / flat).toBeLessThan(0.01);
  });
});

describe('landmarks', () => {
  it('names the apex, corners and indented midpoints', () => {
    const l = pyramidLandmarks({ ...G1, concavity: 0.94, prefix: 'g1' });
    expect(l['g1.apex']).toEqual([0, 0, 146.59]);
    expect(l['g1.corner.NE']).toEqual([115.165, 115.165, 0]);
    expect(l['g1.side.mid.N']?.[1]).toBeCloseTo(114.225, 3);
  });
});

describe('environment', () => {
  it('adds derived keys for each structure that has a base and a height', () => {
    const env = buildEnvironment({ 'g1.base.side.mean': 230.33, 'g1.height.original': 146.59, 'g2.base.side.mean': 215.25 });
    expect(env['g1.base.perimeter']).toBeCloseTo(921.32, 2);
    expect(env['g1.height.squared']).toBeCloseTo(146.59 ** 2, 6);
    expect(env['g2.base.perimeter']).toBeUndefined();
  });
  it('derives the socket mean from four sides', () => {
    const env = buildEnvironment({ 'g1.base.socket.north': 1, 'g1.base.socket.east': 2, 'g1.base.socket.south': 3, 'g1.base.socket.west': 4 });
    expect(env['g1.base.socket.mean']).toBe(2.5);
    expect(env['g1.base.socket.perimeter']).toBe(10);
  });
});

/**
 * The site origin, a structure a kilometre north-east of it and one placed by
 * a survey instead. The coordinates are round numbers chosen so the answers
 * can be checked by hand; they are not measurements of anything.
 */
const ORIGIN = {
  'g1.center.latitude': 30,
  'g1.center.longitude': 31,
  'earth.radius.mean': 6371008.8,
};
const METRES_PER_DEGREE = (6371008.8 * Math.PI) / 180;

describe('placing a structure that the database gives a coordinate for', () => {
  it('puts the site origin itself at the origin of the frame', () => {
    const env = buildEnvironment(ORIGIN);
    expect(env['g1.centre.offset.east']).toBe(0);
    expect(env['g1.centre.offset.north']).toBe(0);
  });

  it('turns a latitude and a longitude into metres east and north', () => {
    const env = buildEnvironment({
      ...ORIGIN,
      'sphinx.center.latitude': 30.01,
      'sphinx.center.longitude': 31.02,
    });
    expect(env['sphinx.centre.offset.north']).toBeCloseTo(0.01 * METRES_PER_DEGREE, 9);
    expect(env['sphinx.centre.offset.east']).toBeCloseTo(0.02 * Math.cos((30 * Math.PI) / 180) * METRES_PER_DEGREE, 9);
    // A tenth of a degree of latitude is 11.1 km, so a hundredth is 1.1 km.
    expect(env['sphinx.centre.offset.north'] as number).toBeCloseTo(1112, 0);
  });

  it('leaves a structure the survey already placed exactly where the survey put it', () => {
    const env = buildEnvironment({
      ...ORIGIN,
      'g2.center.latitude': 29.99,
      'g2.center.longitude': 30.99,
      'g2.centre.offset.west': 334.41,
      'g2.centre.offset.south': 353.86,
    });
    expect(env['g2.centre.offset.east']).toBeUndefined();
    expect(env['g2.centre.offset.north']).toBeUndefined();
    expect(env['g2.centre.offset.west']).toBe(334.41);
  });

  it('derives nothing at all without an origin and a radius to scale by', () => {
    const env = buildEnvironment({ 'sphinx.center.latitude': 30.01, 'sphinx.center.longitude': 31.02 });
    expect(env['sphinx.centre.offset.east']).toBeUndefined();
    const half = buildEnvironment({ ...ORIGIN, 'sphinx.center.latitude': 30.01 });
    expect(half['sphinx.centre.offset.east']).toBeUndefined();
  });

  it('places the Sphinx south-east of the Great Pyramid, a few hundred metres out', () => {
    const env = buildEnvironment({ ...ORIGIN, 'g1.center.latitude': 29.979167, 'g1.center.longitude': 31.134167, 'sphinx.center.latitude': 29.975278, 'sphinx.center.longitude': 31.137778 });
    expect(env['sphinx.centre.offset.east'] as number).toBeGreaterThan(300);
    expect(env['sphinx.centre.offset.north'] as number).toBeLessThan(-400);
    expect(Math.hypot(env['sphinx.centre.offset.east'] as number, env['sphinx.centre.offset.north'] as number)).toBeCloseTo(555, 0);
  });
});
