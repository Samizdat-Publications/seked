import { describe, expect, it } from 'vitest';
import { loadNamedStars } from './catalogue';
import { equatorialToHorizon, meridianAngle, placeOnDome, placePosition, positionsAtEpoch, tangentOffset } from './dome';
import { transitAltitude } from './frames';
import { enuDirection, normalizeDeg, transitLst } from './horizon';
import { positionAtEpoch, starById } from './stars';
import { apply, sphericalToVec } from './vondrak';

/**
 * The dome is the one place where a mistake is invisible: a star put in the
 * wrong quarter of the sky still looks like a sky. These pin the placement to
 * two facts an observer can check without a catalogue, and pin the bulk and
 * matrix forms to the one-star form they are meant to be faster copies of.
 */
const GIZA = 29.979167;
const stars = loadNamedStars();
const LSTS = [0, 37.5, 90, 180, 271.25, 359.9];

describe('placing a star on the dome', () => {
  it("keeps Polaris within a degree of the pole at J2000, whatever the sidereal time", () => {
    const pole = enuDirection(GIZA, 0);
    for (const lstDeg of LSTS) {
      const { direction } = placeOnDome(starById(stars, 'polaris'), { epoch: 2000, latitudeDeg: GIZA, lstDeg });
      const dot = direction[0] * pole[0] + direction[1] * pole[1] + direction[2] * pole[2];
      const apart = (Math.acos(Math.min(1, dot)) * 180) / Math.PI;
      expect(apart, `sidereal time ${lstDeg}`).toBeLessThan(1);
    }
  });

  it("sends a star of the observer's own declination through the zenith at its transit", () => {
    // Not a catalogue star: the point is the geometry, so the declination is
    // the latitude itself and the transit is where the hour angle is zero.
    const at = { raDeg: 123.456, decDeg: GIZA };
    const placed = placePosition(at, GIZA, transitLst(at.raDeg));
    expect(placed.altDeg).toBeCloseTo(90, 9);
    expect(placed.direction[2]).toBeCloseTo(1, 12);
    expect(Math.hypot(placed.direction[0], placed.direction[1])).toBeCloseTo(0, 9);
    expect(transitAltitude(at.decDeg, GIZA)).toBeCloseTo(90, 12);
  });

  it('agrees with the matrix form, which is what the point cloud is turned by', () => {
    for (const lstDeg of LSTS) {
      const m = equatorialToHorizon(GIZA, lstDeg);
      for (const star of stars) {
        const placed = placeOnDome(star, { epoch: -2449, latitudeDeg: GIZA, lstDeg });
        const turned = apply(m, sphericalToVec(placed.raDeg, placed.decDeg));
        for (let i = 0; i < 3; i++) expect(turned[i] as number, `${star.id} axis ${i}`).toBeCloseTo(placed.direction[i] as number, 12);
      }
    }
  });

  it('moves a whole catalogue with one precession matrix, star for star', () => {
    const bulk = positionsAtEpoch(stars, -10449);
    stars.forEach((star, i) => {
      const one = positionAtEpoch(star, -10449);
      expect((bulk[i] as { raDeg: number }).raDeg).toBeCloseTo(one.raDeg, 12);
      expect((bulk[i] as { decDeg: number }).decDeg).toBeCloseTo(one.decDeg, 12);
    });
  });

  it('puts the meridian where the sidereal time says it is', () => {
    const thuban = starById(stars, 'thuban');
    const at = positionAtEpoch(thuban, -2449);
    const placed = placeOnDome(thuban, { epoch: -2449, latitudeDeg: GIZA, lstDeg: transitLst(at.raDeg) });
    expect(normalizeDeg(placed.azDeg)).toBeCloseTo(0, 6);
    expect(placed.altDeg).toBeCloseTo(transitAltitude(at.decDeg, GIZA), 9);
  });
});

describe('the tangent plane C4 lays the belt on', () => {
  it('is centred on its centre star and square in the two axes', () => {
    const centre = { raDeg: 84.05338, decDeg: -1.20192 };
    const here = tangentOffset(centre, centre);
    expect(here.x).toBeCloseTo(0, 15);
    expect(here.y).toBeCloseTo(0, 15);
    const east = tangentOffset({ raDeg: centre.raDeg + 1, decDeg: centre.decDeg }, centre);
    expect(east.x).toBeCloseTo(Math.cos((centre.decDeg * Math.PI) / 180), 12);
    expect(east.y).toBe(0);
  });

  it('folds a group that straddles the equinox rather than reading it as 359 degrees', () => {
    const centre = { raDeg: 359.5, decDeg: 10 };
    expect(tangentOffset({ raDeg: 0.5, decDeg: 10 }, centre).x).toBeCloseTo(Math.cos((10 * Math.PI) / 180), 12);
  });

  it('measures the angle from the meridian, not from the equator', () => {
    expect(meridianAngle({ x: 0, y: 0 }, { x: 0, y: 3 })).toBeCloseTo(0, 12);
    expect(meridianAngle({ x: 0, y: 0 }, { x: 3, y: 0 })).toBeCloseTo(90, 12);
    expect(meridianAngle({ x: 0, y: 0 }, { x: -2, y: -2 })).toBeCloseTo(45, 12);
  });
});
