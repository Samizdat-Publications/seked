import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { evaluateClaim, loadClaims } from '@seked/claims';
import { loadDatabase } from '@seked/data';
import { describe, expect, it } from 'vitest';
import { NIGHTS } from '../../../scripts/nights';
import { groundEnvironment } from './receipts';
import { TODAY, comparisonsAt, epochAt, epochOf, inFigure, inLeo, refracted, skyAt, skyEnv, sunAt, yearLabel } from './sky';
import { buildSkyData } from './skydata';

const repo = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(repo, 'data', p), 'utf8');
const yaml = createRequire(join(repo, 'packages', 'claims', 'package.json'))('yaml') as { parse: (s: string) => never };
const claims = readdirSync(join(repo, 'data', 'claims')).filter((f) => f.endsWith('.yaml')).map((f) => yaml.parse(read(`claims/${f}`)));
const data = buildSkyData(JSON.parse(read('sites.json')), JSON.parse(read('stars/hyg-bright.json')), JSON.parse(read('stars/named.json')), claims, JSON.parse(read('stars/figures.json')), NIGHTS);
const EQUINOX_DAWN = { date: '03-20', solar: 7.25 };
const C5_PICK = { figure: 'Leo', bearings: 'C5' };
const ground = groundEnvironment(loadDatabase());

describe('the sky data', () => {
  it("carries the bright catalogue to its limit, Leo's stars among them, and C5's epoch and bearings as written", () => {
    expect(data.stars.every((s) => s[7] <= data.magnitudeLimit)).toBe(true);
    expect(data.stars.filter((s) => inLeo(s[2])).length).toBeGreaterThan(8);
    expect(data.stars.find((s) => s[1] === 'Regulus')).toBeTruthy();
    expect(data.claims.C5?.epoch).toBe(-10499);
    expect(data.claims.C5?.bearings.map((b) => b.label)).toEqual(['due east', 'equinox sunrise', 'Regulus rising']);
    expect(epochOf('C5', data)).toBe(-10499);
    expect(epochOf('today', data)).toBe(TODAY);
    expect(() => epochOf('nothing', data)).toThrow();
  });
  it("draws Leo's modern figure, every star of it in the catalogue as cut, and credits it", () => {
    const ids = new Set(data.stars.map((s) => s[0]));
    const leo = data.figures.Leo!;
    expect(leo.lines.flat()).toContain('hip49669');   // Regulus
    for (const id of leo.lines.flat()) expect(ids.has(id), id).toBe(true);
    expect(Object.keys(data.figures)).toEqual(['Leo', 'Ori']);
    expect(data.figures.Ori!.lines.flat().length).toBeGreaterThan(10);
    expect(data.attribution).toContain('Stellarium');
  });
});

describe('the sun at a moment', () => {
  it("stands where render/giza/sun.py lights the panorama (its values for equinox dawn and a built-era midsummer dawn)", () => {
    const now = sunAt(EQUINOX_DAWN, 2026, data.latitudeDeg);
    expect(now.altDeg).toBeCloseTo(16.201, 1);
    expect(now.azDeg).toBeCloseTo(99.666, 1);
    const built = sunAt({ date: '06-21', solar: 6.4 }, -2559, data.latitudeDeg);
    expect(built.altDeg).toBeCloseTo(16.663, 1);
    expect(built.azDeg).toBeCloseTo(71.484, 1);
  });
});

describe('the sky at a year', () => {
  it("evaluates C5's bearings: due east, the equinox sunrise near it, and Regulus rising about ten degrees round", () => {
    const sky = skyAt(data, -10499, EQUINOX_DAWN, C5_PICK);
    const [east, sunrise, regulus] = sky.bearings;
    expect(east?.azDeg).toBe(90);
    expect(Math.abs(sunrise!.azDeg - 90)).toBeLessThan(1.5);
    expect(regulus!.azDeg).toBeCloseTo(100 + 14 / 60, 1);   // the dossier's 100°14′04″
  });
  it('puts the Lion up in the east before the equinox sun in 10,500 BCE, and not in 2026', () => {
    const sunrise = { date: '03-20', solar: 6 };
    const regulus = (epoch: number) => skyAt(data, epoch, sunrise, C5_PICK).stars.find((s) => s.name === 'Regulus');
    const then = regulus(-10499);
    expect(then && then.altDeg).toBeGreaterThan(5);
    expect(then!.azDeg).toBeGreaterThan(90);
    expect(then!.azDeg).toBeLessThan(120);
    expect(regulus(2026)).toBeUndefined();
  });
  it('keeps only stars above the horizon', () => {
    expect(skyAt(data, 2026, EQUINOX_DAWN).stars.every((s) => s.altDeg > -1)).toBe(true);
  });
  it('picks out only what the leaf names', () => {
    const plain = skyAt(data, 2026, EQUINOX_DAWN);
    expect([plain.figure, plain.bearings.length, plain.marks.length, plain.meridian]).toEqual([null, 0, 0, null]);
    expect(plain.stars.some((s) => s.hi)).toBe(false);
    const leo = skyAt(data, 2026, EQUINOX_DAWN, C5_PICK);
    expect(leo.figure?.name).toBe('Leo');
    expect(leo.stars.filter((s) => s.hi).every((s) => inLeo(data.stars.find((r) => r[0] === s.id)![2]))).toBe(true);
  });
});

describe('the sky at a night', () => {
  const NIGHT = { night: 'c2-2450', stars: false };
  it("turns to the hour the night's star crosses the meridian, in whatever year is shown, as the sky bake turns its nights", () => {
    for (const epoch of [-2449, -10449, 2026]) {
      const sky = skyAt(data, epoch, NIGHT, { figure: 'Ori' });
      const alnitak = sky.stars.find((s) => s.name === 'Alnitak')!;
      expect(Math.abs(((alnitak.azDeg - 180 + 540) % 360) - 180), String(epoch)).toBeLessThan(0.01);
      expect(alnitak.altDeg).toBeCloseTo(refracted(skyEnv(data, epoch)['star.alnitak.transit.altitude']!), 3);
      expect(sky.meridian?.name).toBe('Alnitak');
      expect(sky.meridian?.altDeg).toBe(skyEnv(data, epoch)['star.alnitak.transit.altitude']);
      expect(sky.sun).toBeNull();
      expect(alnitak.hi).toBe(true);
    }
  });
  it('lowers the belt toward 10,450 BCE: Alnitak crosses some 35 degrees lower than in 2450 BCE', () => {
    const alt = (e: number) => skyEnv(data, e)['star.alnitak.transit.altitude']!;
    expect(alt(-2449) - alt(-10449)).toBeGreaterThan(30);
    expect(alt(-10449)).toBeLessThan(12);
  });
  it("draws C2's shafts across the meridian at their angles once the ground is in, on the side their stars culminate", () => {
    expect(skyAt(data, -2449, NIGHT, { marks: 'C2' }).marks).toEqual([]);
    const marks = skyAt(data, -2449, NIGHT, { marks: 'C2' }, ground).marks;
    const south = marks.find((m) => m.label === "King's Chamber south shaft")!;
    expect(south.azDeg).toBe(180);
    expect(south.altDeg).toBe(ground['kc.shaft.south.angle']);
    expect(marks.find((m) => m.label === "King's Chamber north shaft")?.azDeg).toBe(0);
  });
});

describe("a claim read out at the slider's year", () => {
  it("gives C4 at its own epoch exactly as the claims engine does, and moves with the year", () => {
    const c4 = loadClaims().find((c) => c.id === 'C4')!;
    const engine = evaluateClaim(c4, { ...ground, ...skyEnv(data, -10449) }).comparisons;
    const at = comparisonsAt(data, 'C4', -10449, ground);
    expect(at.map((c) => [c.value, c.target])).toEqual(engine.map((c) => [c.value, c.targetValue]));
    expect(at[0]!.value).toBeCloseTo(50 + 51 / 60 + 40 / 3600, 3);   // the script's 50°51′40″
    expect(comparisonsAt(data, 'C4', -2449, ground)[0]!.value).not.toBeCloseTo(at[0]!.value!, 0);
    // without the ground, the belt's side still reads and the pyramids' does not
    expect(comparisonsAt(data, 'C4', -10449)[0]).toMatchObject({ value: at[0]!.value, target: null });
    expect(inFigure('46Eps Ori', 'Ori')).toBe(true);
  });
});

describe('the sky winding through the years', () => {
  it('eases from one year to the other over the run and then stays', () => {
    expect(epochAt(2026, -10499, 0)).toBe(2026);
    expect(epochAt(2026, -10499, 3)).toBeCloseTo((2026 - 10499) / 2, 6);
    expect(epochAt(2026, -10499, 6)).toBe(-10499);
    expect(epochAt(2026, -10499, 60)).toBe(-10499);
  });
  it('says a year as the page does', () => {
    expect(yearLabel(-10499)).toBe('10,500 BCE');
    expect(yearLabel(2026)).toBe('2026 CE');
  });
});
