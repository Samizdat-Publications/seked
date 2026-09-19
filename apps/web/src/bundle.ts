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
import type { Database, FootprintFile, Material, Measurement, Preset, Site, Source, Structure, TerrainHeader } from '@seked/data/browser';
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
  /** What each building is made of, part by part, from `data/materials.json`. */
  materials: Material[];
  /** Claims with the formula/target shorthand already normalised into comparisons. */
  claims: Claim[];
  /** The stars the claims name, with their roles: the original ten, and the four Cygnus stars C7 adds. */
  stars: Star[];
  /**
   * HYG, for the sky dome. The whole catalogue on disk goes to magnitude 6.5
   * and is 681 kB of JSON; what ships here is the magnitude 6.0 cut, which is
   * the naked-eye limit under a dark sky and about half the rows. Its own
   * `magnitudeLimit` says which cut this is.
   */
  brightStars: BrightCatalogue;
  terrain: BundledTerrain;
  /**
   * The same Copernicus product resampled over plus or minus twelve
   * kilometres at sixty metres, which is the ground the modern city, the
   * valley and the horizon stand on. The fine grid stops three kilometres
   * out and the city runs to ten, so without this there is nothing under the
   * far half of it. `terrainRing` draws it with the fine grid's own square
   * left out.
   */
  farTerrain: BundledTerrain;
  /**
   * The plateau's lesser monuments, from OpenStreetMap, registered onto the
   * survey and set on the ground by scripts/footprints.ts. The viewer builds
   * them with the same `footprintMesh` Blender's mirror runs.
   */
  footprints: FootprintFile;
}

/** The catalogue rows with their columns named. Call it once and keep the result. */
export function brightStarsOf(bundle: SekedBundle): BrightStar[] {
  return expandBrightStars(bundle.brightStars);
}

/** The bundle is a superset of a Database; this names the part `resolve` wants. */
export function databaseOf(bundle: SekedBundle): Database {
  const { sources, sites, structures, measurements, presets, materials } = bundle;
  return { sources, sites, structures, measurements, presets, materials };
}
