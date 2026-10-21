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
 * `magnitudeLimit`, the named stars, each claim's epoch, sun-ribbon bearings and comparisons (the claims parsed from
 * their YAML by the caller), the `drawn` constellations' figures from data/stars/figures.json, and the star each of
 * the sky bake's `nights` puts on the meridian (scripts/sky-bake.ts NIGHTS, passed in by the caller).
 */
export function buildSkyData(sites: { id: string; origin: { latitude: number; longitude: number } }[],
  bright: { attribution: string; stars: unknown[][] }, named: Star[],
  claims: { id: string; epoch?: number | null; overlay?: { type?: string; params?: { bearings?: { label: string; azimuth: string | number }[]; exaggeration?: number; star?: string; figures?: Record<string, string> } };
    comparisons?: { label: string; formula: string | number; target: string | number; unit?: string }[] }[],
  figures: { attribution: string; figures: Record<string, { name: string; lines: string[][] }> } | null = null,
  nights: Record<string, { meridian: string }> = {}, drawn: readonly string[] = ['Leo', 'Ori'], magnitudeLimit = 4.5): SkyData {
  const giza = sites.find((s) => s.id === 'giza');
  if (!giza) throw new Error('data/sites.json has no giza');
  const stars = bright.stars.filter((r) => (r[COL.mag] as number) <= magnitudeLimit).map((r) =>
    [r[COL.id], r[COL.name], r[COL.bf], r[COL.ra], r[COL.dec], r[COL.pmRa] ?? 0, r[COL.pmDec] ?? 0, r[COL.mag]] as SkyData['stars'][number]);
  const out: SkyData['claims'] = {};
  for (const c of claims) {
    const bearings = c.overlay?.type === 'sun-ribbon' ? (c.overlay.params?.bearings ?? []).map((b) => ({ label: b.label, azimuth: String(b.azimuth) })) : [];
    const comparisons = (c.comparisons ?? []).map((k) => ({ label: k.label, formula: String(k.formula), target: String(k.target), unit: k.unit ?? '' }));
    // a compass rose's exaggeration (C1) is the overlay's own, so a figure drawing it states the claim's factor
    const exaggeration = c.overlay?.type === 'compass-rose' ? c.overlay.params?.exaggeration : undefined;
    // a claim argued away from Giza (C8, the panel type) may name the constellations it reads and its date's star
    const chart = c.overlay?.params?.figures && c.overlay.params.star
      ? { star: c.overlay.params.star, figures: c.overlay.params.figures } : undefined;
    if (c.epoch !== undefined || bearings.length || exaggeration) out[c.id] = { epoch: c.epoch ?? null, bearings, comparisons, ...(exaggeration ? { exaggeration } : {}), ...(chart ? { chart } : {}) };
  }
  const charted = Object.values(out).flatMap((c) => Object.keys(c.chart?.figures ?? {}));
  const chosen = Object.fromEntries([...new Set([...drawn, ...charted])].flatMap((k) => (figures?.figures[k] ? [[k, figures.figures[k]!]] : [])));
  const attribution = figures ? `${bright.attribution} ${figures.attribution}` : bright.attribution;
  const meridians = Object.fromEntries(Object.entries(nights).map(([id, n]) => [id, n.meridian]));
  return { latitudeDeg: giza.origin.latitude, longitudeDeg: giza.origin.longitude, magnitudeLimit, stars, named, claims: out, figures: chosen, nights: meridians, attribution };
}
