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

/**
 * How far a temple's outer face leans in, as the angle its face makes with the
 * ground. A LOOK CHOICE, and the one that does the most to stop a temple
 * reading as a modern block.
 *
 * An Egyptian wall of this date is battered outside and vertical inside, and
 * the plateau carries a surveyed figure for the shape: Reisner's mastaba
 * batter of 74.8 degrees, which `data/measurements` holds and `mastaba.ts`
 * builds with. That is a tomb's wall and not a temple's, so it is a precedent
 * and not a measurement here. Eighty-two degrees is a gentler lean than a
 * mastaba's and is what these are drawn with until somebody scales a section
 * off a plate: over a wall eight metres high it draws the face in by a little
 * over a metre, which is what the eye reads as Egyptian.
 *
 * Nothing about it enters `data/`, and the label says it is a choice.
 */
export const TEMPLE_BATTER_DEG = 82;

/** How far in the top of a wall of this height sits, for the batter above. */
export function batterInset(height: number, degrees = TEMPLE_BATTER_DEG): number {
  if (!(height > 0) || !(degrees > 0) || degrees >= 90) return 0;
  return height / Math.tan((degrees * Math.PI) / 180);
}

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
export function annulusMesh(
  outer: readonly Xy[],
  inner: readonly Xy[],
  bottom: number,
  top: number,
  outerTop?: readonly Xy[],
  innerTop?: readonly Xy[],
): Mesh | undefined {
  const n = outer.length;
  if (n < 3 || inner.length !== n || !(top > bottom)) return undefined;
  const head = outerTop ?? outer;
  const lip = innerTop ?? inner;
  if (head.length !== n || lip.length !== n) return undefined;
  const verts: number[][] = [];
  for (const [x, y] of outer) verts.push([x, y, bottom]);
  for (const [x, y] of head) verts.push([x, y, top]);
  for (const [x, y] of inner) verts.push([x, y, bottom]);
  for (const [x, y] of lip) verts.push([x, y, top]);
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
  // Battered outside, vertical inside, which is how a wall of this date is
  // built and which leaves the wall thinner at its head than at its footing.
  const lean = batterInset(height);
  const head = insetRing(f.ring, lean);
  const walls = annulusMesh(f.ring, inner, span.bottom, wallTop, head);
  if (walls === undefined) return undefined;

  const source = state === 'ruined'
    ? `${TEMPLE_RUIN_FRACTION} of the ${standing} m of the footprint's own height key`
    : fromBuilt
      ? `${height} m from ${TEMPLE_BUILT_HEIGHT_KEY}`
      : `${height} m from the footprint's own height key, the database carrying no ${TEMPLE_BUILT_HEIGHT_KEY}`;
  const label =
    `Reconstruction: ${f.name} ${state}, on the OSM outline, walls to ${source}. Look choices: walls ` +
    `${WALL_THICKNESS} m thick, battered to ${TEMPLE_BATTER_DEG} deg outside and vertical inside` +
    (state === 'whole'
      ? `, a flat roof slab ${ROOF_THICKNESS} m thick, and a colonnade of ${PILLAR.across} m square pillars ` +
        `at ${PILLAR.pitch} m pitch. Not a reconstruction of this temple: one massing height covers all six, ` +
        'and how any of them was walled, roofed or columned is not in the database.'
      : `, and ${TEMPLE_RUIN_FRACTION} of the height as the ruin. Not a reconstruction of this temple: one ` +
        'massing height covers all six, and how far any of them stands is not in the database.');

  if (state === 'ruined') return { walls, label };
  // The slab sits on what the battered wall leaves, not on the footing's own
  // outline, or it would stand out past the wall head as a cornice nobody
  // chose.
  const roof = footprintMesh(
    { ...f, ring: head.map(([x, y]) => [x, y] as [number, number]), base: wallTop, height: ROOF_THICKNESS, heightKey: undefined, batterKey: undefined, bases: undefined },
    env,
  );
  const pillars = colonnadeMesh(inner, span.bottom, wallTop, env);
  const temple: Temple = { walls, label };
  if (roof !== undefined) temple.roof = roof;
  if (pillars !== undefined) temple.pillars = pillars;
  return temple;
}

// --- The temples a published plan has been read for -------------------------
//
// Above this line nothing about a temple is known but its outline and one
// massing height. Below it, a temple whose plan someone has scaled off a
// drawing is built from that plan instead: the hall where the plan puts it,
// the pillars on the pitch the plan draws, the statue plinths on the sockets
// it marks. Every number comes from `data/measurements` under the footprint's
// own prefix, so adding a temple is data and never code.

/** How thick the granite lining of a plan-driven hall is drawn, metres. A look choice. */
export const HALL_LINING = 0.4;

/** How tall a statue plinth is drawn, and how far it stands out of its wall, metres. Look choices. */
export const PLINTH = { height: 0.6, depth: 1.2, width: 1.6 };

/** The measurement prefix a footprint's plan is recorded under: `khafre.valley_temple` -> `khafre_valley_temple`. */
export function planPrefix(id: string): string {
  return id.replace(/\./g, '_');
}

/** One room of a plan, in metres from the footprint's centroid, east and north. */
export interface PlanRoom {
  west: number;
  east: number;
  north: number;
  south: number;
}

/** What a plan says, read out of the environment under one footprint's prefix. */
export interface TemplePlanRecords {
  prefix: string;
  hall: PlanRoom;
  pillar?: { across: number; pitchEast: number; pitchNorth: number; rowNorth: number; firstEast: number };
  statues: { east: number; north: number }[];
}

/**
 * The plan the database holds for one footprint, or nothing. The hall is what
 * makes a plan: without its four faces there is no plan to build, and the
 * generic massing temple stands instead.
 */
export function templePlan(f: Footprint, env: Environment): TemplePlanRecords | undefined {
  const p = planPrefix(f.id);
  const room = (['west', 'east', 'north', 'south'] as const).map((side) => env[`${p}.hall.stem.${side}`]);
  if (room.some((v) => v === undefined || !Number.isFinite(v))) return undefined;
  const [west, east, north, south] = room as [number, number, number, number];
  if (!(east > west) || !(north > south)) return undefined;

  const plan: TemplePlanRecords = { prefix: p, hall: { west, east, north, south }, statues: [] };
  const across = env[`${p}.pillar.across`];
  const pitchEast = env[`${p}.pillar.pitch.east`];
  const pitchNorth = env[`${p}.pillar.pitch.north`];
  const rowNorth = env[`${p}.hall.pillar.row.north`];
  const firstEast = env[`${p}.hall.pillar.first.east`];
  if (
    across !== undefined && across > 0 && pitchEast !== undefined && pitchEast > 0 &&
    pitchNorth !== undefined && pitchNorth > 0 && rowNorth !== undefined && firstEast !== undefined
  ) {
    plan.pillar = { across, pitchEast, pitchNorth, rowNorth, firstEast };
  }
  for (let i = 1; ; i++) {
    const east2 = env[`${p}.statue.${i}.east`];
    const north2 = env[`${p}.statue.${i}.north`];
    if (east2 === undefined || north2 === undefined) break;
    plan.statues.push({ east: east2, north: north2 });
  }
  return plan;
}

/** Where a plan's pillars stand, stepped out from the recorded one on the recorded pitch. */
export function planPillars(plan: TemplePlanRecords): Xy[] {
  const p = plan.pillar;
  if (p === undefined) return [];
  const half = p.across / 2;
  const out: Xy[] = [];
  for (const north of [p.rowNorth, p.rowNorth - p.pitchNorth]) {
    if (north - half < plan.hall.south || north + half > plan.hall.north) continue;
    const firstIndex = Math.ceil((plan.hall.west + half - p.firstEast) / p.pitchEast);
    const lastIndex = Math.floor((plan.hall.east - half - p.firstEast) / p.pitchEast);
    for (let i = firstIndex; i <= lastIndex; i++) out.push([p.firstEast + i * p.pitchEast, north] as Xy);
  }
  return out;
}

/** One part of a plan-driven temple, with the stone a renderer should give it. */
export interface TemplePart {
  name: string;
  material: 'granite' | 'core';
  mesh: Mesh;
}

export interface TemplePlanBuild {
  parts: TemplePart[];
  /** The hall's plan, counter-clockwise seen from above, in the frame. */
  hall: Xy[];
  label: string;
}

function rect(cx: number, cy: number, plan: PlanRoom): Xy[] {
  return [
    [cx + plan.west, cy + plan.south],
    [cx + plan.east, cy + plan.south],
    [cx + plan.east, cy + plan.north],
    [cx + plan.west, cy + plan.north],
  ];
}

function prism(name: string, material: 'granite' | 'core', ring: readonly Xy[], bottom: number, top: number, env: Environment): TemplePart | undefined {
  const mesh = footprintMesh(
    { id: name, name, kind: 'prism', group: 'temples', base: bottom, height: top - bottom, area: 0, ring: ring as [number, number][] },
    env,
  );
  return mesh === undefined ? undefined : { name, material, mesh };
}

/**
 * One temple built from the plan the database holds for it.
 *
 * The mass is the footprint's own solid with the hall left out of it: an
 * outer wall on the traced outline and four blocks filling what is left
 * between that wall and the hall, so the hall is a void and not a room drawn
 * on top of a block. The hall is lined with granite, its pillars stand on the
 * plan's own pitch, and a statue plinth stands on each socket the plan marks.
 * `whole` roofs it; `ruined` takes everything to a quarter of its height and
 * leaves the roof off. Nothing here is a reconstruction of anything the plan
 * does not draw, and the label says which parts the plan gave.
 */
export function templePlanMesh(f: Footprint, env: Environment, state: 'whole' | 'ruined'): TemplePlanBuild | undefined {
  if (f.group !== 'temples') return undefined;
  const plan = templePlan(f, env);
  if (plan === undefined) return undefined;
  const span = footprintSpan(f, env);
  if (span === undefined) return undefined;
  const standing = span.top - span.bottom;
  const built = env[TEMPLE_BUILT_HEIGHT_KEY];
  const fromBuilt = state === 'whole' && built !== undefined && built > 0;
  const height = state === 'whole' ? (fromBuilt ? (built as number) : standing) : TEMPLE_RUIN_FRACTION * standing;
  if (!(height > 0)) return undefined;
  const bottom = span.bottom;
  const top = bottom + height;

  const [cx, cy] = ringCentroid(f.ring);
  const hall = rect(cx, cy, plan.hall);
  const inner = insetRing(f.ring, WALL_THICKNESS);
  const xs = inner.map(([x]) => x);
  const ys = inner.map(([, y]) => y);
  const box: PlanRoom = {
    west: Math.min(...xs) - cx, east: Math.max(...xs) - cx,
    south: Math.min(...ys) - cy, north: Math.max(...ys) - cy,
  };

  const parts: TemplePart[] = [];
  const outer = annulusMesh(f.ring, inner, bottom, top);
  if (outer === undefined) return undefined;
  parts.push({ name: 'wall.outer', material: 'core', mesh: outer });

  // What is left of the mass once the hall is taken out of it, as four blocks
  // between the hall and the outer wall's inner face. Squaring that face off
  // to its bounding box is a look choice; the traced outlines are near square.
  const blocks: [string, PlanRoom][] = [
    ['mass.north', { west: box.west, east: box.east, south: plan.hall.north, north: box.north }],
    ['mass.south', { west: box.west, east: box.east, south: box.south, north: plan.hall.south }],
    ['mass.west', { west: box.west, east: plan.hall.west, south: plan.hall.south, north: plan.hall.north }],
    ['mass.east', { west: plan.hall.east, east: box.east, south: plan.hall.south, north: plan.hall.north }],
  ];
  for (const [name, room] of blocks) {
    if (!(room.east > room.west) || !(room.north > room.south)) continue;
    const part = prism(name, 'core', rect(cx, cy, room), bottom, top, env);
    if (part !== undefined) parts.push(part);
  }

  const lining = annulusMesh(hall, insetRing(hall, HALL_LINING), bottom, top);
  if (lining !== undefined) parts.push({ name: 'hall.lining', material: 'granite', mesh: lining });

  const pillars = planPillars(plan);
  const half = (plan.pillar?.across ?? 0) / 2;
  for (const [i, [east, north]] of pillars.entries()) {
    const x = cx + east;
    const y = cy + north;
    const part = prism(`pillar.${i + 1}`, 'granite',
      [[x - half, y - half], [x + half, y - half], [x + half, y + half], [x - half, y + half]], bottom, top, env);
    if (part !== undefined) parts.push(part);
  }

  for (const [i, s] of plan.statues.entries()) {
    const x = cx + s.east;
    const y = cy + s.north;
    const part = prism(`statue.${i + 1}`, 'granite',
      [[x - PLINTH.width / 2, y - PLINTH.depth / 2], [x + PLINTH.width / 2, y - PLINTH.depth / 2],
        [x + PLINTH.width / 2, y + PLINTH.depth / 2], [x - PLINTH.width / 2, y + PLINTH.depth / 2]],
      bottom, bottom + PLINTH.height, env);
    if (part !== undefined) parts.push(part);
  }

  if (state === 'whole') {
    const roof = footprintMesh({ ...f, base: top, height: ROOF_THICKNESS, heightKey: undefined, batterKey: undefined, bases: undefined }, env);
    if (roof !== undefined) parts.push({ name: 'roof', material: 'core', mesh: roof });
  }

  const source = state === 'ruined'
    ? `${TEMPLE_RUIN_FRACTION} of the ${standing} m of the footprint's own height key`
    : fromBuilt
      ? `${height} m from ${TEMPLE_BUILT_HEIGHT_KEY}`
      : `${height} m from the footprint's own height key`;
  const label =
    `Reconstruction: ${f.name} ${state}, built from the plan the database holds under ${plan.prefix}. ` +
    `The hall stands on ${plan.prefix}.hall.stem.west, .east, .north and .south, ${pillars.length} pillars on ` +
    `${plan.prefix}.pillar.across and .pitch.east and .pitch.north stepped out from ` +
    `${plan.prefix}.hall.pillar.first.east and .row.north, and ${plan.statues.length} statue plinths on ` +
    `${plan.prefix}.statue.<n>.east and .north. Walls to ${source}. Look choices: walls ${WALL_THICKNESS} m ` +
    `thick, the hall lined ${HALL_LINING} m in granite, plinths ${PLINTH.width} by ${PLINTH.depth} by ` +
    `${PLINTH.height} m, the mass round the hall squared off to the outline's own bounding box` +
    (state === 'whole' ? `, and a flat roof slab ${ROOF_THICKNESS} m thick.` : `, and ${TEMPLE_RUIN_FRACTION} of the height as the ruin.`);

  return { parts, hall, label };
}
