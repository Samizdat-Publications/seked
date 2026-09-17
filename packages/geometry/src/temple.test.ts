import { describe, expect, it } from 'vitest';
import { insetRing, type Footprint } from './footprints';
import { meshVolume, type Mesh } from './mesh';
import {
  annulusMesh, colonnadeMesh, PILLAR, pointInRing, ROOF_THICKNESS, TEMPLE_BUILT_HEIGHT_KEY,
  TEMPLE_RUIN_FRACTION, templeMesh, WALL_THICKNESS,
} from './temple';

/** An invented outline, not a measurement: a 60 by 40 m court. */
const RING: [number, number][] = [[0, 0], [60, 0], [60, 40], [0, 40]];

const ENV = { 'tier3.temple.height': 6 };

function temple(extra: Partial<Footprint> = {}): Footprint {
  return {
    id: 'khafre.mortuary_temple', name: 'Mortuary temple of Khafre', kind: 'prism', group: 'temples',
    heightKey: 'tier3.temple.height', base: 4.61, area: 2400, ring: RING, ...extra,
  };
}

function span(mesh: Mesh): [number, number] {
  let low = Infinity;
  let high = -Infinity;
  for (let i = 2; i < mesh.positions.length; i += 3) {
    low = Math.min(low, mesh.positions[i] as number);
    high = Math.max(high, mesh.positions[i] as number);
  }
  return [low, high];
}

function wellFormed(mesh: Mesh): boolean {
  if (mesh.indices.length !== mesh.triangleCount * 3) return false;
  if (mesh.positions.length !== mesh.vertexCount * 3) return false;
  if (![...mesh.positions].every((v) => Number.isFinite(v))) return false;
  return [...mesh.indices].every((i) => Number.isInteger(i) && i >= 0 && i < mesh.vertexCount);
}

describe('pointInRing', () => {
  it('tells inside from outside, corners included', () => {
    expect(pointInRing([30, 20], RING)).toBe(true);
    expect(pointInRing([-1, 20], RING)).toBe(false);
    expect(pointInRing([61, 20], RING)).toBe(false);
    expect(pointInRing([30, 41], RING)).toBe(false);
  });
});

describe('annulusMesh', () => {
  it('encloses the area between the two rings times the height, wound outward', () => {
    const outer: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const inner: [number, number][] = [[2, 2], [8, 2], [8, 8], [2, 8]];
    const mesh = annulusMesh(outer, inner, 0, 3) as Mesh;
    expect(wellFormed(mesh)).toBe(true);
    expect(meshVolume(mesh)).toBeCloseTo((100 - 36) * 3, 4);
  });

  it('builds nothing from rings that do not answer each other, or from no height', () => {
    const outer: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expect(annulusMesh(outer, [[2, 2], [8, 2], [8, 8]], 0, 3)).toBeUndefined();
    expect(annulusMesh(outer, outer, 3, 3)).toBeUndefined();
  });
});

describe('colonnadeMesh', () => {
  it('keeps every pillar wholly inside the ring it is set in', () => {
    const inner = insetRing(RING, WALL_THICKNESS);
    const pillars = colonnadeMesh(inner, 0, 6, {}) as Mesh;
    expect(pillars).toBeDefined();
    expect(wellFormed(pillars)).toBe(true);
    for (let i = 0; i < pillars.positions.length; i += 3) {
      const p: [number, number] = [pillars.positions[i] as number, pillars.positions[i + 1] as number];
      expect(pointInRing(p, inner), `${p[0]}, ${p[1]}`).toBe(true);
    }
  });

  it('sets them on its own pitch, so they stand the pitch apart', () => {
    const inner = insetRing(RING, WALL_THICKNESS);
    const pillars = colonnadeMesh(inner, 0, 6, {}) as Mesh;
    // Eight vertices to a box, so the count says how many there are.
    const count = pillars.vertexCount / 8;
    expect(count).toBeGreaterThan(4);
    expect(Number.isInteger(count)).toBe(true);
    const eastings = new Set<number>();
    for (let i = 0; i < pillars.positions.length; i += 3) eastings.add(Math.round((pillars.positions[i] as number) * 100) / 100);
    const sorted = [...eastings].sort((a, b) => a - b);
    // The gap from one column's west face to the next one's is the pitch less the width.
    expect((sorted[2] as number) - (sorted[0] as number)).toBeCloseTo(PILLAR.pitch, 2);
  });

  it('builds nothing where no whole pillar fits', () => {
    expect(colonnadeMesh([[0, 0], [1, 0], [1, 1], [0, 1]], 0, 6, {})).toBeUndefined();
  });
});

describe('templeMesh', () => {
  it('stands the walls on the outline, four metres thick, enclosing a positive volume', () => {
    const t = templeMesh(temple(), ENV, 'whole');
    expect(t).toBeDefined();
    expect(meshVolume(t?.walls as Mesh)).toBeGreaterThan(0);
    const inner = insetRing(RING, WALL_THICKNESS);
    // The ring was drawn in by the whole four metres, the outline being roomy enough.
    expect((inner[0] as [number, number])[0]).toBeCloseTo(WALL_THICKNESS, 6);
  });

  it('roofs the whole state and columns it, and does neither to the ruined one', () => {
    const whole = templeMesh(temple(), ENV, 'whole');
    expect(whole?.roof).toBeDefined();
    expect(whole?.pillars).toBeDefined();
    const [roofLow, roofHigh] = span(whole?.roof as Mesh);
    const [, wallHigh] = span(whole?.walls as Mesh);
    expect(roofLow).toBeCloseTo(wallHigh, 3);
    expect(roofHigh - roofLow).toBeCloseTo(ROOF_THICKNESS, 3);
    const ruined = templeMesh(temple(), ENV, 'ruined');
    expect(ruined?.roof).toBeUndefined();
    expect(ruined?.pillars).toBeUndefined();
  });

  it('leaves a ruined temple at a quarter of what stands', () => {
    const f = temple();
    const ruined = templeMesh(f, ENV, 'ruined');
    const [low, high] = span(ruined?.walls as Mesh);
    expect(low).toBeCloseTo(f.base, 3);
    expect(high - low).toBeCloseTo(TEMPLE_RUIN_FRACTION * 6, 3);
  });

  it('stands the whole state to the as-built height where the database carries one', () => {
    const f = temple();
    const withBuilt = templeMesh(f, { ...ENV, [TEMPLE_BUILT_HEIGHT_KEY]: 12 }, 'whole');
    const [low, high] = span(withBuilt?.walls as Mesh);
    expect(high - low).toBeCloseTo(12, 3);
    expect(withBuilt?.label).toContain(TEMPLE_BUILT_HEIGHT_KEY);
    // Without it, the height that stands, and the label says which it used.
    const withoutBuilt = templeMesh(f, ENV, 'whole');
    const [lo, hi] = span(withoutBuilt?.walls as Mesh);
    expect(hi - lo).toBeCloseTo(6, 3);
    expect(withoutBuilt?.label).toContain('carrying no');
  });

  it('says what it is and which of its dimensions are look choices', () => {
    const label = templeMesh(temple(), ENV, 'whole')?.label as string;
    expect(label).toContain('Reconstruction');
    expect(label).toContain('Look choices');
    expect(label).toContain('Not a reconstruction of this temple');
  });

  it('builds nothing outside the temples, and nothing without a height', () => {
    expect(templeMesh(temple({ group: 'mastabas' }), ENV, 'whole')).toBeUndefined();
    expect(templeMesh(temple(), {}, 'whole')).toBeUndefined();
    expect(templeMesh(temple(), {}, 'ruined')).toBeUndefined();
  });
});
