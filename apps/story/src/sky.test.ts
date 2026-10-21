import { loadClaims } from '@seked/claims';
import { loadDatabase, resolve } from '@seked/data';
import { buildEnvironment } from '@seked/geometry';
import { describe, expect, it } from 'vitest';
import { beltAt, beltOnLens, lowestTransit, NIGHT_LENS, project, yearLabel } from './sky';

const env = buildEnvironment(resolve(loadDatabase(), 'canonical').values);
const c4 = loadClaims().find((c) => c.id === 'C4')!;

describe('the sky slider', () => {
  it("reads the dossier's C4 at C4's own epoch", () => {
    const r = beltAt(c4, env, c4.epoch!);
    // docs/dossier.md: 50°51′40″ against 37°51′07″
    expect(r.angleDeg).toBeCloseTo(50 + 51 / 60 + 40 / 3600, 3);
    expect(r.diagonalDeg).toBeCloseTo(37 + 51 / 60 + 7 / 3600, 3);
    // and its receipt reads as the dossier's: neither comparison inside ±5 %
    expect(r.comparisons.map((c) => c.within)).toEqual([false, false]);
    expect(r.comparisons[0]!.residualPct).toBeCloseTo(34.368, 2);
    expect(r.comparisons[1]!.residualPct).toBeCloseTo(24.97, 1);
  });

  it('puts Alnitak on the meridian, due south, and the belt beside it', () => {
    const r = beltAt(c4, env, c4.epoch!);
    const alnitak = r.stars.find((s) => s.id === 'alnitak')!;
    expect(alnitak.azDeg).toBeCloseTo(180, 6);
    expect(alnitak.altDeg).toBeCloseTo(r.transitDeg, 6);
    for (const s of r.stars) expect(Math.abs(s.azDeg - 180)).toBeLessThan(5);
  });

  it('sinks the belt going back: lower at 10,450 BCE than today', () => {
    expect(beltAt(c4, env, c4.epoch!).transitDeg).toBeLessThan(beltAt(c4, env, 2026).transitDeg - 30);
  });

  it("finds the bottom of the swing within a few centuries of C4's epoch", () => {
    // the claim picks its epoch for the angle's match, not the lowest transit; how far apart they are is a reading
    expect(Math.abs(lowestTransit(env, -13000, 0, 50) - c4.epoch!)).toBeLessThan(600);
  });

  it('names years as the page says them', () => {
    expect(yearLabel(-10449)).toBe('10,450 BCE');
    expect(yearLabel(2026)).toBe('2026 CE');
  });

  it('projects through a lens as the renderer aims one', () => {
    const lens = { yaw: 180, pitch: 12, fov: 40, aspect: 1 };
    const centre = project(lens, 12, 180)!;
    expect(centre.x).toBeCloseTo(0.5, 9);
    expect(centre.y).toBeCloseTo(0.5, 9);
    expect(project(lens, 32, 180)!.y).toBeCloseTo(0, 9); // the top edge, half the vertical field up
    expect(project(lens, 12, 170)!.x).toBeLessThan(0.5); // looking south, east is on the left
    expect(project(lens, 12, 0)).toBeNull(); // due north, behind the camera
  });
});

describe('the slider over the night render', () => {
  it("takes the night render's lens from its queue", () => {
    expect(NIGHT_LENS).toEqual({ yaw: 180, pitch: 12, fov: 40, aspect: 1 });
  });

  it("holds the belt in the picture, above the horizon, at C4's epoch, and above the picture today", () => {
    const then = beltOnLens(beltAt(c4, env, c4.epoch!));
    for (const s of then.stars) {
      expect(s.at!.x).toBeGreaterThan(0.3);
      expect(s.at!.x).toBeLessThan(0.7);
      expect(s.at!.y).toBeGreaterThan(0);
      expect(s.at!.y).toBeLessThan(then.horizonY);
    }
    for (const s of beltOnLens(beltAt(c4, env, 2026)).stars) expect(s.at?.y ?? -1).toBeLessThan(0);
  });
});
