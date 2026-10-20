/**
 * The exhibit's own figures: small live drawings laid over the stage, named in a leaf's `draw` like an overlay
 * (and cued by a word the same way). Each is computed from the database, never drawn by eye.
 *
 * `ditch-plan`: the Sphinx ditch in plan, the statue's OSM outline and the two margins ARCE's drawing d-gen-008
 * gives (scaled from the plate, not yet checked), with where the visitor stands. Only what is measured is drawn:
 * the plate maps no floor strip on the south, and the east opens onto the temple.
 */

export const FIGURES = ['ditch-plan'] as const;
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
