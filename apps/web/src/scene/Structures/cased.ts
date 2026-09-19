/**
 * What a material's name looks like on screen.
 *
 * `data/materials.json` says what each building is made of and cites a source
 * for every row; this file is the other half, and it is entirely look choice.
 * A material is a word, and a word has no colour: the tint, the photographed
 * set it is laid over, how large its masonry is drawn and how strongly the
 * relief shows are chosen here and nowhere else, so a reader who wants to
 * know what is a record and what is a preference can read the table for the
 * first and this file for the second. `lookWords` puts every number below
 * into the label the viewer shows, so none of them is silent.
 *
 * Three things were got wrong before 2026-09-19 and are put right here.
 *
 * The tint. Red granite was `#9d827b`, a grey-mauve that read as dirty
 * limestone from any distance, so Khafre's valley temple, the building Petrie
 * named the Granite Temple for its casing, was indistinguishable from the
 * limestone around it. It is now a muted rose-brown. Stewart asked for red on
 * 2026-09-19 and Hoelscher's legend calls it "Roter Granit von Assuan".
 *
 * The scale. `granite_wall` tiles at 1.9 m and the shader's far sample is
 * twenty-three times the tile, which is 43.7 m: almost exactly the width of
 * the valley temple's east face, so the photograph's own large light and dark
 * passages stretched across a whole building. Halving the tile puts two of
 * them across the face instead, which is what a wall of blocks should look
 * like from a hundred metres. (What made the first still read as varnished
 * planking was not this but the triplanar's x plane, which laid the coursed
 * photograph on its side on every east and west face; that is fixed in
 * `materials/stone.ts` and written up there.)
 *
 * The masonry. The photograph alone has no blocks in it. `block` gives each
 * block of the coursing its own tone and `course` draws the joint line, which
 * is what makes a wall read as laid stone. Neither is a measurement: no plate
 * read here gives a course height for any temple, and the sizes below are
 * chosen to look like the megalithic walling Khafre's valley temple is known
 * for. Where a course height ever is recorded for a temple, it should come
 * from the database as the pyramids' does, and this constant should go.
 */
import type { Cased, MaterialName, MaterialPart } from '@seked/data/browser';
import type { StoneOptions, StoneRole } from '../materials/stone';

/** How one material is drawn: which photographed set, what tint, how much relief, how large its blocks. */
export interface StoneLook {
  role: StoneRole | undefined;
  colour: string;
  stone: StoneOptions;
}

/**
 * The look of each material in `data/materials.json`. Look choices, all of
 * them, and the only place a material's appearance is decided.
 */
export const STONE_LOOK: Record<MaterialName, StoneLook> = {
  /** The plateau's own yellow nummulitic limestone: the core stone, roughest of the four, laid in big rough blocks. */
  'limestone.giza': {
    role: 'core',
    colour: '#bfb08e',
    stone: { strength: 0.8, scale: 0.7, relief: 0.7, block: { length: 2.6, height: 1.3 }, course: 1.3 },
  },
  /** The fine white casing limestone, dressed, so it takes less relief, a paler tint and a finer course. */
  'limestone.mokattam': {
    role: 'casing',
    colour: '#d6c49c',
    stone: { strength: 0.7, scale: 0.8, relief: 0.45, block: { length: 2.0, height: 1.0 }, course: 1.0 },
  },
  /** Aswan red granite, in the megalithic blocks the valley temple is cased and walled with. */
  'granite.red': {
    role: 'granite',
    colour: '#8e6254',
    stone: { strength: 0.55, scale: 0.5, relief: 0.35, block: { length: 3.4, height: 1.7 }, course: 1.7 },
  },
  /** The dark granite of Menkaure's unfinished casing, which Reisner calls black. Same masonry, no red. */
  'granite.black': {
    role: 'granite',
    colour: '#4c453f',
    stone: { strength: 0.55, scale: 0.5, relief: 0.35, block: { length: 3.4, height: 1.7 }, course: 1.7 },
  },
  /** Egyptian calcite: pale, almost waxy, the flattest surface on the plateau, and laid in slabs rather than courses. */
  alabaster: { role: 'casing', colour: '#e4dac1', stone: { strength: 0.3, scale: 0.9, relief: 0.15, block: { length: 1.4, height: 1.4 } } },
  /** Unbaked mud brick under mud plaster: warm, dull, and with no course worth drawing at any distance a reader stands. */
  mudbrick: { role: 'core', colour: '#8c7454', stone: { strength: 0.45, scale: 0.35, relief: 0.6 } },
  /** The black pavement of Khufu's mortuary temple, which takes no photograph at all. */
  basalt: { role: undefined, colour: '#3b3c3d', stone: { strength: 0 } },
};

/**
 * What a look says about itself, for the label. Everything here is a look
 * choice, which is why the sentence says so before it says anything else.
 */
export function lookWords(look: StoneLook): string {
  const { block, course, scale = 1 } = look.stone;
  const parts = [`drawn over the ${look.role ?? 'flat'} photograph at ${Math.round(scale * 100)} per cent of its own tile size`];
  if (block) parts.push(`with blocks ${block.length} by ${block.height} m toned apart`);
  if (course) parts.push(`and a joint line every ${course} m`);
  return `Look choices, none of them measured: ${parts.join(', ')}. No plate read here gives a course height for a temple.`;
}

/**
 * The look for the first of `parts` the table has a row for, or `fallback`.
 *
 * The order of `parts` is the caller's answer to "what is this surface?". A
 * temple's outer wall is its casing if it has one and its core if it does
 * not; its pillars are its pillars, else whatever its casing is, else its
 * core. Nothing here guesses a material: where the table is silent for every
 * part asked about, the builder's own default stands and the label already
 * says the table was silent.
 */
export function lookFor(cased: Cased, parts: readonly MaterialPart[], fallback: StoneLook): StoneLook {
  for (const part of parts) {
    const row = cased[part];
    if (row !== undefined) return STONE_LOOK[row.material];
  }
  return fallback;
}
