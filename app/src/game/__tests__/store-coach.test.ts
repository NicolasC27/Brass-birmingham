import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stubStorage } from '@/platform/__tests__/storage';
import { LESSON_IDS, freshProgress, lessonIndex, saveProgress, see } from '@/components/game/lessons';
import { fallbackAction, withEdition } from '../actions';
import type { GameAction } from '../actions';
import type { Coached } from '../coach';
import { buildTargets, newGame } from '../engine';
import { useGame } from '../store';
import type { GameState, SetupPayload } from '../types';

/* ------------------------------------------------------------------ */
/* The coach at the guided table: the deed a lesson asks for is not    */
/* graded, and the word on the reader's move goes when the machine     */
/* plays. The coach and the office are stand-ins that count what the   */
/* store asks of them.                                                 */
/* ------------------------------------------------------------------ */

const coach = vi.hoisted(() => ({ asked: 0, hushed: 0 }));
vi.mock('../coach', () => ({
  coachMove: () => {
    coach.asked += 1;
  },
  hushCoach: () => {
    coach.hushed += 1;
  },
  dismissCoach: () => undefined,
}));
vi.mock('../home', async (load) => ({ ...(await load<typeof import('../home')>()), recordMove: async () => 'kept' as const }));

const CODE = 'GWE5';

function guided(): GameState {
  const setup = {
    players: [
      { name: 'Vous', color: 'brass', type: 'human' },
      { name: 'Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
    ],
    options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core', assist: true },
  } as SetupPayload;
  return newGame(withEdition(setup), 3);
}

/** the reader's first mine, wherever the hand first allows one */
const mineOf = (g: GameState): GameAction => {
  const at = g.players[0].hand.flatMap((c) => buildTargets(g, 0, c).filter((x) => x.valid && x.industry === 'coal').map((x) => ({ card: c.id, x })))[0];
  return { kind: 'build', card: at.card, town: at.x.town, slot: at.x.slot, industry: 'coal' };
};

/** a move played through the store, the office's answer waited for */
async function play(a: GameAction): Promise<void> {
  expect(useGame.getState().dispatch(a)).toBe(true);
  await new Promise((r) => setTimeout(r, 0));
}

const upTo = (id: string) => ({ ...freshProgress(CODE), passed: LESSON_IDS.slice(0, lessonIndex(id)) });

beforeEach(() => {
  stubStorage();
  coach.asked = 0;
  coach.hushed = 0;
});

describe('the coach at the guided table', () => {
  it('does not grade the deed a lesson asks for', async () => {
    const g = guided();
    saveProgress(see(upTo('coal'), 'coal', { g, me: 0, sel: null, mat: null }));
    useGame.setState({ game: g, tutorial: true, local: CODE, code: null, homeTrouble: null, humanMarks: [], coached: null });
    await play(mineOf(g));
    expect(coach.asked).toBe(0);
    expect(coach.hushed).toBeGreaterThan(0);
  });

  it('grades the same move once its lesson is passed, or away from the guided table', async () => {
    const g = guided();
    saveProgress(upTo('botTurn'));
    useGame.setState({ game: g, tutorial: true, local: CODE, code: null, homeTrouble: null, humanMarks: [], coached: null });
    await play(mineOf(g));
    expect(coach.asked).toBe(1);
    /* the guide closed: every move is the coach's again */
    saveProgress(upTo('coal'));
    useGame.setState({ game: g, tutorial: false, humanMarks: [], coached: null });
    await play(mineOf(g));
    expect(coach.asked).toBe(2);
  });

  it('sends its word away when the machine plays', async () => {
    const g = guided();
    saveProgress(upTo('botTurn'));
    useGame.setState({ game: g, tutorial: true, local: CODE, code: null, homeTrouble: null, humanMarks: [], coached: null });
    await play(mineOf(g));
    const after = useGame.getState().game!;
    expect(after.players[after.current].isBot).toBe(true);
    /* the word on the reader's mine, read while the machine thinks */
    const word = { at: g.actions.length, seat: 0, verdict: {} } as unknown as Coached;
    useGame.setState({ coached: word });
    const hushed = coach.hushed;
    await play(fallbackAction(after, after.current));
    expect(useGame.getState().coached).toBeNull();
    expect(coach.hushed).toBe(hushed + 1);
    /* away from the guided table the word stays over her move */
    useGame.setState({ game: after, tutorial: false, coached: word });
    await play(fallbackAction(after, after.current));
    expect(useGame.getState().coached).toBe(word);
  });
});
