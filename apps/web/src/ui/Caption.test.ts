import { describe, expect, it } from 'vitest';
import { honestyWord, listWords, loadingWords } from './Caption';

describe('loadingWords', () => {
  it('says nothing when nothing is loading', () => {
    expect(loadingWords([])).toEqual([]);
  });

  it('collapses several loads of one kind into the one phrase', () => {
    expect(loadingWords(['stone:core', 'stone:casing', 'stone:sand'])).toEqual(['the stone']);
  });

  it('names each kind once, in the order the caption lists them', () => {
    expect(loadingWords(['sphinx:sphinx-meshy', 'stone:core'])).toEqual(['the stone', 'the Sphinx']);
  });

  it('shows a kind nobody has named as it is, so a new loader needs no change here', () => {
    expect(loadingWords(['vegetation:palms'])).toEqual(['vegetation']);
    expect(loadingWords(['stone:core', 'water:harbour'])).toEqual(['the stone', 'water']);
  });
});

describe('listWords', () => {
  it('reads as English however many there are', () => {
    expect(listWords([])).toBe('');
    expect(listWords(['the stone'])).toBe('the stone');
    expect(listWords(['the stone', 'the Sphinx'])).toBe('the stone and the Sphinx');
    expect(listWords(['the stone', 'the models', 'the Sphinx'])).toBe('the stone, the models and the Sphinx');
  });
});

describe('honestyWord', () => {
  it("is the timeline stop's own word while no claim is open", () => {
    expect(honestyWord('survey', null, false)).toBe('survey');
    expect(honestyWord('reconstruction', null, false)).toBe('reconstruction');
    expect(honestyWord('claim', null, false)).toBe('claim');
  });

  it('is claim while a filed claim is open, whatever the state is', () => {
    expect(honestyWord('survey', 'A1', false)).toBe('claim');
    expect(honestyWord('reconstruction', 'C2', false)).toBe('claim');
  });

  it('says proposed for a claim the runner wrote, so it cannot pass for a filed one', () => {
    expect(honestyWord('survey', 'P1', true)).toBe('proposed');
    expect(honestyWord('claim', 'P2', true)).toBe('proposed');
  });
});
