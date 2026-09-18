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
import { ffmpegLine, srtClock, srtOf } from './encode';
import { frameCount, frameTimestamp } from './run';
import { cssSizeFor, dprFor } from './size';

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

describe("the frame's size", () => {
  it('draws exactly the size asked for, whatever the window is', () => {
    for (const cssWidth of [1600, 1279.5, 843.19, 3840]) {
      for (const [width, height] of [[1920, 1080], [2560, 1440], [3840, 2160]] as const) {
        const dpr = dprFor(cssWidth, width);
        const css = cssSizeFor(width, height, dpr);
        // What three does with the two: floor the product, per dimension.
        expect(Math.floor(css.width * dpr)).toBe(width);
        expect(Math.floor(css.height * dpr)).toBe(height);
      }
    }
  });

  it('aims over rather than under, because a pixel short is a pixel short', () => {
    expect(dprFor(1920, 1920)).toBeGreaterThan(1);
    expect(dprFor(1920, 1920)).toBeLessThan(1.001);
  });
});

describe('the subtitles', () => {
  it('times an entry from the shots before it, and only the shots with words', () => {
    const film = sequenceOf(
      shot('opening', 12, { title: 'The plateau', text: 'Everything here is placed from the database.' }),
      shot('travel', 8),
      shot('close', 20.5, { title: 'The dossier', text: 'Every claim, and what it comes to.' }),
    );
    expect(srtOf(film)).toBe(
      [
        '1',
        '00:00:00,000 --> 00:00:12,000',
        'The plateau',
        'Everything here is placed from the database.',
        '',
        '2',
        '00:00:20,000 --> 00:00:40,500',
        'The dossier',
        'Every claim, and what it comes to.',
        '',
      ].join('\n'),
    );
  });

  it('is empty when a sequence says nothing', () => {
    expect(srtOf(sequenceOf(shot('a', 10), shot('b', 10)))).toBe('');
  });

  it('counts hours and milliseconds the way an srt does', () => {
    expect(srtClock(0)).toBe('00:00:00,000');
    expect(srtClock(3661.25)).toBe('01:01:01,250');
  });
});

describe('the frames fallback', () => {
  it('writes the line that joins the frames back at the rate they were drawn at', () => {
    expect(ffmpegLine(24, 'seked-tour-1080p24')).toContain('-framerate 24');
    expect(ffmpegLine(24, 'seked-tour-1080p24')).toContain('frame-%06d.png');
  });
});
