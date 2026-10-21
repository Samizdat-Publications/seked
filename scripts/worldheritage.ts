/**
 * Import the World Heritage List's cultural properties, with a point each, from Wikidata into
 * data/places/world-heritage.json: the pool the great circle's reply draws on (apps/exhibit/src/worldsites.ts).
 *
 *     curl -s -G https://query.wikidata.org/sparql --data-urlencode query@build/worldheritage/query.rq \
 *       -H "Accept: application/sparql-results+json" -o build/worldheritage/wdqs.json
 *     pnpm run worldheritage
 *
 * The script writes the query (QUERY below) to build/worldheritage/query.rq if it is not there. A property is kept
 * when its World Heritage id (P757) is a whole property's number, not a component's (668, not 668-001), and when
 * one of its criteria (P2614) is cultural, (i) to (vi), so mixed properties are in and natural ones out. Where
 * Wikidata gives one id to several items, the item with the lowest Q number gives the point. Points are context, as
 * the places in context.json are: the reply counts them, nothing measures them.
 *
 * The download is gitignored; its sha256 is in the source entry (`wikidata-world-heritage`), and the script refuses a
 * file that does not match it. Wikidata is CC0.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DATA_DIR } from '@seked/data';

const SOURCE = 'wikidata-world-heritage';
const DIR = join(DATA_DIR, '..', 'build', 'worldheritage');
const DOWNLOAD = join(DIR, 'wdqs.json');
const OUT = join(DATA_DIR, 'places', 'world-heritage.json');
const CULTURAL = new Set(['(i)', '(ii)', '(iii)', '(iv)', '(v)', '(vi)']);

export const QUERY = `SELECT ?item ?whs ?itemLabel ?coord (GROUP_CONCAT(DISTINCT ?critLabel; separator="|") AS ?criteria) WHERE {
  ?item wdt:P757 ?whs ; wdt:P625 ?coord .
  OPTIONAL { ?item wdt:P2614 ?crit . ?crit rdfs:label ?critLabel . FILTER(LANG(?critLabel) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} GROUP BY ?item ?whs ?itemLabel ?coord
`;

interface Binding { item: { value: string }; whs: { value: string }; itemLabel: { value: string }; coord: { value: string }; criteria?: { value: string } }

/** The kept properties, one row each: id, name, latitude and longitude in degrees, sorted by id. */
export function properties(bindings: Binding[]): [string, string, number, number][] {
  const byId = new Map<string, Binding>();
  const q = (b: Binding) => Number(b.item.value.split('Q').pop());
  for (const b of bindings) {
    const id = b.whs.value;
    if (!/^\d+$/.test(id)) continue;
    if (!(b.criteria?.value ?? '').split('|').some((c) => CULTURAL.has(c))) continue;
    const had = byId.get(id);
    if (!had || q(b) < q(had)) byId.set(id, b);
  }
  return [...byId.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([id, b]) => {
    const m = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(b.coord.value);
    if (!m) throw new Error(`property ${id}: no point in ${b.coord.value}`);
    return [id, b.itemLabel.value, Number(Number(m[2]).toFixed(4)), Number(Number(m[1]).toFixed(4))];
  });
}

function main(): void {
  const sources = JSON.parse(readFileSync(join(DATA_DIR, 'sources.json'), 'utf8')) as { id: string; url: string; note?: string }[];
  const source = sources.find((s) => s.id === SOURCE);
  if (!source) throw new Error(`data/sources.json has no ${SOURCE}`);
  const rq = join(DIR, 'query.rq');
  if (!existsSync(rq)) { mkdirSync(dirname(rq), { recursive: true }); writeFileSync(rq, QUERY); }
  if (!existsSync(DOWNLOAD)) throw new Error(`${DOWNLOAD} is not there: run the curl in this script's header`);
  const raw = readFileSync(DOWNLOAD);
  const sha = createHash('sha256').update(raw).digest('hex');
  if (!(source.note ?? '').includes(sha)) throw new Error(`${DOWNLOAD} has sha256 ${sha}, which is not the one data/sources.json records for ${SOURCE}`);
  const rows = properties((JSON.parse(raw.toString('utf8')) as { results: { bindings: Binding[] } }).results.bindings);
  const out = {
    source: SOURCE,
    attribution: `The World Heritage List's cultural and mixed properties, one point each, from Wikidata (CC0), imported by scripts/worldheritage.ts. Context for a reply, not measurements. Full citation: data/sources.json, source "${SOURCE}".`,
    sha256: sha,
    columns: ['id', 'name', 'latitude', 'longitude'],
    properties: rows,
  };
  writeFileSync(OUT, JSON.stringify(out).replace(/\],\[/g, '],\n[') + '\n');
  console.log(`wrote ${OUT}: ${rows.length} properties`);
}

if (process.argv[1]?.endsWith('worldheritage.ts')) main();
