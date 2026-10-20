/**
 * Chapter 8's last beat, "Nobody has dug for any of it.": every underground thing the chapter names, on one depth
 * scale, coloured by its evidence tier (docs/script.md). Each depth is a record read from the environment; this
 * table only says which records to show and in what words. A key ending `.up` is a height above its pyramid's
 * base (negative below it); any other is a depth below the ground. A thing the records hold no depth for is named
 * under the figure rather than drawn.
 */

export type Tier = 'excavated' | 'instrumented' | 'claimed' | 'legendary';

interface RowSpec {
  site: 'Giza' | 'Hawara';
  label: string;
  structure: string;
  keys: string[];
  /** The reply's line, not a thing in the ground: drawn as a rule across the scale. */
  line?: true;
}

const ROWS: RowSpec[] = [
  { site: 'Giza', label: 'Khafre’s chamber floor', structure: 'g2', keys: ['g2.chamber.great.floor.up'] },
  { site: 'Giza', label: 'Khufu’s passage, its foot', structure: 'g1', keys: ['passage.descending.floor.end.up'] },
  { site: 'Giza', label: 'radar’s reach, by the claimant', structure: 'g2.sar-shafts', keys: ['g2.sar.radar.penetration.max'], line: true },
  { site: 'Giza', label: 'claimed wells', structure: 'g2.sar-shafts', keys: ['g2.sar.wells.bottom.up'] },
  { site: 'Giza', label: 'claimed, deeper', structure: 'g2.sar-shafts', keys: ['g2.sar.deep.up'] },
  { site: 'Hawara', label: 'Petrie’s chips', structure: 'hawara.labyrinth',
    keys: ['hawara.labyrinth.chips.depth.south_foot.min', 'hawara.labyrinth.chips.depth.south_foot.max'] },
  { site: 'Hawara', label: 'resistivity closures', structure: 'hawara.ert-closures',
    keys: ['hawara.ert.closure.shallow.depth', 'hawara.ert.closure.deep.depth'] },
  { site: 'Hawara', label: 'Mataha walls, reported', structure: 'hawara.mataha-walls',
    keys: ['hawara.mataha.walls.depth.min', 'hawara.mataha.walls.depth.max'] },
];

/** Named in the chapter, with no depth in the records: said under the figure. */
const UNDRAWN = ['osiris-shaft', 'sphinx.paw-cavity', 'hall-of-records', 'hawara.labyrinth.lower-storey'];

export interface DepthRow {
  site: RowSpec['site'];
  label: string;
  tier: Tier;
  /** Metres below the ground or the base, shallowest first. */
  top: number;
  bottom: number;
  line: boolean;
  keys: string[];
}

type Structure = { id: string; name: string; evidence?: string };

/** A structure's tier; one with none (the modern city's context) is never drawn here. */
const tierOf = (structures: Structure[], id: string): Tier => {
  const s = structures.find((x) => x.id === id);
  if (!s?.evidence) throw new Error(`no structure ${id} with a tier`);
  return s.evidence as Tier;
};

export function depthRows(env: Record<string, number | undefined>, structures: Structure[]): DepthRow[] {
  const tier = (id: string) => tierOf(structures, id);
  return ROWS.map((r) => {
    const ds = r.keys.map((k) => {
      const v = env[k];
      if (v === undefined) throw new Error(`no record ${k}`);
      return k.endsWith('.up') ? -v : v;
    });
    return { site: r.site, label: r.label, tier: tier(r.structure), top: Math.min(...ds), bottom: Math.max(...ds), line: !!r.line, keys: r.keys };
  });
}

export const undrawn = (structures: Structure[]) =>
  UNDRAWN.map((id) => ({ id, name: structures.find((x) => x.id === id)!.name, tier: tierOf(structures, id) }));
