import type { Claim } from '@seked/claims/browser';
import { describe, expect, it } from 'vitest';
import type { FailedClaim } from '../model';
import { gradeOf, orderClaims } from './Claims';

const result = (over: Partial<FailedClaim>): FailedClaim => ({
  id: 'A1',
  title: 'π in the profile',
  group: 'proportion',
  status: 'computed',
  freeChoices: 0,
  comparisons: [],
  fits: undefined,
  ...over,
});

const claim = (id: string, origin: Claim['origin'] = 'filed'): Claim =>
  ({ id, title: id, group: 'proportion', origin, comparisons: [] }) as unknown as Claim;

describe('gradeOf', () => {
  it('says the fit in one word', () => {
    expect(gradeOf(result({ fits: true }))).toEqual({ word: 'fits', tone: 'fits' });
    expect(gradeOf(result({ fits: false }))).toEqual({ word: 'misses', tone: 'misses' });
  });

  it('spells out what a claim is still waiting for, in the muted tone', () => {
    expect(gradeOf(result({ status: 'needs-sky' }))).toEqual({ word: 'needs sky', tone: 'pending' });
    expect(gradeOf(result({ status: 'needs-site' }))).toEqual({ word: 'needs site', tone: 'pending' });
  });

  it('takes an error over a grade, because a claim that threw was never graded', () => {
    expect(gradeOf(result({ fits: true, error: 'no such key' }))).toEqual({ word: 'error', tone: 'pending' });
    expect(gradeOf(undefined)).toEqual({ word: 'error', tone: 'pending' });
  });
});

describe('orderClaims', () => {
  it('puts a proposed claim at the head of its group', () => {
    const list = [claim('A1'), claim('A3'), claim('P1', 'proposed')];
    expect(orderClaims(list).map((c) => c.id)).toEqual(['P1', 'A1', 'A3']);
  });

  it('leaves the filed ones in the order they were filed', () => {
    const list = [claim('A1'), claim('A2'), claim('A3')];
    expect(orderClaims(list).map((c) => c.id)).toEqual(['A1', 'A2', 'A3']);
  });

  it('keeps two proposals in the order they were proposed', () => {
    const list = [claim('A1'), claim('P1', 'proposed'), claim('P2', 'proposed')];
    expect(orderClaims(list).map((c) => c.id)).toEqual(['P1', 'P2', 'A1']);
  });

  it('does not touch the list it was given', () => {
    const list = [claim('A1'), claim('P1', 'proposed')];
    orderClaims(list);
    expect(list.map((c) => c.id)).toEqual(['A1', 'P1']);
  });
});
