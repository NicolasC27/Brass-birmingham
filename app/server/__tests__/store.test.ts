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
    const made = store.signUp('Ada Lovelace', 'countess-of-lovelace');
    expect('account' in made).toBe(true);
    expect(store.signUp('  ada   lovelace ', 'another-password-1')).toEqual({ error: 'name-taken' });
    expect(store.signUp('x', 'long-enough-password')).toEqual({ error: 'bad-name' });
    expect(store.signUp('Charles', 'short')).toEqual({ error: 'weak-password' });
    expect(store.signIn('ADA LOVELACE', 'countess-of-lovelace')?.name).toBe('Ada Lovelace');
    expect(store.signIn('Ada Lovelace', 'wrong')).toBeNull();
    expect(store.signIn('Nobody', 'countess-of-lovelace')).toBeNull();
  });

  it('hands out a session that stands for the account, until it is closed', () => {
    const { store } = open();
    const made = store.signUp('Ada', 'countess-of-lovelace');
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
    again.dropTable('AB12');
    expect(again.tables()).toEqual([]);
    expect(again.games()).toEqual([]);
    again.close();
  });
});
