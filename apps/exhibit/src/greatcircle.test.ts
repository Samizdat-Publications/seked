import { describe, expect, it } from 'vitest';
import { bestCircle, chance, offsets, randomSite, seeded, symmetricEigen, toSite, toVec } from './greatcircle';

// sites laid exactly on a great circle tilted 30 degrees to the equator, rising through longitude 0
const tilted = (lons: number[]) => lons.map((lon) => {
  const t = 30 * (Math.PI / 180), l = lon * (Math.PI / 180);
  const v: [number, number, number] = [Math.cos(l), Math.sin(l) * Math.cos(t), Math.sin(l) * Math.sin(t)];
  return toSite(v);
});

describe('the best great circle', () => {
  it('turns a site into a vector and back', () => {
    const s = toSite(toVec({ lat: 29.979, lon: 31.134 }));
    expect(s.lat).toBeCloseTo(29.979, 9);
    expect(s.lon).toBeCloseTo(31.134, 9);
  });

  it('finds the eigenvalues of a symmetric matrix, smallest first', () => {
    const { values, vectors } = symmetricEigen([[2, 1, 0], [1, 2, 0], [0, 0, 5]]);
    expect(values[0]).toBeCloseTo(1, 12);
    expect(values[1]).toBeCloseTo(3, 12);
    expect(values[2]).toBeCloseTo(5, 12);
    expect(Math.abs(vectors[0]![0])).toBeCloseTo(Math.SQRT1_2, 12);
  });

  it('passes through sites that lie on one circle, and finds its pole', () => {
    const fit = bestCircle(tilted([-80, -20, 10, 45, 100, 150]));
    expect(fit.rms).toBeLessThan(1e-9);
    // the tilted circle's northern pole is 30 degrees from the north pole, on the meridian 90 degrees west
    const pole = toSite(fit.pole);
    expect(pole.lat).toBeCloseTo(60, 9);
    expect(Math.abs(pole.lon)).toBeCloseTo(90, 9);
  });

  it('measures each site off the circle in degrees, signed by side', () => {
    const north: [number, number, number] = [0, 0, 1];
    expect(offsets(north, [{ lat: 10, lon: 40 }, { lat: -5, lon: 0 }])).toEqual([expect.closeTo(10, 9), expect.closeTo(-5, 9)]);
  });
});

describe('the reply: random sites fitted the same way', () => {
  it('keeps random sites inside the band, spread evenly by area', () => {
    const rand = seeded(7);
    const sites = Array.from({ length: 2000 }, () => randomSite(rand, -10, 40));
    expect(Math.min(...sites.map((s) => s.lat))).toBeGreaterThanOrEqual(-10);
    expect(Math.max(...sites.map((s) => s.lat))).toBeLessThanOrEqual(40);
    // by area, the band's southern half (-10 to 15) holds a little more than half the sites
    const south = sites.filter((s) => s.lat < 15).length / sites.length;
    expect(south).toBeGreaterThan(0.5);
    expect(south).toBeLessThan(0.6);
  });

  it('is the same on every run with the same seed', () => {
    const sites = [{ lat: 30, lon: 31 }, { lat: 19.7, lon: -98.8 }, { lat: 13.4, lon: 103.9 }, { lat: -14.7, lon: -75.1 }];
    expect(chance(sites, 50, 3).rms).toEqual(chance(sites, 50, 3).rms);
  });

  it('finds no random set as close as sites laid exactly on a circle, and many as close as three scattered sites', () => {
    expect(chance(tilted([-80, -20, 10, 45, 100, 150]), 200).asClose).toBe(0);
    // any three sites lie near some great circle: the reply's point
    const three = chance([{ lat: 30, lon: 31 }, { lat: 19.7, lon: -98.8 }, { lat: 13.4, lon: 103.9 }], 400);
    expect(three.share).toBeGreaterThan(0.05);
  });
});
