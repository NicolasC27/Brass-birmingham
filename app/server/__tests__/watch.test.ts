import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultSetup, newGame } from '@/game/engine';
import type { GameState } from '@/game/types';
import type { Table } from '@/online/table';
import { Queue } from '../queue';
import { K_PLACING, fresh, settle } from '../rating';
import { Store } from '../store';
import { viewFor } from '../view';
import { MEETINGS_CAP, PaceWatch, QUICK_MS, QUICK_TURNS, sameHouse } from '../watch';

/* The watch: what a seat may see, who may sit together at a ranked table,
   how often two cotes may meet, and how fast a human opens a turn. */

describe('the watch', () => {
  it('lets a seat see its own hand and nothing else that is hidden', () => {
    const truth = newGame(defaultSetup(), 7);
    const secret = new Set([...truth.deck.map((c) => c.id), ...truth.players.flatMap((p) => p.hand.map((c) => c.id))]);
    const mine = viewFor(truth, 1);
    expect(mine.seed).toBe(0);
    expect(mine.players[1].hand).toEqual(truth.players[1].hand);
    const shown = new Set([...mine.deck.map((c) => c.id), ...mine.players.flatMap((p, i) => (i === 1 ? [] : p.hand.map((c) => c.id)))]);
    for (const id of shown) expect(secret.has(id)).toBe(false);
    expect(mine.deck.length).toBe(truth.deck.length);
    expect(mine.players.map((p) => p.hand.length)).toEqual(truth.players.map((p) => p.hand.length));
    /* a spectator: every hand shut */
    const watching = viewFor(truth, -1);
    for (const p of watching.players) for (const c of p.hand) expect(secret.has(c.id)).toBe(false);
    /* the whole serialized view carries no secret id at all */
    const text = JSON.stringify(mine);
    for (const id of secret) if (!truth.players[1].hand.some((c) => c.id === id)) expect(text.includes(`"${id}"`)).toBe(false);
  });

  it('knows a household, and not the loopback', () => {
    expect(sameHouse('81.2.3.4', '81.2.3.4')).toBe(true);
    expect(sameHouse('81.2.3.4', '81.2.3.5')).toBe(false);
    expect(sameHouse('127.0.0.1', '127.0.0.1')).toBe(false);
    expect(sameHouse('::1', '::1')).toBe(false);
    expect(sameHouse(null, '81.2.3.4')).toBe(false);
  });

  it('never deals two kin into one ranked table', () => {
    let now = 0;
    const kin = new Set(['a', 'b']);
    const q = new Queue({ now: () => now, apart: (x, y) => kin.has(x) && kin.has(y) });
    for (const id of ['a', 'b', 'c', 'd']) q.join(id, 'ranked');
    /* four in line, two of them kin: no table of four is possible yet */
    expect(q.match()).toEqual([]);
    q.join('e', 'ranked');
    const [m] = q.match();
    expect(m.mode).toBe('ranked');
    expect(m.ids).toEqual(['a', 'c', 'd', 'e']);
    expect(q.members('ranked')).toEqual(['b']);
    /* the short table after the wait obeys the same rule */
    q.join('a', 'ranked');
    q.join('f', 'ranked');
    now = 100_000;
    expect(q.match()).toEqual([]);
    q.join('g', 'ranked');
    expect(q.match()[0].ids).toEqual(['b', 'f', 'g']);
    expect(q.members('ranked')).toEqual(['a']);
  });

  it('notes a seat once after twelve turns opened faster than a board is read', () => {
    const w = new PaceWatch();
    for (let i = 1; i < QUICK_TURNS; i++) expect(w.note('T1', 0, QUICK_MS - 1)).toBe(false);
    expect(w.note('T1', 0, QUICK_MS - 1)).toBe(true);
    expect(w.note('T1', 0, QUICK_MS - 1)).toBe(false);
    /* a slow turn breaks a run; another seat, another table, another run */
    for (let i = 1; i < QUICK_TURNS; i++) w.note('T1', 1, 10);
    expect(w.note('T1', 1, QUICK_MS + 5)).toBe(false);
    expect(w.note('T1', 1, 10)).toBe(false);
    for (let i = 1; i < QUICK_TURNS; i++) w.note('T2', 0, 10);
    expect(w.note('T2', 0, 10)).toBe(true);
  });

  it('lets a pair that met too often move neither cote', () => {
    const [a, b, c] = settle([fresh(), fresh(), fresh()], [50, 40, 30], 0, (i, j) => !((i === 0 && j === 1) || (i === 1 && j === 0)));
    /* the first is weighed against the third only, and took the point */
    expect(a.rating).toBe(1200 + K_PLACING / 2);
    /* the second likewise: a point over the third, nothing from the first */
    expect(b.rating).toBe(1200 + K_PLACING / 2);
    expect(c.rating).toBe(1200 - K_PLACING / 2);
    expect(a.games).toBe(1);
  });

  describe('in the register', () => {
    const dirs: string[] = [];
    const open = () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'blackrail-'));
      dirs.push(dir);
      return new Store(path.join(dir, 'test.db'));
    };
    afterEach(() => {
      for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
    });
    const setup = defaultSetup();
    const ranked = (code: string, ids: string[]): Table => ({ code, name: code, hostId: ids[0], seats: ids.map((id, i) => ({ id, name: id, color: (['brass', 'oxblood', 'verdigris', 'steel'] as const)[i], kind: 'human', ready: true, joinedAt: 1 })), options: setup.options, status: 'open', ranked: true, createdAt: 1, updatedAt: 1 });
    const ended = (vp: number[]): GameState => ({ players: vp.map((v, i) => ({ name: `p${i}`, color: 'brass', vp: v, isBot: false })), winner: vp.indexOf(Math.max(...vp)), abandoned: false }) as unknown as GameState;

    it('keeps a mark, and counts the meetings of a pair this season', () => {
      const store = openWith(open());
      const f = store.flag('a-1', 'pace', 'twelve quick turns', 'AB12');
      expect(store.flags()[0]).toMatchObject({ id: f.id, accountId: 'a-1', kind: 'pace', code: 'AB12' });
      expect(store.meetings('a-1', 'a-2', '2026-Q3', 'none')).toBe(0);
      store.saveTable(ranked('R1', ['a-1', 'a-2']));
      store.openGame('R1', 1, setup, ['a-1', 'a-2']);
      store.finishGame('R1', ended([40, 30]), undefined, true);
      const season = new Date().toISOString().slice(0, 4) + '-Q' + (Math.floor(new Date().getUTCMonth() / 3) + 1);
      expect(store.meetings('a-1', 'a-2', season, 'none')).toBe(1);
      /* the game being settled is not one of the meetings before it */
      expect(store.meetings('a-1', 'a-2', season, 'R1')).toBe(0);
    });

    it('stops weighing a pair past the cap, and notes them once', () => {
      const store = openWith(open());
      for (let n = 1; n <= MEETINGS_CAP + 2; n++) {
        const code = `R${n}`;
        store.saveTable(ranked(code, ['a-1', 'a-2']));
        store.openGame(code, n, setup, ['a-1', 'a-2']);
        const before = store.standing('a-1', seasonNow())?.rating ?? 1200;
        store.finishGame(code, ended([40, 30]), undefined, true);
        const after = store.standing('a-1', seasonNow())!.rating;
        if (n <= MEETINGS_CAP) expect(after).toBeGreaterThan(before);
        else expect(after).toBe(before);
      }
      const marks = store.flags().filter((f) => f.kind === 'meetings');
      expect(marks.map((f) => f.accountId).sort()).toEqual(['a-1', 'a-2']);
    });

    function openWith(store: Store): Store {
      store.signUp('a-1@x.test', 'Ada', 'countess-of-lovelace');
      store.signUp('a-2@x.test', 'Bob', 'countess-of-lovelace');
      return store;
    }
    function seasonNow(): string {
      const d = new Date();
      return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
    }
  });
});
