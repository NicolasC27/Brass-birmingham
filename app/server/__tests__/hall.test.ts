import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { botAction, fallbackAction } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { chooseBotMove } from '@/game/bot';
import type { GameState } from '@/game/types';
import type { GameView } from '@/online/protocol';
import { FREE_ITEMS, GUINEAS } from '@/online/counter';
import type { Table } from '@/online/table';
import { TABLE_NAMES } from '@/online/tableNames';
import { serve } from '../index';
import type { Serving } from '../index';
import { seasonAt } from '../rating';
import { Guest, OPTIONS, post } from './guest';

/* ------------------------------------------------------------------ */
/* The hall over the wire: the desk with its cote and purse, the       */
/* register of tables, the season's board, the two queues and the     */
/* counter — each seen from a real socket, the clock turned by hand.   */
/* ------------------------------------------------------------------ */

const decide = (view: GameView): GameAction => botAction(chooseBotMove(view.state, view.seat)) ?? fallbackAction(view.state, view.seat);

describe('the hall', () => {
  let server: Serving | null = null;
  const guests: Guest[] = [];
  const dirs: string[] = [];
  /** the queues' clock: the tests turn it themselves */
  let now = Date.now();

  const registerFile = () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'blackrail-'));
    dirs.push(dir);
    return path.join(dir, 'house.db');
  };

  afterEach(async () => {
    for (const g of guests) g.close();
    guests.length = 0;
    await server?.close();
    server = null;
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  /** the house, open for the test: no sweeping, the queues on the test's own clock */
  async function open(file = ':memory:', pace = { bot: 0, ceremony: 0 }) {
    now = Date.now();
    server = await serve({ port: 0, mailer: post, pace, sweepEvery: 0, queueEvery: 0, clock: () => now, file });
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

  it('carries the season, the purse and the house counts on the desk', async () => {
    await open();
    const ada = await arrive('Ada');
    const bob = await arrive('Bob');
    ada.send({ t: 'desk', rid: 1 });
    await ada.until('the desk', () => !!ada.desk);
    const desk = ada.desk!;
    expect(desk.rating).toBeNull();
    expect(desk.season).toEqual(seasonAt());
    expect(desk.purse).toEqual({ guineas: 0, owned: FREE_ITEMS });
    expect(desk.hall).toEqual({ online: 2, playing: 0, queued: 0 });
    expect(desk.queue).toBeNull();
    /* a second tab is the same person */
    const tab = new Guest('Bob');
    guests.push(tab);
    await tab.open(server!.port);
    await tab.signInWith(bob.token);
    ada.send({ t: 'desk', rid: 2 });
    await ada.until('the desk again', () => ada.trace.filter((t) => t === 'desk').length >= 2);
    expect(ada.desk!.hall.online).toBe(2);
  });

  it('moves the cote of the humans and pays them when a ranked game is played out', async () => {
    const file = registerFile();
    await open(file);
    const ada = await arrive('Ada');
    const bob = await arrive('Bob');
    /* a ranked table on the register, the two seated and ready: the house
       finds it on opening — the office deals such tables, nobody creates them */
    const seat = (g: Guest, color: 'brass' | 'oxblood') => ({ id: g.id, name: g.name, color, kind: 'human' as const, ready: true, joinedAt: 1 });
    const table: Table = { code: 'RANK', name: 'Classée', hostId: ada.id, seats: [seat(ada, 'brass'), seat(bob, 'oxblood')], options: OPTIONS, status: 'open', ranked: true, createdAt: 1, updatedAt: 1 };
    server!.store.saveTable(table);
    for (const g of guests.splice(0)) g.close();
    await server!.close();
    await open(file);
    expect(server!.hall.table('RANK')?.ranked).toBe(true);
    /* the host rings; the two play the table out from their own views */
    server!.hall.rewrite('RANK', ada.id, { ...table, status: 'starting' });
    const game = server!.hall.game('RANK')!;
    const ids = [ada.id, bob.id];
    for (let turn = 0; turn < 600 && !game.over; turn++) {
      if (game.state.phase !== 'action') {
        await new Promise((r) => setTimeout(r, 5));
        continue;
      }
      const id = ids[game.state.current];
      expect(server!.hall.act('RANK', id, decide(game.view(id)))).toBeNull();
    }
    expect(game.over).toBe(true);
    const state: GameState = game.state;
    const winner = state.winner ?? 0;
    const loser = 1 - winner;
    const season = seasonAt().id;
    const won = server!.store.standing(ids[winner], season)!;
    const lost = server!.store.standing(ids[loser], season)!;
    expect(won).toMatchObject({ games: 1, won: 1 });
    expect(lost).toMatchObject({ games: 1, won: 0 });
    expect(won.trend).toEqual([won.rating]);
    if (state.players[winner].vp !== state.players[loser].vp) {
      expect(won.rating).toBeGreaterThan(1200);
      expect(lost.rating).toBeLessThan(1200);
    }
    expect(server!.hall.desk(ids[winner]).rating).toMatchObject({ rating: won.rating, placements: 4 });
    /* twice the guineas at a ranked table, the winner's purse the fuller */
    expect(server!.store.purse(ids[winner]).guineas).toBe((GUINEAS.sitting + GUINEAS.win) * GUINEAS.rankedTimes);
    expect(server!.store.purse(ids[loser]).guineas).toBe(GUINEAS.sitting * GUINEAS.rankedTimes);
    expect(server!.hall.desk(ids[winner]).tables[0]).toMatchObject({ code: 'RANK', status: 'over', ranked: true });
  }, 60000);

  it('orders the season\'s board by cote and finds my place on it', async () => {
    await open();
    const ada = await arrive('Ada');
    const bob = await arrive('Bob');
    const cy = await arrive('Cy');
    const di = await arrive('Di');
    const season = seasonAt().id;
    server!.store.saveStanding(ada.id, season, { rating: 1300, games: 3, won: 2, trend: [1240, 1280, 1300] });
    server!.store.saveStanding(bob.id, season, { rating: 1450, games: 6, won: 4, trend: [1450] });
    server!.store.saveStanding(cy.id, season, { rating: 1300, games: 5, won: 3, trend: [1300] });
    /* a season past says nothing about this one */
    server!.store.saveStanding(di.id, '1999-Q1', { rating: 2000, games: 9, won: 9, trend: [] });
    server!.store.setProfile(bob.id, { favoriteColor: 'oxblood' });
    ada.send({ t: 'leaderboard', rid: 5 });
    await ada.until('the board', () => !!ada.board);
    const board = ada.board!;
    expect(board.season.id).toBe(season);
    expect(board.players).toBe(3);
    expect(board.rows.map((r) => r.name)).toEqual(['Bob', 'Cy', 'Ada']);
    expect(board.rows[0]).toMatchObject({ color: 'oxblood', tier: 'foreman', games: 6, won: 4 });
    expect(board.me).toMatchObject({ id: ada.id, rank: 3, rating: 1300, trend: [1240, 1280, 1300] });
    di.send({ t: 'leaderboard', rid: 6 });
    await di.until('the board', () => !!di.board);
    expect(di.board!.me).toBeNull();
    expect(di.board!.rows.length).toBe(3);
  });

  it('lists the tables in play with their watchers, and keeps the register coming', async () => {
    await open(':memory:', { bot: 60000, ceremony: 60000 });
    const ada = await arrive('Ada');
    const bob = await arrive('Bob');
    const passer = await arrive('Nobody');
    ada.send({ t: 'create', rid: 10, options: OPTIONS });
    await ada.until('the table', () => !!ada.table);
    const code = ada.table!.code;
    bob.send({ t: 'join', rid: 11, code });
    await bob.until('a chair', () => !!bob.table);
    await ada.until('the guest', () => ada.table!.seats.length === 2);
    bob.send({ t: 'table', code, table: { ...bob.table!, seats: bob.table!.seats.map((s) => (s.id === bob.id ? { ...s, ready: true } : s)) } });
    await ada.until('the guest to be ready', () => ada.table!.seats.some((s) => s.id === bob.id && s.ready));
    ada.send({ t: 'table', code, table: { ...ada.table!, seats: ada.table!.seats.map((s) => (s.id === ada.id ? { ...s, ready: true } : s)), status: 'starting' } });
    await ada.until('the game', () => !!ada.view);
    passer.send({ t: 'watch', code });
    await passer.until('the table', () => !!passer.view);

    passer.send({ t: 'tables', rid: 20 });
    await passer.until('the register', () => !!passer.tables);
    expect(passer.tables).toHaveLength(1);
    expect(passer.tables![0]).toMatchObject({ code, name: ada.table!.name, hostName: 'Ada', status: 'playing', ranked: false, watchers: 3, era: 'canal', round: 1, current: expect.any(Number) });
    expect(passer.tables![0].seats).toEqual([
      { name: 'Ada', color: 'brass', kind: 'human' },
      { name: 'Bob', color: 'oxblood', kind: 'human' },
    ]);
    /* having asked, the passer is told of the next table without asking again */
    ada.send({ t: 'create', rid: 12, options: OPTIONS });
    await passer.until('the register again', () => (passer.tables?.length ?? 0) === 2, 4000);
    expect(passer.tables!.map((t) => t.status)).toEqual(['playing', 'open']);
    expect(passer.tables![1]).toMatchObject({ hostName: 'Ada', watchers: 1 });
    expect(TABLE_NAMES).toContain(passer.tables![1].name);
    expect(passer.tables![1].name).not.toBe(passer.tables![0].name);
    ada.send({ t: 'desk', rid: 13 });
    await ada.until('the desk', () => ada.desk?.hall.playing === 1);
  }, 30000);

  it('deals a quick table to four at once, and to one alone after forty seconds', async () => {
    await open(':memory:', { bot: 60000, ceremony: 60000 });
    const four = await Promise.all(['Ada', 'Bob', 'Cy', 'Di'].map((n) => arrive(n)));
    const [ada, bob] = four;
    server!.store.setProfile(bob.id, { favoriteColor: 'steel' });
    ada.send({ t: 'queue', mode: 'quick', on: true });
    await ada.until('the queue', () => ada.queue?.waiting === 1);
    expect(ada.queue).toMatchObject({ mode: 'quick', since: now });
    bob.send({ t: 'queue', mode: 'quick', on: true });
    await ada.until('the second', () => ada.queue?.waiting === 2);
    ada.send({ t: 'desk', rid: 1 });
    await ada.until('the desk', () => ada.desk?.queue?.waiting === 2);
    expect(ada.desk!.hall.queued).toBe(2);
    for (const g of four.slice(2)) g.send({ t: 'queue', mode: 'quick', on: true });
    for (const g of four) await g.until('the table', () => !!g.table && !!g.view);
    for (const g of four) {
      expect(g.queue).toBeNull();
      expect(TABLE_NAMES).toContain(g.table!.name);
      expect(g.table).toMatchObject({ status: 'starting', options: { eraLength: 'standard', timerMinutes: 2, assist: false } });
      expect(g.table!.ranked).toBeUndefined();
      expect(g.trace.indexOf('seated')).toBeGreaterThan(g.trace.lastIndexOf('queue'));
    }
    expect(ada.table!.seats.map((s) => s.name)).toEqual(['Ada', 'Bob', 'Cy', 'Di']);
    expect(ada.table!.seats.map((s) => s.color)).toEqual(['brass', 'steel', 'oxblood', 'verdigris']);
    expect(ada.table!.hostId).toBe(ada.id);
    expect(server!.hall.game(ada.table!.code)?.over).toBe(false);

    /* one alone: forty seconds on, two machines keep them company */
    const eli = await arrive('Eli');
    eli.send({ t: 'queue', mode: 'quick', on: true });
    await eli.until('the queue', () => eli.queue?.waiting === 1);
    now += 39_000;
    server!.hall.matchQueues();
    expect(server!.hall.desk(eli.id).queue).not.toBeNull();
    now += 2_000;
    server!.hall.matchQueues();
    await eli.until('the table', () => !!eli.view);
    expect(eli.queue).toBeNull();
    expect(eli.table!.seats.map((s) => [s.name, s.kind, s.persona])).toEqual([
      ['Eli', 'human', undefined],
      ['Mr Boulton', 'bot', 'boulton'],
      ['Mrs Wedgwood', 'bot', 'wedgwood'],
    ]);
    ada.send({ t: 'desk', rid: 2 });
    await ada.until('the desk', () => ada.desk?.hall.playing === 2);
    expect(ada.desk!.tables[0]).toMatchObject({ status: 'playing' });
  }, 30000);

  it('deals a ranked table to three after ninety seconds, and lets nobody else in', async () => {
    await open(':memory:', { bot: 60000, ceremony: 60000 });
    const [ada, bob, cy, di] = await Promise.all(['Ada', 'Bob', 'Cy', 'Di'].map((n) => arrive(n)));
    /* joining the other line is moving; stepping out is heard too */
    ada.send({ t: 'queue', mode: 'quick', on: true });
    await ada.until('the quick line', () => ada.queue?.mode === 'quick');
    ada.send({ t: 'queue', mode: 'ranked', on: true });
    await ada.until('the ranked line', () => ada.queue?.mode === 'ranked');
    expect(server!.hall.counts().queued).toBe(1);
    ada.send({ t: 'queue', mode: 'ranked', on: false });
    await ada.until('to be out', () => ada.queue === null);
    for (const g of [ada, bob, cy]) g.send({ t: 'queue', mode: 'ranked', on: true });
    await cy.until('three', () => cy.queue?.waiting === 3);
    now += 91_000;
    server!.hall.matchQueues();
    for (const g of [ada, bob, cy]) await g.until('the table', () => !!g.view);
    expect(TABLE_NAMES).toContain(ada.table!.name);
    expect(ada.table).toMatchObject({ ranked: true, options: { timerMinutes: 3, eraLength: 'standard' } });
    expect(ada.table!.seats).toHaveLength(3);
    expect(ada.table!.seats.every((s) => s.kind === 'human')).toBe(true);
    di.send({ t: 'join', rid: 30, code: ada.table!.code });
    await di.until('the refusal', () => di.rejected.length > 0);
    expect(di.rejected).toEqual(['refused']);
    /* the register knows it for what it is */
    di.send({ t: 'tables', rid: 31 });
    await di.until('the register', () => !!di.tables);
    expect(di.tables![0]).toMatchObject({ ranked: true, status: 'playing', watchers: 3 });
    /* a socket gone for good is dropped from the line after a while */
    di.send({ t: 'queue', mode: 'ranked', on: true });
    await di.until('the line', () => di.queue?.waiting === 1);
    di.close();
    await ada.until('the socket to be gone', () => server!.hall.counts().online === 3);
    server!.hall.matchQueues();
    expect(server!.hall.counts().queued).toBe(1);
    now += 31_000;
    server!.hall.matchQueues();
    expect(server!.hall.counts().queued).toBe(0);
  }, 30000);

  it('sells at the counter to whoever can pay, once', async () => {
    await open();
    const ada = await arrive('Ada');
    ada.send({ t: 'buy', rid: 1, item: 'tiles-mono' });
    await ada.until('the refusal', () => ada.rejected.length === 1);
    server!.store.earn(ada.id, 100);
    ada.send({ t: 'buy', rid: 2, item: 'tiles-mono' });
    await ada.until('the sale', () => ada.done.includes(2));
    await ada.until('the desk', () => ada.desk?.purse.guineas === 40);
    expect(ada.desk!.purse.owned).toEqual([...FREE_ITEMS, 'tiles-mono']);
    ada.send({ t: 'buy', rid: 3, item: 'tiles-mono' });
    await ada.until('the second refusal', () => ada.rejected.length === 2);
    ada.send({ t: 'buy', rid: 4, item: 'sign-of-nowhere' });
    await ada.until('the third refusal', () => ada.rejected.length === 3);
    ada.send({ t: 'buy', rid: 5, item: 'sign-oxford' });
    await ada.until('the fourth refusal', () => ada.rejected.length === 4);
    expect(ada.rejected).toEqual(['refused', 'refused', 'refused', 'refused']);
    expect(server!.store.purse(ada.id)).toEqual({ guineas: 40, owned: [...FREE_ITEMS, 'tiles-mono'] });
  });
});
