import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadDatabase, resolve } from '@seked/data';
import { altAz, expandBrightStars, loadBrightStars, loadNamedStars, positionAtEpoch, starById, transitAltitude, transitLst } from '@seked/sky';
import { epochAt, writeSkyRollback, SCHEDULE, type SkyRollback } from './sky-rollback';

const dir = mkdtempSync(join(tmpdir(), 'seked-sky-rollback-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const FRAMES = 9;
const out = join(dir, 'sky-rollback.json');
writeSkyRollback(out, FRAMES, 24);
const header = JSON.parse(readFileSync(out, 'utf8')) as SkyRollback;
const bytes = readFileSync(join(dir, header.positions.file));
const positions = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
const { latitudeDeg } = header.observer;
const count = header.catalogue.count;

/** The bake rounds its header to four decimals; the binary is float32, good to about five. */
const PLACES = 3;

const azAlt = (frame: number, star: number): [number, number] => {
  const i = (frame * count + star) * 2;
  return [positions[i]!, positions[i + 1]!];
};

describe('the schedule', () => {
  it('opens on the catalogue epoch, holds on 2450 BCE and ends on 10,500 BCE', () => {
    expect(epochAt(0)).toBe(2000);
    expect(epochAt(0.05)).toBe(2000);
    expect(epochAt(0.6)).toBe(-2449);
    expect(epochAt(1)).toBe(-10499);
  });

  it('never runs forward in time and eases into each hold', () => {
    let last = epochAt(0);
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const epoch = epochAt(t);
      expect(epoch).toBeLessThanOrEqual(last + 1e-9);
      last = epoch;
    }
    // The first frame off a hold moves less than one in the middle of a segment.
    const step = (t: number) => epochAt(t) - epochAt(t + 0.005);
    expect(step(SCHEDULE[1]!.at)).toBeLessThan(step((SCHEDULE[1]!.at + SCHEDULE[2]!.at) / 2));
  });
});

describe('the rollback bake', () => {
  it('writes a binary the size the header describes, little-endian', () => {
    expect(header.frames).toHaveLength(FRAMES);
    expect(statSync(join(dir, header.positions.file)).size).toBe(FRAMES * count * 2 * 4);
    expect(header.positions.layout).toContain('little-endian');
    // The first number is frame 0's first star's azimuth, read back the way the layout says.
    expect(bytes.readFloatLE(0)).toBeCloseTo(azAlt(0, 0)[0], 5);
  });

  it('carries the whole bright catalogue, its licence and the magnitudes and colours once', () => {
    const catalogue = loadBrightStars();
    expect(count).toBe(catalogue.stars.length);
    expect(header.catalogue.mag).toHaveLength(count);
    expect(header.catalogue.ci).toHaveLength(count);
    expect(header.catalogue.attribution).toContain('CC BY-SA');
  });

  it('holds the meridian star on the meridian at every frame, at its transit altitude', () => {
    const star = starById(loadNamedStars(), header.meridian.star);
    const index = expandBrightStars(loadBrightStars()).findIndex((s) => s.name === header.meridian.name);
    expect(index).toBeGreaterThanOrEqual(0);
    for (const f of header.frames) {
      const at = positionAtEpoch(star, f.epoch);
      expect(f.lstDeg).toBeCloseTo(transitLst(at.raDeg), 2);
      expect(f.meridianAltDeg).toBeCloseTo(transitAltitude(at.decDeg, latitudeDeg), 2);
      const [azDeg, altDeg] = azAlt(f.frame, index);
      expect(azDeg).toBeCloseTo(180, 1);
      expect(altDeg).toBeCloseTo(f.meridianAltDeg, 2);
    }
  });

  it('rolls Alnitak down the meridian from the catalogue epoch to the fourth dynasty and on', () => {
    const first = header.frames[0]!;
    const last = header.frames[FRAMES - 1]!;
    expect(first.epoch).toBe(2000);
    expect(last.epoch).toBe(-10499);
    expect(first.meridianAltDeg).toBeGreaterThan(55); // Alnitak's declination is nearly zero today
    expect(last.meridianAltDeg).toBeLessThan(first.meridianAltDeg);
    // At the 2450 BCE hold it stands within a degree of the shaft it is compared to.
    const held = header.frames.find((f) => f.epoch === -2449)!;
    expect(Math.abs(held.meridianAltDeg - header.shaft.angleDeg)).toBeLessThan(1);
  });

  it('bakes every other star where the sky package puts it at that frame', () => {
    const bright = expandBrightStars(loadBrightStars());
    for (const f of [header.frames[0]!, header.frames[FRAMES - 1]!]) {
      for (const index of [0, 1234, count - 1]) {
        const at = positionAtEpoch(bright[index]!, f.epoch);
        const want = altAz({ raDeg: at.raDeg, decDeg: at.decDeg, latDeg: latitudeDeg, lstDeg: f.lstDeg });
        const [azDeg, altDeg] = azAlt(f.frame, index);
        expect(azDeg).toBeCloseTo(want.azDeg, PLACES);
        expect(altDeg).toBeCloseTo(want.altDeg, PLACES);
      }
    }
  });

  it('takes the shaft angle from the database and names its source', () => {
    const { values, records } = resolve(loadDatabase(), header.preset);
    expect(header.shaft.key).toBe('kc.shaft.south');
    expect(header.shaft.angleDeg).toBe(values['kc.shaft.south.angle']);
    expect(header.shaft.source).toBe(records.get('kc.shaft.south.angle')?.source);
  });
});
