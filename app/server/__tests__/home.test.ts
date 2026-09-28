import { afterEach, describe, expect, it } from 'vitest';
import { actorOf, applyAction, botAction, fallbackAction, setupOf } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { chooseBotMove } from '@/game/bot';
import { newGame } from '@/game/engine';
import type { GameState, SetupPayload } from '@/game/types';
import { FREE_ITEMS } from '@/online/counter';
import { serve } from '../index';
import type { Serving } from '../index';
import { MAX_ACTIONS } from '../home';
import { seasonAt } from '../rating';
import { Guest, post } from './guest';

/* ------------------------------------------------------------------ */
/* A game played at home, handed in over the wire.                     */
/*                                                                     */
/* The house never saw a move of it, so it believes none of what the   */
/* client says: it is handed a seed, a setup and a log, replays the    */
/* game with its own engine and reads the standings off its own board. */
/* What the replay cannot prove — that the game was worth winning — is */
/* why the record it writes touches no cote, no purse and no figure.   */
/* ------------------------------------------------------------------ */

/** the one house rule a game at home is played under here: short eras, so
 *  the machines play it out in a second or two */
const OPTIONS: SetupPayload['options'] = { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' };
/** the player, and the machine that keeps them company */
const AT_HOME: SetupPayload = {
  players: [
    { name: 'Ada', color: 'brass', type: 'human' },
    { name: 'Mr Boulton', color: 'oxblood', type: 'bot', persona: 'boulton' },
  ],
  options: OPTIONS,
};
const SEED = 424242;

/** a whole game played out by the machines, and the log it leaves */
function playOut(setup: SetupPayload, seed: number): { actions: GameAction[]; state: GameState } {
  let s = newGame(setup, seed);
  for (let i = 0; i < MAX_ACTIONS && s.phase !== 'game-over'; i++) {
    const a: GameAction = s.phase === 'scoring-canal' ? { kind: 'begin-rail' } : (botAction(chooseBotMove(s, s.current)) ?? fallbackAction(s, s.current));
    const r = applyAction(s, actorOf(s, a), a);
    if (!r.state) throw new Error(`the engine refused a move of its own machines: ${r.error}`);
    s = r.state;
  }
  if (s.phase !== 'game-over') throw new Error('the machines would not finish the game');
  return { actions: s.actions, state: s };
}

/** the same setup with other chairs: the deal turns on how many sit, never
 *  on which of them is a machine, so a doctored one replays all the same */
const seatsOf = (types: ('human' | 'bot')[]): SetupPayload => ({ ...AT_HOME, players: AT_HOME.players.map((p, i) => ({ ...p, type: types[i] })) });

const played = playOut(AT_HOME, SEED);

describe('a game played at home', () => {
  let server: Serving | null = null;
  const guests: Guest[] = [];
  let rid = 0;

  afterEach(async () => {
    for (const g of guests.splice(0)) g.close();
    await server?.close();
    server = null;
  });

  async function open() {
    server = await serve({ port: 0, mailer: post, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, queueEvery: 0, file: ':memory:' });
    return server;
  }

  /** a verified account at the far end of a socket */
  async function arrive(name: string): Promise<Guest> {
    const g = new Guest(name);
    guests.push(g);
    await g.open(server!.port);
    await g.signUp();
    return g;
  }

  /** hand a game in and wait for the office's word: null when it took it */
  async function hand(g: Guest, sent: { seed?: number; setup?: unknown; actions?: unknown }): Promise<string | null> {
    const took = g.done.length;
    const turned = g.rejected.length;
    g.send({ t: 'home', rid: ++rid, seed: SEED, setup: AT_HOME, actions: played.actions, ...sent } as never);
    await g.until('the office to answer', () => g.done.length > took || g.rejected.length > turned);
    return g.rejected.length > turned ? g.rejected[g.rejected.length - 1] : null;
  }

  it('goes on the record once, however often it is handed in', async () => {
    await open();
    const ada = await arrive('Ada');
    /* what the client hands in is what its own store builds from the
       finished game: the setup it was dealt from, and nothing derived */
    expect(setupOf(played.state)).toEqual({ ...AT_HOME, options: { ...OPTIONS, assist: false } });
    expect(await hand(ada, {})).toBeNull();
    /* the same game again — a flaky line, a second tab, a reload */
    expect(await hand(ada, {})).toBeNull();
    const history = server!.store.historyFor(ada.id);
    expect(history).toHaveLength(1);
    const [game] = history;
    expect(game.home).toBe(true);
    /* the standings are the office's own reading, seat by seat */
    expect(game.players.map((p) => p.vp)).toEqual(played.state.players.map((p) => p.vp));
    expect(game.winner).toBe(played.state.winner);
    expect(game.players.map((p) => p.id)).toEqual([ada.id, '']);
    expect(game.players.map((p) => p.bot)).toEqual([false, true]);
    /* the log is kept with it: the game can be read back move for move */
    expect(server!.store.games().map((g) => g.code)).toEqual([]); // no table of the house stands for it
    /* and it counts in nothing: the house did not umpire it */
    const desk = server!.hall.desk(ada.id);
    expect(desk.history).toHaveLength(1);
    expect(desk.stats).toMatchObject({ played: 0, won: 0, averageVp: 0, bestVp: 0, home: 1 });
    expect(desk.rating).toBeNull();
    expect(server!.store.standing(ada.id, seasonAt().id)).toBeNull();
    expect(desk.purse).toEqual({ guineas: 0, owned: FREE_ITEMS });
  }, 60000);

  it('turns away a doctored result and keeps its own reading', async () => {
    await open();
    const ada = await arrive('Ada');
    /* the log stopped where the board suited its author — a game handed in
       before the last card is played is not a game played out */
    expect(await hand(ada, { actions: played.actions.slice(0, -1) })).toBe('unfinished');
    /* a game of machines alone, claimed as one's own */
    expect(await hand(ada, { setup: seatsOf(['bot', 'bot']) })).toBe('not-seated');
    /* a hotseat played out by two people on one keyboard: the office cannot
       say which chair was the account's, so it says none was */
    expect(await hand(ada, { setup: seatsOf(['human', 'human']) })).toBe('not-seated');
    expect(server!.store.historyFor(ada.id)).toEqual([]);
    /* the honest hand of the very same evening is taken — from another tab,
       as it might be — and what goes on the record is the replay's word */
    const tab = new Guest(ada.name);
    guests.push(tab);
    await tab.open(server!.port);
    await tab.signInWith(ada.token);
    expect(await hand(tab, {})).toBeNull();
    const [game] = server!.store.historyFor(ada.id);
    expect(game.players.map((p) => p.vp)).toEqual(played.state.players.map((p) => p.vp));
  }, 60000);

  it('turns away a log that will not replay', async () => {
    await open();
    const ada = await arrive('Ada');
    /* a move that was never made: the engine refuses it and the log with it */
    const forged: GameAction[] = [...played.actions.slice(0, -1), { kind: 'build', card: 'no-such-card', town: 'birmingham', slot: 0, industry: 'cotton' }];
    expect(await hand(ada, { actions: forged })).toBe('no-replay');
    /* the right log against the wrong deal: every card it names is elsewhere */
    expect(await hand(ada, { seed: SEED + 1 })).toBe('no-replay');
    expect(server!.store.historyFor(ada.id)).toEqual([]);
  }, 60000);

  it('reads nothing that is not the shape of a game', async () => {
    await open();
    const ada = await arrive('Ada');
    expect(await hand(ada, { actions: ['a move'] })).toBe('malformed');
    expect(await hand(ada, { setup: { ...AT_HOME, players: [AT_HOME.players[0]] } })).toBe('malformed');
    expect(await hand(ada, { seed: 'a seed' as unknown as number })).toBe('malformed');
    expect(server!.store.historyFor(ada.id)).toEqual([]);
  }, 60000);
});
