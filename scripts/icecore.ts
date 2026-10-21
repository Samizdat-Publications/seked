/**
 * Import the NGRIP oxygen isotope record on GICC05 into data/icecore/.
 *
 *     curl -L -o data/icecore/gicc05-20yr.txt \
 *       https://www.ncei.noaa.gov/pub/data/paleo/icecore/greenland/summit/ngrip/gicc05-20yr.txt
 *     pnpm run icecore
 *
 * Chapter 7's timeline draws the end of the last Ice Age from this file and
 * from nothing else: the curve is imported, never drawn by hand. Out of the
 * file's six columns it keeps the age (years b2k, at the bottom of each
 * 20-year interval), NGRIP's d18O (per mille) and the maximum counting error
 * (years, which the file says to read as 2 sigma); the depths and GRIP are
 * left out. The raw file is gitignored; data/sources.json, source
 * gicc05-ngrip-20yr, carries its URL and sha256. The Younger Dryas's
 * boundaries are records of their own, in data/icecore/events.json.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from '@seked/data';

const DIR = join(DATA_DIR, 'icecore');
const RAW = join(DIR, 'gicc05-20yr.txt');
const OUT = join(DIR, 'ngrip-d18o.json');
const SOURCE = 'gicc05-ngrip-20yr';

if (!existsSync(RAW)) throw new Error(`${RAW} is missing: fetch it with the curl line at the top of this script`);
const raw = readFileSync(RAW);
const sha256 = createHash('sha256').update(raw).digest('hex');
const sources = JSON.parse(readFileSync(join(DATA_DIR, 'sources.json'), 'utf8')) as { id: string; note?: string }[];
const source = sources.find((s) => s.id === SOURCE);
if (!source) throw new Error(`data/sources.json has no ${SOURCE}`);
if (!source.note?.includes(sha256)) console.warn(`warning: the file's sha256 ${sha256} is not the one ${SOURCE} records`);

// the data follow the second "DATA:" header, after its column list
const text = raw.toString('latin1');
const body = text.slice(text.lastIndexOf('DATA:'));
const rows: [number, number, number][] = [];
for (const line of body.split(/\r?\n/)) {
  const f = line.trim().split(/\s+/);
  if (f.length !== 6 || !/^\d+$/.test(f[0]!)) continue;
  const [age, , d18o, , , mce] = f.map(Number) as number[];
  if (!Number.isFinite(d18o!)) continue; // NGRIP has no value in this interval
  rows.push([age!, d18o!, mce!]);
}
if (rows.length < 2000) throw new Error(`only ${rows.length} rows read: has the file's layout changed?`);

writeFileSync(OUT, `${JSON.stringify({
  source: SOURCE,
  attribution: 'NGRIP dating group (2006), GICC05, NOAA/WDS Paleoclimatology Data Contribution Series 2006-118. Written by scripts/icecore.ts; do not edit.',
  sha256,
  columns: ['age_b2k', 'd18o_permille', 'max_counting_error_years'],
  rows,
}, null, 0).replace(/\],\[/g, '],\n[')}\n`);
console.log(`icecore: ${rows.length} rows, ${rows[0]![0]} to ${rows[rows.length - 1]![0]} b2k, written to ${OUT}`);
