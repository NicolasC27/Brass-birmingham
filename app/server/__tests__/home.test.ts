import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { actorOf, applyAction, replay } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { RULES_EDITION, newGame } from '@/game/engine';
import { legalActions } from '@/game/search';
import type { GameState, SetupPayload } from '@/game/types';
import { Home, briefOf } from '../home';
import { Store } from '../store';

/* A game played at home is a game of the house: the office deals its code,
   reads every move with the engine, keeps the log — and the log replays. */

const SETUP: SetupPayload = {
  players: [
    { name: 'Ada', color: 'brass', type: 'human' },
    { name: 'Mrs Wedgwood', color: 'oxblood', type: 'bot' },
  ],
  options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
};

const SEED = 4242;
const ME = 'a-1';

/** the first move the engine allows, whoever is to act — enough to build a
 *  log without asking a machine to think */
const plainMove = (s: GameState): GameAction | null => legalActions(s, s.current)[0] ?? null;

describe('the games at home', () => {
  const dirs: string[] = [];
  const open = () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'blackrail-home-'));
    dirs.push(dir);
    const store = new Store(path.join(dir, 'test.db'));
    return { file: path.join(dir, 'test.db'), store, home: new Home(store) };
  };

  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('deals a code, and lists the game under the account that played it', () => {
    const { home } = open();
    const table = home.deal(ME, 'Cromford Mill', SETUP, SEED);
    expect(table.code).toMatch(/^[A-Z0-9]{4}$/);
    expect(table.name).toBe('Cromford Mill');
    expect(table.era).toBe('canal');
    expect(table.seats.map((s) => s.kind)).toEqual(['human', 'bot']);
    expect(home.list(ME).map((g) => g.code)).toEqual([table.code]);
    /* another account sees none of it */
    expect(home.list('a-2')).toEqual([]);
    expect(home.save('a-2', table.code)).toBeNull();
  });

  it('writes a move only after the engine has read it', () => {
    const { home, store } = open();
    const { code } = home.deal(ME, 'Cromford Mill', SETUP, SEED);
    const move = plainMove(newGame(SETUP, SEED));
    expect(move).not.toBeNull();

    /* a move out of step is refused, and nothing is written */
    expect(home.act(ME, code, 3, move!)).toEqual({ ok: false, error: 'out-of-step', stands: 0 });
    expect(store.homeSave(ME, code)?.actions).toEqual([]);

    /* a move the position does not allow is refused too: no ceremony has
       opened, so none can be closed */
    expect(home.act(ME, code, 0, { kind: 'begin-rail' })).toEqual({ ok: false, error: 'No ceremony to close' });
    expect(store.homeSave(ME, code)?.actions).toEqual([]);

    /* the move the engine allows stands */
    expect(home.act(ME, code, 0, move!)).toEqual({ ok: true, over: false });
    expect(store.homeSave(ME, code)?.actions).toEqual([move]);
  });

  it('says a card the hand does not hold in words the table can read, and the rest to the logs', () => {
    const { home, store } = open();
    const { code } = home.deal(ME, 'Cromford Mill', SETUP, SEED);
    const logs = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(home.act(ME, code, 0, { kind: 'develop', card: 'no-such-card', industries: ['coal'] })).toEqual({ ok: false, error: 'card-not-in-hand' });
      /* who was to act and what they held goes to the logs, not to the player */
      expect(logs).toHaveBeenCalledWith(expect.stringContaining('action names no-such-card'));
    } finally {
      logs.mockRestore();
    }
    expect(store.homeSave(ME, code)?.actions).toEqual([]);
  });

  it('names the edition of the rules on every deal, and only one it plays', () => {
    const { home, store } = open();
    const today = home.deal(ME, 'Cromford Mill', SETUP, SEED);
    expect(store.homeSave(ME, today.code)?.setup.options.rules).toBe(RULES_EDITION);
    const first = home.deal(ME, 'Soho Works', { ...SETUP, options: { ...SETUP.options, rules: 1 } }, SEED);
    expect(store.homeSave(ME, first.code)?.setup.options.rules).toBe(1);
    for (const rules of [0, 3, 1.5, 99]) {
      const odd = home.deal(ME, 'Etruria', { ...SETUP, options: { ...SETUP.options, rules } }, SEED);
      expect(store.homeSave(ME, odd.code)?.setup.options.rules).toBe(RULES_EDITION);
    }
  });

  it('takes a move back under the edition the log was read under', () => {
    const { store, file } = open();
    /* a game of four played out under the first edition, every seat passing
       with whatever card the engine lays down — saved before deals named
       their edition, so its deal names none */
    const seats: SetupPayload['players'] = (['brass', 'oxblood', 'verdigris', 'steel'] as const).map((color, i) => ({ name: `P${i}`, color, type: 'human' }));
    const bare: SetupPayload = { players: seats, options: { eraLength: 'standard', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' } };
    let s = newGame({ ...bare, options: { ...bare.options, rules: 1 } }, 1);
    const log: GameAction[] = [];
    while (s.phase !== 'game-over') {
      const a: GameAction = s.phase === 'scoring-canal' ? { kind: 'begin-rail' } : { kind: 'pass' };
      s = applyAction(s, s.current, a).state!;
      log.push(a);
    }
    const { code } = store.openHomeGame(ME, 'Old Mill', 1, bare, briefOf(newGame(bare, 1)));
    log.forEach((a, i) => store.appendHomeMove(ME, code, i, a, briefOf(s)));
    store.close();

    /* taken up again: the log only plays out under the first edition */
    const home = new Home(new Store(file));
    expect(home.undo(ME, code, log.length - 1)).toEqual({ ok: true, over: false });
    /* and the last pass, played again, still ends the game there — under
       today's rules the rail would be four moves short of its end */
    expect(home.act(ME, code, log.length - 1, log[log.length - 1])).toEqual({ ok: true, over: true });
  });

  it('refuses another account the games it did not play', () => {
    const { home } = open();
    const { code } = home.deal(ME, 'Cromford Mill', SETUP, SEED);
    const move = plainMove(newGame(SETUP, SEED))!;
    expect(home.act('a-2', code, 0, move)).toEqual({ ok: false, error: 'no-such-game' });
    home.forget('a-2', code);
    expect(home.list(ME)).toHaveLength(1);
  });

  it('keeps a log that replays, and a brief that follows it', () => {
    const { home, store, file } = open();
    const { code } = home.deal(ME, 'Cromford Mill', SETUP, SEED);
    let state = newGame(SETUP, SEED);
    const played: GameAction[] = [];
    for (let i = 0; i < 12; i++) {
      const move = plainMove(state);
      if (!move) break;
      expect(home.act(ME, code, i, move)).toEqual({ ok: true, over: false });
      played.push(move);
      state = replay(SETUP, SEED, played);
    }
    expect(played.length).toBe(12);

    const line = home.list(ME)[0];
    expect(line.round).toBe(state.round);
    expect(line.era).toBe(state.era);
    expect(line.over).toBeUndefined();

    /* the register reopened: nothing derived was trusted, the log is replayed */
    store.close();
    const again = new Home(new Store(file));
    const save = again.save(ME, code);
    expect(save?.actions).toEqual(played);
    expect(replay(save!.setup, save!.seed, save!.actions).round).toBe(state.round);
    /* and it plays on from there */
    const next = plainMove(state);
    if (next) expect(again.act(ME, code, played.length, next)).toEqual({ ok: true, over: false });
  });

  it('takes a move back and cuts the log there', () => {
    const { home, store } = open();
    const { code } = home.deal(ME, 'Cromford Mill', SETUP, SEED);
    let state = newGame(SETUP, SEED);
    const played: GameAction[] = [];
    for (let i = 0; i < 4; i++) {
      const move = plainMove(state)!;
      home.act(ME, code, i, move);
      played.push(move);
      state = replay(SETUP, SEED, played);
    }
    expect(home.undo(ME, code, 2)).toEqual({ ok: true, over: false });
    expect(store.homeSave(ME, code)?.actions).toEqual(played.slice(0, 2));
    /* and the office plays on from the shorter log */
    const from = replay(SETUP, SEED, played.slice(0, 2));
    expect(home.act(ME, code, 2, legalActions(from, actorOf(from, played[2]))[0]!).ok).toBe(true);
  });

  it('puts a game away with its log', () => {
    const { home, store } = open();
    const { code } = home.deal(ME, 'Cromford Mill', SETUP, SEED);
    home.act(ME, code, 0, plainMove(newGame(SETUP, SEED))!);
    home.forget(ME, code);
    expect(home.list(ME)).toEqual([]);
    expect(store.homeSave(ME, code)).toBeNull();
    expect(store.gameFacts(code)).toBeNull();
  });
});
