/**
 * Import Georges Goyon's 1978 course table into data/measurements/g1-courses.json.
 *
 *     pnpm run courses
 *
 * Goyon measured the height of every course of the Great Pyramid on the
 * north-east arris and printed them in centimetres as a table on pp. 410 to
 * 413 of BIFAO 78 (1978): "Hauteur successive en centimetres de toutes les
 * assises de la Grande Pyramide, prises sur l'angle Nord-Est en partant du
 * bas (au-dessus du socle)". There are 201 courses counted from the bottom,
 * the 201st being the summit platform; courses 1 and 2 are the French
 * Expedition's count rather than Goyon's own; each reading is stated to be
 * good to half a centimetre; and the table closes with a total of 138.745 m
 * and a mean course of 0.690 m.
 *
 * The IFAO's scan of the article is an image, so the table cannot be read out
 * of it by machine. French Wikipedia carries a transcription of the same
 * table under CC BY-SA 4.0, and the research that found it checked the
 * transcription against the scan course by course for the first forty-eight
 * and in samples beyond them. This script therefore reads the transcription
 * through the MediaWiki API rather than taking anybody's word for the
 * numbers, and it records the revision of the page it read, both in the note
 * on every record and, through the check at the end, in data/sources.json.
 *
 * Goyon's own two totals are the only check that matters: the table has to
 * hold 201 courses and they have to add up to 138.745 m. Nothing imported
 * here is `verified`, because no human has put each of the 201 rows beside
 * the scan; the counts agreeing is not the same as the rows agreeing.
 *
 * Running it twice writes the same bytes twice.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DATA_DIR } from '@seked/data';

const SOURCE = 'goyon-1978';
const STRUCTURE = 'g1';
const OUT = join(DATA_DIR, 'measurements', 'g1-courses.json');

/** The page whose wikitext carries the transcription, and where to ask for it. */
const WIKI_TITLE = "Mesure des rangs d'assises de la pyramide de Khéops";
const WIKI_API = 'https://fr.wikipedia.org/w/api.php';

/** The section of that page Goyon's table stands under. */
const SECTION_HEADING = '== Mesures de Goyon ==';

/** The two figures Goyon prints under his table, in metres. */
const COURSE_COUNT = 201;
const TOTAL_M = 138.745;

/**
 * How far the imported total may stand from Goyon's printed one before the
 * import is refused. One centimetre is a fifth of a single reading's stated
 * precision, so anything the parser dropped or doubled trips it.
 */
const TOTAL_TOLERANCE_M = 0.01;

/** Goyon states each reading to 0.5 cm, so that is the sigma on every row. */
const SIGMA_M = 0.005;

/** The first of the four printed pages the table runs over. */
const FIRST_PAGE = 410;

export interface Course {
  /** Course number, 1 at the bottom and 201 at the summit platform. */
  n: number;
  /** The height as the table prints it, in centimetres. */
  cm: number;
  /** The page of BIFAO 78 the row stands on. */
  page: number;
}

const round = (x: number, places: number): number => Number(x.toFixed(places));

/**
 * The part of the page Goyon's table stands in. Petrie's measurements and the
 * French Expedition's are transcribed on the same page in their own sections,
 * so cutting to this one heading is what keeps another survey's numbers from
 * ever being read as Goyon's.
 */
function goyonSection(wikitext: string): string {
  const start = wikitext.indexOf(SECTION_HEADING);
  if (start < 0) throw new Error(`the page has no "${SECTION_HEADING}" section; the transcription has been rewritten`);
  const rest = wikitext.slice(start + SECTION_HEADING.length);
  const end = rest.indexOf('\n== ');
  return end < 0 ? rest : rest.slice(0, end);
}

type Row = { header: true } | { header: false; cells: string[] };

/** The wikitable's rows, in order, each either a header row or its cells. */
function tableRows(section: string): Row[] {
  const rows: Row[] = [];
  let cells: string[] = [];
  let header = false;
  let open = false;
  const flush = (): void => {
    if (open) rows.push(header ? { header: true } : { header: false, cells });
    cells = [];
    header = false;
  };
  for (const raw of section.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('{|')) {
      open = false; // The table's own opening line; the first row starts at the first "|-".
      continue;
    }
    if (line.startsWith('|}')) {
      flush();
      break;
    }
    if (line.startsWith('|-')) {
      flush();
      open = true;
      continue;
    }
    if (line.startsWith('|+')) continue; // The caption, "Rangs et mesures".
    if (line.startsWith('!')) {
      header = true;
      continue;
    }
    if (line.startsWith('|')) cells.push(line.slice(1).trim());
  }
  return rows;
}

/**
 * The 201 courses, in the order the table gives them.
 *
 * The transcription lays the table out the way Goyon printed it: two pairs of
 * columns to a row, a course number and its height in centimetres in each
 * pair, with the last few right-hand cells left empty because 201 is odd
 * against the rows. Heights are written with the French decimal comma. The
 * header row is repeated wherever the table breaks across a printed page, so
 * counting header rows is what puts each course on its page: the first opens
 * p. 410 and the last p. 413.
 */
export function parseCourses(wikitext: string): Course[] {
  const out: Course[] = [];
  let page = FIRST_PAGE - 1;
  for (const row of tableRows(goyonSection(wikitext))) {
    if (row.header) {
      page += 1;
      continue;
    }
    for (let i = 0; i + 1 < row.cells.length; i += 2) {
      const number = row.cells[i] as string;
      const height = row.cells[i + 1] as string;
      if (number === '' && height === '') continue;
      const n = Number(number);
      const cm = Number(height.replace(',', '.'));
      if (!Number.isInteger(n) || !Number.isFinite(cm)) {
        throw new Error(`cannot read a course out of the cells ${JSON.stringify([number, height])}`);
      }
      out.push({ n, cm, page });
    }
  }
  return out;
}

/**
 * Goyon's own totals, checked against the import. A transcription that has
 * lost a row, gained one or mistyped a digit large enough to matter fails
 * here rather than quietly becoming the database's idea of the pyramid.
 */
export function checkCourses(courses: Course[]): number {
  if (courses.length !== COURSE_COUNT) {
    throw new Error(`the table holds ${courses.length} courses, and Goyon prints ${COURSE_COUNT}`);
  }
  const numbers = courses.map((c) => c.n);
  const expected = Array.from({ length: COURSE_COUNT }, (_, i) => i + 1);
  const missing = expected.filter((n) => !numbers.includes(n));
  if (missing.length > 0) throw new Error(`the table skips course${missing.length > 1 ? 's' : ''} ${missing.join(', ')}`);
  const pages = [...new Set(courses.map((c) => c.page))];
  const lastPage = FIRST_PAGE + 3;
  if (pages.some((p) => p < FIRST_PAGE || p > lastPage)) {
    throw new Error(`the table breaks over pages ${pages.join(', ')}, and Goyon prints it on ${FIRST_PAGE} to ${lastPage}`);
  }
  const total = courses.reduce((sum, c) => sum + c.cm, 0) / 100;
  if (Math.abs(total - TOTAL_M) > TOTAL_TOLERANCE_M) {
    throw new Error(`the courses add up to ${total.toFixed(3)} m, and Goyon prints ${TOTAL_M} m`);
  }
  return total;
}

/**
 * The measurement file, as text. One record per line and in course order, so
 * a diff of a re-import shows which courses moved rather than that the file
 * moved.
 */
export function serializeCourses(courses: Course[], revision: number): string {
  const rows = [...courses]
    .sort((a, b) => a.n - b.n)
    .map((c) => {
      const note =
        `course ${c.n}, ${c.cm} cm at the north-east corner, Goyon 1978 p. ${c.page} ` +
        `via the Wikipedia transcription, revision ${revision}`;
      return (
        `  { "key": "${STRUCTURE}.course.${c.n}.height", "structure": ${JSON.stringify(STRUCTURE)}, ` +
        `"quantity": "length", "value": ${round(c.cm / 100, 3)}, "unit": "m", "sigma": ${SIGMA_M}, ` +
        `"source": ${JSON.stringify(SOURCE)}, "method": "tape", "note": ${JSON.stringify(note)}, "verified": false }`
      );
    });
  return `[\n${rows.join(',\n')}\n]\n`;
}

interface Fetched {
  wikitext: string;
  revision: number;
  sha256: string;
}

/** The page's wikitext and the revision it was served from. */
async function fetchWikitext(): Promise<Fetched> {
  const url = new URL(WIKI_API);
  url.search = new URLSearchParams({
    action: 'parse',
    page: WIKI_TITLE,
    prop: 'wikitext|revid',
    format: 'json',
    formatversion: '2',
  }).toString();
  const response = await fetch(url, { headers: { 'user-agent': 'seked/0.0 (course-table import; scripts/courses.ts)' } });
  if (!response.ok) throw new Error(`${url.href} answered ${response.status} ${response.statusText}`);
  const body = (await response.json()) as { parse?: { wikitext?: string; revid?: number }; error?: { info?: string } };
  if (body.error) throw new Error(`the MediaWiki API refused the request: ${body.error.info ?? 'no reason given'}`);
  const wikitext = body.parse?.wikitext;
  const revision = body.parse?.revid;
  if (typeof wikitext !== 'string' || typeof revision !== 'number') {
    throw new Error('the MediaWiki API answered without wikitext or without a revision id');
  }
  return { wikitext, revision, sha256: createHash('sha256').update(wikitext, 'utf8').digest('hex') };
}

/**
 * The source entry has to name the revision and the checksum this import
 * read, the way `hyg-4.2` names the gzip's. It is written by hand, once, so
 * this only checks that it has not been left behind: if the transcription has
 * been edited since, the data file is rewritten and the run then says what the
 * note in data/sources.json now has to say.
 */
function checkSource(fetched: Fetched): void {
  const sources = JSON.parse(readFileSync(join(DATA_DIR, 'sources.json'), 'utf8')) as { id: string; note?: string }[];
  const source = sources.find((s) => s.id === SOURCE);
  if (!source) throw new Error(`data/sources.json has no "${SOURCE}"; add it before importing its numbers`);
  const note = source.note ?? '';
  const stale = [
    note.includes(String(fetched.revision)) ? '' : `revision ${fetched.revision}`,
    note.includes(fetched.sha256) ? '' : `sha256 ${fetched.sha256}`,
  ].filter((s) => s !== '');
  if (stale.length > 0) {
    throw new Error(
      `the "${SOURCE}" note in data/sources.json does not carry the ${stale.join(' or the ')} this run read. ` +
        'The transcription has been edited: check the new rows against the scan and bring the note up to date.',
    );
  }
}

async function main(): Promise<void> {
  const fetched = await fetchWikitext();
  const courses = parseCourses(fetched.wikitext);
  const total = checkCourses(courses);
  writeFileSync(OUT, serializeCourses(courses, fetched.revision));

  const thickest = [...courses].sort((a, b) => b.cm - a.cm).slice(0, 5);
  console.log(`${WIKI_TITLE}, revision ${fetched.revision}, sha256 ${fetched.sha256}`);
  console.log(`${courses.length} courses, ${total.toFixed(3)} m in all, mean course ${(total / courses.length).toFixed(3)} m`);
  console.log(`thickest: ${thickest.map((c) => `course ${c.n} at ${c.cm} cm`).join(', ')}`);
  console.log(`wrote ${OUT}`);
  checkSource(fetched);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === pathToFileURL(fileURLToPath(import.meta.url)).href) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
