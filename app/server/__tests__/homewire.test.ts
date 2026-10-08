import { afterEach, describe, expect, it } from 'vitest';
import { replay } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { newGame } from '@/game/engine';
import { legalActions } from '@/game/search';
import { ANALYSIS_VERSION } from '@/game/analysis';
import type { GameState, SetupPayload } from '@/game/types';
import type { ClientMessage } from '@/online/protocol';
import { serve } from '../index';
import type { Serving } from '../index';
import { Guest, OPTIONS, post } from './guest';

/* ------------------------------------------------------------------ */
/* A game at home over the wire: a browser with no account of its own  */
/* is given one, deals a game, plays it move by move — and the office  */
/* reads every one of them with the engine before writing it down.     */
/* ------------------------------------------------------------------ */

const SETUP: SetupPayload = {
  players: [
    { name: 'Ada', color: 'brass', type: 'human' },
    { name: 'Mrs Wedgwood', color: 'oxblood', type: 'bot' },
  ],
  options: OPTIONS,
};
const SEED = 909;

const plainMove = (s: GameState): GameAction => legalActions(s, s.current)[0]!;

/** a move at home, numbered so the office answers it either way */
const numbered = (rid: number, m: Omit<Extract<ClientMessage, { t: 'home.act' }>, 't'>): ClientMessage => Object.assign({ t: 'home.act' as const, rid }, m);

describe('a game at home', () => {
  let server: Serving | null = null;
  const guests: Guest[] = [];

  afterEach(async () => {
    for (const g of guests) g.close();
    guests.length = 0;
    await server?.close();
    server = null;
  });

  const open = async (file = ':memory:') => {
    server = await serve({ port: 0, mailer: post, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, queueEvery: 0, editionEvery: 0, file });
    return server;
  };

  const arrive = async (name: string): Promise<Guest> => {
    const g = new Guest(name);
    guests.push(g);
    await g.open(server!.port);
    return g;
  };

  it('opens an account by itself, and keeps the games played under it', async () => {
    await open();
    const ada = await arrive('Ada');
    await ada.asGuest();
    expect(ada.me?.guest).toBe(true);
    expect(ada.me?.email).toBeNull();
    expect(ada.me?.name).toMatch(/^Invité /);

    ada.send({ t: 'home.open', rid: 10, name: 'Cromford Mill', seed: SEED, setup: SETUP });
    await ada.until('the deal', () => !!ada.dealt);
    const code = ada.dealt!.code;
    expect(ada.dealt!.name).toBe('Cromford Mill');
    await ada.until('the register', () => ada.register?.length === 1);

    /* the same account from a second browser sees the same register */
    const other = await arrive('Ada-again');
    await other.signInWith(ada.token);
    other.send({ t: 'home.list', rid: 1 });
    await other.until('the register', () => !!other.register);
    expect(other.register!.map((g) => g.code)).toEqual([code]);
  });

  it('reads every move with the engine, and refuses the ones that do not stand', async () => {
    await open();
    const ada = await arrive('Ada');
    await ada.asGuest();
    ada.send({ t: 'home.open', rid: 10, name: 'Cromford Mill', seed: SEED, setup: SETUP });
    await ada.until('the deal', () => !!ada.dealt);
    const code = ada.dealt!.code;

    /* a move the position does not allow is turned down, and written nowhere */
    ada.send({ t: 'home.act', code, idx: 0, action: { kind: 'begin-rail' } });
    await ada.until('the refusal', () => ada.homeRefused.length === 1);
    expect(ada.homeRefused[0]).toEqual({ code, at: 0, error: 'No ceremony to close' });

    /* a move out of step says so, and the browser is told where the log stands */
    const first = plainMove(newGame(SETUP, SEED));
    ada.send({ t: 'home.act', code, idx: 4, action: first });
    await ada.until('the second refusal', () => ada.homeRefused.length === 2);
    expect(ada.homeRefused[1]).toEqual({ code, at: 4, error: 'out-of-step' });

    /* the moves that stand are written, in order, and say nothing back */
    let state = newGame(SETUP, SEED);
    const played: GameAction[] = [];
    for (let i = 0; i < 8; i++) {
      const move = plainMove(state);
      ada.send({ t: 'home.act', code, idx: i, action: move });
      played.push(move);
      state = replay(SETUP, SEED, played);
    }
    ada.send({ t: 'home.load', rid: 20, code });
    await ada.until('the game back', () => ada.save?.code === code);
    expect(ada.save!.actions).toEqual(played);
    expect(ada.homeRefused).toHaveLength(2);
    expect(ada.save!.round).toBe(state.round);
  });

  it('answers a numbered move either way: written, or turned down', async () => {
    await open();
    const ada = await arrive('Ada');
    await ada.asGuest();
    ada.send({ t: 'home.open', rid: 10, name: 'Cromford Mill', seed: SEED, setup: SETUP });
    await ada.until('the deal', () => !!ada.dealt);
    const code = ada.dealt!.code;
    const answer = (rid: number) => ada.frames.find((f) => (f.t === 'done' || f.t === 'refused') && f.rid === rid);

    /* a move that stands is acknowledged under its own number */
    const first = plainMove(newGame(SETUP, SEED));
    ada.send(numbered(50, { code, idx: 0, action: first }));
    await ada.until('the move written', () => !!answer(50));
    expect(answer(50)).toEqual({ t: 'done', rid: 50 });
    expect(ada.homeRefused).toEqual([]);

    /* one turned down is refused under its number — and the refusal frame,
       which the table listens for, has come first */
    ada.send(numbered(51, { code, idx: 7, action: first }));
    await ada.until('the move refused', () => !!answer(51));
    expect(answer(51)).toEqual({ t: 'refused', rid: 51, error: 'out-of-step' });
    const at = (f: (typeof ada.frames)[number]) => ada.frames.indexOf(f);
    expect(at(ada.frames.find((f) => f.t === 'home.refused')!)).toBeLessThan(at(answer(51)!));

    ada.send({ t: 'home.load', rid: 52, code });
    await ada.until('the game back', () => ada.save?.code === code);
    expect(ada.save!.actions).toEqual([first]);
  });

  it('forgets the judge\'s reading of moves an undo took back', async () => {
    await open();
    const ada = await arrive('Ada');
    await ada.asGuest();
    ada.send({ t: 'home.open', rid: 10, name: 'Cromford Mill', seed: SEED, setup: SETUP });
    await ada.until('the deal', () => !!ada.dealt);
    const code = ada.dealt!.code;
    let state = newGame(SETUP, SEED);
    const played: GameAction[] = [];
    for (let i = 0; i < 4; i++) {
      const move = plainMove(state);
      ada.send(numbered(60 + i, { code, idx: i, action: move }));
      played.push(move);
      state = replay(SETUP, SEED, played);
    }
    await ada.until('the moves written', () => ada.frames.some((f) => f.t === 'done' && f.rid === 63));

    const chance = { chance: 0.5, low: 0.48, high: 0.52, passes: 1 };
    ada.send({ t: 'analysis.post', code, v: ANALYSIS_VERSION, judge: 'long', part: { moves: 4, seats: { 0: [chance, chance] } } });
    const readings = () => ada.frames.filter((f) => f.t === 'analysis');
    ada.send({ t: 'analysis.get', rid: 70, code, v: ANALYSIS_VERSION, judge: 'long' });
    await ada.until('the reading', () => readings().length === 1);
    expect(readings()[0]).toMatchObject({ reading: { moves: 4 } });

    ada.send({ t: 'home.undo', rid: 71, code, at: 2 });
    await ada.until('the undo', () => ada.frames.some((f) => f.t === 'done' && f.rid === 71));
    ada.send({ t: 'analysis.get', rid: 72, code, v: ANALYSIS_VERSION, judge: 'long' });
    await ada.until('the reading again', () => readings().length === 2);
    expect(readings()[1]).toMatchObject({ reading: null });
  });

  it('gives another account nothing of a game it did not play', async () => {
    await open();
    const ada = await arrive('Ada');
    await ada.asGuest();
    ada.send({ t: 'home.open', rid: 10, name: 'Cromford Mill', seed: SEED, setup: SETUP });
    await ada.until('the deal', () => !!ada.dealt);
    const code = ada.dealt!.code;

    const bob = await arrive('Bob');
    await bob.asGuest();
    bob.send({ t: 'home.load', rid: 1, code });
    await bob.until('the answer', () => bob.frames.some((f) => f.t === 'home.save'));
    expect(bob.save).toBeNull();
    bob.send({ t: 'home.act', code, idx: 0, action: plainMove(newGame(SETUP, SEED)) });
    await bob.until('the refusal', () => bob.homeRefused.length === 1);
    expect(bob.homeRefused[0].error).toBe('no-such-game');

    /* and Ada's game is untouched */
    ada.send({ t: 'home.load', rid: 20, code });
    await ada.until('the game back', () => ada.save?.code === code);
    expect(ada.save!.actions).toEqual([]);
  });

  it('keeps the games when a guest becomes a member', async () => {
    await open();
    const ada = await arrive('Ada');
    await ada.asGuest();
    const guestId = ada.id;
    ada.send({ t: 'home.open', rid: 10, name: 'Cromford Mill', seed: SEED, setup: SETUP });
    await ada.until('the deal', () => !!ada.dealt);
    const code = ada.dealt!.code;

    await ada.signUp();
    expect(ada.id).toBe(guestId);
    expect(ada.me?.guest).toBe(false);
    expect(ada.me?.name).toBe('Ada');
    ada.send({ t: 'home.list', rid: 30 });
    await ada.until('the register', () => ada.register?.length === 1);
    expect(ada.register![0].code).toBe(code);
  });

  it('keeps the judge\'s reading of a game at home, and of nobody else\'s', async () => {
    await open();
    const ada = await arrive('Ada');
    await ada.asGuest();
    ada.send({ t: 'home.open', rid: 10, name: 'Cromford Mill', seed: SEED, setup: SETUP });
    await ada.until('the deal', () => !!ada.dealt);
    const code = ada.dealt!.code;
    let state = newGame(SETUP, SEED);
    const played: GameAction[] = [];
    for (let i = 0; i < 6; i++) {
      const move = plainMove(state);
      ada.send({ t: 'home.act', code, idx: i, action: move });
      played.push(move);
      state = replay(SETUP, SEED, played);
    }

    /* the office hands its owner a stretch of the game to read */
    ada.send({ t: 'analysis.claim', rid: 40, code, v: ANALYSIS_VERSION, judge: 'long', want: 4 });
    await ada.until('a stretch to read', () => !!ada.slice);
    expect(ada.slice!.hi).toBeGreaterThan(ada.slice!.lo);

    /* another account is handed nothing at all of it */
    const bob = await arrive('Bob');
    await bob.asGuest();
    bob.send({ t: 'analysis.claim', rid: 1, code, v: ANALYSIS_VERSION, judge: 'long', want: 4 });
    await bob.until('the answer', () => !!bob.frames.some((f) => f.t === 'analysis.slice'));
    expect(bob.slice).toEqual({ lo: 0, hi: 0 });
  });

  it('puts a game away when it is asked to', async () => {
    await open();
    const ada = await arrive('Ada');
    await ada.asGuest();
    ada.send({ t: 'home.open', rid: 10, name: 'Cromford Mill', seed: SEED, setup: SETUP });
    await ada.until('the deal', () => !!ada.dealt);
    const code = ada.dealt!.code;
    ada.send({ t: 'home.forget', rid: 11, code });
    await ada.until('the register', () => ada.register?.length === 0);
    ada.send({ t: 'home.load', rid: 12, code });
    await ada.until('the answer', () => ada.frames.some((f) => f.t === 'home.save'));
    expect(ada.save).toBeNull();
  });
});
