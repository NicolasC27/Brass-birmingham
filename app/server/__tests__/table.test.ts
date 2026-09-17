import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { botAction, fallbackAction, replay } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { chooseBotMove } from '@/game/bot';
import { serialize } from '@/game/engine';
import type { GameView } from '@/online/protocol';
import { serve } from '../index';
import type { Pace } from '../game';
import type { Serving } from '../index';
import { Guest, OPTIONS, PASSWORD, letters, post, tokenIn } from './guest';

/* ------------------------------------------------------------------ */
/* A whole table played over the wire: two accounts, two bots, a real  */
/* socket each. The humans decide from the state the server sends them */
/* and nothing else — proof that a filtered view is enough to play —   */
/* and at the end the server's log must replay to the very same game.  */
/* ------------------------------------------------------------------ */

/** the move this guest would play, decided on the view it was sent */
function decide(view: GameView): GameAction {
  const { state, seat } = view;
  return botAction(chooseBotMove(state, seat)) ?? fallbackAction(state, seat);
}

/** nobody's hand but mine, and no deck to read */
function keepsItsSecrets(view: GameView): boolean {
  const opaque = (id: string) => id.startsWith('hidden:');
  if (view.state.seed !== 0) return false;
  if (!view.state.deck.every((c) => opaque(c.id))) return false;
  return view.state.players.every((p, i) => i === view.seat || p.hand.every((c) => opaque(c.id)));
}

describe('a table over the wire', () => {
  let server: Serving | null = null;
  const guests: Guest[] = [];
  const dirs: string[] = [];

  /** a register of its own, swept away with the test */
  const registerFile = () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'brassworks-'));
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

  /** two signed-in accounts at a table, the guest ready, waiting on the bell */
  async function seatTwo(pace: Pace = { bot: 0, ceremony: 0 }, file = ':memory:') {
    server = await serve({ port: 0, mailer: post, pace, sweepEvery: 0, file });
    const host = new Guest('Ada');
    const guest = new Guest('Bob');
    guests.push(host, guest);
    await host.open(server.port);
    await guest.open(server.port);
    await host.signUp();
    await guest.signUp();
    host.send({ t: 'create', rid: 10, options: OPTIONS });
    await host.until('the table', () => !!host.table);
    const code = host.table!.code;
    guest.send({ t: 'join', rid: 11, code });
    await guest.until('a chair', () => !!guest.table);
    await host.until('the guest', () => host.table!.seats.length === 2);
    /* each human stamps their own chair — a host cannot do it for a guest */
    guest.send({ t: 'table', code, table: { ...guest.table!, seats: guest.table!.seats.map((s) => (s.id === guest.id ? { ...s, ready: true } : s)) } });
    await host.until('the guest to be ready', () => host.table!.seats.some((s) => s.id === guest.id && s.ready));
    return { host, guest, code };
  }

  const ring = (host: Guest, code: string, seats = host.table!.seats) =>
    host.send({ t: 'table', code, table: { ...host.table!, seats: seats.map((s) => (s.id === host.id ? { ...s, ready: true } : s)), status: 'starting' } });

  it('seats two players and two bots, plays the game out and replays its log', async () => {
    const { host, guest, code } = await seatTwo();
    host.send({
      t: 'table',
      code,
      table: {
        ...host.table!,
        seats: [
          ...host.table!.seats.map((s) => (s.id === host.id ? { ...s, ready: true } : s)),
          { id: 'bot-cy', name: 'Cy', color: 'verdigris' as const, kind: 'bot' as const, difficulty: 'industrialist' as const, ready: true, joinedAt: Date.now() },
          { id: 'bot-di', name: 'Di', color: 'steel' as const, kind: 'bot' as const, difficulty: 'foreman' as const, ready: true, joinedAt: Date.now() },
        ],
      },
    });
    await host.until('four seats', () => host.table!.seats.length === 4);
    ring(host, code);
    await host.until('the game', () => !!host.view);
    await guest.until('the game', () => !!guest.view);
    expect(host.view!.seat).toBe(0);
    expect(guest.view!.seat).toBe(1);

    /* the humans play from what they are told, the server plays the bots */
    for (let turn = 0; turn < 400; turn++) {
      const views = [host, guest];
      if (views.some((g) => g.view!.state.phase === 'game-over')) break;
      const g = views.find((x) => x.view!.state.phase === 'action' && x.view!.state.current === x.view!.seat);
      if (!g) {
        await host.until('the table to move', () => false, 20).catch(() => {});
        continue;
      }
      const at = g.view!.state.actions.length;
      g.send({ t: 'act', code, action: decide(g.view!) });
      await g.until('my action to land', () => g.view!.state.actions.length > at);
    }

    const truth = server!.hall.game(code)!;
    expect(truth.state.phase).toBe('game-over');
    await host.until('the archive', () => !!host.view!.archive);

    /* the log the server kept rebuilds the game it played */
    const archive = host.view!.archive!;
    expect(archive.actions.length).toBeGreaterThan(20);
    expect(serialize(replay(archive.setup, archive.seed, archive.actions))).toBe(serialize(truth.state));

    /* not one frame ever carried another player's hand */
    expect(host.seen.length).toBeGreaterThan(20);
    expect(host.seen.every(keepsItsSecrets)).toBe(true);
    expect(guest.seen.every(keepsItsSecrets)).toBe(true);
    expect(host.rejected).toEqual([]);
    expect(guest.rejected).toEqual([]);
  }, 60000);

  it('gives a reconnecting player their own seat back, mid-game', async () => {
    const { host, guest, code } = await seatTwo({ bot: 60000, ceremony: 60000 });
    ring(host, code);
    await host.until('the game', () => !!host.view);
    await guest.until('the game', () => !!guest.view);

    /* the guest's browser goes away and comes back with the same session */
    const played = server!.hall.game(code)!.state.actions.length;
    const token = guest.token;
    guest.close();
    const again = new Guest('Bob');
    guests.push(again);
    await again.open(server!.port);
    await again.signInWith(token);
    again.send({ t: 'watch', code });
    await again.until('the table back', () => !!again.view && !!again.table);
    expect(again.view!.seat).toBe(1);
    expect(again.view!.state.actions.length).toBe(played);
    expect(again.view!.state.players[1].hand.every((c) => !c.id.startsWith('hidden:'))).toBe(true);
    expect(keepsItsSecrets(again.view!)).toBe(true);

    /* and a stranger who merely follows the code sees no hand at all */
    const passer = new Guest('Nobody');
    guests.push(passer);
    await passer.open(server!.port);
    await passer.signUp();
    passer.send({ t: 'watch', code });
    await passer.until('the table', () => !!passer.view);
    expect(passer.view!.seat).toBe(-1);
    expect(passer.view!.state.players.every((p) => p.hand.every((c) => c.id.startsWith('hidden:')))).toBe(true);
  }, 30000);

  it('turns down an action taken out of turn', async () => {
    const { host, guest, code } = await seatTwo({ bot: 60000, ceremony: 60000 });
    ring(host, code);
    await host.until('the game', () => !!host.view);
    await guest.until('the game', () => !!guest.view);

    const idle = [host, guest].find((g) => g.view!.state.current !== g.view!.seat)!;
    idle.send({ t: 'act', code, action: decide({ ...idle.view!, seat: idle.view!.state.current }) });
    await idle.until('the refusal', () => idle.rejected.length > 0);
    expect(idle.rejected[0]).toBe('Not your turn');
    expect(server!.hall.game(code)!.state.actions.length).toBe(0);
    /* the board comes back first, the reason second — the other way round
       the state landing on the client would wipe the reason off the screen */
    expect(idle.trace.slice(-2)).toEqual(['game', 'rejected']);
    /* and the ceremony cannot be closed while the canal era is still played */
    const busy = [host, guest].find((g) => g.view!.state.current === g.view!.seat)!;
    busy.send({ t: 'act', code, action: { kind: 'begin-rail' } });
    await busy.until('the refusal', () => busy.rejected.length > 0);
    expect(busy.rejected[0]).toBe('The canal era is not being scored');
  }, 30000);

  it('lets a move be taken back twice a turn, the candle burning on', async () => {
    const { host, guest, code } = await seatTwo({ bot: 60000, ceremony: 60000, minute: 1000 });
    host.send({ t: 'table', code, table: { ...host.table!, options: { ...OPTIONS, timerMinutes: 5 } } });
    await host.until('the candle', () => host.table!.options.timerMinutes === 5);
    ring(host, code);
    await host.until('the game', () => !!host.view);
    await guest.until('the game', () => !!guest.view);
    const game = server!.hall.game(code)!;
    const toAct = () => [host, guest].find((g) => g.view!.state.current === g.view!.seat)!;
    const play = async (g: Guest) => {
      const at = g.view!.state.actions.length;
      g.send({ t: 'act', code, action: decide(g.view!) });
      await g.until('the move to land', () => g.view!.state.actions.length > at);
    };
    const takeBack = async (g: Guest) => {
      const at = g.view!.state.actions.length;
      g.send({ t: 'undo', code });
      await g.until('the move to be taken back', () => g.view!.state.actions.length < at || g.rejected.length > 0);
    };
    /* the opening round is one action a seat: only from the second is there a turn to take back within */
    await play(toAct());
    await play(toAct());
    const mover = toAct();
    const played = mover.view!.state.actions.length;
    await play(mover);
    await new Promise((r) => setTimeout(r, 250));
    await takeBack(mover);
    expect(mover.view!.state.actions.length).toBe(played);
    /* the candle was not lit again: what was burnt stays burnt */
    expect(game.msLeft).toBeLessThan(4800);
    await play(mover);
    await takeBack(mover);
    await play(mover);
    await takeBack(mover);
    expect(mover.rejected).toEqual(['No more taking back this turn']);
    expect(mover.view!.state.actions.length).toBe(played + 1);
  }, 30000);

  it('seats a bot under the house\'s own id when the client\'s is not a bot\'s, and turns down a chair of no known colour', async () => {
    const { host, code } = await seatTwo({ bot: 60000, ceremony: 60000 });
    /* an id shaped like an account's: the house names the machine itself */
    const bot = { id: 'a-0123456789abcdef', name: '  Cy  ', color: 'verdigris' as const, kind: 'bot' as const, difficulty: 'foreman' as const, ready: true, joinedAt: 0 };
    host.send({ t: 'table', code, table: { ...host.table!, seats: [...host.table!.seats, bot] } });
    await host.until('the bot', () => host.table!.seats.length === 3);
    const seated = host.table!.seats[2];
    expect(seated.id).toMatch(/^bot-[0-9a-f]{8}$/);
    expect(seated).toMatchObject({ name: 'Cy', color: 'verdigris', difficulty: 'foreman' });
    /* a colour off the palette, or a bot of no known temper: the table stands as it was */
    const before = host.trace.length;
    host.send({ t: 'table', code, table: { ...host.table!, seats: host.table!.seats.map((s) => (s.id === host.id ? { ...s, color: 'plaid' as never } : s)) } });
    await host.until('the answer', () => host.trace.length > before);
    expect(host.table!.seats[0].color).toBe('brass');
    host.send({ t: 'table', code, table: { ...host.table!, seats: host.table!.seats.map((s) => (s.id === seated.id ? { ...s, difficulty: 'genius' as never } : s)) } });
    await host.until('the second answer', () => host.trace.length > before + 1);
    expect(host.table!.seats[2].difficulty).toBe('foreman');
  }, 30000);

  it('shows the door to a socket that talks too fast, and to the other tabs once the password changes', async () => {
    server = await serve({ port: 0, mailer: post, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, file: ':memory:' });
    const ada = new Guest('Ada');
    guests.push(ada);
    await ada.open(server.port);
    await ada.signUp();
    /* another tab with the same session */
    const tab = new Guest('Ada');
    guests.push(tab);
    await tab.open(server.port);
    await tab.signInWith(ada.token);
    ada.send({ t: 'password', rid: 40, current: PASSWORD, next: 'a-newer-long-password' });
    await tab.until('the other tab to be hung up on', () => tab.closedWith === 4001);
    await ada.until('the new session', () => ada.trace.filter((t) => t === 'session').length === 2);
    /* forty frames at once: the bucket runs dry and the rest are refused */
    for (let i = 0; i < 40; i++) ada.send({ t: 'desk', rid: 100 + i });
    await ada.until('the refusals', () => ada.rejected.includes('refused'));
    expect(ada.closedWith).toBeNull();
  }, 30000);

  it('opens again on the same tables, with the game where it was left', async () => {
    const file = registerFile();
    const { host, guest, code } = await seatTwo({ bot: 60000, ceremony: 60000 }, file);
    ring(host, code);
    await host.until('the game', () => !!host.view);
    await guest.until('the game', () => !!guest.view);

    /* one real move, so the log has something to say */
    const first = [host, guest].find((g) => g.view!.state.current === g.view!.seat)!;
    first.send({ t: 'act', code, action: decide(first.view!) });
    await first.until('the move to land', () => first.view!.state.actions.length === 1);
    const before = serialize(server!.hall.game(code)!.state);
    const token = host.token;

    /* the house closes for the night */
    for (const g of guests.splice(0)) g.close();
    await server!.close();

    /* and opens on the same tables, the game exactly where it stood */
    server = await serve({ port: 0, mailer: post, pace: { bot: 60000, ceremony: 60000 }, sweepEvery: 0, file });
    expect(server.hall.table(code)?.name).toBe(host.table!.name);
    expect(serialize(server.hall.game(code)!.state)).toBe(before);

    const back = new Guest('Ada');
    guests.push(back);
    await back.open(server.port);
    await back.signInWith(token);
    back.send({ t: 'watch', code });
    await back.until('the game back', () => !!back.view);
    expect(back.view!.seat).toBe(0);
    expect(back.view!.state.actions.length).toBe(1);
  }, 30000);

  it('passes for a seat that lets its candle burn out, and that pass stands', async () => {
    /* a candle whose minute lasts 40ms: the same code path, a shorter wait */
    const { host, code } = await seatTwo({ bot: 60000, ceremony: 60000, minute: 40 });
    /* the shortest candle the office allows a table to set */
    host.send({ t: 'table', code, table: { ...host.table!, options: { ...OPTIONS, timerMinutes: 1 } } });
    await host.until('the candle', () => host.table!.options.timerMinutes === 1);
    ring(host, code);
    await host.until('the game', () => !!host.view);

    const table = server!.hall.game(code)!;
    const seat = table.state.current;
    expect(host.view!.msLeft).toBeGreaterThan(0);
    /* nobody plays: the candle burns down and the table puts the turn itself */
    await host.until('the candle to go out', () => table.state.actions.length > 0);
    expect(table.state.actions).toEqual([{ kind: 'pass', reason: expect.stringContaining('candle') }]);
    expect(table.state.current).not.toBe(seat);
    /* and it is nobody's to take back: the clock is not a second chance */
    expect(table.mayUndo(seat)).toBe(false);
  }, 30000);

  it('opens the tables only to a verified address, and carries invitations to the desk', async () => {
    server = await serve({ port: 0, mailer: post, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, file: ':memory:' });
    const host = new Guest('Ada');
    const guest = new Guest('Bob');
    guests.push(host, guest);
    await host.open(server.port);
    await guest.open(server.port);
    /* an account whose letter is unanswered is signed in, but the tables are shut */
    await host.signUp(false);
    expect(host.me?.verified).toBe(false);
    host.send({ t: 'create', rid: 10, options: OPTIONS });
    await host.until('the refusal', () => host.rejected.includes('verify-first'));
    host.send({ t: 'verify', rid: 11, token: tokenIn(letters.get(host.email), 'verify') });
    await host.until('the address to be verified', () => host.me?.verified === true);
    host.send({ t: 'create', rid: 12, options: OPTIONS });
    await host.until('the table', () => !!host.table);
    const code = host.table!.code;

    /* the guest is asked by name; the letter lands on their desk */
    await guest.signUp();
    guest.send({ t: 'desk', rid: 20 });
    await guest.until('an empty desk', () => !!guest.desk);
    expect(guest.desk!.invitations).toEqual([]);
    host.send({ t: 'invite', rid: 13, code, name: 'bob' });
    await guest.until('the invitation', () => (guest.desk?.invitations.length ?? 0) === 1);
    expect(guest.desk!.invitations[0]).toMatchObject({ code, tableName: host.table!.name, from: { id: host.id, name: 'Ada' } });
    host.send({ t: 'invite', rid: 14, code, name: 'bob' });
    await host.until('the second letter to be refused', () => host.rejected.includes('already-invited'));
    host.send({ t: 'invite', rid: 15, code, name: 'nobody' });
    await host.until('the stranger to be refused', () => host.rejected.includes('no-such-player'));

    /* accepting takes the chair; the desk of both lists the table */
    guest.send({ t: 'answer', rid: 21, id: guest.desk!.invitations[0].id, accept: true });
    await guest.until('a chair', () => !!guest.table);
    await guest.until('the letter to be answered', () => guest.desk?.invitations.length === 0);
    expect(guest.desk!.tables.map((t) => t.code)).toEqual([code]);
    expect(guest.desk!.tables[0]).toMatchObject({ status: 'open', myTurn: false, seats: [{ name: 'Ada' }, { name: 'Bob' }] });
    host.send({ t: 'desk', rid: 16 });
    await host.until('the desk', () => !!host.desk?.tables.length);
    expect(host.desk!.sent).toEqual([]);
    expect(host.desk!.tables[0].hostId).toBe(host.id);

    /* friends: asked by name, answered from the desk, seen online */
    host.send({ t: 'friend', rid: 17, name: 'BOB' });
    await guest.until('the asking', () => guest.desk?.friends[0]?.status === 'asks');
    await host.until('the waiting', () => host.desk?.friends[0]?.status === 'asked');
    expect(host.desk!.friends[0]).toMatchObject({ account: { name: 'Bob' }, online: true });
    guest.send({ t: 'friend', rid: 22, name: 'ada' });
    await host.until('the friendship', () => host.desk?.friends[0]?.status === 'friends');
    host.send({ t: 'friend', rid: 18, name: 'Bob' });
    await host.until('the refusal', () => host.rejected.includes('already-friends'));
    host.send({ t: 'unfriend', rid: 19, id: host.desk!.friends[0].id });
    await guest.until('the end of it', () => guest.desk?.friends.length === 0);
  });

  it('stops for a pause everyone agreed to, waits for a seat on a break, and rolls back on the host\'s word', async () => {
    /* a minute lasts 50 ms here: the break ends on its own within the test */
    const { host, guest, code } = await seatTwo({ bot: 0, ceremony: 0, minute: 50 });
    host.send({ t: 'table', code, table: { ...host.table!, options: { ...host.table!.options, timerMinutes: 5 } } });
    await host.until('the timer', () => host.table!.options.timerMinutes === 5);
    ring(host, code);
    await host.until('the game', () => !!host.view);
    await guest.until('the game', () => !!guest.view);
    const views = () => [host, guest];
    const toAct = () => views().find((x) => x.view!.state.current === x.view!.seat)!;
    const other = () => views().find((x) => x.view!.state.current !== x.view!.seat)!;

    /* a pause: proposed by one, held once the other agrees, and the candle stops */
    other().send({ t: 'pause', code, want: 'propose' });
    await host.until('the proposal', () => host.view?.pause?.kind === 'table' && !host.view.pause.held);
    toAct().send({ t: 'pause', code, want: 'agree' });
    await host.until('the pause to hold', () => host.view?.pause?.kind === 'table' && host.view.pause.held);
    expect(host.view!.frozen).toBe(true);
    const frozenAt = host.view!.msLeft;
    await new Promise((r) => setTimeout(r, 120));
    toAct().send({ t: 'act', code, action: decide(toAct().view!) });
    await toAct().until('the refusal', () => toAct().rejected.includes('The table is paused'));
    expect(server!.hall.game(code)!.msLeft).toBe(frozenAt);
    guest.send({ t: 'pause', code, want: 'resume' });
    await host.until('the table to move again', () => host.view?.pause === null);
    expect(host.view!.frozen).toBe(false);

    /* a break for the seat to act: its candle waits, and the break ends on its own */
    const breaker = toAct();
    breaker.send({ t: 'break', code, on: true });
    await host.until('the break', () => host.view?.pause?.kind === 'break');
    expect(host.view!.breaks[breaker.view!.seat]).toBe(1);
    expect(host.view!.frozen).toBe(true);
    await host.until('the break to end', () => host.view?.pause === null, 4000);
    expect(host.view!.frozen).toBe(false);

    /* two actions, then the host takes the table back to before the first */
    for (let i = 0; i < 2; i++) {
      const g = toAct();
      const at = g.view!.state.actions.length;
      g.send({ t: 'act', code, action: decide(g.view!) });
      await g.until('the action to land', () => g.view!.state.actions.length > at);
    }
    const n = host.view!.state.actions.length;
    guest.send({ t: 'rollback', code, want: 'propose', to: n - 2 });
    await guest.until('the guest to be refused', () => guest.rejected.includes('Only the host may roll the table back'));
    host.send({ t: 'rollback', code, want: 'propose', to: n - 2 });
    await guest.until('the proposal', () => guest.view?.rollback?.to === n - 2);
    guest.send({ t: 'rollback', code, want: 'agree' });
    await host.until('the table to go back', () => host.view!.state.actions.length === n - 2);
    expect(host.view!.rollback).toBeNull();
    expect(serialize(server!.hall.game(code)!.state)).toBe(serialize(replay(server!.hall.game(code)!.setup, server!.hall.game(code)!.seed, server!.hall.game(code)!.state.actions)));
  });

  it('burns a candle only for the seat that carries one', async () => {
    const { host, guest, code } = await seatTwo({ bot: 0, ceremony: 0, minute: 1000 });
    /* the host gives the guest a three-minute candle; the table itself has none */
    host.send({ t: 'table', code, table: { ...host.table!, seats: host.table!.seats.map((s) => (s.id === guest.id ? { ...s, minutes: 3 } : s)) } });
    await host.until('the candle', () => host.table!.seats.find((s) => s.id === guest.id)?.minutes === 3);
    ring(host, code);
    await host.until('the game', () => !!host.view);
    const game = server!.hall.game(code)!;
    const expectCandle = () => {
      const current = game.state.current;
      const guestSeat = game.seatOf(guest.id);
      if (current === guestSeat) expect(game.msLeft).toBeGreaterThan(2000);
      else expect(game.msLeft).toBeNull();
    };
    expectCandle();
    /* after the first action the other seat acts: the candle follows the seat */
    const first = [host, guest].find((g) => g.view!.state.current === g.view!.seat)!;
    const at = first.view!.state.actions.length;
    first.send({ t: 'act', code, action: decide(first.view!) });
    await first.until('the action to land', () => first.view!.state.actions.length > at);
    expectCandle();
  });

  it('keeps an idea in the book, on the page and in the post', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'brass-'));
    dirs.push(dir);
    const book = path.join(dir, 'ideas.md');
    server = await serve({ port: 0, mailer: post, pace: { bot: 60000, ceremony: 60000 }, sweepEvery: 0, file: ':memory:', feedbackFile: book, feedbackTo: 'owner@brass.works' });
    const ada = new Guest('Ada');
    guests.push(ada);
    await ada.open(server.port);
    await ada.signUp(false);
    ada.send({ t: 'feedback', rid: 30, page: '/game', kind: 'bug', text: 'The barge sails backwards.' });
    await ada.until('the post', () => letters.get('owner@brass.works')?.text.includes('barge') === true);
    expect(letters.get('owner@brass.works')?.subject).toContain('a bug from Ada');
    await ada.until('the book', () => {
      try {
        return readFileSync(book, 'utf8').includes('backwards');
      } catch {
        return false;
      }
    });
    const page = await fetch(`http://127.0.0.1:${server.port}/feedback`).then((r) => r.text());
    expect(page).toContain('## Bug — Ada');
    expect(page).toContain('The barge sails backwards.');
    /* five notes an hour, no more */
    for (let i = 0; i < 5; i++) ada.send({ t: 'feedback', rid: 31 + i, page: '/game', kind: 'idea', text: `Idea ${i}` });
    await ada.until('the box to be full', () => ada.rejected.includes('refused'));
    expect(server.store.feedbackSince(ada.id, 0)).toBe(5);
  });

  it('keeps the letters and the box off the public counter', async () => {
    /* a real register, and no DEV_LETTERS: the pages are not for the road */
    process.env.FEEDBACK_TOKEN = 'the-owners-key';
    try {
      server = await serve({ port: 0, mailer: post, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, file: registerFile() });
    } finally {
      delete process.env.FEEDBACK_TOKEN;
    }
    const at = `http://127.0.0.1:${server.port}`;
    expect((await fetch(`${at}/letters`)).status).toBe(404);
    expect((await fetch(`${at}/feedback`)).status).toBe(404);
    expect((await fetch(`${at}/feedback?token=wrong`)).status).toBe(404);
    expect((await fetch(`${at}/feedback?token=the-owners-key`)).status).toBe(200);
  });

  it('says nothing to a socket that has not signed in', async () => {
    server = await serve({ port: 0, mailer: post, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, file: ':memory:' });
    const stranger = new Guest('Nobody');
    guests.push(stranger);
    await stranger.open(server.port);
    stranger.send({ t: 'create', rid: 1, options: OPTIONS });
    await stranger.until('the door to be shut', () => stranger.rejected.length > 0);
    expect(stranger.rejected[0]).toBe('sign-in-first');
    expect(server.hall.codes()).toEqual([]);

    /* the same name cannot be taken twice, and a bad password opens nothing */
    await stranger.signUp();
    const twice = new Guest('nobody');
    guests.push(twice);
    await twice.open(server.port);
    twice.send({ t: 'signup', rid: 2, name: 'nobody', email: 'nobody@example.test', password: PASSWORD });
    await twice.until('the refusal', () => twice.rejected.length > 0);
    expect(twice.rejected.at(-1)).toBe('name-taken');
    twice.send({ t: 'signin', rid: 3, name: 'Nobody', password: 'not-the-password' });
    await twice.until('the second refusal', () => twice.rejected.length > 1);
    expect(twice.rejected.at(-1)).toBe('bad-credentials');
    expect(twice.id).toBe('');
  }, 30000);
});
