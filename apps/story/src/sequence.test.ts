import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEQUENCES, cover, frameAt, frameFile, frameSource, sequenceFiles } from './sequence';
import { STILLS } from './stills';

const root = join(__dirname, '..', '..', '..');

describe('the stage’s sequences', () => {
  it('have every frame committed, and no more', () => {
    for (const s of Object.values(SEQUENCES)) {
      for (let i = 0; i < s.frames; i++) expect(existsSync(join(root, frameSource(s, i))), frameSource(s, i)).toBe(true);
      expect(existsSync(join(root, frameSource(s, s.frames))), `${s.id} has a frame past its count`).toBe(false);
    }
  });

  it('give each frame a page copy of its own', () => {
    const files = sequenceFiles().map((f) => f.file);
    expect(new Set(files).size).toBe(files.length);
    for (const s of Object.values(SEQUENCES)) expect(frameFile(s, 0)).toMatch(new RegExp(`^sequences/${s.id}/f000\\.webp$`));
  });

  it('are each shown on a beat, which says stand-in where its still does', () => {
    for (const s of Object.values(SEQUENCES)) {
      const beats = STILLS.filter((b) => b.sequence === s.id);
      expect(beats.length, s.id).toBeGreaterThan(0);
      for (const b of beats) expect(b.widget).toBe('sequence');
    }
    for (const b of STILLS.filter((x) => x.widget === 'sequence')) expect(SEQUENCES[b.sequence ?? '']).toBeDefined();
    expect(STILLS.find((b) => b.sequence === 'enclosure-d-orbit')!.tags).toContain('stand-in');
  });
});

describe('frameAt', () => {
  it('runs an open sequence from its first frame to its last', () => {
    expect(frameAt(0, 10, false)).toEqual({ a: 0, b: 1, mix: 0 });
    expect(frameAt(1, 10, false)).toEqual({ a: 9, b: 9, mix: 0 });
    expect(frameAt(0.5, 11, false)).toEqual({ a: 5, b: 6, mix: 0 });
    expect(frameAt(2, 10, false).a).toBe(9);
    expect(frameAt(-1, 10, false).a).toBe(0);
  });

  it('takes a loop once round, its last frame blending into its first', () => {
    expect(frameAt(0, 96, true)).toEqual({ a: 0, b: 1, mix: 0 });
    const end = frameAt(1, 96, true);
    expect([end.a, end.b, end.mix]).toEqual([95, 0, 1]);
    const mid = frameAt(95.5 / 96, 96, true);
    expect([mid.a, mid.b]).toEqual([95, 0]);
    expect(mid.mix).toBeCloseTo(0.5);
  });
});

describe('cover', () => {
  it('fills a wider canvas edge to edge, cropping top and bottom', () => {
    const r = cover(960, 540, 1920, 900, 0.5);
    expect(r.w).toBe(1920);
    expect(r.x).toBe(0);
    expect(r.y).toBeCloseTo((900 - 1080) / 2);
  });

  it('keeps the focus in view on a phone, never leaving a gap at either side', () => {
    const mid = cover(960, 540, 390, 300, 0.5);
    expect(mid.x + mid.w / 2).toBeCloseTo(195);
    const left = cover(960, 540, 390, 300, 0);
    expect(left.x).toBe(0);
    const right = cover(960, 540, 390, 300, 1);
    expect(right.x + right.w).toBeCloseTo(390);
  });
});
