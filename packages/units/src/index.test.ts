import { describe, expect, it } from 'vitest';
import {
  cubitsToMetres, degreesToDms, degreesToSeked, dmsToDegrees, formatArcminutes, formatDms,
  inchesToMetres, metresToCubits, metresToPyramidInches, sekedToDegrees,
} from './index';

describe('cubits and inches', () => {
  it('round-trips cubits', () => {
    expect(metresToCubits(230.33)).toBeCloseTo(439.9, 1);
    expect(cubitsToMetres(280)).toBeCloseTo(146.61, 2);
  });
  it('converts Petrie inches', () => {
    expect(inchesToMetres(9068.8)).toBeCloseTo(230.3475, 4);
    expect(metresToPyramidInches(inchesToMetres(9131 * 1.001))).toBeCloseTo(9131, 6);
  });
});

describe('seked', () => {
  it('seked 5½ is the Great Pyramid slope', () => {
    expect(formatDms(sekedToDegrees(5.5))).toBe('51°50′34″');
  });
  it('seked 5¼ is the 3-4-5 slope of Khafre', () => {
    expect(sekedToDegrees(5.25)).toBeCloseTo(Math.atan(4 / 3) / (Math.PI / 180), 9);
  });
  it('round-trips', () => {
    expect(degreesToSeked(sekedToDegrees(5.5))).toBeCloseTo(5.5, 12);
  });
});

describe('degrees, minutes, seconds', () => {
  it('parses and formats', () => {
    expect(dmsToDegrees(51, 50, 40)).toBeCloseTo(51.84444, 5);
    expect(formatDms(51.84444)).toBe('51°50′40″');
    expect(formatDms(-0.06194)).toBe('−0°03′43″');
    expect(formatArcminutes(-0.06194)).toBe('−3.7′');
  });
  it('carries rounding across the minute boundary', () => {
    expect(degreesToDms(29.999999)).toEqual({ sign: 1, d: 30, m: 0, s: 0 });
    expect(formatDms(51.8667, 1)).toBe('51°52′00.1″');
  });
});
