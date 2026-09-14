/**
 * Star records and the geometry that moves them through time. Nothing here
 * reads a file: the catalogues on disk are `./catalogue`, which the Node entry
 * exports and the browser entry leaves out.
 *
 * Two shapes of record live here. A `Star` is one of the ten the claims name,
 * carrying the role it plays in a claim. A `BrightCatalogue` is the whole of
 * HYG to magnitude 6.5, stored column-wise because eight thousand objects with
 * spelled-out keys would be twice the bytes for nothing.
 */
import { z } from 'zod';
import { precessIcrsToDate } from './vondrak';

export const StarSchema = z.object({
  id: z.string(),
  name: z.string(),
  bayer: z.string(),
  /** ICRS, J2000, degrees. */
  raDeg: z.number(),
  decDeg: z.number(),
  /** Proper motion in RA × cos(dec), milliarcseconds per year. */
  pmRaMasYr: z.number(),
  pmDecMasYr: z.number(),
  source: z.string(),
  role: z.string().optional(),
});
export type Star = z.infer<typeof StarSchema>;

export function starById(stars: Star[], id: string): Star {
  const s = stars.find((x) => x.id === id);
  if (!s) throw new Error(`unknown star "${id}"`);
  return s;
}

/** A direction on the celestial sphere, in degrees. Which equator and equinox it is on is the caller's business. */
export interface Equatorial {
  raDeg: number;
  decDeg: number;
}

/** Everything `positionAtEpoch` needs, so a catalogue star can be precessed without being a claim star. */
export type StarMotion = Pick<Star, 'raDeg' | 'decDeg' | 'pmRaMasYr' | 'pmDecMasYr'>;

/**
 * Apparent mean place at a Julian epoch: proper motion applied linearly from
 * J2000 (adequate for these stars; Sirius moves 4.5° in 12,500 years and
 * would want rigorous space motion for the last few arcminutes), then
 * precessed with the long-term model.
 */
export function positionAtEpoch(star: StarMotion, epj: number): Equatorial {
  const { raDeg, decDeg } = properMotionAtEpoch(star, epj);
  return precessIcrsToDate(raDeg, decDeg, epj);
}

/**
 * Where proper motion alone puts a star at a Julian epoch, still on the ICRS
 * axes. `positionAtEpoch` precesses this; a caller with a whole catalogue to
 * move builds the precession matrix once and applies it to these instead.
 */
export function properMotionAtEpoch(star: StarMotion, epj: number): Equatorial {
  const dt = epj - 2000;
  const cosDec = Math.cos((star.decDeg * Math.PI) / 180);
  return {
    raDeg: star.raDeg + ((star.pmRaMasYr / 3.6e6) * dt) / cosDec,
    decDeg: star.decDeg + (star.pmDecMasYr / 3.6e6) * dt,
  };
}

/**
 * The column order of data/stars/hyg-bright.json, which is a header and an
 * array of rows rather than an array of objects. `id` is the Hipparcos number
 * where the star has one and the HYG number otherwise; `bf` is HYG's combined
 * Bayer and Flamsteed designation; `parallaxMas` is HYG's distance turned back
 * into a parallax, and is null where Hipparcos had none.
 */
export const BRIGHT_COLUMNS = ['id', 'name', 'bf', 'raDeg', 'decDeg', 'pmRaMasYr', 'pmDecMasYr', 'parallaxMas', 'mag', 'ci'] as const;

const BrightRowSchema = z.tuple([
  z.string(),
  z.string().nullable(),
  z.string().nullable(),
  z.number(),
  z.number(),
  z.number(),
  z.number(),
  z.number().nullable(),
  z.number(),
  z.number().nullable(),
]);

export const BrightCatalogueSchema = z.object({
  /** The id of the source in data/sources.json that this catalogue came from. */
  source: z.string(),
  /** The credit the licence requires, travelling with the data. */
  attribution: z.string(),
  /** No star fainter than this is in `stars`. */
  magnitudeLimit: z.number(),
  columns: z
    .array(z.string())
    .refine((c) => c.join(',') === BRIGHT_COLUMNS.join(','), `columns must be ${BRIGHT_COLUMNS.join(', ')}`),
  stars: z.array(BrightRowSchema),
});
export type BrightCatalogue = z.infer<typeof BrightCatalogueSchema>;
export type BrightRow = z.infer<typeof BrightRowSchema>;

/** One catalogue star, with the columns given names. */
export interface BrightStar extends StarMotion {
  id: string;
  /** The IAU proper name, where the star has one. */
  name?: string;
  /** Bayer and Flamsteed designation as HYG writes it, such as "50Zet Ori". */
  bf?: string;
  parallaxMas?: number;
  mag: number;
  /** Colour index B − V, which is what a renderer turns into a star's colour. */
  ci?: number;
}

/** The rows as objects. The viewer calls this once and keeps the result. */
export function expandBrightStars(catalogue: BrightCatalogue): BrightStar[] {
  return catalogue.stars.map(([id, name, bf, raDeg, decDeg, pmRaMasYr, pmDecMasYr, parallaxMas, mag, ci]) => {
    const star: BrightStar = { id, raDeg, decDeg, pmRaMasYr, pmDecMasYr, mag };
    if (name !== null) star.name = name;
    if (bf !== null) star.bf = bf;
    if (parallaxMas !== null) star.parallaxMas = parallaxMas;
    if (ci !== null) star.ci = ci;
    return star;
  });
}

/** The same catalogue cut to a brighter limit, for the browser bundle. */
export function limitMagnitude(catalogue: BrightCatalogue, magnitudeLimit: number): BrightCatalogue {
  if (magnitudeLimit >= catalogue.magnitudeLimit) return catalogue;
  return { ...catalogue, magnitudeLimit, stars: catalogue.stars.filter((row) => row[8] <= magnitudeLimit) };
}
