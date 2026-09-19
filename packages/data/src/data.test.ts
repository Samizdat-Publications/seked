import { describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { MaterialSchema, MeasurementSchema, StructureSchema, DATA_DIR, casedIn, isContext, loadDatabase, loadFootprints, resolve } from './index';

const db = loadDatabase();

describe('database', () => {
  it('loads and validates every file', () => {
    expect(db.sources.length).toBeGreaterThan(20);
    expect(db.measurements.length).toBeGreaterThan(50);
    expect(db.presets.map((p) => p.id)).toContain('canonical');
  });
  it('stores no derived quantities', () => {
    const keys = db.measurements.map((m) => m.key);
    for (const banned of ['g1.base.perimeter', 'g1.apothem', 'g1.volume']) expect(keys).not.toContain(banned);
  });
  it('treats verified as opt-in and makes verified survey records cite a section', () => {
    const bare = MeasurementSchema.parse({ key: 'x', structure: 'g1', quantity: 'length', value: 1, unit: 'm', source: 'petrie-1883' });
    expect(bare.verified).toBe(false);
    expect(db.measurements.find((m) => m.key === 'c')?.verified).toBe(true);
    const kind = new Map(db.sources.map((s) => [s.id, s.kind]));
    for (const m of db.measurements.filter((m) => m.verified && kind.get(m.source) === 'survey')) {
      // A section, a page number, or, for a survey published as a website,
      // the named page or diary entry it was read on. The Upuaut report's own
      // page names are "the findings page" and "the <upper|lower> <northern|
      // southern> shaft page", and both count: each identifies one page of one
      // report as exactly as a section number identifies one part of a book.
      // A figure transcribed from a drawing cites its plate, "Tav. 5".
      expect(m.note, `${m.key} from ${m.source} is verified without a section or page reference`).toMatch(/§\d+|pp?\. \d+|\bshaft page\b|\bfindings page\b|\bcampaign diary\b|\bTav\. \d+/);
    }
  });
});

describe('sites and structures', () => {
  it('registers Giza on Earth and the Cydonia placeholder on Mars', () => {
    expect(db.sites.map((s) => `${s.id}:${s.body}`)).toEqual(['giza:earth', 'cydonia:mars']);
  });
  it('gives every structure an evidence tier and a known site', () => {
    const tiers = new Set(db.structures.map((s) => s.evidence));
    expect([...tiers].sort()).toEqual(['claimed', 'excavated', 'instrumented', 'legendary']);
    for (const s of db.structures) expect(db.sites.some((site) => site.id === s.site)).toBe(true);
  });
  it('keeps the subterranean claims separate from the excavated record', () => {
    expect(db.structures.find((s) => s.id === 'osiris-shaft')?.evidence).toBe('excavated');
    expect(db.structures.find((s) => s.id === 'g2.sar-shafts')?.evidence).toBe('claimed');
    expect(db.structures.find((s) => s.id === 'hall-of-records')?.evidence).toBe('legendary');
  });
  it('defaults every measurement to the Giza site', () => {
    for (const m of db.measurements) expect(m.site).toBe('giza');
  });
});

describe('presets', () => {
  it('canonical prefers Lehner, falls back to the surveys', () => {
    const r = resolve(db, 'canonical');
    expect(r.values['g1.base.side.mean']).toBe(230.33);
    expect(r.records.get('g1.base.side.mean')?.source).toBe('lehner-1997');
    expect(r.records.get('g1.base.side.north')?.source).toBe('dash-2015');
    expect(r.records.get('kc.height')?.source).toBe('petrie-1883');
  });
  it('each survey preset puts its own base first', () => {
    expect(resolve(db, 'petrie-1883').values['g1.base.side.mean']).toBeCloseTo(230.3475, 4);
    expect(resolve(db, 'cole-1925').values['g1.base.side.mean']).toBe(230.364);
    expect(resolve(db, 'dash-2015').values['g1.base.side.mean']).toBe(230.363);
  });
  it('a key with a single source survives every preset', () => {
    for (const p of db.presets) expect(resolve(db, p.id).values['earth.radius.polar']).toBe(6356752.314);
  });
  it('rejects an unknown preset', () => {
    expect(() => resolve(db, 'nope')).toThrow(/unknown preset/);
  });
});

describe('context is not a fifth evidence tier', () => {
  const bare = { id: 'giza.city', site: 'giza', name: 'Giza and Cairo' };

  it('takes context with no evidence, and evidence with no context', () => {
    expect(StructureSchema.parse({ ...bare, context: true }).context).toBe(true);
    expect(StructureSchema.parse({ ...bare, evidence: 'excavated' }).evidence).toBe('excavated');
  });

  it('refuses a structure that is both, or neither', () => {
    expect(() => StructureSchema.parse({ ...bare, context: true, evidence: 'excavated' })).toThrow();
    expect(() => StructureSchema.parse(bare)).toThrow();
  });

  it('is what isContext reads, and every structure filed today is evidence', () => {
    expect(isContext(StructureSchema.parse({ ...bare, context: true }))).toBe(true);
    expect(isContext(StructureSchema.parse({ ...bare, evidence: 'claimed' }))).toBe(false);
    for (const s of db.structures) expect(isContext(s), s.id).toBe(false);
  });

});

/**
 * The material table. It says what a building is made of, which is not a
 * measurement and has no value, no unit and no sigma, but carries the same
 * honesty rule: a source that exists, and `verified` false until somebody has
 * read the row against its page.
 */
describe('what the buildings are made of', () => {
  const footprints = loadFootprints();
  const ids = new Set(footprints.features.map((f) => f.id));

  it('loads, and every row is about a footprint the import carries', () => {
    expect(db.materials.length).toBeGreaterThan(10);
    for (const m of db.materials) expect(ids.has(m.structure), m.structure).toBe(true);
  });

  it('cites a source that exists, and is verified by nobody yet', () => {
    const sources = new Set(db.sources.map((s) => s.id));
    for (const m of db.materials) {
      expect(sources.has(m.source), `${m.structure}.${m.part} cites ${m.source}`).toBe(true);
      expect(m.verified, `${m.structure}.${m.part}`).toBe(false);
      expect((m.note ?? '').length, `${m.structure}.${m.part} says nothing`).toBeGreaterThan(20);
    }
  });

  it('gives Khafre red granite on a limestone core, from the plate that names them', () => {
    const cased = casedIn(db.materials, 'khafre.valley_temple');
    expect(cased.casing?.material).toBe('granite.red');
    expect(cased.pillars?.material).toBe('granite.red');
    expect(cased.core?.material).toBe('limestone.giza');
    expect(cased.floor?.material).toBe('alabaster');
    for (const part of ['casing', 'pillars', 'core', 'floor'] as const) expect(cased[part]?.source).toBe('hoelscher-1912');
  });

  it("gives Menkaure the brick he was finished in, not the granite he was meant to have", () => {
    for (const id of ['menkaure.mortuary_temple', 'menkaure.valley_temple']) {
      const cased = casedIn(db.materials, id);
      expect(cased.casing?.material, id).toBe('mudbrick');
      expect(cased.core?.material, id).toBe('limestone.giza');
      expect(cased.casing?.source, id).toBe('reisner-1931');
    }
    // The granite that was cut and never set is a floor and a note, not a casing.
    expect(casedIn(db.materials, 'menkaure.mortuary_temple').floor?.material).toBe('granite.black');
  });

  it('is silent where nobody has looked, and says nothing rather than something', () => {
    expect(casedIn(db.materials, 'amenhotep2.temple')).toEqual({});
    expect(casedIn(db.materials, 'no.such.building')).toEqual({});
  });

  it('refuses two materials for one surface, and an unknown source', () => {
    // The schema alone cannot see the pair: one row is valid and so is the
    // other. It is the loader that forbids them together, so the loader is
    // what this runs, over a copy of `data/` with one row added.
    const twice = [
      { structure: 'x', part: 'casing', material: 'granite.red', source: 'petrie-1883' },
      { structure: 'x', part: 'casing', material: 'mudbrick', source: 'petrie-1883' },
    ];
    expect(() => z.array(MaterialSchema).parse(twice)).not.toThrow();

    const copy = mkdtempSync(join(tmpdir(), 'seked-materials-'));
    cpSync(DATA_DIR, copy, { recursive: true });
    const rows = JSON.parse(readFileSync(join(copy, 'materials.json'), 'utf8')) as unknown[];

    writeFileSync(join(copy, 'materials.json'), JSON.stringify([...rows, rows[0]]));
    expect(() => loadDatabase(copy)).toThrow(/is given a material twice/);

    writeFileSync(
      join(copy, 'materials.json'),
      JSON.stringify([...rows, { structure: 'x', part: 'roof', material: 'basalt', source: 'no-such-book' }]),
    );
    expect(() => loadDatabase(copy)).toThrow(/cites unknown source "no-such-book"/);

    rmSync(copy, { recursive: true, force: true });
  });
});
