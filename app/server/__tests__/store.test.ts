import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { GameState, SetupPayload } from '@/game/types';
import type { Table } from '@/online/table';
import { Store } from '../store';

/* The register keeps what the house may not forget: who has an account,
   which tables stand, and every game as a seed and a list of moves. */

const SETUP: SetupPayload = {
  players: [
    { name: 'Ada', color: 'brass', type: 'human' },
    { name: 'Bob', color: 'oxblood', type: 'human' },
  ],
  options: { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' },
};

const TABLE: Table = {
  code: 'AB12',
  name: 'The Works',
  hostId: 'a-1',
  seats: [{ id: 'a-1', name: 'Ada', color: 'brass', kind: 'human', ready: true, joinedAt: 10 }],
  options: SETUP.options,
  status: 'open',
  createdAt: 1,
  updatedAt: 2,
};

describe('the register', () => {
  const dirs: string[] = [];
  const open = () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'blackrail-'));
    dirs.push(dir);
    return { dir, store: new Store(path.join(dir, 'test.db')) };
  };

  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('opens an account, refuses the name twice and knows the password', () => {
    const { store } = open();
    const made = store.signUp('Ada Lovelace', 'ada@example.test', 'countess-of-lovelace');
    expect('account' in made).toBe(true);
    expect(store.signUp('  ada   lovelace ', 'other@example.test', 'another-password-1')).toEqual({ error: 'name-taken' });
    expect(store.signUp('x', 'x@example.test', 'long-enough-password')).toEqual({ error: 'bad-name' });
    expect(store.signUp('Charles', 'charles@example.test', 'short')).toEqual({ error: 'weak-password' });
    expect(store.signIn('ADA LOVELACE', 'countess-of-lovelace')?.name).toBe('Ada Lovelace');
    expect(store.signIn('Ada Lovelace', 'wrong')).toBeNull();
    expect(store.signIn('Nobody', 'countess-of-lovelace')).toBeNull();
    /* the address is a name too, and it is unique */
    expect(store.signIn('ADA@example.test', 'countess-of-lovelace')?.name).toBe('Ada Lovelace');
    expect(store.signUp('Charles', 'Ada@Example.test', 'long-enough-password')).toEqual({ error: 'email-taken' });
    expect(store.signUp('Charles', 'not-an-address', 'long-enough-password')).toEqual({ error: 'bad-email' });
  });

  it('opens the tables once the address has answered its letter, and lets a password be chosen again', () => {
    const { store } = open();
    const made = store.signUp('Ada', 'ada@example.test', 'countess-of-lovelace');
    const id = 'account' in made ? made.account.id : '';
    expect(store.account(id)?.verified).toBe(false);
    const stale = store.writeLetter(id, 'verify');
    const fresh = store.writeLetter(id, 'verify'); // the earlier letter is void
    expect(store.verify(stale)).toBeNull();
    expect(store.verify(fresh)?.verified).toBe(true);
    expect(store.verify(fresh)).toBeNull(); // spent
    const reset = store.writeLetter(id, 'reset');
    expect(store.resetPassword(reset, 'short')).toBe('weak-password');
    const chosen = store.resetPassword(reset, 'a-brand-new-password');
    expect(typeof chosen === 'object' && chosen?.id).toBe(id);
    expect(store.signIn('Ada', 'countess-of-lovelace')).toBeNull();
    expect(store.signIn('Ada', 'a-brand-new-password')?.id).toBe(id);
    expect(store.changePassword(id, 'wrong', 'whatever-long-enough')).toBe('wrong-password');
    expect(store.changePassword(id, 'a-brand-new-password', 'yet-another-password')).toBeNull();
    store.setProfile(id, { motto: '  Canals before rails  ', favoriteColor: 'oxblood' });
    expect(store.account(id)).toMatchObject({ motto: 'Canals before rails', favoriteColor: 'oxblood' });
  });

  it('carries invitations from one account to another, about one table, answered once', () => {
    const { store } = open();
    const ada = store.signUp('Ada', 'ada@example.test', 'countess-of-lovelace');
    const bob = store.signUp('Bob', 'bob@example.test', 'a-good-long-password');
    const a = 'account' in ada ? ada.account : null!;
    const b = 'account' in bob ? bob.account : null!;
    store.saveTable({ ...TABLE, hostId: a.id, seats: [{ ...TABLE.seats[0], id: a.id }] });
    const letter = store.invite('AB12', a, b);
    expect(letter.tableName).toBe('The Works');
    expect(store.invitationsFor(b.id).received.map((i) => i.id)).toEqual([letter.id]);
    expect(store.invitationsFor(a.id).sent.map((i) => i.id)).toEqual([letter.id]);
    expect(store.pendingInvitation('AB12', b.id)?.id).toBe(letter.id);
    store.answerInvitation(letter.id);
    expect(store.invitationsFor(b.id).received).toEqual([]);
    expect(store.invitation(letter.id)).toBeNull();
  });

  it('hands out a session that stands for the account, until it is closed', () => {
    const { store } = open();
    const made = store.signUp('Ada', 'ada@example.test', 'countess-of-lovelace');
    const id = 'account' in made ? made.account.id : '';
    const token = store.openSession(id);
    expect(store.session(token)?.id).toBe(id);
    store.closeSession(token);
    expect(store.session(token)).toBeNull();
    expect(store.session('not-a-token')).toBeNull();
  });

  it('keeps tables and game logs across a restart', () => {
    const { dir, store } = open();
    store.saveTable(TABLE);
    store.openGame('AB12', 4242, SETUP, ['a-1', 'a-2']);
    store.appendMove('AB12', 0, { kind: 'loan' });
    store.appendMove('AB12', 1, { kind: 'pass' });
    store.appendMove('AB12', 2, { kind: 'loan' });
    store.dropMove('AB12', 2);
    store.close();

    const again = new Store(path.join(dir, 'test.db'));
    expect(again.tables()).toEqual([TABLE]);
    const [game] = again.games();
    expect(game.seed).toBe(4242);
    expect(game.seatIds).toEqual(['a-1', 'a-2']);
    expect(game.actions).toEqual([{ kind: 'loan' }, { kind: 'pass' }]);
    expect(game.finishedAt).toBeNull();
    again.finishGame('AB12');
    expect(again.games()[0].finishedAt).toBeGreaterThan(0);
    expect(again.historyFor('a-1')).toEqual([]); // no result was recorded: nothing to show
    /* the bell cannot ring twice at a table whose game was played out */
    expect(again.gameFinished('AB12')).toBe(true);
    expect(again.openGame('AB12', 1, SETUP, ['a-1', 'a-2'])).toBe(false);
    expect(again.games()[0].seed).toBe(4242);
    /* the table goes, the game played at it stays on the record */
    again.dropTable('AB12');
    expect(again.tables()).toEqual([]);
    expect(again.games().map((g) => g.code)).toEqual(['AB12']);
    /* one still in play goes with its table */
    again.saveTable({ ...TABLE, code: 'CD34' });
    again.openGame('CD34', 1, SETUP, ['a-1', 'a-2']);
    again.dropTable('CD34');
    expect(again.games().map((g) => g.code)).toEqual(['AB12']);
    again.close();
  });

  it('remembers the games each account sat at, and counts only the ones played out', () => {
    const { store } = open();
    const ended = (vp: [number, number], abandoned = false) =>
      ({ players: [{ name: 'Ada', color: 'brass', vp: vp[0] }, { name: 'Bob', color: 'oxblood', vp: vp[1] }], winner: vp[0] >= vp[1] ? 0 : 1, abandoned }) as unknown as GameState;
    store.openGame('AB12', 1, SETUP, ['a-1', 'a-2']);
    store.finishGame('AB12', ended([40, 30]));
    store.openGame('CD34', 2, SETUP, ['a-1', 'a-3']);
    store.finishGame('CD34', ended([10, 50]));
    store.openGame('EF56', 3, SETUP, ['a-1', 'a-2']);
    store.finishGame('EF56', ended([99, 0], true));
    store.openGame('GH78', 4, SETUP, ['a-2', 'a-3']);
    store.finishGame('GH78', ended([20, 20]));
    expect(store.historyFor('a-1').map((g) => g.code)).toEqual(['EF56', 'CD34', 'AB12']);
    expect(store.historyFor('a-1', 1).map((g) => g.code)).toEqual(['EF56']);
    expect(store.historyFor('a-3').map((g) => g.code)).toEqual(['GH78', 'CD34']);
    expect(store.historyFor('a-1')[0].name).toBe('EF56'); // no table stands: the code is the name
    /* the abandoned game is on the record, but counts for nothing */
    expect(store.statsFor('a-1')).toMatchObject({ played: 2, won: 1, averageVp: 25, bestVp: 40, tallied: 0, tally: null });
    expect(store.statsFor('a-2')).toMatchObject({ played: 2, won: 1 });
  });

  it('signs in off the event loop as well as on it', async () => {
    const { store } = open();
    const made = await store.signUpAsync('Ada', 'ada@example.test', 'countess-of-lovelace');
    expect('account' in made).toBe(true);
    expect(await store.signUpAsync('ada', 'other@example.test', 'countess-of-lovelace')).toEqual({ error: 'name-taken' });
    expect((await store.signInAsync('ADA', 'countess-of-lovelace'))?.name).toBe('Ada');
    expect(await store.signInAsync('Ada', 'wrong')).toBeNull();
    expect(store.signIn('Ada', 'countess-of-lovelace')?.name).toBe('Ada');
  });
});
