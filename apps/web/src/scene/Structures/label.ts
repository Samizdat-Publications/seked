/**
 * What a structure says about itself when the pointer rests on it.
 *
 * Track H's `Hover.tsx` (H3) raycasts the rotated group and shows the first
 * hit whose object or ancestor carries `userData.seked`. That registry has not
 * merged yet, so this is the whole of the contract: every mesh this folder
 * draws carries the four fields below, and `note` is the builder's own label,
 * which names what was built, out of which measurement keys, and which of its
 * parts are look choices rather than records. When H3 lands, its
 * `registerHover` can be fed from exactly these.
 *
 * The word in `tier` is the honesty word of the design, not the evidence tier
 * of `data/structures.json`: `excavated` is a traced or surveyed outline
 * carried up, which says where a monument is and how far it reaches;
 * `reconstruction` is a builder's account of how it stood, which is never a
 * measurement of its form.
 */
import type { StructureMesh, StructureTier } from '../../model';
import type { StateId } from '../../view';

export interface SekedUserData {
  name: string;
  tier: StructureTier;
  note: string;
  /** The stop on the timeline this mesh was built for, which Track H's dissolve reads. */
  state: StateId;
}

/** What any structure has to say about itself, with or without a single mesh of its own. */
export type Labelled = Omit<StructureMesh, 'mesh'>;

export function sekedUserData(built: Labelled, state: StateId): SekedUserData {
  return { name: built.name, tier: built.tier, note: built.note, state };
}
