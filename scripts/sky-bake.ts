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
import { evaluateClaim, identifiers, loadClaims, type Claim } from '@seked/claims';
import { loadDatabase, REPO_ROOT, resolve } from '@seked/data';
import { buildEnvironment, type Environment } from '@seked/geometry';
import {
  altAz,
  apparentAltitude,
  apply,
  equatorialToHorizon,
  ltpb,
  calendarYearOfEpoch,
  expandBrightStars,
  loadBrightStars,
  loadNamedStars,
  lowerCulminationAltitude,
  positionAtEpoch,
  positionsAtEpoch,
  seasonInstant,
  skyEnvironment,
  solarDeclinationAndRa,
  starById,
  tangentOffset,
  transitAltitude,
  transitIsNorth,
  transitLst,
  SEASON_EVENTS,
  SUN_STANDARD_ALTITUDE_DEG,
  type SeasonEvent,
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

/**
 * The nights the walkthrough renders (render/giza/night.py): an epoch, the star put
 * on the meridian, and what the night is for. `c2-2450` is the night `stars` has
 * always carried; `first-time` is Bauval and Hancock's 10,450 BCE, when Orion's belt
 * crossed the meridian at the lowest point of its precessional swing. Each is baked
 * the same way as `stars`, so a render of one is as honest as a render of the other.
 */
export const NIGHTS: Record<string, { epoch: number; meridian: string; label: string }> = {
  'c2-2450': { epoch: NIGHT_EPOCH, meridian: MERIDIAN_STAR, label: 'Bauval and Gilbert\'s 2450 BCE, Alnitak on the meridian' },
  'first-time': { epoch: -10449, meridian: 'alnitak', label: 'The First Time, 10,450 BCE, Alnitak on the meridian at the lowest of the belt\'s precessional swing' },
};

/**
 * How far below the horizon the equinox sun stands in the dawns C5's pictures
 * are drawn at (render/alignments.py): nautical twilight, the eastern sky light
 * enough to show where the sun will come up and dark enough that the stars
 * over it are still out. A look choice, not a claim's number: a degree either
 * way lifts every star by about a degree and moves nothing else.
 */
export const DAWN_SUN_ALTITUDE_DEG = -8;

/**
 * What a shaft pointed at in an epoch no claim assigns stars for (C2's shafts
 * under the sky of C4's 10,450 BCE): the brightest star whose culmination
 * passes within this many degrees of the shaft's line, and no fainter than
 * SHAFT_STAR_MAGNITUDE. Look choices, and loose ones: the band is about three
 * of C2's own 1 % tolerances, and the Queen's Chamber north shaft's own angle
 * is uncertain by more than twice it (qc.shaft.north.angle.min and .max).
 */
export const SHAFT_BAND_DEG = 1.5;
export const SHAFT_STAR_MAGNITUDE = 4;

/** Epochs as the claims' pictures name them: -2449 is 2450 BCE. */
const epochTag = (epoch: number): string => String(1 - epoch);

/** One sky of the alignment pictures: the whole catalogue at one sidereal time, like a night, with a sun. */
export interface AlignmentSky extends Omit<BakedStars, 'meridian'> {
  label: string;
  sun: BakedSun;
  /** The star put on the meridian, when the sky is a culmination; `lower` when it is the star's lower one. */
  meridian?: BakedStars['meridian'] & { culmination: 'upper' | 'lower' };
}

/** A claim's comparison as the claims engine evaluates it at one epoch: what a caption may quote. */
export interface BakedComparison {
  label: string;
  unit: string;
  value: number;
  target: number;
  within: boolean;
  tolerancePct: number;
  toleranceAbs?: number;
}

/** A catalogue star that crosses a shaft's line: how bright, and how far above (+) or below the line it culminates. */
export interface ShaftStar {
  index: number;
  id: string;
  name: string;
  mag: number;
  culmination: 'upper' | 'lower';
  altitudeDeg: number;
  offsetDeg: number;
}

export interface AlignmentsBake {
  /** Every sky the pictures stand under, by id; each is baked exactly as a night is. */
  skies: Record<string, AlignmentSky>;
  /** C4: the belt on its tangent plane, and the claim's own belt angle through the precessional swing. */
  c4: {
    epoch: number;
    night: string;
    comparisons: BakedComparison[];
    /** The claim's stars, paired in order with the claim's ground structures. */
    pairs: { star: string; name: string; ground: string; raDeg: number; decDeg: number; x: number; y: number }[];
    centre: string;
    curve: { from: string; epochs: number[]; beltAngleDeg: number[]; groundDiagonalDeg: number };
    /** The epochs at which the belt's angle crossed the ground's diagonal, from the curve by linear interpolation. */
    matches: number[];
    marks: { epoch: number; beltAngleDeg: number; claim: string }[];
  };
  /** C5: the two equinox dawns, and the claim's comparisons evaluated at each. */
  c5: Record<string, { epoch: number; sky: string; sunRiseAzimuthDeg: number; sunRiseLstDeg: number; comparisons: BakedComparison[] }>;
  /** C2: each shaft, the star the claim gives it at the claim's epoch, and what crossed its line at C4's epoch. */
  c2: {
    comparisons: BakedComparison[];
    shafts: {
      key: string;
      label: string;
      side: 'north' | 'south';
      angleDeg: number;
      claimed: string;
      at: Record<string, {
        epoch: number;
        sky: string;
        claimed: { name: string; transitAltitudeDeg: number; transitNorth: boolean; lowerAltitudeDeg: number };
        /** Stars crossing the line within SHAFT_BAND_DEG, brightest first; the first is the one the sky is centred on. */
        crossing: ShaftStar[];
      }>;
    }[];
  };
}

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
  /**
   * The rotation that carries an ICRS unit vector to east, north and up at this
   * epoch and sidereal time, rows first: the same precession matrix the stars
   * are moved with and the same horizon turn. A render uses it to set a sky
   * image drawn on ICRS axes, such as the Milky Way, where these stars are.
   */
  icrsToEnu: number[][];
}

/**
 * A night of `NIGHTS`: its stars, and the sun that keeps it dark. The meridian
 * star transits at one sidereal time, and which season of the epoch's year puts
 * the sun lowest at that sidereal time is a matter of precession: at 2450 BCE
 * Alnitak crosses the meridian at midnight near the December solstice, at
 * 10,450 BCE near the June one. The sun is taken at whichever of the year's four
 * season instants is lowest, from the same functions as `alnitak-transit`.
 */
export interface BakedNight extends BakedStars {
  label: string;
  season: SeasonEvent;
  sun: BakedSun;
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
  nights: Record<string, BakedNight>;
  alignments: AlignmentsBake;
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
  // The mirror of it: the equinox sun an hour before it sets, low in the west.
  const settingLst = required(day, 'sun.equinox.set.lst', SKY) - DEGREES_PER_HOUR;
  const setting = altAz({ raDeg: 0, decDeg: 0, latDeg: latitudeDeg, lstDeg: settingLst });
  // The December solstice sun an hour before it sets: declination minus the
  // obliquity of date and right ascension 270, the same event the environment's
  // sun.solstice.winter keys describe, so it sets far to the south of west.
  const winterSettingLst = required(day, 'sun.solstice.winter.set.lst', SKY) - DEGREES_PER_HOUR;
  const winterSetting = altAz({ raDeg: 270, decDeg: -required(day, 'sun.obliquity', SKY), latDeg: latitudeDeg, lstDeg: winterSettingLst });

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
    'equinox-sunset-minus-hour': {
      label: 'The equinox sun an hour before it sets, low in the west-south-west',
      epoch: SUN_EPOCH,
      sun: { azimuthDeg: round(setting.azDeg), ...altitudes(setting.altDeg) },
      from: {
        azimuth: `altAz(ra 0, dec 0) at lst = sun.equinox.set.lst - ${DEGREES_PER_HOUR} deg`,
        altitude: `altAz(ra 0, dec 0) at lst = sun.equinox.set.lst - ${DEGREES_PER_HOUR} deg`,
      },
      note: 'The afternoon twin of equinox-sunrise-plus-hour: the same altitude, its azimuth mirrored about the meridian.',
    },
    'solstice-winter-sunset-minus-hour': {
      label: 'The December solstice sun an hour before it sets, low in the south-west',
      epoch: SUN_EPOCH,
      sun: { azimuthDeg: round(winterSetting.azDeg), ...altitudes(winterSetting.altDeg) },
      from: {
        azimuth: `altAz(ra 270, dec -sun.obliquity) at lst = sun.solstice.winter.set.lst - ${DEGREES_PER_HOUR} deg`,
        altitude: `altAz(ra 270, dec -sun.obliquity) at lst = sun.solstice.winter.set.lst - ${DEGREES_PER_HOUR} deg`,
      },
      note: 'A light chosen for the as-built views: the low winter sun rakes the south faces instead of skimming them.',
    },
    'solstice-summer-sunset': {
      label: 'Summer solstice, the sun setting into the gap between the Great Pyramid and Khafre\'s, seen from the Sphinx',
      epoch: SUN_EPOCH,
      sun: { azimuthDeg: round(required(day, 'sun.solstice.summer.set.azimuth', SKY)), ...altitudes(SUN_STANDARD_ALTITUDE_DEG) },
      from: { azimuth: 'sun.solstice.summer.set.azimuth', altitude: 'SUN_STANDARD_ALTITUDE_DEG' },
      note: 'C6\'s claim. The azimuth is the whole of that claim; where the disc sits against the real skyline is not.',
    },
  };

  const stars = bakeStars(latitudeDeg, NIGHT_EPOCH, MERIDIAN_STAR);
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
    nights: Object.fromEntries(Object.entries(NIGHTS).map(([id, night]) => [id, bakeNight(latitudeDeg, night)])),
    alignments: bakeAlignments(values, latitudeDeg, longitudeDeg),
  };
}

function claimById(claims: Claim[], id: string): Claim & { epoch: number } {
  const claim = claims.find((c) => c.id === id);
  if (claim === undefined) throw new Error(`data/claims has no ${id}`);
  if (claim.epoch === undefined) throw new Error(`${id} has no epoch, and its pictures need one`);
  return claim as Claim & { epoch: number };
}

/** A claim's comparisons as the claims engine evaluates them with the claim moved to `epoch`. */
function bakeComparisons(claim: Claim, env: Environment, epoch: number): BakedComparison[] {
  return evaluateClaim({ ...claim, epoch }, env).comparisons.map((c) => ({
    label: c.label,
    unit: c.unit,
    value: c.value,
    target: c.targetValue,
    within: c.within,
    tolerancePct: c.tolerancePct,
    ...(c.toleranceAbs !== undefined ? { toleranceAbs: c.toleranceAbs } : {}),
  }));
}

/** The one identifier a claim's shaft or star term reads, e.g. `kc.shaft.south.angle`. */
function onlyIdentifier(src: string): string {
  const ids = identifiers(src);
  if (ids.length !== 1) throw new Error(`expected one identifier in "${src}", found ${ids.length}`);
  return ids[0]!;
}

/**
 * The sidereal time on the morning side at which the equinox sun, right
 * ascension and declination zero of date, stands at DAWN_SUN_ALTITUDE_DEG:
 * bisection on `altAz` over the quarter of a day before it rises, through
 * which it climbs without turning.
 */
function equinoxDawnLst(latitudeDeg: number, riseLst: number): number {
  const altitude = (lstDeg: number) => altAz({ raDeg: 0, decDeg: 0, latDeg: latitudeDeg, lstDeg }).altDeg;
  let lo = riseLst - 80;
  let hi = riseLst;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (altitude(mid) < DAWN_SUN_ALTITUDE_DEG) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The epochs C4's belt angle is drawn across, and the step: from before the claim's epoch to the present. A plotting range. */
const C4_CURVE = { from: -13000, to: 2000, step: 50 } as const;

/**
 * The skies and numbers of the claims' pictures (render/alignments.py): C4's
 * belt on the ground, C5's two equinox dawns, C2's four shafts under 2450 and
 * 10,450 BCE. Every star is baked as a night's are; every number a caption
 * quotes is the claims engine's own evaluation of the claim's own formula,
 * moved to the epoch the picture shows. What goes in the picture beyond that
 * (where the camera stands, which constellations get their lines) is the
 * render script's, and says so there.
 */
export function bakeAlignments(values: Record<string, number>, latitudeDeg: number, longitudeDeg: number): AlignmentsBake {
  const claims = loadClaims();
  const env = buildEnvironment(values);
  const named = loadNamedStars();
  const catalogue = loadBrightStars();
  const bright = expandBrightStars(catalogue);
  const idColumn = catalogue.columns.indexOf('id');
  const skies: Record<string, AlignmentSky> = {};
  const skyAt = (epoch: number) => skyEnvironment({ epoch, latitudeDeg, longitudeDeg });

  function sky(id: string, label: string, epoch: number, lstDeg: number, sun: { altDeg: number; azDeg: number },
    meridian?: AlignmentSky['meridian']): string {
    skies[id] = { ...bakeDome(latitudeDeg, epoch, lstDeg), label, sun: { azimuthDeg: round(sun.azDeg), ...altitudes(sun.altDeg) }, ...(meridian ? { meridian } : {}) };
    return id;
  }

  // C4. The claim's stars and ground structures, paired in the order the claim's overlay lists them.
  const c4 = claimById(claims, 'C4');
  const params = c4.overlay?.params ?? {};
  const beltIds = (params.stars as string[]).map((name) => name.toLowerCase());
  const ground = params.ground as string[];
  // C4's notes lay the belt on the tangent plane about Alnilam, the middle star of the three.
  const centre = beltIds[1]!;
  const beltAt = beltIds.map((id) => positionAtEpoch(starById(named, id), c4.epoch));
  const centreAt = beltAt[1]!;
  const angleIndex = c4.comparisons.findIndex((c) => c.unit === 'deg');
  const beltAngle = (epoch: number) => bakeComparisons(c4, env, epoch)[angleIndex]!;
  const epochs: number[] = [];
  for (let e = C4_CURVE.from; e <= C4_CURVE.to; e += C4_CURVE.step) epochs.push(e);
  const curve = epochs.map((e) => beltAngle(e));
  const groundDiagonalDeg = curve[0]!.target;
  const matches: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1]!.value - groundDiagonalDeg;
    const b = curve[i]!.value - groundDiagonalDeg;
    if (Math.sign(a) !== Math.sign(b)) matches.push(round(epochs[i - 1]! + (C4_CURVE.step * a) / (a - b), 1));
  }
  const c2 = claimById(claims, 'C2');

  const c4Bake: AlignmentsBake['c4'] = {
    epoch: c4.epoch,
    night: Object.keys(NIGHTS).find((id) => NIGHTS[id]!.epoch === c4.epoch) ?? '',
    comparisons: bakeComparisons(c4, env, c4.epoch),
    pairs: beltIds.map((id, i) => {
      const t = tangentOffset(beltAt[i]!, centreAt);
      return { star: id, name: starById(named, id).name, ground: ground[i]!, raDeg: round(beltAt[i]!.raDeg), decDeg: round(beltAt[i]!.decDeg), x: round(t.x, 6), y: round(t.y, 6) };
    }),
    centre,
    curve: { from: `C4 comparison "${c4.comparisons[angleIndex]!.label}"`, epochs, beltAngleDeg: curve.map((c) => round(c.value)), groundDiagonalDeg: round(groundDiagonalDeg) },
    matches,
    marks: [c4, c2].map((c) => ({ epoch: c.epoch, beltAngleDeg: round(beltAngle(c.epoch).value), claim: c.id })),
  };

  // C5. The equinox dawn of the claim's epoch, and of the fourth dynasty's for the pair.
  const c5 = claimById(claims, 'C5');
  const c5Bake: AlignmentsBake['c5'] = {};
  for (const epoch of [c5.epoch, SUN_EPOCH]) {
    const at = skyAt(epoch);
    const riseLst = required(at, 'sun.equinox.rise.lst', SKY);
    const lstDeg = equinoxDawnLst(latitudeDeg, riseLst);
    const id = `c5-dawn-${epochTag(epoch)}`;
    sky(id, `The vernal equinox of ${epochTag(epoch)} BCE, the sun ${-DAWN_SUN_ALTITUDE_DEG} degrees below the eastern horizon`,
      epoch, lstDeg, altAz({ raDeg: 0, decDeg: 0, latDeg: latitudeDeg, lstDeg }));
    c5Bake[id] = {
      epoch,
      sky: id,
      sunRiseAzimuthDeg: round(required(at, 'sun.equinox.rise.azimuth', SKY)),
      sunRiseLstDeg: round(riseLst),
      comparisons: bakeComparisons(c5, env, epoch),
    };
  }

  // C2. Each comparison is a shaft's angle against a star's transit altitude; the shaft and the star come out of it.
  const positions = new Map<number, ReturnType<typeof positionsAtEpoch>>();
  const positionsAt = (epoch: number) => {
    if (!positions.has(epoch)) positions.set(epoch, positionsAtEpoch(bright, epoch));
    return positions.get(epoch)!;
  };
  const shafts = c2.comparisons.map((comparison) => {
    const angleKey = onlyIdentifier(comparison.formula);
    const claimed = onlyIdentifier(comparison.target).split('.')[1]!;
    const key = angleKey.replace(/\.angle$/, '');
    const side: 'north' | 'south' = key.includes('.north') ? 'north' : 'south';
    const angleDeg = required(values, angleKey, 'the preset the bake resolves');
    const at: AlignmentsBake['c2']['shafts'][number]['at'] = {};
    for (const epoch of [c2.epoch, c4.epoch]) {
      const e = skyAt(epoch);
      const pos = positionsAt(epoch);
      const crossing: ShaftStar[] = [];
      pos.forEach((p, i) => {
        const star = bright[i]!;
        if (star.mag > SHAFT_STAR_MAGNITUDE) return;
        const candidates: [ShaftStar['culmination'], number][] = [];
        if (transitIsNorth(p.decDeg, latitudeDeg) === (side === 'north')) candidates.push(['upper', transitAltitude(p.decDeg, latitudeDeg)]);
        if (side === 'north') candidates.push(['lower', lowerCulminationAltitude(p.decDeg, latitudeDeg)]);
        for (const [culmination, altitudeDeg] of candidates) {
          if (altitudeDeg > 0 && Math.abs(altitudeDeg - angleDeg) <= SHAFT_BAND_DEG) {
            const id = catalogue.stars[i]![idColumn] as string;
            crossing.push({ index: i, id, name: star.name ?? id, mag: star.mag, culmination, altitudeDeg: round(altitudeDeg), offsetDeg: round(altitudeDeg - angleDeg) });
          }
        }
      });
      crossing.sort((a, b) => a.mag - b.mag);
      const claimedStar = starById(named, claimed);
      const claimedAt = positionAtEpoch(claimedStar, epoch);
      // Under the claim's own epoch the sky is the claimed star's culmination, as the claim is made; under the
      // other, the brightest star crossing the shaft's line, or the claimed star's culmination when none does.
      const target = epoch === c2.epoch || crossing.length === 0
        ? { name: claimedStar.name, id: claimed, raDeg: claimedAt.raDeg, decDeg: claimedAt.decDeg, culmination: 'upper' as const }
        : { name: crossing[0]!.name, id: crossing[0]!.id, ...pos[crossing[0]!.index]!, culmination: crossing[0]!.culmination };
      const lstDeg = (transitLst(target.raDeg) + (target.culmination === 'lower' ? 180 : 0)) % 360;
      const id = `c2-${epochTag(epoch)}-${key.replace('.shaft', '').replace(/\./g, '-')}`;
      sky(id, `${comparison.label.split(' against ')[0]}, ${epochTag(epoch)} BCE: ${target.name} at its ${target.culmination} culmination`,
        epoch, lstDeg, darkestSeason(latitudeDeg, epoch, lstDeg), {
          star: target.id, name: target.name, raDeg: round(target.raDeg), decDeg: round(target.decDeg),
          from: 'transitLst(positionAtEpoch(star, epoch).raDeg), plus 180 for a lower culmination', culmination: target.culmination,
        });
      at[epochTag(epoch)] = {
        epoch,
        sky: id,
        claimed: {
          name: claimedStar.name,
          transitAltitudeDeg: round(required(e, `star.${claimed}.transit.altitude`, SKY)),
          transitNorth: required(e, `star.${claimed}.transit.north`, SKY) === 1,
          lowerAltitudeDeg: round(required(e, `star.${claimed}.lower.altitude`, SKY)),
        },
        crossing: crossing.slice(0, 8),
      };
    }
    return { key, label: comparison.label.split(' against ')[0]!, side, angleDeg, claimed, at };
  });

  return {
    skies,
    c4: c4Bake,
    c5: c5Bake,
    c2: { comparisons: bakeComparisons(c2, env, c2.epoch), shafts },
  };
}


/** A night of `NIGHTS`: `bakeStars` for its epoch and meridian star, under the lowest of the year's season suns. */
function bakeNight(latitudeDeg: number, night: { epoch: number; meridian: string; label: string }): BakedNight {
  const stars = bakeStars(latitudeDeg, night.epoch, night.meridian);
  const lowest = darkestSeason(latitudeDeg, night.epoch, stars.lstDeg);
  return {
    ...stars,
    label: night.label,
    season: lowest.season,
    sun: { azimuthDeg: round(lowest.azDeg), ...altitudes(lowest.altDeg) },
  };
}

/**
 * Which of the epoch's four season instants puts the sun lowest at this
 * sidereal time, and where the sun stands then: the season in which a sky of
 * that sidereal time is seen at its darkest.
 */
function darkestSeason(latitudeDeg: number, epoch: number, lstDeg: number): { season: SeasonEvent; altDeg: number; azDeg: number } {
  const year = calendarYearOfEpoch(epoch);
  let lowest: { season: SeasonEvent; altDeg: number; azDeg: number } | null = null;
  for (const season of SEASON_EVENTS) {
    const sun = solarDeclinationAndRa(seasonInstant(year, season));
    const { altDeg, azDeg } = altAz({ ...sun, latDeg: latitudeDeg, lstDeg });
    if (lowest === null || altDeg < lowest.altDeg) lowest = { season, altDeg, azDeg };
  }
  return lowest!;
}

/**
 * The whole bright catalogue on one dome. The stars are precessed to the
 * epoch once, sharing a single precession matrix, and then turned into
 * altitude and azimuth at the sidereal time at which the meridian star
 * transits. Stars below the horizon stay in the file: which of them a render
 * draws is the render's business, and a reader checking the meridian star
 * should be able to find every one of its neighbours here.
 */
function bakeStars(latitudeDeg: number, epoch: number, meridian: string): BakedStars {
  const meridianStar = starById(loadNamedStars(), meridian);
  const meridianAt = positionAtEpoch(meridianStar, epoch);
  const lstDeg = transitLst(meridianAt.raDeg);
  // The meridian goes where it always has in the file, after the rotation and before the catalogue.
  const dome = bakeDome(latitudeDeg, epoch, lstDeg);
  return {
    epoch: dome.epoch,
    lstDeg: dome.lstDeg,
    icrsToEnu: dome.icrsToEnu,
    meridian: {
      star: meridian,
      name: meridianStar.name,
      raDeg: round(meridianAt.raDeg),
      decDeg: round(meridianAt.decDeg),
      from: 'transitLst(positionAtEpoch(star, epoch).raDeg)',
    },
    catalogue: dome.catalogue,
    columns: dome.columns,
    stars: dome.stars,
  };
}

/** The dome of `bakeStars` at any sidereal time, whatever stands on the meridian. */
function bakeDome(latitudeDeg: number, epoch: number, lstDeg: number): Omit<BakedStars, 'meridian'> {
  const catalogue = loadBrightStars();
  const bright = expandBrightStars(catalogue);
  const positions = positionsAtEpoch(bright, epoch);
  const stars = positions.map((at, i) => {
    const { altDeg, azDeg } = altAz({ raDeg: at.raDeg, decDeg: at.decDeg, latDeg: latitudeDeg, lstDeg });
    const star = bright[i]!;
    return [round(azDeg), round(altDeg), round(star.mag, 3), round(star.ci ?? 0, 3)];
  });

  const precession = ltpb(epoch);
  const horizon = equatorialToHorizon(latitudeDeg, lstDeg);
  const columns = ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as const).map((e) => apply(horizon, apply(precession, [e[0], e[1], e[2]])));
  const icrsToEnu = [0, 1, 2].map((row) => columns.map((column) => Number(column[row]!.toFixed(12))));

  return {
    epoch,
    lstDeg: round(lstDeg),
    icrsToEnu,
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
  // Rows are collected in the order the JSON will print them: `stars`, then each night, then each alignment sky.
  const rows: string[] = [];
  const mark = <T extends { stars: number[][] }>(s: T): T => ({ ...s, stars: s.stars.map((row) => (rows.push(`[${row.join(', ')}]`), STAR_ROW)) }) as T;
  const marked = {
    ...bake,
    stars: mark(bake.stars),
    nights: Object.fromEntries(Object.entries(bake.nights).map(([id, night]) => [id, mark(night)])),
    alignments: {
      ...bake.alignments,
      skies: Object.fromEntries(Object.entries(bake.alignments.skies).map(([id, sky]) => [id, mark(sky)])),
    },
  };
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
  for (const [id, night] of Object.entries(bake.nights)) {
    console.log(`night ${id.padEnd(12)} epoch ${String(night.epoch).padStart(6)}  ${night.meridian.name} on the meridian at ${night.lstDeg.toFixed(3)} deg, `
      + `the ${night.season} sun at ${night.sun.altitudeDeg.toFixed(1)} deg`);
  }
  const { skies, c4, c5, c2 } = bake.alignments;
  console.log(`alignments: ${Object.keys(skies).length} skies`);
  console.log(`  C4 belt at ${c4.marks.map((m) => `${epochTag(m.epoch)} BCE ${m.beltAngleDeg.toFixed(2)}`).join(', ')} deg from the meridian; `
    + `the ground's diagonal ${c4.curve.groundDiagonalDeg.toFixed(2)} deg, met at ${c4.matches.map((e) => (e < 1 ? `${Math.round(1 - e)} BCE` : `${Math.round(e)} CE`)).join(', ')}`);
  for (const [id, dawn] of Object.entries(c5)) {
    const sun = skies[dawn.sky]!.sun;
    console.log(`  ${id}: sun at ${sun.altitudeDeg.toFixed(2)} deg, azimuth ${sun.azimuthDeg.toFixed(2)}; `
      + dawn.comparisons.map((c) => `${c.label}: ${c.value.toFixed(2)}`).join('; '));
  }
  for (const s of c2.shafts) {
    for (const [tag, at] of Object.entries(s.at)) {
      const first = at.crossing[0];
      console.log(`  ${s.key} (${s.angleDeg} deg) ${tag} BCE: ${at.claimed.name} culminates at ${at.claimed.transitAltitudeDeg.toFixed(2)}; `
        + (first ? `brightest across the line ${first.name} (mag ${first.mag.toFixed(1)}, ${first.offsetDeg >= 0 ? '+' : ''}${first.offsetDeg.toFixed(2)} deg, ${first.culmination})` : 'no star across the line'));
    }
  }
  console.log(`wrote ${SKY_BAKE_PATH}`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === pathToFileURL(fileURLToPath(import.meta.url)).href) main();
