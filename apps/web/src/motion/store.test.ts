import { beforeEach, describe, expect, it } from 'vitest';
import { useMotion } from './store';
import { sequenceSeconds, type Sequence } from './types';

/**
 * The clock is the part every track leans on: a shot that runs out rolls
 * into the next, the last one stops at its final second and stays loaded,
 * and nothing moves unless the sequence is playing.
 */
const stand = { position: [0, 10, 0] as [number, number, number], target: [0, 0, -100] as [number, number, number] };

const sequence: Sequence = {
  id: 'test',
  label: 'Test',
  note: 'Three shots of two, three and one seconds.',
  shots: [
    { id: 'a', seconds: 2, camera: [{ at: 0, value: stand }] },
    { id: 'b', seconds: 3, camera: [{ at: 0, value: stand }] },
    { id: 'c', seconds: 1, camera: [{ at: 0, value: stand }] },
  ],
};

beforeEach(() => useMotion.getState().stop());

describe('the motion clock', () => {
  it('adds up a sequence', () => {
    expect(sequenceSeconds(sequence)).toBe(6);
  });

  it('rolls a shot that runs out into the next, carrying the remainder', () => {
    const m = useMotion.getState();
    m.play(sequence);
    m.advance(1.5);
    expect(useMotion.getState()).toMatchObject({ shot: 0, time: 1.5 });
    m.advance(1);
    expect(useMotion.getState()).toMatchObject({ shot: 1, time: 0.5 });
    m.advance(4);
    // 0.5 + 4 = 4.5 into shot b, which is three long: 1.5 into c.
    expect(useMotion.getState()).toMatchObject({ shot: 2 });
  });

  it('stops at the last second of the last shot and stays loaded', () => {
    const m = useMotion.getState();
    m.play(sequence);
    m.advance(10);
    const s = useMotion.getState();
    expect(s.playing).toBe(false);
    expect(s.shot).toBe(2);
    expect(s.time).toBe(1);
    expect(s.sequence?.id).toBe('test');
  });

  it('does not move while paused, and resumes where it was', () => {
    const m = useMotion.getState();
    m.play(sequence);
    m.advance(1);
    m.pause();
    m.advance(1);
    expect(useMotion.getState().time).toBe(1);
    m.resume();
    m.advance(0.5);
    expect(useMotion.getState().time).toBe(1.5);
  });

  it('seeks within the loaded sequence and clamps to it', () => {
    const m = useMotion.getState();
    m.play(sequence, 1);
    m.seek(5, 9);
    expect(useMotion.getState()).toMatchObject({ shot: 2, time: 1 });
    m.seek(-1, -1);
    expect(useMotion.getState()).toMatchObject({ shot: 0, time: 0 });
  });

  it('ignores a seek and an advance with nothing loaded', () => {
    const m = useMotion.getState();
    m.seek(1, 1);
    m.advance(1);
    expect(useMotion.getState()).toMatchObject({ sequence: null, shot: 0, time: 0, playing: false });
  });
});
