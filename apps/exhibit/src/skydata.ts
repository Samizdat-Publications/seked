/**
 * The sky's data, cut from data/ at build time for `virtual:sky` (vite.config.ts). Kept apart from src/sky.ts, and
 * free of imports but types, so the Vite config can load it without the sky and claims packages.
 */
import type { Star } from '@seked/sky/browser';
import type { SkyData } from './sky';

/** The bright catalogue's columns (packages/sky's BRIGHT_COLUMNS), by name. */
const COL = { id: 0, name: 1, bf: 2, ra: 3, dec: 4, pmRa: 5, pmDec: 6, mag: 8 } as const;

/**
 * `virtual:sky`, cut at build time from data/: Giza's origin from data/sites.json, the bright catalogue to
 * `magnitudeLimit`, the named stars, each claim's epoch and sun-ribbon bearings (the claims parsed from their
 * YAML by the caller), and the `drawn` constellations' figures from data/stars/figures.json.
 */
export function buildSkyData(sites: { id: string; origin: { latitude: number; longitude: number } }[],
  bright: { attribution: string; stars: unknown[][] }, named: Star[],
  claims: { id: string; epoch?: number | null; overlay?: { type?: string; params?: { bearings?: { label: string; azimuth: string | number }[] } } }[],
  figures: { attribution: string; figures: Record<string, { name: string; lines: string[][] }> } | null = null,
  drawn: readonly string[] = ['Leo'], magnitudeLimit = 4.5): SkyData {
  const giza = sites.find((s) => s.id === 'giza');
  if (!giza) throw new Error('data/sites.json has no giza');
  const stars = bright.stars.filter((r) => (r[COL.mag] as number) <= magnitudeLimit).map((r) =>
    [r[COL.id], r[COL.name], r[COL.bf], r[COL.ra], r[COL.dec], r[COL.pmRa] ?? 0, r[COL.pmDec] ?? 0, r[COL.mag]] as SkyData['stars'][number]);
  const out: SkyData['claims'] = {};
  for (const c of claims) {
    const bearings = c.overlay?.type === 'sun-ribbon' ? (c.overlay.params?.bearings ?? []).map((b) => ({ label: b.label, azimuth: String(b.azimuth) })) : [];
    if (c.epoch !== undefined || bearings.length) out[c.id] = { epoch: c.epoch ?? null, bearings };
  }
  const chosen = Object.fromEntries(drawn.flatMap((k) => (figures?.figures[k] ? [[k, figures.figures[k]!]] : [])));
  const attribution = figures ? `${bright.attribution} ${figures.attribution}` : bright.attribution;
  return { latitudeDeg: giza.origin.latitude, longitudeDeg: giza.origin.longitude, magnitudeLimit, stars, named, claims: out, figures: chosen, attribution };
}
