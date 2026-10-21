import { loadDatabase, resolve } from '@seked/data';
import { buildEnvironment } from '@seked/geometry';
import { describe, expect, it } from 'vitest';
import { BASEMAP, dms, greatCircleKm, place, PLACES, projector } from './map';
import context from '../../../data/places/context.json';
import sources from '../../../data/sources.json';

const radius = buildEnvironment(resolve(loadDatabase(), 'canonical').values)['earth.radius.mean']!;

describe("chapter 7's map", () => {
  it('rests on imported data and places with sources, none of them verified', () => {
    const ids = new Set((sources as { id: string }[]).map((s) => s.id));
    expect(ids.has(BASEMAP.source)).toBe(true);
    for (const p of context.places) {
      expect(ids.has(p.source)).toBe(true);
      expect(p.verified).toBe(false);
    }
    expect(BASEMAP.coast.length).toBeGreaterThan(0);
    expect(BASEMAP.rivers.map((r) => r.name)).toEqual(expect.arrayContaining(['Nile', 'Euphrates']));
  });

  it('reads degrees, minutes and seconds', () => {
    expect(dms([37, 13, 23.671])).toBeCloseTo(37.223242, 6);
    expect(dms([38, 24, 0])).toBe(38.4);
  });

  it('puts every place inside the box, and every line too', () => {
    const [w, s, e, n] = BASEMAP.box;
    for (const p of PLACES) {
      expect(p.longitude).toBeGreaterThan(w);
      expect(p.longitude).toBeLessThan(e);
      expect(p.latitude).toBeGreaterThan(s);
      expect(p.latitude).toBeLessThan(n);
    }
    const { xy, height } = projector(160);
    const [x, y] = xy(w, n);
    expect([x, y]).toEqual([0, 0]);
    expect(xy(e, s)[0]).toBeCloseTo(160, 9);
    expect(xy(e, s)[1]).toBeCloseTo(height, 9);
  });

  it('measures Göbekli Tepe about 1,100 km from Giza, as the reply says', () => {
    const km = greatCircleKm(place('giza'), place('gobekli-tepe'), radius);
    expect(km).toBeGreaterThan(1050);
    expect(km).toBeLessThan(1150);
    // and Abu Hureyra, down the Euphrates, under 200 km from Göbekli
    expect(greatCircleKm(place('abu-hureyra'), place('gobekli-tepe'), radius)).toBeLessThan(200);
  });
});
