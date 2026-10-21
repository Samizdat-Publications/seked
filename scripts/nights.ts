/**
 * The nights the walkthrough renders (render/giza/night.py, baked by scripts/sky-bake.ts): an epoch, the star put
 * on the meridian, and what the night is for. `c2-2450` is the night `stars` has always carried; `first-time` is
 * Bauval and Hancock's 10,450 BCE, when Orion's belt crossed the meridian at the lowest point of its precessional
 * swing. Kept free of imports so the exhibit's build (apps/exhibit/vite.config.ts) can read it too, and turn its
 * live sky at a night to the same sidereal time the bake does.
 */

/** The epoch of the night view: C2's, Bauval and Gilbert's 2450 BCE. */
export const NIGHT_EPOCH = -2449;

/** The star put on the meridian for the night view, by `data/stars/named.json`'s id. */
export const MERIDIAN_STAR = 'alnitak';

export const NIGHTS: Record<string, { epoch: number; meridian: string; label: string }> = {
  'c2-2450': { epoch: NIGHT_EPOCH, meridian: MERIDIAN_STAR, label: 'Bauval and Gilbert\'s 2450 BCE, Alnitak on the meridian' },
  'first-time': { epoch: -10449, meridian: 'alnitak', label: 'The First Time, 10,450 BCE, Alnitak on the meridian at the lowest of the belt\'s precessional swing' },
};
