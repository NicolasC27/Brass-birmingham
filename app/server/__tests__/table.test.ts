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
import type { Serving } from '../index';

/* ------------------------------------------------------------------ */
/* A whole table played over the wire: two humans, two bots, a real    */
/* socket each. The humans decide from the state the server sends them */
/* and nothing else — proof that a filtered view is enough to play —   */
/* and at the end the server's log must replay to the very same game.  */
/* ------------------------------------------------------------------ */

const OPTIONS = { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' } as const;

/** a player at the far end of a socket: the last table and view it was sent */
class Guest {
  readonly id: string;
  readonly name: string;
  private socket!: WebSocket;
  table: Table | null = null;
  view: GameView | null = null;
  rejected: string[] = [];
  /** every view ever received — the secrecy audit reads them all */
  seen: GameView[] = [];

  constructor(id: string, name: string) {
    this.id = id;
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
      if (m.t === 'table') this.table = m.table;
      if (m.t === 'seated') this.table = m.table;
      if (m.t === 'game') {
        this.view = m.view;
        this.seen.push(m.view);
      }
      if (m.t === 'rejected' || m.t === 'refused') this.rejected.push(m.error);
    });
    this.send({ t: 'hello', id: this.id, name: this.name });
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

  afterEach(async () => {
    for (const g of guests) g.close();
    guests.length = 0;
    await server?.close();
    server = null;
  });

  it('seats two players and two bots, plays the game out and replays its log', async () => {
    server = await serve({ port: 0, pace: { bot: 0, ceremony: 0 }, sweepEvery: 0 });
    const host = new Guest('p-host', 'Ada');
    const guest = new Guest('p-guest', 'Bob');
    guests.push(host, guest);
    await host.open(server.port);
    await guest.open(server.port);

    /* the host opens a table, the guest answers the code */
    host.send({ t: 'create', rid: 1, name: 'The Works', options: OPTIONS });
    await host.until('the table', () => !!host.table);
    const code = host.table!.code;
    guest.send({ t: 'join', rid: 2, code });
    await guest.until('a chair', () => !!guest.table);
    await host.until('the guest', () => host.table!.seats.length === 2);

    /* each human stamps their own chair — a host cannot do it for a guest */
    guest.send({ t: 'table', code, table: { ...guest.table!, seats: guest.table!.seats.map((s) => (s.id === guest.id ? { ...s, ready: true } : s)) } });
    await host.until('the guest to be ready', () => host.table!.seats.every((s) => s.kind === 'bot' || s.ready || s.id === host.id));

    /* two mechanical players fill the table */
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

    /* the bell */
    host.send({ t: 'table', code, table: { ...host.table!, status: 'starting' } });
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

    const truth = server.hall.game(code)!;
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

  it('turns down an action taken out of turn', async () => {
    server = await serve({ port: 0, pace: { bot: 60000, ceremony: 60000 }, sweepEvery: 0 });
    const host = new Guest('p-host', 'Ada');
    const guest = new Guest('p-guest', 'Bob');
    guests.push(host, guest);
    await host.open(server.port);
    await guest.open(server.port);
    host.send({ t: 'create', rid: 1, name: 'The Works', options: OPTIONS });
    await host.until('the table', () => !!host.table);
    const code = host.table!.code;
    guest.send({ t: 'join', rid: 2, code });
    await guest.until('a chair', () => !!guest.table);
    await host.until('the guest', () => host.table!.seats.length === 2);
    guest.send({ t: 'table', code, table: { ...guest.table!, seats: guest.table!.seats.map((s) => (s.id === guest.id ? { ...s, ready: true } : s)) } });
    await host.until('the guest to be ready', () => host.table!.seats.some((s) => s.id === guest.id && s.ready));
    host.send({ t: 'table', code, table: { ...host.table!, seats: host.table!.seats.map((s) => (s.id === host.id ? { ...s, ready: true } : s)), status: 'starting' } });
    await host.until('the game', () => !!host.view);
    await guest.until('the game', () => !!guest.view);

    const idle = [host, guest].find((g) => g.view!.state.current !== g.view!.seat)!;
    idle.send({ t: 'act', code, action: decide({ ...idle.view!, seat: idle.view!.state.current }) });
    await idle.until('the refusal', () => idle.rejected.length > 0);
    expect(idle.rejected[0]).toBe('Not your turn');
    expect(server.hall.game(code)!.state.actions.length).toBe(0);
  }, 30000);
});
