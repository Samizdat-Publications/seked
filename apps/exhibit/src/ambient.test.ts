import { describe, expect, it } from 'vitest';
import { BEDS, bedFor } from './ambient';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readLeaves } from './leaves';

describe('bedFor', () => {
  it('hears the chamber as inside, whatever the era', () => {
    expect(bedFor({ station: 'kings-chamber', era: 'built', moment: 'night-dark' })).toBe('inside');
  });
  it('hears night before era', () => {
    expect(bedFor({ station: 'orion', era: 'first-time', moment: 'night-dark' })).toBe('night');
  });
  it('hears the green eras as green', () => {
    expect(bedFor({ station: 'sphinx-side', era: 'first-time', moment: 'equinox-dawn' })).toBe('green');
    expect(bedFor({ station: 'sphinx-flank', era: 'lion', moment: 'equinox-dawn' })).toBe('green');
  });
  it('hears as built and today apart', () => {
    expect(bedFor({ station: 'south', era: 'built', moment: 'golden-south' })).toBe('built');
    expect(bedFor({ station: 'sphinx', era: 'today', moment: 'equinox-dawn' })).toBe('today');
  });
  it('gives every leaf a bed that exists', () => {
    const raw = JSON.parse(readFileSync(join(__dirname, '..', 'leaves.json'), 'utf8'));
    for (const L of readLeaves(raw)) expect(BEDS).toContain(bedFor(L));
  });
});
