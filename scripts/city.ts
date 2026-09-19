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
 *
 * The raster is four GeoTIFFs of 12.5 km square, 3.9 GB between them, and
 * this reads about an eighth of that: the tiles serve range requests, they
 * are tiled 512 by 512 inside, and only the blocks a building falls in are
 * fetched. Reading them needs no library. They are all one profile, classic
 * little-endian TIFF, deflate, the floating-point predictor, three separate
 * float32 planes, and the reader below parses that profile and refuses
 * anything else out loud, which is a smaller thing to own than a general
 * GeoTIFF reader is to depend on. That the decode is right is not a matter of
 * opinion: every height that comes out is an exact multiple of the raster's
 * own half metre, which a mis-shuffled byte plane could not manage.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { createGunzip, inflateSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DATA_DIR, REPO_ROOT, loadDatabase, loadTerrain, resolve } from '@seked/data';
import { buildEnvironment } from '@seked/geometry';

const OUT_DIR = join(DATA_DIR, 'footprints');
/** Caches, not data: gitignored, and rebuilt from the URLs below at any time. */
const CACHE_DIR = join(REPO_ROOT, 'build', 'city');
const CLIP = join(CACHE_DIR, 'open-buildings-v3-145-clip.csv');
const FOOTPRINT_SOURCE = 'open-buildings-v3';
const HEIGHT_SOURCE = 'open-buildings-25d-temporal';
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
  /** The way back, as a longitude and a latitude. */
  unproject(x: number, y: number): [number, number];
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
    unproject: (x, y) => [lon0 + x / metresPerDegLon, lat0 + y / metresPerDegLat],
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

// --- The height raster --------------------------------------------------

/**
 * Open Buildings 2.5D Temporal: one GeoTIFF per 12.5 km square per year, in
 * the UTM zone the square falls in, with three bands of which two matter
 * here. The bucket is public and listable, so the year, the zone's manifests
 * and the tiles the box needs are all discovered rather than named: a tile
 * picked by its filename would be a guess that happened to work.
 */
const TEMPORAL_BUCKET = 'open-buildings-temporal-data';
const HEIGHT_BAND = 'building_height';
const PRESENCE_BAND = 'building_presence';

/** Stated by the dataset, in metres. Not measured here, and not ours to soften. */
export const HEIGHT_MAE = 1.5;
/** Stated by the dataset: the raster does not go above this, whatever stands there. */
export const HEIGHT_CAP = 100;
/**
 * The gate the dataset asks for, and a look choice in where it is set. The
 * presence band is a probability, and the outline this height is being given
 * to already passed Open Buildings v3's own confidence, so this is a second
 * opinion from a different year's imagery rather than the only one. Half is
 * the usual reading of a probability band and is what this uses.
 */
export const PRESENCE_GATE = 0.5;

/** One tile of the raster, as its manifest and its own header describe it. */
export interface RasterTile {
  url: string;
  /** Easting and northing of the tile's north-west corner, metres in its UTM zone. */
  x0: number;
  y0: number;
  /** Metres per pixel. */
  scale: number;
  width: number;
  height: number;
}

/**
 * Easting and northing in a UTM zone, from a latitude and longitude on
 * WGS84. The transverse Mercator series to the sixth power of the distance
 * from the central meridian, which is good to a millimetre inside a zone and
 * is the arithmetic every implementation of UTM uses. The ellipsoid is passed
 * in so no constant of geodesy is typed here either.
 */
export function toUtm(lat: number, lon: number, zone: number, a: number, b: number): Xy {
  const e2 = 1 - (b / a) ** 2;
  const ep2 = e2 / (1 - e2);
  const k0 = 0.9996;
  const latR = (lat * Math.PI) / 180;
  const lonR = (lon * Math.PI) / 180;
  const lon0 = (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180;
  const n = a / Math.sqrt(1 - e2 * Math.sin(latR) ** 2);
  const t = Math.tan(latR) ** 2;
  const c = ep2 * Math.cos(latR) ** 2;
  const arc = Math.cos(latR) * (lonR - lon0);
  const m =
    a *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * latR -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * latR) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * latR) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * latR));
  const east =
    k0 * n * (arc + ((1 - t + c) * arc ** 3) / 6 + ((5 - 18 * t + t ** 2 + 72 * c - 58 * ep2) * arc ** 5) / 120) + 500000;
  const north =
    k0 *
    (m +
      n *
        Math.tan(latR) *
        ((arc ** 2) / 2 +
          ((5 - t + 9 * c + 4 * c ** 2) * arc ** 4) / 24 +
          ((61 - 58 * t + t ** 2 + 600 * c - 330 * ep2) * arc ** 6) / 720));
  return [east, north];
}

/** The zone a longitude falls in, and the EPSG code of that zone north of the equator. */
export const utmZone = (lon: number): number => Math.floor((lon + 180) / 6) + 1;
export const utmEpsg = (zone: number): number => 32600 + zone;

/** Every object under a prefix in a public bucket, through the JSON API. */
async function listBucket(bucket: string, prefix: string): Promise<string[]> {
  const names: string[] = [];
  let token: string | undefined;
  do {
    const url =
      `https://storage.googleapis.com/storage/v1/b/${bucket}/o?prefix=${encodeURIComponent(prefix)}&maxResults=1000` +
      (token ? `&pageToken=${encodeURIComponent(token)}` : '');
    const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
    if (!response.ok) throw new Error(`listing ${bucket}/${prefix}: ${response.status}`);
    const page = (await response.json()) as { items?: { name: string }[]; nextPageToken?: string };
    for (const item of page.items ?? []) names.push(item.name);
    token = page.nextPageToken;
  } while (token);
  return names;
}

/** What the store says about one object: its size and the md5 it holds for it. */
async function objectMetadata(bucket: string, name: string): Promise<{ size: number; md5: string; generation: string }> {
  const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(name)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!response.ok) throw new Error(`metadata for ${name}: ${response.status}`);
  const meta = (await response.json()) as { size: string; md5Hash: string; generation: string };
  return { size: Number(meta.size), md5: meta.md5Hash, generation: meta.generation };
}

/** A range of one remote object, with the retry a 1 GB read over a long import needs. */
async function fetchRange(url: string, start: number, end: number): Promise<Buffer> {
  let last = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, { headers: { range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(300_000) });
      if (response.status === 206 || response.status === 200) return Buffer.from(await response.arrayBuffer());
      last = `${response.status}`;
    } catch (error) {
      last = String(error);
    }
    await new Promise((done) => setTimeout(done, 500 * 2 ** attempt));
  }
  throw new Error(`${url}: bytes ${start}-${end} would not come: ${last}`);
}

const TIFF_TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8 };

interface TiffTag {
  type: number;
  count: number;
  /** Either the value itself, for four bytes or fewer, or where in the file it is. */
  inline: Buffer;
  offset: number;
  remote: boolean;
}

/**
 * As much of a GeoTIFF reader as this import needs, and it says so when the
 * file is not the shape it expects.
 *
 * The 2.5D tiles are all one profile: classic little-endian TIFF, 512 by 512
 * tiles, deflate, the floating-point predictor, three separate float32
 * planes. So rather than take a dependency on a general reader, this parses
 * the one directory it needs and refuses anything else loudly. Every number
 * it needs about the ground, the corner, the pixel size and which plane is
 * which band, comes out of the file, not out of the manifest and not out of
 * this comment.
 */
class RasterReader {
  private constructor(
    readonly url: string,
    readonly width: number,
    readonly height: number,
    readonly tileWidth: number,
    readonly tileHeight: number,
    readonly x0: number,
    readonly y0: number,
    readonly scale: number,
    readonly bands: string[],
    private readonly tileOffsets: number[],
    private readonly tileByteCounts: number[],
  ) {}

  get tilesAcross(): number {
    return Math.ceil(this.width / this.tileWidth);
  }

  get tilesDown(): number {
    return Math.ceil(this.height / this.tileHeight);
  }

  /** Where a band's plane starts in the tile tables. */
  planeOf(band: string): number {
    const plane = this.bands.indexOf(band);
    if (plane < 0) throw new Error(`${this.url}: no band called ${band}, only ${this.bands.join(', ')}`);
    return plane;
  }

  bytesOf(band: string, block: number): number {
    return this.tileByteCounts[this.planeOf(band) * this.tilesAcross * this.tilesDown + block] as number;
  }

  /** One 512 by 512 block of one band, inflated and un-predicted. */
  async block(band: string, block: number): Promise<Float32Array> {
    const index = this.planeOf(band) * this.tilesAcross * this.tilesDown + block;
    const start = this.tileOffsets[index] as number;
    const bytes = this.tileByteCounts[index] as number;
    const raw = await fetchRange(this.url, start, start + bytes - 1);
    return undoFloatPredictor(inflateSync(raw), this.tileWidth, this.tileHeight);
  }

  static async open(url: string): Promise<RasterReader> {
    // The directory, its out-of-line values and both tile tables all sit in
    // the first few hundred kilobytes of these files, so one read has them.
    const head = await fetchRange(url, 0, 1_048_575);
    if (head.length < 8 || head.readUInt16LE(0) !== 0x4949 || head.readUInt16LE(2) !== 42) {
      throw new Error(`${url}: not a little-endian classic TIFF`);
    }
    const at = head.readUInt32LE(4);
    const count = head.readUInt16LE(at);
    const tags = new Map<number, TiffTag>();
    for (let i = 0; i < count; i++) {
      const entry = at + 2 + i * 12;
      const tag = head.readUInt16LE(entry);
      const type = head.readUInt16LE(entry + 2);
      const n = head.readUInt32LE(entry + 4);
      const size = (TIFF_TYPE_SIZE[type] ?? 1) * n;
      tags.set(tag, {
        type,
        count: n,
        inline: head.subarray(entry + 8, entry + 12),
        offset: size > 4 ? head.readUInt32LE(entry + 8) : entry + 8,
        remote: size > 4,
      });
    }
    const bytesOf = (tag: TiffTag): Buffer => {
      const size = (TIFF_TYPE_SIZE[tag.type] ?? 1) * tag.count;
      if (tag.offset + size > head.length) throw new Error(`${url}: tag value at ${tag.offset} is beyond the first megabyte`);
      return head.subarray(tag.offset, tag.offset + size);
    };
    const numbers = (id: number): number[] => {
      const tag = tags.get(id);
      if (!tag) throw new Error(`${url}: tag ${id} is missing`);
      const raw = bytesOf(tag);
      const out: number[] = [];
      for (let i = 0; i < tag.count; i++) {
        if (tag.type === 3) out.push(raw.readUInt16LE(i * 2));
        else if (tag.type === 4) out.push(raw.readUInt32LE(i * 4));
        else if (tag.type === 12) out.push(raw.readDoubleLE(i * 8));
        else throw new Error(`${url}: tag ${id} has type ${tag.type}, which this reader does not read`);
      }
      return out;
    };
    const one = (id: number): number => numbers(id)[0] as number;
    const expect = (what: string, got: number | number[], want: number | number[]): void => {
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        throw new Error(`${url}: ${what} is ${JSON.stringify(got)}, and this reader only reads ${JSON.stringify(want)}`);
      }
    };
    expect('compression', one(259), 8);
    expect('the predictor', one(317), 3);
    expect('the planar configuration', one(284), 2);
    expect('bits per sample', numbers(258), [32, 32, 32]);
    expect('the sample format', numbers(339), [3, 3, 3]);
    const pixelScale = numbers(33550);
    const tiePoint = numbers(33922);
    if (pixelScale[0] !== pixelScale[1]) throw new Error(`${url}: pixels are ${pixelScale[0]} by ${pixelScale[1]} m and this reader wants them square`);
    if (tiePoint[0] !== 0 || tiePoint[1] !== 0) throw new Error(`${url}: the tie point is not the north-west corner`);
    // Which plane is which band is written in the file's own metadata, so a
    // dataset that reorders its bands cannot quietly become wrong here.
    const metadata = bytesOf(tags.get(42112) as TiffTag).toString('utf8');
    const bands: string[] = [];
    for (const match of metadata.matchAll(/sample="(\d+)"[^>]*>([^<]+)</g)) {
      bands[Number(match[1])] = (match[2] as string).trim();
    }
    if (bands.length !== 3 || bands.some((b) => !b)) throw new Error(`${url}: the band names are ${JSON.stringify(bands)}`);
    return new RasterReader(
      url,
      one(256),
      one(257),
      one(322),
      one(323),
      tiePoint[3] as number,
      tiePoint[4] as number,
      pixelScale[0] as number,
      bands,
      numbers(324),
      numbers(325),
    );
  }
}

const PLATFORM_IS_LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

/**
 * Undo TIFF predictor 3, which is what makes these tiles compress at all.
 *
 * The encoder splits each row of floats into byte planes, most significant
 * first, and stores the difference between each byte and the one before it,
 * so a row of similar heights becomes a row of mostly zeroes. Reading it back
 * is the two steps in the other order: add along the row, then take one byte
 * from each plane to rebuild each float.
 */
export function undoFloatPredictor(bytes: Buffer, width: number, height: number): Float32Array {
  if (!PLATFORM_IS_LITTLE_ENDIAN) throw new Error('this reader rebuilds float32s in place and wants a little-endian machine');
  const rowBytes = width * 4;
  if (bytes.length !== rowBytes * height) throw new Error(`a ${width} by ${height} block of float32 is ${rowBytes * height} bytes, not ${bytes.length}`);
  const out = new Uint8Array(bytes.length);
  for (let row = 0; row < height; row++) {
    const s = row * rowBytes;
    for (let i = s + 1; i < s + rowBytes; i++) bytes[i] = ((bytes[i] as number) + (bytes[i - 1] as number)) & 0xff;
    for (let j = 0; j < width; j++) {
      const b = s + 4 * j;
      out[b] = bytes[s + 3 * width + j] as number;
      out[b + 1] = bytes[s + 2 * width + j] as number;
      out[b + 2] = bytes[s + width + j] as number;
      out[b + 3] = bytes[s + j] as number;
    }
  }
  return new Float32Array(out.buffer);
}

/** The tiles of the newest year whose extent meets the box, from the manifests of the box's own zone. */
async function findRasterTiles(box: { minX: number; maxX: number; minY: number; maxY: number }, epsg: number): Promise<{ tiles: RasterTile[]; year: number; manifests: string[] }> {
  const all = await listBucket(TEMPORAL_BUCKET, 'v1/manifests/');
  const mine = all.filter((name) => name.includes(`_EPSG_${epsg}_`));
  if (mine.length === 0) throw new Error(`no manifest in ${TEMPORAL_BUCKET} covers EPSG ${epsg}`);
  const yearOf = (name: string): number => Number((/_(\d{4})_\d{2}_\d{2}\.json$/.exec(name) ?? ['', '0'])[1]);
  const year = Math.max(...mine.map(yearOf));
  const manifests = mine.filter((name) => yearOf(name) === year).sort();
  const tiles: RasterTile[] = [];
  for (const manifest of manifests) {
    const url = `https://storage.googleapis.com/${TEMPORAL_BUCKET}/${manifest}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(300_000) });
    if (!response.ok) throw new Error(`${manifest}: ${response.status}`);
    const parsed = (await response.json()) as {
      uriPrefix: string;
      tilesets: { sources: { uris: string[]; affineTransform: { translateX: number; translateY: number; scaleX: number; scaleY: number }; dimensions: { width: number; height: number } }[] }[];
    };
    const prefix = parsed.uriPrefix.replace(/^gs:\/\//, 'https://storage.googleapis.com/');
    for (const tileset of parsed.tilesets) {
      for (const source of tileset.sources) {
        const { translateX, translateY, scaleX, scaleY } = source.affineTransform;
        const { width, height } = source.dimensions;
        const xs = [translateX, translateX + scaleX * width];
        const ys = [translateY, translateY + scaleY * height];
        const meets =
          box.maxX >= Math.min(...xs) && box.minX <= Math.max(...xs) && box.maxY >= Math.min(...ys) && box.minY <= Math.max(...ys);
        if (!meets) continue;
        tiles.push({ url: `${prefix}${source.uris[0]}`, x0: translateX, y0: translateY, scale: scaleX, width, height });
      }
    }
  }
  return { tiles, year, manifests };
}

/** A building's sample points: the centre of its roof and eight more spread over it. */
export function samplePoints({ x, y, width, depth, yawDeg }: OrientedBox): Xy[] {
  const c = Math.cos((yawDeg * Math.PI) / 180);
  const s = Math.sin((yawDeg * Math.PI) / 180);
  const points: Xy[] = [];
  for (const u of [-width / 3, 0, width / 3]) {
    for (const v of [-depth / 3, 0, depth / 3]) points.push([x + u * c - v * s, y + u * s + v * c]);
  }
  return points;
}

/** The median of a handful of numbers, which for an even count is the lower middle. */
export function median(values: number[]): number {
  const sorted = [...values].sort((p, q) => p - q);
  return sorted[(sorted.length - 1) >> 1] as number;
}

/** What the raster pass found, and everything about it the header has to say. */
export interface MeasuredHeights {
  /** One per box, in the same order, NaN where the raster would not give one. */
  heights: Float32Array;
  year: number;
  epsg: number;
  manifests: string[];
  tiles: { url: string; bytes: number; md5: string }[];
  /** Blocks of the raster read, of how many the tiles hold, and what they cost. */
  blocks: number;
  blocksInTiles: number;
  bytesRead: number;
  /** Buildings whose sample points all fell below the presence gate. */
  ungated: number;
  /** The median of the best presence those buildings could show, which says how near the gate they were. */
  presenceOfUngated: number;
  /** How many of them the height band had something above zero for anyway. */
  ungatedWithSomeHeight: number;
  /** Buildings with at least one sample point outside every tile of the year. */
  offRaster: number;
  atCap: number;
  seconds: number;
}

const HEIGHTS_CACHE = join(CACHE_DIR, 'heights.f32');
const HEIGHTS_SIDECAR = join(CACHE_DIR, 'heights.json');
/** Nine points on each roof: the centre and eight more at a third of the way out. */
const SAMPLES_PER_BOX = 9;

/**
 * Give every box the height the raster measured under it.
 *
 * Nine points are taken on each roof rather than one, because the product is
 * distributed at 50 cm but is only good to about 4 m, so a single pixel at a
 * building's centroid can be a stairwell, a gap between two blocks, or the
 * centroid of an L-shaped building sitting in its own notch. The median of
 * the points that pass the presence gate is the height, and a building none
 * of whose points pass has no height at all rather than a plausible one.
 *
 * Only the blocks the buildings actually fall in are read, by range request
 * into each tile's own tiling. The four tiles are 4.7 GB between them and
 * this reads a fraction of that; the alternative, downloading them, would be
 * an hour of somebody's evening for bytes that are mostly empty desert.
 */
async function heightsOf(
  boxes: readonly OrientedBox[],
  projection: Projection,
  a: number,
  b: number,
  refresh: boolean,
  clipSha: string,
): Promise<MeasuredHeights> {
  const key = { clipSha, boxes: boxes.length, gate: PRESENCE_GATE, samples: SAMPLES_PER_BOX, floor: CONFIDENCE_FLOOR };
  if (!refresh && existsSync(HEIGHTS_CACHE) && existsSync(HEIGHTS_SIDECAR)) {
    const cached = JSON.parse(readFileSync(HEIGHTS_SIDECAR, 'utf8')) as MeasuredHeights & { key: typeof key };
    const bytes = readFileSync(HEIGHTS_CACHE);
    if (JSON.stringify(cached.key) === JSON.stringify(key) && bytes.byteLength === boxes.length * 4) {
      const heights = new Float32Array(boxes.length);
      new Uint8Array(heights.buffer).set(bytes);
      console.log(`reusing the heights cached at ${HEIGHTS_CACHE}`);
      return { ...cached, heights };
    }
  }

  const started = Date.now();
  const zone = utmZone((BBOX[1] + BBOX[3]) / 2);
  const epsg = utmEpsg(zone);
  const corners = [
    [BBOX[0], BBOX[1]],
    [BBOX[0], BBOX[3]],
    [BBOX[2], BBOX[1]],
    [BBOX[2], BBOX[3]],
  ].map(([lat, lon]) => toUtm(lat as number, lon as number, zone, a, b));
  const extent = {
    minX: Math.min(...corners.map((c) => c[0])),
    maxX: Math.max(...corners.map((c) => c[0])),
    minY: Math.min(...corners.map((c) => c[1])),
    maxY: Math.max(...corners.map((c) => c[1])),
  };
  console.log(`the box is UTM ${zone}N (EPSG ${epsg}) ${extent.minX.toFixed(0)} to ${extent.maxX.toFixed(0)} east, ${extent.minY.toFixed(0)} to ${extent.maxY.toFixed(0)} north`);
  const { tiles, year, manifests } = await findRasterTiles(extent, epsg);
  console.log(`${manifests.length} manifests for ${year} name ${tiles.length} tiles that meet it`);

  const readers = await Promise.all(tiles.map((tile) => RasterReader.open(tile.url)));
  const described: { url: string; bytes: number; md5: string }[] = [];
  for (let i = 0; i < readers.length; i++) {
    const reader = readers[i] as RasterReader;
    const tile = tiles[i] as RasterTile;
    if (reader.x0 !== tile.x0 || reader.y0 !== tile.y0 || reader.scale !== tile.scale) {
      throw new Error(`${tile.url}: the manifest puts its corner at ${tile.x0}, ${tile.y0} and the file at ${reader.x0}, ${reader.y0}`);
    }
    const name = new URL(reader.url).pathname.split('/').slice(2).join('/');
    const meta = await objectMetadata(TEMPORAL_BUCKET, name);
    described.push({ url: reader.url, bytes: meta.size, md5: meta.md5 });
    console.log(
      `  ${name}: corner ${reader.x0}, ${reader.y0}, ${reader.width} by ${reader.height} px at ${reader.scale} m, ` +
        `${(meta.size / 1e6).toFixed(0)} MB, bands ${reader.bands.join(', ')}`,
    );
  }

  // Every sample point, sorted into the block of the raster it falls in.
  const stride = Math.max(...readers.map((r) => r.tilesAcross * r.tilesDown));
  const groups = new Map<number, number[]>();
  const samples = new Float32Array(boxes.length * SAMPLES_PER_BOX).fill(Number.NaN);
  // What the raster said before the gate, kept so the gate can be defended
  // with numbers rather than with an opinion about probabilities.
  const ungatedSamples = new Float32Array(boxes.length * SAMPLES_PER_BOX).fill(Number.NaN);
  const bestPresence = new Float32Array(boxes.length);
  const offRasterBox = new Uint8Array(boxes.length);
  for (let i = 0; i < boxes.length; i++) {
    const points = samplePoints(boxes[i] as OrientedBox);
    for (let j = 0; j < points.length; j++) {
      const [x, y] = points[j] as Xy;
      const [lon, lat] = projection.unproject(x, y);
      const [east, north] = toUtm(lat, lon, zone, a, b);
      let placed = false;
      for (let t = 0; t < readers.length; t++) {
        const reader = readers[t] as RasterReader;
        const px = Math.floor((east - reader.x0) / reader.scale);
        const py = Math.floor((reader.y0 - north) / reader.scale);
        if (px < 0 || py < 0 || px >= reader.width || py >= reader.height) continue;
        const block = Math.floor(py / reader.tileHeight) * reader.tilesAcross + Math.floor(px / reader.tileWidth);
        const inside = (py % reader.tileHeight) * reader.tileWidth + (px % reader.tileWidth);
        const id = t * stride + block;
        const pairs = groups.get(id);
        if (pairs) pairs.push(i * SAMPLES_PER_BOX + j, inside);
        else groups.set(id, [i * SAMPLES_PER_BOX + j, inside]);
        placed = true;
        break;
      }
      if (!placed) offRasterBox[i] = 1;
    }
  }
  const blockIds = [...groups.keys()].sort((p, q) => p - q);
  const blocksInTiles = readers.reduce((sum, r) => sum + r.tilesAcross * r.tilesDown, 0);
  let bytesRead = 0;
  for (const id of blockIds) {
    const reader = readers[Math.floor(id / stride)] as RasterReader;
    const block = id % stride;
    bytesRead += reader.bytesOf(HEIGHT_BAND, block) + reader.bytesOf(PRESENCE_BAND, block);
  }
  console.log(
    `${blockIds.length.toLocaleString()} of the tiles' ${blocksInTiles.toLocaleString()} blocks hold a building: ` +
      `${(bytesRead / 1e6).toFixed(0)} MB of the ${(described.reduce((s, t) => s + t.bytes, 0) / 1e6).toFixed(0)} MB the four tiles weigh`,
  );

  let finished = 0;
  let cursor = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const at = cursor++;
      if (at >= blockIds.length) return;
      const id = blockIds[at] as number;
      const reader = readers[Math.floor(id / stride)] as RasterReader;
      const block = id % stride;
      const [height, presence] = await Promise.all([reader.block(HEIGHT_BAND, block), reader.block(PRESENCE_BAND, block)]);
      const pairs = groups.get(id) as number[];
      for (let k = 0; k < pairs.length; k += 2) {
        const slot = pairs[k] as number;
        const pixel = pairs[k + 1] as number;
        const seen = presence[pixel] as number;
        ungatedSamples[slot] = height[pixel] as number;
        const box = Math.floor(slot / SAMPLES_PER_BOX);
        if (seen > (bestPresence[box] as number)) bestPresence[box] = seen;
        if (seen >= PRESENCE_GATE) samples[slot] = height[pixel] as number;
      }
      groups.delete(id);
      finished += 1;
      if (finished % 500 === 0) console.log(`  ${finished.toLocaleString()} of ${blockIds.length.toLocaleString()} blocks read`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));

  const heights = new Float32Array(boxes.length);
  let ungated = 0;
  let atCap = 0;
  let offRaster = 0;
  const missedPresence: number[] = [];
  let missedWithSomeHeight = 0;
  const seen: number[] = [];
  for (let i = 0; i < boxes.length; i++) {
    seen.length = 0;
    for (let j = 0; j < SAMPLES_PER_BOX; j++) {
      const value = samples[i * SAMPLES_PER_BOX + j] as number;
      if (Number.isFinite(value) && value > 0) seen.push(value);
    }
    if (offRasterBox[i] === 1) offRaster += 1;
    if (seen.length === 0) {
      heights[i] = Number.NaN;
      ungated += 1;
      missedPresence.push(bestPresence[i] as number);
      for (let j = 0; j < SAMPLES_PER_BOX; j++) {
        if (((ungatedSamples[i * SAMPLES_PER_BOX + j] as number) || 0) > 0) {
          missedWithSomeHeight += 1;
          break;
        }
      }
      continue;
    }
    const value = Math.min(median(seen), HEIGHT_CAP);
    if (value >= HEIGHT_CAP) atCap += 1;
    heights[i] = value;
  }
  const presenceOfMissed = median(missedPresence);
  console.log(
    `of the ${ungated.toLocaleString()} the gate turned away, the median best presence was ${presenceOfMissed.toFixed(2)} ` +
      `against a gate of ${PRESENCE_GATE}, and ${missedWithSomeHeight.toLocaleString()} had a height above zero somewhere under them`,
  );

  const measured: MeasuredHeights = {
    heights,
    year,
    epsg,
    manifests,
    tiles: described,
    blocks: blockIds.length,
    blocksInTiles,
    bytesRead,
    ungated,
    presenceOfUngated: Math.round(presenceOfMissed * 100) / 100,
    ungatedWithSomeHeight: missedWithSomeHeight,
    offRaster,
    atCap,
    seconds: Math.round((Date.now() - started) / 1000),
  };
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(HEIGHTS_CACHE, Buffer.from(heights.buffer, heights.byteOffset, heights.byteLength));
  const { heights: _dropped, ...rest } = measured;
  writeFileSync(HEIGHTS_SIDECAR, `${JSON.stringify({ key, ...rest }, null, 1)}\n`);
  return measured;
}

/**
 * What to draw a building at when the raster would not measure it.
 *
 * This is a look choice and not a measurement, so it is one number, said out
 * loud in the header, and every record that carries it is flagged as carrying
 * it. The number is taken from the data rather than chosen: the buildings the
 * raster misses are small, about a third of the footprint of the ones it
 * catches, and the number is the median height it measured for buildings of
 * their size. The alternative was to leave them out, and that would thin the
 * edge of the city exactly where the low sheds and yards are, which is the
 * part a reader sees from the plateau.
 */
export function fillHeight(
  boxes: readonly OrientedBox[],
  areas: readonly number[],
  heights: Float32Array,
): { height: number; medianMissingArea: number; medianMeasuredArea: number } {
  const missing: number[] = [];
  const caught: number[] = [];
  for (let i = 0; i < boxes.length; i++) (Number.isFinite(heights[i] as number) ? caught : missing).push(areas[i] as number);
  const medianMissingArea = median(missing);
  const small: number[] = [];
  for (let i = 0; i < boxes.length; i++) {
    const height = heights[i] as number;
    if (Number.isFinite(height) && (areas[i] as number) <= medianMissingArea) small.push(height);
  }
  return { height: median(small), medianMissingArea, medianMeasuredArea: median(caught) };
}

// --- The file -----------------------------------------------------------

/** How far the boxes reach one way, without spreading a quarter of a million arguments over the stack. */
function reach(boxes: readonly OrientedBox[], pick: (box: OrientedBox) => number, keep: (a: number, b: number) => number): number {
  let best = pick(boxes[0] as OrientedBox);
  for (const box of boxes) best = keep(best, pick(box));
  return best;
}

const OUT_BIN = join(OUT_DIR, 'city.bin');
const OUT_JSON = join(OUT_DIR, 'city.json');

/**
 * One record per building, in this order, little-endian float32. Seven
 * numbers rather than an outline: where the box is, how big it is, which way
 * it faces, how tall it is, and whether that height was measured or filled.
 */
export const CITY_RECORD = ['x', 'y', 'width', 'depth', 'yawDeg', 'height', 'measured'] as const;
export const CITY_STRIDE = CITY_RECORD.length * 4;

/**
 * The side of the cell the records are sorted into, metres. A kilometre puts
 * a few thousand buildings in each, which is a sensible thing to draw or to
 * cull as one, and leaves about a hundred and fifty cells to list.
 */
export const CITY_CELL = 1000;

/** Where one cell's records start and how many there are. */
export interface CityCell {
  x: number;
  y: number;
  from: number;
  count: number;
}

/**
 * Pack the boxes into the flat records, sorted by cell.
 *
 * The order is not an accident and the header says what it is: south to
 * north by kilometre, west to east within that, and by easting inside a
 * cell. So a reader that wants the near half of the city, or wants to cull
 * the far half in one go, can take a run of records rather than sort a
 * quarter of a million of them itself. Two runs over the same input write
 * the same bytes, which is what makes the file worth committing.
 */
export function cityRecords(
  boxes: readonly OrientedBox[],
  heights: Float32Array,
  fill: number,
): { data: Float32Array; cells: CityCell[] } {
  const cellX = (box: OrientedBox): number => Math.floor(box.x / CITY_CELL);
  const cellY = (box: OrientedBox): number => Math.floor(box.y / CITY_CELL);
  const order = boxes.map((_, i) => i).sort((p, q) => {
    const a = boxes[p] as OrientedBox;
    const b = boxes[q] as OrientedBox;
    return cellY(a) - cellY(b) || cellX(a) - cellX(b) || a.x - b.x || a.y - b.y || p - q;
  });
  const data = new Float32Array(boxes.length * CITY_RECORD.length);
  const cells: CityCell[] = [];
  for (let n = 0; n < order.length; n++) {
    const index = order[n] as number;
    const box = boxes[index] as OrientedBox;
    const height = heights[index] as number;
    const measured = Number.isFinite(height);
    const at = n * CITY_RECORD.length;
    data[at] = box.x;
    data[at + 1] = box.y;
    data[at + 2] = box.width;
    data[at + 3] = box.depth;
    data[at + 4] = box.yawDeg;
    data[at + 5] = measured ? height : fill;
    data[at + 6] = measured ? 1 : 0;
    const x = cellX(box) * CITY_CELL;
    const y = cellY(box) * CITY_CELL;
    const last = cells[cells.length - 1];
    if (last && last.x === x && last.y === y) last.count += 1;
    else cells.push({ x, y, from: n, count: 1 });
  }
  return { data, cells };
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
  const areas: number[] = [];
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
    areas.push(row.area);
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

  const measured = await heightsOf(boxes, projection, a, b, refresh, sha256);
  const withHeight = [...measured.heights].filter((h) => Number.isFinite(h));
  withHeight.sort((p, q) => p - q);
  console.log(
    `${withHeight.length.toLocaleString()} buildings got a height from ${HEIGHT_BAND} ${measured.year}, ` +
      `${(boxes.length - withHeight.length).toLocaleString()} did not`,
  );
  console.log(
    `  median ${(withHeight[withHeight.length >> 1] as number).toFixed(1)} m, ` +
      `p90 ${(withHeight[Math.floor(withHeight.length * 0.9)] as number).toFixed(1)} m, ` +
      `tallest ${(withHeight[withHeight.length - 1] as number).toFixed(1)} m, ` +
      `${measured.atCap.toLocaleString()} at the ${HEIGHT_CAP} m cap`,
  );

  const fill = fillHeight(boxes, areas, measured.heights);
  console.log(
    `  the ${measured.ungated.toLocaleString()} without one are small: ${fill.medianMissingArea.toFixed(0)} m2 against ` +
      `${fill.medianMeasuredArea.toFixed(0)} m2, and are drawn at ${fill.height.toFixed(1)} m, ` +
      'the median height the raster measured for buildings as small as they are',
  );

  const { data, cells } = cityRecords(boxes, measured.heights, fill.height);
  const binary = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const round = (value: number, places = 2): number => Math.round(value * 10 ** places) / 10 ** places;
  const header = {
    context: true,
    note:
      'The modern city behind the plateau, drawn as context and never as evidence: nothing in it carries an ' +
      'evidence tier and no claim may cite it. What is stored is the best-fit box of each imported outline and ' +
      'not the outline itself, so a record is where a building is, how big it is, which way it faces and how ' +
      'tall it is, and nothing about its shape is a measurement of that building.',
    site: terrain.header.site,
    script: 'scripts/city.ts',
    sources: [FOOTPRINT_SOURCE, HEIGHT_SOURCE],
    attribution:
      'Outlines: Open Buildings, Google Research (CC BY 4.0 or ODbL). Heights: Open Buildings 2.5D Temporal, ' +
      'Google Research (CC BY 4.0 or ODbL). Clipped, reduced to boxes and sampled by scripts/city.ts.',
    preset: PRESET,
    origin: terrain.header.origin,
    frame: terrain.header.frame,
    horizontalDatum: terrain.header.horizontalDatum,
    projection: terrain.header.projection,
    registration:
      "None. The city is projected on the terrain's own tangent plane, from the same origin, so it stands on " +
      'the ground the scene draws. scripts/footprints.ts fits OSM onto the three surveyed pyramids because ' +
      'those footprints lie among the monuments; a block of flats four kilometres east neither can nor need be ' +
      'placed to a metre.',
    bbox: { south: BBOX[0], west: BBOX[1], north: BBOX[2], east: BBOX[3] },
    extent: {
      minX: round(reach(boxes, (box) => box.x, Math.min)),
      maxX: round(reach(boxes, (box) => box.x, Math.max)),
      minY: round(reach(boxes, (box) => box.y, Math.min)),
      maxY: round(reach(boxes, (box) => box.y, Math.max)),
    },
    outlines: {
      source: FOOTPRINT_SOURCE,
      url: FOOTPRINT_ENDPOINTS[0],
      sha256,
      bytes: archiveBytes,
      rowsInArchive: 13_308_407,
      inBox: rows.length,
      confidenceFloor: CONFIDENCE_FLOOR,
      confidenceNote:
        'A look choice: below about 0.7 the detections in this box are mostly field walls, canal banks and ' +
        'shadow. It is the floor Open Buildings itself suggests as a starting point.',
      belowFloor,
      unreadable,
      noRectangle: degenerate,
      kept: boxes.length,
      roofAreaM2: Math.round(roof),
    },
    heights: {
      source: HEIGHT_SOURCE,
      band: HEIGHT_BAND,
      gateBand: PRESENCE_BAND,
      gate: PRESENCE_GATE,
      imageryYear: measured.year,
      epsg: measured.epsg,
      manifests: measured.manifests,
      tiles: measured.tiles,
      blocksRead: measured.blocks,
      blocksInTiles: measured.blocksInTiles,
      bytesRead: measured.bytesRead,
      meanAbsoluteErrorM: HEIGHT_MAE,
      errorNote:
        'Stated by the dataset, not measured here: the 2.5D Temporal height band has a mean absolute error of ' +
        `${HEIGHT_MAE} m and is capped at ${HEIGHT_CAP} m, and is only meaningful where the presence band agrees.`,
      capM: HEIGHT_CAP,
      atCap: measured.atCap,
      samplesPerBuilding: SAMPLES_PER_BOX,
      statistic:
        'The median of the nine points on each roof whose presence band reached the gate. Nine rather than one ' +
        'because the product is distributed at 0.5 m and is only good to about 4 m.',
      measured: boxes.length - measured.ungated,
      unmeasured: measured.ungated,
      unmeasuredPresence: measured.presenceOfUngated,
      unmeasuredDrawnAtM: round(fill.height, 1),
      unmeasuredNote:
        `A look choice, and the only one in a height here. The ${measured.ungated} buildings the presence band ` +
        `would not vouch for are small, a median of ${round(fill.medianMissingArea)} m2 against ` +
        `${round(fill.medianMeasuredArea)} m2 for the rest, and their median best presence was ` +
        `${measured.presenceOfUngated} against a gate of ${PRESENCE_GATE}. They are drawn rather than dropped, ` +
        'because leaving them out would thin the edge of the city exactly where the low sheds and yards are, ' +
        'and they are drawn at the median height the raster measured for buildings as small as they are. Every ' +
        'record that carries that height has measured = 0, so a reader can draw them differently or not at all.',
    },
    binary: {
      file: 'city.bin',
      dtype: 'float32',
      byteOrder: 'little-endian',
      record: CITY_RECORD,
      units: 'metres, except yawDeg which is degrees counter-clockwise from east in [0, 180), and measured which is 1 or 0',
      stride: CITY_STRIDE,
      count: boxes.length,
      sha256: createHash('sha256').update(binary).digest('hex'),
    },
    cells: {
      size: CITY_CELL,
      note:
        'The records are sorted by cell, south to north, west to east within a row, and by easting inside a ' +
        'cell, so a reader can take a run of records for a region rather than sorting them itself. Each entry ' +
        'is the cell corner in metres, the first record in it, and how many.',
      list: cells.map((cell) => [cell.x, cell.y, cell.from, cell.count]),
    },
  };
  writeFileSync(OUT_BIN, binary);
  writeFileSync(OUT_JSON, `${JSON.stringify(header, null, 1)}\n`);
  console.log(`wrote ${OUT_BIN} (${(binary.byteLength / 1e6).toFixed(1)} MB, ${boxes.length.toLocaleString()} records of ${CITY_STRIDE} bytes)`);
  console.log(`wrote ${OUT_JSON} (${(statSync(OUT_JSON).size / 1024).toFixed(0)} kB, ${cells.length} cells)`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === pathToFileURL(fileURLToPath(import.meta.url)).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
