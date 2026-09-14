/**
 * Drive Stellarium through scripts/stellarium/transit.ssc and record what it
 * says into data/validation/stellarium.json, which packages/sky's
 * stellarium.test.ts then checks the package against.
 *
 * Nothing in this pipeline is typed twice. The observer comes out of the
 * measurement database and data/sites.json, the Julian Days out of
 * julianEpochToJd, the stars' Hipparcos designations out of the same
 * hyg-bright.json rows the package precesses, and Stellarium's version out of
 * the header of the log it writes on the run. The only numbers that reach the
 * recorded file by any other route are the ones Stellarium printed.
 *
 * Run it with `npx tsx scripts/stellarium/run.ts`. It needs a display:
 * Stellarium opens a window, runs the script and closes itself. If it is still
 * up when the timeout expires this script kills it, so no run can leave one
 * behind. STELLARIUM_EXE and STELLARIUM_USER_DIR override where it looks.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadDatabase, REPO_ROOT, resolve } from '@seked/data';
import { julianEpochToJd, loadBrightStars } from '@seked/sky';

/**
 * The epochs the check is made at. The plan's Phase 3 names 2500 BCE and
 * 10,500 BCE; the claims are written at the Julian epochs −2449 and −10499,
 * which are the years those two round numbers stand for. −2499 is here as
 * well because it is the epoch the shaft claims are argued at.
 */
const EPOCHS = [-2499, -2449, -10499];

/**
 * Two epochs straddling J2000, used for nothing but measuring the proper
 * motion Stellarium's own star catalogue carries. Two thousand years is long
 * enough that the motion is unambiguous and short enough that the curvature
 * Stellarium puts in it is worth under a hundredth of the rate.
 */
const PROPER_MOTION_PROBE = [1000, 3000];

/**
 * Epochs at which to read nothing but the obliquity of date, which is the
 * precession model with no star in it: whatever the two programs disagree
 * about here, no catalogue can be blamed for.
 */
const OBLIQUITY_PROBE = [2000, 1000, -500, -1500, -2449, -5000, -7500, -10499];

/**
 * The stars the shaft and correlation claims turn on, by their id in
 * data/stars/named.json. The first four are claim C2's shafts; Alnilam and
 * Mintaka are here because C4 reads differences of right ascension across the
 * belt at 10,450 BCE, which is exactly where the two precessions are furthest
 * apart along the equator.
 */
const STARS = [
  { id: 'alnitak', catalogueName: 'Alnitak' },
  { id: 'thuban', catalogueName: 'Thuban' },
  { id: 'sirius', catalogueName: 'Sirius' },
  { id: 'kochab', catalogueName: 'Kochab' },
  { id: 'alnilam', catalogueName: 'Alnilam' },
  { id: 'mintaka', catalogueName: 'Mintaka' },
];

/** How long to give Stellarium before deciding the run has hung, in milliseconds. */
const TIMEOUT_MS = 5 * 60 * 1000;

const SCRIPT_NAME = 'seked-transit.ssc';
const OUTPUT_NAME = 'seked-transit.json';

function stellariumExecutable(): string {
  const fromEnv = process.env.STELLARIUM_EXE;
  if (fromEnv) return fromEnv;
  const candidates = [
    join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Stellarium', 'stellarium.exe'),
    join(process.env.PROGRAMFILES ?? '', 'Stellarium', 'stellarium.exe'),
    '/usr/bin/stellarium',
    '/Applications/Stellarium.app/Contents/MacOS/stellarium',
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error(`no Stellarium found; set STELLARIUM_EXE (looked in ${candidates.join(', ')})`);
  return found;
}

/** Stellarium's own user directory, which is the only place its scripts may write. */
function stellariumUserDir(): string {
  const fromEnv = process.env.STELLARIUM_USER_DIR;
  if (fromEnv) return fromEnv;
  if (process.platform === 'win32') return join(process.env.APPDATA ?? '', 'Stellarium');
  if (process.platform === 'darwin') return join(process.env.HOME ?? '', 'Library', 'Application Support', 'Stellarium');
  return join(process.env.HOME ?? '', '.stellarium');
}

/**
 * The version Stellarium itself reports, read out of the third line of the log
 * it has just written, so the recorded file cannot claim a version that did
 * not produce it.
 */
function versionFromLog(userDir: string): string {
  const log = readFileSync(join(userDir, 'log.txt'), 'utf8');
  const match = /This is Stellarium ([0-9][^\s]*) \(v([^)]+)\)/.exec(log);
  if (!match) throw new Error(`no version line in ${join(userDir, 'log.txt')}`);
  return match[2] as string;
}

function run(exe: string, scriptName: string): Promise<void> {
  return new Promise((done, fail) => {
    const child = spawn(exe, ['--startup-script', scriptName, '--full-screen', 'no'], { stdio: 'ignore' });
    const timer = setTimeout(() => {
      child.kill();
      fail(new Error(`Stellarium did not finish within ${TIMEOUT_MS / 1000}s; killed it`));
    }, TIMEOUT_MS);
    child.on('error', (e) => {
      clearTimeout(timer);
      fail(e);
    });
    child.on('exit', () => {
      clearTimeout(timer);
      done();
    });
  });
}

const db = loadDatabase();
const { values, records } = resolve(db, 'canonical');
const site = db.sites.find((s) => s.id === 'giza');
if (!site) throw new Error('data/sites.json has no site "giza"');

const latitudeDeg = values['g1.center.latitude'] as number;
const longitudeDeg = values['g1.center.longitude'] as number;

// The Hipparcos designation of each star, taken from the catalogue rows the
// package precesses, so Stellarium is asked about the same object and not
// about whatever its own name index makes of the word "Sirius".
const bright = loadBrightStars();
const column = Object.fromEntries(bright.columns.map((name, i) => [name, i]));
const designationOf = (catalogueName: string): string => {
  const row = bright.stars.find((r) => r[column['name'] as number] === catalogueName);
  if (!row) throw new Error(`${catalogueName} is not in data/stars/hyg-bright.json`);
  const id = row[column['id'] as number] as string;
  const hip = /^hip(\d+)$/.exec(id);
  if (!hip) throw new Error(`${catalogueName} has no Hipparcos number in the catalogue (id "${id}")`);
  return `HIP ${hip[1]}`;
};

const input = {
  observer: {
    name: site.name,
    latitudeDeg,
    longitudeDeg,
    elevationM: site.origin.elevation,
  },
  epochs: EPOCHS.map((epoch) => ({ epoch, jd: julianEpochToJd(epoch) })),
  properMotionProbe: PROPER_MOTION_PROBE.map((epoch) => ({ epoch, jd: julianEpochToJd(epoch) })),
  obliquityProbe: OBLIQUITY_PROBE.map((epoch) => ({ epoch, jd: julianEpochToJd(epoch) })),
  stars: STARS.map((s) => ({ id: s.id, designation: designationOf(s.catalogueName) })),
  outputFile: OUTPUT_NAME,
};

const userDir = stellariumUserDir();
const scriptsDir = join(userDir, 'scripts');
mkdirSync(scriptsDir, { recursive: true });
const body = readFileSync(join(REPO_ROOT, 'scripts', 'stellarium', 'transit.ssc'), 'utf8');
const prelude = `// Generated by scripts/stellarium/run.ts. Do not edit; edit transit.ssc.\nvar SEKED = ${JSON.stringify(input, null, 2)};\n\n`;
writeFileSync(join(scriptsDir, SCRIPT_NAME), prelude + body);

const exe = stellariumExecutable();
console.log(`running ${exe} on ${join(scriptsDir, SCRIPT_NAME)}`);
await run(exe, SCRIPT_NAME);

const raw = readFileSync(join(userDir, OUTPUT_NAME), 'utf8').trim();
if (raw.startsWith('SEKED_ERROR')) throw new Error(`the Stellarium script failed: ${raw}`);
const observed = JSON.parse(raw) as { observerAsSet: { latitudeDeg: number; longitudeDeg: number; planet: string } };

// Stellarium asks the network where it is while a script is already running,
// and the answer arrives whenever it arrives; a run that was quietly moved
// somewhere else must not be written down as a run from Giza. The script
// itself refuses to proceed until the observer stays put, and this is the
// second lock on the same door.
const set = observed.observerAsSet;
const slipped = Math.abs(set.latitudeDeg - latitudeDeg) > 1e-3 || Math.abs(set.longitudeDeg - longitudeDeg) > 1e-3 || set.planet !== 'Earth';
if (slipped) {
  throw new Error(
    `Stellarium observed from ${set.latitudeDeg}, ${set.longitudeDeg} on ${set.planet}, not from ${latitudeDeg}, ${longitudeDeg} on Earth; nothing written`,
  );
}

const recorded = {
  note: 'Written by scripts/stellarium/run.ts. Every number under "epochs" is Stellarium\'s; everything else says how it was asked.',
  program: 'Stellarium',
  version: versionFromLog(userDir),
  recorded: new Date().toISOString().slice(0, 10),
  script: 'scripts/stellarium/transit.ssc',
  generator: 'scripts/stellarium/run.ts',
  observer: {
    ...input.observer,
    latitudeSource: records.get('g1.center.latitude')?.source ?? null,
    longitudeSource: records.get('g1.center.longitude')?.source ?? null,
    elevationSource: 'data/sites.json giza.origin.elevation',
    preset: 'canonical',
  },
  stars: input.stars,
  ...observed,
};

const outDir = join(REPO_ROOT, 'data', 'validation');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, 'stellarium.json');
writeFileSync(out, `${JSON.stringify(recorded, null, 2)}\n`);
console.log(`wrote ${out} from Stellarium ${recorded.version}`);
