/**
 * The exhibit's own figures: small live drawings laid over the stage, named in a leaf's `draw` like an overlay
 * (and cued by a word the same way). Each is computed from the database, never drawn by eye.
 *
 * `ditch-plan`: the Sphinx ditch in plan, the statue's OSM outline and the two margins ARCE's drawing d-gen-008
 * gives (scaled from the plate, not yet checked), with where the visitor stands. Only what is measured is drawn:
 * the plate maps no floor strip on the south, and the east opens onto the temple.
 *
 * `belt-plan`: the three pyramids' centres in plan (Petrie's offsets, from the bundle) and Orion's belt at C4's
 * epoch laid over them as C4 compares them: as seen looking south, Alnitak on Khufu, scaled so that Mintaka falls
 * as far from it as Menkaure, and not turned, so the angle between the two diagonals is the claim's residual.
 *
 * `pi-circle`: A1 drawn: the Great Pyramid's base square and, about the same centre, the circle whose radius is its
 * original height, the two outlines nearly the same length. Both from the bundle's environment.
 *
 * `north-square`: C1 drawn: the base square turned by its measured orientation, exaggerated by the claim's own
 * factor, over a square set to true north.
 *
 * `phi-triangle`: A2 drawn: the right triangle inside the pyramid from its centre, half the base along the ground,
 * the height up and the apothem down the face, with the apothem's ratio to half the base, near φ.
 *
 * `earth-scale`: B1 drawn: the pyramid's profile grown by the claim's own scale factor and stood on the equator under
 * the northern half of the Earth, its apex at the pole. The factor is the claim's overlay's, never typed here.
 *
 * `allan-rank`: the 2026 study's shape test, cited: every triplet of bright stars it tried laid along one line, best
 * first, and the share that beat the pyramids' triangle marked at its end. The rank and the count are records
 * (data/measurements/orion-correlation.json); the p-value is their quotient.
 */

export const FIGURES = ['ditch-plan', 'belt-plan', 'pi-circle', 'north-square', 'phi-triangle', 'earth-scale', 'allan-rank'] as const;
export type FigureId = (typeof FIGURES)[number];
export const isFigure = (id: string): id is FigureId => (FIGURES as readonly string[]).includes(id);

export interface Margin { value: number; sigma: number; source: string; method: string; verified: boolean }
export interface SphinxPlanData { rings: [number, number][][]; north: Margin; west: Margin }

export interface DitchPlan {
  rings: [number, number][][];
  /** The statue's extent. */
  minX: number; maxX: number; minY: number; maxY: number;
  /** The ditch's north wall (a line of constant y) and west wall (constant x), from the margins. */
  northWall: number; westWall: number;
  /** Where the north margin and the west margin are measured across, for their dimension lines. */
  northAt: number; westAt: number;
}

/** The plan from the statue's rings and the two margins. */
export function ditchPlan(d: SphinxPlanData): DitchPlan {
  const xs = d.rings.flat().map((p) => p[0]), ys = d.rings.flat().map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  return {
    rings: d.rings, minX, maxX, minY, maxY,
    northWall: maxY + d.north.value, westWall: minX - d.west.value,
    // the north margin is the mid-body figure (the record's note), the west one across the rump's widest part
    northAt: (minX + maxX) / 2 - 8, westAt: (minY + maxY) / 2,
  };
}

const fmt = (m: Margin) => `${m.value.toFixed(1)} ± ${m.sigma.toFixed(1)} m`;

/** The plan as SVG, north up, `here` the visitor's station in the frame. */
export function ditchPlanSvg(d: SphinxPlanData, here: [number, number], width = 300): string {
  const p = ditchPlan(d);
  const pad = 6;
  // room on the left for the west margin's label, which stands outside the wall
  const x0 = Math.min(p.westWall - 26, here[0]) - pad, x1 = p.maxX + pad;
  const y0 = Math.min(p.minY, here[1]) - pad, y1 = p.northWall + pad;
  const k = width / (x1 - x0), height = Math.round((y1 - y0) * k);
  const X = (x: number) => ((x - x0) * k).toFixed(1), Y = (y: number) => ((y1 - y) * k).toFixed(1);
  const ring = (r: [number, number][]) => r.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ');
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="The Sphinx ditch in plan: ${fmt(d.north)} of floor north of the statue, ${fmt(d.west)} west of the rump">
  ${p.rings.map((r) => `<polygon class="statue" points="${ring(r)}"/>`).join('')}
  <line class="wall" x1="${X(p.westWall)}" y1="${Y(p.northWall)}" x2="${X(p.maxX)}" y2="${Y(p.northWall)}"/>
  <line class="wall" x1="${X(p.westWall)}" y1="${Y(p.northWall)}" x2="${X(p.westWall)}" y2="${Y(p.minY)}"/>
  <line class="dim" x1="${X(p.northAt)}" y1="${Y(p.maxY)}" x2="${X(p.northAt)}" y2="${Y(p.northWall)}"/>
  <text class="lab" x="${(Number(X(p.northAt)) + 6).toFixed(1)}" y="${((Number(Y(p.maxY)) + Number(Y(p.northWall))) / 2 + 4).toFixed(1)}">${fmt(d.north)}</text>
  <line class="dim" x1="${X(p.westWall)}" y1="${Y(p.westAt)}" x2="${X(p.minX)}" y2="${Y(p.westAt)}"/>
  <text class="lab" x="${(Number(X(p.westWall)) - 5).toFixed(1)}" y="${(Number(Y(p.westAt)) + 4).toFixed(1)}" text-anchor="end">${fmt(d.west)}</text>
  <circle class="here" cx="${X(here[0])}" cy="${Y(here[1])}" r="4"/>
  <text class="here-lab" x="${(Number(X(here[0])) + 8).toFixed(1)}" y="${(Number(Y(here[1])) + 4).toFixed(1)}">you are here</text>
  <text class="north" x="${width - 10}" y="14" text-anchor="end">N &#8593;</text>
</svg>`;
}

/**
 * What the plan needs, cut from data/footprints/giza.json (the features in the Sphinx's group) and
 * data/measurements/sphinx-enclosure.json; the build does this so the page does not carry the whole plateau.
 */
export function sphinxPlanData(footprints: { features: { group?: string; ring: [number, number][] }[] },
  records: { key: string; value: number; sigma?: number; source: string; method?: string; verified?: boolean }[]): SphinxPlanData {
  const margin = (key: string): Margin => {
    const r = records.find((x) => x.key === key);
    if (!r) throw new Error(`no ${key} in sphinx-enclosure.json`);
    return { value: r.value, sigma: r.sigma ?? 0, source: r.source, method: r.method ?? '', verified: !!r.verified };
  };
  const rings = footprints.features.filter((f) => f.group === 'sphinx').map((f) => f.ring);
  if (!rings.length) throw new Error('no Sphinx in the footprints');
  return { rings, north: margin('sphinx.enclosure.margin.north'), west: margin('sphinx.enclosure.margin.west') };
}

/** A star's place at an epoch, degrees. */
export interface RaDec { ra: number; dec: number }
export interface BeltPlan {
  /** The pyramids' centres, metres east and north of Khufu's, and their mean base sides where the database has them. */
  pyramids: { id: 'g1' | 'g2' | 'g3'; x: number; y: number; side: number | null }[];
  /** The belt stars on the ground, Alnitak on Khufu, in the same metres. */
  stars: { name: 'Alnitak' | 'Alnilam' | 'Mintaka'; x: number; y: number }[];
}

/**
 * The belt laid on the plan as C4's first comparison reads it: on a tangent plane about Alnilam (east = Δra cos
 * dec, the claim's own x), seen looking south so that a higher declination lies further from the viewer, which on
 * the ground is south; Alnitak set on Khufu's centre and the whole scaled so Alnitak to Mintaka is Khufu to
 * Menkaure. Nothing is turned: the claim's angle is each diagonal's against the meridian.
 */
export function beltPlan(ground: Record<string, number>, belt: { alnitak: RaDec; alnilam: RaDec; mintaka: RaDec }): BeltPlan | null {
  const g = (k: string) => ground[k];
  const w2 = g('g2.centre.offset.west'), s2 = g('g2.centre.offset.south'), w3 = g('g3.centre.offset.west'), s3 = g('g3.centre.offset.south');
  if ([w2, s2, w3, s3].some((v) => v === undefined)) return null;
  const pyramids: BeltPlan['pyramids'] = [
    { id: 'g1', x: 0, y: 0, side: g('g1.base.side.mean') ?? null },
    { id: 'g2', x: -w2!, y: -s2!, side: g('g2.base.side.mean') ?? null },
    { id: 'g3', x: -w3!, y: -s3!, side: g('g3.base.side.mean') ?? null },
  ];
  const cos = Math.cos((belt.alnilam.dec * Math.PI) / 180);
  const fold = (d: number) => ((d + 540) % 360) - 180;
  const sky = (s: RaDec) => [fold(s.ra - belt.alnitak.ra) * cos, -(s.dec - belt.alnitak.dec)] as const;
  const [mx, my] = sky(belt.mintaka);
  const k = Math.hypot(w3!, s3!) / Math.hypot(mx, my);
  const stars: BeltPlan['stars'] = (['Alnitak', 'Alnilam', 'Mintaka'] as const).map((name) => {
    const [x, y] = sky(belt[name.toLowerCase() as 'alnitak' | 'alnilam' | 'mintaka']);
    return { name, x: x * k, y: y * k };
  });
  return { pyramids, stars };
}

/** The plan as SVG, north up. */
export function beltPlanSvg(p: BeltPlan, width = 300): string {
  const xs = [...p.pyramids.map((q) => q.x), ...p.stars.map((s) => s.x)], ys = [...p.pyramids.map((q) => q.y), ...p.stars.map((s) => s.y)];
  // room either side for the names, which stand beside their points
  const padX = 300, padY = 130;
  const x0 = Math.min(...xs) - padX, x1 = Math.max(...xs) + padX, y0 = Math.min(...ys) - padY, y1 = Math.max(...ys) + padY;
  const k = width / (x1 - x0), height = Math.round((y1 - y0) * k);
  const X = (x: number) => ((x - x0) * k).toFixed(1), Y = (y: number) => ((y1 - y) * k).toFixed(1);
  const NAMES = { g1: 'Khufu', g2: 'Khafre', g3: 'Menkaure' };
  const [a, , m] = p.stars as [BeltPlan['stars'][number], BeltPlan['stars'][number], BeltPlan['stars'][number]];
  const g3 = p.pyramids[2]!;
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="The three pyramids in plan with Orion's belt laid over them">
  ${p.pyramids.map((q) => {
    const h = q.side ? (q.side * k) / 2 : 4;
    return `<rect class="statue" x="${(Number(X(q.x)) - h).toFixed(1)}" y="${(Number(Y(q.y)) - h).toFixed(1)}" width="${(2 * h).toFixed(1)}" height="${(2 * h).toFixed(1)}"/>
  <text class="here-lab" x="${(Number(X(q.x)) + h + 4).toFixed(1)}" y="${(Number(Y(q.y)) + 4).toFixed(1)}">${NAMES[q.id]}</text>`;
  }).join('')}
  <line class="dim" x1="${X(0)}" y1="${Y(0)}" x2="${X(g3.x)}" y2="${Y(g3.y)}"/>
  <line class="wall" x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(m.x)}" y2="${Y(m.y)}"/>
  ${p.stars.map((s) => `<circle class="star" cx="${X(s.x)}" cy="${Y(s.y)}" r="3.2"/>`).join('')}
  <text class="lab" x="${(Number(X(m.x)) - 6).toFixed(1)}" y="${(Number(Y(m.y)) - 8).toFixed(1)}" text-anchor="end">Mintaka</text>
  <text class="north" x="10" y="14">N &#8593;</text>
</svg>`;
}

/** A1's two lengths: the base's perimeter and the circumference of a circle of radius the original height, metres. */
export function piCircle(ground: Record<string, number>): { side: number; height: number; perimeter: number; circle: number } | null {
  const side = ground['g1.base.side.mean'], height = ground['g1.height.original'], perimeter = ground['g1.base.perimeter'];
  if (side === undefined || height === undefined || perimeter === undefined) return null;
  return { side, height, perimeter, circle: 2 * Math.PI * height };
}

/** The square and the circle as SVG, the square's outline drawn round first, then the circle's. */
export function piCircleSvg(c: NonNullable<ReturnType<typeof piCircle>>, width = 300): string {
  const r = c.height, half = c.side / 2;
  const extent = Math.max(r, half) * 1.12;
  const k = width / (2 * extent), mid = width / 2;
  return `<svg viewBox="0 0 ${width} ${width}" width="${width}" height="${width}" role="img" aria-label="The Great Pyramid's base square and a circle of radius its height, their outlines nearly equal">
  <rect class="wall draw-on" x="${(mid - half * k).toFixed(1)}" y="${(mid - half * k).toFixed(1)}" width="${(c.side * k).toFixed(1)}" height="${(c.side * k).toFixed(1)}" fill="none" pathLength="1"/>
  <circle class="dim draw-on late" cx="${mid}" cy="${mid}" r="${(r * k).toFixed(1)}" fill="none" pathLength="1"/>
  <line class="dim" x1="${mid}" y1="${mid}" x2="${(mid + r * k).toFixed(1)}" y2="${mid}"/>
  <text class="lab" x="${(mid + (r * k) / 2).toFixed(1)}" y="${mid - 6}" text-anchor="middle">height</text>
  <text class="here-lab" x="${mid}" y="${(mid + half * k - 8).toFixed(1)}" text-anchor="middle">base</text>
</svg>`;
}

/** C1's base: its side, its orientation (degrees, negative west of north) and how far a side's end strays, metres. */
export function northSquare(ground: Record<string, number>): { side: number; orientation: number; stray: number } | null {
  const side = ground['g1.base.side.mean'], orientation = ground['g1.orientation'];
  if (side === undefined || orientation === undefined) return null;
  return { side, orientation, stray: side * Math.tan((Math.abs(orientation) * Math.PI) / 180) };
}

/** The true square in grey, the measured one turned by `exaggeration` times its orientation, north up. */
export function northSquareSvg(n: NonNullable<ReturnType<typeof northSquare>>, exaggeration: number, width = 300): string {
  const mid = width / 2, half = width * 0.3;
  // a turn west of north (negative) is anticlockwise in plan, which with the screen's y running down is a negative angle
  const a = (n.orientation * exaggeration * Math.PI) / 180;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => {
    const px = x! * half, py = y! * half;
    return `${(mid + px * Math.cos(a) - py * Math.sin(a)).toFixed(1)},${(mid + px * Math.sin(a) + py * Math.cos(a)).toFixed(1)}`;
  });
  return `<svg viewBox="0 0 ${width} ${width}" width="${width}" height="${width}" role="img" aria-label="The Great Pyramid's base against true north, its turn drawn ${exaggeration} times larger">
  <line class="dim" x1="${mid}" y1="10" x2="${mid}" y2="${width - 10}"/>
  <rect class="statue" x="${mid - half}" y="${mid - half}" width="${2 * half}" height="${2 * half}" fill="none"/>
  <polygon class="wall draw-on" points="${corners.join(' ')}" fill="none" pathLength="1"/>
  <text class="north" x="${mid + 6}" y="20">true north &#8593;</text>
</svg>`;
}

/** A2's triangle: half the base, the original height and the apothem, metres, and the face's angle, degrees. */
export function phiTriangle(ground: Record<string, number>): { half: number; height: number; apothem: number; angle: number } | null {
  const half = ground['g1.base.half'], height = ground['g1.height.original'], apothem = ground['g1.apothem'], angle = ground['g1.face.angle'];
  if ([half, height, apothem, angle].some((v) => v === undefined)) return null;
  return { half: half!, height: height!, apothem: apothem!, angle: angle! };
}

/** The triangle as SVG: base, height and apothem drawn on in turn, each named. */
export function phiTriangleSvg(t: NonNullable<ReturnType<typeof phiTriangle>>, width = 300): string {
  const pad = 34, k = (width - 2 * pad) / t.half, h = Math.round(t.height * k + 2 * pad);
  const O = [pad, h - pad], B = [pad + t.half * k, h - pad], A = [pad, h - pad - t.height * k];
  const pt = (p: number[]) => `${p[0]!.toFixed(1)},${p[1]!.toFixed(1)}`;
  return `<svg viewBox="0 0 ${width} ${h}" width="${width}" height="${h}" role="img" aria-label="The triangle inside the Great Pyramid: half the base, the height and the apothem">
  <polygon class="statue" points="${pt(O)} ${pt(B)} ${pt(A)}"/>
  <line class="wall draw-on" x1="${O[0]}" y1="${O[1]}" x2="${B[0]}" y2="${B[1]}" pathLength="1"/>
  <line class="dim" x1="${O[0]}" y1="${O[1]}" x2="${A[0]}" y2="${A[1]}"/>
  <line class="wall draw-on late" x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" pathLength="1"/>
  <text class="here-lab" x="${((O[0]! + B[0]!) / 2).toFixed(1)}" y="${(O[1]! + 18).toFixed(1)}" text-anchor="middle">half the base, 1</text>
  <text class="lab" x="${((A[0]! + B[0]!) / 2 + 8).toFixed(1)}" y="${((A[1]! + B[1]!) / 2 - 6).toFixed(1)}">apothem, ${(t.apothem / t.half).toFixed(4)}</text>
  <text class="here-lab" x="${(O[0]! + 6).toFixed(1)}" y="${((O[1]! + A[1]!) / 2).toFixed(1)}">height</text>
</svg>`;
}

/** B1's profile at its scale: half the base and the height grown `scale` times, and the Earth's two radii, metres. */
export function earthScale(ground: Record<string, number>, scale: number): { scale: number; half: number; height: number; polar: number; equatorial: number } | null {
  const half = ground['g1.base.half'], height = ground['g1.height.original'];
  const polar = ground['earth.radius.polar'], equatorial = ground['earth.radius.equatorial'];
  if ([half, height, polar, equatorial].some((v) => v === undefined) || !(scale > 0)) return null;
  return { scale, half: half! * scale, height: height! * scale, polar: polar!, equatorial: equatorial! };
}

/** The northern hemisphere in section, the grown profile drawn on inside it, its apex at the pole. */
export function earthScaleSvg(e: NonNullable<ReturnType<typeof earthScale>>, width = 300): string {
  const pad = 14, k = (width - 2 * pad) / (2 * e.equatorial), cx = width / 2, base = Math.round(e.polar * k + pad + 18);
  const h = base + 22, x = (m: number) => (cx + m * k).toFixed(1), y = (m: number) => (base - m * k).toFixed(1);
  return `<svg viewBox="0 0 ${width} ${h}" width="${width}" height="${h}" role="img" aria-label="The Great Pyramid's profile ${count(e.scale)} times larger inside the northern half of the Earth, its apex at the pole">
  <path class="statue" d="M ${x(-e.equatorial)} ${base} A ${(e.equatorial * k).toFixed(1)} ${(e.polar * k).toFixed(1)} 0 0 1 ${x(e.equatorial)} ${base} Z"/>
  <line class="dim" x1="${cx}" y1="${base}" x2="${cx}" y2="${y(e.polar)}"/>
  <polygon class="wall draw-on" points="${x(-e.half)},${base} ${x(0)},${y(e.height)} ${x(e.half)},${base}" fill="none" pathLength="1"/>
  <text class="lab" x="${cx}" y="${(Number(y(e.polar)) - 6).toFixed(1)}" text-anchor="middle">the pole</text>
  <text class="here-lab" x="${(cx + 16).toFixed(1)}" y="${(Number(y(e.height)) + 16).toFixed(1)}">height &#215; ${count(e.scale)}</text>
  <text class="here-lab" x="${cx}" y="${base + 16}" text-anchor="middle">the equator</text>
</svg>`;
}

/** A count as the page writes it, with thousands commas whatever the browser's locale. */
const count = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** A study's rank among the cases it tried, with the record's source; `verified` only if both records are. */
export interface RankData { rank: number; of: number; source: string; citation: string; verified: boolean }

/** The figures cut from data/measurements/orion-correlation.json and data/sources.json at build time. */
export function allanRankData(records: { key: string; value: number; source: string; verified?: boolean }[],
  sources: { id: string; citation: string }[]): RankData {
  const get = (key: string) => {
    const r = records.find((x) => x.key === key);
    if (!r) throw new Error(`no ${key} in orion-correlation.json`);
    return r;
  };
  const rank = get('orion.allan2026.shape.rank'), of = get('orion.allan2026.shape.triplets');
  const citation = sources.find((s) => s.id === rank.source)?.citation;
  if (!citation) throw new Error(`no source ${rank.source}`);
  return { rank: rank.value, of: of.value, source: rank.source, citation, verified: !!rank.verified && !!of.verified };
}

/** The rank's p-value, the share of the triplets that matched at least as well, to two significant figures. */
export const rankP = (d: RankData) => Number((d.rank / d.of).toPrecision(2));

/** The short cited line: "Allan 2026: rank 1,717 of 695,520, p = 0.0025". */
export function rankLine(d: RankData): string {
  const author = d.citation.split(',')[0]!.trim(), year = /\((\d{4})\)/.exec(d.citation)?.[1] ?? '';
  return `${author} ${year}: rank ${count(d.rank)} of ${count(d.of)}, p = ${rankP(d)}`;
}

/** Every triplet tried as one line, best on the right; the ones that matched the pyramids at least as well in gold. */
export function allanRankSvg(d: RankData, width = 300): string {
  const pad = 10, w = width - 2 * pad, y = 26, top = Math.max(2, (d.rank / d.of) * w);
  return `<svg viewBox="0 0 ${width} 56" width="${width}" height="56" role="img" aria-label="${count(d.of)} triplets of stars, the pyramids' triangle at rank ${count(d.rank)}">
  <line class="dim" x1="${pad}" y1="${y}" x2="${pad + w}" y2="${y}"/>
  <line class="wall draw-on" x1="${(pad + w - top).toFixed(1)}" y1="${y}" x2="${pad + w}" y2="${y}" pathLength="1"/>
  <line class="wall" x1="${(pad + w - top).toFixed(1)}" y1="${y - 7}" x2="${(pad + w - top).toFixed(1)}" y2="${y + 7}"/>
  <text class="here-lab" x="${pad}" y="${y + 20}">${count(d.of)} triplets</text>
  <text class="lab" x="${pad + w}" y="${y - 10}" text-anchor="end">the best ${count(d.rank)}</text>
</svg>`;
}
