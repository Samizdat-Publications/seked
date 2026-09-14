/**
 * Import HYG 4.2 into data/stars/.
 *
 *     curl -L -o data/stars/hyg_v42.csv.gz \
 *       https://codeberg.org/astronexus/hyg/media/branch/main/data/hyg/OLDER/hyg_v42.csv.gz
 *     pnpm run stars
 *
 * It is `pnpm run stars`, not `pnpm stars`: pnpm has no `stars` command of its
 * own and hands the word to npm, which tries to list starred packages.
 *
 * Two files come out. `hyg-bright.json` is every HYG star to magnitude 6.5,
 * which is everything a dark-sky naked eye can see and everything the sky
 * dome will ever draw. `named.json` is the fourteen stars the claims and
 * scripts/shafts.ts name, cut from the same import so the two can never
 * disagree; the script prints how far each of them moved from the values
 * that were in named.json before, which is the check the plan asked for on
 * the starting sheet that was entered from memory. Ten of the fourteen are
 * that sheet. The four wing stars of Cygnus were added for claim C7 and were
 * never typed at all, so on the run that adds them they have nothing to be
 * measured against and the table passes over them.
 *
 * The raw CSV is gitignored. It is 33 MB, this import is reproducible from
 * the URL above, and the source entry records its sha256.
 *
 * HYG gives right ascension in hours and distance in parsecs; both are
 * converted here, because metres and degrees are the units of the database.
 * Positions and proper motions are rounded to the precision the CSV itself
 * carries: 1e-6 h of right ascension is 1.5e-5 deg, so five decimal places
 * of degrees loses nothing worth having.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { DATA_DIR } from '@seked/data';
import { BRIGHT_COLUMNS, StarSchema, type Star } from '@seked/sky';

const STARS_DIR = join(DATA_DIR, 'stars');
const SOURCE = 'hyg-4.2';
const MAGNITUDE_LIMIT = 6.5;
const DOWNLOAD = 'https://codeberg.org/astronexus/hyg/media/branch/main/data/hyg/OLDER/hyg_v42.csv.gz';
const ATTRIBUTION = `HYG Database v4.2 by astronexus (https://codeberg.org/astronexus/hyg), licensed CC BY-SA 4.0. Cut to magnitude ${MAGNITUDE_LIMIT} and converted to degrees and parallax by scripts/stars.ts; this file is an adapted database and carries the same licence. Full citation: data/sources.json, source "${SOURCE}".`;

/**
 * The stars the claims name, their Hipparcos numbers, and what each one is
 * for. The roles are editorial and live here because named.json is generated;
 * everything else about these fourteen comes out of the import.
 */
const NAMED: { id: string; hip: number; role: string }[] = [
  { id: 'alnitak', hip: 26727, role: "Orion's Belt, east; King's Chamber south shaft (C2); Orion Correlation (C4)" },
  { id: 'alnilam', hip: 26311, role: "Orion's Belt, centre (C4)" },
  { id: 'mintaka', hip: 25930, role: "Orion's Belt, west (C4)" },
  { id: 'sirius', hip: 32349, role: "Queen's Chamber south shaft (C2); large proper motion" },
  { id: 'thuban', hip: 68756, role: "Pole star c. 2800 BCE; King's Chamber north shaft (C2); descending passage (C3)" },
  { id: 'kochab', hip: 72607, role: "Queen's Chamber north shaft (C2); Spence's alignment pair (C1)" },
  { id: 'mizar', hip: 65378, role: "Spence's alignment pair (C1)" },
  { id: 'regulus', hip: 49669, role: 'Leo and the Sphinx (C5)' },
  { id: 'vega', hip: 91262, role: 'Pole star c. 12,000 BCE; precession sanity check' },
  { id: 'polaris', hip: 11767, role: "Today's pole star; precession sanity check" },
  { id: 'fawaris', hip: 97165, role: "δ Cygni, the wing star Collins lays on the Great Pyramid (C7)" },
  { id: 'sadr', hip: 100453, role: "γ Cygni, the wing star Collins lays on Khafre's pyramid (C7)" },
  { id: 'aljanah', hip: 102488, role: "ε Cygni, Gienah in Collins, the wing star he lays on Menkaure's pyramid (C7)" },
  { id: 'deneb', hip: 102098, role: "α Cygni; Collins has it rising over Heliopolis and setting into Khafre's pyramid from Gebel Gibli, neither modelled (C7)" },
];

/** HYG writes Bayer letters as three-letter abbreviations; named.json shows the letter. */
const GREEK: Record<string, string> = {
  Alp: 'α', Bet: 'β', Gam: 'γ', Del: 'δ', Eps: 'ε', Zet: 'ζ', Eta: 'η', The: 'θ',
  Iot: 'ι', Kap: 'κ', Lam: 'λ', Mu: 'μ', Nu: 'ν', Xi: 'ξ', Omi: 'ο', Pi: 'π',
  Rho: 'ρ', Sig: 'σ', Tau: 'τ', Ups: 'υ', Phi: 'φ', Chi: 'χ', Psi: 'ψ', Ome: 'ω',
};

const round = (x: number, places: number): number => Number(x.toFixed(places));

/** One line of RFC 4180 CSV. HYG quotes any field that contains a comma. */
function parseRow(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (line[i + 1] === '"') (field += '"'), i++;
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') (out.push(field), (field = ''));
    else field += c;
  }
  out.push(field);
  return out;
}

function readCatalogueCsv(): string {
  const plain = join(STARS_DIR, 'hyg_v42.csv');
  if (existsSync(plain)) return readFileSync(plain, 'utf8');
  const gz = join(STARS_DIR, 'hyg_v42.csv.gz');
  if (existsSync(gz)) return gunzipSync(readFileSync(gz)).toString('utf8');
  throw new Error(`no HYG catalogue in ${STARS_DIR}. Fetch it with:\n  curl -L -o data/stars/hyg_v42.csv.gz ${DOWNLOAD}`);
}

interface HygRow {
  hyg: number;
  hip: number | undefined;
  proper: string;
  bf: string;
  bayer: string;
  con: string;
  raDeg: number;
  decDeg: number;
  pmRaMasYr: number;
  pmDecMasYr: number;
  parallaxMas: number | null;
  mag: number;
  ci: number | null;
}

function readHyg(): HygRow[] {
  const lines = readCatalogueCsv().split('\n');
  const header = parseRow(lines[0] as string);
  const at = (name: string): number => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`HYG csv has no "${name}" column; header is ${header.join(',')}`);
    return i;
  };
  const c = {
    id: at('id'), hip: at('hip'), bf: at('bf'), proper: at('proper'), ra: at('ra'), dec: at('dec'),
    dist: at('dist'), pmra: at('pmra'), pmdec: at('pmdec'), mag: at('mag'), ci: at('ci'),
    bayer: at('bayer'), con: at('con'),
  };
  const out: HygRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] as string;
    if (!line.trim()) continue;
    const f = parseRow(line);
    const hyg = Number(f[c.id]);
    if (hyg === 0) continue; // HYG row 0 is the Sun, at right ascension 0 and distance 0.
    const mag = Number(f[c.mag]);
    if (!(mag <= MAGNITUDE_LIMIT)) continue;
    // dist >= 100000 pc is HYG's marker for a missing or negative Hipparcos parallax.
    const dist = Number(f[c.dist]);
    const parallax = dist > 0 && dist < 100000 ? round(1000 / dist, 3) : null;
    out.push({
      hyg,
      hip: f[c.hip] ? Number(f[c.hip]) : undefined,
      proper: f[c.proper] as string,
      bf: f[c.bf] as string,
      bayer: f[c.bayer] as string,
      con: f[c.con] as string,
      raDeg: round(Number(f[c.ra]) * 15, 5),
      decDeg: round(Number(f[c.dec]), 5),
      pmRaMasYr: round(Number(f[c.pmra] || 0), 2),
      pmDecMasYr: round(Number(f[c.pmdec] || 0), 2),
      parallaxMas: parallax,
      mag: round(mag, 2),
      ci: f[c.ci] === '' ? null : round(Number(f[c.ci]), 3),
    });
  }
  return out;
}

const idOf = (row: HygRow): string => (row.hip === undefined ? `hyg${row.hyg}` : `hip${row.hip}`);

/** "Zet" + "Ori" becomes "ζ Ori"; anything HYG has no Bayer letter for keeps its raw designation. */
function bayerOf(row: HygRow): string {
  const letter = GREEK[row.bayer];
  if (letter && row.con) return `${letter} ${row.con}`;
  return row.bf || row.con;
}

function writeBright(rows: HygRow[]): string {
  const stars = rows.map((r) =>
    JSON.stringify([idOf(r), r.proper || null, r.bf || null, r.raDeg, r.decDeg, r.pmRaMasYr, r.pmDecMasYr, r.parallaxMas, r.mag, r.ci]),
  );
  const text = [
    '{',
    `  "source": ${JSON.stringify(SOURCE)},`,
    `  "attribution": ${JSON.stringify(ATTRIBUTION)},`,
    `  "magnitudeLimit": ${MAGNITUDE_LIMIT},`,
    `  "columns": ${JSON.stringify(BRIGHT_COLUMNS)},`,
    '  "stars": [',
    stars.map((s) => `    ${s}`).join(',\n'),
    '  ]',
    '}',
    '',
  ].join('\n');
  const path = join(STARS_DIR, 'hyg-bright.json');
  writeFileSync(path, text);
  return path;
}

function namedStars(rows: HygRow[]): Star[] {
  const byHip = new Map(rows.filter((r) => r.hip !== undefined).map((r) => [r.hip as number, r]));
  return NAMED.map(({ id, hip, role }) => {
    const row = byHip.get(hip);
    if (!row) throw new Error(`HIP ${hip} (${id}) is not in the magnitude ${MAGNITUDE_LIMIT} cut of HYG 4.2`);
    return StarSchema.parse({
      id,
      name: row.proper,
      bayer: bayerOf(row),
      raDeg: row.raDeg,
      decDeg: row.decDeg,
      pmRaMasYr: row.pmRaMasYr,
      pmDecMasYr: row.pmDecMasYr,
      source: SOURCE,
      role,
    });
  });
}

function writeNamed(stars: Star[]): string {
  const body = stars
    .map((s) =>
      `  { "id": ${JSON.stringify(s.id)}, "name": ${JSON.stringify(s.name)}, "bayer": ${JSON.stringify(s.bayer)}, ` +
      `"raDeg": ${s.raDeg}, "decDeg": ${s.decDeg}, "pmRaMasYr": ${s.pmRaMasYr}, "pmDecMasYr": ${s.pmDecMasYr}, ` +
      `"source": ${JSON.stringify(s.source)}, "role": ${JSON.stringify(s.role)} }`,
    )
    .join(',\n');
  const path = join(STARS_DIR, 'named.json');
  writeFileSync(path, `[\n${body}\n]\n`);
  return path;
}

/** Great-circle separation between two positions, in arcseconds. */
function separationArcsec(a: Star, b: Star): number {
  const d2r = Math.PI / 180;
  const [ra1, dec1, ra2, dec2] = [a.raDeg * d2r, a.decDeg * d2r, b.raDeg * d2r, b.decDeg * d2r];
  const cos = Math.sin(dec1) * Math.sin(dec2) + Math.cos(dec1) * Math.cos(dec2) * Math.cos(ra1 - ra2);
  return (Math.acos(Math.min(1, Math.max(-1, cos))) / d2r) * 3600;
}

/** What the ten named stars were before the import, so the difference can be printed. */
function previousNamed(): Map<string, Star> {
  const path = join(STARS_DIR, 'named.json');
  if (!existsSync(path)) return new Map();
  const parsed = StarSchema.array().safeParse(JSON.parse(readFileSync(path, 'utf8')));
  return parsed.success ? new Map(parsed.data.map((s) => [s.id, s])) : new Map();
}

function main(): void {
  const rows = readHyg();
  const before = previousNamed();
  const stars = namedStars(rows);
  const brightPath = writeBright(rows);
  const namedPath = writeNamed(stars);

  console.log(`${rows.length} stars to magnitude ${MAGNITUDE_LIMIT}`);
  console.log(`wrote ${brightPath} (${(readFileSync(brightPath).byteLength / 1024).toFixed(0)} kB)`);
  console.log(`wrote ${namedPath}`);

  if (before.size === 0) return;
  console.log('\nNamed stars, HYG 4.2 against the values that were in named.json:');
  console.log('| star | Δ position | Δ RA | Δ Dec | Δ pmRA | Δ pmDec | designation |');
  console.log('|---|---:|---:|---:|---:|---:|---|');
  let worstPosition = 0;
  let worstPm = 0;
  for (const star of stars) {
    const old = before.get(star.id);
    if (!old) continue;
    const sep = separationArcsec(old, star);
    const dRa = (star.raDeg - old.raDeg) * 3600;
    const dDec = (star.decDeg - old.decDeg) * 3600;
    const dPmRa = star.pmRaMasYr - old.pmRaMasYr;
    const dPmDec = star.pmDecMasYr - old.pmDecMasYr;
    worstPosition = Math.max(worstPosition, sep);
    worstPm = Math.max(worstPm, Math.abs(dPmRa), Math.abs(dPmDec));
    const designation = old.bayer === star.bayer ? star.bayer : `${old.bayer} -> ${star.bayer}`;
    console.log(
      `| ${star.name} | ${sep.toFixed(3)}" | ${dRa.toFixed(3)}" | ${dDec.toFixed(3)}" | ` +
        `${dPmRa.toFixed(2)} | ${dPmDec.toFixed(2)} | ${designation} |`,
    );
  }
  console.log(`\nworst position difference ${worstPosition.toFixed(3)}", worst proper motion difference ${worstPm.toFixed(2)} mas/yr`);
}

main();
