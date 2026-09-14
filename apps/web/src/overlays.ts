/**
 * Which overlays the viewer can actually draw, and how to read the ones it
 * can. A claim's overlay is a declaration in its YAML file, not code, so the
 * list of types that exist runs ahead of the list that is built; the detail
 * pane says which is which rather than pretending.
 */
import { evaluate, type Claim } from '@seked/claims/browser';
import type { Environment } from '@seked/geometry';
import { STRUCTURES, type StructureId } from './model';

export const BUILT_OVERLAYS = new Set(['ghost-profile', 'ghost-profiles']);

/** Enough colours for the three slopes A3 puts side by side. */
const GHOST_COLOURS = ['#7fd1ff', '#ffcf70', '#ff9bc2'];

export interface GhostProfile {
  /** The expression as the claim file writes it, which is the honest label. */
  label: string;
  slopeDeg: number;
  colour: string;
}

export interface GhostProfileSpec {
  structure: StructureId;
  profiles: GhostProfile[];
  /** The survey's error band on the measured face angle, in arcminutes. */
  errorBandArcmin: number | undefined;
}

const asString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const isStructure = (id: string): id is StructureId => (STRUCTURES as readonly string[]).includes(id);

/**
 * A ghost profile is a pyramid on the measured base at a claimed slope, so a
 * reader can see how far the claim is from the monument. The slopes are
 * expressions in the same language the claims use, evaluated in the same
 * environment, so changing the preset or the cubit moves them too.
 */
export function ghostProfileSpec(claim: Claim, env: Environment): GhostProfileSpec | undefined {
  const overlay = claim.overlay;
  if (!overlay || !BUILT_OVERLAYS.has(overlay.type)) return undefined;
  const params: Record<string, unknown> = overlay.params ?? {};
  const structure = asString(params.structure) ?? 'g1';
  if (!isStructure(structure)) return undefined;

  const written = overlay.type === 'ghost-profiles' ? (Array.isArray(params.slopes) ? params.slopes : []) : [params.slope];
  const profiles: GhostProfile[] = [];
  for (const raw of written) {
    const source = asString(raw);
    if (!source) continue;
    try {
      profiles.push({ label: source, slopeDeg: evaluate(source, env), colour: GHOST_COLOURS[profiles.length % GHOST_COLOURS.length] as string });
    } catch {
      // A slope the environment cannot evaluate is simply not drawn.
    }
  }
  if (profiles.length === 0) return undefined;
  return { structure, profiles, errorBandArcmin: typeof params.error_band_arcmin === 'number' ? params.error_band_arcmin : undefined };
}

export interface OverlayNote {
  type: string | undefined;
  built: boolean;
  text: string;
}

export function overlayNote(claim: Claim, env: Environment): OverlayNote {
  const type = claim.overlay?.type;
  if (!type) return { type: undefined, built: false, text: 'This claim declares no overlay.' };
  const spec = ghostProfileSpec(claim, env);
  if (!spec) return { type, built: false, text: `Overlay "${type}" not built yet.` };
  const structure = spec.structure.toUpperCase();
  return {
    type,
    built: true,
    text:
      spec.profiles.length === 1
        ? `Ghosted over ${structure}: a pyramid on the measured base at the claimed slope.`
        : `Ghosted over ${structure}: ${spec.profiles.length} pyramids on the measured base, one per claimed slope.`,
  };
}
