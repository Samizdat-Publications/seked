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
 */

export const FIGURES = ['ditch-plan', 'belt-plan', 'pi-circle'] as const;
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
