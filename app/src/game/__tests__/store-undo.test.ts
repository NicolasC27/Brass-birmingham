import { describe, expect, it } from 'vitest';
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

const table: SetupPayload = {
  players: [
    { name: 'Nico', color: 'oxblood', type: 'human' },
    { name: 'Bob', color: 'verdigris', type: 'bot', difficulty: 'industrialist' },
    { name: 'Cy', color: 'brass', type: 'bot', difficulty: 'magnate' },
  ],
  options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
};

describe('undo through the store', () => {
  it('rolls back to the state before the human acted, at any point of a game', () => {
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
        /* now and then, undo instead of playing */
        if (st.humanMarks.length > 0 && rand() < 0.15) {
          const at = st.humanMarks[st.humanMarks.length - 1];
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
    }
  });
});
