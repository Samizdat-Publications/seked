/**
 * The shape of public/seked.json, written by scripts/bundle.ts and read by
 * the viewer. It is the database, not a rendering of it: the browser resolves
 * presets, builds the environment and evaluates the claims with the same
 * functions the Node tools use, so a cubit slider can re-evaluate live.
 *
 * This module is types and pure helpers only. It is imported by the bundle
 * script as well as the app, so nothing here may touch the DOM or Node.
 */
import type { Claim } from '@seked/claims/browser';
import type { Database, Measurement, Preset, Site, Source, Structure, TerrainHeader } from '@seked/data/browser';
import { expandBrightStars, type BrightCatalogue, type BrightStar, type Star } from '@seked/sky/browser';

export interface BundledTerrain {
  header: TerrainHeader;
  /** Where the float32 heights sit, relative to the site root. */
  heights: string;
}

export interface SekedBundle {
  sources: Source[];
  sites: Site[];
  structures: Structure[];
  presets: Preset[];
  measurements: Measurement[];
  /** Claims with the formula/target shorthand already normalised into comparisons. */
  claims: Claim[];
  /** The ten stars the claims name, with their roles. */
  stars: Star[];
  /**
   * HYG, for the sky dome. The whole catalogue on disk goes to magnitude 6.5
   * and is 681 kB of JSON; what ships here is the magnitude 6.0 cut, which is
   * the naked-eye limit under a dark sky and about half the rows. Its own
   * `magnitudeLimit` says which cut this is.
   */
  brightStars: BrightCatalogue;
  terrain: BundledTerrain;
}

/** The catalogue rows with their columns named. Call it once and keep the result. */
export function brightStarsOf(bundle: SekedBundle): BrightStar[] {
  return expandBrightStars(bundle.brightStars);
}

/** The bundle is a superset of a Database; this names the part `resolve` wants. */
export function databaseOf(bundle: SekedBundle): Database {
  const { sources, sites, structures, measurements, presets } = bundle;
  return { sources, sites, structures, measurements, presets };
}
