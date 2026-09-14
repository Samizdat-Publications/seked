import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { SekedBundle } from '../apps/web/src/bundle';
import { writeBundle } from './bundle';

const out = mkdtempSync(join(tmpdir(), 'seked-bundle-'));
afterAll(() => rmSync(out, { recursive: true, force: true }));

describe('the viewer bundle', () => {
  const written = writeBundle(out);
  const bundle = JSON.parse(readFileSync(written.json, 'utf8')) as SekedBundle;

  it('writes a file with every preset and every claim', () => {
    expect(bundle.presets).toHaveLength(4);
    expect(bundle.claims.length).toBeGreaterThanOrEqual(15);
    expect(bundle.measurements.length).toBeGreaterThan(100);
    expect(bundle.stars.length).toBeGreaterThan(0);
    expect(bundle.sources.length).toBeGreaterThan(0);
    expect(bundle.sites.map((s) => s.id)).toContain('giza');
    expect(bundle.structures.map((s) => s.id)).toContain('g1');
  });

  it('normalises the claims, so the browser never parses YAML', () => {
    const a1 = bundle.claims.find((c) => c.id === 'A1');
    expect(a1?.comparisons).toHaveLength(1);
    expect(a1?.comparisons[0]?.formula).toBe('g1.base.perimeter / g1.height.original');
  });

  it('copies the heightfield and describes it', () => {
    const { header } = bundle.terrain;
    expect(bundle.terrain.heights).toBe(`terrain/${header.heights}`);
    expect(statSync(written.heights).size).toBe(header.nx * header.ny * 4);
  });

  it('writes the same bytes when it runs again', () => {
    const before = readFileSync(written.json);
    const again = writeBundle(out);
    expect(again.json).toBe(written.json);
    expect(readFileSync(written.json).equals(before)).toBe(true);
  });
});
