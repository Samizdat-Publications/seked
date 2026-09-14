import { evaluate, scopeFor } from '@seked/claims/browser';
import { DEG } from '@seked/units';
import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../../scripts/bundle';
import { atEpoch, buildModel, type Model } from './model';
import {
  chamberWireframeSpec,
  cornerMissWords,
  groundBearingsSpec,
  groundLineSpec,
  groundOutlinesSpec,
  groundRectangleSpec,
  passageRaySpec,
  shaftRaysSpec,
  skyProjectionSpec,
  type OverlayContext,
} from './overlays';

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

describe('the B4 ground outlines', () => {
  const model = buildModel(bundle, 'canonical', null, null);
  const spec = groundOutlinesSpec(claim('B4'), contextFor(model, -2449)) as NonNullable<ReturnType<typeof groundOutlinesSpec>>;

  it('draws the two base lines the claim compares, at the sides it compares them by', () => {
    const comparisons = model.results.get('B4')?.comparisons ?? [];
    expect(spec.outlines.map((o) => o.name)).toEqual(['casing', 'socket']);
    const [casing, socket] = spec.outlines;
    expect(casing?.sideInches).toBeCloseTo(comparisons[0]?.value as number, 9);
    expect(socket?.sideInches).toBeCloseTo(comparisons[1]?.value as number, 9);
    expect(casing?.targetInches).toBeCloseTo(comparisons[0]?.targetValue as number, 9);
    expect(socket?.targetInches).toBeCloseTo(comparisons[1]?.targetValue as number, 9);
    expect(casing?.residualPct).toBeCloseTo(comparisons[0]?.residualPct as number, 9);
    // The socket line is the longer of the two, which is the whole of Smyth's
    // advantage: about 0.7 m further out on each side.
    expect((socket?.sideM as number) - (casing?.sideM as number)).toBeGreaterThan(1.4);
  });

  it('squares each outline on the structure it belongs to, a metre over its pavement', () => {
    const placed = model.pyramids.find((p) => p.id === spec.structure);
    for (const outline of spec.outlines) {
      expect(outline.corners).toHaveLength(4);
      const [ne, nw, sw] = outline.corners;
      expect(Math.hypot((ne?.[0] as number) - (nw?.[0] as number), (ne?.[1] as number) - (nw?.[1] as number))).toBeCloseTo(outline.sideM, 9);
      expect(Math.hypot((nw?.[0] as number) - (sw?.[0] as number), (nw?.[1] as number) - (sw?.[1] as number))).toBeCloseTo(outline.sideM, 9);
      for (const corner of outline.corners) expect(corner[2]).toBeCloseTo((placed?.offsetUp as number) + 1, 9);
    }
  });
});

describe("the D2 ground rectangle", () => {
  const model = buildModel(bundle, 'canonical', null, null);
  const d2 = claim('D2');
  const spec = groundRectangleSpec(d2, contextFor(model, -2449)) as NonNullable<ReturnType<typeof groundRectangleSpec>>;

  it('measures the extents the claim measures, corner to corner', () => {
    const comparisons = model.results.get('D2')?.comparisons ?? [];
    expect(spec.extentEastCubits).toBeCloseTo(comparisons[0]?.value as number, 9);
    expect(spec.extentNorthCubits).toBeCloseTo(comparisons[1]?.value as number, 9);
    expect(spec.claimedEastCubits).toBeCloseTo(comparisons[0]?.targetValue as number, 9);
    expect(spec.claimedNorthCubits).toBeCloseTo(comparisons[1]?.targetValue as number, 9);
    expect(spec.residualEastPct).toBeCloseTo(comparisons[0]?.residualPct as number, 9);
    expect(spec.residualNorthPct).toBeCloseTo(comparisons[1]?.residualPct as number, 9);
  });

  it("anchors the claimed rectangle on Khufu's corner and lets the other one fall where it falls", () => {
    expect(spec.from.label).toBe('G1 NE corner');
    expect(spec.to.label).toBe('G3 SW corner');
    expect(spec.claimedSouthWest[0]).toBeCloseTo(spec.from.at[0] - spec.claimedEastM, 9);
    expect(spec.claimedSouthWest[1]).toBeCloseTo(spec.from.at[1] - spec.claimedNorthM, 9);
    // The two signs are the two residuals: Menkaure's corner is further west
    // than 1000 root 2 cubits reach and not as far south as 1000 root 3, both
    // of them by under two metres over three quarters of a kilometre.
    expect(spec.missEastM).toBeLessThan(0);
    expect(spec.missNorthM).toBeGreaterThan(0);
    expect(Math.abs(spec.missEastM)).toBeLessThan(2);
    expect(Math.abs(spec.missNorthM)).toBeLessThan(2);
  });

  // The scene label and the panel row both read this sentence, so the sign
  // convention is pinned once here in the words a reader actually sees: the
  // miss runs from the claimed corner to the measured one, which makes the
  // measured corner the subject.
  it('says the corner miss with the measured corner as its subject, whichever way it falls', () => {
    expect(cornerMissWords(spec)).toBe(
      `${spec.to.label} is ${Math.abs(spec.missEastM).toFixed(1)} m west and ${Math.abs(spec.missNorthM).toFixed(1)} m north of the claimed corner`,
    );
    expect(cornerMissWords({ ...spec, missEastM: 2.5, missNorthM: -3.2 })).toBe(
      'G3 SW corner is 2.5 m east and 3.2 m south of the claimed corner',
    );
  });

  it('moves the cubits with the cubit slider and leaves the metres alone', () => {
    const other = buildModel(bundle, 'canonical', 0.525);
    const moved = groundRectangleSpec(d2, contextFor(other, -2449)) as NonNullable<ReturnType<typeof groundRectangleSpec>>;
    expect(moved.extentEastM).toBeCloseTo(spec.extentEastM, 9);
    expect(moved.extentNorthM).toBeCloseTo(spec.extentNorthM, 9);
    expect(moved.extentEastCubits).not.toBeCloseTo(spec.extentEastCubits, 3);
    expect(moved.extentNorthCubits).not.toBeCloseTo(spec.extentNorthCubits, 3);
    // The claimed rectangle is a count of cubits, so it is the drawn metres
    // that move with the slider and the cubits that stand still.
    expect(moved.claimedEastCubits).toBeCloseTo(spec.claimedEastCubits, 12);
    expect(moved.claimedEastM).not.toBeCloseTo(spec.claimedEastM, 3);
  });
});

describe('the D1 ground line', () => {
  const model = buildModel(bundle, 'canonical', null, null);
  const spec = groundLineSpec(claim('D1'), contextFor(model, -2449)) as NonNullable<ReturnType<typeof groundLineSpec>>;
  const comparisons = () => model.results.get('D1')?.comparisons ?? [];

  it('takes the bearings the claim compares, and runs through the corner it names', () => {
    expect(spec.cornerBearingDeg).toBeCloseTo(comparisons()[0]?.value as number, 9);
    expect(spec.targetBearingDeg).toBeCloseTo(comparisons()[0]?.targetValue as number, 9);
    expect(spec.referenceBearingDeg).toBeCloseTo(comparisons()[1]?.targetValue as number, 9);
    expect(spec.residualToTargetDeg).toBeCloseTo(comparisons()[0]?.absolute as number, 9);

    // Walking the drawn bearing from the far corner for the distance between
    // the two corners has to land on the near one: the line the claim's
    // formula states and the line the viewer draws are one line.
    const run = Math.hypot(spec.through.at[0] - spec.from.at[0], spec.through.at[1] - spec.from.at[1]);
    const a = spec.cornerBearingDeg * DEG;
    const east = spec.from.at[0] + Math.sin(a) * run;
    const north = spec.from.at[1] + Math.cos(a) * run;
    expect(Math.hypot(east - spec.through.at[0], north - spec.through.at[1])).toBeLessThan(1e-6);
  });

  it('places the obelisk where its own coordinates put it, and says which records those are', () => {
    expect(spec.to.label).toBe('Heliopolis obelisk');
    expect(spec.to.at[0]).toBeCloseTo(model.env['heliopolis.obelisk.centre.offset.east'] as number, 9);
    expect(spec.to.at[1]).toBeCloseTo(model.env['heliopolis.obelisk.centre.offset.north'] as number, 9);
    expect(spec.to.distanceM).toBeCloseTo(Math.hypot(spec.to.at[0], spec.to.at[1]), 9);
    for (const key of spec.to.recordKeys) expect(model.resolved.records.has(key), key).toBe(true);
  });

  // The claim used to take the bearing from the coordinates itself. It now
  // takes it from the offsets `buildEnvironment` derives, which are built in
  // the same flat frame, so the change is a change of spelling and not of
  // number. Nothing else would let the site plan and the claim agree.
  it('reads the same bearing the coordinates gave before the offsets were derived', () => {
    const before = evaluate(
      'atan2((heliopolis.obelisk.center.longitude - g1.center.longitude) * cos(g1.center.latitude), ' +
        'heliopolis.obelisk.center.latitude - g1.center.latitude)',
      model.env,
    );
    expect(Math.abs((comparisons()[0]?.targetValue as number) - before)).toBeLessThan(1e-6);
  });
});

describe('the A4 chamber wireframe', () => {
  const model = buildModel(bundle, 'canonical', null, null);
  const a4 = claim('A4');
  const spec = chamberWireframeSpec(a4, contextFor(model, -2449)) as NonNullable<ReturnType<typeof chamberWireframeSpec>>;

  it('labels each diagonal with the comparison the claim makes about it', () => {
    const comparisons = model.results.get('A4')?.comparisons ?? [];
    expect(spec.diagonals.map((d) => d.name)).toEqual(['end-wall', 'floor', 'space']);
    for (const diagonal of spec.diagonals) {
      const comparison = comparisons.find((c) => c.label.startsWith(diagonal.name));
      expect(comparison, diagonal.name).toBeDefined();
      expect(diagonal.cubits, diagonal.name).toBeCloseTo(comparison?.value as number, 9);
      expect(diagonal.target, diagonal.name).toBeCloseTo(comparison?.targetValue as number, 9);
      expect(diagonal.residualPct, diagonal.name).toBeCloseTo(comparison?.residualPct as number, 9);
    }
  });

  it('draws twelve edges and runs the end-wall diagonal up one wall', () => {
    expect(spec.edges).toHaveLength(24);
    const endWall = spec.diagonals.find((d) => d.name === 'end-wall');
    // The east wall is a plane of constant east in the chamber's own frame.
    // In the scene frame the pyramid's few arcminutes of orientation twist it,
    // so the two ends part by the chamber's width times the sine of that
    // angle, about six millimetres, and by no more than that.
    const placed = model.pyramids.find((p) => p.id === spec.structure);
    const width = (model.env['kc.wall.north.north'] as number) - (model.env['kc.wall.south.north'] as number);
    const twist = Math.abs(Math.sin((placed?.orientationDeg as number) * DEG)) * width;
    expect(Math.abs((endWall?.from[0] as number) - (endWall?.to[0] as number))).toBeLessThanOrEqual(twist + 1e-9);
    // It is the diagonal of a wall and not of the floor, so it rises the full
    // height of the room.
    expect((endWall?.to[2] as number) - (endWall?.from[2] as number)).toBeGreaterThan(5);
  });
});
