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
