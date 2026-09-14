/**
 * Which overlays the viewer can actually draw. A claim's overlay is a
 * declaration in its YAML file, not code, so the list of types that exist
 * runs ahead of the list that is built; the detail pane says which is which
 * rather than pretending.
 */
import type { Claim } from '@seked/claims/browser';

export const BUILT_OVERLAYS = new Set(['ghost-profile', 'ghost-profiles']);

export interface OverlayNote {
  type: string | undefined;
  built: boolean;
  text: string;
}

export function overlayNote(claim: Claim): OverlayNote {
  const type = claim.overlay?.type;
  if (!type) return { type: undefined, built: false, text: 'This claim declares no overlay.' };
  if (!BUILT_OVERLAYS.has(type)) return { type, built: false, text: `Overlay "${type}" not built yet.` };
  return { type, built: true, text: `Overlay "${type}": the claimed slope, ghosted over the pyramid as measured.` };
}
