import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { brightStarsOf, type SekedBundle } from '../apps/web/src/bundle';
import { BUNDLE_MAGNITUDE_LIMIT, writeBundle } from './bundle';

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

  it('ships the bright star catalogue, cut to the magnitude the viewer draws', () => {
    const { brightStars } = bundle;
    expect(brightStars.source).toBe('hyg-4.2');
    expect(brightStars.attribution).toContain('CC BY-SA 4.0');
    expect(brightStars.magnitudeLimit).toBe(BUNDLE_MAGNITUDE_LIMIT);
    expect(brightStars.stars.length).toBeGreaterThan(4000);
    for (const row of brightStars.stars) expect(row[8]).toBeLessThanOrEqual(BUNDLE_MAGNITUDE_LIMIT);
  });

  it('keeps every named star inside the cut, so a claim overlay can find it in the dome', () => {
    const bright = new Map(brightStarsOf(bundle).map((s) => [s.name, s]));
    for (const star of bundle.stars) {
      const match = bright.get(star.name);
      expect(match, `${star.name} is not in the bundled catalogue`).toBeDefined();
      expect((match as NonNullable<typeof match>).raDeg, star.id).toBe(star.raDeg);
      expect((match as NonNullable<typeof match>).decDeg, star.id).toBe(star.decDeg);
    }
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
