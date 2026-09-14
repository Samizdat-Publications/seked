import { describe, expect, it } from 'vitest';
import { loadDatabase } from '@seked/data';
import { checkCourses, parseCourses, serializeCourses, type Course } from './courses';

/**
 * A piece of the real page, copied out of the wikitext the import reads: the
 * first ten rows of Goyon's table, which pair courses 1 to 10 with courses 25
 * to 34, and the last three, which pair courses 189 to 191 with the empty
 * cells the table ends on because 201 is odd against its rows. The repeated
 * header row between them is the one the printed table starts each page with.
 * Nothing here goes near the network; what is being tested is the parser.
 */
const FIXTURE = `L'égyptologue français [[Georges Goyon]] effectua de nouvelles mesures.

== Mesures de Petrie ==

Mesures prises aux coins nord-est et sud-ouest.

== Mesures de Goyon ==

Mesures prises de bas en haut à partir du bas de l'arête nord-est, avec une incertitude sur les mesures de {{nombre|0.5|centimètre}} et donnant {{nombre|201|assises}} pour une hauteur totale de {{nombre|138.745|mètres}}<ref>[[Georges Goyon]], BIFAO 78, 1978</ref>.

{| width="100%" style="border:1px solid #EFEFDD ; background-color:#CCCCAA"
|+ ''Rangs et mesures''
|-
! bgcolor="#AAAA80"  | N°
! bgcolor="#AAAA80"  | Hauteur (centimètres)
! bgcolor="#AAAA80"  | N°
! bgcolor="#AAAA80"  | Hauteur (centimètres)
|- {{ligne grise}} align="center"
| 1
| 150
| 25
| 80
|- {{ligne grise}} align="center"
| 2
| 124
| 26
| 74
|- {{ligne grise}} align="center"
| 3
| 120
| 27
| 78
|- {{ligne grise}} align="center"
| 4
| 102
| 28
| 69
|- {{ligne grise}} align="center"
| 5
| 99
| 29
| 65
|- {{ligne grise}} align="center"
| 6
| 90
| 30
| 64
|- {{ligne grise}} align="center"
| 7
| 100
| 31
| 73
|- {{ligne grise}} align="center"
| 8
| 97
| 32
| 72
|- {{ligne grise}} align="center"
| 9
| 93
| 33
| 54
|- {{ligne grise}} align="center"
| 10
| 91,5
| 34
| 66
|-
! bgcolor="#AAAA80"  | N°
! bgcolor="#AAAA80"  | Hauteur (centimètres)
! bgcolor="#AAAA80"  | N°
! bgcolor="#AAAA80"  | Hauteur (centimètres)
|- {{ligne grise}} align="center"
| 189
| 52,5
|
|
|- {{ligne grise}} align="center"
| 190
| 54
|
|
|- {{ligne grise}} align="center"
| 191
| 51,5
|
|
|}

== Représentations graphiques des différents relevés ==

[[Image:Graphique-rangs-khéops.jpg|thumb|center|800px|Relevés de Georges Goyon]]
`;

const fixture = parseCourses(FIXTURE);
const heightOf = (n: number): number | undefined => fixture.find((c) => c.n === n)?.cm;

describe('reading Goyon’s table out of the transcription', () => {
  it('takes both column pairs of every row, and nothing outside the table', () => {
    // Ten rows of two courses each, then three rows whose right-hand pair is empty.
    expect(fixture).toHaveLength(23);
    expect(fixture.map((c) => c.n).slice(0, 4)).toEqual([1, 25, 2, 26]);
    expect(fixture.map((c) => c.n).slice(-3)).toEqual([189, 190, 191]);
  });

  it('reads the ten course heights the scan was checked against', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(heightOf)).toEqual([150, 124, 120, 102, 99, 90, 100, 97, 93, 91.5]);
    expect([25, 26, 27, 28, 29, 30, 31, 32, 33, 34].map(heightOf)).toEqual([80, 74, 78, 69, 65, 64, 73, 72, 54, 66]);
  });

  it('turns the French decimal comma into a number', () => {
    expect(heightOf(10)).toBe(91.5);
    expect(heightOf(189)).toBe(52.5);
    expect(heightOf(191)).toBe(51.5);
  });

  it('puts each course on the printed page its header row opened', () => {
    expect(fixture.filter((c) => c.page === 410).map((c) => c.n)).toContain(1);
    expect(fixture.find((c) => c.n === 34)?.page).toBe(410);
    expect(fixture.filter((c) => c.page === 411).map((c) => c.n)).toEqual([189, 190, 191]);
  });

  it('refuses a page that no longer has the section the table stands under', () => {
    expect(() => parseCourses('== Mesures de Petrie ==\n\nnothing here\n')).toThrow(/Mesures de Goyon/);
  });
});

/** A table that adds up the way Goyon's does, for the checks to pass and fail against. */
function wholeTable(): Course[] {
  const courses: Course[] = [];
  for (let n = 1; n <= 201; n++) courses.push({ n, cm: n === 1 ? 74.5 : 69, page: 410 });
  return courses;
}

describe("the check against Goyon's own two totals", () => {
  it('passes a table of 201 courses adding up to 138.745 m', () => {
    expect(checkCourses(wholeTable())).toBeCloseTo(138.745, 9);
  });

  it('refuses a table with the wrong number of courses', () => {
    expect(() => checkCourses(wholeTable().slice(0, 200))).toThrow(/200 courses.*201/);
  });

  it('refuses a table that skips a course, however well it adds up', () => {
    const gappy = wholeTable();
    gappy[34] = { ...(gappy[34] as Course), n: 202 };
    expect(() => checkCourses(gappy)).toThrow(/skips course 35/);
  });

  it('refuses a total more than a centimetre from the printed one', () => {
    const short = wholeTable();
    short[0] = { ...(short[0] as Course), cm: 73.4 };
    expect(() => checkCourses(short)).toThrow(/138\.734 m.*138\.745/);
    // Half a reading's precision is not a lost row, so it is allowed through.
    const near = wholeTable();
    near[0] = { ...(near[0] as Course), cm: 74.25 };
    expect(checkCourses(near)).toBeCloseTo(138.7425, 9);
  });

  it('refuses a page the table was never printed on', () => {
    const elsewhere = wholeTable();
    elsewhere[0] = { ...(elsewhere[0] as Course), page: 409 };
    expect(() => checkCourses(elsewhere)).toThrow(/410 to 413/);
  });
});

describe('what the import writes', () => {
  const text = serializeCourses(fixture, 230669445);
  const rows = JSON.parse(text) as { key: string; value: number; sigma: number; source: string; note: string; verified: boolean }[];

  it('writes one record per course, in course order whatever order they were read in', () => {
    expect(rows.map((r) => r.key).slice(0, 3)).toEqual(['g1.course.1.height', 'g1.course.2.height', 'g1.course.3.height']);
    expect(rows).toHaveLength(fixture.length);
    expect(text.endsWith('}\n]\n')).toBe(true);
  });

  it('stores centimetres as metres, with Goyon’s half-centimetre as the sigma', () => {
    expect(rows[0]?.value).toBe(1.5);
    expect(rows.find((r) => r.key === 'g1.course.10.height')?.value).toBe(0.915);
    for (const row of rows) expect(row.sigma).toBe(0.005);
  });

  it('cites the page, the transcription and its revision, and verifies nothing', () => {
    expect(rows[0]?.source).toBe('goyon-1978');
    expect(rows[0]?.note).toBe('course 1, 150 cm at the north-east corner, Goyon 1978 p. 410 via the Wikipedia transcription, revision 230669445');
    for (const row of rows) expect(row.verified).toBe(false);
  });
});

/**
 * The committed file, checked the way the import checks the page it read.
 * This is what stops a hand-edited row from entering the database: the file
 * is the script's output or it is nothing.
 */
describe('data/measurements/g1-courses.json as committed', () => {
  const records = loadDatabase().measurements.filter((m) => m.source === 'goyon-1978');

  it('is 201 courses of the Great Pyramid adding up to Goyon’s total', () => {
    expect(records).toHaveLength(201);
    expect(records.map((m) => m.key)).toEqual(Array.from({ length: 201 }, (_, i) => `g1.course.${i + 1}.height`));
    const total = records.reduce((sum, m) => sum + m.value, 0);
    expect(total).toBeCloseTo(138.745, 6);
    expect(total / records.length).toBeCloseTo(0.69, 3);
  });

  it('is unverified, in metres, and cites the four pages of the table', () => {
    for (const m of records) {
      expect(m.verified, m.key).toBe(false);
      expect(m.unit).toBe('m');
      expect(m.structure).toBe('g1');
    }
    expect([...new Set(records.map((m) => /p\. (\d+)/.exec(m.note ?? '')?.[1]))]).toEqual(['410', '411', '412', '413']);
  });
});
