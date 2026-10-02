import { describe, expect, it } from 'vitest';
import { dispatchLine, editionText } from './edition';

/* the Monday edition as written out, and a dispatch said the Gazette's way */

describe('the Monday edition', () => {
  it('names the game of the week, the most assiduous and the board', () => {
    const { subject, text } = editionText(
      { week: 35, games: 3, best: { code: 'A', name: 'Forge de Deritend', finishedAt: 1, winner: 'Ada', vp: 171, players: ['Ada', 'Brunel'] }, busiest: { name: 'Brunel', games: 3 }, latest: [] },
      { week: 35, players: 2, rows: [{ id: 'a', name: 'Ada', color: null, points: 210, vp: 150, met: [true, true, true], at: 1 }], me: null },
      'https://blackrail.example',
    );
    expect(subject).toContain('Blackrail');
    expect(text).toContain('semaine 36');
    expect(text).toContain('« Forge de Deritend » — Ada l’emporte avec 171 points');
    expect(text).toContain('Brunel, 3 parties');
    expect(text).toContain('1. Ada — 210');
    expect(text).toContain('(3/3)');
    expect(text).toContain('https://blackrail.example');
  });

  it('says a quiet week plainly', () => {
    const { text } = editionText({ week: 0, games: 0, best: null, busiest: null, latest: [] }, { week: 0, players: 0, rows: [], me: null }, 'x');
    expect(text).toContain('Le club n’a pas encore joué cette semaine.');
    expect(text).toContain('Personne n’a encore relevé l’avis.');
  });
});

describe('a dispatch', () => {
  it('reads the goods in the club\'s own words', () => {
    expect(dispatchLine({ code: 'X', table: 'Forge', at: 1, era: 'canal', round: 3, key: 'sells', vars: { name: 'Mrs Wedgwood', n: 1, merchant: 'Gloucester', goods: 'cotton' } })).toBe('« Forge » — Mrs Wedgwood écoule sa filature chez Gloucester');
    expect(dispatchLine({ code: 'X', table: 'Forge', at: 1, era: 'rail', round: 1, key: 'unknownKey', vars: {} })).toBe('« Forge » — unknownKey');
  });
});
