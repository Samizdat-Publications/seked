import { positionsAtEpoch, transitLst } from '@seked/sky/browser';
import { describe, expect, it } from 'vitest';
import { buildBundle } from '../../../scripts/bundle';
import { useView } from './store';
import { TOUR, applyStep, cameraFrom } from './tour';
import { DEFAULT_VIEW, type LayerId } from './view';

/**
 * The tour is the stranger's first ten minutes, so what has to hold is that
 * every step puts the viewer where it says it does and that none of its
 * numbers has drifted away from the database it stands in for.
 */
const bundle = buildBundle();

const reset = (): void => useView.setState({ ...DEFAULT_VIEW, cameraEpoch: 0 });

describe('cameraFrom', () => {
  const target: [number, number, number] = [10, 20, 30];

  it('puts the camera on the compass bearing it is given', () => {
    // North is -Z in three's world frame and east is +X, so a camera due
    // north of a target is nearer the viewer's back of the plateau.
    const north = cameraFrom(target, 0, 0, 100);
    expect(north.position[0]).toBeCloseTo(10, 9);
    expect(north.position[2]).toBeCloseTo(-70, 9);

    const east = cameraFrom(target, 90, 0, 100);
    expect(east.position[0]).toBeCloseTo(110, 9);
    expect(east.position[2]).toBeCloseTo(30, 9);
  });

  it('puts the camera straight above the target at ninety degrees of elevation', () => {
    const above = cameraFrom(target, 137, 90, 500);
    expect(above.position[0]).toBeCloseTo(10, 9);
    expect(above.position[1]).toBeCloseTo(520, 9);
    expect(above.position[2]).toBeCloseTo(30, 9);
  });

  it('stands off by the distance it is given and keeps the target', () => {
    const { position, target: aimed } = cameraFrom(target, 217, 35, 800);
    const d = Math.hypot(position[0] - target[0], position[1] - target[1], position[2] - target[2]);
    expect(d).toBeCloseTo(800, 6);
    expect(position[1] - target[1]).toBeCloseTo(800 * Math.sin((35 * Math.PI) / 180), 9);
    expect(aimed).toBe(target);
  });
});

describe('the tour steps', () => {
  it('has an id for every step and no id twice', () => {
    const ids = TOUR.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });

  it('opens only claims the bundle carries', () => {
    const known = new Set(bundle.claims.map((c) => c.id));
    for (const step of TOUR) if (step.claim !== null) expect(known, step.id).toContain(step.claim);
  });

  it('holds the sky at the epoch the claim it opens is stated at', () => {
    for (const step of TOUR) {
      if (step.epoch === undefined) continue;
      const claim = bundle.claims.find((c) => c.id === step.claim);
      expect(claim?.epoch, step.id).toBe(step.epoch);
    }
  });

  it("sets the sidereal time the sky panel's Alnitak button would", () => {
    const step = TOUR.find((s) => s.id === 'C2');
    const alnitak = bundle.stars.find((s) => s.id === 'alnitak');
    const [ofDate] = positionsAtEpoch([alnitak as NonNullable<typeof alnitak>], step?.epoch as number);
    // The button reads the right ascension of the epoch rather than of J2000,
    // so precession moves it; a degree is as close as a stored value can stay.
    expect(step?.lst as number).toBeCloseTo(transitLst((ofDate as { raDeg: number }).raDeg), 0);
  });
});

describe('applyStep', () => {
  it('leaves the store in the state each step describes', () => {
    reset();
    let moves = 0;
    for (const step of TOUR) {
      applyStep(step, useView.getState());
      const state = useView.getState();
      expect(state.claim, step.id).toBe(step.claim);
      for (const [id, on] of Object.entries(step.layers)) expect(state.layers[id as LayerId], `${step.id}: ${id}`).toBe(on);
      expect(state.section.on, step.id).toBe(step.section?.on ?? false);
      if (step.section) expect(state.section, step.id).toMatchObject(step.section);
      expect(state.epoch, step.id).toBe(step.epoch ?? null);
      if (step.lst !== undefined) expect(state.lst, step.id).toBeCloseTo(step.lst, 9);
      expect(state.camera, step.id).toEqual(step.camera);
      expect(state.mode, step.id).toBe('orbit');
      // Every step moves the camera itself, so every step has to tell the
      // orbit controls to adopt it rather than keep the one they are holding.
      expect(state.cameraEpoch, step.id).toBe(++moves);
    }
  });

  it('leaves a claim open when the same step is applied twice, since setClaim toggles', () => {
    reset();
    const step = TOUR.find((s) => s.id === 'A1') as (typeof TOUR)[number];
    applyStep(step, useView.getState());
    applyStep(step, useView.getState());
    expect(useView.getState().claim).toBe('A1');
  });

  it('turns the cut off again for a step that does not ask for one', () => {
    reset();
    const inside = TOUR.find((s) => s.id === 'inside') as (typeof TOUR)[number];
    const after = TOUR.find((s) => s.id === 'C4') as (typeof TOUR)[number];
    applyStep(inside, useView.getState());
    expect(useView.getState().section.on).toBe(true);
    applyStep(after, useView.getState());
    expect(useView.getState().section.on).toBe(false);
  });

  it('gives the epoch back to the claims after a step that held it', () => {
    reset();
    applyStep(TOUR.find((s) => s.id === 'C2') as (typeof TOUR)[number], useView.getState());
    expect(useView.getState().epoch).toBe(-2449);
    applyStep(TOUR.find((s) => s.id === 'C4') as (typeof TOUR)[number], useView.getState());
    expect(useView.getState().epoch).toBeNull();
  });
});

describe('the tour actions', () => {
  it('walks forward, back and out again', () => {
    reset();
    const { startTour, nextStep, prevStep, endTour } = useView.getState();
    startTour();
    expect(useView.getState().tour).toBe(0);
    expect(useView.getState().camera).toEqual(TOUR[0]?.camera);
    nextStep();
    expect(useView.getState().tour).toBe(1);
    prevStep();
    expect(useView.getState().tour).toBe(0);
    // Back from the first step is not a way out of the tour; End tour is.
    prevStep();
    expect(useView.getState().tour).toBe(0);
    endTour();
    expect(useView.getState().tour).toBeNull();
    // The view the last step set stays where it is.
    expect(useView.getState().camera).toEqual(TOUR[0]?.camera);
  });

  it('ends the tour rather than running off the end of it', () => {
    reset();
    const { goToStep, nextStep } = useView.getState();
    goToStep(TOUR.length - 1);
    expect(useView.getState().tour).toBe(TOUR.length - 1);
    nextStep();
    expect(useView.getState().tour).toBeNull();
  });

  it('leaves the view alone for an index with no step', () => {
    reset();
    const before = useView.getState().camera;
    useView.getState().goToStep(TOUR.length);
    expect(useView.getState().tour).toBeNull();
    expect(useView.getState().camera).toBe(before);
  });

  it('does nothing on next or back when no tour is running', () => {
    reset();
    useView.getState().nextStep();
    useView.getState().prevStep();
    expect(useView.getState().tour).toBeNull();
    expect(useView.getState().cameraEpoch).toBe(0);
  });
});
