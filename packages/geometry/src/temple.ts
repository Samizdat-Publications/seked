/**
 * The six temples of the footprint import, whole and ruined.
 *
 * Only two things about them are in the database: the outline OSM traced, and
 * one massing height for all six (`tier3.temple.height` for what stands,
 * `tier3.temple.height.built` for the as-built state, both seked-estimates
 * with wide sigmas). Everything that makes an outline read as a temple, the
 * thickness of its walls, the slab over them and the colonnade inside, is a
 * look choice, so each of them is one named number here and is named again in
 * the label the viewer shows.
 *
 * They survive very unequally, Khafre's valley temple standing to its roof in
 * places and Menkaure's mortuary temple barely above its foundations, so
 * nothing below is a reconstruction of any one of them. It is what a temple
 * of that footprint would look like.
 *
 * Frame as everywhere else: +X east, +Y north, +Z up, metres.
 */

import type { Environment } from './environment';
import { footprintMesh, footprintSpan, insetRing, ringCentroid, type Footprint } from './footprints';
import { mergeMeshes } from './mastaba';
import type { Mesh } from './mesh';

/** How thick a temple wall is drawn, metres. A look choice. */
export const WALL_THICKNESS = 4;

/** How thick the roof slab is, metres. A look choice. */
export const ROOF_THICKNESS = 1;

/** The colonnade: a square pillar this far across, on a grid of this pitch, metres. Look choices. */
export const PILLAR = { across: 1.5, pitch: 5 };

/** How much of its height a ruined temple is left standing at. A look choice. */
export const TEMPLE_RUIN_FRACTION = 0.25;

/** The key carrying the height the temples are drawn to in the as-built state. */
export const TEMPLE_BUILT_HEIGHT_KEY = 'tier3.temple.height.built';

type Xy = readonly [number, number];

/** Whether a point is inside a simple polygon, by the crossing rule. */
export function pointInRing(p: Xy, ring: readonly Xy[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as Xy;
    const [xj, yj] = ring[j] as Xy;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * The solid between two rings of the same vertex count, from `bottom` to
 * `top`: the outer face wound outward, the inner face wound inward, and a
 * strip closing the two at each end. Both rings run counter-clockwise seen
 * from above and vertex i of one answers vertex i of the other, which is what
 * `insetRing` gives.
 */
export function annulusMesh(outer: readonly Xy[], inner: readonly Xy[], bottom: number, top: number): Mesh | undefined {
  const n = outer.length;
  if (n < 3 || inner.length !== n || !(top > bottom)) return undefined;
  const verts: number[][] = [];
  for (const [x, y] of outer) verts.push([x, y, bottom]);
  for (const [x, y] of outer) verts.push([x, y, top]);
  for (const [x, y] of inner) verts.push([x, y, bottom]);
  for (const [x, y] of inner) verts.push([x, y, top]);
  const ob = 0;
  const ot = n;
  const ib = 2 * n;
  const it = 3 * n;
  const tris: number[] = [];
  const quad = (a: number, b: number, c: number, d: number): void => {
    tris.push(a, b, c, a, c, d);
  };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    quad(ob + i, ob + j, ot + j, ot + i);   // the outer face, outward
    quad(ib + j, ib + i, it + i, it + j);   // the inner face, into the court
    quad(ot + i, ot + j, it + j, it + i);   // the wall head, up
    quad(ob + j, ob + i, ib + i, ib + j);   // the footing, down
  }
  const positions = new Float32Array(verts.length * 3);
  verts.forEach((v, i) => positions.set(v, i * 3));
  return { positions, indices: Uint32Array.from(tris), vertexCount: verts.length, triangleCount: tris.length / 3 };
}

/** A temple as its parts, so a renderer can give each one its own stone. */
export interface Temple {
  walls: Mesh;
  roof?: Mesh;
  pillars?: Mesh;
  label: string;
}

function box(id: string, x0: number, y0: number, x1: number, y1: number, base: number, height: number, env: Environment): Mesh | undefined {
  const ring: [number, number][] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  return footprintMesh({ id, name: id, kind: 'prism', group: 'temples', base, height, area: 0, ring }, env);
}

/**
 * The pillars of the colonnade: square columns on a grid anchored on the
 * court's own centroid, kept only where the whole column stands inside the
 * inner ring, so none of them grows out of a wall.
 */
export function colonnadeMesh(inner: readonly Xy[], bottom: number, top: number, env: Environment): Mesh | undefined {
  if (!(top > bottom)) return undefined;
  const [cx, cy] = ringCentroid(inner);
  const xs = inner.map(([x]) => x);
  const ys = inner.map(([, y]) => y);
  const half = PILLAR.across / 2;
  const first = (lo: number, c: number): number => Math.ceil((lo - c) / PILLAR.pitch);
  const last = (hi: number, c: number): number => Math.floor((hi - c) / PILLAR.pitch);
  const parts: Mesh[] = [];
  for (let i = first(Math.min(...xs), cx); i <= last(Math.max(...xs), cx); i++) {
    for (let j = first(Math.min(...ys), cy); j <= last(Math.max(...ys), cy); j++) {
      const x = cx + i * PILLAR.pitch;
      const y = cy + j * PILLAR.pitch;
      const corners: Xy[] = [[x - half, y - half], [x + half, y - half], [x + half, y + half], [x - half, y + half]];
      if (!corners.every((c) => pointInRing(c, inner))) continue;
      const part = box(`pillar.${i}.${j}`, x - half, y - half, x + half, y + half, bottom, top - bottom, env);
      if (part !== undefined) parts.push(part);
    }
  }
  return parts.length === 0 ? undefined : mergeMeshes(parts);
}

/**
 * One temple, whole or ruined.
 *
 * `whole` stands the walls to `tier3.temple.height.built` where the database
 * carries it and to the footprint's own height where it does not, roofs them
 * with a flat slab and sets a colonnade in the court. `ruined` is the same
 * walls at a quarter of what stands, with no roof and no colonnade. Nothing
 * is built for a footprint outside the temples, or for one the environment
 * cannot give a height.
 */
export function templeMesh(f: Footprint, env: Environment, state: 'whole' | 'ruined'): Temple | undefined {
  if (f.group !== 'temples') return undefined;
  const span = footprintSpan(f, env);
  if (span === undefined) return undefined;
  const standing = span.top - span.bottom;
  const built = env[TEMPLE_BUILT_HEIGHT_KEY];
  const fromBuilt = state === 'whole' && built !== undefined && built > 0;
  const height = state === 'whole' ? (fromBuilt ? (built as number) : standing) : TEMPLE_RUIN_FRACTION * standing;
  if (!(height > 0)) return undefined;

  const inner = insetRing(f.ring, WALL_THICKNESS);
  const wallTop = span.bottom + height;
  const walls = annulusMesh(f.ring, inner, span.bottom, wallTop);
  if (walls === undefined) return undefined;

  const source = state === 'ruined'
    ? `${TEMPLE_RUIN_FRACTION} of the ${standing} m of the footprint's own height key`
    : fromBuilt
      ? `${height} m from ${TEMPLE_BUILT_HEIGHT_KEY}`
      : `${height} m from the footprint's own height key, the database carrying no ${TEMPLE_BUILT_HEIGHT_KEY}`;
  const label =
    `Reconstruction: ${f.name} ${state}, on the OSM outline, walls to ${source}. Look choices: walls ` +
    `${WALL_THICKNESS} m thick` +
    (state === 'whole'
      ? `, a flat roof slab ${ROOF_THICKNESS} m thick, and a colonnade of ${PILLAR.across} m square pillars ` +
        `at ${PILLAR.pitch} m pitch. Not a reconstruction of this temple: one massing height covers all six, ` +
        'and how any of them was walled, roofed or columned is not in the database.'
      : `, and ${TEMPLE_RUIN_FRACTION} of the height as the ruin. Not a reconstruction of this temple: one ` +
        'massing height covers all six, and how far any of them stands is not in the database.');

  if (state === 'ruined') return { walls, label };
  const roof = footprintMesh({ ...f, base: wallTop, height: ROOF_THICKNESS, heightKey: undefined, batterKey: undefined, bases: undefined }, env);
  const pillars = colonnadeMesh(inner, span.bottom, wallTop, env);
  const temple: Temple = { walls, label };
  if (roof !== undefined) temple.roof = roof;
  if (pillars !== undefined) temple.pillars = pillars;
  return temple;
}
