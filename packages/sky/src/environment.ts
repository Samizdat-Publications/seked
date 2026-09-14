/**
 * The star half of the expression environment. A claim names a star the way
 * it names a stone: `star.thuban.lower.altitude` is an identifier the claim
 * parser already understands, so a sky claim stays data and no astronomy
 * leaks into the claims package.
 *
 * Everything here is geometry that `frames` and `stars` already do. This
 * module only flattens it into keys.
 */
import { lowerCulminationAltitude, transitAltitude, transitIsNorth } from './frames';
import { positionAtEpoch, type Star } from './stars';

export interface SkyEnvironmentOptions {
  /**
   * Julian epoch in astronomical year numbering, matching the rest of the
   * package: 2450 BCE is -2449 and 10,450 BCE is -10449.
   */
  epoch: number;
  /** The observer's latitude in degrees, north positive. */
  latitudeDeg: number;
  /** Defaults to whatever `setDefaultStars` or `setDefaultStarsLoader` registered. */
  stars?: Star[];
}

/** The claim expression parser's identifier grammar, kept in step by a test. */
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$/;

/**
 * The default catalogue, resolved once: the dossier builds an environment per
 * claim per preset. Node registers the loader that reads
 * data/stars/named.json (see `./catalogue`); the browser hands over the stars
 * from its bundle. Neither is baked in here, so this module stays pure.
 */
let cachedStars: Star[] | undefined;
let starsLoader: (() => Star[]) | undefined;

/** Use this catalogue whenever `skyEnvironment` is called without one. */
export function setDefaultStars(stars: Star[]): void {
  cachedStars = stars;
  starsLoader = undefined;
}

/** As `setDefaultStars`, but the catalogue is only read when it is first needed. */
export function setDefaultStarsLoader(load: () => Star[]): void {
  starsLoader = load;
  cachedStars = undefined;
}

export function defaultStars(): Star[] {
  if (cachedStars) return cachedStars;
  if (!starsLoader) {
    throw new Error('no default star catalogue: pass `stars`, or register one with setDefaultStars (@seked/sky registers the one in data/stars/named.json)');
  }
  cachedStars = starsLoader();
  return cachedStars;
}

/**
 * One epoch, one observer, flattened: for every named star its mean place of
 * date (`.ra`, `.dec`) and its two meridian altitudes (`.transit.altitude`,
 * `.lower.altitude`), plus which side of the zenith the upper culmination
 * falls on (`.transit.north`, 1 or 0, because the expression language has
 * numbers and nothing else) and the epoch itself as `sky.epoch`.
 */
export function skyEnvironment(opts: SkyEnvironmentOptions): Record<string, number> {
  const stars = opts.stars ?? defaultStars();
  const env: Record<string, number> = { 'sky.epoch': opts.epoch };
  for (const star of stars) {
    const prefix = `star.${star.id}`;
    if (!IDENTIFIER.test(prefix)) throw new Error(`star id "${star.id}" cannot be used as a formula identifier`);
    const { raDeg, decDeg } = positionAtEpoch(star, opts.epoch);
    env[`${prefix}.ra`] = raDeg;
    env[`${prefix}.dec`] = decDeg;
    env[`${prefix}.transit.altitude`] = transitAltitude(decDeg, opts.latitudeDeg);
    env[`${prefix}.transit.north`] = transitIsNorth(decDeg, opts.latitudeDeg) ? 1 : 0;
    env[`${prefix}.lower.altitude`] = lowerCulminationAltitude(decDeg, opts.latitudeDeg);
  }
  return env;
}
