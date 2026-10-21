import { describe, expect, it } from 'vitest';
import doc from '../../../data/places/great-circle.json';
import constants from '../../../data/measurements/units-and-constants.json';
import sources from '../../../data/sources.json';
import { bestCircle, toVec } from './greatcircle';
import { ALISON, dms, offAuthorsAxis, poleSeparation, strip, stripSvg } from './worldsites';

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
    expect(svg).toContain('28 km');
  });
});
