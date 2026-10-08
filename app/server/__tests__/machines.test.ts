import { describe, expect, it } from 'vitest';
import { applyAction, botAction, fallbackAction } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { chooseBotMove } from '@/game/bot';
import { newGame } from '@/game/engine';
import type { GameState, SetupPayload } from '@/game/types';

/* ------------------------------------------------------------------ */
/* The machines the office seats: every move they name is one the      */
/* engine will have, and the card they lay down is named in the log    */
/* rather than left to the engine's hand order.                        */
/* ------------------------------------------------------------------ */

const COLORS = ['brass', 'oxblood', 'verdigris', 'steel'] as const;
const setup = (n: number): SetupPayload => ({
  players: COLORS.slice(0, n).map((color, i) => ({ name: `M${i}`, color, type: 'bot' })),
  options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
});

interface Played {
  /** the moves the engine turned down, as the seat named them */
  refused: { at: string; action: GameAction; error?: string }[];
  /** the retools of the rail era the machines asked for */
  retools: number;
  loans: GameAction[];
}

/** a whole game of machines, each move the heuristic's own, and what came of it */
function play(n: number, seed: number): Played {
  const out: Played = { refused: [], retools: 0, loans: [] };
  let s: GameState = newGame(setup(n), seed);
  for (let guard = 0; guard < 3000 && s.phase !== 'game-over'; guard++) {
    if (s.phase === 'scoring-canal') {
      s = applyAction(s, s.current, { kind: 'begin-rail' }).state!;
      continue;
    }
    const move = chooseBotMove(s, s.current);
    const action = botAction(move);
    if (move?.note.includes('age of steam')) out.retools += 1;
    if (action?.kind === 'loan') out.loans.push(action);
    let r = action ? applyAction(s, s.current, action) : null;
    if (action && !r!.state) out.refused.push({ at: `${n} seats, seed ${seed}, ${s.era} R${s.round}`, action, error: r!.error });
    if (!r?.state) r = applyAction(s, s.current, fallbackAction(s, s.current));
    s = r.state!;
  }
  expect(s.phase).toBe('game-over');
  return out;
}

describe('the machines', () => {
  it('never ask for a pair of retools the iron cannot stretch to', () => {
    /* each of these tables once saw a machine price its two developments
       with the same last cube of iron, and the engine turn the pair down */
    const games = [play(3, 8), play(3, 9), play(3, 38), play(4, 11), play(4, 27)];
    expect(games.flatMap((g) => g.refused)).toEqual([]);
    /* and the retool was asked for, so the tables did put it to the test */
    expect(games.reduce((a, g) => a + g.retools, 0)).toBeGreaterThan(0);
  });

  it('name the card they lay down to borrow or to pass', () => {
    const loans = [play(4, 11), play(3, 38)].flatMap((g) => g.loans);
    expect(loans.length).toBeGreaterThan(0);
    for (const loan of loans) expect(loan).toMatchObject({ kind: 'loan', card: expect.any(String) });

    /* a hand of two cannot scout: the seat passes, and says with what */
    const s = newGame(setup(2), 5);
    const me = s.current;
    s.players[me].hand = s.players[me].hand.slice(0, 2);
    const pass = fallbackAction(s, me);
    expect(pass.kind).toBe('pass');
    expect(s.players[me].hand.map((c) => c.id)).toContain((pass as { card?: string }).card);
    expect(applyAction(s, me, pass).state).not.toBeNull();
  });
});
