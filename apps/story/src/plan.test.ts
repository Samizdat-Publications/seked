import { loadDatabase, resolve } from '@seked/data';
import { buildEnvironment } from '@seked/geometry';
import { describe, expect, it } from 'vitest';
import { OVERVIEW, PLAN_STILL, planFootprints, projectShot } from './plan';

const env = buildEnvironment(resolve(loadDatabase(), 'canonical').values) as Record<string, number>;
const aspect = PLAN_STILL.width / PLAN_STILL.height;

describe("chapter 7's plan on the First Time", () => {
  it("takes the overview shot's own camera, and puts its target at the picture's centre", () => {
    expect(OVERVIEW.lens).toBeGreaterThan(0);
    const c = projectShot(OVERVIEW, aspect, OVERVIEW.target as [number, number, number])!;
    expect(c.x).toBeCloseTo(0.5, 9);
    expect(c.y).toBeCloseTo(0.5, 9);
    // a point behind the camera has no place on the picture
    expect(projectShot(OVERVIEW, aspect, [OVERVIEW.x + 100, OVERVIEW.y - 100, OVERVIEW.z])).toBeNull();
  });

  it('draws all three bases inside the picture, Khufu nearest and largest, Menkaure smallest', () => {
    const fps = planFootprints(env);
    expect(fps.map((f) => f.id)).toEqual(['g1', 'g2', 'g3']);
    const area = (c: { x: number; y: number }[]) =>
      Math.abs(c.reduce((s, p, i) => s + p.x * c[(i + 1) % c.length]!.y - c[(i + 1) % c.length]!.x * p.y, 0)) / 2;
    for (const f of fps) for (const p of f.corners) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(1);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(1);
    }
    const [g1, g2, g3] = fps.map((f) => area(f.corners));
    expect(g1!).toBeGreaterThan(g2!);
    expect(g2!).toBeGreaterThan(g3!);
  });
});
