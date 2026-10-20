import { describe, expect, it } from 'vitest';
import {
  DEG, MAX_FOV, MIN_FOV, MIN_HFOV, type Patch, type Vec3, directionToUv, fitFov, fromCamera, lodFor, nearestPatch,
  patchCoords, project, rayDirection, wantsPatch, wrapAngle,
} from './projection';

const near = (a: readonly number[], b: readonly number[], d = 9) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i] as number, d));

describe('wrapAngle', () => {
  it('folds any angle into (-pi, pi]', () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(3 * Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
    expect(wrapAngle(-3 * Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(wrapAngle(7 * Math.PI)).toBeCloseTo(-Math.PI);
  });
});

describe('rayDirection', () => {
  it('looks north along the horizon at yaw 0, pitch 0', () => {
    near(rayDirection(0, 0, { yaw: 0, pitch: 0 }, 60 * DEG, 1.6), [0, 1, 0]);
  });
  it('turns clockwise with yaw: 90 degrees is east', () => {
    near(rayDirection(0, 0, { yaw: 90 * DEG, pitch: 0 }, 60 * DEG, 1.6), [1, 0, 0]);
  });
  it('tilts up with pitch', () => {
    near(rayDirection(0, 0, { yaw: 0, pitch: 30 * DEG }, 60 * DEG, 1.6), [0, Math.cos(30 * DEG), Math.sin(30 * DEG)]);
  });
  it('puts the top edge of the screen half the field above the centre', () => {
    const w = rayDirection(0, 1, { yaw: 0, pitch: 0 }, 60 * DEG, 1.6);
    expect(Math.asin(w[2]) / DEG).toBeCloseTo(30);
  });
});

describe('directionToUv', () => {
  it('centres north and puts east a quarter to the right', () => {
    near(directionToUv([0, 1, 0]), [0.5, 0.5]);
    near(directionToUv([1, 0, 0]), [0.75, 0.5]);
    near(directionToUv([-1, 0, 0]), [0.25, 0.5]);
  });
  it('puts the zenith on the top row and the nadir on the bottom', () => {
    expect(directionToUv([0, 0, 1])[1]).toBeCloseTo(0);
    expect(directionToUv([0, 0, -1])[1]).toBeCloseTo(1);
  });
});

describe('project', () => {
  const camera: Vec3 = [20, -330, -3.81];
  const W = 1440, H = 900;

  it('is the inverse of rayDirection: a point projected and cast back lies on the ray', () => {
    const view = { yaw: 285 * DEG, pitch: 10 * DEG }, fov = 70 * DEG;
    for (const p of [[-120, -300, 5], [-60, -340, 20], [-200, -250, 40]] as Vec3[]) {
      const s = project(p, camera, view, fov, W, H);
      expect(s).not.toBeNull();
      const [x, y] = s as [number, number];
      const w = rayDirection((x / W) * 2 - 1, 1 - (y / H) * 2, view, fov, W / H);
      const d = [p[0] - camera[0], p[1] - camera[1], p[2] - camera[2]];
      const n = Math.hypot(d[0] as number, d[1] as number, d[2] as number);
      near(w, d.map((v) => v / n), 9);
    }
  });
  it('puts the point straight ahead in the middle of the screen', () => {
    const p = fromCamera(camera, [285, 10, 100]);
    near(project(p, camera, { yaw: 285 * DEG, pitch: 10 * DEG }, 70 * DEG, W, H) as number[], [W / 2, H / 2], 6);
  });
  it('drops a point behind the viewer', () => {
    expect(project(fromCamera(camera, [105, 0, 100]), camera, { yaw: 285 * DEG, pitch: 0 }, 70 * DEG, W, H)).toBeNull();
  });
});

describe('fromCamera', () => {
  it('measures azimuth clockwise from north and altitude up from the horizon', () => {
    near(fromCamera([0, 0, 0], [90, 0, 10]), [10, 0, 0]);
    near(fromCamera([1, 2, 3], [0, 90, 5]), [1, 2, 8]);
  });
});

describe('fitFov', () => {
  it('keeps a wide screen at the station field', () => {
    expect(fitFov(58 * DEG, 1440, 900)).toBeCloseTo(58 * DEG);
  });
  it('widens a phone held upright so it sees MIN_HFOV across', () => {
    const v = fitFov(58 * DEG, 390, 844);
    const h = 2 * Math.atan(Math.tan(v / 2) * (390 / 844));
    expect(h).toBeCloseTo(Math.min(MIN_HFOV, 2 * Math.atan(Math.tan(MAX_FOV / 2) * (390 / 844))));
    expect(v).toBeLessThanOrEqual(MAX_FOV);
    expect(v).toBeGreaterThanOrEqual(MIN_FOV);
  });
});

describe('lodFor', () => {
  it('is 0 when a pixel holds no more than a texel and grows a level for each halving', () => {
    const H = 900;
    const fov = (H / (4096 / (2 * Math.PI)));     // one texel per pixel
    expect(lodFor(4096, H, fov)).toBeCloseTo(0);
    expect(lodFor(4096, H, fov * 2)).toBeCloseTo(1);
    expect(lodFor(4096, H, fov / 2)).toBe(0);
  });
});

describe('patches', () => {
  const patch: Patch = { src: 'p.jpg', yaw: 272 * DEG, pitch: 30 * DEG, fov: 40 * DEG, aspect: 1.5 };

  it('puts the patch middle at its centre and its top edge at +1', () => {
    near(patchCoords(fromCamera([0, 0, 0], [272, 30, 1]), patch) as number[], [0, 0]);
    near(patchCoords(fromCamera([0, 0, 0], [272, 50, 1]), patch) as number[], [0, 1]);
  });
  it('agrees with rayDirection: the view centred on a patch is the patch centre', () => {
    near(patchCoords(rayDirection(0, 0, { yaw: patch.yaw, pitch: patch.pitch }, 60 * DEG, 1.6), patch) as number[], [0, 0]);
  });
  it('has nothing behind the patch camera', () => {
    expect(patchCoords(fromCamera([0, 0, 0], [92, -30, 1]), patch)).toBeNull();
  });
  it('picks the nearest patch to the view, across north', () => {
    const a = { ...patch, src: 'a', yaw: 350 * DEG, pitch: 0 }, b = { ...patch, src: 'b', yaw: 90 * DEG, pitch: 0 };
    expect(nearestPatch([a, b], { yaw: 5 * DEG, pitch: 0 })?.src).toBe('a');
    expect(nearestPatch([], { yaw: 0, pitch: 0 })).toBeNull();
  });
  it('fetches a patch only when zoomed past the panorama', () => {
    expect(wantsPatch(70 * DEG, 900)).toBe(false);
    expect(wantsPatch(20 * DEG, 900)).toBe(true);
  });
});
