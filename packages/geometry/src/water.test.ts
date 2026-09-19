import { describe, expect, it } from 'vitest';
import { buildEnvironment } from './environment';
import type { Footprint } from './footprints';
import { meshVolume, type Mesh } from './mesh';
import { LOOK, QUAY, quayMesh, rectangleContains, riverBody, riverLevel, valleyTempleFloor, waterExtent, waterLevel } from './water';

/**
 * Invented outlines, not measurements: two boxes standing in for the valley
 * temples, at the levels and reaches the real footprints roughly have, so the
 * test says what the functions do and nothing about Giza.
 */
function temple(id: string, base: number, ring: [number, number][]): Footprint {
  return { id, name: id, kind: 'prism', group: 'temples', heightKey: 'tier3.temple.height', base, area: 0, ring };
}

const TEMPLES: Footprint[] = [
  // Khafre's valley temple: the more southerly, and the further east by a metre.
  temple('khafre.valley_temple', -42.18, [[370, -517], [415, -517], [415, -470], [370, -470]]),
  // The Sphinx Temple, north of it and a metre short of its east face.
  temple('sphinx.temple', -42.14, [[369, -467], [413, -467], [413, -414], [369, -414]]),
];

const ENV = buildEnvironment({ 'tier3.temple.height': 8 });

describe('the valley temples’ floor', () => {
  it('is the lower of the two footprints’ own bottoms', () => {
    expect(valleyTempleFloor(TEMPLES, ENV)).toBeCloseTo(-42.18, 6);
  });

  it('is undefined without the temples’ footprints', () => {
    expect(valleyTempleFloor([], ENV)).toBeUndefined();
    expect(valleyTempleFloor([TEMPLES[0] as Footprint], ENV)).toBeUndefined();
  });

  it('is undefined where the environment carries no height for them', () => {
    expect(valleyTempleFloor(TEMPLES, buildEnvironment({}))).toBeUndefined();
  });
});

describe('the water level', () => {
  it('stands at the temples’ floor in the built state', () => {
    expect(waterLevel(TEMPLES, ENV, 'built')).toBeCloseTo(-42.18, 6);
  });

  it('stands the flood’s named rise above it in the First Time', () => {
    expect(waterLevel(TEMPLES, ENV, 'ancient')).toBeCloseTo(-42.18 + LOOK.floodRiseMetres, 6);
  });

  it('is undefined in the dry states', () => {
    expect(waterLevel(TEMPLES, ENV, 'stripped')).toBeUndefined();
    expect(waterLevel(TEMPLES, ENV, 'today')).toBeUndefined();
  });

  it('is undefined without the temples’ footprints', () => {
    expect(waterLevel([], ENV, 'built')).toBeUndefined();
    expect(waterLevel([], ENV, 'ancient')).toBeUndefined();
  });
});

describe('the harbour basin', () => {
  const basin = waterExtent(TEMPLES, ENV, 'built');

  it('is a basin cut below its own waterline', () => {
    expect(basin?.kind).toBe('basin');
    expect(basin?.floor).toBeCloseTo((basin?.level as number) - LOOK.basinDepthMetres, 6);
  });

  it('contains both temples’ east faces', () => {
    for (const t of TEMPLES) {
      const east = Math.max(...t.ring.map(([x]) => x));
      for (const [, y] of t.ring) {
        expect(rectangleContains(basin?.outline ?? [], east, y)).toBe(true);
      }
    }
  });

  it('reaches east of them and stands clear north and south', () => {
    const xs = (basin?.outline ?? []).map(([x]) => x);
    const ys = (basin?.outline ?? []).map(([, y]) => y);
    expect(Math.max(...xs)).toBeCloseTo(415 + LOOK.basinReachMetres, 6);
    expect(Math.min(...ys)).toBeCloseTo(-517 - LOOK.basinMarginMetres, 6);
    expect(Math.max(...ys)).toBeCloseTo(-414 + LOOK.basinMarginMetres, 6);
  });

  it('holds no ground west of the temples’ east faces', () => {
    const west = Math.min(...(basin?.outline ?? []).map(([x]) => x));
    // The Sphinx Temple's east face, which is the westernmost of the two.
    expect(west).toBeCloseTo(413, 6);
    expect(rectangleContains(basin?.outline ?? [], 300, -450)).toBe(false);
  });

  it('says in its label that the waterline is the temples’ own and the reach a look choice', () => {
    expect(basin?.label).toContain('Lehner');
    expect(basin?.label).toContain('Look choices');
    expect(basin?.label).toContain('-42.18');
  });
});

describe('the flood plain of the First Time', () => {
  const plain = waterExtent(TEMPLES, ENV, 'ancient');

  it('is a plain with no bed of its own', () => {
    expect(plain?.kind).toBe('plain');
    expect(plain?.floor).toBeCloseTo(plain?.level as number, 6);
  });

  it('lies east of the temples and is carried out to the plain’s reach', () => {
    const xs = (plain?.outline ?? []).map(([x]) => x);
    expect(Math.min(...xs)).toBeCloseTo(413, 6);
    expect(Math.max(...xs)).toBeCloseTo(413 + LOOK.plainReachMetres, 6);
    expect(rectangleContains(plain?.outline ?? [], 300, -450)).toBe(false);
  });

  it('cites the African Humid Period and calls itself a claim', () => {
    expect(plain?.label).toContain('African Humid Period');
    expect(plain?.label).toContain('12,500 to 3,500 BCE');
    expect(plain?.label).toContain('claim');
  });
});

describe('the dry states', () => {
  it('have no water at all', () => {
    expect(waterExtent(TEMPLES, ENV, 'stripped')).toBeUndefined();
    expect(waterExtent(TEMPLES, ENV, 'today')).toBeUndefined();
  });
});

describe('riverLevel', () => {
  /**
   * An invented valley, not a measurement of anything: fields at -36 m with a
   * flat channel five hundred metres wide at -46, which is the shape the real
   * heightfield has east of Giza and the shape the percentile relies on.
   */
  const valley = (x: number): number => (x >= 8000 && x <= 8500 ? -46 : -36);
  const box = { west: 3000, east: 11000, south: -4500, north: 7000 };

  it('lands on the channel and not on the fields', () => {
    expect(riverLevel(valley, box)).toBeCloseTo(-46 + LOOK.riverRiseMetres, 6);
  });

  it('stands the drawn surface clear of the model own water', () => {
    expect(riverLevel(valley, box) - -46).toBeCloseTo(LOOK.riverRiseMetres, 6);
  });

  it('does not move while the channel is wider than the percentile', () => {
    // The channel here is about six per cent of the box, so every percentile
    // inside it gives the same level.
    for (const percentile of [1, 3, 5]) {
      expect(riverLevel(valley, box, 60, percentile), `p${percentile}`).toBeCloseTo(-46 + LOOK.riverRiseMetres, 6);
    }
    // Past the channel's own share it climbs onto the fields, which is the
    // thing the fifth percentile is chosen to be inside.
    expect(riverLevel(valley, box, 60, 30)).toBeCloseTo(-36 + LOOK.riverRiseMetres, 6);
  });

  it('reads whatever the ground says, with nothing typed', () => {
    expect(riverLevel(() => -12, box)).toBeCloseTo(-12 + LOOK.riverRiseMetres, 6);
  });

  it('refuses a box with no samples in it rather than inventing a level', () => {
    expect(() => riverLevel(valley, { west: 100, east: 0, south: 0, north: 0 })).toThrow(/no samples/);
  });
});

describe('riverBody', () => {
  it('is a surface with no bed of its own, like the flood plain', () => {
    const body = riverBody(-45.7);
    expect(body.kind).toBe('river');
    expect(body.floor).toBe(body.level);
    expect(body.level).toBe(-45.7);
  });

  it('covers the valley it was given', () => {
    const box = { west: 3000, east: 11000, south: -4500, north: 7000 };
    const body = riverBody(-45.7, box);
    expect(rectangleContains(body.outline, 8200, 0)).toBe(true);
    expect(rectangleContains(body.outline, 0, 0)).toBe(false);
  });

  it('says it is context, says where its level came from, and names its look choices', () => {
    const label = riverBody(-45.7).label;
    expect(label).toMatch(/Context, not evidence/);
    expect(label).toMatch(/percentile of the valley/);
    expect(label).toMatch(/Look choices/);
    expect(label).toMatch(/-45\.70 m/);
  });
});

/**
 * Track D. A built quay, not the cut rim of the basin: masonry standing in
 * the water along the basin's front, with its head a stated height above the
 * waterline and a batter on the face a boat comes alongside.
 */
describe('the quay at the harbour front', () => {
  const basin = waterExtent(TEMPLES, ENV, 'built');
  const built = quayMesh(basin, TEMPLES);

  it('is built only where there is a basin to build it on', () => {
    expect(built).toBeDefined();
    expect(quayMesh(waterExtent(TEMPLES, ENV, 'ancient'), TEMPLES)).toBeUndefined();
    expect(quayMesh(waterExtent(TEMPLES, ENV, 'today'), TEMPLES)).toBeUndefined();
    expect(quayMesh(undefined, TEMPLES)).toBeUndefined();
  });

  it('is a closed solid of positive volume, wound so its faces look out', () => {
    const mesh = (built as { mesh: Mesh }).mesh;
    expect(meshVolume(mesh)).toBeGreaterThan(0);
    // Every edge walked once each way, which is what closed means.
    const edges = new Map<string, number>();
    for (let t = 0; t < mesh.indices.length; t += 3) {
      for (let k = 0; k < 3; k++) {
        const a = mesh.indices[t + k] as number;
        const b = mesh.indices[t + ((k + 1) % 3)] as number;
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        edges.set(key, (edges.get(key) ?? 0) + (a < b ? 1 : -1));
      }
    }
    for (const [key, net] of edges) expect(net, key).toBe(0);
  });

  it('stands from the floor of the basin to a stated freeboard above the waterline', () => {
    const mesh = (built as { mesh: Mesh }).mesh;
    const level = (basin as { level: number }).level;
    const floor = (basin as { floor: number }).floor;
    const zs: number[] = [];
    for (let i = 2; i < mesh.positions.length; i += 3) zs.push(mesh.positions[i] as number);
    expect(Math.min(...zs)).toBeCloseTo(floor, 4);
    expect(Math.max(...zs)).toBeCloseTo(level + QUAY.freeboardMetres, 4);
  });

  it('leans its seaward face back and leaves the landward one upright', () => {
    const mesh = (built as { mesh: Mesh }).mesh;
    const level = (basin as { level: number }).level;
    const top = level + QUAY.freeboardMetres;
    const floor = (basin as { floor: number }).floor;
    const at = (z: number): number[] => {
      const xs: number[] = [];
      for (let i = 0; i < mesh.positions.length; i += 3) {
        if (Math.abs((mesh.positions[i + 2] as number) - z) < 1e-6) xs.push(mesh.positions[i] as number);
      }
      return xs;
    };
    const lean = (top - floor) / Math.tan((QUAY.batterDeg * Math.PI) / 180);
    expect(Math.min(...at(floor))).toBeCloseTo(Math.min(...at(top)), 4); // upright behind
    expect(Math.max(...at(floor)) - Math.max(...at(top))).toBeCloseTo(lean, 4); // leaning in front
    expect(lean).toBeGreaterThan(0);
  });

  it('stands clear of both temples rather than on the west edge of the basin, and runs its whole length', () => {
    const mesh = (built as { mesh: Mesh }).mesh;
    const outline = (basin as { outline: [number, number][] }).outline;
    // The basin's west edge is the westernmost east face (369 here); the quay
    // stands on the easternmost (415), so that neither temple has a wall
    // standing inside it. The two disagree by six metres in these fixtures.
    const basinWest = Math.min(...outline.map(([x]) => x));
    const west = Math.max(...TEMPLES.map((f) => Math.max(...f.ring.map(([x]) => x))));
    expect(west).toBeGreaterThan(basinWest);
    const south = Math.min(...outline.map(([, y]) => y));
    const north = Math.max(...outline.map(([, y]) => y));
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < mesh.positions.length; i += 3) {
      xs.push(mesh.positions[i] as number);
      ys.push(mesh.positions[i + 1] as number);
    }
    expect(Math.min(...xs)).toBeCloseTo(west, 4);
    expect(Math.max(...xs)).toBeLessThanOrEqual(west + QUAY.thicknessMetres + 1e-4);
    // No temple has any of the quay inside it, which is the whole reason.
    for (const f of TEMPLES) expect(Math.max(...f.ring.map(([x]) => x)), f.id).toBeLessThanOrEqual(Math.min(...xs) + 1e-4);
    expect(Math.min(...ys)).toBeCloseTo(south, 4);
    expect(Math.max(...ys)).toBeCloseTo(north, 4);
  });

  it('says what is read off the footprints and what was chosen', () => {
    const label = (built as { label: string }).label;
    expect(label).toContain('Look choices, none of them measured');
    expect(label).toContain(`${QUAY.freeboardMetres} m of freeboard`);
    expect(label).toContain(`${QUAY.batterDeg} degree batter`);
    expect(label).toContain('read off the temples');
  });
});
