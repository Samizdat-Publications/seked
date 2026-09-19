import { describe, expect, it } from 'vitest';
import { insetRing, type Footprint } from './footprints';
import { meshVolume, type Mesh } from './mesh';
import {
  annulusMesh, batterInset, colonnadeMesh, PILLAR, planPillars, planPrefix, pointInRing, ROOF_THICKNESS,
  TEMPLE_BATTER_DEG, TEMPLE_BUILT_HEIGHT_KEY, TEMPLE_RUIN_FRACTION, templeMesh, templePlan, templePlanMesh,
  WALL_THICKNESS,
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

// --- a temple built from a plan --------------------------------------------

/** An invented plan, not a measurement: a hall in the middle of the 60 by 40 m court. */
const PLAN_ENV: Record<string, number> = {
  ...ENV,
  'khafre_valley_temple.hall.stem.west': -12,
  'khafre_valley_temple.hall.stem.east': 8,
  'khafre_valley_temple.hall.stem.north': 5,
  'khafre_valley_temple.hall.stem.south': -5,
  'khafre_valley_temple.pillar.across': 1,
  'khafre_valley_temple.pillar.pitch.east': 4,
  'khafre_valley_temple.pillar.pitch.north': 6,
  'khafre_valley_temple.hall.pillar.row.north': 3,
  'khafre_valley_temple.hall.pillar.first.east': -8,
  'khafre_valley_temple.statue.1.east': -11,
  'khafre_valley_temple.statue.1.north': 4,
  'khafre_valley_temple.statue.2.east': 7,
  'khafre_valley_temple.statue.2.north': -4,
};

function planned(extra: Partial<Footprint> = {}): Footprint {
  return temple({ id: 'khafre.valley_temple', name: 'Valley temple of Khafre', ...extra });
}

describe('templePlan and planPillars', () => {
  it('reads the prefix off the footprint id', () => {
    expect(planPrefix('khafre.valley_temple')).toBe('khafre_valley_temple');
  });

  it('finds no plan unless all four faces of the hall are recorded', () => {
    expect(templePlan(planned(), ENV)).toBeUndefined();
    const short = { ...PLAN_ENV };
    delete short['khafre_valley_temple.hall.stem.south'];
    expect(templePlan(planned(), short)).toBeUndefined();
  });

  it('reads the hall, the pillar grid and every statue socket in order', () => {
    const plan = templePlan(planned(), PLAN_ENV);
    expect(plan?.hall).toEqual({ west: -12, east: 8, north: 5, south: -5 });
    expect(plan?.pillar?.across).toBe(1);
    expect(plan?.statues).toHaveLength(2);
  });

  it('steps the pillars out from the recorded one and keeps them inside the hall', () => {
    const plan = templePlan(planned(), PLAN_ENV) as NonNullable<ReturnType<typeof templePlan>>;
    const pillars = planPillars(plan);
    // Two rows, at north 3 and -3; along the hall, -8 stepped by 4 while the
    // whole pillar stays between -12 and 8.
    expect(pillars).toHaveLength(8);
    expect(new Set(pillars.map(([, y]) => y))).toEqual(new Set([3, -3]));
    const xs = [...new Set(pillars.map(([x]) => x))].sort((a, b) => a - b);
    expect(xs).toEqual([-8, -4, 0, 4]);
  });

  it('drops a row the recorded pitch would push through a wall', () => {
    const wide = { ...PLAN_ENV, 'khafre_valley_temple.pillar.pitch.north': 20 };
    const plan = templePlan(planned(), wide) as NonNullable<ReturnType<typeof templePlan>>;
    expect(new Set(planPillars(plan).map(([, y]) => y))).toEqual(new Set([3]));
  });
});

describe('templePlanMesh', () => {
  it('builds nothing without a plan, while the generic temple still builds', () => {
    expect(templePlanMesh(planned(), ENV, 'whole')).toBeUndefined();
    expect(templeMesh(planned(), ENV, 'whole')).toBeDefined();
  });

  it('builds the mass, the lining, a pillar apiece and a plinth apiece, each with its stone', () => {
    const built = templePlanMesh(planned(), PLAN_ENV, 'whole') as NonNullable<ReturnType<typeof templePlanMesh>>;
    const names = built.parts.map((p) => p.name);
    expect(names).toContain('wall.outer');
    expect(names.filter((n) => n.startsWith('mass.'))).toHaveLength(4);
    expect(names).toContain('hall.lining');
    expect(names.filter((n) => n.startsWith('pillar.'))).toHaveLength(8);
    expect(names.filter((n) => n.startsWith('statue.'))).toHaveLength(2);
    expect(names).toContain('roof');
    for (const part of built.parts) expect(wellFormed(part.mesh)).toBe(true);
    const granite = built.parts.filter((p) => p.material === 'granite').map((p) => p.name);
    expect(granite).toContain('hall.lining');
    expect(granite).toContain('pillar.1');
    expect(granite).toContain('statue.1');
    expect(granite).not.toContain('wall.outer');
  });

  it('keeps the hall inside the footprint and the pillars and plinths inside the hall', () => {
    const built = templePlanMesh(planned(), PLAN_ENV, 'whole') as NonNullable<ReturnType<typeof templePlanMesh>>;
    for (const corner of built.hall) expect(pointInRing(corner, insetRing(RING, WALL_THICKNESS))).toBe(true);
    for (const part of built.parts) {
      if (!part.name.startsWith('pillar.') && !part.name.startsWith('statue.')) continue;
      for (let i = 0; i < part.mesh.positions.length; i += 3) {
        const p: [number, number] = [part.mesh.positions[i] as number, part.mesh.positions[i + 1] as number];
        expect(pointInRing(p, built.hall), `${part.name} ${p[0]}, ${p[1]}`).toBe(true);
      }
    }
  });

  it('leaves the roof off a ruin and takes it to a quarter of the height', () => {
    const whole = templePlanMesh(planned(), PLAN_ENV, 'whole') as NonNullable<ReturnType<typeof templePlanMesh>>;
    const ruin = templePlanMesh(planned(), PLAN_ENV, 'ruined') as NonNullable<ReturnType<typeof templePlanMesh>>;
    expect(ruin.parts.map((p) => p.name)).not.toContain('roof');
    const top = (b: typeof whole): number =>
      Math.max(...b.parts.filter((p) => p.name === 'wall.outer').map((p) => span(p.mesh)[1]));
    expect(top(ruin) - 4.61).toBeCloseTo(TEMPLE_RUIN_FRACTION * (top(whole) - 4.61), 6);
  });

  it('says what the plan gave it and what is a look choice', () => {
    const built = templePlanMesh(planned(), PLAN_ENV, 'whole') as NonNullable<ReturnType<typeof templePlanMesh>>;
    expect(built.label).toContain('Reconstruction');
    expect(built.label).toContain('khafre_valley_temple.hall.stem.west');
    expect(built.label).toContain('8 pillars');
    expect(built.label).toContain('2 statue plinths');
    expect(built.label).toContain('Look choices');
  });
});


describe('the batter', () => {
  it('leans the face in by the height over the tangent of its angle', () => {
    expect(batterInset(8)).toBeCloseTo(8 / Math.tan((TEMPLE_BATTER_DEG * Math.PI) / 180), 6);
    // A metre and a bit over a wall of eight, which is the whole point of it.
    expect(batterInset(8)).toBeGreaterThan(0.8);
    expect(batterInset(8)).toBeLessThan(1.6);
  });

  it('is nothing for a wall of no height or a face that does not lean', () => {
    expect(batterInset(0)).toBe(0);
    expect(batterInset(-4)).toBe(0);
    expect(batterInset(8, 90)).toBe(0);
    expect(batterInset(8, 0)).toBe(0);
  });

  it('draws a temple narrower at its head than at its footing', () => {
    const built = templeMesh(temple(), { ...ENV, [TEMPLE_BUILT_HEIGHT_KEY]: 8 }, 'whole') as { walls: Mesh };
    const [bottom, top] = span(built.walls);
    const widthAt = (z: number): number => {
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < built.walls.positions.length; i += 3) {
        if (Math.abs((built.walls.positions[i + 2] as number) - z) > 1e-6) continue;
        lo = Math.min(lo, built.walls.positions[i] as number);
        hi = Math.max(hi, built.walls.positions[i] as number);
      }
      return hi - lo;
    };
    const foot = widthAt(bottom);
    const head = widthAt(top);
    expect(foot).toBeCloseTo(60, 6);
    expect(head).toBeLessThan(foot);
    expect(foot - head).toBeCloseTo(2 * batterInset(8), 4);
  });

  it('keeps the slab on the wall head rather than out past it', () => {
    const built = templeMesh(temple(), { ...ENV, [TEMPLE_BUILT_HEIGHT_KEY]: 8 }, 'whole') as { walls: Mesh; roof?: Mesh };
    expect(built.roof).toBeDefined();
    const roof = built.roof as Mesh;
    let wide = -Infinity;
    for (let i = 0; i < roof.positions.length; i += 3) wide = Math.max(wide, roof.positions[i] as number);
    expect(wide).toBeLessThan(60);
    expect(wide).toBeCloseTo(60 - batterInset(8), 4);
  });

  it('says in the label that the lean is a choice', () => {
    const built = templeMesh(temple(), { ...ENV, [TEMPLE_BUILT_HEIGHT_KEY]: 8 }, 'whole') as { label: string };
    expect(built.label).toContain('Look choices');
    expect(built.label).toContain(`${TEMPLE_BATTER_DEG} deg`);
  });
});

describe('annulusMesh with a leaning head', () => {
  it('refuses a head that does not answer the footing vertex for vertex', () => {
    const inner = insetRing(RING, 4);
    expect(annulusMesh(RING, inner, 0, 8, [[0, 0], [1, 1]])).toBeUndefined();
  });

  it('is the old upright wall when no head is given', () => {
    const inner = insetRing(RING, 4);
    const upright = annulusMesh(RING, inner, 0, 8) as Mesh;
    const same = annulusMesh(RING, inner, 0, 8, RING) as Mesh;
    expect([...same.positions]).toEqual([...upright.positions]);
  });
});
