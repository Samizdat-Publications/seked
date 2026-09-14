import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../../scripts/bundle';
import { buildModel, type Model } from './model';
import { passageRaySpec, shaftRaysSpec, type OverlayContext } from './overlays';

/**
 * The overlays are the claims drawn, so the two have to say the same thing.
 * What is pinned here is that agreement: a ray's angle and its star's
 * altitude are the two numbers the claim's comparison holds, and if they ever
 * part company the viewer is illustrating something the dossier does not say.
 */
const bundle = buildBundle();
const claim = (id: string) => bundle.claims.find((c) => c.id === id) as NonNullable<(typeof bundle.claims)[number]>;

function contextFor(model: Model, epoch: number): OverlayContext {
  return {
    env: model.env,
    pyramids: model.pyramids,
    interiors: model.interiors,
    stars: bundle.stars,
    epoch,
    lstDeg: 0,
    latitudeDeg: model.latitudeDeg,
  };
}

describe('the C2 shaft rays', () => {
  it('draws one ray per shaft the claim names, from its own chamber', () => {
    const model = buildModel(bundle, 'canonical', null, null);
    const spec = shaftRaysSpec(claim('C2'), contextFor(model, -2449));
    expect(spec?.rays.map((r) => r.key)).toEqual(['kc.shaft.south', 'kc.shaft.north', 'qc.shaft.south', 'qc.shaft.north']);
    const kc = spec?.rays[0];
    const qc = spec?.rays[2];
    // The King's Chamber is forty metres up and the Queen's twenty, which is
    // the check that each ray starts at its own room's landmark.
    expect(kc?.from[2]).toBeGreaterThan(40);
    expect(qc?.from[2]).toBeLessThan(30);
    // A south shaft leans south, a north shaft north, and both stay in the
    // meridian plane bar the pyramid's own few arcminutes of orientation.
    expect(spec?.rays[0]?.direction[1]).toBeLessThan(0);
    expect(spec?.rays[1]?.direction[1]).toBeGreaterThan(0);
    for (const ray of spec?.rays ?? []) expect(Math.abs(ray.direction[0])).toBeLessThan(0.002);
  });

  it('moves with the epoch override, so the overlay and the panel agree', () => {
    for (const epoch of [-2449, -2999]) {
      const model = buildModel(bundle, 'canonical', null, epoch);
      const rays = shaftRaysSpec(claim('C2'), contextFor(model, epoch));
      const thuban = rays?.rays.find((r) => r.star.name === 'Thuban');
      const comparison = model.results.get('C2')?.comparisons.find((c) => c.label.includes('Thuban'));
      expect(thuban?.star.transitAltitudeDeg, `epoch ${epoch}`).toBeCloseTo(comparison?.targetValue as number, 9);
      expect(thuban?.angleDeg).toBeCloseTo(comparison?.value as number, 9);
      expect(thuban?.residualDeg).toBeCloseTo(-(comparison?.absolute as number), 9);
    }
  });
});

describe('the C3 passage ray', () => {
  const model = buildModel(bundle, 'canonical', null, null);

  it('takes its axis from the floor landmarks and looks north and up', () => {
    const spec = passageRaySpec(claim('C3'), contextFor(model, -2169));
    expect(spec?.passage).toBe('passage.descending');
    expect(spec?.direction[1]).toBeGreaterThan(0);
    expect(spec?.direction[2]).toBeGreaterThan(0);
    // The two floor landmarks give the same slope the survey recorded to
    // within half an arcminute; the claim compares the recorded one, and the
    // panel shows both rather than pretending they are the same number.
    expect(Math.abs((spec?.landmarkAngleDeg as number) - (spec?.angleDeg as number)) * 60).toBeLessThan(0.5);
  });

  it('carries the lower culmination the claim compares, not the transit', () => {
    const spec = passageRaySpec(claim('C3'), contextFor(model, -2169));
    const comparison = model.results.get('C3')?.comparisons[0];
    expect(spec?.culmination).toBe('lower');
    expect(spec?.targetAltitudeDeg).toBeCloseTo(comparison?.targetValue as number, 9);
    expect(spec?.star.lowerLstDeg).toBeCloseTo(((spec?.star.raDeg as number) + 180) % 360, 9);
  });
});
