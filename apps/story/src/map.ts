/**
 * Chapter 7's map inset (docs/script.md, the beat "At Abu Hureyra"): Abu
 * Hureyra, Göbekli Tepe and Giza on today's coast and rivers. Giza and Göbekli
 * Tepe are their sites' origins (data/sites.json); Abu Hureyra is a context
 * place (data/places/context.json), entered as its source prints it; the coast
 * and rivers are imported from Natural Earth (data/places/basemap.json, written
 * by scripts/basemap.ts). Nothing on it is drawn by hand.
 */
import basemap from '../../../data/places/basemap.json';
import context from '../../../data/places/context.json';
import sites from '../../../data/sites.json';

export interface Place {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  source: string;
}

/** Degrees, minutes and seconds, as a page prints them, in degrees. */
export const dms = ([d, m = 0, s = 0]: number[]) => d! + m / 60 + s / 3600;

const site = (id: string, name: string): Place => {
  const s = sites.find((x) => x.id === id)!;
  return { id, name, latitude: s.origin.latitude, longitude: s.origin.longitude, source: 'data/sites.json' };
};
export const PLACES: Place[] = [
  site('giza', 'Giza'),
  site('gobekli-tepe', 'Göbekli Tepe'),
  ...context.places.map((p) => ({ id: p.id, name: p.name, latitude: dms(p.latitude), longitude: dms(p.longitude), source: p.source })),
];
export const place = (id: string) => {
  const p = PLACES.find((x) => x.id === id);
  if (!p) throw new Error(`no place ${id}`);
  return p;
};

export const BASEMAP = basemap as unknown as {
  source: string;
  box: [number, number, number, number];
  coast: [number, number][][];
  rivers: { name: string; line: [number, number][] }[];
};

/**
 * An equirectangular projection about the box's middle latitude, `width` units across, y down as SVG
 * draws: at this size a degree east and a degree north keep their true ratio to within a few per cent.
 */
export function projector(width: number, box = BASEMAP.box) {
  const [w, s, e, n] = box;
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180);
  const scale = width / ((e - w) * k);
  return {
    height: (n - s) * scale,
    xy: (lon: number, lat: number): [number, number] => [(lon - w) * k * scale, (n - lat) * scale],
  };
}

/** The great-circle distance between two places on a sphere of `radius` metres, in kilometres. */
export function greatCircleKm(a: Place, b: Place, radius: number): number {
  const r = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * r;
  const dLon = (b.longitude - a.longitude) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLon / 2) ** 2;
  return (2 * radius * Math.asin(Math.sqrt(h))) / 1000;
}
