/**
 * The metal the capstones are clad in, for the state that claims they were.
 *
 * Electrum is the gold and silver alloy the Egyptians actually used, and the
 * texts have the pyramidion of at least one pyramid sheathed in it. What that
 * looked like is not a measurement and this file does not pretend otherwise:
 * the colour, the roughness and the polish below are look choices, chosen so
 * that a capstone 146 m up catches the sun before the plain is lit and after
 * it has gone, which is the shimmering moment the spec asks of the First Time.
 *
 * The only thing here that is not chosen is the shape it is put on, which is
 * `pyramidionMesh`'s and comes out of the database's own slope.
 */
import type { MeshPhysicalMaterial } from 'three';

/**
 * Electrum, pale gold: the alloy is roughly three parts gold to one of silver
 * and reads paler and cooler than gold leaf. A look choice.
 */
export const ELECTRUM_COLOUR = '#e6d7a3';

/**
 * Look choices. A metal takes its colour from its reflection rather than from
 * a diffuse tint, so the roughness is what decides whether the capstone reads
 * as a mirror or as a lamp: 0.18 is a hand-burnished sheet rather than a
 * jeweller's polish, which keeps the sun in it a disc and not a star.
 */
const LOOK = {
  /**
   * Burnished rather than mirror-polished, so the sun spreads into a glint a
   * viewer can see from more than one stand; and not quite a pure metal, so a
   * little of the alloy's own warmth survives when the sky it reflects is dim.
   * The environment map is the sky alone, with no lit ground in it, and a
   * true metal under it at dusk was soot (director, 2026-09-17).
   *
   * Since then `Sky.tsx` has put a warm ground in the lower half of that map,
   * which is where a capstone standing 146 m up sees most of its world, so the
   * alloy has something gold to reflect and the metalness can go back up
   * toward the true metal electrum is. What the cap should read as from a
   * kilometre is a small warm glint, not a lamp, so the roughness stays wide
   * and the environment share comes down with the ground's arrival.
   */
  roughness: 0.28,
  metalness: 0.92,
  /**
   * How much of the scene's environment map this material takes, against the
   * one everything else takes. A metal has no diffuse at all: what it is not
   * reflecting, it is black. The scene holds its environment well down so the
   * sky does not wash every shadow out of a desert at noon, and at that
   * strength a capstone reads as a lump of soot. Three and a half times it is
   * a look choice, and the smallest that leaves the cap reading gold from the
   * panorama stand now that half of what it reflects is lit sand.
   */
  environment: 3.5,
} as const;

/**
 * Clad a material in electrum: a true metal, so nothing of it is diffuse and
 * no coat sits over it. A lacquer would put an untinted white reflection on
 * top of the alloy's own and take the gold out of it, which is the one thing
 * this material is for.
 */
export function applyElectrum(material: MeshPhysicalMaterial): void {
  material.metalness = LOOK.metalness;
  material.roughness = LOOK.roughness;
  material.clearcoat = 0;
  material.envMapIntensity = LOOK.environment;
}
