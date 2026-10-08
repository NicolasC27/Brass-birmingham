import { afterEach, describe, expect, it, vi } from 'vitest';
import { reasonText, setLang } from '@/i18n';
import { fr } from '@/i18n/fr';
import { applyAction } from '../actions';
import { newGame } from '../engine';
import { cardLabel, useGame } from '../store';
import type { GameState, SetupPayload } from '../types';

/* ------------------------------------------------------------------ */
/* What is being chosen on the board, and what the store says about it. */
/* A choice put down is not a move taken back: cancelling a card lifted */
/* or a verb opened leaves the move already played open to undo. And    */
/* what the store hands the board to show — a card's name, a refusal —  */
/* is in the reader's tongue.                                           */
/* ------------------------------------------------------------------ */

const table: SetupPayload = {
  players: [
    { name: 'Nico', color: 'oxblood', type: 'human' },
    { name: 'Eve', color: 'verdigris', type: 'human' },
  ],
  options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
};

const discard = (g: GameState) => ({ kind: 'pass' as const, card: g.players[g.current].hand[0].id });

describe('cancelling a choice', () => {
  it('keeps the move just played open to undo', () => {
    useGame.setState({ game: newGame(table, 7), code: null, local: null, humanMarks: [], homeTrouble: null });
    const st = () => useGame.getState();
    /* the first round is one action each: past it, a turn is two */
    for (let i = 0; i < 2; i++) expect(st().dispatch(discard(st().game!))).toBe(true);
    expect(st().game!.actionsLeft).toBe(2);
    expect(st().dispatch(discard(st().game!))).toBe(true);
    expect(st().canUndo()).toBe(true);
    /* a card lifted for the second action, then put down again */
    st().selectCard(st().game!.players[st().game!.current].hand[0].id);
    st().cancel();
    expect(st().canUndo()).toBe(true);
    /* a verb opened and put down the same way */
    st().setVerb('scout');
    st().cancel();
    expect(st().canUndo()).toBe(true);
    expect(st().undo()).toBe(true);
  });
});

describe('what the store hands the board to say', () => {
  afterEach(() => {
    setLang('en');
    vi.restoreAllMocks();
  });

  it('names a card\'s industries in the reader\'s tongue', () => {
    setLang('fr');
    expect(cardLabel({ id: 'c1', kind: 'industry', industry: 'cotton', industry2: 'manufacturer' })).toBe(`${fr.game.industry.cotton} / ${fr.game.industry.manufacturer}`);
    expect(cardLabel({ id: 'c2', kind: 'industry', industry: 'coal' })).toBe(fr.game.industry.coal);
  });

  it('shakes a refused move with the refusal said, not the engine\'s code', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setLang('fr');
    const g = newGame(table, 7);
    useGame.setState({ game: g, code: null, local: null, humanMarks: [], homeTrouble: null, shake: null });
    const bad = { kind: 'build' as const, card: 'no-such-card', town: 'dudley', slot: 0, industry: 'coal' as const };
    const raw = applyAction(g, g.current, bad).error;
    expect(raw).toBe('card-not-in-hand');
    expect(useGame.getState().dispatch(bad)).toBe(false);
    expect(useGame.getState().shake?.reason).toBe(reasonText(raw));
    expect(useGame.getState().shake?.reason).toBe(fr.game.reasons['card-not-in-hand']);
  });
});
