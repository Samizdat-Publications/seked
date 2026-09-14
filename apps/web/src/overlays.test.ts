import { evaluate, scopeFor } from '@seked/claims/browser';
import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../../scripts/bundle';
import { atEpoch, buildModel, type Model } from './model';
import { groundBearingsSpec, passageRaySpec, shaftRaysSpec, skyProjectionSpec, type OverlayContext } from './overlays';

/**
 * The overlays are the claims drawn, so the two have to say the same thing.
 * What is pinned here is that agreement: a ray's angle and its star's
 * altitude are the two numbers the claim's comparison holds, and if they ever
 * part company the viewer is illustrating something the dossier does not say.
 */
const bundle = buildBundle();
const claim = (id: string) => bundle.claims.find((c) => c.id === id) as NonNullable<(typeof bundle.claims)[number]>;

function contextFor(model: Model, epoch: number, krupp = true): OverlayContext {
  return {
    env: model.env,
    pyramids: model.pyramids,
    interiors: model.interiors,
    stars: bundle.stars,
    epoch,
    lstDeg: 0,
    latitudeDeg: model.latitudeDeg,
    krupp,
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

// The window where the belt straddles right ascension 0 is avoided below on
// purpose. The claim file subtracts right ascensions without folding the
// difference, so between about 5063 and 4821 BCE its formula reads the belt's
// 3 degree spread as 357 degrees, while the overlay, which folds, does not.
// Outside those 243 years the two agree to the last digit.
const EPOCHS = [-10449, -12000, -6000, -2449, 0, 2000];

describe('the C4 sky projection', () => {
  const model = buildModel(bundle, 'canonical', null, null);
  const c4 = claim('C4');
  const project = (epoch: number, krupp = true) =>
    skyProjectionSpec(c4, contextFor(model, epoch, krupp)) as NonNullable<ReturnType<typeof skyProjectionSpec>>;

  it("lays the belt at the angle the claim's own formula gives, at every epoch", () => {
    const formula = c4.comparisons[0]?.formula as string;
    for (const epoch of EPOCHS) {
      const scope = scopeFor(atEpoch(c4, epoch), model.env);
      expect(project(epoch).beltAngleDeg, `epoch ${epoch}`).toBeCloseTo(evaluate(formula, scope), 2);
    }
  });

  it('scales the first two stars onto the first two pyramid centres', () => {
    const spec = project(-10449);
    const [alnitak, alnilam] = spec.belt;
    const [g1, g2] = spec.ground;
    const sky = Math.hypot(
      (alnilam?.at[0] as number) - (alnitak?.at[0] as number),
      (alnilam?.at[1] as number) - (alnitak?.at[1] as number),
    );
    const ground = Math.hypot((g2?.at[0] as number) - (g1?.at[0] as number), (g2?.at[1] as number) - (g1?.at[1] as number));
    expect(sky).toBeCloseTo(ground, 6);
    // Anchored on the first pyramid, so the two lines start together.
    expect(alnitak?.at[0]).toBeCloseTo(g1?.at[0] as number, 9);
    expect(alnitak?.at[1]).toBeCloseTo(g1?.at[1] as number, 9);
  });

  it('swaps north for south and nothing else when the inversion is turned off', () => {
    const on = project(-10449, true);
    const off = project(-10449, false);
    expect(off.beltAngleDeg).toBeCloseTo(on.beltAngleDeg, 12);
    const anchor = (on.ground[0] as (typeof on.ground)[number]).at[1];
    on.belt.forEach((star, i) => {
      const other = off.belt[i] as (typeof off.belt)[number];
      expect(other.at[0]).toBeCloseTo(star.at[0], 9);
      expect(other.at[1] - anchor).toBeCloseTo(-(star.at[1] - anchor), 9);
    });
  });
});

describe('the C5 sun ribbon', () => {
  const model = buildModel(bundle, 'canonical', null, null);
  const c5 = claim('C5');
  const spec = groundBearingsSpec(c5, contextFor(model, -10499)) as NonNullable<ReturnType<typeof groundBearingsSpec>>;

  it('draws its lines from the Sphinx, at the azimuths the claim computes', () => {
    expect(spec.type).toBe('sun-ribbon');
    expect(spec.from[0]).toBeCloseTo(model.env['sphinx.centre.offset.east'] as number, 9);
    expect(spec.from[1]).toBeCloseTo(model.env['sphinx.centre.offset.north'] as number, 9);
    expect(spec.bearings.map((b) => b.label)).toEqual(['due east', 'equinox sunrise', 'Regulus rising']);
    const scope = scopeFor(atEpoch(c5, -10499), model.env);
    for (const bearing of spec.bearings) {
      expect(bearing.azimuthDeg, bearing.label).toBeCloseTo(evaluate(bearing.source, scope), 12);
    }
  });

  it("puts Regulus's line at the value the claim's first comparison holds", () => {
    const comparison = model.results.get('C5')?.comparisons[0];
    const regulus = spec.bearings.find((b) => b.label === 'Regulus rising');
    expect(regulus?.azimuthDeg).toBeCloseTo(comparison?.value as number, 12);
    // South of due east, which is the residual drawn.
    expect(regulus?.azimuthDeg as number).toBeGreaterThan(90);
  });

  it('follows the epoch the scene is drawn at, not the one the claim names', () => {
    const later = groundBearingsSpec(c5, contextFor(model, -2499)) as NonNullable<ReturnType<typeof groundBearingsSpec>>;
    const then = spec.bearings.find((b) => b.label === 'Regulus rising')?.azimuthDeg as number;
    const now = later.bearings.find((b) => b.label === 'Regulus rising')?.azimuthDeg as number;
    expect(Math.abs(now - then)).toBeGreaterThan(30);
    // Due east is a constant and must not move with it.
    expect(later.bearings[0]?.azimuthDeg).toBe(90);
  });
});

describe('the generic ground-bearings type', () => {
  const model = buildModel(bundle, 'canonical', null, null);
  const c5 = claim('C5');
  const build = (c: typeof c5, epoch = -10499) =>
    groundBearingsSpec(c, contextFor(model, epoch)) as NonNullable<ReturnType<typeof groundBearingsSpec>>;

  it('draws what C5 draws for a claim that names the type rather than the picture', () => {
    const ribbon = build(c5);
    const generic = build({
      ...c5,
      overlay: { type: 'ground-bearings', params: { ...c5.overlay?.params, height_m: 24 } },
    });
    expect(generic.type).toBe('ground-bearings');
    expect(generic.from).toEqual(ribbon.from);
    expect(generic.bearings.map((b) => b.azimuthDeg)).toEqual(ribbon.bearings.map((b) => b.azimuthDeg));
    expect(generic.sights.map((s) => s.azimuthDeg)).toEqual(ribbon.sights.map((s) => s.azimuthDeg));
    // The height is the one new param, and the claims that do not name it
    // keep the eight metres C5 and C6 are drawn at.
    expect(generic.height).toBe(24);
    expect(ribbon.height).toBe(8);
  });
});
