import { beforeEach, describe, expect, it } from 'vitest';
import { buildBundle } from '../../../scripts/bundle';
import { useMotion } from './motion/store';
import { sequenceSeconds, type Shot } from './motion/types';
import { SEQUENCES } from './sequences';
import { useView } from './store';
import { TOUR, TOUR_STEPS, cameraFrom, momentOf, shotOf, wordCount } from './tour';
import { DEFAULT_VIEW, STATES } from './view';

/**
 * The tour is the stranger's first ten minutes, so what has to hold is that
 * every shot puts the viewer where it says it does, lasts long enough to be
 * read, and that none of its numbers has drifted away from the database or
 * the timeline it stands in for.
 */
const bundle = buildBundle();

/** The last camera key's second: how long the shot spends getting somewhere. */
const travelOf = (shot: Shot): number => shot.camera[shot.camera.length - 1]?.at ?? 0;

/** Every timeline change in a shot, in the order they happen. */
const changesOf = (shot: Shot) => [...(shot.state ? [shot.state] : []), ...(shot.states ?? [])];

const reset = (): void => {
  useMotion.getState().stop();
  useView.setState({ ...DEFAULT_VIEW, cameraEpoch: 0 });
};

beforeEach(reset);

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

describe('a shot s length', () => {
  it('is its travel plus its words at three a second', () => {
    const stand = { position: [0, 10, 0] as [number, number, number], target: [0, 0, -100] as [number, number, number] };
    const shot = shotOf({ id: 'x', camera: [{ at: 0, value: stand }, { at: 6, value: stand }], text: 'one two three four five six' });
    expect(wordCount('one two three four five six')).toBe(6);
    expect(shot.seconds).toBe(8);
  });

  it('is the reading alone for a stand with no travel', () => {
    const stand = { position: [0, 10, 0] as [number, number, number], target: [0, 0, -100] as [number, number, number] };
    expect(shotOf({ id: 'x', camera: [{ at: 0, value: stand }], text: 'one two three' }).seconds).toBe(1);
  });
});

describe('the tour s shots', () => {
  it('has an id for every shot and no id twice', () => {
    const ids = TOUR_STEPS.map((shot) => shot.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(TOUR_STEPS).toBe(TOUR.shots);
  });

  it('runs every shot for longer than it spends travelling', () => {
    for (const shot of TOUR_STEPS) {
      expect(shot.seconds, shot.id).toBeGreaterThan(0);
      expect(shot.seconds, shot.id).toBeGreaterThan(travelOf(shot));
    }
  });

  it('keeps every move inside the six to ten second band', () => {
    for (const shot of TOUR_STEPS) {
      const travel = travelOf(shot);
      if (travel === 0) continue;
      expect(travel, shot.id).toBeGreaterThanOrEqual(6);
      expect(travel, shot.id).toBeLessThanOrEqual(10);
    }
  });

  it('gives every shot that says something a title to say it under', () => {
    for (const shot of TOUR_STEPS) if (shot.text) expect(shot.title, shot.id).toBeTruthy();
  });

  it('keeps every camera key clear of the ground', () => {
    for (const shot of TOUR_STEPS) for (const key of shot.camera) expect(key.value.position[1], `${shot.id} at ${key.at}`).toBeGreaterThan(2);
  });

  it('starts every move from where the shot before it ended', () => {
    for (let i = 1; i < TOUR_STEPS.length; i += 1) {
      const previous = TOUR_STEPS[i - 1] as Shot;
      const shot = TOUR_STEPS[i] as Shot;
      const last = previous.camera[previous.camera.length - 1]?.value;
      expect(shot.camera[0]?.value, shot.id).toEqual(last);
    }
  });

  it('opens and closes on the survey', () => {
    const first = changesOf(TOUR_STEPS[0] as Shot);
    const last = changesOf(TOUR_STEPS[TOUR_STEPS.length - 1] as Shot);
    expect(first[0]?.to).toBe('today');
    expect(last[last.length - 1]?.to).toBe('today');
  });

  it('runs its timeline changes in the order they are written', () => {
    for (const shot of TOUR_STEPS) {
      const ats = changesOf(shot).map((change) => change.at);
      expect([...ats].sort((a, b) => a - b), shot.id).toEqual(ats);
      for (const at of ats) expect(at, shot.id).toBeLessThanOrEqual(shot.seconds);
    }
  });

  it('names only stops the timeline has and only Sphinxes the view knows', () => {
    const stops = new Set(STATES.map((s) => s.id));
    for (const shot of TOUR_STEPS) for (const change of changesOf(shot)) expect(stops, shot.id).toContain(change.to);
  });

  it('opens only claims the bundle carries', () => {
    const known = new Set(bundle.claims.map((c) => c.id));
    for (const shot of TOUR_STEPS) if (shot.claim) expect(known, shot.id).toContain(shot.claim);
  });
});

describe('the epochs and the stars the shots name', () => {
  /**
   * The two epochs the shots roll between are read off the timeline, so what
   * is checked here is that the timeline and the claims still agree: C2 is
   * stated at the "as built" stop's epoch and C5 at the First Time's.
   */
  const epochOf = (id: string): number | undefined => bundle.claims.find((c) => c.id === id)?.epoch;
  const stopEpoch = (id: string): number => (STATES.find((s) => s.id === id) as (typeof STATES)[number]).epoch;

  it('holds C2 at the epoch the as-built stop stands at', () => {
    const shot = TOUR_STEPS.find((s) => s.id === 'C2') as Shot;
    expect(epochOf('C2')).toBe(stopEpoch('built'));
    expect((shot.epoch as { value: number }[])[0]?.value).toBe(stopEpoch('built'));
  });

  it("rolls C5 back to Hancock and Bauval's epoch, which is the First Time's", () => {
    const shot = TOUR_STEPS.find((s) => s.id === 'C5') as Shot;
    const keys = shot.epoch as { at: number; value: number }[];
    expect(epochOf('C5')).toBe(stopEpoch('ancient'));
    expect(keys[0]?.value).toBe(stopEpoch('built'));
    expect(keys[keys.length - 1]?.value).toBe(stopEpoch('ancient'));
    expect((keys[keys.length - 1]?.at as number) - (keys[0]?.at as number)).toBe(10);
  });

  it('holds a star the catalogue actually has on the meridian', () => {
    const known = new Set(bundle.stars.map((s) => s.id));
    let held = 0;
    for (const sequence of SEQUENCES) {
      for (const shot of sequence.shots) {
        if (!shot.lst || Array.isArray(shot.lst)) continue;
        expect(known, `${sequence.id}: ${shot.id}`).toContain(shot.lst.meridian);
        held += 1;
      }
    }
    // The shaft shot and the rollback, so a meridian that stops being read
    // does not pass this test by being absent.
    expect(held).toBe(2);
  });

  it('takes every moment from the named ones in view.ts', () => {
    expect(momentOf('midnight').hour).toBe(0);
    expect(() => momentOf('teatime')).toThrow();
  });
});

describe('the film sequences', () => {
  it('lists the tour and the two presets, each with a label and a note', () => {
    expect(SEQUENCES.map((s) => s.id)).toEqual(['tour', 'eras', 'rollback']);
    for (const sequence of SEQUENCES) {
      expect(sequence.label, sequence.id).toBeTruthy();
      expect(sequence.note, sequence.id).toBeTruthy();
      expect(sequence.shots.length, sequence.id).toBeGreaterThan(0);
    }
  });

  it('runs the eras from the First Time to the survey, fifteen seconds each', () => {
    const eras = SEQUENCES.find((s) => s.id === 'eras') as (typeof SEQUENCES)[number];
    expect(eras.shots.map((shot) => shot.state?.to)).toEqual(['ancient', 'built', 'stripped', 'today']);
    for (const shot of eras.shots) expect(shot.seconds, shot.id).toBe(15);
    expect(sequenceSeconds(eras)).toBe(60);
  });

  it('rolls the sky from now to the two epochs and rests at each', () => {
    const rollback = SEQUENCES.find((s) => s.id === 'rollback') as (typeof SEQUENCES)[number];
    expect(sequenceSeconds(rollback)).toBe(20);
    const keys = rollback.shots[0]?.epoch as { at: number; value: number }[];
    expect(keys.map((k) => k.value)).toEqual([2026, -2449, -2449, -10499, -10499]);
    expect(keys.map((k) => k.at)).toEqual([0, 6, 10, 16, 20]);
  });

  it('keeps every camera key in every sequence clear of the ground', () => {
    for (const sequence of SEQUENCES) {
      for (const shot of sequence.shots) {
        for (const key of shot.camera) expect(key.value.position[1], `${sequence.id}: ${shot.id}`).toBeGreaterThan(2);
      }
    }
  });
});

describe('the tour actions', () => {
  it('loads the tour into the motion store and mirrors the shot into the view', () => {
    useView.getState().startTour();
    expect(useMotion.getState().sequence?.id).toBe('tour');
    expect(useMotion.getState().playing).toBe(true);
    expect(useView.getState().tour).toBe(0);
  });

  it('walks forward, back and out again', () => {
    const { startTour, nextStep, prevStep, endTour } = useView.getState();
    startTour();
    nextStep();
    expect(useView.getState().tour).toBe(1);
    expect(useMotion.getState().time).toBe(0);
    prevStep();
    expect(useView.getState().tour).toBe(0);
    // Back from the first shot is not a way out of the tour; End tour is.
    prevStep();
    expect(useView.getState().tour).toBe(0);
    endTour();
    expect(useView.getState().tour).toBeNull();
    expect(useMotion.getState().sequence).toBeNull();
  });

  it('ends the tour rather than running off the end of it', () => {
    const { goToStep, nextStep } = useView.getState();
    goToStep(TOUR_STEPS.length - 1);
    expect(useView.getState().tour).toBe(TOUR_STEPS.length - 1);
    nextStep();
    expect(useView.getState().tour).toBeNull();
  });

  it('leaves everything alone for an index with no shot', () => {
    useView.getState().goToStep(TOUR_STEPS.length);
    expect(useView.getState().tour).toBeNull();
    expect(useMotion.getState().sequence).toBeNull();
  });

  it('does nothing on next or back when no tour is running', () => {
    useView.getState().nextStep();
    useView.getState().prevStep();
    expect(useView.getState().tour).toBeNull();
    expect(useView.getState().cameraEpoch).toBe(0);
  });

  it('leaves the tour index null while a film preset is the sequence loaded', () => {
    const rollback = SEQUENCES.find((s) => s.id === 'rollback') as (typeof SEQUENCES)[number];
    useMotion.getState().play(rollback, 0);
    expect(useView.getState().tour).toBeNull();
  });
});
