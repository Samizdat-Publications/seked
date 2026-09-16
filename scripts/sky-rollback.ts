/**
 * Bake the sky-rollback cinematic: where every bright star stands, frame by
 * frame, as the epoch runs from the catalogue's own year back past the
 * fourth dynasty to the eleventh millennium BCE, with Alnitak held on the
 * meridian throughout.
 *
 * The plan's cinematic is "a sky-rollback animation whose star positions are
 * baked from the sky package, so Blender and the web never disagree about
 * where Alnitak was". This is that bake. Nothing is interpolated in Blender:
 * each frame's positions are computed here, by the same `positionsAtEpoch`
 * and `altAz` the claims are judged with, and handed over as data. The star
 * on the meridian is the one claim C2 puts at the King's Chamber's south
 * shaft, and the shaft's own angle travels in the header so the film can
 * draw what the claim compares.
 *
 * Two files: `build/sky-rollback.json`, the header, and beside it the binary
 * the header names, every star's azimuth and altitude at every frame as
 * little-endian float32, frame-major. Eight thousand stars over four hundred
 * frames is seven million numbers, which is what keeps them out of the JSON.
 *
 *     pnpm sky-rollback [--frames 480] [--fps 24]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadDatabase, REPO_ROOT, resolve } from '@seked/data';
import {
  altAz,
  apply,
  equatorialToHorizon,
  expandBrightStars,
  ltpb,
  loadBrightStars,
  loadNamedStars,
  positionAtEpoch,
  positionsAtEpoch,
  starById,
  transitAltitude,
  transitLst,
} from '@seked/sky';

/** The star held on the meridian, by `data/stars/named.json`'s id: C2's star for the King's Chamber's south shaft. */
export const MERIDIAN_STAR = 'alnitak';

/** The shaft the film draws against it, by the key claim C2 names. */
export const SHAFT_KEY = 'kc.shaft.south';

/** Frames per second of the film the bake is laid out for. */
export const DEFAULT_FPS = 24;

/** Twenty seconds at that rate. */
export const DEFAULT_FRAMES = 480;

/**
 * The film's schedule, as fractions of its length and the epoch reached
 * there. It opens on the sky as the catalogue has it, rolls back to Bauval
 * and Gilbert's 2450 BCE and holds, because that is the moment claim C2 is
 * about, then goes on to Hancock and Bauval's 10,500 BCE and holds again.
 * Between the holds the epoch eases in and out so the sky does not lurch.
 * The times are composition; the epochs are the claims'.
 */
export const SCHEDULE: readonly { at: number; epoch: number }[] = [
  { at: 0.0, epoch: 2000 },
  { at: 0.075, epoch: 2000 },
  { at: 0.55, epoch: -2449 },
  { at: 0.65, epoch: -2449 },
  { at: 0.95, epoch: -10499 },
  { at: 1.0, epoch: -10499 },
];

/** Hermite ease, so a segment starts and stops at rest. */
const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** The epoch at a fraction of the film, from the schedule. */
export function epochAt(fraction: number, schedule = SCHEDULE): number {
  const t = Math.min(Math.max(fraction, 0), 1);
  for (let i = 1; i < schedule.length; i++) {
    const a = schedule[i - 1]!;
    const b = schedule[i]!;
    if (t <= b.at) {
      if (b.at === a.at) return b.epoch;
      return a.epoch + (b.epoch - a.epoch) * smoothstep((t - a.at) / (b.at - a.at));
    }
  }
  return schedule[schedule.length - 1]!.epoch;
}

/** Angles to four decimals, a third of an arcsecond, well past what any of this means. */
const round = (x: number, places = 4): number => Number(x.toFixed(places));

export interface RollbackFrame {
  frame: number;
  /** Julian epoch in astronomical year numbering, as the rest of the package writes it. */
  epoch: number;
  /** Local sidereal time, as an angle, at which the meridian star transits at that epoch. */
  lstDeg: number;
  /** The meridian star's transit altitude at that epoch: what C2 compares the shaft to. */
  meridianAltDeg: number;
  /**
   * The rotation carrying an ICRS unit vector to east, north and up at this
   * frame's epoch and sidereal time, rows first: the precession matrix and
   * horizon turn the frame's stars are placed with, for a sky image drawn on
   * ICRS axes such as the Milky Way.
   */
  icrsToEnu: number[][];
}

export interface SkyRollback {
  generated: string;
  preset: string;
  fps: number;
  observer: { latitudeDeg: number; longitudeDeg: number; keys: { latitude: string; longitude: string } };
  meridian: { star: string; name: string; from: string };
  shaft: { key: string; angleDeg: number; source: string; from: string };
  schedule: readonly { at: number; epoch: number }[];
  catalogue: { source: string; attribution: string; magnitudeLimit: number; count: number; mag: number[]; ci: number[] };
  positions: { file: string; layout: string; from: string };
  frames: RollbackFrame[];
}

function required(env: Record<string, number>, name: string, what: string): number {
  const value = env[name];
  if (value === undefined) throw new Error(`${what} has no "${name}"`);
  return value;
}

export interface BuiltRollback {
  header: SkyRollback;
  /** azimuth, altitude for each star of each frame, frame-major, degrees. */
  positions: Float32Array;
}

export function buildSkyRollback(frames = DEFAULT_FRAMES, fps = DEFAULT_FPS, presetId = 'canonical'): BuiltRollback {
  if (!Number.isInteger(frames) || frames < 2) throw new Error(`a film needs at least two frames, not ${frames}`);
  const db = loadDatabase();
  const { values, records } = resolve(db, presetId);
  const where = `preset ${presetId}`;
  const latitudeDeg = required(values, 'g1.center.latitude', where);
  const longitudeDeg = required(values, 'g1.center.longitude', where);
  const shaftAngleDeg = required(values, `${SHAFT_KEY}.angle`, where);

  const meridianStar = starById(loadNamedStars(), MERIDIAN_STAR);
  const catalogue = loadBrightStars();
  const bright = expandBrightStars(catalogue);
  const count = bright.length;

  const positions = new Float32Array(frames * count * 2);
  const baked: RollbackFrame[] = [];
  for (let frame = 0; frame < frames; frame++) {
    const epoch = epochAt(frame / (frames - 1));
    const meridianAt = positionAtEpoch(meridianStar, epoch);
    const lstDeg = transitLst(meridianAt.raDeg);
    const at = positionsAtEpoch(bright, epoch);
    const base = frame * count * 2;
    for (let i = 0; i < count; i++) {
      const { altDeg, azDeg } = altAz({ raDeg: at[i]!.raDeg, decDeg: at[i]!.decDeg, latDeg: latitudeDeg, lstDeg });
      positions[base + 2 * i] = azDeg;
      positions[base + 2 * i + 1] = altDeg;
    }
    const precession = ltpb(epoch);
    const horizon = equatorialToHorizon(latitudeDeg, lstDeg);
    const columns = ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as const).map((e) => apply(horizon, apply(precession, [e[0], e[1], e[2]])));
    baked.push({
      frame,
      epoch: round(epoch, 2),
      lstDeg: round(lstDeg),
      meridianAltDeg: round(transitAltitude(meridianAt.decDeg, latitudeDeg)),
      icrsToEnu: [0, 1, 2].map((row) => columns.map((column) => Number(column[row]!.toFixed(9)))),
    });
  }

  const header: SkyRollback = {
    generated: new Date().toISOString(),
    preset: presetId,
    fps,
    observer: { latitudeDeg, longitudeDeg, keys: { latitude: 'g1.center.latitude', longitude: 'g1.center.longitude' } },
    meridian: { star: MERIDIAN_STAR, name: meridianStar.name, from: 'transitLst(positionAtEpoch(star, epoch).raDeg), every frame' },
    shaft: {
      key: SHAFT_KEY,
      angleDeg: shaftAngleDeg,
      source: records.get(`${SHAFT_KEY}.angle`)?.source ?? '?',
      from: `${SHAFT_KEY}.angle under ${where}`,
    },
    schedule: SCHEDULE,
    catalogue: {
      source: catalogue.source,
      attribution: catalogue.attribution,
      magnitudeLimit: catalogue.magnitudeLimit,
      count,
      mag: bright.map((s) => round(s.mag, 3)),
      ci: bright.map((s) => round(s.ci ?? 0, 3)),
    },
    positions: {
      file: 'sky-rollback.f32',
      layout: 'little-endian float32; for each frame in order, for each star in catalogue order, azimuth then altitude, degrees, azimuth from north through east',
      from: 'altAz(positionsAtEpoch(bright, epoch), latitude, lstDeg) for every star at every frame',
    },
    frames: baked,
  };
  return { header, positions };
}

/** The default places the render script looks for the bake. */
export const SKY_ROLLBACK_PATH = join(REPO_ROOT, 'build', 'sky-rollback.json');

/** Little-endian bytes of the positions, whatever the machine writing them is. */
export function positionBytes(positions: Float32Array): Buffer {
  const out = Buffer.alloc(positions.length * 4);
  for (let i = 0; i < positions.length; i++) out.writeFloatLE(positions[i]!, i * 4);
  return out;
}

export function writeSkyRollback(out = SKY_ROLLBACK_PATH, frames = DEFAULT_FRAMES, fps = DEFAULT_FPS, presetId = 'canonical'): BuiltRollback {
  const built = buildSkyRollback(frames, fps, presetId);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(built.header, null, 2)}\n`);
  writeFileSync(join(dirname(out), built.header.positions.file), positionBytes(built.positions));
  return built;
}

function argument(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0 || i + 1 >= process.argv.length) return fallback;
  const value = Number(process.argv[i + 1]);
  if (!Number.isFinite(value)) throw new Error(`--${name} wants a number, not ${process.argv[i + 1]}`);
  return value;
}

function main(): void {
  const frames = argument('frames', DEFAULT_FRAMES);
  const fps = argument('fps', DEFAULT_FPS);
  const started = Date.now();
  const { header, positions } = writeSkyRollback(SKY_ROLLBACK_PATH, frames, fps);
  const first = header.frames[0]!;
  const last = header.frames[header.frames.length - 1]!;
  console.log(`preset ${header.preset}, ${header.frames.length} frames at ${header.fps} fps, ${header.catalogue.count} stars to magnitude ${header.catalogue.magnitudeLimit}`);
  console.log(`${header.meridian.name} on the meridian: ${first.meridianAltDeg.toFixed(3)} deg at epoch ${first.epoch} to ${last.meridianAltDeg.toFixed(3)} deg at epoch ${last.epoch}`);
  for (const stop of header.schedule) {
    const frame = header.frames[Math.round(stop.at * (header.frames.length - 1))]!;
    console.log(`  ${(stop.at * 100).toFixed(1).padStart(5)} %  frame ${String(frame.frame).padStart(4)}  epoch ${String(frame.epoch).padStart(9)}  ${header.meridian.name} at ${frame.meridianAltDeg.toFixed(3)} deg`);
  }
  console.log(`the ${header.shaft.key} shaft points at ${header.shaft.angleDeg} deg (${header.shaft.source})`);
  console.log(`wrote ${SKY_ROLLBACK_PATH} and ${header.positions.file} (${(positions.byteLength / 1e6).toFixed(1)} MB) in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === pathToFileURL(fileURLToPath(import.meta.url)).href) main();
