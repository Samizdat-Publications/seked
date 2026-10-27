/// <reference lib="dom" />
// the exhibit's sky module it borrows draws on a canvas, so its types are the browser's
/**
 * Bake chapter 2's Leo film: every bright star, frame by frame, at the spring equinox's nautical twilight as the
 * epoch winds from today back to claim C5's 10,500 BCE, over the First Time lion. The ground's light is the same in
 * every frame (the sun the same depth under the same horizon); the stars slide, until Leo stands over the place the
 * equinox sun will rise.
 *
 * Each frame's sidereal time is the exhibit's own `sunAt` for the leaf's moment (render/stations.json's
 * `equinox-twilight`) at that frame's epoch, so the film's last frame is the sky the exhibit draws live over the
 * panorama it hands over to. Positions are `positionsAtEpoch` and `altAz`, as in scripts/sky-rollback.ts, written in
 * its layout so blender/render_sky.py's `load_rollback` reads them.
 *
 *     npx tsx scripts/sky-leo.ts [--frames 270] [--fps 30]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadDatabase, REPO_ROOT, resolve } from '@seked/data';
import { altAz, apply, equatorialToHorizon, expandBrightStars, loadBrightStars, ltpb, positionsAtEpoch } from '@seked/sky';
import { epochAt as skyEpochAt, SKY_RUN, sunAt, TODAY } from '../apps/exhibit/src/sky';
import { positionBytes } from './sky-rollback';

/** The moment the leaf (`ch2-leo`) and its panorama are lit at. */
export const MOMENT = 'equinox-twilight';

/** The constellation the film draws, as data/stars/figures.json keys it. */
export const FIGURE = 'Leo';

/**
 * The film's year at `t` seconds: the exhibit's own wind (sky.ts `epochAt`, SKY_RUN seconds, eased), from today to
 * C5's year, so the sky panel's year and slider, which wind by it from the leaf's start, run with the film.
 */
export const epochAtSeconds = (t: number, c5: number): number => skyEpochAt(TODAY, c5, t);

/** C5's epoch from its claim file, so the film's end is not typed here. */
function claimEpoch(id: string): number {
  const text = readFileSync(join(REPO_ROOT, 'data', 'claims', `${id}.yaml`), 'utf8');
  const m = /^epoch:\s*(-?\d+(?:\.\d+)?)/m.exec(text);
  if (!m) throw new Error(`claim ${id} has no epoch`);
  return Number(m[1]);
}

function argument(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : Number(process.argv[i + 1]);
}

function main(): void {
  const frames = argument('frames', 270);
  const fps = argument('fps', 30);
  const { values } = resolve(loadDatabase(), 'canonical');
  const latitudeDeg = values['g1.center.latitude']!;
  const longitudeDeg = values['g1.center.longitude']!;
  const stations = JSON.parse(readFileSync(join(REPO_ROOT, 'render', 'stations.json'), 'utf8'));
  const moment = stations.moments[MOMENT] as { date: string; solar: number };
  const c5 = claimEpoch('C5');
  const catalogue = loadBrightStars();
  const bright = expandBrightStars(catalogue);
  const count = bright.length;
  const positions = new Float32Array(frames * count * 2);
  const rows = [];
  for (let f = 0; f < frames; f++) {
    const epoch = epochAtSeconds(f / fps, c5);
    const sun = sunAt({ date: moment.date, solar: moment.solar }, epoch, latitudeDeg);
    const at = positionsAtEpoch(bright, epoch);
    for (let i = 0; i < count; i++) {
      const { altDeg, azDeg } = altAz({ raDeg: at[i]!.raDeg, decDeg: at[i]!.decDeg, latDeg: latitudeDeg, lstDeg: sun.lstDeg });
      positions[(f * count + i) * 2] = azDeg;
      positions[(f * count + i) * 2 + 1] = altDeg;
    }
    const precession = ltpb(epoch);
    const horizon = equatorialToHorizon(latitudeDeg, sun.lstDeg);
    const columns = ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as const).map((e) => apply(horizon, apply(precession, [e[0], e[1], e[2]])));
    rows.push({ frame: f, epoch: Number(epoch.toFixed(2)), lstDeg: Number(sun.lstDeg.toFixed(4)), sunAltDeg: Number(sun.altDeg.toFixed(3)),
                sunAzDeg: Number(sun.azDeg.toFixed(3)), icrsToEnu: [0, 1, 2].map((r) => columns.map((c) => Number(c[r]!.toFixed(9)))) });
  }
  // Leo's figure (data/stars/figures.json, Stellarium's modern sky culture), as segments between catalogue indices,
  // so the film draws the lines the exhibit draws live
  const figures = JSON.parse(readFileSync(join(REPO_ROOT, 'data', 'stars', 'figures.json'), 'utf8')).figures;
  const index = new Map(bright.map((s, i) => [s.id, i]));
  const segments: [number, number][] = [];
  for (const run of figures[FIGURE].lines as string[][]) {
    for (let i = 1; i < run.length; i++) {
      const a = index.get(run[i - 1]!), b = index.get(run[i]!);
      if (a !== undefined && b !== undefined) segments.push([a, b]);
    }
  }
  const header = {
    generated: new Date().toISOString(), preset: 'canonical', fps, moment: MOMENT,
    observer: { latitudeDeg, longitudeDeg, keys: { latitude: 'g1.center.latitude', longitude: 'g1.center.longitude' } },
    schedule: { from: TODAY, to: c5, runSeconds: SKY_RUN, easing: "apps/exhibit/src/sky.ts epochAt" },
    figure: { key: FIGURE, name: figures[FIGURE].name, segments, from: 'data/stars/figures.json' },
    catalogue: { source: catalogue.source, attribution: catalogue.attribution, magnitudeLimit: catalogue.magnitudeLimit, count,
                 mag: bright.map((s) => Number(s.mag.toFixed(3))), ci: bright.map((s) => Number((s.ci ?? 0).toFixed(3))) },
    positions: { file: 'sky-leo.f32', layout: 'little-endian float32; for each frame, for each star in catalogue order, azimuth then altitude, degrees',
                 from: "altAz(positionsAtEpoch(bright, epoch)) at the exhibit's sunAt(moment, epoch).lstDeg" },
    frames: rows,
  };
  const out = join(REPO_ROOT, 'build', 'sky-leo.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(header)}\n`);
  writeFileSync(join(dirname(out), header.positions.file), positionBytes(positions));
  const last = rows[rows.length - 1]!;
  console.log(`${frames} frames at ${fps} fps, ${count} stars, ${rows[0]!.epoch} to ${last.epoch}; the sun at ${last.sunAltDeg} deg, azimuth ${last.sunAzDeg}`);
}

main();
