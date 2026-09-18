/**
 * The film's arithmetic, which is all of it that can be tested without a GPU.
 *
 * What a frame looks like is the scene's business and a browser's; what is
 * testable here is how many frames a sequence is, when each of them happens,
 * and what the subtitle file says. Those three are also the three that would
 * silently drift: a rounding error in the count loses the last frame, a
 * timestamp in the wrong unit finishes every dissolve at once, and a subtitle
 * off by a shot puts the narration over the wrong pyramid.
 */
import { describe, expect, it } from 'vitest';
import type { CameraView } from '../view';
import type { Sequence, Shot } from '../motion/types';
import { frameCount, frameTimestamp } from './run';

const STAND: CameraView = { position: [0, 100, 1000], target: [0, 70, 0] };

const shot = (id: string, seconds: number, words?: { title: string; text: string }): Shot => ({
  id,
  seconds,
  camera: [{ at: 0, value: STAND }],
  ...words,
});

const sequenceOf = (...shots: Shot[]): Sequence => ({ id: 'test', label: 'A test', note: 'For the arithmetic.', shots });

describe('frameCount', () => {
  it('is the length in seconds times the rate', () => {
    expect(frameCount(sequenceOf(shot('a', 20)), 24)).toBe(480);
    expect(frameCount(sequenceOf(shot('a', 8), shot('b', 12)), 30)).toBe(600);
  });

  it('rounds a length that is not a whole frame, and is never less than one', () => {
    expect(frameCount(sequenceOf(shot('a', 1.51)), 24)).toBe(36);
    expect(frameCount(sequenceOf(shot('a', 0.001)), 24)).toBe(1);
  });
});

describe('frameTimestamp', () => {
  it('starts one frame in, because the run advances before it draws', () => {
    expect(frameTimestamp(0, 24)).toBeCloseTo(1 / 24, 12);
  });

  it('steps by exactly one over the rate, which is the delta the scene sees', () => {
    const fps = 24;
    const schedule = Array.from({ length: 6 }, (_, frame) => frameTimestamp(frame, fps));
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i]! - schedule[i - 1]!).toBeCloseTo(1 / fps, 12);
    }
  });

  it('is in seconds: a second of film is a second on the clock', () => {
    expect(frameTimestamp(23, 24)).toBeCloseTo(1, 12);
    expect(frameTimestamp(29, 30)).toBeCloseTo(1, 12);
  });
});
