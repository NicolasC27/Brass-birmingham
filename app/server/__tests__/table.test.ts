import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { botAction, fallbackAction, replay } from '@/game/actions';
import type { GameAction } from '@/game/actions';
import { chooseBotMove } from '@/game/bot';
import { serialize } from '@/game/engine';
import { decode, encode } from '@/online/protocol';
import type { ClientMessage, GameView, ServerMessage } from '@/online/protocol';
import type { Table } from '@/online/table';
import { serve } from '../index';
import type { Pace } from '../game';
import type { Serving } from '../index';

/* ------------------------------------------------------------------ */
/* A whole table played over the wire: two accounts, two bots, a real  */
/* socket each. The humans decide from the state the server sends them */
/* and nothing else — proof that a filtered view is enough to play —   */
/* and at the end the server's log must replay to the very same game.  */
/* ------------------------------------------------------------------ */

const OPTIONS = { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' } as const;
const PASSWORD = 'a-good-long-password';

/** a player at the far end of a socket: the last table and view it was sent */
class Guest {
  readonly name: string;
  /** the account id, once the office has recognised it */
  id = '';
  token = '';
  private socket!: WebSocket;
  private rid = 0;
  table: Table | null = null;
  view: GameView | null = null;
  rejected: string[] = [];
  /** every view ever received — the secrecy audit reads them all */
  seen: GameView[] = [];
  /** the tags of the frames as they arrived, in order */
  trace: string[] = [];

  constructor(name: string) {
    this.name = name;
  }

  async open(port: number): Promise<void> {
    this.socket = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((ok, ko) => {
      this.socket.once('open', () => ok());
      this.socket.once('error', ko);
    });
    this.socket.on('message', (raw: Buffer) => {
      const m = decode<ServerMessage>(String(raw));
      if (!m) return;
      this.trace.push(m.t);
      if (m.t === 'table') this.table = m.table;
      if (m.t === 'seated') this.table = m.table;
      if (m.t === 'session') {
        this.id = m.me.id;
        this.token = m.token;
      }
      if (m.t === 'welcome') this.id = m.me.id;
      if (m.t === 'game') {
        this.view = m.view;
        this.seen.push(m.view);
      }
      if (m.t === 'rejected' || m.t === 'refused') this.rejected.push(m.error);
    });
  }

  /** open an account and be signed in with it */
  async signUp(): Promise<void> {
    this.send({ t: 'signup', rid: ++this.rid, name: this.name, password: PASSWORD });
    await this.until('a session', () => !!this.id);
  }

  /** come back with a token already in hand */
  async signInWith(token: string): Promise<void> {
    this.send({ t: 'auth', token });
    await this.until('the welcome back', () => !!this.id);
  }

  send(m: ClientMessage): void {
    this.socket.send(encode(m));
  }

  close(): void {
    this.socket.close();
  }

  /** resolve once `ready` holds, or throw — the tests never hang on a socket */
  async until(what: string, ready: () => boolean, ms = 8000): Promise<void> {
    const stop = Date.now() + ms;
    while (!ready()) {
      if (Date.now() > stop) throw new Error(`timed out waiting for ${what}`);
      await new Promise((r) => setTimeout(r, 4));
    }
  }
}

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
    server = await serve({ port: 0, pace, sweepEvery: 0, file });
    const host = new Guest('Ada');
    const guest = new Guest('Bob');
    guests.push(host, guest);
    await host.open(server.port);
    await guest.open(server.port);
    await host.signUp();
    await guest.signUp();
    host.send({ t: 'create', rid: 10, name: 'The Works', options: OPTIONS });
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
    server = await serve({ port: 0, pace: { bot: 60000, ceremony: 60000 }, sweepEvery: 0, file });
    expect(server.hall.table(code)?.name).toBe('The Works');
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

  it('says nothing to a socket that has not signed in', async () => {
    server = await serve({ port: 0, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0, file: ':memory:' });
    const stranger = new Guest('Nobody');
    guests.push(stranger);
    await stranger.open(server.port);
    stranger.send({ t: 'create', rid: 1, name: 'A table', options: OPTIONS });
    await stranger.until('the door to be shut', () => stranger.rejected.length > 0);
    expect(stranger.rejected[0]).toBe('sign-in-first');
    expect(server.hall.codes()).toEqual([]);

    /* the same name cannot be taken twice, and a bad password opens nothing */
    await stranger.signUp();
    const twice = new Guest('nobody');
    guests.push(twice);
    await twice.open(server.port);
    twice.send({ t: 'signup', rid: 2, name: 'nobody', password: PASSWORD });
    await twice.until('the refusal', () => twice.rejected.length > 0);
    expect(twice.rejected.at(-1)).toBe('name-taken');
    twice.send({ t: 'signin', rid: 3, name: 'Nobody', password: 'not-the-password' });
    await twice.until('the second refusal', () => twice.rejected.length > 1);
    expect(twice.rejected.at(-1)).toBe('bad-credentials');
    expect(twice.id).toBe('');
  }, 30000);
});
