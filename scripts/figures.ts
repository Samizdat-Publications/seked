/**
 * Import the constellation figures of Stellarium's `modern` sky culture into data/stars/figures.json.
 *
 *     curl -L -o build/skyculture/modern-index.json \
 *       https://raw.githubusercontent.com/Stellarium/stellarium/master/skycultures/modern/index.json
 *     pnpm run figures
 *
 * A figure is the lines a modern star map draws between a constellation's stars, given by Stellarium as runs of
 * Hipparcos numbers. They are a drawing convention, not a measurement, and the exhibit says so wherever it draws
 * one ("a modern figure"); they are imported rather than typed so that no line on a sky is anyone's guess. Each
 * Hipparcos number is written as the catalogue id `hipN` that data/stars/hyg-bright.json uses, and the script says
 * which stars of each figure the bright catalogue lacks.
 *
 * The download is gitignored; its sha256 is in the source entry (`stellarium-modern`), and the script refuses a
 * file that does not match it. Stellarium's sky culture data is CC BY-SA 4.0, as HYG is.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from '@seked/data';

const SOURCE = 'stellarium-modern';
const DOWNLOAD = join(DATA_DIR, '..', 'build', 'skyculture', 'modern-index.json');
const OUT = join(DATA_DIR, 'stars', 'figures.json');

interface SkyCulture { constellations: { id: string; lines: number[][]; common_name?: { english?: string; native?: string } }[] }

function main(): void {
  const sources = JSON.parse(readFileSync(join(DATA_DIR, 'sources.json'), 'utf8')) as { id: string; url: string; license: string; note?: string }[];
  const source = sources.find((s) => s.id === SOURCE);
  if (!source) throw new Error(`data/sources.json has no ${SOURCE}`);
  if (!existsSync(DOWNLOAD)) throw new Error(`${DOWNLOAD} is not there: curl -L -o ${DOWNLOAD} ${source.url}`);
  const raw = readFileSync(DOWNLOAD);
  const sha = createHash('sha256').update(raw).digest('hex');
  if (!(source.note ?? '').includes(sha)) throw new Error(`${DOWNLOAD} has sha256 ${sha}, which is not the one data/sources.json records for ${SOURCE}`);
  const culture = JSON.parse(raw.toString('utf8')) as SkyCulture;
  const bright = new Set((JSON.parse(readFileSync(join(DATA_DIR, 'stars', 'hyg-bright.json'), 'utf8')) as { stars: unknown[][] }).stars.map((r) => r[0] as string));
  const figures: Record<string, { name: string; lines: string[][] }> = {};
  for (const c of culture.constellations) {
    const abbr = c.id.replace(/^CON modern /, '');
    const lines = c.lines.map((run) => run.map((hip) => `hip${hip}`));
    const missing = [...new Set(lines.flat().filter((id) => !bright.has(id)))];
    if (missing.length) console.log(`${abbr}: ${missing.length} of its stars are fainter than the bright catalogue (${missing.join(', ')})`);
    figures[abbr] = { name: c.common_name?.native ?? abbr, lines };
  }
  const out = {
    source: SOURCE,
    attribution: `Constellation figures from Stellarium's modern sky culture (https://github.com/Stellarium/stellarium/tree/master/skycultures/modern), Stellarium's team, licensed CC BY-SA 4.0; imported by scripts/figures.ts with each star written as its HYG catalogue id. This file is an adapted database under the same licence. Full citation: data/sources.json, source "${SOURCE}".`,
    sha256: sha,
    figures,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${OUT}: ${Object.keys(figures).length} figures`);
}

main();
