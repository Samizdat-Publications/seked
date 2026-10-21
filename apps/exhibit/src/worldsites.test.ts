import { describe, expect, it } from 'vitest';
import doc from '../../../data/places/great-circle.json';
import heritage from '../../../data/places/world-heritage.json';
import constants from '../../../data/measurements/units-and-constants.json';
import sources from '../../../data/sources.json';
import { bestCircle, toVec } from './greatcircle';
import { ALISON, dms, offAuthorsAxis, poleSeparation, poolReply, poolSvg, strip, stripSvg, within } from './worldsites';

describe("Alison's great circle, as he draws it", () => {
  it('rests on the proponent\'s own page, unverified, and stores no circle of its own', () => {
    const src = sources.find((s) => s.id === doc.source);
    expect(src?.kind).toBe('proponent');
    expect(doc.verified).toBe(false);
    expect(ALISON.sites).toHaveLength(17);
    expect(new Set(ALISON.sites.map((s) => s.id)).size).toBe(17);
    expect(Object.keys(doc)).not.toContain('pole');
  });

  it('reads degrees and minutes with their hemisphere', () => {
    expect(dms([29, 59, 'N'])).toBeCloseTo(29.9833, 4);
    expect(dms([109, 20, 'W'])).toBeCloseTo(-109.3333, 4);
    expect(() => dms([1, 0, 'Q'])).toThrow();
  });

  it('fits a circle within half a degree of the axis he gives', () => {
    const fit = bestCircle(ALISON.sites);
    expect(poleSeparation(fit.pole, toVec(ALISON.axis))).toBeLessThan(0.5);
  });

  it('puts the six sites he gives as on the circle within his tenth of a degree of their own best circle', () => {
    const six = ALISON.sites.filter((s) => s.milesOff === 0);
    expect(six.map((s) => s.id)).toEqual(['giza', 'tassili', 'paratoari', 'ollantaytambo', 'nazca', 'easter-island']);
    expect(bestCircle(six).worst).toBeLessThan(0.1);
  });

  it('finds his axis and his miles do not agree: Giza, "0 miles" in his table, is about a quarter degree off his own axis', () => {
    const giza = offAuthorsAxis()[ALISON.sites.findIndex((s) => s.id === 'giza')]!;
    expect(Math.abs(giza)).toBeGreaterThan(0.2);
    expect(Math.abs(giza)).toBeLessThan(0.35);
  });

  it('lays the circle straight with every site in order round it, and draws it', () => {
    const s = strip(ALISON.sites);
    expect(s.along[0]).toBeCloseTo(0, 6);
    for (const a of s.along) expect(a).toBeGreaterThanOrEqual(0);
    for (const a of s.along) expect(a).toBeLessThan(360);
    const km = (constants.find((r) => r.key === 'earth.radius.mean')!.value * Math.PI) / 180 / 1000;
    const svg = stripSvg(s, km);
    for (const site of ALISON.sites) expect(svg).toContain(site.name);
    expect(svg).toContain('band: 28 km');
  });
});

describe('the reply: a pool of comparable sites, and circles at random', () => {
  const pool = heritage.properties.map(([, , lat, lon]) => ({ lat: lat as number, lon: lon as number }));

  it("draws on the World Heritage List's cultural properties, imported with their source", () => {
    expect(sources.find((s) => s.id === heritage.source)?.note).toContain(heritage.sha256);
    expect(pool.length).toBeGreaterThan(900);
    expect(new Set(heritage.properties.map((p) => p[0])).size).toBe(pool.length);
    for (const p of pool) { expect(Math.abs(p.lat)).toBeLessThanOrEqual(90); expect(Math.abs(p.lon)).toBeLessThanOrEqual(180); }
  });

  it('counts the sites near a circle: the equator catches what lies on it and nothing far off', () => {
    const vs = [{ lat: 0.1, lon: 10 }, { lat: -0.2, lon: 50 }, { lat: 5, lon: 0 }].map(toVec);
    expect(within([0, 0, 1], vs, 0.25)).toBe(2);
  });

  it("finds Alison's circle no rarer than about one random circle in nine: it catches more than the average, and the best random one far more", () => {
    const r = poolReply(bestCircle(ALISON.sites).pole, pool, 0.25, 2000);
    expect(r.claim).toBeGreaterThan(r.mean);
    expect(r.share).toBeGreaterThan(0.05);
    expect(r.best).toBeGreaterThan(2 * r.claim);
    expect(poolReply(bestCircle(ALISON.sites).pole, pool, 0.25, 2000)).toEqual(r);
    expect(poolSvg(r)).toContain(`Alison's circle: ${r.claim}`);
  });
});

describe("each site as its own source gives it", () => {
  it('has a point, years and a source of its own, unverified, and years in order', () => {
    for (const s of doc.sites) {
      expect(sources.some((x) => x.id === s.own.source)).toBe(true);
      expect(s.own.verified).toBe(false);
      if (s.own.from !== null && s.own.to !== null) expect(s.own.from).toBeLessThanOrEqual(s.own.to);
      if (s.own.from === null) expect(s.own.to).toBeNull();
    }
  });

  it('reads seconds when a source prints them', () => {
    expect(dms([29, 58, 34, 'N'])).toBeCloseTo(29.97611, 5);
  });

  it("fits the sites' own points about as well as his, and close to the same circle", () => {
    const his = bestCircle(ALISON.sites), own = bestCircle(ALISON.sites.map((s) => s.own));
    expect(poleSeparation(his.pole, own.pole)).toBeLessThan(1);
    expect(own.rms).toBeGreaterThan(his.rms);
  });

  it('spans thousands of years: the oldest work and the youngest are more than ten thousand years apart', () => {
    const years = ALISON.sites.flatMap((s) => [s.years.from, s.years.to]).filter((y): y is number => y !== null);
    expect(Math.max(...years) - Math.min(...years)).toBeGreaterThan(10000);
    const svg = stripSvg(strip(ALISON.sites), 111.19);
    expect(svg).toContain('natural rock');
    expect(svg).toContain('10,000 BCE');
  });
});
