import { describe, expect, it } from 'vitest';
import { chamber, extrudedSection, meshVolume, passage } from './index';
import type { Mesh, Point, SectionPair } from './index';

const DEG = Math.PI / 180;

/**
 * A closed surface with consistent winding uses every directed edge exactly
 * once, and the neighbouring triangle uses its reverse. Returns the edges
 * that break the rule, so a failure names them.
 */
function unpairedEdges(mesh: Mesh): string[] {
  const seen = new Set<string>();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const a = mesh.indices[i + k] as number;
      const b = mesh.indices[i + ((k + 1) % 3)] as number;
      const key = `${a}>${b}`;
      if (seen.has(key)) return [`used twice: ${key}`];
      seen.add(key);
    }
  }
  return [...seen].filter((key) => {
    const [a, b] = key.split('>');
    return !seen.has(`${b}>${a}`);
  });
}

/** Positions are float32, so volumes of thin solids agree to about a part in 1e6. */
function expectVolume(mesh: Mesh, want: number): void {
  expect(Math.abs(meshVolume(mesh) - want) / want).toBeLessThan(1e-5);
}

/** The Grand Gallery as a five-step corbel, half-widths narrowing upward. */
const GALLERY: SectionPair[] = [
  [1.047, 0.0],
  [1.047, 2.29],
  [0.97, 2.29],
  [0.97, 2.75],
  [0.893, 2.75],
  [0.893, 3.21],
  [0.816, 3.21],
  [0.816, 3.67],
  [0.739, 3.67],
  [0.739, 4.13],
];

/** Sum of the step areas of a mirrored section: each band is 2·halfWidth·Δheight. */
function sectionArea(section: SectionPair[]): number {
  let area = 0;
  for (let i = 0; i < section.length - 1; i++) {
    const [hw, h0] = section[i] as SectionPair;
    const [, h1] = section[i + 1] as SectionPair;
    area += 2 * hw * (h1 - h0);
  }
  return area;
}

describe('passage', () => {
  const slope = 26.5 * DEG;
  const length = 40;
  const from: Point = [0, 24, 17];
  const to: Point = [0, 24 - length * Math.cos(slope), 17 - length * Math.sin(slope)];

  it('perpendicular heights give width x height x slant length', () => {
    const p = passage({ from, to, width: 1.05, height: 1.2, heightMode: 'perpendicular' });
    expectVolume(p, 1.05 * 1.2 * length);
  });

  it('vertical heights give width x height x horizontal run', () => {
    // Sweeping an upright section along a sloping axis makes an oblique
    // prism, so the volume is the section area times the horizontal run
    // rather than the slant length.
    const run = Math.hypot(to[0] - from[0], to[1] - from[1]);
    expect(run).toBeLessThan(length);
    const p = passage({ from, to, width: 1.05, height: 1.2, heightMode: 'vertical' });
    expectVolume(p, 1.05 * 1.2 * run);
  });

  it('is a box: eight vertices, twelve triangles, closed and outward wound', () => {
    const p = passage({ from, to, width: 1.05, height: 1.2 });
    expect(p.vertexCount).toBe(8);
    expect(p.triangleCount).toBe(12);
    expect(unpairedEdges(p)).toEqual([]);
    expect(meshVolume(p)).toBeGreaterThan(0);
  });

  it('defaults to perpendicular heights', () => {
    const a = passage({ from, to, width: 1.05, height: 1.2 });
    const b = passage({ from, to, width: 1.05, height: 1.2, heightMode: 'perpendicular' });
    expect([...a.positions]).toEqual([...b.positions]);
  });

  it('names the floor ends and the axis midpoint', () => {
    const p = passage({ from, to, width: 1.05, height: 1.2 });
    expect(p.landmarks['floor.begin']).toEqual(from);
    expect(p.landmarks['floor.end']).toEqual(to);
    expect(p.landmarks['axis.mid']).toEqual([0, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]);
  });

  it('takes a prefix, like the pyramid landmarks', () => {
    const p = passage({ from, to, width: 1.05, height: 1.2, prefix: 'g1.descending' });
    expect(p.landmarks['g1.descending.floor.begin']).toEqual(from);
  });

  it('puts the width horizontal and square to the axis on an oblique bearing', () => {
    const a: Point = [-12.5, 18, 5];
    const b: Point = [14, -9, -6.5];
    const p = passage({ from: a, to: b, width: 1.05, height: 1.2 });
    // Vertices 0 and 3 are the two floor corners of the near end.
    const wx = (p.positions[0] as number) - (p.positions[9] as number);
    const wy = (p.positions[1] as number) - (p.positions[10] as number);
    const wz = (p.positions[2] as number) - (p.positions[11] as number);
    expect(wz).toBeCloseTo(0, 5);
    expect(Math.hypot(wx, wy, wz)).toBeCloseTo(1.05, 4);
    expect(wx * (b[0] - a[0]) + wy * (b[1] - a[1])).toBeCloseTo(0, 3);
    expectVolume(p, 1.05 * 1.2 * Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
    expect(unpairedEdges(p)).toEqual([]);
  });

  it('stands a level passage on the floor height it was given', () => {
    const p = passage({ from: [0, 0, 21], to: [0, -38.7, 21], width: 1.05, height: 1.17 });
    const zs: number[] = [];
    for (let i = 2; i < p.positions.length; i += 3) zs.push(p.positions[i] as number);
    expect(Math.min(...zs)).toBeCloseTo(21, 5);
    expect(Math.max(...zs)).toBeCloseTo(22.17, 5);
    expectVolume(p, 1.05 * 1.17 * 38.7);
  });
});

describe('extrudedSection', () => {
  const from: Point = [0, 0, 22];
  const slope = 26.2 * DEG;
  const length = 46.12;
  const to: Point = [0, -length * Math.cos(slope), 22 + length * Math.sin(slope)];

  it('a corbelled section encloses the sum of its step areas times the length', () => {
    const g = extrudedSection({ from, to, section: GALLERY, heightMode: 'perpendicular' });
    expectVolume(g, sectionArea(GALLERY) * length);
  });

  it('has four vertices per section pair and stays closed at every step', () => {
    const g = extrudedSection({ from, to, section: GALLERY });
    expect(g.vertexCount).toBe(4 * GALLERY.length);
    expect(g.triangleCount).toBe(8 * GALLERY.length - 4);
    expect(unpairedEdges(g)).toEqual([]);
    expect(meshVolume(g)).toBeGreaterThan(0);
  });

  it('a two-pair section is exactly what the passage builder makes', () => {
    const a = extrudedSection({ from, to, section: [[0.525, 0], [0.525, 1.2]] });
    const b = passage({ from, to, width: 1.05, height: 1.2 });
    expect([...a.positions]).toEqual([...b.positions]);
    expect([...a.indices]).toEqual([...b.indices]);
  });

  it('vertical heights measure the corbel straight up', () => {
    const run = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const g = extrudedSection({ from, to, section: GALLERY, heightMode: 'vertical' });
    expectVolume(g, sectionArea(GALLERY) * run);
    expect(unpairedEdges(g)).toEqual([]);
  });

  it('rejects a section that is too short or runs downhill', () => {
    expect(() => extrudedSection({ from, to, section: [[0.5, 0]] })).toThrow(/two/);
    expect(() => extrudedSection({ from, to, section: [[0.5, 0], [0.5, 2], [0.5, 1]] })).toThrow(/decrease/);
  });

  it('rejects vertical heights on an axis with no horizontal run', () => {
    expect(() =>
      extrudedSection({ from: [0, 0, 0], to: [0, 0, -28], section: [[0.5, 0], [0.5, 1]], heightMode: 'vertical' }),
    ).toThrow(/horizontal run/);
  });

  it('still builds a vertical shaft when the heights are perpendicular to the floor', () => {
    const s = extrudedSection({ from: [0, 0, 0], to: [0, 0, -28], section: [[0.35, 0], [0.35, 0.7]] });
    expectVolume(s, 0.7 * 0.7 * 28);
    expect(unpairedEdges(s)).toEqual([]);
  });
});

describe('chamber', () => {
  const min: Point = [-5.235, -2.615, 43];
  const max: Point = [5.235, 2.615, 48.85];

  it('a plain chamber encloses the box', () => {
    const c = chamber({ min, max });
    expect(c.vertexCount).toBe(8);
    expect(c.triangleCount).toBe(12);
    expectVolume(c, 10.47 * 5.23 * 5.85);
    expect(unpairedEdges(c)).toEqual([]);
  });

  it('a gabled chamber adds half the gable prism', () => {
    // The Queen's Chamber: walls of 184.47 in, ridge at 245.1 in, running east to west.
    const walls = 184.47 * 0.0254;
    const ridge = 245.1 * 0.0254;
    const c = chamber({
      min: [-2.615, -2.875, 21],
      max: [2.615, 2.875, 21 + walls],
      gable: { ridgeHeight: ridge, axis: 'x' },
    });
    const box = 5.23 * 5.75 * walls;
    const prism = 5.23 * 5.75 * (ridge - walls);
    expect(c.vertexCount).toBe(10);
    expect(c.triangleCount).toBe(16);
    expectVolume(c, box + prism / 2);
    expect(unpairedEdges(c)).toEqual([]);
  });

  it('gables the other way round when the ridge runs north to south', () => {
    const c = chamber({ min, max, gable: { ridgeHeight: 7.4, axis: 'y' } });
    const box = 10.47 * 5.23 * 5.85;
    const prism = 10.47 * 5.23 * (7.4 - 5.85);
    expectVolume(c, box + prism / 2);
    expect(unpairedEdges(c)).toEqual([]);
    expect(c.landmarks['ridge.mid']).toEqual([0, 0, 43 + 7.4]);
  });

  it('names the centre, the floor centre and the eight corners in a fixed order', () => {
    const c = chamber({ min, max });
    expect(Object.keys(c.landmarks)).toEqual([
      'centre',
      'floor.centre',
      'corner.NE.floor',
      'corner.NE.ceiling',
      'corner.NW.floor',
      'corner.NW.ceiling',
      'corner.SW.floor',
      'corner.SW.ceiling',
      'corner.SE.floor',
      'corner.SE.ceiling',
    ]);
    expect(c.landmarks['centre']?.[2]).toBeCloseTo(45.925, 9);
    expect(c.landmarks['floor.centre']).toEqual([0, 0, 43]);
    expect(c.landmarks['corner.NE.floor']).toEqual([5.235, 2.615, 43]);
    expect(c.landmarks['corner.SW.ceiling']).toEqual([-5.235, -2.615, 48.85]);
  });

  it('adds the ridge midpoint only when gabled, and takes a prefix', () => {
    expect(chamber({ min, max }).landmarks['ridge.mid']).toBeUndefined();
    const q = chamber({ min, max, gable: { ridgeHeight: 7.4, axis: 'x' }, prefix: 'g1.queen' });
    expect(q.landmarks['g1.queen.ridge.mid']).toEqual([0, 0, 43 + 7.4]);
    expect(Object.keys(q.landmarks).at(-1)).toBe('g1.queen.ridge.mid');
  });
});
