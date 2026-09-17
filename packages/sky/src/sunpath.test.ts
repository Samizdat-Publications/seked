/**
 * The sun of a day and an hour, against the bake the Blender renders are lit
 * by.
 *
 * `build/sky-bake.json` is the oracle. It places its daylight moments the way
 * a claim does, from a declination and a sidereal time with no date in sight;
 * `sunAt` places the same sun from a calendar day and a clock. The two roads
 * have almost nothing in common downstream of `altAz`, so agreeing to a
 * fraction of a degree is worth something. They cannot agree exactly: the
 * bake's equinox sun has declination exactly zero by definition, where the
 * real sun on the equinox day has whatever declination it has at that hour,
 * and an hour of sidereal time is not an hour of the clock.
 *
 * The test is skipped where the bake has not been written, so a checkout that
 * has only run `pnpm install` still passes.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '@seked/data';
import { calendarYearOfEpoch, deltaT, julianDay } from './calendar';
import { equationOfTime, seasonInstant, solarDeclinationAndRa, type SeasonEvent } from './solar';
import { hourAngleAtAltitude, SUN_STANDARD_ALTITUDE_DEG } from './sun';
import { sunAt } from './sunpath';

interface Bake {
  observer: { latitudeDeg: number; longitudeDeg: number };
  moments: Record<string, { epoch: number; sun: { azimuthDeg: number; altitudeDeg: number } }>;
}

const BAKE_PATH = join(REPO_ROOT, 'build', 'sky-bake.json');
const bake: Bake | undefined = existsSync(BAKE_PATH) ? (JSON.parse(readFileSync(BAKE_PATH, 'utf-8')) as Bake) : undefined;

/** How far apart the two roads to the same sun are allowed to land. */
const TOLERANCE_DEG = 0.3;

/**
 * The day of the year a seasonal event falls on where the observer stands,
 * and the local mean time of that day's sunrise and sunset. This is the
 * arithmetic `datedSunEnvironment` does, done here so the test says out loud
 * which day and which hour it is asking `sunAt` about.
 */
function eventDay(epoch: number, event: SeasonEvent, latitudeDeg: number, longitudeDeg: number): { day: number; rise: number; set: number } {
  const year = calendarYearOfEpoch(epoch);
  const drift = deltaT(year) / 86400;
  const meridian = longitudeDeg / 360;
  const jde = seasonInstant(year, event);
  // Local midnight of the day the event falls on where the observer is, as a
  // Julian Day in TT, and local mean noon half a day after it.
  const midnight = Math.floor(jde - drift + meridian + 0.5) - 0.5 - meridian + drift;
  const noon = midnight + 0.5;
  const minutes = equationOfTime(noon);
  const hourAngleDeg = hourAngleAtAltitude(solarDeclinationAndRa(noon).decDeg, latitudeDeg, SUN_STANDARD_ALTITUDE_DEG);
  return {
    day: Math.round(midnight - drift + meridian - julianDay(year, 1, 1)) + 1,
    rise: 12 - hourAngleDeg / 15 - minutes / 60,
    set: 12 + hourAngleDeg / 15 - minutes / 60,
  };
}

describe('sunAt', () => {
  it.skipIf(bake === undefined)('agrees with the sky bake an hour after the equinox sunrise', () => {
    const { latitudeDeg, longitudeDeg } = bake!.observer;
    const target = bake!.moments['equinox-sunrise-plus-hour']!;
    const { day, rise } = eventDay(target.epoch, 'march-equinox', latitudeDeg, longitudeDeg);
    const sun = sunAt({ epoch: target.epoch, day, hour: rise + 1, latitudeDeg, longitudeDeg });
    expect(sun.azimuthDeg).toBeCloseTo(target.sun.azimuthDeg, 0);
    expect(Math.abs(sun.azimuthDeg - target.sun.azimuthDeg)).toBeLessThan(TOLERANCE_DEG);
    expect(Math.abs(sun.altitudeDeg - target.sun.altitudeDeg)).toBeLessThan(TOLERANCE_DEG);
  });

  it.skipIf(bake === undefined)('agrees with the sky bake an hour before the December solstice sunset', () => {
    const { latitudeDeg, longitudeDeg } = bake!.observer;
    const target = bake!.moments['solstice-winter-sunset-minus-hour']!;
    const { day, set } = eventDay(target.epoch, 'december-solstice', latitudeDeg, longitudeDeg);
    const sun = sunAt({ epoch: target.epoch, day, hour: set - 1, latitudeDeg, longitudeDeg });
    expect(Math.abs(sun.azimuthDeg - target.sun.azimuthDeg)).toBeLessThan(TOLERANCE_DEG);
    expect(Math.abs(sun.altitudeDeg - target.sun.altitudeDeg)).toBeLessThan(TOLERANCE_DEG);
  });

  it('puts the sun below the horizon at every midnight of the year', () => {
    for (let day = 1; day <= 365; day++) {
      const sun = sunAt({ epoch: -2449, day, hour: 0, latitudeDeg: 29.979167, longitudeDeg: 31.134167 });
      expect(sun.altitudeDeg, `day ${day}`).toBeLessThan(0);
      expect(sun.apparentAltitudeDeg, `day ${day}`).toBeUndefined();
    }
  });

  it('gives an azimuth on the circle and a finite altitude at every hour', () => {
    for (let hour = 0; hour < 24; hour += 0.25) {
      const sun = sunAt({ epoch: -10499, day: 172, hour, latitudeDeg: 29.979167, longitudeDeg: 31.134167 });
      expect(sun.azimuthDeg).toBeGreaterThanOrEqual(0);
      expect(sun.azimuthDeg).toBeLessThan(360);
      expect(Number.isFinite(sun.altitudeDeg)).toBe(true);
      expect(sun.altitudeDeg).toBeGreaterThanOrEqual(-90);
      expect(sun.altitudeDeg).toBeLessThanOrEqual(90);
    }
  });

  it('carries the sun round the sky once a day, highest near noon', () => {
    const at = (hour: number): number => sunAt({ epoch: -2449, day: 172, hour, latitudeDeg: 29.979167, longitudeDeg: 31.134167 }).altitudeDeg;
    let best = 0;
    for (let hour = 0; hour < 24; hour += 0.1) if (at(hour) > at(best)) best = hour;
    // Local mean noon, less the equation of time, which never reaches a third
    // of an hour. A wider window than that would not be testing anything.
    expect(Math.abs(best - 12)).toBeLessThan(0.5);
  });
});
