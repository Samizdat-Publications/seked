import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TODAY, epochAt, epochOf, inLeo, skyAt, sunAt, yearLabel } from './sky';
import { buildSkyData } from './skydata';

const repo = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(repo, 'data', p), 'utf8');
const yaml = createRequire(join(repo, 'packages', 'claims', 'package.json'))('yaml') as { parse: (s: string) => never };
const claims = readdirSync(join(repo, 'data', 'claims')).filter((f) => f.endsWith('.yaml')).map((f) => yaml.parse(read(`claims/${f}`)));
const data = buildSkyData(JSON.parse(read('sites.json')), JSON.parse(read('stars/hyg-bright.json')), JSON.parse(read('stars/named.json')), claims, JSON.parse(read('stars/figures.json')));
const EQUINOX_DAWN = { date: '03-20', solar: 7.25 };

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
    expect(Object.keys(data.figures)).toEqual(['Leo']);
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
    const sky = skyAt(data, -10499, EQUINOX_DAWN);
    const [east, sunrise, regulus] = sky.bearings;
    expect(east?.azDeg).toBe(90);
    expect(Math.abs(sunrise!.azDeg - 90)).toBeLessThan(1.5);
    expect(regulus!.azDeg).toBeCloseTo(100 + 14 / 60, 1);   // the dossier's 100°14′04″
  });
  it('puts the Lion up in the east before the equinox sun in 10,500 BCE, and not in 2026', () => {
    const sunrise = { date: '03-20', solar: 6 };
    const regulus = (epoch: number) => skyAt(data, epoch, sunrise).stars.find((s) => s.name === 'Regulus');
    const then = regulus(-10499);
    expect(then && then.altDeg).toBeGreaterThan(5);
    expect(then!.azDeg).toBeGreaterThan(90);
    expect(then!.azDeg).toBeLessThan(120);
    expect(regulus(2026)).toBeUndefined();
  });
  it('keeps only stars above the horizon', () => {
    expect(skyAt(data, 2026, EQUINOX_DAWN).stars.every((s) => s.altDeg > -1)).toBe(true);
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
