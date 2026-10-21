import { afterEach, describe, expect, it } from 'vitest';
import type { Rivalry } from '@/game/rivalry';
import { emptyTally } from '@/game/tally';
import type { Tally } from '@/game/tally';
import type { GameState, IndustryType, SetupPayload } from '@/game/types';
import type { ServerMessage } from '@/online/protocol';
import { serve } from '../index';
import type { Serving } from '../index';
import { rivalriesOf } from '../rivals';
import type { Finished } from '../rivals';
import { Store } from '../store';
import { Guest, OPTIONS, post } from './guest';

/* ------------------------------------------------------------------ */
/* The characters' memory, counted from the games at home the office   */
/* keeps: who came out ahead, the runs, and the facts of the last game */
/* — then handed to the account that asks, and counted again only when */
/* another game has been played out.                                   */
/* ------------------------------------------------------------------ */

const DAY = 24 * 60 * 60 * 1000;

const setupOf = (...bots: ('watt' | 'wedgwood' | 'arkwright' | 'boulton')[]): SetupPayload => ({
  players: [{ name: 'Ada', color: 'brass', type: 'human' }, ...bots.map((persona, i) => ({ name: persona, color: ['oxblood', 'verdigris', 'steel'][i], type: 'bot' as const, persona }))],
  options: OPTIONS,
});

const tally = (o: { towns?: Record<string, number>; industries?: Partial<Record<IndustryType, number>>; loans?: number } = {}): Tally => ({ ...emptyTally(), towns: o.towns ?? {}, industries: o.industries ?? {}, loans: o.loans ?? 0 });

/** a game played out: the account's seat first, then the characters' */
const game = (code: string, at: number, setup: SetupPayload, vps: number[], extra: { tallies?: Tally[]; canal?: number[]; abandoned?: boolean } = {}): Finished => ({
  code,
  finishedAt: at,
  setup,
  result: {
    players: vps.map((vp, i) => ({ vp, bot: i > 0, tally: extra.tallies?.[i] ?? tally() })),
    winner: vps.indexOf(Math.max(...vps)),
    abandoned: !!extra.abandoned,
    ...(extra.canal ? { canal: extra.canal } : {}),
  },
});

const of = (list: Rivalry[], persona: string): Rivalry | undefined => list.find((r) => r.persona === persona);

describe('a character’s memory', () => {
  it('counts the games, who came out ahead, and the run the last one ends', () => {
    const t0 = Date.UTC(2026, 8, 1);
    const list = rivalriesOf([
      /* handed out of order: the memory is read in the order they were played */
      game('C', t0 + 2 * DAY, setupOf('watt'), [140, 120]),
      game('A', t0, setupOf('watt'), [100, 130]),
      game('B', t0 + DAY, setupOf('watt'), [150, 110]),
    ]);
    const watt = of(list, 'watt')!;
    expect(watt).toMatchObject({ games: 3, won: 2, lost: 1, streak: 2 });
    expect(watt.last).toMatchObject({ code: 'C', at: t0 + 2 * DAY, won: true, vp: 140, theirs: 120, map: 'midlands' });
  });

  it('remembers a run of the character’s own', () => {
    const t0 = Date.UTC(2026, 8, 1);
    const list = rivalriesOf([game('A', t0, setupOf('wedgwood'), [150, 100]), game('B', t0 + 1, setupOf('wedgwood'), [90, 100]), game('C', t0 + 2, setupOf('wedgwood'), [80, 100]), game('D', t0 + 3, setupOf('wedgwood'), [70, 100])]);
    expect(of(list, 'wedgwood')).toMatchObject({ games: 4, won: 1, lost: 3, streak: -3 });
  });

  it('keeps each character at the table apart, and the account’s best seat against them', () => {
    const setup: SetupPayload = {
      players: [
        { name: 'Ada', color: 'brass', type: 'human' },
        { name: 'Mrs Wedgwood', color: 'oxblood', type: 'bot', persona: 'wedgwood' },
        { name: 'Bob', color: 'verdigris', type: 'human' },
        /* a deal from before the characters had names: its colour says who */
        { name: 'Machine', color: 'steel', type: 'bot' },
      ],
      options: OPTIONS,
    };
    const g: Finished = { code: 'H', finishedAt: 1, setup, result: { players: [{ vp: 90, bot: false }, { vp: 120, bot: true }, { vp: 130, bot: false }, { vp: 140, bot: true }], winner: 3, abandoned: false } };
    const list = rivalriesOf([g]);
    /* Bob, the best placed of the two people at the screen, beat Wedgwood */
    expect(of(list, 'wedgwood')?.last).toMatchObject({ won: true, vp: 130, theirs: 120 });
    expect(of(list, 'watt')?.last).toMatchObject({ won: false, vp: 130, theirs: 140 });
    expect(of(list, 'boulton')).toBeUndefined();
  });

  it('forgets a game the table folded, and one no person sat at', () => {
    const noOne: SetupPayload = { players: setupOf('watt', 'boulton').players.map((p) => ({ ...p, type: 'bot' as const, persona: 'boulton' as const })), options: OPTIONS };
    const list = rivalriesOf([game('A', 1, setupOf('watt'), [100, 120], { abandoned: true }), game('B', 2, noOne, [100, 120, 90])]);
    expect(list).toEqual([]);
  });

  it('settles a tie by the engine’s winner', () => {
    const g = game('A', 1, setupOf('arkwright'), [120, 120]);
    g.result.winner = 0;
    expect(of(rivalriesOf([g]), 'arkwright')?.last.won).toBe(true);
    g.result.winner = 1;
    expect(of(rivalriesOf([g]), 'arkwright')?.last.won).toBe(false);
  });

  it('remembers the town taken from it, the industry leaned on, the loans and its own best build', () => {
    const tallies = [
      tally({ towns: { birmingham: 3, coventry: 2 }, industries: { cotton: 5, coal: 2 }, loans: 4 }),
      tally({ towns: { birmingham: 1, dudley: 4 }, industries: { iron: 4, coal: 1 } }),
    ];
    const last = of(rivalriesOf([game('A', 1, setupOf('watt'), [150, 130], { tallies })]), 'watt')!.last;
    expect(last.town).toEqual({ id: 'birmingham', name: 'Birmingham' });
    expect(last.industry).toBe('cotton');
    expect(last.loans).toBe(4);
    expect(last.own).toBe('iron');
    expect(last.comeback).toBeUndefined();
  });

  it('leaves out what is not worth remembering', () => {
    const tallies = [
      /* built at Coventry alone, a spread of industries, one loan */
      tally({ towns: { coventry: 3 }, industries: { cotton: 2, coal: 2, iron: 2 }, loans: 1 }),
      tally({ towns: { dudley: 1 }, industries: { iron: 2 } }),
    ];
    const last = of(rivalriesOf([game('A', 1, setupOf('watt'), [150, 130], { tallies })]), 'watt')!.last;
    expect(last.town).toBeUndefined();
    expect(last.industry).toBeUndefined();
    expect(last.loans).toBeUndefined();
    expect(last.own).toBeUndefined();
  });

  it('calls a canal era lost and a game won a comeback', () => {
    const back = of(rivalriesOf([game('A', 1, setupOf('watt'), [150, 140], { canal: [30, 45] })]), 'watt')!.last;
    expect(back.comeback).toBe(true);
    const lost = of(rivalriesOf([game('A', 1, setupOf('watt'), [130, 140], { canal: [30, 45] })]), 'watt')!.last;
    expect(lost.comeback).toBeUndefined();
    const ahead = of(rivalriesOf([game('A', 1, setupOf('watt'), [150, 140], { canal: [44, 45] })]), 'watt')!.last;
    expect(ahead.comeback).toBeUndefined();
  });
});

/** the final position of a game at home, as much of it as the register reads */
const over = (vps: number[], canal: number[]): GameState =>
  ({
    players: vps.map((vp, i) => ({ name: i ? 'Mr Watt' : 'Ada', color: i ? 'steel' : 'brass', vp, isBot: i > 0 })),
    winner: vps.indexOf(Math.max(...vps)),
    abandoned: false,
    canalScores: canal,
  }) as unknown as GameState;

const brief = { era: 'rail' as const, round: 8, seats: [{ name: 'Ada', color: 'brass' as const, kind: 'human' as const }, { name: 'Mr Watt', color: 'steel' as const, kind: 'bot' as const }] };

describe('the register of games at home', () => {
  it('keeps the canal’s points with the standings, and hands the games played out to the count', () => {
    const store = new Store(':memory:');
    const setup = setupOf('watt');
    const a = store.openHomeGame('acct', 'Soho', 1, setup, brief);
    store.openHomeGame('acct', 'Still going', 2, setup, brief);
    store.finishHomeGame('acct', a.code, over([150, 140], [30, 45]), [tally({ towns: { walsall: 2 } }), tally({ towns: { walsall: 1 } })]);
    const done = store.finishedHome('acct');
    expect(done.map((g) => g.code)).toEqual([a.code]);
    expect(done[0].result.canal).toEqual([30, 45]);
    expect(of(rivalriesOf(done), 'watt')?.last).toMatchObject({ won: true, comeback: true, town: { id: 'walsall', name: 'Walsall' } });
    /* another account's games are nothing to this one */
    expect(store.finishedHome('other')).toEqual([]);
  });
});

describe('the rivals over the wire', () => {
  let server: Serving | null = null;
  const guests: Guest[] = [];

  afterEach(async () => {
    for (const g of guests) g.close();
    guests.length = 0;
    await server?.close();
    server = null;
  });

  const answer = (g: Guest, rid: number): Extract<ServerMessage, { t: 'rivals' }> | undefined => g.frames.find((m): m is Extract<ServerMessage, { t: 'rivals' }> => m.t === 'rivals' && m.rid === rid);

  it('hands a guest what the characters remember of it, and counts again once a game is played out', async () => {
    server = await serve({ port: 0, mailer: post, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, queueEvery: 0, editionEvery: 0, file: ':memory:' });
    const ada = new Guest('Ada');
    guests.push(ada);
    await ada.open(server.port);
    await ada.asGuest();

    ada.send({ t: 'rivals', rid: 1 });
    await ada.until('the first answer', () => !!answer(ada, 1));
    expect(answer(ada, 1)!.rivals).toEqual([]);

    const store = server.store;
    const setup = setupOf('watt');
    const one = store.openHomeGame(ada.id, 'One', 1, setup, brief);
    store.finishHomeGame(ada.id, one.code, over([100, 130], [20, 40]));
    ada.send({ t: 'rivals', rid: 2 });
    await ada.until('the second answer', () => !!answer(ada, 2));
    expect(answer(ada, 2)!.rivals).toMatchObject([{ persona: 'watt', games: 1, won: 0, lost: 1, streak: -1 }]);

    const two = store.openHomeGame(ada.id, 'Two', 2, setup, brief);
    store.finishHomeGame(ada.id, two.code, over([150, 149], [40, 44]));
    ada.send({ t: 'rivals', rid: 3 });
    await ada.until('the third answer', () => !!answer(ada, 3));
    expect(answer(ada, 3)!.rivals).toMatchObject([{ persona: 'watt', games: 2, won: 1, lost: 1, streak: 1, last: { code: two.code, vp: 150, theirs: 149 } }]);

    /* a game put away is forgotten by the characters too */
    ada.send({ t: 'home.forget', rid: 4, code: two.code });
    await ada.until('the game put away', () => ada.done.includes(4));
    ada.send({ t: 'rivals', rid: 5 });
    await ada.until('the fourth answer', () => !!answer(ada, 5));
    expect(answer(ada, 5)!.rivals).toMatchObject([{ persona: 'watt', games: 1 }]);
  });

  it('answers nobody who has not said who they are', async () => {
    server = await serve({ port: 0, mailer: post, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, queueEvery: 0, editionEvery: 0, file: ':memory:' });
    const stranger = new Guest('Nobody');
    guests.push(stranger);
    await stranger.open(server.port);
    stranger.send({ t: 'rivals', rid: 1 });
    await new Promise((r) => setTimeout(r, 60));
    expect(answer(stranger, 1)).toBeUndefined();
  });
});
