/**
 * Star records and the geometry that moves them through time. Nothing here
 * reads a file: the catalogue on disk is `./catalogue`, which the Node entry
 * exports and the browser entry leaves out.
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

/**
 * Apparent mean place at a Julian epoch: proper motion applied linearly from
 * J2000 (adequate for these stars; Sirius moves 4.5° in 12,500 years and
 * would want rigorous space motion for the last few arcminutes), then
 * precessed with the long-term model.
 */
export function positionAtEpoch(star: Star, epj: number): { raDeg: number; decDeg: number } {
  const dt = epj - 2000;
  const cosDec = Math.cos((star.decDeg * Math.PI) / 180);
  const ra = star.raDeg + ((star.pmRaMasYr / 3.6e6) * dt) / cosDec;
  const dec = star.decDeg + (star.pmDecMasYr / 3.6e6) * dt;
  return precessIcrsToDate(ra, dec, epj);
}
