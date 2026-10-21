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
 * `luminescence`: the temples' surface luminescence dates (data/measurements/luminescence.json), each a bar of its
 * date and sigma on one line of years, named by its temple, its stone and its sample.
 *
 * `radiocarbon`: the first king's accession and four later ones as radiocarbon models date them
 * (data/measurements/chronology.json), each a bar of its 95 per cent range on one line of years.
 *
 * `khafre-depths`: Khafre's pyramid, its known rooms and the Khafre Project's claimed wells and chambers on one depth
 * scale, with the pyramid's height counted down beside them (the claims' environment).
 *
 * `corridor`: the model answer, the Great Pyramid's north-face corridor in section to scale, every dimension with
 * its error bar (data/measurements/g1-voids.json).
 *
 * `joint-claim`: the joint West and Schoch describe, drawn as they describe it (no survey of one exists).
 *
 * `allan-rank`: the 2026 study's shape test, cited: every triplet of bright stars it tried laid along one line, best
 * first, and the share that beat the pyramids' triangle marked at its end. The rank and the count are records
 * (data/measurements/orion-correlation.json); the p-value is their quotient.
 */

export const FIGURES = ['ditch-plan', 'belt-plan', 'pi-circle', 'north-square', 'phi-triangle', 'earth-scale', 'luminescence', 'radiocarbon', 'corridor', 'khafre-depths', 'hawara-depths', 'looked', 'looked-tests', 'joint-claim', 'allan-rank'] as const;
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

/** A dated sample: astronomical year and sigma, the temple, the stone and the sample's name. */
export interface Dated { year: number; sigma: number; temple: string; stone: string; sample: string; verified: boolean }
export interface LuminescenceData { dates: Dated[]; citation: string }

/** The dates cut from data/measurements/luminescence.json, named from data/structures.json, oldest first. */
export function luminescenceData(records: { key: string; structure: string; value: number; sigma?: number; source: string; verified?: boolean }[],
  structures: { id: string; name: string }[], sources: { id: string; citation: string }[]): LuminescenceData {
  const dates = records.map((r) => {
    const parts = r.key.split('.');
    return {
      year: r.value, sigma: r.sigma ?? 0, verified: !!r.verified,
      temple: structures.find((s) => s.id === r.structure)?.name ?? r.structure,
      stone: parts.find((p) => p === 'granite' || p === 'limestone') ?? 'stone',
      sample: parts[parts.length - 1]!.replace(/^[a-z]+/, (m) => m.toUpperCase()),   // vt9a is VT9a
    };
  }).sort((a, b) => a.year - b.year);
  const citation = sources.find((s) => s.id === records[0]?.source)?.citation;
  if (!dates.length || !citation) throw new Error('no luminescence dates, or no source for them');
  return { dates, citation };
}

/** An astronomical year as the page writes it. */
export const yearText = (y: number) => (y <= 0 ? `${1 - Math.round(y)} BCE` : `${Math.round(y)} CE`);

/** Each date a bar of plus and minus its sigma on one axis of years, oldest at the top. */
export function luminescenceSvg(d: LuminescenceData, width = 300): string {
  const lo = Math.floor(Math.min(...d.dates.map((x) => x.year - x.sigma)) / 500) * 500;
  const hi = Math.ceil(Math.max(...d.dates.map((x) => x.year + x.sigma)) / 500) * 500;
  const pad = 28, row = 50, top = 4, h = top + d.dates.length * row + 26;
  const X = (y: number) => (pad + ((y - lo) / (hi - lo)) * (width - 2 * pad)).toFixed(1);
  const ticks = [];
  // every thousand years as the page counts them (4000 BCE is -3999)
  for (let k = Math.ceil((1 - hi) / 1000); 1 - k * 1000 >= lo; k++) if (k > 0) ticks.push(1 - k * 1000);
  return `<svg viewBox="0 0 ${width} ${h}" width="${width}" height="${h}" role="img" aria-label="Surface luminescence dates from the two temples">
  ${d.dates.map((x, i) => {
    const y = top + i * row + 22;
    // the date under its bar, kept inside the frame
    const mid = Math.min(width - 40, Math.max(40, Number(X(x.year))));
    return `<text class="here-lab" x="${pad - 18}" y="${y - 9}">${x.temple}, ${x.stone} (${x.sample})</text>
  <line class="wall draw-on" x1="${X(x.year - x.sigma)}" y1="${y}" x2="${X(x.year + x.sigma)}" y2="${y}" pathLength="1"/>
  <circle class="star" cx="${X(x.year)}" cy="${y}" r="3"/>
  <text class="lab" x="${mid}" y="${y + 16}" text-anchor="middle">${yearText(x.year)} &#177; ${x.sigma}</text>`;
  }).join('\n  ')}
  <line class="dim" x1="${X(lo)}" y1="${h - 20}" x2="${X(hi)}" y2="${h - 20}"/>
  ${ticks.map((t) => `<text class="north" x="${X(t)}" y="${h - 6}" text-anchor="middle">${yearText(t)}</text>`).join('')}
</svg>`;
}

/** A reign's accession as a radiocarbon model gives it: the 95 per cent range, its median where the paper gives one. */
export interface Reign { king: string; earliest: number; latest: number; median?: number; source: string; verified: boolean }
export interface RadiocarbonData { reigns: Reign[]; citations: Record<string, string> }

/** The accessions cut from data/measurements/chronology.json (`chronology.<king>.accession.<earliest|median|latest>`), oldest first. */
export function radiocarbonData(records: { key: string; value: number; source: string; verified?: boolean }[],
  sources: { id: string; citation: string }[]): RadiocarbonData {
  const byKing = new Map<string, Partial<Reign> & { checked: boolean[] }>();
  for (const r of records) {
    const m = /^chronology\.([a-z_]+)\.accession\.(earliest|median|latest)$/.exec(r.key);
    if (!m) continue;
    const name = m[1]!.replace(/^./, (c) => c.toUpperCase());
    const k = byKing.get(name) ?? { king: name, source: r.source, checked: [] };
    k[m[2] as 'earliest' | 'median' | 'latest'] = r.value;
    k.checked.push(!!r.verified);
    byKing.set(name, k);
  }
  const reigns = [...byKing.values()].map((k) => {
    if (k.earliest === undefined || k.latest === undefined) throw new Error(`${k.king}'s accession lacks a start or an end`);
    return { king: k.king!, earliest: k.earliest, latest: k.latest, median: k.median, source: k.source!, verified: k.checked.every(Boolean) };
  }).sort((a, b) => a.earliest - b.earliest);
  const citations: Record<string, string> = {};
  for (const r of reigns) {
    const c = sources.find((s) => s.id === r.source)?.citation;
    if (!c) throw new Error(`no source ${r.source}`);
    citations[r.source] = c;
  }
  if (!reigns.length) throw new Error('no radiocarbon accessions');
  return { reigns, citations };
}

/** Each accession a bar across its 95 per cent range on one axis of years, the first king at the top. */
export function radiocarbonSvg(d: RadiocarbonData, width = 300): string {
  const lo = Math.floor(Math.min(...d.reigns.map((r) => r.earliest)) / 100) * 100;
  const hi = Math.ceil(Math.max(...d.reigns.map((r) => r.latest)) / 100) * 100;
  const pad = 28, row = 34, top = 4, h = top + d.reigns.length * row + 26;
  const X = (y: number) => (pad + ((y - lo) / (hi - lo)) * (width - 2 * pad)).toFixed(1);
  const ticks = [];
  // every 500 years as the page counts them (3000 BCE is -2999)
  for (let k = Math.ceil((1 - hi) / 500); 1 - k * 500 >= lo; k++) if (k > 0) ticks.push(1 - k * 500);
  return `<svg viewBox="0 0 ${width} ${h}" width="${width}" height="${h}" role="img" aria-label="Radiocarbon dates for the accessions of ${d.reigns.map((r) => r.king).join(', ')}">
  ${d.reigns.map((r, i) => {
    const y = top + i * row + 24;
    // the name and range over the bar, from its start, or back from its end where the frame would cut it
    const late = Number(X(r.earliest)) > width - 150;
    return `<text class="here-lab" x="${late ? X(r.latest) : X(r.earliest)}" y="${y - 8}" text-anchor="${late ? 'end' : 'start'}">${r.king} <tspan class="lab">${1 - r.earliest} to ${yearText(r.latest)}</tspan></text>
  <line class="wall draw-on" x1="${X(r.earliest)}" y1="${y}" x2="${X(r.latest)}" y2="${y}" pathLength="1"/>
  <line class="wall" x1="${X(r.earliest)}" y1="${y - 3}" x2="${X(r.earliest)}" y2="${y + 3}"/><line class="wall" x1="${X(r.latest)}" y1="${y - 3}" x2="${X(r.latest)}" y2="${y + 3}"/>${r.median !== undefined ? `
  <circle class="star" cx="${X(r.median)}" cy="${y}" r="3"/>` : ''}`;
  }).join('\n  ')}
  <line class="dim" x1="${X(lo)}" y1="${h - 20}" x2="${X(hi)}" y2="${h - 20}"/>
  ${ticks.map((t) => `<text class="north" x="${X(t)}" y="${h - 6}" text-anchor="middle">${yearText(t)}</text>`).join('')}
</svg>`;
}

export interface KhafreDepths {
  side: number; height: number; rooms: number; bottom: number; cube: number; wells: number; rows: number; cubes: number;
  /** Depths below their own ground, not the pyramid's base, drawn where the records exist. */
  osiris?: number; paw?: number;
}

/**
 * Khafre's pyramid, its deepest known room and the Khafre Project's wells and chambers, from the claims' environment;
 * the Osiris Shaft and the paw cavity beside them where their depths are records.
 */
export function khafreDepths(env: Record<string, number>): KhafreDepths | null {
  const v = {
    side: env['g2.base.side.mean'], height: env['g2.height.original'], rooms: env['g2.passage.horizontal.floor.begin.up'],
    bottom: env['g2.sar.wells.bottom.up'], cube: env['g2.sar.cube.side'], wells: env['g2.sar.wells.count'],
    rows: env['g2.sar.wells.rows'], cubes: env['g2.sar.cubes.count'],
  };
  if (Object.values(v).some((x) => x === undefined)) return null;
  const osiris = env['osiris_shaft.bottom.depth'], paw = env['sphinx.paw_cavity.top.depth'];
  return { ...(v as KhafreDepths), ...(osiris !== undefined && { osiris }), ...(paw !== undefined && { paw }) };
}

/**
 * Everything on one depth scale, to scale: the pyramid above the ground in stone, its known rooms a hairline just under
 * it, one row of the claimed wells dashed down to their depth and the claimed chambers at their foot, and beside them
 * the pyramid's height counted down. Where the wells stand under the base and where the chambers sit at their foot are
 * look choices: the team publishes no plan with a scale.
 */
export function khafreDepthsSvg(d: KhafreDepths, width = 300): string {
  const top = 14, H = 330, k = (H - top - 26) / (d.height - d.bottom + d.cube);
  const Y = (z: number) => top + (d.height - z) * k, cx = 104, half = (d.side / 2) * k;
  const perRow = Math.round(d.wells / d.rows), cube = d.cube * k;
  const wells = Array.from({ length: perRow }, (_, i) => cx - half * 0.7 + (i * 1.4 * half) / Math.max(1, perRow - 1));
  const bar = width - 54, n = Math.floor(-d.bottom / d.height);
  const f = (z: number) => z.toFixed(1);
  return `<svg viewBox="0 0 ${width} ${H}" width="${width}" height="${H}" role="img" aria-label="Khafre's pyramid above the ground and the claimed wells ${-d.bottom} metres below it, to one scale">
  <line class="dim" x1="8" y1="${f(Y(0))}" x2="${width - 8}" y2="${f(Y(0))}"/>
  <line class="wall" x1="${bar}" y1="${f(Y(0))}" x2="${bar}" y2="${f(Y(d.bottom))}"/>
  <path class="statue" d="M ${f(cx - half)} ${f(Y(0))} L ${f(cx)} ${f(Y(d.height))} L ${f(cx + half)} ${f(Y(0))} Z"/>
  <line class="statue" x1="${f(cx - 6)}" y1="${f(Y(d.rooms) + 1)}" x2="${f(cx + 6)}" y2="${f(Y(d.rooms) + 1)}"/>
  <text class="here-lab halo" x="${f(cx + half + 6)}" y="${f(Y(0) + 12)}">known rooms, ${-d.rooms} m down</text>${d.osiris !== undefined ? `
  <line class="statue" x1="${f(cx + half - 2)}" y1="${f(Y(0))}" x2="${f(cx + half - 2)}" y2="${f(Y(-d.osiris))}"/>
  <text class="here-lab halo" x="${f(cx + half + 6)}" y="${f(Y(0) + 24)}">Osiris Shaft ${d.osiris} m</text>` : ''}${d.paw !== undefined ? `
  <line class="claimed" x1="${f(cx + half + 2)}" y1="${f(Y(0))}" x2="${f(cx + half + 2)}" y2="${f(Y(-d.paw))}"/>
  <text class="here-lab halo" x="${f(cx + half + 6)}" y="${f(Y(0) + 36)}">paw cavity ${d.paw} m</text>` : ''}
  ${wells.map((x) => `<line class="claimed" x1="${f(x)}" y1="${f(Y(0))}" x2="${f(x)}" y2="${f(Y(d.bottom))}"/>`).join('\n  ')}
  ${Array.from({ length: d.cubes }, (_, i) => `<rect class="claimed-box" x="${f(cx + (i - d.cubes / 2) * cube * 1.15)}" y="${f(Y(d.bottom))}" width="${f(cube)}" height="${f(cube)}"/>`).join('')}
  <text class="lab" x="${f(cx + half + 6)}" y="${f(Y(d.bottom) + 4)}">${-d.bottom} m</text>
  <text class="here-lab" x="${f(cx + half + 6)}" y="${f(Y(d.bottom) + 18)}">the claimed chambers</text>
  ${Array.from({ length: n }, (_, i) => `<line class="wall" x1="${bar - 4}" y1="${f(Y(-(i + 1) * d.height))}" x2="${bar + 4}" y2="${f(Y(-(i + 1) * d.height))}"/><text class="here-lab" x="${bar + 8}" y="${f(Y(-(i + 1) * d.height) + 3)}">${i + 1}</text>`).join('\n  ')}
  <text class="here-lab" x="${bar + 8}" y="${f(Y(d.bottom) + 3)}">${(-d.bottom / d.height).toFixed(2)}</text>
  <text class="north" x="${bar}" y="${f(Y(0) - 6)}" text-anchor="middle">heights</text>
</svg>`;
}

export interface HawaraRow { label: string; tier: string; top: number; bottom: number }

/** What lies under Hawara, as the records give it: each a depth range below the ground, the shallow end first. */
const HAWARA = [
  { label: 'Petrie’s chips', structure: 'hawara.labyrinth', keys: ['hawara.labyrinth.chips.depth.south_foot.min', 'hawara.labyrinth.chips.depth.south_foot.max'] },
  { label: 'resistivity closures', structure: 'hawara.ert-closures', keys: ['hawara.ert.closure.shallow.depth', 'hawara.ert.closure.deep.depth'] },
  { label: 'walls, reported', structure: 'hawara.mataha-walls', keys: ['hawara.mataha.walls.depth.min', 'hawara.mataha.walls.depth.max'] },
];

/** Hawara's rows from the environment, each tier its structure's; null until every record and structure is there. */
export function hawaraDepths(env: Record<string, number>, structures: { id: string; evidence?: string }[]): HawaraRow[] | null {
  const rows: HawaraRow[] = [];
  for (const r of HAWARA) {
    const [a, b] = r.keys.map((k) => env[k]);
    const tier = structures.find((x) => x.id === r.structure)?.evidence;
    if (a === undefined || b === undefined || !tier) return null;
    rows.push({ label: r.label, tier, top: Math.min(a, b), bottom: Math.max(a, b) });
  }
  return rows;
}

/** The rows as bars on one depth axis, side by side, drawn as their tiers are drawn everywhere: stone, blue, dashed. */
export function hawaraDepthsSvg(rows: HawaraRow[], width = 300): string {
  const top = 22, H = 200, deepest = Math.ceil(Math.max(...rows.map((r) => r.bottom)) / 2) * 2 + 2;
  const Y = (d: number) => top + (d / deepest) * (H - top - 10), f = (z: number) => z.toFixed(1);
  const cls: Record<string, string> = { excavated: 'statue', instrumented: 'instrumented', claimed: 'claimed-box' };
  const ticks = Array.from({ length: deepest / 2 + 1 }, (_, i) => i * 2);
  let last = -Infinity;
  const m = (d: number) => `${+d.toFixed(1)}`;
  return `<svg viewBox="0 0 ${width} ${H}" width="${width}" height="${H}" role="img" aria-label="Under Hawara, to one depth scale: ${rows.map((r) => r.label).join(', ')}">
  <line class="dim" x1="44" y1="${f(Y(0))}" x2="${width - 8}" y2="${f(Y(0))}"/>
  <text class="north" x="${width - 8}" y="${f(Y(0) - 6)}" text-anchor="end">the ground</text>
  ${ticks.map((d) => `<line class="wall" x1="40" y1="${f(Y(d))}" x2="44" y2="${f(Y(d))}" style="stroke-width: 1"/><text class="here-lab" x="36" y="${f(Y(d) + 3)}" text-anchor="end">${d} m</text>`).join('')}
  ${rows.map((r, i) => {
    const x = 60 + i * 22, mid = (Y(r.top) + Y(r.bottom)) / 2, y = (last = Math.max(mid + 3, last + 26));
    return `<rect class="${cls[r.tier] ?? 'claimed-box'}" x="${x}" y="${f(Y(r.top))}" width="14" height="${f(Y(r.bottom) - Y(r.top))}"/>
  <line class="dim" x1="${x + 14}" y1="${f(mid)}" x2="132" y2="${f(y - 3)}" style="stroke-dasharray: none; stroke-width: 0.5"/>
  <text class="here-lab" x="136" y="${f(y - 2)}">${r.label}</text><text class="lab" x="136" y="${f(y + 10)}">${m(r.top)} to ${m(r.bottom)} m, ${r.tier}</text>`;
  }).join('\n  ')}
</svg>`;
}

export interface LookedRow {
  claim: string; tier: string; top: number; bottom: number;
  /** The deepest anyone has dug, drilled or surveyed there, and who; null where nobody has. */
  looked: number | null; by: string; test: string;
}

/**
 * Each claimed depth beside how deep anyone has actually looked there, from the records: a key with a leading minus is
 * a height on its structure's base plane, turned into a depth. `test` is chapter 9's words for what would settle it.
 */
const LOOKED = [
  { claim: 'cavity under the paws', structure: 'sphinx.paw-cavity', keys: ['sphinx.paw_cavity.top.depth', 'sphinx.paw_cavity.top.depth'],
    looked: 'sphinx.boreholes_2008.depth', by: 'boreholes of 2008, beside it', test: 'open the cavity' },
  { claim: 'wells under Khafre', structure: 'g2.sar-shafts', keys: ['-g2.sar.wells.bottom.up', '-g2.sar.wells.bottom.up'],
    looked: '-g2.passage.horizontal.floor.begin.up', by: 'its own rooms; none drilled', test: 'release the radar data' },
  { claim: 'walls at Hawara', structure: 'hawara.mataha-walls', keys: ['hawara.mataha.walls.depth.min', 'hawara.mataha.walls.depth.max'],
    looked: 'hawara.labyrinth.chips.depth.south_foot.max', by: 'Petrie, through the chips', test: 'dig below the chips' },
];

/** The rows from the environment, each claim's tier its structure's; null until every record and structure is there. */
export function lookedDepths(env: Record<string, number>, structures: { id: string; evidence?: string }[]): LookedRow[] | null {
  const depth = (k: string) => (k.startsWith('-') ? (env[k.slice(1)] === undefined ? undefined : -env[k.slice(1)]!) : env[k]);
  const rows: LookedRow[] = [];
  for (const r of LOOKED) {
    const [a, b] = r.keys.map(depth), looked = depth(r.looked);
    const tier = structures.find((x) => x.id === r.structure)?.evidence;
    if (a === undefined || b === undefined || looked === undefined || !tier) return null;
    rows.push({ claim: r.claim, tier, top: Math.min(a, b), bottom: Math.max(a, b), looked, by: r.by, test: r.test });
  }
  return rows;
}

/**
 * Each claim a row on one logarithmic depth axis (1 to 1,000 m, since the wells are a hundred times deeper than the
 * rest): the claim dashed as its tier is drawn, under it how deep anyone has looked in stone. With `tests`, each row
 * also names what would settle it, as chapter 9 says.
 */
export function lookedSvg(rows: LookedRow[], tests = false, width = 300): string {
  const pad = 14, row = tests ? 66 : 54, top = 4, h = top + rows.length * row + 24, f = (z: number) => z.toFixed(1);
  const X = (d: number) => pad + (Math.log10(Math.min(1000, Math.max(1, d))) / 3) * (width - 2 * pad);
  const m = (d: number) => `${+d.toFixed(1)}`;
  return `<svg viewBox="0 0 ${width} ${h}" width="${width}" height="${h}" role="img" aria-label="How deep anyone has looked, beside each claimed depth: ${rows.map((r) => r.claim).join(', ')}">
  ${rows.map((r, i) => {
    const y = top + i * row + 22, wide = r.bottom - r.top > 0.5;
    const claim = wide
      ? `<rect class="${r.tier === 'claimed' ? 'claimed-box' : 'instrumented'}" x="${f(X(r.top))}" y="${y - 3}" width="${f(X(r.bottom) - X(r.top))}" height="6"/>`
      : `<line class="claimed" x1="${f(X(1))}" y1="${y}" x2="${f(X(r.bottom))}" y2="${y}"/><rect class="claimed-box" x="${f(X(r.bottom) - 3)}" y="${y - 3}" width="6" height="6"/>`;
    const looked = r.looked === null ? '' : `<line class="wall draw-on late" x1="${f(X(1))}" y1="${y + 12}" x2="${f(X(r.looked))}" y2="${y + 12}" pathLength="1"/>`;
    return `<text class="here-lab" x="${pad}" y="${y - 8}">${r.claim} <tspan class="lab">${wide ? `${m(r.top)} to ` : ''}${m(r.bottom)} m, ${r.tier}</tspan></text>
  ${claim}
  ${looked}<text class="here-lab" x="${pad}" y="${y + 24}">looked: ${r.looked === null ? 'nobody' : `${m(r.looked)} m, ${r.by}`}</text>${tests ? `
  <text class="lab" x="${pad}" y="${y + 36}">test: ${r.test}</text>` : ''}`;
  }).join('\n  ')}
  <line class="dim" x1="${pad}" y1="${h - 20}" x2="${width - pad}" y2="${h - 20}"/>
  ${[1, 10, 100, 1000].map((d) => `<line class="wall" x1="${f(X(d))}" y1="${h - 23}" x2="${f(X(d))}" y2="${h - 17}" style="stroke-width: 1"/>`).join('')}
  ${[1, 10, 100, 1000].map((d) => `<text class="north" x="${f(X(d))}" y="${h - 6}" text-anchor="${d === 1 ? 'start' : d === 1000 ? 'end' : 'middle'}">${d.toLocaleString('en-GB')} m</text>`).join('')}
</svg>`;
}

/** A measured length and its sigma, metres. */
export interface Measured { value: number; sigma: number }
export interface CorridorData { along: Measured; across: Measured; height: Measured; floor: Measured; behind: Measured; citation: string; verified: boolean }

/**
 * The north-face corridor cut from data/measurements/g1-voids.json. The keys use the project's sense of length (east
 * to west), so the paper's "length", north to south, is `.width`; here it is `along`, the way the section runs.
 */
export function corridorData(records: { key: string; value: number; sigma?: number; source: string; verified?: boolean }[],
  sources: { id: string; citation: string }[]): CorridorData {
  const K = 'void.north_face_corridor.';
  const rows = records.filter((r) => r.key.startsWith(K));
  const get = (k: string): Measured => {
    const r = rows.find((x) => x.key === K + k);
    if (!r || r.sigma === undefined) throw new Error(`no ${K}${k} with a sigma`);
    return { value: r.value, sigma: r.sigma };
  };
  const citation = sources.find((s) => s.id === rows[0]?.source)?.citation;
  if (!citation) throw new Error('no source for the corridor');
  return {
    along: get('width'), across: get('length'), height: get('height'), floor: get('floor.up'), behind: get('from_north_face'),
    citation, verified: rows.every((r) => !!r.verified),
  };
}

const pm = (m: Measured) => `${m.value.toFixed(2)} &#177; ${m.sigma.toFixed(2)} m`;

/**
 * The corridor in a north-south section, to scale: the box with a faint band of plus and minus its sigma on each
 * face, the gap to the Chevron's north face, and the floor's height above the ground on a broken axis below.
 */
export function corridorSvg(d: CorridorData, width = 300): string {
  const pad = 22, run = d.behind.value + d.along.value, s = (width - 2 * pad) / run;
  const top = 34, h = d.height.value * s, base = top + h, ground = base + 58, H = ground + 18;
  const x0 = pad + d.behind.value * s, x1 = x0 + d.along.value * s;
  const band = (x: number, y: number, w: number, hh: number, e: number, ev: number) =>
    `<rect class="err" x="${(x - e).toFixed(1)}" y="${(y - ev).toFixed(1)}" width="${(w + 2 * e).toFixed(1)}" height="${(hh + 2 * ev).toFixed(1)}"/>`;
  return `<svg viewBox="0 0 ${width} ${H}" width="${width}" height="${H}" role="img" aria-label="The north-face corridor in section, ${d.along.value} metres long and ${d.height.value} high">
  <text class="north" x="${pad}" y="12">N</text><text class="north" x="${width - pad}" y="12" text-anchor="end">S</text>
  ${band(x0, top, d.along.value * s, h, d.along.sigma * s, d.height.sigma * s)}
  <rect class="wall draw-on" x="${x0.toFixed(1)}" y="${top}" width="${(d.along.value * s).toFixed(1)}" height="${h.toFixed(1)}" pathLength="1" fill="none"/>
  <line class="dim" x1="${pad}" y1="${top - 14}" x2="${pad}" y2="${base + 10}"/>
  <text class="here-lab" x="${pad + 3}" y="${base + 14}">${pm(d.behind)} behind the Chevron</text>
  <text class="lab" x="${((x0 + x1) / 2).toFixed(1)}" y="${top - 6}" text-anchor="middle">${pm(d.along)} long</text>
  <text class="lab" x="${(x1 - 4).toFixed(1)}" y="${(top + h / 2 + 4).toFixed(1)}" text-anchor="end">${pm(d.height)} high</text>
  <line class="dim" x1="${(x1 - 10).toFixed(1)}" y1="${base}" x2="${(x1 - 10).toFixed(1)}" y2="${ground - 24}"/>
  <path class="dim" fill="none" style="stroke-dasharray: none" d="M ${(x1 - 16).toFixed(1)} ${ground - 22} l 12 -4 M ${(x1 - 16).toFixed(1)} ${ground - 17} l 12 -4"/>
  <line class="dim" x1="${(x1 - 10).toFixed(1)}" y1="${ground - 17}" x2="${(x1 - 10).toFixed(1)}" y2="${ground}"/>
  <line class="dim" x1="${pad}" y1="${ground}" x2="${width - pad}" y2="${ground}"/>
  <text class="here-lab" x="${(x1 - 18).toFixed(1)}" y="${ground - 6}" text-anchor="end">floor ${d.floor.value.toFixed(1)} &#177; ${d.floor.sigma.toFixed(1)} m up</text>
  <text class="north" x="${pad}" y="${ground + 13}">the ground</text>
</svg>`;
}

/** "Liritzis and Vafiadou (2015)" from "Liritzis, I. & Vafiadou, A. (2015). ...". */
export function shortCite(citation: string): string {
  // a surname may be two words (Bronk Ramsey, Girdland Flink); "et al." stands for the rest
  const authors = citation.split('(')[0]!;
  const names = [...authors.matchAll(/([A-Z][\p{L}'-]+(?: [A-Z][\p{L}'-]+)*), (?:[A-Z]\.\s?)+/gu)].map((m) => m[1]!);
  const year = /\((\d{4})\)/.exec(citation)?.[1];
  const others = names.length > 2 || /et al\./.test(authors);
  return `${others ? `${names[0]} and others` : names.join(' and ')}${year ? ` (${year})` : ''}`;
}

/**
 * The joint West and Schoch describe, in section, schematic: the granite casing pulled forward from a limestone core
 * whose face is rounded and fissured, the granite's back cut to the same profile. It draws a claim, not a survey, and
 * holds no measurement; the shape is a look choice, the same wave for both faces so they visibly fit.
 */
export function jointClaimSvg(width = 300): string {
  const h = 180, top = 16, bottom = h - 34, coreX = 170, gap = 46, n = 24;
  // one profile for the worn face: rounded swells, and two fissures opening toward the top of their course
  const face = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, y = top + t * (bottom - top);
    const fissure = [0.3, 0.7].reduce((a, f) => a + Math.max(0, 1 - Math.abs(t - f) / 0.05) * 9, 0);
    return [coreX - 7 * Math.sin(t * Math.PI * 3) ** 2 + fissure, y] as const;
  });
  const path = (dx: number) => face.map(([x, y], i) => `${i ? 'L' : 'M'} ${(x + dx).toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const core = `${path(0)} L ${width - 8} ${bottom} L ${width - 8} ${top} Z`;
  const granite = `${path(-gap)} L 30 ${bottom} L 30 ${top} Z`;
  return `<svg viewBox="0 0 ${width} ${h}" width="${width}" height="${h}" role="img" aria-label="The claim in section: granite casing pulled away from a rounded, fissured limestone core, its back cut to fit">
  <path class="granite" d="${granite}"/>
  <path class="statue" d="${core}"/>
  <path class="wall draw-on" d="${path(0)}" fill="none" pathLength="1"/>
  <path class="wall draw-on late" d="${path(-gap)}" fill="none" pathLength="1"/>
  <text class="here-lab" x="30" y="${top - 4}">granite, pulled forward</text>
  <text class="here-lab" x="${width - 10}" y="${top - 4}" text-anchor="end">limestone core</text>
  <text class="lab" x="${coreX + 6}" y="${(top + bottom) / 2 + 4}">rounded, fissured</text>
  <text class="lab" x="30" y="${bottom + 20}">its back cut to fit the worn face</text>
</svg>`;
}
