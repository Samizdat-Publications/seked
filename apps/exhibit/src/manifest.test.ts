import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cameraFor, pickEra, readManifest, readOverlays } from './manifest';
import { DEG } from './projection';

const walk = join(__dirname, '..', '..', 'walk');
const stations = JSON.parse(readFileSync(join(walk, 'stations.json'), 'utf8'));
const overlays = JSON.parse(readFileSync(join(walk, 'overlays.json'), 'utf8'));

describe('readManifest', () => {
  const m = readManifest(stations);

  it('reads every station the walkthrough has, with its eras oldest first', () => {
    expect(m.stations.length).toBe(stations.stations.length);
    const flank = m.byId['sphinx-flank'];
    expect(flank).toBeDefined();
    expect(flank?.eras).toEqual(['first-time', 'lion', 'built', 'stripped', 'today']);
    expect(flank?.view.yaw).toBeCloseTo(285 * DEG);
    expect(flank?.panoramas.today).toBe('pano/sphinx-flank-today.jpg');
  });
  it('reads detail patches in radians', () => {
    const p = m.byId.sphinx?.patches.built?.[0];
    expect(p).toBeDefined();
    expect(Math.abs(p?.yaw ?? 99)).toBeLessThanOrEqual(2 * Math.PI);
  });
  it('drops what it cannot read rather than guessing', () => {
    const odd = readManifest({ states: [{ id: 'today' }, {}], stations: [{ id: 'x', camera: [1, 'a', 3], panoramas: { today: 'a.jpg', lion: 7 } }, { name: 'no id' }] });
    expect(odd.states.map((s) => s.id)).toEqual(['today']);
    expect(odd.stations.length).toBe(1);
    expect(odd.stations[0]?.camera).toEqual([0, 0, 0]);
    expect(odd.stations[0]?.eras).toEqual(['today']);
    expect(readManifest(null).stations).toEqual([]);
  });
});

describe('pickEra and cameraFor', () => {
  const m = readManifest({
    states: [{ id: 'first-time' }, { id: 'lion' }, { id: 'built' }, { id: 'stripped' }, { id: 'today' }],
    stations: [{ id: 'harbour', camera: [1, 2, 3], cameras: { built: [4, 5, 6] }, panoramas: { built: 'b.jpg', today: 't.jpg' } }],
  });
  const st = m.byId.harbour!;

  it('takes the era asked for, else the nearest, the newer of two equally near', () => {
    expect(pickEra(m, st, 'built')).toBe('built');
    expect(pickEra(m, st, 'first-time')).toBe('built');
    expect(pickEra(m, st, 'stripped')).toBe('today');
    expect(pickEra(m, st, null)).toBe('today');
    expect(pickEra(m, st, 'nonsense')).toBe('today');
  });
  it("uses an era's own camera where it has one", () => {
    expect(cameraFor(st, 'built')).toEqual([4, 5, 6]);
    expect(cameraFor(st, 'today')).toEqual([1, 2, 3]);
  });
});

describe('readOverlays', () => {
  const o = readOverlays(overlays);

  it('reads every overlay with its lines and labels', () => {
    expect(Object.keys(o).sort()).toEqual(Object.keys(overlays).sort());
    const g = o['g1-proportions'];
    expect(g?.lines.length).toBeGreaterThan(0);
    expect(g?.labels.some((L) => L.eras?.includes('today'))).toBe(true);
  });
  it('keeps bearings from the camera and drops lines it cannot place', () => {
    const r = readOverlays({ x: { lines: [{ from: { dir: [90, 0, 10] }, to: [0, 0, 0], style: 'edge' }, { from: [0, 0], to: [0, 0, 0] }], labels: [{ at: [0, 0, 0] }] } });
    expect(r.x?.lines).toEqual([{ from: { dir: [90, 0, 10] }, to: [0, 0, 0], style: 'edge' }]);
    expect(r.x?.labels).toEqual([]);
  });
});
