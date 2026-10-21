/**
 * Lines the exhibit draws in the scene from the database itself, beside the renders' own `overlays.json`: the claimed
 * wells under Khafre's pyramid, so chapter 8's "wells" leaf shows them where they are said to be, plunging out of the
 * foot of the picture, rather than the sand above them. Registered like any overlay: project metres, +x east, +y
 * north, +z up from the Great Pyramid's base.
 */
import type { Overlay } from './manifest';

/** The overlays computed here, by name, as `draw` entries name them. */
export const SCENE_OVERLAYS = ['khafre-wells'] as const;

/**
 * Where the wells stand under the base, a look choice (the team publishes no plan with a scale, as the depth figure
 * says): the rows run east to west across this share of the side, this share of the half side north and south of
 * the centre.
 */
export const WELLS_SPREAD = 0.7;
export const WELLS_ROW_OFFSET = 0.25;

/** The wells as an overlay, from the records; null until every one is in the environment. */
export function khafreWells(env: Record<string, number>): Overlay | null {
  const v = {
    west: env['g2.centre.offset.west'], south: env['g2.centre.offset.south'], z: env['g2.base.elevation.relative'],
    side: env['g2.base.side.mean'], bottom: env['g2.sar.wells.bottom.up'], wells: env['g2.sar.wells.count'], rows: env['g2.sar.wells.rows'],
  };
  if (Object.values(v).some((x) => x === undefined)) return null;
  const { west, south, z, side, bottom, wells, rows } = v as Record<keyof typeof v, number>;
  const cx = -west, cy = -south, half = side / 2;
  const perRow = Math.round(wells / rows);
  const lines: Overlay['lines'] = [];
  // the base on the ground, faint, so the wells are read against the pyramid they are under
  const corner = (sx: number, sy: number): [number, number, number] => [cx + sx * half, cy + sy * half, z];
  const square = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
  square.forEach((p, i) => lines.push({ from: p, to: square[(i + 1) % 4]!, style: 'faint' }));
  const tops: [number, number, number][] = [];
  for (let r = 0; r < rows; r++) {
    const y = cy + (rows === 1 ? 0 : (r / (rows - 1) - 0.5) * 2 * WELLS_ROW_OFFSET * half);
    for (let i = 0; i < perRow; i++) {
      const x = cx - WELLS_SPREAD * half + (perRow === 1 ? WELLS_SPREAD * half : (i * 2 * WELLS_SPREAD * half) / (perRow - 1));
      tops.push([x, y, z]);
      lines.push({ from: [x, y, z], to: [x, y, z + bottom], style: 'dash' });
    }
  }
  const east = tops.reduce((a, b) => (b[0] > a[0] ? b : a));
  return {
    lines,
    labels: [{
      at: east, place: 'right',
      text: `${wells} wells, as the Khafre Project reads them`,
      sub: `a claim: down ${-bottom} m, past the foot of the picture; where they stand is a look choice`,
    }],
    suns: [],
  };
}
