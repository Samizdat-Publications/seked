/**
 * The plateau's lesser monuments as massing solids, from footprints.
 *
 * A footprint is an outline already in the project frame and already set on
 * the scene's ground (scripts/footprints.ts does both, from OpenStreetMap),
 * with either a height OSM tags or a measurement key to look one up. Three
 * kinds of solid come out of one:
 *
 *   prism    the outline carried straight up, from `base + minHeight` to
 *            `base + height`; temples, tombs, walls and the parts of the
 *            Sphinx, whose head OSM models as starting eleven metres up
 *   pyramid  the outline rising to an apex over its own area centroid, which
 *            for a square footprint is the square pyramid and for anything
 *            else is the honest generalisation of one
 *   pit      the outline cut `depth` down from the ground, drawn as a solid
 *            so a renderer can give the cut its own dark material
 *
 * These are massings and say so. A pyramid built this way has no courses, no
 * concavity and no casing, and its height is whatever OSM says, which for the
 * queens' pyramids is the restored original. The three large pyramids are
 * never built here: the survey builds those.
 *
 * The caps are triangulated by ear clipping, because an outline traced from
 * imagery is not convex: the Sphinx's body is twenty-four vertices round a
 * shape with a neck in it. The same function runs in blender/seked_data.py
 * and a parity test pins the two meshes to each other.
 */

import type { Environment } from './environment';
import type { Mesh } from './mesh';

export type FootprintKind = 'prism' | 'pyramid' | 'pit';

export interface Footprint {
  id: string;
  name: string;
  kind: FootprintKind;
  group: string;
  /** The OSM way it was traced from; absent for one built from survey records. */
  osm?: number;
  /** The ground under the outline, metres above the Great Pyramid's base. */
  base: number;
  /**
   * A base level for each vertex of the ring, for a solid that climbs, as a
   * causeway does. `base` is then the first of them. A pyramid ignores it.
   */
  bases?: number[];
  /** The measurement records its outline was computed from, for one built from a survey rather than traced. */
  records?: string[];
  /** Top of the solid above `base`, as OSM tags it. */
  height?: number;
  /** Bottom of the solid above `base`, as OSM tags it, for a part that starts off the ground. */
  minHeight?: number;
  /** The measurement key for the height, where OSM tags none. */
  heightKey?: string;
  /** The measurement key for a pit's depth. */
  depthKey?: string;
  /**
   * The measurement key for a batter: the angle a prism's walls lean in at,
   * degrees above the horizontal. The top outline is drawn inside the bottom
   * one by the height over the tangent of that angle, as a mastaba's is.
   */
  batterKey?: string;
  area: number;
  /** Counter-clockwise seen from above, open (the first point is not repeated), metres. */
  ring: [number, number][];
}

/**
 * How far above a pit's own ground its top is drawn. The ground and the top of
 * the cut would otherwise be one plane and fight for every pixel; a centimetre
 * is invisible at any distance the scene is looked at from.
 */
export const PIT_LIP = 0.01;

/** Below this, a cross product is taken as zero: the three points are in a line. */
const COLLINEAR = 1e-9;

type Xy = readonly [number, number];

function cross(a: Xy, b: Xy, c: Xy): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function strictlyInside(p: Xy, a: Xy, b: Xy, c: Xy): boolean {
  return cross(a, b, p) > COLLINEAR && cross(b, c, p) > COLLINEAR && cross(c, a, p) > COLLINEAR;
}

/**
 * Triangles covering a simple counter-clockwise polygon, as indices into it,
 * each triangle counter-clockwise.
 *
 * Ear clipping, first ear found each pass, which is O(n^3) and fine at the
 * forty vertices the largest outline has. A vertex in a straight line with its
 * neighbours is clipped as a zero-area triangle rather than dropped, so every
 * edge of the outline is an edge of the cap and the solid stays closed. If an
 * outline is not simple after all, which a traced one occasionally is not,
 * whatever is left is fanned from its first vertex rather than lost.
 */
export function triangulate(ring: readonly Xy[]): number[] {
  const open = ring.map((_, i) => i);
  const out: number[] = [];
  while (open.length > 3) {
    let clipped = false;
    for (let k = 0; k < open.length; k++) {
      const i0 = open[(k + open.length - 1) % open.length] as number;
      const i1 = open[k] as number;
      const i2 = open[(k + 1) % open.length] as number;
      const a = ring[i0] as Xy;
      const b = ring[i1] as Xy;
      const c = ring[i2] as Xy;
      const turn = cross(a, b, c);
      if (turn < -COLLINEAR) continue;
      if (turn > COLLINEAR) {
        let blocked = false;
        for (const j of open) {
          if (j === i0 || j === i1 || j === i2) continue;
          if (strictlyInside(ring[j] as Xy, a, b, c)) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
      }
      out.push(i0, i1, i2);
      open.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  for (let k = 1; k + 1 < open.length; k++) out.push(open[0] as number, open[k] as number, open[k + 1] as number);
  return out;
}

/** The area centroid of a counter-clockwise polygon. */
export function ringCentroid(ring: readonly Xy[]): [number, number] {
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

/** The records a footprint's solid is built from: its outline's records and its height or depth key. */
export function footprintInputs(f: Footprint): string[] {
  return [...(f.records ?? []), f.heightKey, f.depthKey, f.batterKey].filter((k): k is string => k !== undefined);
}

/** The solid's bottom and top in the frame, or nothing where the environment lacks the height it needs. */
export function footprintSpan(f: Footprint, env: Environment): { bottom: number; top: number } | undefined {
  if (f.kind === 'pit') {
    const depth = f.depthKey === undefined ? undefined : env[f.depthKey];
    if (depth === undefined || !(depth > 0)) return undefined;
    return { bottom: f.base - depth, top: f.base + PIT_LIP };
  }
  const height = f.height ?? (f.heightKey === undefined ? undefined : env[f.heightKey]);
  if (height === undefined || !Number.isFinite(height)) return undefined;
  const bottom = f.base + (f.minHeight ?? 0);
  const top = f.base + height;
  return top > bottom ? { bottom, top } : undefined;
}

/** How far vertex `i`'s own base stands above the footprint's `base`, for a solid that climbs. */
function rise(f: Footprint, i: number): number {
  const b = f.bases?.[i];
  return b === undefined ? 0 : b - f.base;
}

function toMesh(verts: number[][], tris: number[]): Mesh {
  const positions = new Float32Array(verts.length * 3);
  verts.forEach((v, i) => positions.set(v, i * 3));
  return { positions, indices: Uint32Array.from(tris), vertexCount: verts.length, triangleCount: tris.length / 3 };
}

/** How far a batter may draw the top in, as a share of the least distance from the outline's centroid to an edge. */
const BATTER_LIMIT = 0.4;

/** How long a mitred corner may grow against the inset, so a sharp corner of a traced outline cannot fly off. */
const MITRE_LIMIT = 4;

/**
 * An outline drawn in by `inset` metres, each corner moved along its bisector
 * far enough that both of its edges move in by the inset. The inset is capped
 * at `BATTER_LIMIT` of the least distance from the area centroid to an edge,
 * so a small or narrow traced outline is drawn in and never turned inside out.
 */
/**
 * How straight a run of edges has to be before it is treated as one, degrees.
 * A LOOK CHOICE, and a small one: the eight segments OSM traces down the east
 * front of Khafre's valley temple turn by 0.15 degrees at most.
 */
export const COLLINEAR_DEG = 1.5;

/**
 * A ring with its near-collinear vertices dropped.
 *
 * Geometrically this is a no-op: a vertex on the line between its neighbours
 * adds nothing to the solid, and dropping it moves no surface. What it changes
 * is the ring's parametrisation, and that matters wherever an edge is a unit
 * of work. A doorway is cut along one edge, and the east front of Khafre's
 * valley temple is a straight line that OpenStreetMap's tracer laid down as
 * eight segments, three of them under two metres: no one of them is long
 * enough to carry the 2.4 m entrance Hoelscher's plate records, so the
 * opening was silently dropped. Merged, that front is one edge of 45.8 m and
 * both entrances fit in it with room either side.
 *
 * The first vertex is kept, so a caller that has indexed the ring elsewhere
 * can still find its way about. Rings of under four vertices come back
 * untouched, there being nothing to merge that would leave a ring behind.
 */
export function mergeCollinear(ring: readonly Xy[], toleranceDeg = COLLINEAR_DEG): Xy[] {
  const n = ring.length;
  if (n < 4) return ring.map(([x, y]) => [x, y] as Xy);
  const limit = Math.cos((toleranceDeg * Math.PI) / 180);
  const out: Xy[] = [];
  for (let i = 0; i < n; i++) {
    const p = ring[(i + n - 1) % n] as Xy;
    const q = ring[i] as Xy;
    const r = ring[(i + 1) % n] as Xy;
    const ax = q[0] - p[0];
    const ay = q[1] - p[1];
    const bx = r[0] - q[0];
    const by = r[1] - q[1];
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    // A zero-length edge is a duplicate vertex, which is always droppable.
    if (la === 0) continue;
    if (lb === 0) {
      out.push([q[0], q[1]]);
      continue;
    }
    const straight = (ax * bx + ay * by) / (la * lb);
    if (straight < limit) out.push([q[0], q[1]]);
  }
  return out.length >= 3 ? out : ring.map(([x, y]) => [x, y] as Xy);
}

/**
 * How far the ring's own centroid stands from its nearest edge, metres.
 *
 * This is what `insetRing` clamps against, pulled out so a caller can ask it.
 * For a long thin ribbon, which is what the footprint import makes of a
 * buffered polyline, it is the ribbon's own half width, which is how the
 * causeway's roof knows how wide a slit down its middle would be.
 */
export function ringInradius(ring: readonly Xy[]): number {
  const n = ring.length;
  const [cx, cy] = ringCentroid(ring);
  let least = Infinity;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = ring[i] as Xy;
    const [x1, y1] = ring[(i + 1) % n] as Xy;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((cx - x0) * dx + (cy - y0) * dy) / len2)) : 0;
    least = Math.min(least, Math.hypot(cx - (x0 + t * dx), cy - (y0 + t * dy)));
  }
  return least;
}

export function insetRing(ring: readonly Xy[], inset: number): Xy[] {
  const n = ring.length;
  const least = ringInradius(ring);
  const d = Math.min(inset, BATTER_LIMIT * least);
  return ring.map(([x, y], i) => {
    const [px, py] = ring[(i + n - 1) % n] as Xy;
    const [qx, qy] = ring[(i + 1) % n] as Xy;
    const l1 = Math.hypot(x - px, y - py);
    const l2 = Math.hypot(qx - x, qy - y);
    if (l1 === 0 || l2 === 0) return [x, y] as Xy;
    // The inward normal of a counter-clockwise edge is its direction turned left.
    const n1x = -(y - py) / l1;
    const n1y = (x - px) / l1;
    const n2x = -(qy - y) / l2;
    const n2y = (qx - x) / l2;
    const mitre = Math.min(MITRE_LIMIT, 1 / Math.max(1e-9, 1 + n1x * n2x + n1y * n2y));
    return [x + (n1x + n2x) * d * mitre, y + (n1y + n2y) * d * mitre] as Xy;
  });
}

/**
 * One footprint's solid. Vertices are the outline at the bottom, then either
 * the outline at the top (prism, pit) or a single apex (pyramid). Faces wind
 * counter-clockwise seen from outside, as every other mesh here does.
 */
export function footprintMesh(f: Footprint, env: Environment): Mesh | undefined {
  const span = footprintSpan(f, env);
  if (!span || f.ring.length < 3) return undefined;
  const n = f.ring.length;
  const caps = triangulate(f.ring);
  const verts: number[][] = f.ring.map(([x, y], i) => [x, y, span.bottom + (f.kind === 'pyramid' ? 0 : rise(f, i))]);
  const tris: number[] = [];
  // The bottom faces down, so each cap triangle is reversed.
  for (let t = 0; t < caps.length; t += 3) tris.push(caps[t] as number, caps[t + 2] as number, caps[t + 1] as number);

  if (f.kind === 'pyramid') {
    const [cx, cy] = ringCentroid(f.ring);
    verts.push([cx, cy, span.top]);
    for (let i = 0; i < n; i++) tris.push(i, (i + 1) % n, n);
    return toMesh(verts, tris);
  }

  const angle = f.batterKey === undefined ? undefined : env[f.batterKey];
  const top = angle !== undefined && angle > 0 && angle < 90
    ? insetRing(f.ring, (span.top - span.bottom) / Math.tan((angle * Math.PI) / 180))
    : f.ring;
  top.forEach(([x, y], i) => verts.push([x, y, span.top + rise(f, i)]));
  for (let t = 0; t < caps.length; t += 3) tris.push(n + (caps[t] as number), n + (caps[t + 1] as number), n + (caps[t + 2] as number));
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tris.push(i, j, n + j, i, n + j, n + i);
  }
  return toMesh(verts, tris);
}

// --- Solids built from survey records rather than traced -------------------
//
// Two monuments on the plateau are placed better by Petrie than by any
// tracing, or are not traced at all. They are built here from the database as
// footprints, so that everything downstream of a footprint (Blender, the
// viewer, the parity test) takes them without knowing the difference.

/** The measurement keys fixing one corner of the basalt pavement's rock-cut bed: east, then north. */
function pavementCorner(corner: string): [string, string] {
  return [`g1.basalt_pavement.corner.${corner}.beyond_east_base`, `g1.basalt_pavement.corner.${corner}.north`];
}

function signedArea(ring: readonly Xy[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i] as Xy;
    const [x1, y1] = ring[(i + 1) % ring.length] as Xy;
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}

/**
 * The basalt pavement east of the Great Pyramid, the floor of Khufu's
 * destroyed mortuary temple, from the four corners of its rock-cut bed in
 * Petrie's section 28. His figures are east of the Pyramid's east base edge
 * and north of its central line, which is this frame, so a corner is the half
 * base plus the one, and the other as it stands. It lies at the Pyramid's own
 * base level, Petrie finding it "within two inches of the same level as" the
 * limestone pavement, and is drawn as a slab the estimated thickness proud.
 */
export function basaltPavement(env: Environment): Footprint | undefined {
  const side = env['g1.base.side.mean'];
  if (side === undefined) return undefined;
  const half = side / 2;
  // Counter-clockwise seen from above: south-west, south-east, north-east, north-west.
  const order = ['sw', 'se', 'ne', 'nw'];
  const keys = order.flatMap(pavementCorner);
  if (keys.some((k) => env[k] === undefined)) return undefined;
  const ring = order.map((c) => {
    const [east, north] = pavementCorner(c);
    return [half + (env[east] as number), env[north] as number] as [number, number];
  });
  return {
    id: 'khufu.basalt_pavement',
    name: 'Basalt pavement of Khufu\u2019s mortuary temple',
    kind: 'prism',
    group: 'temples',
    base: env['g1.base.elevation.relative'] ?? 0,
    heightKey: 'g1.basalt_pavement.thickness',
    area: Math.abs(signedArea(ring)),
    ring,
    records: ['g1.base.side.mean', ...keys],
  };
}

/**
 * Where the segment from `a` to `b` crosses a polygon's boundary, as the
 * parameter along it: the last crossing if `last`, else the first. Undefined
 * if it does not cross at all.
 */
function crossing(a: Xy, b: Xy, ring: readonly Xy[], last: boolean): number | undefined {
  let found: number | undefined;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i] as Xy;
    const q = ring[(i + 1) % ring.length] as Xy;
    const ex = q[0] - p[0];
    const ey = q[1] - p[1];
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < COLLINEAR) continue;
    const t = ((p[0] - a[0]) * ey - (p[1] - a[1]) * ex) / denom;
    const u = ((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / denom;
    if (t < 0 || t > 1 || u < 0 || u > 1) continue;
    if (found === undefined || (last ? t > found : t < found)) found = t;
  }
  return found;
}

/**
 * Khafre's causeway, which Petrie says in section 95 "leads from [the Granite
 * Temple's] entrance, straight up to the entrance of the temple of that
 * Pyramid", "about 15 feet wide and over quarter of a mile long", on "a very
 * suitable ridge of rock running in this direction, with a sharp fall away on
 * each side of it". No record places either entrance, so it is drawn on the
 * straight line between the two temples' area centroids, from where that line
 * leaves the valley temple to where it enters the mortuary temple, at
 * Petrie's width. The centroid-to-centroid line is the assumption; its length
 * is checked against his quarter of a mile.
 *
 * It comes back as a ribbon of `segments` lengths with no base levels, because
 * a causeway laid on a ridge has to follow the ground and only the footprint
 * import has the ground: scripts/footprints.ts sets each vertex's base from
 * the terrain and writes the result into the file like any other footprint.
 * A straight ramp from one temple floor to the other, which is what this was
 * first, ran up to three and a half metres under the ridge it is built on.
 */
export function khafreCauseway(env: Environment, features: readonly Footprint[], segments = 1): Footprint | undefined {
  const valley = features.find((f) => f.id === 'khafre.valley_temple');
  const temple = features.find((f) => f.id === 'khafre.mortuary_temple');
  const width = env['khafre.causeway.width'];
  if (!valley || !temple || width === undefined || !(width > 0) || segments < 1) return undefined;
  const a = ringCentroid(valley.ring);
  const b = ringCentroid(temple.ring);
  const leave = crossing(a, b, valley.ring, true);
  const enter = crossing(a, b, temple.ring, false);
  if (leave === undefined || enter === undefined || !(enter > leave)) return undefined;
  const at = (t: number): Xy => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const start = at(leave);
  const end = at(enter);
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const nx = (-(end[1] - start[1]) / length) * (width / 2);
  const ny = ((end[0] - start[0]) / length) * (width / 2);
  const along = (k: number): Xy => [
    start[0] + ((end[0] - start[0]) * k) / segments,
    start[1] + ((end[1] - start[1]) * k) / segments,
  ];
  // Counter-clockwise seen from above: up the right-hand side, back down the left.
  const ring: [number, number][] = [];
  for (let k = 0; k <= segments; k++) {
    const [x, y] = along(k);
    ring.push([x - nx, y - ny]);
  }
  for (let k = segments; k >= 0; k--) {
    const [x, y] = along(k);
    ring.push([x + nx, y + ny]);
  }
  return {
    id: 'khafre.causeway',
    name: 'Causeway of Khafre',
    kind: 'prism',
    group: 'causeways',
    base: valley.base,
    heightKey: 'khafre.causeway.thickness',
    area: Math.abs(signedArea(ring)),
    ring,
    records: ['khafre.causeway.width'],
  };
}

/**
 * Every solid built from survey records at build time. Khafre's causeway is
 * not among them: it needs the ground, so the footprint import builds it.
 */
export function surveyFootprints(env: Environment, _features: readonly Footprint[] = []): Footprint[] {
  return [basaltPavement(env)].filter((f): f is Footprint => f !== undefined);
}
