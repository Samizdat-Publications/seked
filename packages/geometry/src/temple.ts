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
  // The door is in the east wall. Every temple on this plateau opens east:
  // a valley temple onto the water it was reached from, a mortuary temple
  // onto the causeway that climbs to it. That is the plateau's own plan and
  // not a choice; what is a choice is the size of the opening, which is
  // `DOORWAY` and is named in the label. A ruin gets none, because how far a
  // ruined wall stands is already a look choice and where its door was is not
  // something this builder knows.
  const [cx, cy] = ringCentroid(f.ring);
  const door = state === 'whole' ? centredOpening(f.ring, edgeFacing(f.ring, [cx + 1e6, cy]), height) : undefined;
  const walls = walledMesh(f.ring, inner, span.bottom, wallTop, door ? [door] : [], head);
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
      ? `, a doorway ${DOORWAY.width} by ${door === undefined ? 0 : Math.round(door.head * 10) / 10} m in the ` +
        `east wall${door === undefined ? ' (none: the east wall is too short to carry one)' : ''}, a flat roof ` +
        `slab ${ROOF_THICKNESS} m thick, and a colonnade of ${PILLAR.across} m square pillars ` +
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

// --- The way in -------------------------------------------------------------
//
// A building with no door is a box. Every temple on the plateau has an axis
// and a principal doorway, and on this plateau a doorway is a plain
// rectangular opening: Khafre's valley temple, the one that survives to its
// roof, has no moulding round either of its two, no lintel carving and no
// jamb inscription. So what is built here is an opening and nothing else, and
// its size is the only choice in it.

/**
 * The opening: how wide a doorway is drawn and how high to its head, metres,
 * and how much of a wall's run it may take. LOOK CHOICES, all three.
 *
 * Three metres by five is a door a barque and the men carrying it go through,
 * which is what these doors are for. `maxShare` keeps the opening from eating
 * a short wall: on a wall run of under about seven metres there is no door at
 * all rather than a gap with nothing either side of it.
 */
export const DOORWAY = { width: 3, height: 5, maxShare: 0.45 } as const;

/** Where a doorway goes: which edge of the ring, and how far along it. */
export interface Opening {
  /** The edge from ring vertex `edge` to vertex `edge + 1`, modulo the ring. */
  edge: number;
  /** The share of the edge the opening starts and ends at, 0 to 1. */
  from: number;
  to: number;
  /** The height of its head above the wall's footing, metres. */
  head: number;
}

/**
 * The edge of a ring whose middle is nearest a given place, which is how a
 * temple is told which way its door faces: toward the causeway's lower end,
 * or toward the water where there is no causeway.
 */
export function edgeFacing(ring: readonly Xy[], towards: Xy): number {
  let best = 0;
  let nearest = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as Xy;
    const b = ring[(i + 1) % ring.length] as Xy;
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const d = (mx - towards[0]) ** 2 + (my - towards[1]) ** 2;
    if (d < nearest) {
      nearest = d;
      best = i;
    }
  }
  return best;
}

/**
 * A doorway centred on an edge, or nothing where the edge is too short to
 * carry one without becoming a gap between two stubs.
 */
export function centredOpening(ring: readonly Xy[], edge: number, height: number): Opening | undefined {
  const a = ring[edge % ring.length] as Xy;
  const b = ring[(edge + 1) % ring.length] as Xy;
  const run = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!(run > 0)) return undefined;
  const share = DOORWAY.width / run;
  if (share > DOORWAY.maxShare) return undefined;
  const head = Math.min(DOORWAY.height, height * 0.8);
  if (!(head > 0)) return undefined;
  return { edge: edge % ring.length, from: 0.5 - share / 2, to: 0.5 + share / 2, head };
}

/**
 * The wall of `annulusMesh` with rectangular openings cut through it.
 *
 * The wall along an edge is a slab and an opening is a rectangular hole in it,
 * so what is left is a jamb either side, a lintel over, and the two reveals
 * that look into the opening. Every other edge is built exactly as
 * `annulusMesh` builds it, and with nothing to cut this returns `annulusMesh`
 * itself.
 *
 * Two things it has to get right, and both were got wrong first.
 *
 * The jambs are square to the wall, not square to the ring's parameter. The
 * inner ring is the outer inset, so its edge is shorter, and taking the same
 * share along both put the inner end of the opening in a different place from
 * the outer: the door came out three metres wide outside and two and a half
 * inside, a splayed embrasure nobody asked for. The inner end of a jamb is
 * found by projecting the outer one onto the inner edge instead, which is
 * what `meshVolume` catches: the hole is now exactly its width by its head by
 * the wall's thickness.
 *
 * And the faces either side of the opening are split at the head, so the
 * lintel's ends meet a wall edge rather than the middle of one. Without it
 * the surface has a T-junction at each jamb, which is a hairline of daylight
 * through a solid wall at the wrong angle.
 *
 * The head ring is the battered one, so a jamb leans with the wall it is cut
 * through and the opening is a little narrower at its head than at its foot,
 * which is what a doorway through a battered wall does.
 */
export function walledMesh(
  outer: readonly Xy[],
  inner: readonly Xy[],
  bottom: number,
  top: number,
  openings: readonly Opening[] = [],
  outerTop?: readonly Xy[],
  innerTop?: readonly Xy[],
): Mesh | undefined {
  const n = outer.length;
  if (n < 3 || inner.length !== n || !(top > bottom)) return undefined;
  const head = outerTop ?? outer;
  const lip = innerTop ?? inner;
  if (head.length !== n || lip.length !== n) return undefined;
  const cuts = openings.filter((o) => o.to > o.from && o.head > 0 && o.head < top - bottom);
  if (cuts.length === 0) return annulusMesh(outer, inner, bottom, top, head, lip);

  const verts: number[][] = [];
  const tris: number[] = [];
  const put = (p: Xy, z: number): number => {
    verts.push([p[0], p[1], z]);
    return verts.length - 1;
  };
  const quad = (a: number, b: number, c: number, d: number): void => {
    tris.push(a, b, c, a, c, d);
  };
  const lerp = (a: Xy, b: Xy, t: number): Xy => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const along = (ring: readonly Xy[], i: number, t: number): Xy => lerp(ring[i] as Xy, ring[(i + 1) % n] as Xy, t);

  /**
   * The share along the inner edge that stands square to share `t` on the
   * outer one. The two edges are parallel, the inner being the outer inset,
   * so the answer is the outer point projected onto the inner edge.
   */
  const square = (i: number, t: number): number => {
    const a = inner[i] as Xy;
    const b = inner[(i + 1) % n] as Xy;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    if (!(len2 > 0)) return t;
    const p = along(outer, i, t);
    return ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  };

  /**
   * A place across the wall's thickness: a share along the outer edge and the
   * share along the inner one that stands square to it.
   *
   * The ring's own corners are the exception and have to be: there the inner
   * share is 0 or 1 exactly, because the inner ring's corner is where the
   * next edge starts and a projection would put it somewhere else and tear
   * the court open along every corner.
   */
  const cross = (i: number, t: number): { t: number; u: number } =>
    ({ t, u: t === 0 || t === 1 ? t : square(i, t) });

  /** The wall's two faces at a place across it, at height `z`. */
  const face = (i: number, at: { t: number; u: number }, z: number): { out: Xy; in: Xy } => {
    const share = (z - bottom) / (top - bottom);
    return {
      out: lerp(along(outer, i, at.t), along(head, i, at.t), share),
      in: lerp(along(inner, i, at.u), along(lip, i, at.u), share),
    };
  };

  // Every face is split at every opening's head, on every edge and not only
  // on the edge that is cut. Splitting one edge and not its neighbours leaves
  // a T-junction at each corner between them, which is twelve unmatched edges
  // on a four-sided court and a hairline of daylight through a solid wall.
  const heads = [...new Set(cuts.map((o) => bottom + o.head))]
    .filter((z) => z > bottom && z < top)
    .sort((a, b) => a - b);

  for (let i = 0; i < n; i++) {
    const hole = cuts.find((o) => o.edge === i);
    const headZ = hole ? bottom + hole.head : bottom;
    const runs = hole
      ? [
          { from: 0, to: hole.from, base: bottom },
          { from: hole.to, to: 1, base: bottom },
          { from: hole.from, to: hole.to, base: headZ },
        ]
      : [{ from: 0, to: 1, base: bottom }];
    for (const run of runs) {
      if (!(run.to > run.from) || !(top > run.base)) continue;
      const left = cross(i, run.from);
      const right = cross(i, run.to);
      const levels = [run.base, ...heads.filter((z) => z > run.base && z < top), top];
      for (let k = 0; k < levels.length - 1; k++) {
        const lo = levels[k] as number;
        const hi = levels[k + 1] as number;
        const a = face(i, left, lo);
        const b = face(i, right, lo);
        const c = face(i, right, hi);
        const d = face(i, left, hi);
        quad(put(a.out, lo), put(b.out, lo), put(c.out, hi), put(d.out, hi));  // outward
        quad(put(b.in, lo), put(a.in, lo), put(d.in, hi), put(c.in, hi));      // into the court
      }
      // The head of the wall, up, and its underside: the footing where the run
      // stands on the ground, the lintel's soffit where it spans the opening.
      const hiA = face(i, left, top);
      const hiB = face(i, right, top);
      quad(put(hiA.out, top), put(hiB.out, top), put(hiB.in, top), put(hiA.in, top));
      const loA = face(i, left, run.base);
      const loB = face(i, right, run.base);
      quad(put(loB.out, run.base), put(loA.out, run.base), put(loA.in, run.base), put(loB.in, run.base));
    }
    if (!hole) continue;
    // The two reveals, footing to head, one facing each way into the opening.
    // The lintel's own ends abut the jambs and need none.
    for (const [t, inward] of [[hole.from, true], [hole.to, false]] as const) {
      const at = cross(i, t);
      const low = face(i, at, bottom);
      const high = face(i, at, headZ);
      const p0 = put(low.out, bottom);
      const p1 = put(low.in, bottom);
      const p2 = put(high.in, headZ);
      const p3 = put(high.out, headZ);
      if (inward) quad(p0, p1, p2, p3);
      else quad(p3, p2, p1, p0);
    }
  }
  const positions = new Float32Array(verts.length * 3);
  verts.forEach((v, k) => positions.set(v, k * 3));
  return { positions, indices: Uint32Array.from(tris), vertexCount: verts.length, triangleCount: tris.length / 3 };
}
