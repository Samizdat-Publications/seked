import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../../scripts/bundle';
import { meshVolume, type Footprint, type Mesh } from '@seked/geometry';
import {
  SPHINX_MASSING_LABEL,
  buildModel,
  isWholeState,
  massingParams,
  mergeMeshes,
  pyramidParams,
  structuresFor,
  type Model,
  type PyramidParams,
} from './model';

/**
 * The epoch override is the cubit slider's move applied to time, and the
 * point of the whole sky control: a dated claim evaluated at the year the
 * reader is looking at rather than at the one its author picked. These pin
 * both halves of that, the moving and the not moving.
 */
const bundle = buildBundle();

const thubanShaft = (model: Model) =>
  model.results.get('C2')?.comparisons.find((c) => c.label.includes('Thuban')) as { targetValue: number; absolute: number };

describe('the epoch override', () => {
  it("moves C2's residuals, which is what dragging the sky is for", () => {
    const stated = thubanShaft(buildModel(bundle, 'canonical', null, null));
    const earlier = thubanShaft(buildModel(bundle, 'canonical', null, -2999));
    expect(stated.targetValue).not.toBeCloseTo(earlier.targetValue, 3);
    // Thuban climbed towards the pole through the third millennium, so five
    // and a half centuries earlier it crossed the meridian lower down and the
    // King's Chamber north shaft misses it by more.
    expect(earlier.targetValue).toBeLessThan(stated.targetValue);
    expect(Math.abs(earlier.absolute)).toBeGreaterThan(Math.abs(stated.absolute));
  });

  it('leaves a claim with no epoch of its own exactly where it was', () => {
    const own = buildModel(bundle, 'canonical', null, null);
    const dragged = buildModel(bundle, 'canonical', null, -10449);
    for (const id of ['A1', 'A3', 'B1']) {
      expect(dragged.results.get(id), id).toEqual(own.results.get(id));
    }
  });

  it('records which epoch it used, so the panel can say so', () => {
    expect(buildModel(bundle, 'canonical', null, null).epochOverride).toBeNull();
    expect(buildModel(bundle, 'canonical', null, -9000).epochOverride).toBe(-9000);
  });
});

describe('the pyramid as it stands', () => {
  const model = buildModel(bundle, 'canonical', null, null);
  const g1 = model.pyramids.find((p) => p.id === 'g1') as PyramidParams;
  const courses = g1.courses as number[];

  it("carries the Great Pyramid's courses, bottom up, and none for the other two", () => {
    expect(courses).toHaveLength(201);
    // Goyon's thickest course is his first, and it is the one at the bottom.
    expect(courses[0]).toBe(1.5);
    expect(Math.max(...courses)).toBe(courses[0]);
    expect(model.pyramids.find((p) => p.id === 'g2')?.courses).toBeUndefined();
    expect(model.pyramids.find((p) => p.id === 'g3')?.courses).toBeUndefined();
  });

  it('stands within a centimetre of the height the database tabulates on its own', () => {
    // Two sources that were never compared until they were both in here:
    // Goyon's 201 courses add up to 138.745 m and Lehner tabulates the
    // surviving height as 138.75 m, five millimetres apart.
    const top = courses.reduce((sum, h) => sum + h, 0);
    expect(top).toBeCloseTo(138.745, 6);
    expect(Math.abs(top - (g1.heightToday as number))).toBeLessThan(0.01);
  });

  it("gives Khafre alone the level his surviving casing begins at, and never stores it", () => {
    const g2 = model.pyramids.find((p) => p.id === 'g2') as PyramidParams;
    // M&R put the cap 40 to 45 m down from the top, stored as 42.5 m; the
    // level is his present height less that, and is in no record.
    expect(g2.casingCapLevel).toBeCloseTo((g2.heightToday as number) - 42.5, 9);
    expect(model.values['g2.casing.cap.lower_edge.up']).toBeUndefined();
    expect(g1.casingCapLevel).toBeUndefined();
    expect(model.pyramids.find((p) => p.id === 'g3')?.casingCapLevel).toBeUndefined();
  });

  it('is left undefined rather than empty for a preset with no courses at all', () => {
    const bare = pyramidParams({ 'g1.base.side.mean': 230.33, 'g1.height.original': 146.59 }, 'g1');
    expect(bare?.courses).toBeUndefined();
    expect(bare?.heightToday).toBeUndefined();
  });
});

describe('the capstones', () => {
  const model = buildModel(bundle, 'canonical', null, null);

  /** The vertex highest up in a mesh. */
  const apex = (mesh: { positions: Float32Array }): [number, number, number] => {
    let best: [number, number, number] = [0, 0, -Infinity];
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const z = mesh.positions[i + 2] as number;
      if (z > best[2]) best = [mesh.positions[i] as number, mesh.positions[i + 1] as number, z];
    }
    return best;
  };

  it('stands one on each of the three, its apex at the pyramid’s own', () => {
    expect(model.pyramidions).toHaveLength(3);
    for (const p of model.pyramids) {
      const capstone = p.pyramidion;
      expect(capstone, p.id).toBeDefined();
      const [east, north, up] = apex(capstone as NonNullable<typeof capstone>);
      expect(east, p.id).toBeCloseTo(p.offsetEast, 3);
      expect(north, p.id).toBeCloseTo(p.offsetNorth, 3);
      expect(up, p.id).toBeCloseTo(p.offsetUp + p.height, 3);
      // It is a reconstruction and its own label is what says so.
      expect(capstone?.label, p.id).toContain('Reconstruction');
    }
    expect(model.pyramidions).toEqual(model.pyramids.map((p) => p.pyramidion));
  });

  it('builds none where the preset carries no capstone height', () => {
    const bare = pyramidParams({ 'g1.base.side.mean': 230.33, 'g1.height.original': 146.59 }, 'g1');
    expect(bare?.pyramidion).toBeUndefined();
  });
});

describe('the plateau and the Sphinx', () => {
  const model = buildModel(bundle, 'canonical', null, null);

  it('builds every footprint in the import, the mastabas as one field', () => {
    const features = bundle.footprints.features;
    const named = features.filter((f) => f.group !== 'mastabas');
    const field = model.plateau.masses.find((m) => m.id === 'mastabas');
    // Plus the one built from Petrie's records at build time: Khufu's basalt pavement.
    expect(model.plateau.masses.length).toBe(named.length + 1 + 1);
    expect(model.plateau.masses.some((m) => m.id === 'khufu.basalt_pavement')).toBe(true);
    expect(model.plateau.masses.some((m) => m.id === 'khafre.causeway')).toBe(true);
    expect(field?.count).toBe(features.length - named.length);
  });

  it('draws the Sphinx from OSM and drops the box, as the Blender generator does', () => {
    for (const id of ['sphinx.body', 'sphinx.head', 'sphinx.paws']) expect(model.plateau.masses.some((m) => m.id === id), id).toBe(true);
    expect(model.massings).toEqual([]);
  });

  it('falls back to the box when the bundle has no footprints', () => {
    const bare = buildModel({ ...bundle, footprints: { ...bundle.footprints, features: [] } }, 'canonical', null, null);
    const sphinx = bare.massings.find((m) => m.id === 'sphinx');
    expect(sphinx?.label).toBe(SPHINX_MASSING_LABEL);
    expect(sphinx?.length).toBe(bare.env['sphinx.length']);
    expect(sphinx?.width).toBe(bare.env['sphinx.width']);
    expect(sphinx?.height).toBe(bare.env['sphinx.height']);
    expect(sphinx?.offsetEast).toBeCloseTo(bare.env['sphinx.centre.offset.east'] as number, 12);
    expect(sphinx?.offsetNorth).toBeCloseTo(bare.env['sphinx.centre.offset.north'] as number, 12);
    expect(sphinx?.offsetEast as number).toBeGreaterThan(0);
    expect(sphinx?.offsetNorth as number).toBeLessThan(0);
  });

  it('merges meshes without losing a triangle or a cubic metre', () => {
    const field = model.plateau.masses.find((m) => m.id === 'mastabas');
    expect(field).toBeDefined();
    const parts = model.plateau.masses.filter((m) => m.group === 'queens').map((m) => m.mesh);
    const merged = mergeMeshes(parts);
    expect(merged.triangleCount).toBe(parts.reduce((a, m) => a + m.triangleCount, 0));
    expect(meshVolume(merged)).toBeCloseTo(parts.reduce((a, m) => a + meshVolume(m), 0), 0);
  });

  it('is left out rather than guessed at when a size or a position is missing', () => {
    const full: Record<string, number> = { 'x.length': 1, 'x.width': 2, 'x.height': 3, 'x.centre.offset.east': 4, 'x.centre.offset.north': 5 };
    expect(massingParams(full, 'x', 'X')).toEqual({ id: 'x', label: 'X', length: 1, width: 2, height: 3, offsetEast: 4, offsetNorth: 5 });
    for (const key of Object.keys(full)) {
      const { [key]: _dropped, ...without } = full;
      expect(massingParams(without, 'x', 'X'), `without ${key}`).toBeUndefined();
    }
  });
});

describe('the lesser monuments per state', () => {
  const model = buildModel(bundle, 'canonical', null, null);
  const features = bundle.footprints.features as Footprint[];
  const count = (group: string): number => features.filter((f) => f.group === group).length;

  it('builds every group the plateau has, in both of the builders’ states', () => {
    for (const state of ['built', 'today'] as const) {
      const s = model.plateau.structures(state);
      expect(s.queens.length, state).toBe(count('queens') - 1); // Khentkawes is not a pyramid
      expect(s.temples.length, state).toBe(count('temples'));
      expect(s.pits.length, state).toBe(count('pits'));
      expect(s.walls.length, state).toBe(count('walls'));
      expect(s.tombs.length, state).toBe(count('tombs'));
      expect(s.causeway?.id, state).toBe('khafre.causeway');
      // The Sphinx's three parts, Khentkawes and Khufu's basalt pavement.
      expect(s.fallback.map((f) => f.id).sort(), state).toEqual([
        'khentkawes', 'khufu.basalt_pavement', 'sphinx.body', 'sphinx.head', 'sphinx.paws',
      ]);
    }
  });

  it('draws the mastaba fields as one geometry and not as one mesh each', () => {
    const field = model.plateau.structures('built').mastabas;
    expect(field?.id).toBe('mastabas');
    expect(field?.mesh.triangleCount).toBeGreaterThan(count('mastabas') * 12);
    expect(field?.note).toContain(`${count('mastabas')} tombs`);
  });

  it('stands the early states whole and leaves the late ones as ruins', () => {
    expect(isWholeState('ancient')).toBe(true);
    expect(isWholeState('built')).toBe(true);
    expect(isWholeState('stripped')).toBe(false);
    expect(isWholeState('today')).toBe(false);
    const whole = model.plateau.structures('built');
    const ruined = model.plateau.structures('today');
    // The roofs, the colonnades, the causeway's roof and the pits' lids are the early states' alone.
    // A temple built from a published plan carries its roof and its pillars
    // among its parts instead of on their own fields.
    const roofed = (t: (typeof whole.temples)[number]): boolean =>
      t.roof !== undefined || (t.parts?.some((p) => p.name === 'roof') ?? false);
    const columned = (t: (typeof whole.temples)[number]): boolean =>
      t.pillars !== undefined || (t.parts?.some((p) => p.name.startsWith('pillar.')) ?? false);
    expect(whole.temples.every(roofed)).toBe(true);
    expect(whole.temples.some(columned)).toBe(true);
    expect(ruined.temples.every((t) => !roofed(t))).toBe(true);
    expect(whole.causewayRoof).toBeDefined();
    expect(ruined.causewayRoof).toBeUndefined();
    expect(whole.pitCovers).toBeDefined();
    expect(ruined.pitCovers).toBeUndefined();
    // And the cased field of tombs stands above the ruined one on the same outlines.
    expect(meshVolume(whole.mastabas?.mesh as Mesh)).toBeGreaterThan(meshVolume(ruined.mastabas?.mesh as Mesh));
  });

  it('draws an enclosure wall only where the database gives one, and only whole', () => {
    // Petrie's section 71 gives Khafre's peribolus; nothing gives the other two.
    expect(model.plateau.structures('built').enclosureWalls.map((w) => w.id)).toEqual(['g2.enclosure']);
    expect(model.plateau.structures('today').enclosureWalls).toEqual([]);
    const wall = model.plateau.structures('built').enclosureWalls[0];
    expect(wall?.note).toContain('g2.enclosure.distance.outer');
    expect(wall?.note).toContain('outer face');
  });

  it('says of every solid what it is and how far it is a reconstruction', () => {
    const s = model.plateau.structures('built');
    const all = [...s.queens, ...s.tombs, ...s.walls, ...s.enclosureWalls, ...s.pits, ...s.fallback, ...s.temples];
    expect(all.length).toBeGreaterThan(10);
    for (const one of all) {
      expect(one.name.length, one.id).toBeGreaterThan(0);
      expect(one.note.length, one.id).toBeGreaterThan(20);
      expect(['reconstruction', 'excavated'], one.id).toContain(one.tier);
    }
    // A massing is what is there; a builder's account of how it stood is not.
    expect(s.fallback.every((f) => f.tier === 'excavated')).toBe(true);
    expect(s.queens.every((q) => q.tier === 'reconstruction')).toBe(true);
  });

  it('keeps one build of a state and hands the same one back', () => {
    expect(model.plateau.structures('built')).toBe(model.plateau.structures('built'));
    expect(model.plateau.structures('built')).not.toBe(model.plateau.structures('today'));
  });

  it('builds nothing for a pyramid the environment cannot give a height', () => {
    const one = features.find((f) => f.id === 'g2a') as Footprint;
    expect(structuresFor([one], {}, 'built').queens).toEqual([]);
    expect(structuresFor([one], { 'tier3.satellite_pyramid.height': 3 }, 'built').queens.length).toBe(1);
  });
});
