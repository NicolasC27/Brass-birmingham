import { describe, expect, it, vi } from 'vitest';
import { botAction } from '../actions';
import { chooseBotMove } from '../bot';
import { newGame, serialize } from '../engine';
import { useGame } from '../store';
import type { SetupPayload } from '../types';

/* ------------------------------------------------------------------ */
/* Undo through the store, the way the hand dock does it: a human seat */
/* plays like a bot would, bots reply through runBot, and at random    */
/* moments the human undoes — the game must land exactly on the state  */
/* recorded before that action, with no replay failure, all game long. */
/* ------------------------------------------------------------------ */

/* the machines think at the bottom of the dial here: this is a test of
   the undo, not of their play, and a searching bot outlasts the clock */
vi.mock('../form', () => ({ readForm: () => ({ level: 0, games: 0 }), recordForm: () => ({ level: 0, games: 0 }) }));

const table: SetupPayload = {
  players: [
    { name: 'Nico', color: 'oxblood', type: 'human' },
    { name: 'Bob', color: 'verdigris', type: 'bot', persona: 'boulton' },
    { name: 'Cy', color: 'brass', type: 'bot', persona: 'wedgwood' },
  ],
  options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
};

describe('undo through the store', () => {
  it('takes back the action just taken while the turn is still the human\'s, never later', () => {
    for (const seed of [3, 17, 99]) {
      useGame.setState({ game: newGame(table, seed), humanMarks: [] });
      let rng = seed * 7919;
      const rand = () => ((rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648);
      const before = new Map<number, string>(); // action index → state before the human acted
      let undos = 0;
      for (let step = 0; step < 900; step++) {
        const st = useGame.getState();
        const g = st.game!;
        if (g.phase === 'game-over') break;
        if (g.phase === 'scoring-canal') {
          st.endCeremony();
          continue;
        }
        const p = g.players[g.current];
        if (p.isBot) {
          st.runBot();
          continue;
        }
        /* now and then, take the action just played back instead of playing on */
        if (st.canUndo() && rand() < 0.3) {
          const at = st.humanMarks[st.humanMarks.length - 1].at;
          expect(st.undo()).toBe(true);
          const back = useGame.getState().game!;
          expect(back.actions.length).toBe(at);
          expect(serialize({ ...back, fxSeq: 0, lastFx: undefined })).toBe(before.get(at));
          undos += 1;
          continue;
        }
        before.set(g.actions.length, serialize({ ...g, fxSeq: 0, lastFx: undefined }));
        const wanted = botAction(chooseBotMove(g, g.current));
        if (!wanted || !st.dispatch(wanted)) st.pass();
      }
      expect(undos).toBeGreaterThan(2);
      /* once the turn has passed, nothing can be taken back */
      const g = useGame.getState().game!;
      if (g.phase === 'action' && g.players[g.current].isBot) expect(useGame.getState().canUndo()).toBe(false);
    }
  });
});
