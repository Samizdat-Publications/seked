import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { apparentAltitude, expandBrightStars, loadBrightStars, properMotionAtEpoch, skyEnvironment, transitAltitude, SUN_STANDARD_ALTITUDE_DEG } from '@seked/sky';
import { DAWN_SUN_ALTITUDE_DEG, SHAFT_BAND_DEG, SHAFT_STAR_MAGNITUDE, STAR_COLUMNS, writeSkyBake, type SkyBake } from './sky-bake';

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

describe('the nights', () => {
  it('bakes C2\'s night exactly as `stars`', () => {
    const night = bake.nights['c2-2450']!;
    expect(night.epoch).toBe(bake.stars.epoch);
    expect(night.lstDeg).toBe(bake.stars.lstDeg);
    expect(night.stars).toEqual(bake.stars.stars);
  });

  it('puts every night\'s meridian star on the meridian under a sun past astronomical twilight', () => {
    const bright = expandBrightStars(loadBrightStars());
    for (const [id, night] of Object.entries(bake.nights)) {
      const index = bright.findIndex((s) => s.name === night.meridian.name);
      const [azDeg, altDeg] = night.stars[index]!;
      expect(azDeg, id).toBeCloseTo(180, 2);
      expect(altDeg, id).toBeCloseTo(transitAltitude(night.meridian.decDeg, latitudeDeg), 2);
      expect(night.sun.altitudeDeg, id).toBeLessThan(-18);
    }
  });

  it('finds the First Time\'s belt low, and its dark season moved by precession', () => {
    const night = bake.nights['first-time']!;
    expect(night.epoch).toBe(-10449);
    // Alnitak crosses near its precessional low: roughly 50 degrees south, so about ten degrees up at Giza.
    expect(night.meridian.decDeg).toBeLessThan(-45);
    expect(transitAltitude(night.meridian.decDeg, latitudeDeg)).toBeLessThan(15);
    // Half a precessional cycle from 2450 BCE, the midnight transit falls near the other solstice.
    expect(night.season).not.toBe(bake.nights['c2-2450']!.season);
  });
});

describe('the alignment pictures', () => {
  const { skies, c4, c5, c2 } = bake.alignments;
  const bright = expandBrightStars(loadBrightStars());
  const row = (skyId: string, name: string) => skies[skyId]!.stars[bright.findIndex((s) => s.name === name)]!;

  it('bakes every alignment sky as a whole dome with its own rotation', () => {
    for (const [id, sky] of Object.entries(skies)) {
      expect(sky.stars, id).toHaveLength(bake.stars.catalogue.count);
      expect(sky.columns, id).toEqual([...STAR_COLUMNS]);
      expect(sky.icrsToEnu, id).toHaveLength(3);
    }
  });

  it('stands the equinox dawns with the sun below the eastern horizon by the chosen amount', () => {
    expect(Object.keys(c5).sort()).toEqual(['c5-dawn-10500', 'c5-dawn-2500']);
    for (const dawn of Object.values(c5)) {
      const sun = skies[dawn.sky]!.sun;
      expect(sun.altitudeDeg).toBeCloseTo(DAWN_SUN_ALTITUDE_DEG, 3);
      expect(sun.azimuthDeg).toBeGreaterThan(60); // morning, in the east
      expect(sun.azimuthDeg).toBeLessThan(120);
      const env = skyEnvironment({ epoch: dawn.epoch, latitudeDeg, longitudeDeg });
      expect(dawn.sunRiseAzimuthDeg).toBeCloseTo(env['sun.equinox.rise.azimuth']!, PLACES);
    }
  });

  it('puts Leo on the dawn horizon of 10,500 BCE, and C5\'s own numbers beside it', () => {
    const dawn = c5['c5-dawn-10500']!;
    expect(dawn.epoch).toBe(-10499);
    const [az, alt] = row(dawn.sky, 'Regulus');
    expect(alt).toBeGreaterThan(0); // Regulus is up before the sun, as the claim needs
    expect(alt).toBeLessThan(10);
    expect(az).toBeGreaterThan(90); // and south of east, which is the claim's miss
    const rising = dawn.comparisons.find((c) => c.label.startsWith("Regulus's rising azimuth"))!;
    expect(rising.value).toBeCloseTo(100.2, 1); // docs/dossier.md
    expect(rising.within).toBe(false);
  });

  it('has the equinox sun of 2500 BCE rising with Taurus, not Leo', () => {
    const dawn = c5['c5-dawn-2500']!;
    expect(dawn.epoch).toBe(-2499);
    expect(row(dawn.sky, 'Regulus')[1]).toBeLessThan(0);
    const [azAld, altAld] = row(dawn.sky, 'Aldebaran');
    expect(altAld).toBeLessThan(0); // below the horizon with the sun
    expect(azAld).toBeGreaterThan(60);
    expect(azAld).toBeLessThan(100);
  });

  it('draws C4\'s belt on the claim\'s own tangent plane, and its angle through the swing from the claim\'s formula', () => {
    expect(c4.epoch).toBe(-10449);
    expect(c4.night).toBe('first-time');
    expect(c4.pairs.map((p) => p.ground)).toEqual(['g1', 'g2', 'g3']);
    const centre = c4.pairs.find((p) => p.star === c4.centre)!;
    expect(centre.x).toBe(0);
    expect(centre.y).toBe(0);
    const at = c4.curve.epochs.indexOf(-10450);
    expect(c4.curve.beltAngleDeg[at]!).toBeCloseTo(c4.marks.find((m) => m.claim === 'C4')!.beltAngleDeg, 0);
    const claimed = c4.comparisons.find((c) => c.unit === 'deg')!;
    expect(c4.marks.find((m) => m.claim === 'C4')!.beltAngleDeg).toBeCloseTo(claimed.value, 3);
    expect(c4.curve.groundDiagonalDeg).toBeCloseTo(claimed.target, 3);
    // The belt stood at the ground's angle somewhere in the plotted range, and not at the claim's epoch.
    expect(c4.matches.length).toBeGreaterThan(0);
    for (const e of c4.matches) expect(Math.abs(e - c4.epoch)).toBeGreaterThan(500);
  });

  it('gives each of C2\'s shafts its claimed star at its culmination in 2450 BCE', () => {
    expect(c2.shafts.map((s) => `${s.key}:${s.claimed}`)).toEqual([
      'kc.shaft.south:alnitak', 'kc.shaft.north:thuban', 'qc.shaft.south:sirius', 'qc.shaft.north:kochab']);
    for (const shaft of c2.shafts) {
      const at = shaft.at['2450']!;
      const sky = skies[at.sky]!;
      expect(sky.meridian!.star).toBe(shaft.claimed);
      const [az, alt] = row(at.sky, sky.meridian!.name);
      expect(Math.abs(((az! - (shaft.side === 'north' ? 0 : 180) + 540) % 360) - 180), shaft.key).toBeLessThan(0.05);
      expect(alt, shaft.key).toBeCloseTo(at.claimed.transitAltitudeDeg, 2);
      expect(Math.abs(alt! - shaft.angleDeg), shaft.key).toBeLessThan(1); // C2's residuals are all under a degree
      expect(sky.sun.altitudeDeg, shaft.key).toBeLessThan(-18);
    }
  });

  it('finds what crossed each shaft\'s line in 10,450 BCE by the stated band, and centres its sky on it', () => {
    for (const shaft of c2.shafts) {
      const at = shaft.at['10450']!;
      for (const s of at.crossing) {
        expect(Math.abs(s.offsetDeg), `${shaft.key} ${s.name}`).toBeLessThanOrEqual(SHAFT_BAND_DEG);
        expect(s.mag).toBeLessThanOrEqual(SHAFT_STAR_MAGNITUDE);
      }
      const mags = at.crossing.map((s) => s.mag);
      expect(mags).toEqual([...mags].sort((a, b) => a - b));
      const sky = skies[at.sky]!;
      if (at.crossing.length > 0) {
        expect(sky.meridian!.name).toBe(at.crossing[0]!.name);
        const [az, alt] = sky.stars[at.crossing[0]!.index]!;
        expect(alt).toBeCloseTo(at.crossing[0]!.altitudeDeg, 2);
        expect(Math.abs(((az! - (shaft.side === 'north' ? 0 : 180) + 540) % 360) - 180)).toBeLessThan(0.05);
      }
    }
    // Precession has carried the claimed stars far off their shafts by then.
    expect(c2.shafts[0]!.at['10450']!.claimed.transitAltitudeDeg).toBeLessThan(15);
  });
});
