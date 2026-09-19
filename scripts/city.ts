/**
 * Import the modern city behind the plateau into data/footprints/city.*.
 *
 *     pnpm run city            # uses whatever is cached under build/city/
 *     pnpm run city --refresh  # streams the 1.3 GB archive again
 *
 * The plateau does not stand in a desert any more. Giza and Cairo come up to
 * the fence, and a `today` state that leaves them out is not today. So the
 * city is imported like everything else here, and never invented: outlines
 * from Google's Open Buildings v3, heights from the Open Buildings 2.5D
 * Temporal raster. It is context and not evidence, which CLAUDE.md sets out:
 * no evidence tier, no claim may cite it, and it is drawn only in `today`.
 *
 * OpenStreetMap was the obvious source and is the wrong one. In the 9 by 11
 * km box east of the plateau OSM has about 7,300 buildings and 98 per cent of
 * them carry no height of any kind, so an extruded OSM would be a few
 * well-mapped districts on an empty plain with every height invented. Open
 * Buildings has 277,266 in the same box, and the 2.5D raster measured a
 * height for nearly all of them.
 *
 * The footprint archive is one S2 level-4 cell, 1,315 MB gzipped and
 * 13,308,407 rows, and it is not spatially sorted, so there is nothing to do
 * but stream the whole thing and keep the rows inside the box. That took 48
 * seconds on a good line and seven minutes on a poor one, which is why the
 * clip is cached. Each line is cut by `indexOf` rather than by a CSV reader
 * because the four fields the clip needs are unquoted numbers at the front
 * and the quoted WKT geometry is behind them, so a parser would be doing
 * work on 13 million rows that nothing here reads.
 *
 * What is kept of a building is its oriented bounding box and not its
 * outline. 277,266 polygons is not a data file, it is a liability; the boxes
 * are 6 MB and a city seen from the plateau is boxes. The box is the
 * minimum-area rectangle of the imported polygon, which for the rectangular
 * roofs of a real city is the roof, and for an L-shaped block is the smallest
 * rectangle that covers it. If a later stage wants true outlines for the few
 * hundred buildings nearest the camera it can add them beside these.
 *
 * A height is a measurement with an error bar. The 2.5D raster states a mean
 * absolute error of 1.5 m and caps heights at 100 m, and those figures, the
 * year of the imagery, and the count of buildings the raster could not give a
 * height to, are all in the header of the file this writes. Nothing here
 * rounds an unknown height up to something that looks like a city.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DATA_DIR, REPO_ROOT, loadDatabase, loadTerrain, resolve } from '@seked/data';
import { buildEnvironment } from '@seked/geometry';

const OUT_DIR = join(DATA_DIR, 'footprints');
/** Caches, not data: gitignored, and rebuilt from the URLs below at any time. */
const CACHE_DIR = join(REPO_ROOT, 'build', 'city');
const CLIP = join(CACHE_DIR, 'open-buildings-v3-145-clip.csv');
const FOOTPRINT_SOURCE = 'open-buildings-v3';
const PRESET = 'canonical';

/**
 * South, west, north, east. West of the plateau is desert and east is the
 * Nile, so the box is the whole of what can be seen from the pyramids on a
 * clear day and no more.
 */
export const BBOX = [29.94, 31.1, 30.04, 31.24] as const;

/**
 * The S2 level-4 cell that holds Egypt. Two spellings of the same object, so
 * a host that answers slowly is not the end of the import.
 */
const FOOTPRINT_ENDPOINTS = [
  'https://storage.googleapis.com/open-buildings-data/v3/polygons_s2_level_4_gzip/145_buildings.csv.gz',
  'https://open-buildings-data.storage.googleapis.com/v3/polygons_s2_level_4_gzip/145_buildings.csv.gz',
];

const CSV_HEADER = 'latitude,longitude,area_in_meters,confidence,geometry,full_plus_code';

/**
 * A look choice, and here is the sentence. Open Buildings scores every
 * outline, and below about 0.7 the detections in this box are mostly field
 * walls, canal banks and shadow, so drawing them would put noise on the
 * horizon rather than a city. 0.70 keeps 231,988 of the 277,266 and is where
 * Google's own guidance starts.
 */
export const CONFIDENCE_FLOOR = 0.7;

/** A degenerate outline is one no rectangle can be fitted to: kept only as a count. */
export interface OrientedBox {
  /** Centre of the rectangle, metres east of the Great Pyramid's base centre. */
  x: number;
  /** Centre of the rectangle, metres north. */
  y: number;
  /** The long side, metres. */
  width: number;
  /** The short side, metres. */
  depth: number;
  /** Direction of the long side, degrees counter-clockwise from east, in [0, 180). */
  yawDeg: number;
}

export type Xy = [number, number];

/**
 * The polygon of one Open Buildings row: `POLYGON((lon lat, lon lat, ...))`,
 * with the ring closed. Anything else in that column is not a polygon this
 * import knows how to read, and the caller counts it rather than guessing.
 */
export function parseWktPolygon(wkt: string): [number, number][] | undefined {
  const open = wkt.indexOf('((');
  if (!wkt.startsWith('POLYGON') || open < 0) return undefined;
  // The outer ring runs to the first closing bracket, whatever follows it. A
  // building with a courtyard has interior rings after that, sometimes with a
  // space in the separator and sometimes without, and is still one mass here.
  const body = wkt.slice(open + 2);
  const close = body.indexOf(')');
  if (close < 0) return undefined;
  const outer = body.slice(0, close);
  const points: [number, number][] = [];
  for (const pair of outer.split(',')) {
    const trimmed = pair.trim();
    const space = trimmed.indexOf(' ');
    if (space < 0) return undefined;
    const lon = Number.parseFloat(trimmed.slice(0, space));
    const lat = Number.parseFloat(trimmed.slice(space + 1));
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return undefined;
    points.push([lon, lat]);
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (first && last && first[0] === last[0] && first[1] === last[1]) points.pop();
  return points.length >= 3 ? points : undefined;
}

/** Andrew's monotone chain, counter-clockwise, without the repeated last point. */
export function convexHull(points: readonly Xy[]): Xy[] {
  if (points.length < 3) return [...points];
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Xy, a: Xy, b: Xy): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (input: readonly Xy[]): Xy[] => {
    const out: Xy[] = [];
    for (const p of input) {
      while (out.length >= 2 && cross(out[out.length - 2] as Xy, out[out.length - 1] as Xy, p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/**
 * The smallest rectangle that covers a polygon.
 *
 * Every minimum-area rectangle has a side flush with a side of the convex
 * hull, which is the whole of the method: take each hull edge as an axis,
 * measure the polygon's extent along it and across it, and keep the pair that
 * multiplies to the least. The long side is reported as the width and its
 * direction as the yaw, so a box and its quarter turn are the same record and
 * the yaw of a near-square building is still the direction of its longer
 * side rather than a coin toss between two.
 */
export function minAreaRect(points: readonly Xy[]): OrientedBox | undefined {
  const hull = convexHull(points);
  if (hull.length < 3) return undefined;
  let best: OrientedBox | undefined;
  let bestArea = Number.POSITIVE_INFINITY;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i] as Xy;
    const b = hull[(i + 1) % hull.length] as Xy;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-9) continue;
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    let uMin = Number.POSITIVE_INFINITY;
    let uMax = Number.NEGATIVE_INFINITY;
    let vMin = Number.POSITIVE_INFINITY;
    let vMax = Number.NEGATIVE_INFINITY;
    for (const [px, py] of hull) {
      const u = px * ux + py * uy;
      const v = -px * uy + py * ux;
      if (u < uMin) uMin = u;
      if (u > uMax) uMax = u;
      if (v < vMin) vMin = v;
      if (v > vMax) vMax = v;
    }
    const w = uMax - uMin;
    const d = vMax - vMin;
    const area = w * d;
    if (area >= bestArea) continue;
    bestArea = area;
    const cu = (uMin + uMax) / 2;
    const cv = (vMin + vMax) / 2;
    const cx = cu * ux - cv * uy;
    const cy = cu * uy + cv * ux;
    // The long side is the width, whichever of the two axes it fell on.
    const long = w >= d;
    const dirX = long ? ux : -uy;
    const dirY = long ? uy : ux;
    let yawDeg = (Math.atan2(dirY, dirX) * 180) / Math.PI;
    yawDeg = ((yawDeg % 180) + 180) % 180;
    best = { x: cx, y: cy, width: long ? w : d, depth: long ? d : w, yawDeg };
  }
  return best;
}

/** The four corners of a box, counter-clockwise. Used by the tests and by nothing else. */
export function boxCorners({ x, y, width, depth, yawDeg }: OrientedBox): Xy[] {
  const c = Math.cos((yawDeg * Math.PI) / 180);
  const s = Math.sin((yawDeg * Math.PI) / 180);
  const hw = width / 2;
  const hd = depth / 2;
  return ([[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]] as Xy[]).map(([u, v]) => [x + u * c - v * s, y + u * s + v * c] as Xy);
}

/**
 * Degrees to metres on the scene's own tangent plane.
 *
 * This is the projection data/terrain/giza-glo30.json describes, with the
 * same origin and the same two radii of curvature out of the measurement
 * database, because the city has to stand on that terrain and a second
 * projection would put it a few metres off its own ground. No registration
 * is fitted: scripts/footprints.ts fits OSM onto the three surveyed pyramids
 * because those footprints sit among the monuments, and a block of flats four
 * kilometres east neither can nor need be placed to a metre.
 */
export interface Projection {
  lat0: number;
  lon0: number;
  metresPerDegLat: number;
  metresPerDegLon: number;
  project(lon: number, lat: number): Xy;
}

export function tangentPlane(lat0: number, lon0: number, a: number, b: number): Projection {
  const e2 = 1 - (b / a) ** 2;
  const s = Math.sin((lat0 * Math.PI) / 180);
  const w = 1 - e2 * s * s;
  const meridional = (a * (1 - e2)) / w ** 1.5;
  const primeVertical = a / Math.sqrt(w);
  const metresPerDegLat = (meridional * Math.PI) / 180;
  const metresPerDegLon = (primeVertical * Math.cos((lat0 * Math.PI) / 180) * Math.PI) / 180;
  return {
    lat0,
    lon0,
    metresPerDegLat,
    metresPerDegLon,
    project: (lon, lat) => [(lon - lon0) * metresPerDegLon, (lat - lat0) * metresPerDegLat],
  };
}

/** One row of the clip, as the archive gives it. */
export interface CityRow {
  lat: number;
  lon: number;
  area: number;
  confidence: number;
  wkt: string;
}

/**
 * Cut one archive line into the five fields that matter. The first four are
 * unquoted numbers and the geometry is quoted and full of commas, so the
 * commas are found by index and the quotes are stripped by hand.
 */
export function parseRow(line: string): CityRow | undefined {
  const c1 = line.indexOf(',');
  const c2 = line.indexOf(',', c1 + 1);
  const c3 = line.indexOf(',', c2 + 1);
  const c4 = line.indexOf(',', c3 + 1);
  if (c1 < 0 || c2 < 0 || c3 < 0 || c4 < 0) return undefined;
  const lat = Number.parseFloat(line.slice(0, c1));
  const lon = Number.parseFloat(line.slice(c1 + 1, c2));
  const area = Number.parseFloat(line.slice(c2 + 1, c3));
  const confidence = Number.parseFloat(line.slice(c3 + 1, c4));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(area) || !Number.isFinite(confidence)) return undefined;
  const rest = line.slice(c4 + 1);
  const quoted = rest.startsWith('"');
  const end = quoted ? rest.indexOf('"', 1) : rest.indexOf(',');
  const wkt = quoted ? rest.slice(1, end < 0 ? rest.length : end) : rest.slice(0, end < 0 ? rest.length : end);
  return { lat, lon, area, confidence, wkt };
}

/** Whether a row's centroid is inside the box. */
export const inBox = (lat: number, lon: number): boolean =>
  lat >= BBOX[0] && lat <= BBOX[2] && lon >= BBOX[1] && lon <= BBOX[3];

interface Clip {
  /** The kept lines, header first, exactly as the archive wrote them. */
  text: string;
  /** sha256 of the gzipped archive as it came off the wire, or of the cache when it is reused. */
  sha256: string;
  rows: number;
  bytes: number;
}

/** Stream the archive once, keep the rows inside the box, and cache them. */
async function streamClip(): Promise<Clip> {
  let last = '';
  for (const endpoint of FOOTPRINT_ENDPOINTS) {
    try {
      const started = Date.now();
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(3_600_000) });
      if (!response.ok || !response.body) {
        last = `${endpoint}: ${response.status}`;
        console.log(`  ${last}`);
        continue;
      }
      const hash = createHash('sha256');
      let bytes = 0;
      const body = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
      body.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        hash.update(chunk);
      });
      const lines = createInterface({ input: body.pipe(createGunzip()), crlfDelay: Infinity });
      const kept: string[] = [];
      let total = 0;
      for await (const line of lines) {
        if (total++ === 0) continue;
        const c1 = line.indexOf(',');
        const c2 = line.indexOf(',', c1 + 1);
        const lat = +line.slice(0, c1);
        const lon = +line.slice(c1 + 1, c2);
        if (!inBox(lat, lon)) continue;
        kept.push(line);
      }
      const seconds = (Date.now() - started) / 1000;
      console.log(`streamed ${(bytes / 1e6).toFixed(0)} MB gzipped, ${total.toLocaleString()} rows, in ${seconds.toFixed(0)} s`);
      return { text: `${CSV_HEADER}\n${kept.join('\n')}\n`, sha256: hash.digest('hex'), rows: kept.length, bytes };
    } catch (error) {
      last = `${endpoint}: ${String(error)}`;
      console.log(`  ${last}`);
    }
  }
  throw new Error(`no Open Buildings endpoint answered: ${last}`);
}

/** The clip, from the cache when there is one and from the wire when there is not. */
export async function loadClip(refresh: boolean): Promise<{ rows: CityRow[]; sha256: string; archiveBytes: number }> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const sidecar = `${CLIP}.json`;
  let text: string;
  let sha256: string;
  let archiveBytes: number;
  if (!refresh && existsSync(CLIP) && existsSync(sidecar)) {
    text = readFileSync(CLIP, 'utf8');
    const meta = JSON.parse(readFileSync(sidecar, 'utf8')) as { sha256: string; archiveBytes: number };
    sha256 = meta.sha256;
    archiveBytes = meta.archiveBytes;
    console.log(`reusing the clip cached at ${CLIP} (${(statSync(CLIP).size / 1e6).toFixed(0)} MB)`);
  } else {
    const clip = await streamClip();
    text = clip.text;
    sha256 = clip.sha256;
    archiveBytes = clip.bytes;
    writeFileSync(CLIP, text);
    writeFileSync(sidecar, `${JSON.stringify({ url: FOOTPRINT_ENDPOINTS[0], sha256, archiveBytes, rows: clip.rows, bbox: BBOX }, null, 1)}\n`);
  }
  const rows: CityRow[] = [];
  let malformed = 0;
  const lines = text.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] as string;
    if (!line) continue;
    const row = parseRow(line);
    if (row === undefined) malformed += 1;
    else rows.push(row);
  }
  if (malformed > 0) console.log(`  ${malformed} rows could not be read and were dropped`);
  return { rows, sha256, archiveBytes };
}

export async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const refresh = process.argv.includes('--refresh');

  const db = loadDatabase();
  const { values } = resolve(db, PRESET);
  const env = buildEnvironment(values);
  const a = env['earth.radius.equatorial'];
  const b = env['earth.radius.polar'];
  if (a === undefined || b === undefined) throw new Error('the ellipsoid is not in the database');
  const terrain = loadTerrain();
  const projection = tangentPlane(terrain.header.origin.latitude, terrain.header.origin.longitude, a, b);

  const { rows, sha256, archiveBytes } = await loadClip(refresh);
  console.log(`${rows.length.toLocaleString()} buildings inside ${BBOX.join(', ')}`);
  console.log(`  archive sha256 ${sha256}, ${(archiveBytes / 1e6).toFixed(0)} MB`);

  let belowFloor = 0;
  let unreadable = 0;
  let degenerate = 0;
  const boxes: OrientedBox[] = [];
  let roof = 0;
  for (const row of rows) {
    if (row.confidence < CONFIDENCE_FLOOR) {
      belowFloor += 1;
      continue;
    }
    const ring = parseWktPolygon(row.wkt);
    if (ring === undefined) {
      unreadable += 1;
      continue;
    }
    const box = minAreaRect(ring.map(([lon, lat]) => projection.project(lon, lat)));
    if (box === undefined || box.depth < 1e-6) {
      degenerate += 1;
      continue;
    }
    boxes.push(box);
    roof += row.area;
  }
  console.log(
    `${boxes.length.toLocaleString()} boxes at confidence ${CONFIDENCE_FLOOR} and above ` +
      `(${belowFloor.toLocaleString()} below the floor, ${unreadable} outlines nothing could be read from, ${degenerate} with no rectangle)`,
  );
  const mean = (pick: (box: OrientedBox) => number): number => boxes.reduce((sum, box) => sum + pick(box), 0) / boxes.length;
  console.log(
    `  mean box ${mean((o) => o.width).toFixed(1)} by ${mean((o) => o.depth).toFixed(1)} m, ` +
      `${(roof / 1e6).toFixed(1)} km2 of roof, mean footprint ${(roof / boxes.length).toFixed(0)} m2`,
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === pathToFileURL(fileURLToPath(import.meta.url)).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
