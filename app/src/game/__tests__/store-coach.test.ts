import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubStorage } from '@/platform/__tests__/storage';
import { LESSON_IDS, freshProgress, lessonIndex, progressAt, saveProgress, see, settle } from '@/components/game/lessons';
import { applyAction, fallbackAction, withEdition } from '../actions';
import type { GameAction } from '../actions';
import type { Coached } from '../coach';
import { buildTargets, newGame } from '../engine';
import { useGame } from '../store';
import type { GameState, SetupPayload } from '../types';

/* ------------------------------------------------------------------ */
/* The coach at the guided table: the deed a lesson asks for is not    */
/* graded, the machine waits a moment on the word on the reader's      */
/* move, and the word goes when she plays. The coach and the office    */
/* are stand-ins that count what the store asks of them.               */
/* ------------------------------------------------------------------ */

const coach = vi.hoisted(() => ({ asked: 0, hushed: 0, tell: null as ((c: Coached | null) => void) | null }));
vi.mock('../coach', () => ({
  coachMove: (_before: unknown, _seat: number, _played: unknown, tell: (c: Coached | null) => void) => {
    coach.asked += 1;
    coach.tell = tell;
  },
  hushCoach: () => {
    coach.hushed += 1;
  },
  dismissCoach: () => undefined,
}));
vi.mock('../home', async (load) => ({ ...(await load<typeof import('../home')>()), recordMove: async () => 'kept' as const, recordUndo: async () => undefined }));

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
  coach.tell = null;
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

  it('leaves the deed ungraded when it is taken back and done again', async () => {
    /* the second round, where the reader has two actions and may take the
       first back */
    let g = guided();
    while (g.round < 2 || g.players[g.current].isBot) g = applyAction(g, g.current, fallbackAction(g, g.current)).state!;
    saveProgress(see(upTo('coal'), 'coal', { g, me: 0, sel: null, mat: null }));
    useGame.setState({ game: g, tutorial: true, local: CODE, code: null, homeTrouble: null, humanMarks: [], coached: null });
    await play(mineOf(g));
    /* the guide passes the lesson on the mine, and it stays passed */
    saveProgress(settle(progressAt(CODE), { g: useGame.getState().game!, me: 0, sel: null, mat: null }));
    expect(progressAt(CODE).passed).toContain('coal');
    expect(useGame.getState().undo()).toBe(true);
    expect(useGame.getState().game!.actions).toHaveLength(g.actions.length);
    await play(mineOf(g));
    expect(coach.asked).toBe(0);
  });

  it('grades a move that is no lesson\'s deed, and every move away from the guided table', async () => {
    const g = guided();
    saveProgress(upTo('botTurn'));
    useGame.setState({ game: g, tutorial: true, local: CODE, code: null, homeTrouble: null, humanMarks: [], coached: null });
    await play(fallbackAction(g, g.current));
    expect(coach.asked).toBe(1);
    /* the guide closed: every move is the coach's again */
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
    useGame.setState({ coached: word, coachHold: true });
    const hushed = coach.hushed;
    await play(fallbackAction(after, after.current));
    expect(useGame.getState().coached).toBeNull();
    expect(useGame.getState().coachHold).toBe(false);
    expect(coach.hushed).toBe(hushed + 1);
    /* away from the guided table the word stays over her move */
    useGame.setState({ game: after, tutorial: false, coached: word });
    await play(fallbackAction(after, after.current));
    expect(useGame.getState().coached).toBe(word);
  });
  describe('holding the machine for its word', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    /** the reader's first move, no lesson's deed, played through the store:
     *  it ends the turn, and the machine is to play */
    async function closeTurn(tutorial = true): Promise<{ g: GameState; move: GameAction }> {
      const g = guided();
      saveProgress(upTo('botTurn'));
      useGame.setState({ game: g, tutorial, local: CODE, code: null, homeTrouble: null, humanMarks: [], coached: null, coachHold: false });
      const move = fallbackAction(g, g.current);
      expect(useGame.getState().dispatch(move)).toBe(true);
      await vi.advanceTimersByTimeAsync(0);
      const after = useGame.getState().game!;
      expect(after.players[after.current].isBot).toBe(true);
      return { g, move };
    }
    const word = (g: GameState) => ({ at: g.actions.length, seat: 0, verdict: {} }) as unknown as Coached;

    it('while the word comes, and a moment once it is shown', async () => {
      const { g } = await closeTurn();
      expect(useGame.getState().coachHold).toBe(true);
      await vi.advanceTimersByTimeAsync(1000);
      coach.tell!(word(g));
      expect(useGame.getState().coached).toEqual(word(g));
      await vi.advanceTimersByTimeAsync(2900);
      expect(useGame.getState().coachHold).toBe(true);
      await vi.advanceTimersByTimeAsync(100);
      expect(useGame.getState().coachHold).toBe(false);
      /* the word itself stays until she plays */
      expect(useGame.getState().coached).not.toBeNull();
    });

    it('no longer for a word too slow, one sent away, or none', async () => {
      await closeTurn();
      await vi.advanceTimersByTimeAsync(6000);
      expect(useGame.getState().coachHold).toBe(false);
      /* the × on the word lets her play at once */
      const { g } = await closeTurn();
      coach.tell!(word(g));
      useGame.getState().setCoached(null);
      expect(useGame.getState().coachHold).toBe(false);
      /* a coach that could not read the move */
      await closeTurn();
      coach.tell!(null);
      expect(useGame.getState().coachHold).toBe(false);
    });

    it('never for a lesson\'s deed, nor away from the guided table', async () => {
      const g = guided();
      saveProgress(see(upTo('coal'), 'coal', { g, me: 0, sel: null, mat: null }));
      useGame.setState({ game: g, tutorial: true, local: CODE, code: null, homeTrouble: null, humanMarks: [], coached: null, coachHold: false });
      expect(useGame.getState().dispatch(mineOf(g))).toBe(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(useGame.getState().coachHold).toBe(false);
      await closeTurn(false);
      expect(coach.asked).toBe(1);
      expect(useGame.getState().coachHold).toBe(false);
    });
  });
});
