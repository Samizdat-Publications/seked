import { describe, expect, it } from 'vitest';
import {
  CITY,
  CITY_STRIDE,
  PRISM_TRIANGLES,
  PRISM_VERTICES,
  cityBatchMesh,
  cityBatches,
  cityBox,
  cityMeshes,
  type CityBox,
  type CityCell,
} from './city';

/** The binary as the import writes it, from boxes given the readable way. */
function records(boxes: readonly CityBox[]): Float32Array {
  const data = new Float32Array(boxes.length * CITY_STRIDE);
  boxes.forEach((b, i) => {
    data.set([b.x, b.y, b.width, b.depth, b.yawDeg, b.height, b.measured ? 1 : 0], i * CITY_STRIDE);
  });
  return data;
}

const box = (over: Partial<CityBox> = {}): CityBox => ({
  x: 0,
  y: 0,
  width: 20,
  depth: 10,
  yawDeg: 0,
  height: 12,
  measured: true,
  ...over,
});

/** A flat ground, and a ground that tilts up to the east at one in ten. */
const flat = () => 0;
const tilted = (x: number) => x / 10;

describe('cityBox', () => {
  it('reads a record back as it was written', () => {
    const b = box({ x: 1234.5, y: -678.25, width: 31.5, depth: 12.25, yawDeg: 143.5, height: 27.75, measured: false });
    expect(cityBox(records([box(), b]), 1)).toEqual(b);
  });

  it('reads the filled heights as unmeasured and the rest as measured', () => {
    const data = records([box({ measured: true }), box({ measured: false, height: 8 })]);
    expect(cityBox(data, 0).measured).toBe(true);
    expect(cityBox(data, 1).measured).toBe(false);
  });
});

describe('cityBatches', () => {
  /** Two rows of cells, as the import writes them: south to north, west to east. */
  const cells: CityCell[] = [
    { x: 0, y: 0, from: 0, count: 10 },
    { x: 1000, y: 0, from: 10, count: 20 },
    { x: 4000, y: 0, from: 30, count: 5 },
    { x: 0, y: 1000, from: 35, count: 7 },
    { x: 4000, y: 1000, from: 42, count: 3 },
  ];

  it('gathers cells into blocks of the size it is asked for', () => {
    const batches = cityBatches(cells, 1000, 4);
    expect(batches.map((b) => [b.x, b.y, b.size])).toEqual([
      [0, 0, 4000],
      [4000, 0, 4000],
    ]);
  });

  it('counts every building exactly once', () => {
    const batches = cityBatches(cells, 1000, 4);
    expect(batches.reduce((n, b) => n + b.count, 0)).toBe(45);
  });

  it('joins cells whose records are adjacent and keeps the rest apart', () => {
    const [west, east] = cityBatches(cells, 1000, 4);
    // 0..9 and 10..29 are adjacent and become one run; 35..41 is a later row.
    expect(west?.runs).toEqual([{ from: 0, count: 30 }, { from: 35, count: 7 }]);
    expect(east?.runs).toEqual([{ from: 30, count: 5 }, { from: 42, count: 3 }]);
  });

  it('leaves out a cell with nothing in it', () => {
    const batches = cityBatches([...cells, { x: 8000, y: 0, from: 45, count: 0 }], 1000, 4);
    expect(batches.map((b) => b.x)).toEqual([0, 4000]);
  });

  it('puts a cell west or south of the origin in the block that contains it', () => {
    const batches = cityBatches([{ x: -1000, y: -2000, from: 0, count: 4 }], 1000, 4);
    expect(batches.map((b) => [b.x, b.y])).toEqual([[-4000, -4000]]);
  });
});

describe('cityBatchMesh', () => {
  const one = cityBatches([{ x: 0, y: 0, from: 0, count: 1 }], 1000, 4);

  it('costs one prism its four walls and its roof, and nothing else', () => {
    const mesh = cityBatchMesh(records([box()]), one[0]!, 'near', { groundLevel: flat });
    expect(mesh.vertexCount).toBe(PRISM_VERTICES);
    expect(mesh.triangleCount).toBe(PRISM_TRIANGLES);
    expect(mesh.positions.length).toBe(PRISM_VERTICES * 3);
    expect(mesh.indices.length).toBe(PRISM_TRIANGLES * 3);
    expect(mesh.drawn).toBe(1);
    expect(mesh.dropped).toBe(0);
  });

  it('never indexes past its own vertices', () => {
    const boxes = Array.from({ length: 12 }, (_, i) => box({ x: i * 40, y: i * 30, yawDeg: i * 15 }));
    const batch = cityBatches([{ x: 0, y: 0, from: 0, count: boxes.length }], 1000, 4);
    const mesh = cityBatchMesh(records(boxes), batch[0]!, 'near', { groundLevel: flat });
    expect(mesh.indices.length).toBe(mesh.triangleCount * 3);
    for (const i of mesh.indices) expect(i).toBeLessThan(mesh.vertexCount);
  });

  it('stands the prism on the ground under its own centre', () => {
    // The box is centred 500 m east, where the tilted ground is at 50 m.
    const mesh = cityBatchMesh(records([box({ x: 500, height: 12 })]), one[0]!, 'near', { groundLevel: tilted });
    const z: number[] = [];
    for (let v = 2; v < mesh.positions.length; v += 3) z.push(mesh.positions[v] as number);
    expect(Math.max(...z)).toBeCloseTo(50 + 12, 6);
    expect(Math.min(...z)).toBeCloseTo(50 - CITY.sinkMetres, 6);
  });

  it('sinks the base by the metres it is given and no more', () => {
    const mesh = cityBatchMesh(records([box()]), one[0]!, 'near', { groundLevel: flat, sinkMetres: 9 });
    const z: number[] = [];
    for (let v = 2; v < mesh.positions.length; v += 3) z.push(mesh.positions[v] as number);
    expect(Math.min(...z)).toBeCloseTo(-9, 6);
  });

  it('turns the box about its own centre, not about the origin', () => {
    // A long thin building far from the origin, turned a quarter turn: its
    // corners must stay around its centre, with the long side now north.
    const b = box({ x: 4000, y: -2000, width: 40, depth: 10, yawDeg: 90 });
    const mesh = cityBatchMesh(records([b]), one[0]!, 'near', { groundLevel: flat });
    const xs: number[] = [];
    const ys: number[] = [];
    for (let v = 0; v < mesh.positions.length; v += 3) {
      xs.push(mesh.positions[v] as number);
      ys.push(mesh.positions[v + 1] as number);
    }
    expect(Math.min(...xs)).toBeCloseTo(4000 - 5, 4);
    expect(Math.max(...xs)).toBeCloseTo(4000 + 5, 4);
    expect(Math.min(...ys)).toBeCloseTo(-2000 - 20, 4);
    expect(Math.max(...ys)).toBeCloseTo(-2000 + 20, 4);
    // The centre of the corners is the centre it was given.
    expect(xs.reduce((a, c) => a + c, 0) / xs.length).toBeCloseTo(4000, 4);
    expect(ys.reduce((a, c) => a + c, 0) / ys.length).toBeCloseTo(-2000, 4);
  });

  it('leaves a square building square whichever way it is turned', () => {
    for (const yawDeg of [0, 17, 45, 90, 143.5, 179]) {
      const b = box({ width: 10, depth: 10, yawDeg });
      const mesh = cityBatchMesh(records([b]), one[0]!, 'near', { groundLevel: flat });
      // The first wall's two base corners are ten metres apart, always.
      const dx = (mesh.positions[3] as number) - (mesh.positions[0] as number);
      const dy = (mesh.positions[4] as number) - (mesh.positions[1] as number);
      expect(Math.hypot(dx, dy), `${yawDeg} degrees`).toBeCloseTo(10, 6);
    }
  });

  it('winds the roof counter-clockwise seen from above, so it faces up', () => {
    const mesh = cityBatchMesh(records([box({ yawDeg: 37 })]), one[0]!, 'near', { groundLevel: flat });
    const roof = PRISM_VERTICES - 4;
    let twice = 0;
    for (let c = 0; c < 4; c++) {
      const a = (roof + c) * 3;
      const b = (roof + ((c + 1) % 4)) * 3;
      twice += (mesh.positions[a] as number) * (mesh.positions[b + 1] as number)
        - (mesh.positions[b] as number) * (mesh.positions[a + 1] as number);
    }
    expect(twice).toBeGreaterThan(0);
  });

  it('drops the small buildings from the far level and keeps the big ones', () => {
    const boxes = [
      box({ x: 0, width: 30, depth: 20 }), // 600 m2, kept
      box({ x: 100, width: 10, depth: 5 }), // 50 m2, dropped
      box({ x: 200, width: 20, depth: 10 }), // exactly 200 m2, kept
    ];
    const batch = cityBatches([{ x: 0, y: 0, from: 0, count: 3 }], 1000, 4);
    const near = cityBatchMesh(records(boxes), batch[0]!, 'near', { groundLevel: flat });
    const far = cityBatchMesh(records(boxes), batch[0]!, 'far', { groundLevel: flat });
    expect([near.drawn, near.dropped]).toEqual([3, 0]);
    expect([far.drawn, far.dropped]).toEqual([2, 1]);
    expect(far.vertexCount).toBe(2 * PRISM_VERTICES);
    expect(far.triangleCount).toBe(2 * PRISM_TRIANGLES);
  });

  it('counts how many of the drawn carry a height the raster measured', () => {
    const boxes = [box({ measured: true }), box({ x: 60, measured: false }), box({ x: 120, measured: true })];
    const batch = cityBatches([{ x: 0, y: 0, from: 0, count: 3 }], 1000, 4);
    const mesh = cityBatchMesh(records(boxes), batch[0]!, 'near', { groundLevel: flat });
    expect(mesh.measured).toBe(2);
    expect(mesh.drawn).toBe(3);
  });

  it('builds nothing at all rather than throwing when every building is dropped', () => {
    const batch = cityBatches([{ x: 0, y: 0, from: 0, count: 1 }], 1000, 4);
    const mesh = cityBatchMesh(records([box({ width: 4, depth: 3 })]), batch[0]!, 'far', { groundLevel: flat });
    expect(mesh.vertexCount).toBe(0);
    expect(mesh.triangleCount).toBe(0);
    expect([mesh.drawn, mesh.dropped]).toEqual([0, 1]);
  });

  it('reads only its own runs, and not the records beside them', () => {
    // Three buildings; the batch owns the middle one alone.
    const boxes = [box({ x: -500 }), box({ x: 0 }), box({ x: 500 })];
    const batch = cityBatches([{ x: 0, y: 0, from: 1, count: 1 }], 1000, 4);
    const mesh = cityBatchMesh(records(boxes), batch[0]!, 'near', { groundLevel: flat });
    expect(mesh.drawn).toBe(1);
    const xs: number[] = [];
    for (let v = 0; v < mesh.positions.length; v += 3) xs.push(mesh.positions[v] as number);
    expect(Math.min(...xs)).toBeCloseTo(-10, 6);
    expect(Math.max(...xs)).toBeCloseTo(10, 6);
  });
});

describe('cityMeshes', () => {
  it('builds one mesh per batch and loses nobody between them', () => {
    const boxes = Array.from({ length: 9 }, (_, i) => box({ x: i * 1000 + 500, y: 500 }));
    const cells: CityCell[] = boxes.map((_, i) => ({ x: i * 1000, y: 0, from: i, count: 1 }));
    const batches = cityBatches(cells, 1000, 4);
    const meshes = cityMeshes(records(boxes), batches, 'near', { groundLevel: flat });
    expect(meshes.length).toBe(batches.length);
    expect(meshes.reduce((n, m) => n + m.drawn, 0)).toBe(9);
    expect(meshes.every((m) => m.level === 'near')).toBe(true);
  });
});
