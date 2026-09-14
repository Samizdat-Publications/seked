/**
 * Bake the sky into `build/sky-bake.json` so Blender can light a scene with
 * the same numbers the claims are judged on.
 *
 * Blender has no astronomy and this project has no intention of giving it
 * any. `blender/render.py` needs four things from the sky: where the sun
 * stands for each of its views, and where the stars stand for the night one.
 * Every one of those numbers already exists in `@seked/sky`, so the only
 * honest way to get them into a render script is to compute them here and
 * hand them over as data. Nothing in the render script may compute or contain
 * a sun or a star position of its own; if this file has not been run, the
 * render script says so and falls back rather than inventing one.
 *
 * The file carries its own provenance. Each moment records the epoch it was
 * computed at and the name of the package key or function the number came out
 * of, so a reader who wants to check a figure can go straight to the function
 * that produced it. Angles are degrees, azimuth from north through east to
 * match `packages/sky/src/horizon.ts` and the project's +X east, +Y north,
 * +Z up frame.
 *
 *     pnpm sky-bake
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadDatabase, REPO_ROOT, resolve } from '@seked/data';
import {
  altAz,
  apparentAltitude,
  calendarYearOfEpoch,
  expandBrightStars,
  loadBrightStars,
  loadNamedStars,
  positionAtEpoch,
  positionsAtEpoch,
  seasonInstant,
  skyEnvironment,
  solarDeclinationAndRa,
  starById,
  transitLst,
  SUN_STANDARD_ALTITUDE_DEG,
} from '@seked/sky';

/**
 * The epoch the daylight moments are computed at: C6's and C7's, which is the
 * fourth dynasty as those claims date it. The obliquity moves the solstice
 * azimuth about a fifth of a degree per thousand years, so a century either
 * way would not change a render, but a number without an epoch is not a
 * number and the file says which one it is.
 */
const SUN_EPOCH = -2499;

/** The epoch of the night view: C2's, Bauval and Gilbert's 2450 BCE. */
const NIGHT_EPOCH = -2449;

/** The star put on the meridian for the night view, by `data/stars/named.json`'s id. */
const MERIDIAN_STAR = 'alnitak';

/** Named in the error when the sky package stops providing a key this script reads. */
const SKY = 'the @seked/sky environment';

/** One hour of hour angle. Sidereal time is an angle here, 15 degrees to the hour. */
const DEGREES_PER_HOUR = 15;

/** Where a moment's sun stands, and which package function said so. */
export interface BakedSun {
  azimuthDeg: number;
  /** Geometric altitude, no refraction: what an alignment claim is stated against. */
  altitudeDeg: number;
  /**
   * The altitude the air lifts the disc to, and so where a render that draws
   * a disc has to draw it. It is what makes a sun whose geometric centre is
   * fifty arcminutes below the horizon still visible sitting on it. Given
   * only for a sun that is up: `apparentAltitude` is Bennett's formula, which
   * is about rising and setting and says nothing worth having about a sun
   * tens of degrees down.
   */
  apparentAltitudeDeg?: number;
}

/** Both altitudes for a sun that is up, and only the geometric one for a sun that is not. */
function altitudes(altitudeDeg: number): Pick<BakedSun, 'altitudeDeg' | 'apparentAltitudeDeg'> {
  if (altitudeDeg < SUN_STANDARD_ALTITUDE_DEG) return { altitudeDeg: round(altitudeDeg) };
  return { altitudeDeg: round(altitudeDeg), apparentAltitudeDeg: round(apparentAltitude(altitudeDeg)) };
}

export interface BakedMoment {
  /** A sentence a reader of the JSON can understand without the code. */
  label: string;
  /** Julian epoch in astronomical year numbering, as the rest of the package writes it. */
  epoch: number;
  sun: BakedSun;
  /** The environment key or the call each of the two angles came out of. */
  from: { azimuth: string; altitude: string };
  note?: string;
}

export interface BakedStars {
  epoch: number;
  /** Local apparent sidereal time as an angle; see the note in `packages/sky/src/horizon.ts`. */
  lstDeg: number;
  meridian: { star: string; name: string; raDeg: number; decDeg: number; from: string };
  catalogue: { source: string; attribution: string; magnitudeLimit: number; count: number };
  columns: readonly string[];
  stars: number[][];
}

export interface SkyBake {
  generated: string;
  preset: string;
  observer: {
    latitudeDeg: number;
    longitudeDeg: number;
    keys: { latitude: string; longitude: string };
    sources: { latitude: string; longitude: string };
  };
  moments: Record<string, BakedMoment>;
  stars: BakedStars;
}

/**
 * One key of a flat record of numbers, whether it is a resolved measurement or
 * a sky environment. The type cannot promise a key is there, and a missing one
 * means the database or the sky package has been rearranged underneath this
 * script, so it says which key rather than writing a hole into the file.
 */
function required(env: Record<string, number>, name: string, what: string): number {
  const value = env[name];
  if (value === undefined) throw new Error(`${what} has no "${name}"`);
  return value;
}

/** Azimuths and altitudes to four decimals is a third of an arcsecond, well past what any of this means. */
const round = (x: number, places = 4): number => Number(x.toFixed(places));

/**
 * The columns of `stars.stars`. Azimuth and altitude are all a renderer needs
 * to place a point on a dome; magnitude sizes it and the colour index B − V
 * colours it, and both travel with the position so the render script does not
 * have to open the catalogue itself.
 */
export const STAR_COLUMNS = ['azDeg', 'altDeg', 'mag', 'ci'] as const;

export function buildSkyBake(presetId = 'canonical'): SkyBake {
  const db = loadDatabase();
  const { values, records } = resolve(db, presetId);
  const where = `preset ${presetId}`;
  const latitudeDeg = required(values, 'g1.center.latitude', where);
  const longitudeDeg = required(values, 'g1.center.longitude', where);
  const observer = { latitudeDeg, longitudeDeg };
  const day = skyEnvironment({ epoch: SUN_EPOCH, ...observer });

  // An hour after sunrise, from the hour angle. At the equinox the sun's
  // declination is zero and its right ascension is zero by definition, so its
  // hour angle is the sidereal time itself: take the sidereal time it rose at
  // and add an hour of it. Because the declination is exactly zero, this pair
  // is the same at every epoch, which is a useful thing to know when reading
  // the file.
  const risenLst = required(day, 'sun.equinox.rise.lst', SKY) + DEGREES_PER_HOUR;
  const risen = altAz({ raDeg: 0, decDeg: 0, latDeg: latitudeDeg, lstDeg: risenLst });

  const moments: Record<string, BakedMoment> = {
    'equinox-sunrise': {
      label: 'Vernal equinox, the sun\'s upper limb on the horizon, seen from the Great Pyramid',
      epoch: SUN_EPOCH,
      sun: { azimuthDeg: round(required(day, 'sun.equinox.rise.azimuth', SKY)), ...altitudes(SUN_STANDARD_ALTITUDE_DEG) },
      from: { azimuth: 'sun.equinox.rise.azimuth', altitude: 'SUN_STANDARD_ALTITUDE_DEG' },
      note: 'Refraction and the sun\'s semidiameter, on a flat sea-level horizon; the plateau\'s own skyline is not modelled.',
    },
    'equinox-sunrise-plus-hour': {
      label: 'The same equinox sun an hour later, well clear of the horizon',
      epoch: SUN_EPOCH,
      sun: { azimuthDeg: round(risen.azDeg), ...altitudes(risen.altDeg) },
      from: {
        azimuth: `altAz(ra 0, dec 0) at lst = sun.equinox.rise.lst + ${DEGREES_PER_HOUR} deg`,
        altitude: `altAz(ra 0, dec 0) at lst = sun.equinox.rise.lst + ${DEGREES_PER_HOUR} deg`,
      },
      note: 'The equinox sun has declination zero at every epoch, so this pair does not move with the date.',
    },
    'solstice-summer-sunset': {
      label: 'Summer solstice, the sun setting into the gap between the Great Pyramid and Khafre\'s, seen from the Sphinx',
      epoch: SUN_EPOCH,
      sun: { azimuthDeg: round(required(day, 'sun.solstice.summer.set.azimuth', SKY)), ...altitudes(SUN_STANDARD_ALTITUDE_DEG) },
      from: { azimuth: 'sun.solstice.summer.set.azimuth', altitude: 'SUN_STANDARD_ALTITUDE_DEG' },
      note: 'C6\'s claim. The azimuth is the whole of that claim; where the disc sits against the real skyline is not.',
    },
  };

  const stars = bakeStars(latitudeDeg);
  // The night moment's sun. Alnitak's transit is a night sight in the season
  // the December solstice falls in, so the sun of that solstice at that
  // sidereal time is the sun this view is under: Meeus's place for the
  // solstice instant of the epoch's own calendar year, not a chosen angle.
  const solsticeJde = seasonInstant(calendarYearOfEpoch(NIGHT_EPOCH), 'december-solstice');
  const solsticeSun = solarDeclinationAndRa(solsticeJde);
  const night = altAz({ ...solsticeSun, latDeg: latitudeDeg, lstDeg: stars.lstDeg });
  moments['alnitak-transit'] = {
    label: 'Night, with Alnitak on the meridian and the December solstice sun far below the horizon',
    epoch: NIGHT_EPOCH,
    sun: { azimuthDeg: round(night.azDeg), ...altitudes(night.altDeg) },
    from: {
      azimuth: 'altAz(solarDeclinationAndRa(seasonInstant(year, december-solstice))) at the meridian sidereal time',
      altitude: 'altAz(solarDeclinationAndRa(seasonInstant(year, december-solstice))) at the meridian sidereal time',
    },
    note: 'The altitude is what makes this a night view: the sun is tens of degrees down, so the sky is dark and the stars are the light.',
  };

  return {
    generated: new Date().toISOString(),
    preset: presetId,
    observer: {
      latitudeDeg,
      longitudeDeg,
      keys: { latitude: 'g1.center.latitude', longitude: 'g1.center.longitude' },
      sources: {
        latitude: records.get('g1.center.latitude')?.source ?? '?',
        longitude: records.get('g1.center.longitude')?.source ?? '?',
      },
    },
    moments,
    stars,
  };
}

/**
 * The whole bright catalogue on one dome. The stars are precessed to the
 * epoch once, sharing a single precession matrix, and then turned into
 * altitude and azimuth at the sidereal time at which the meridian star
 * transits. Stars below the horizon stay in the file: which of them a render
 * draws is the render's business, and a reader checking the meridian star
 * should be able to find every one of its neighbours here.
 */
function bakeStars(latitudeDeg: number): BakedStars {
  const meridianStar = starById(loadNamedStars(), MERIDIAN_STAR);
  const meridianAt = positionAtEpoch(meridianStar, NIGHT_EPOCH);
  const lstDeg = transitLst(meridianAt.raDeg);

  const catalogue = loadBrightStars();
  const bright = expandBrightStars(catalogue);
  const positions = positionsAtEpoch(bright, NIGHT_EPOCH);
  const stars = positions.map((at, i) => {
    const { altDeg, azDeg } = altAz({ raDeg: at.raDeg, decDeg: at.decDeg, latDeg: latitudeDeg, lstDeg });
    const star = bright[i]!;
    return [round(azDeg), round(altDeg), round(star.mag, 3), round(star.ci ?? 0, 3)];
  });

  return {
    epoch: NIGHT_EPOCH,
    lstDeg: round(lstDeg),
    meridian: {
      star: MERIDIAN_STAR,
      name: meridianStar.name,
      raDeg: round(meridianAt.raDeg),
      decDeg: round(meridianAt.decDeg),
      from: 'transitLst(positionAtEpoch(star, epoch).raDeg)',
    },
    catalogue: {
      source: catalogue.source,
      attribution: catalogue.attribution,
      magnitudeLimit: catalogue.magnitudeLimit,
      count: stars.length,
    },
    columns: STAR_COLUMNS,
    stars,
  };
}

/** The default place the render script looks for the bake. */
export const SKY_BAKE_PATH = join(REPO_ROOT, 'build', 'sky-bake.json');

/** Stands in for a star's row while the rest of the file is being indented. */
const STAR_ROW = '@star-row';

/**
 * Pretty-printed, except that a star is one line rather than six. The eight
 * thousand rows of four numbers are the bulk of the file and someone reading
 * it wants a table, so each row is swapped out for a marker, the whole thing
 * is indented, and the rows go back in as they were written.
 */
export function serializeSkyBake(bake: SkyBake): string {
  const rows = bake.stars.stars.map((row) => `[${row.join(', ')}]`);
  const marked = { ...bake, stars: { ...bake.stars, stars: rows.map(() => STAR_ROW) } };
  let i = 0;
  return `${JSON.stringify(marked, null, 2).replaceAll(`"${STAR_ROW}"`, () => rows[i++]!)}\n`;
}

export function writeSkyBake(out = SKY_BAKE_PATH, presetId = 'canonical'): SkyBake {
  const bake = buildSkyBake(presetId);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, serializeSkyBake(bake));
  return bake;
}

function main(): void {
  const bake = writeSkyBake();
  console.log(`preset ${bake.preset}, observer ${bake.observer.latitudeDeg.toFixed(6)} N ${bake.observer.longitudeDeg.toFixed(6)} E`);
  for (const [id, m] of Object.entries(bake.moments)) {
    const seen = m.sun.apparentAltitudeDeg === undefined ? 'below the horizon' : `seen at ${m.sun.apparentAltitudeDeg.toFixed(3)}`;
    console.log(`${id.padEnd(26)} epoch ${String(m.epoch).padStart(6)}  sun az ${m.sun.azimuthDeg.toFixed(3).padStart(8)}  alt ${m.sun.altitudeDeg.toFixed(3).padStart(8)}  ${seen}`);
  }
  const { stars } = bake;
  const up = stars.stars.filter((row) => row[1]! > 0).length;
  console.log(`${stars.catalogue.count} stars to magnitude ${stars.catalogue.magnitudeLimit} at epoch ${stars.epoch}, ${up} above the horizon`);
  console.log(`${stars.meridian.name} on the meridian at sidereal time ${stars.lstDeg.toFixed(3)} deg`);
  console.log(`wrote ${SKY_BAKE_PATH}`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === pathToFileURL(fileURLToPath(import.meta.url)).href) main();
