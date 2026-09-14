import { describe, expect, it } from 'vitest';
import { MeasurementSchema, loadDatabase, resolve } from './index';

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
      expect(m.note, `${m.key} from ${m.source} is verified without a section reference`).toMatch(/§\d+/);
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
    expect(r.records.get('g1.base.side.north')?.source).toBe('cole-1925');
    expect(r.records.get('kc.height')?.source).toBe('petrie-1883');
  });
  it('each survey preset puts its own base first', () => {
    expect(resolve(db, 'petrie-1883').values['g1.base.side.mean']).toBeCloseTo(230.3475, 4);
    expect(resolve(db, 'cole-1925').values['g1.base.side.mean']).toBe(230.364);
    expect(resolve(db, 'dash-2015').values['g1.base.side.mean']).toBe(230.36);
  });
  it('a key with a single source survives every preset', () => {
    for (const p of db.presets) expect(resolve(db, p.id).values['earth.radius.polar']).toBe(6356752.314);
  });
  it('rejects an unknown preset', () => {
    expect(() => resolve(db, 'nope')).toThrow(/unknown preset/);
  });
});
