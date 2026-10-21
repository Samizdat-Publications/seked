import { loadDatabase, resolve } from '@seked/data';
import { buildEnvironment } from '@seked/geometry';
import { describe, expect, it } from 'vitest';
import { depthRows, undrawn } from './depths';

const db = loadDatabase();
const env = buildEnvironment(resolve(db, 'canonical').values);
const rows = depthRows(env, db.structures);

describe("chapter 8's depth scale", () => {
  it('reads every depth from its record', () => {
    const at = (label: RegExp) => rows.find((r) => label.test(r.label))!;
    expect(at(/Khafre/).bottom).toBeCloseTo(3.0);
    expect(at(/claimed wells/).bottom).toBeCloseTo(648);
    expect(at(/Osiris/).bottom).toBeCloseTo(30);
    expect(at(/paw cavity/).top).toBeCloseTo(5);
    expect(at(/radar/).top).toBeCloseTo(10);
    expect([at(/Mataha/).top, at(/Mataha/).bottom]).toEqual([8, 12]);
    expect([at(/closures/).top, at(/closures/).bottom]).toEqual([5, 7.5]);
    for (const r of rows) expect(r.top, r.label).toBeGreaterThan(0);
  });

  it('colours each by its structure’s tier, never by need', () => {
    const tier = (label: RegExp) => rows.find((r) => label.test(r.label))!.tier;
    expect(tier(/Khafre/)).toBe('excavated');
    expect(tier(/closures/)).toBe('instrumented');
    expect(tier(/claimed wells/)).toBe('claimed');
    expect(tier(/Mataha/)).toBe('claimed');
    expect(tier(/Osiris/)).toBe('excavated');
    expect(tier(/paw cavity/)).toBe('claimed');
  });

  it('names what has no depth in the records instead of drawing it', () => {
    const u = undrawn(db.structures);
    expect(u.map((x) => x.tier).sort()).toEqual(['legendary', 'legendary']);
    for (const x of u) expect(db.measurements.some((m) => m.structure === x.id && /depth|\.up$/.test(m.key)), x.id).toBe(false);
  });
});
