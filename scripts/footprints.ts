/**
 * Import the Tier 3 masses from OpenStreetMap into data/footprints/giza.json.
 *
 *     pnpm run footprints            # fetches from Overpass if the cache is missing
 *     pnpm run footprints --refresh  # fetches again
 *
 * The plateau's lesser monuments have no survey this project can read: Petrie
 * never uncovered the queens' pyramids' bases (section 90), the boat pits were
 * found in 1954, and the Giza Plateau Mapping Project's plans are in books.
 * OpenStreetMap has traced nearly all of them from imagery, and some it has
 * modelled in three dimensions: the Sphinx is there as a body, a head and a
 * pair of forepaws, each with its own height. So the footprints are imported,
 * the way the star catalogue is, and never typed.
 *
 * What makes them usable is registration. OSM is traced in WGS84 from imagery
 * and this project's frame is Petrie's survey, hung off a Great Pyramid
 * latitude that is only a commonly cited figure. Rather than trust that
 * figure, the import fits OSM onto the three pyramids whose places the survey
 * does know: a rotation and a translation, least squares, from the centroids
 * of OSM's three pyramid outlines to the positions the database gives them.
 * The residuals of that fit are the honest statement of how well OSM agrees
 * with Petrie, and they are written into the output's header. No scale is
 * fitted: OSM traces the ruined outline and not the lost casing, so its
 * pyramids come out a few metres small and a fitted scale would be absorbing
 * that rather than any error in position. The scale that would have fitted is
 * recorded beside the residuals for the same reason.
 *
 * Each footprint's base level is set where the scene's own ground is, by
 * sampling the GLO-30 heightfield and flattening it under the three pyramids
 * with the same `groundHeight` Blender and the viewer draw the ground with,
 * and taking the lowest of the ring's corners so nothing floats. The plateau
 * falls about forty metres from Khufu to the valley temples, so this is not a
 * refinement.
 *
 * Heights are OSM's where OSM tags one, and otherwise a measurement key that
 * the geometry package resolves at build time, so a height estimate lives in
 * data/measurements like every other number and a better figure replaces it
 * there without re-importing anything.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR, loadDatabase, loadTerrain, resolve } from '@seked/data';
import { buildEnvironment, groundHeight, khafreCauseway, type Footprint, type GroundPyramid } from '@seked/geometry';

const OUT_DIR = join(DATA_DIR, 'footprints');
const CACHE = join(OUT_DIR, 'overpass-giza.json');
const OUT = join(OUT_DIR, 'giza.json');
const SOURCE = 'osm-2026';
const PRESET = 'canonical';

/** South, west, north, east: the plateau with the Wall of the Crow and the valley temples inside it. */
const BBOX = [29.964, 31.115, 29.988, 31.145] as const;
/**
 * Every way in the box, unfiltered. The import picks what it wants in code, so
 * a narrower query would only move that choice somewhere it is harder to read,
 * and a busy Overpass server answers this one as readily as a filtered one.
 */
const QUERY = `[out:json][timeout:90];
(
  way(${BBOX.join(',')});
  relation(${BBOX.join(',')})["type"="multipolygon"];
);
out tags geom;`;
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

/** How a footprint becomes a solid. */
type Kind = 'pyramid' | 'prism' | 'pit';

interface Curated {
  osm: number;
  id: string;
  name: string;
  kind: Kind;
  /** A measurement key for the height, where OSM tags none. */
  heightKey?: string;
  /** A measurement key for a pit's depth. */
  depthKey?: string;
  /** Which group of the scene it belongs in. */
  group: 'queens' | 'sphinx' | 'temples' | 'pits' | 'walls' | 'tombs';
}

/**
 * The monuments picked out by name. The OSM ids are the import's only
 * editorial content; everything else about each one comes out of the data.
 * The three big pyramids are left out on purpose: the survey builds those,
 * and OSM's outlines of them are used only to register everything else.
 */
const CURATED: Curated[] = [
  { osm: 198032492, id: 'g1a', name: 'Queen’s pyramid G1-a (Hetepheres I, as OSM names it)', kind: 'pyramid', group: 'queens' },
  { osm: 219797724, id: 'g1b', name: 'Queen’s pyramid G1-b (Meritites I)', kind: 'pyramid', group: 'queens' },
  { osm: 219797726, id: 'g1c', name: 'Queen’s pyramid G1-c (Henutsen)', kind: 'pyramid', group: 'queens' },
  { osm: 510732344, id: 'g2a', name: 'Satellite pyramid of Khafre, G2-a', kind: 'pyramid', heightKey: 'tier3.satellite_pyramid.height', group: 'queens' },
  { osm: 25416060, id: 'g3a', name: 'Queen’s pyramid G3-a', kind: 'pyramid', group: 'queens' },
  { osm: 25416067, id: 'g3b', name: 'Queen’s pyramid G3-b', kind: 'pyramid', group: 'queens' },
  { osm: 25416093, id: 'g3c', name: 'Queen’s pyramid G3-c', kind: 'pyramid', group: 'queens' },
  { osm: 73174154, id: 'khentkawes', name: 'Tomb of Khentkawes I', kind: 'pyramid', group: 'queens' },
  { osm: 24585237, id: 'sphinx.body', name: 'Great Sphinx, body', kind: 'prism', group: 'sphinx' },
  { osm: 540058406, id: 'sphinx.paws', name: 'Great Sphinx, forepaws', kind: 'prism', group: 'sphinx' },
  { osm: 540058407, id: 'sphinx.head', name: 'Great Sphinx, head', kind: 'prism', group: 'sphinx' },
  { osm: 97577625, id: 'khafre.mortuary_temple', name: 'Mortuary temple of Khafre', kind: 'prism', heightKey: 'tier3.temple.height', group: 'temples' },
  { osm: 1238523832, id: 'khafre.valley_temple', name: 'Valley temple of Khafre, Petrie’s Granite Temple', kind: 'prism', heightKey: 'tier3.temple.height', group: 'temples' },
  { osm: 251168393, id: 'menkaure.mortuary_temple', name: 'Mortuary temple of Menkaure', kind: 'prism', heightKey: 'tier3.temple.height', group: 'temples' },
  { osm: 510732343, id: 'menkaure.valley_temple', name: 'Valley temple of Menkaure', kind: 'prism', heightKey: 'tier3.temple.height', group: 'temples' },
  { osm: 1238523833, id: 'sphinx.temple', name: 'Sphinx Temple', kind: 'prism', heightKey: 'tier3.temple.height', group: 'temples' },
  { osm: 1238523831, id: 'amenhotep2.temple', name: 'Temple of Amenhotep II', kind: 'prism', heightKey: 'tier3.temple.height', group: 'temples' },
  { osm: 219797717, id: 'g1.boat_pit.south_east', name: 'Boat pit east of the Great Pyramid, south of the temple', kind: 'pit', depthKey: 'tier3.boat_pit.depth', group: 'pits' },
  { osm: 219797716, id: 'g1.boat_pit.north_east', name: 'Boat pit east of the Great Pyramid, north of the temple', kind: 'pit', depthKey: 'tier3.boat_pit.depth', group: 'pits' },
  { osm: 1151047352, id: 'g1.boat_pit.causeway', name: 'Boat pit beside Khufu’s causeway', kind: 'pit', depthKey: 'tier3.boat_pit.depth', group: 'pits' },
  { osm: 510736191, id: 'wall_of_the_crow', name: 'Wall of the Crow', kind: 'prism', heightKey: 'tier3.wall_of_the_crow.height', group: 'walls' },
  { osm: 219797714, id: 'hemiunu', name: 'Mastaba of Hemiunu, G 4000', kind: 'prism', heightKey: 'tier3.mastaba.height', group: 'tombs' },
];

/** OSM ways standing for the three surveyed pyramids, used for registration only. */
const REGISTRATION: Record<string, number> = { g1: 4420397, g2: 4420396, g3: 4420398 };

/** The fence round the archaeological site; a mastaba is an ancient ruin inside it. */
const SITE_FENCE = 73227488;

/** Mastaba outlines smaller or larger than this are not mastabas: a cairn, a trace, a whole enclosure. */
const MASTABA_AREA: readonly [number, number] = [20, 3000];

interface OsmWay {
  type: 'way';
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

async function fetchOverpass(): Promise<string> {
  let last = '';
  for (const endpoint of ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'seked/0.1 (personal project)' },
        body: `data=${encodeURIComponent(QUERY)}`,
        signal: AbortSignal.timeout(180_000),
      });
      const text = await response.text();
      if (response.ok && text.trimStart().startsWith('{')) {
        console.log(`fetched ${text.length} bytes from ${endpoint}`);
        return text;
      }
      last = `${endpoint}: ${response.status} ${text.slice(0, 160)}`;
    } catch (error) {
      last = `${endpoint}: ${String(error)}`;
    }
    console.log(`  ${last}`);
  }
  throw new Error(`no Overpass endpoint answered: ${last}`);
}

type Xy = [number, number];

function signedArea(ring: readonly Xy[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i] as Xy;
    const [x1, y1] = ring[(i + 1) % ring.length] as Xy;
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

function centroid(ring: readonly Xy[]): Xy {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i] as Xy;
    const [x1, y1] = ring[(i + 1) % ring.length] as Xy;
    const c = x0 * y1 - x1 * y0;
    a += c;
    cx += (x0 + x1) * c;
    cy += (y0 + y1) * c;
  }
  return [cx / (3 * a), cy / (3 * a)];
}

function inside([x, y]: Xy, poly: readonly Xy[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i] as Xy;
    const [xj, yj] = poly[j] as Xy;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const refresh = process.argv.includes('--refresh');
  const raw = !refresh && existsSync(CACHE) ? readFileSync(CACHE, 'utf8') : await fetchOverpass();
  if (refresh || !existsSync(CACHE)) writeFileSync(CACHE, raw);
  const sha256 = createHash('sha256').update(raw).digest('hex');
  const overpass = JSON.parse(raw) as { osm3s: { timestamp_osm_base: string }; elements: OsmWay[] };
  const ways = new Map<number, OsmWay>();
  for (const e of overpass.elements) if (e.type === 'way' && e.geometry && e.geometry.length >= 3) ways.set(e.id, e);

  const db = loadDatabase();
  const { values } = resolve(db, PRESET);
  const env = buildEnvironment(values);
  const radius = env['earth.radius.mean'];
  if (radius === undefined) throw new Error('earth.radius.mean is not in the database');

  // A local flat frame about OSM's own Great Pyramid, so the fit is well conditioned.
  const anchor = ways.get(REGISTRATION.g1 as number);
  if (!anchor?.geometry) throw new Error(`OSM way ${REGISTRATION.g1} (the Great Pyramid) is not in the import`);
  const lat0 = anchor.geometry.reduce((a, p) => a + p.lat, 0) / anchor.geometry.length;
  const lon0 = anchor.geometry.reduce((a, p) => a + p.lon, 0) / anchor.geometry.length;
  const perDegree = (radius * Math.PI) / 180;
  const flat = (p: { lat: number; lon: number }): Xy => [
    (p.lon - lon0) * Math.cos((lat0 * Math.PI) / 180) * perDegree,
    (p.lat - lat0) * perDegree,
  ];
  const ringOf = (way: OsmWay): Xy[] => {
    const pts = (way.geometry ?? []).map(flat);
    const first = pts[0] as Xy;
    const last = pts[pts.length - 1] as Xy;
    if (first[0] === last[0] && first[1] === last[1]) pts.pop();
    // Counter-clockwise seen from above, whatever order the mapper drew it in.
    if (signedArea(pts) < 0) pts.reverse();
    return pts;
  };

  // --- Registration onto the survey --------------------------------------
  const pairs = Object.entries(REGISTRATION).map(([id, osm]) => {
    const way = ways.get(osm);
    if (!way) throw new Error(`OSM way ${osm} (${id}) is not in the import`);
    const east = id === 'g1' ? 0 : -(env[`${id}.centre.offset.west`] ?? Number.NaN);
    const north = id === 'g1' ? 0 : -(env[`${id}.centre.offset.south`] ?? Number.NaN);
    if (!Number.isFinite(east) || !Number.isFinite(north)) throw new Error(`the ${PRESET} preset does not place ${id}`);
    return { id, from: centroid(ringOf(way)), to: [east, north] as Xy };
  });
  const mean = (pts: Xy[]): Xy => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
  const cf = mean(pairs.map((p) => p.from));
  const ct = mean(pairs.map((p) => p.to));
  let sinSum = 0;
  let cosSum = 0;
  let spreadFrom = 0;
  let spreadTo = 0;
  for (const { from, to } of pairs) {
    const [px, py] = [from[0] - cf[0], from[1] - cf[1]];
    const [qx, qy] = [to[0] - ct[0], to[1] - ct[1]];
    sinSum += px * qy - py * qx;
    cosSum += px * qx + py * qy;
    spreadFrom += px * px + py * py;
    spreadTo += qx * qx + qy * qy;
  }
  const theta = Math.atan2(sinSum, cosSum);
  const [c, s] = [Math.cos(theta), Math.sin(theta)];
  const tx = ct[0] - (c * cf[0] - s * cf[1]);
  const ty = ct[1] - (s * cf[0] + c * cf[1]);
  const toFrame = ([x, y]: Xy): Xy => [c * x - s * y + tx, s * x + c * y + ty];
  const residuals = Object.fromEntries(pairs.map(({ id, from, to }) => {
    const [x, y] = toFrame(from);
    return [id, Math.round(Math.hypot(x - to[0], y - to[1]) * 100) / 100];
  }));
  console.log(`registration: rotation ${((theta * 180) / Math.PI * 60).toFixed(2)} arcmin, translation (${tx.toFixed(2)}, ${ty.toFixed(2)}) m`);
  console.log(`  residuals ${JSON.stringify(residuals)} m, scale that would have fitted ${Math.sqrt(spreadTo / spreadFrom).toFixed(5)}`);

  // --- The ground each footprint stands on -------------------------------
  const terrain = loadTerrain();
  const site = db.sites.find((x) => x.id === terrain.header.site);
  if (!site) throw new Error(`site ${terrain.header.site} is not in sites.json`);
  const pyramids: GroundPyramid[] = ['g1', 'g2', 'g3'].flatMap((id) => {
    const base = env[`${id}.base.side.mean`];
    if (base === undefined) return [];
    return [{
      base,
      offsetEast: -(env[`${id}.centre.offset.west`] ?? 0),
      offsetNorth: -(env[`${id}.centre.offset.south`] ?? 0),
      offsetUp: env[`${id}.base.elevation.relative`] ?? 0,
    }];
  });
  const ground = ([x, y]: Xy): number => groundHeight(x, y, terrain.sample(x, y) - site.origin.elevation, pyramids);
  const round2 = (v: number) => Math.round(v * 100) / 100;

  const feature = (way: OsmWay, extra: Record<string, unknown>) => {
    const ring = ringOf(way).map(toFrame);
    const tags = way.tags ?? {};
    const height = tags.height !== undefined ? Number.parseFloat(tags.height) : undefined;
    const minHeight = tags.min_height !== undefined ? Number.parseFloat(tags.min_height) : undefined;
    return {
      ...extra,
      osm: way.id,
      base: round2(Math.min(...ring.map(ground))),
      ...(height !== undefined && Number.isFinite(height) ? { height } : {}),
      ...(minHeight !== undefined && Number.isFinite(minHeight) ? { minHeight } : {}),
      area: round2(signedArea(ring)),
      ring: ring.map(([x, y]) => [round2(x), round2(y)]),
    };
  };

  const features = CURATED.map((m) => {
    const way = ways.get(m.osm);
    if (!way) throw new Error(`OSM way ${m.osm} (${m.id}) is not in the import`);
    const { osm: _osm, ...rest } = m;
    const f = feature(way, rest);
    if (m.kind !== 'pit' && f.height === undefined && m.heightKey === undefined) {
      throw new Error(`${m.id}: OSM tags no height and no measurement key is named for one`);
    }
    return f;
  });

  // --- Khafre's causeway, laid on its ridge -------------------------------
  // Built from the two temples just placed and Petrie's width, in segments
  // short enough to follow the ground, each vertex set on the ground under it.
  const CAUSEWAY_SEGMENTS = 24;
  const causeway = khafreCauseway(env, features as unknown as Footprint[], CAUSEWAY_SEGMENTS);
  if (causeway) {
    const bases = causeway.ring.map((pt) => round2(ground(pt as Xy)));
    features.push({
      ...causeway,
      base: bases[0] as number,
      bases,
      area: round2(causeway.area),
      ring: causeway.ring.map(([x, y]) => [round2(x), round2(y)]),
    } as unknown as (typeof features)[number]);
    console.log(`causeway: ${CAUSEWAY_SEGMENTS} segments, climbing from ${bases[0]} to ${bases[CAUSEWAY_SEGMENTS]} m`);
  }

  // --- The mastaba fields ------------------------------------------------
  const fenceWay = ways.get(SITE_FENCE);
  const fence = fenceWay ? ringOf(fenceWay) : undefined;
  const curatedIds = new Set(CURATED.map((m) => m.osm));
  const excluded = new Set([...curatedIds, ...Object.values(REGISTRATION), SITE_FENCE]);
  let skipped = 0;
  const mastabas = [...ways.values()].filter((way) => {
    if (excluded.has(way.id)) return false;
    const t = way.tags ?? {};
    const ancient = t['historic:civilization'] === 'ancient_egyptian' || t.building === 'ruins';
    const ruin = t.historic === 'ruins' || t.historic === 'tomb';
    if (!ancient || !ruin || t.barrier || t['building:part'] || t.tomb === 'pyramid') return false;
    const ring = ringOf(way);
    const area = signedArea(ring);
    if (area < MASTABA_AREA[0] || area > MASTABA_AREA[1] || !fence || !inside(centroid(ring), fence)) {
      skipped += 1;
      return false;
    }
    return true;
  }).sort((a, b) => a.id - b.id).map((way) => feature(way, {
    id: `mastaba.osm_${way.id}`,
    name: way.tags?.name ?? 'Mastaba',
    kind: 'prism' as Kind,
    heightKey: 'tier3.mastaba.height',
    group: 'mastabas',
  }));

  const out = {
    source: SOURCE,
    attribution: '© OpenStreetMap contributors, ODbL. Imported, registered onto the survey frame and set on the scene’s ground by scripts/footprints.ts.',
    osmBase: overpass.osm3s.timestamp_osm_base,
    query: QUERY,
    sha256,
    preset: PRESET,
    registration: {
      method: 'Least-squares rotation and translation, no scale, from the area centroids of OSM’s three pyramid outlines to the database’s positions for them.',
      origin: { latitude: lat0, longitude: lon0 },
      rotationArcmin: round2((theta * 180 * 60) / Math.PI),
      translation: [round2(tx), round2(ty)],
      residuals,
      unfittedScale: Math.round(Math.sqrt(spreadTo / spreadFrom) * 1e5) / 1e5,
    },
    features: [...features, ...mastabas],
  };
  writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
  console.log(`wrote ${features.length} named footprints and ${mastabas.length} mastabas to ${OUT} (${skipped} ancient ruins outside the fence or the size range)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
