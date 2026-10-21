/**
 * Import the coast and the rivers of the eastern Mediterranean from Natural
 * Earth into data/places/basemap.json, for chapter 7's map inset.
 *
 *     mkdir -p build/basemap
 *     for f in ne_50m_coastline ne_50m_rivers_lake_centerlines; do
 *       curl -L -o build/basemap/$f.geojson \
 *         https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/$f.geojson
 *     done
 *     pnpm run basemap
 *
 * The map is context, as the modern city is: nothing on it is evidence, and
 * nothing on it is drawn by hand. It keeps the coastlines and the rivers
 * (canals left out) that cross the box, cut to it, with longitude and latitude
 * rounded to 0.01° (about a kilometre, a fraction of a pixel on an inset 1,500
 * km across). The raw files are build outputs; data/sources.json, source
 * natural-earth-5.1.2, carries their URLs and sha256s. Natural Earth is in the
 * public domain.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR, REPO_ROOT } from '@seked/data';

const RAW = join(REPO_ROOT, 'build', 'basemap');
const OUT_DIR = join(DATA_DIR, 'places');
const OUT = join(OUT_DIR, 'basemap.json');
const SOURCE = 'natural-earth-5.1.2';
/** West, south, east, north, degrees: Giza, the Euphrates' bend and south-east Turkey. */
const BOX = [27, 27, 42, 39] as const;
const FILES = { coast: 'ne_50m_coastline.geojson', rivers: 'ne_50m_rivers_lake_centerlines.geojson' };

type Pt = [number, number];
interface Feature { properties: Record<string, unknown>; geometry: { type: string; coordinates: Pt[] | Pt[][] } }

const sources = JSON.parse(readFileSync(join(DATA_DIR, 'sources.json'), 'utf8')) as { id: string; note?: string }[];
const source = sources.find((s) => s.id === SOURCE);
if (!source) throw new Error(`data/sources.json has no ${SOURCE}`);

const inBox = ([x, y]: Pt) => x >= BOX[0] && x <= BOX[2] && y >= BOX[1] && y <= BOX[3];
const r2 = (v: number) => Math.round(v * 100) / 100;

/** A line cut to the box: the runs of points inside it, each kept with the point either side, so lines reach the edge. */
function clip(line: Pt[]): Pt[][] {
  const runs: Pt[][] = [];
  let run: Pt[] = [];
  line.forEach((p, i) => {
    const near = inBox(p) || (i > 0 && inBox(line[i - 1]!)) || (i < line.length - 1 && inBox(line[i + 1]!));
    if (near) run.push([r2(p[0]), r2(p[1])]);
    else if (run.length) { runs.push(run); run = []; }
  });
  if (run.length) runs.push(run);
  // drop repeated points left by the rounding
  return runs.map((r) => r.filter((p, i) => !i || p[0] !== r[i - 1]![0] || p[1] !== r[i - 1]![1])).filter((r) => r.length > 1);
}

function read(kind: keyof typeof FILES) {
  const path = join(RAW, FILES[kind]);
  if (!existsSync(path)) throw new Error(`${path} is missing: fetch it with the curl lines at the top of this script`);
  const raw = readFileSync(path);
  const sha256 = createHash('sha256').update(raw).digest('hex');
  if (!source!.note?.includes(sha256)) console.warn(`warning: ${FILES[kind]}'s sha256 ${sha256} is not the one ${SOURCE} records`);
  const features = (JSON.parse(raw.toString('utf8')) as { features: Feature[] }).features;
  const out: { name: string; line: Pt[] }[] = [];
  for (const f of features) {
    const name = String(f.properties.name ?? '');
    if (kind === 'rivers' && /canal/i.test(name)) continue;
    const g = f.geometry;
    const lines = (g.type === 'MultiLineString' ? g.coordinates : [g.coordinates]) as Pt[][];
    for (const l of lines) for (const run of clip(l)) out.push({ name, line: run });
  }
  return { file: FILES[kind], sha256, lines: out };
}

const coast = read('coast');
const rivers = read('rivers');
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, `${JSON.stringify({
  source: SOURCE,
  attribution: 'Made with Natural Earth (public domain), version 5.1.2. Written by scripts/basemap.ts; do not edit.',
  box: BOX,
  files: { coast: { file: coast.file, sha256: coast.sha256 }, rivers: { file: rivers.file, sha256: rivers.sha256 } },
  coast: coast.lines.map((l) => l.line),
  rivers: rivers.lines,
}, null, 0).replace(/\],\[\[/g, '],\n[[').replace(/\},\{"name"/g, '},\n{"name"')}\n`);
const count = (ls: { line: Pt[] }[] | Pt[][]) => ls.reduce((n, l) => n + ('line' in l ? l.line.length : l.length), 0);
console.log(`basemap: ${coast.lines.length} coast lines (${count(coast.lines)} points), ` +
  `${rivers.lines.length} river lines (${count(rivers.lines)} points) in ${BOX.join(', ')}, written to ${OUT}`);
