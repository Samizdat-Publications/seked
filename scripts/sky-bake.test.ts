import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { apparentAltitude, expandBrightStars, loadBrightStars, properMotionAtEpoch, skyEnvironment, transitAltitude, SUN_STANDARD_ALTITUDE_DEG } from '@seked/sky';
import { STAR_COLUMNS, writeSkyBake, type SkyBake } from './sky-bake';

const dir = mkdtempSync(join(tmpdir(), 'seked-sky-bake-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const out = join(dir, 'sky-bake.json');
writeSkyBake(out);
const bake = JSON.parse(readFileSync(out, 'utf8')) as SkyBake;
const { latitudeDeg, longitudeDeg } = bake.observer;

/** The bake rounds to four decimals, which is a third of an arcsecond. */
const PLACES = 4;

describe('the sky bake', () => {
  it('observes from the Great Pyramid, and says which keys that came from', () => {
    expect(bake.preset).toBe('canonical');
    expect(bake.observer.keys).toEqual({ latitude: 'g1.center.latitude', longitude: 'g1.center.longitude' });
    expect(bake.observer.sources.latitude).toBeTruthy();
    expect(latitudeDeg).toBeCloseTo(29.98, 1);
    expect(longitudeDeg).toBeCloseTo(31.13, 1);
  });

  it('bakes the equinox sunrise the environment computes at the same epoch', () => {
    const moment = bake.moments['equinox-sunrise']!;
    const env = skyEnvironment({ epoch: moment.epoch, latitudeDeg, longitudeDeg });
    expect(moment.sun.azimuthDeg).toBeCloseTo(env['sun.equinox.rise.azimuth']!, PLACES);
    expect(moment.sun.altitudeDeg).toBeCloseTo(SUN_STANDARD_ALTITUDE_DEG, PLACES);
    expect(moment.from.azimuth).toBe('sun.equinox.rise.azimuth');
  });

  it('carries the refracted altitude beside the geometric one, so a render can draw the disc where it is seen', () => {
    const moment = bake.moments['equinox-sunrise']!;
    expect(moment.sun.apparentAltitudeDeg).toBeCloseTo(apparentAltitude(moment.sun.altitudeDeg), PLACES);
    expect(moment.sun.apparentAltitudeDeg!).toBeGreaterThan(moment.sun.altitudeDeg);
    expect(moment.sun.apparentAltitudeDeg!).toBeCloseTo(0, 1); // the disc sits on the horizon, which is what the convention means
    // A sun tens of degrees down has no disc to draw and no refraction worth stating.
    expect(bake.moments['alnitak-transit']!.sun.apparentAltitudeDeg).toBeUndefined();
  });

  it('bakes the solstice sunset C6 is about', () => {
    const moment = bake.moments['solstice-summer-sunset']!;
    const env = skyEnvironment({ epoch: moment.epoch, latitudeDeg, longitudeDeg });
    expect(moment.sun.azimuthDeg).toBeCloseTo(env['sun.solstice.summer.set.azimuth']!, PLACES);
    expect(moment.sun.azimuthDeg).toBeGreaterThan(270); // it sets north of west, which is the whole point of the claim
  });

  it('puts the sun an hour after sunrise where the hour angle puts it', () => {
    const moment = bake.moments['equinox-sunrise-plus-hour']!;
    expect(moment.sun.altitudeDeg).toBeGreaterThan(SUN_STANDARD_ALTITUDE_DEG);
    expect(moment.sun.altitudeDeg).toBeLessThan(15); // an hour of a 30-degree latitude's equinox sun
    const env = skyEnvironment({ epoch: moment.epoch, latitudeDeg, longitudeDeg });
    expect(moment.sun.azimuthDeg).toBeGreaterThan(env['sun.equinox.rise.azimuth']!); // the sun swings south as it climbs
  });

  it('mirrors the afternoon sun about the meridian from the morning one', () => {
    const morning = bake.moments['equinox-sunrise-plus-hour']!.sun;
    const afternoon = bake.moments['equinox-sunset-minus-hour']!.sun;
    expect(afternoon.altitudeDeg).toBeCloseTo(morning.altitudeDeg, 6);
    expect(afternoon.azimuthDeg).toBeCloseTo(360 - morning.azimuthDeg, 6);
  });

  it('sets the winter afternoon sun south of west and below the equinox one', () => {
    const winter = bake.moments['solstice-winter-sunset-minus-hour']!.sun;
    const equinox = bake.moments['equinox-sunset-minus-hour']!.sun;
    expect(winter.azimuthDeg).toBeGreaterThan(180);
    expect(winter.azimuthDeg).toBeLessThan(equinox.azimuthDeg - 20);
    expect(winter.altitudeDeg).toBeGreaterThan(SUN_STANDARD_ALTITUDE_DEG);
    expect(winter.altitudeDeg).toBeLessThan(equinox.altitudeDeg);
  });

  it('puts the night sun below the horizon, so the night view is a night', () => {
    const moment = bake.moments['alnitak-transit']!;
    expect(moment.epoch).toBe(bake.stars.epoch);
    expect(moment.sun.altitudeDeg).toBeLessThan(-18); // past astronomical twilight
  });

  it('bakes the whole bright catalogue with the meridian star on the meridian', () => {
    const catalogue = loadBrightStars();
    expect(bake.stars.catalogue.count).toBe(catalogue.stars.length);
    expect(bake.stars.stars).toHaveLength(catalogue.stars.length);
    expect(bake.stars.columns).toEqual([...STAR_COLUMNS]);
    expect(bake.stars.catalogue.attribution).toContain('CC BY-SA');

    // The catalogue keeps its order, so the meridian star's own row can be
    // checked against the meridian geometry `frames` gives independently.
    const index = expandBrightStars(catalogue).findIndex((s) => s.name === bake.stars.meridian.name);
    expect(index).toBeGreaterThanOrEqual(0);
    const [azDeg, altDeg] = bake.stars.stars[index]!;
    expect(azDeg).toBeCloseTo(180, 2); // south of the zenith, because its declination is south of the latitude
    expect(altDeg).toBeCloseTo(transitAltitude(bake.stars.meridian.decDeg, latitudeDeg), 2);
    expect(bake.stars.lstDeg).toBeCloseTo(bake.stars.meridian.raDeg, PLACES);
  });

  it('keeps roughly half the sky up, which is what a dome looks like', () => {
    const up = bake.stars.stars.filter((row) => row[1]! > 0).length;
    expect(up).toBeGreaterThan(bake.stars.stars.length * 0.4);
    expect(up).toBeLessThan(bake.stars.stars.length * 0.6);
  });

  it('carries the ICRS-to-horizon rotation that puts every baked star where the bake does', () => {
    const m = bake.stars.icrsToEnu;
    const bright = expandBrightStars(loadBrightStars());
    for (const i of [0, 7, 101, 2023]) {
      const star = bright[i]!;
      const { raDeg, decDeg } = properMotionAtEpoch(star, bake.stars.epoch);
      const r = (raDeg * Math.PI) / 180;
      const d = (decDeg * Math.PI) / 180;
      const v = [Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)];
      const enu = [0, 1, 2].map((row) => m[row]![0]! * v[0]! + m[row]![1]! * v[1]! + m[row]![2]! * v[2]!);
      const az = ((Math.atan2(enu[0]!, enu[1]!) * 180) / Math.PI + 360) % 360;
      const alt = (Math.asin(enu[2]!) * 180) / Math.PI;
      const [bakedAz, bakedAlt] = bake.stars.stars[i]!;
      expect(alt, `star ${i} altitude`).toBeCloseTo(bakedAlt!, 3);
      if (Math.abs(alt) < 85) expect(Math.abs(((az - bakedAz! + 540) % 360) - 180), `star ${i} azimuth`).toBeLessThan(1e-3);
    }
  });
});
