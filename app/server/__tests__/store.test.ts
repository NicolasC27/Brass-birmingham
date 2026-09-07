import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { SetupPayload } from '@/game/types';
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
    const dir = mkdtempSync(path.join(tmpdir(), 'brassworks-'));
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
    again.dropTable('AB12');
    expect(again.tables()).toEqual([]);
    expect(again.games()).toEqual([]);
    again.close();
  });
});
