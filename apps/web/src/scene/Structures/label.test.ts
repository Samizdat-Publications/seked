import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../../../../scripts/bundle';
import { buildModel, type Structures } from '../../model';
import { STATES, type StateId } from '../../view';
import { sekedUserData, type Labelled } from './label';

const bundle = buildBundle();
const model = buildModel(bundle, 'canonical', null, null);

/** Every structure of a state that gets a mesh, and so a label, in the scene. */
function labelled(s: Structures): Labelled[] {
  return [
    ...s.queens,
    ...s.tombs,
    ...s.temples,
    ...s.walls,
    ...s.enclosureWalls,
    ...s.pits,
    ...s.fallback,
    ...(s.mastabas ? [s.mastabas] : []),
    ...(s.causeway ? [s.causeway] : []),
    ...(s.causewayRoof ? [s.causewayRoof] : []),
    ...(s.pitCovers ? [s.pitCovers] : []),
  ];
}

describe('what a monument says when it is pointed at', () => {
  it('carries the four fields Track H reads, for every stop on the timeline', () => {
    for (const { id } of STATES) {
      const state = id as StateId;
      const all = labelled(model.plateau.structures(state));
      expect(all.length, state).toBeGreaterThan(15);
      for (const one of all) {
        const seked = sekedUserData(one, state);
        expect(seked.state, `${state} ${one.id}`).toBe(state);
        expect(seked.name, one.id).toBe(one.name);
        expect(seked.note, one.id).toBe(one.note);
        expect(['reconstruction', 'excavated'], one.id).toContain(seked.tier);
      }
    }
  });

  it('says of a reconstruction which keys it was built from and which parts are look choices', () => {
    const s = model.plateau.structures('built');
    const queen = s.queens[0];
    expect(queen?.tier).toBe('reconstruction');
    expect(queen?.note).toContain('Reconstruction');
    expect(queen?.note).toContain('Look');
    // The queens have no recorded slope, so the label says the angle follows
    // from the square and the height rather than from a measurement.
    expect(queen?.note).toContain('tier3.queens.slope');
    // A temple with no plan read for it says its form is the generic massing.
    const massed = s.temples.find((t) => t.parts === undefined);
    expect(massed?.note).toContain('tier3.temple.height.built');
    expect(massed?.note).toContain('Not a reconstruction of this temple');
    // Khafre's valley temple has Hölscher's Blatt XVII behind it, so its label
    // names the plan's own keys instead.
    const temple = s.temples.find((t) => t.id === 'khafre.valley_temple');
    expect(temple?.note).toContain('khafre_valley_temple.hall.stem.west');
    expect(temple?.note).toContain('Look choices');
  });

  it('says of a massing that its extent is the monument’s and its form is not', () => {
    const sphinx = model.plateau.structures('today').fallback.find((f) => f.id === 'sphinx.body');
    expect(sphinx?.tier).toBe('excavated');
    expect(sphinx?.note).toContain('Massing');
    expect(sphinx?.note).toContain('nothing about its form is');
    const khentkawes = model.plateau.structures('today').fallback.find((f) => f.id === 'khentkawes');
    expect(khentkawes?.note).toContain('Look choice: drawn as a prism');
  });
});
