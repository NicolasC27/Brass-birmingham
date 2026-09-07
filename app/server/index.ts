import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { decode, encode } from '@/online/protocol';
import type { ClientMessage, ServerMessage } from '@/online/protocol';
import type { Identity } from '@/online/table';
import { normalizeCode } from '@/online/table';
import { Hall, STALE_MS } from './hall';
import { DEFAULT_PACE } from './game';
import type { Pace } from './game';
import { Store } from './store';

/* ------------------------------------------------------------------ */
/* The switchboard.                                                    */
/*                                                                     */
/* One socket per player, one frame per message, and no game logic at  */
/* all: it turns frames into calls on the hall, and every change the   */
/* hall announces into one frame per listener — each seat getting the  */
/* view it is entitled to. Reconnecting is just watching again.        */
/*                                                                     */
/* A socket is nobody until it signs in or presents a session token;   */
/* until then the only thing it may say is who it claims to be.        */
/* ------------------------------------------------------------------ */

interface Client {
  socket: WebSocket;
  me: Identity | null;
  /** the session token this socket presented, if any */
  token: string | null;
  /** the table codes this socket follows */
  watching: Set<string>;
}

export interface ServeOptions {
  port?: number;
  host?: string;
  pace?: Pace;
  /** the register file (':memory:' for a house that forgets) */
  file?: string;
  /** how often stale tables are swept (0 = never) */
  sweepEvery?: number;
}

export interface Serving {
  readonly port: number;
  readonly hall: Hall;
  readonly store: Store;
  close(): Promise<void>;
}

export function serve(options: ServeOptions = {}): Promise<Serving> {
  const store = new Store(options.file ?? 'brassworks.db');
  const hall = new Hall(store, options.pace ?? DEFAULT_PACE);
  const clients = new Set<Client>();
  const http = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('brassworks\n');
  });
  const wss = new WebSocketServer({ server: http });

  const send = (c: Client, m: ServerMessage) => {
    if (c.socket.readyState === 1) c.socket.send(encode(m));
  };
  const watchers = (code: string) => [...clients].filter((c) => c.watching.has(code));

  const pushTable = (c: Client, code: string) => send(c, { t: 'table', code, table: hall.table(code) });
  const pushGame = (c: Client, code: string) => {
    const game = hall.game(code);
    if (game && c.me) send(c, { t: 'game', view: game.view(c.me.id) });
  };

  hall.onChange((code, what) => {
    for (const c of watchers(code)) {
      if (what === 'table') pushTable(c, code);
      else pushGame(c, code);
    }
  });

  wss.on('connection', (socket: WebSocket) => {
    const client: Client = { socket, me: null, token: null, watching: new Set() };
    clients.add(client);
    socket.on('message', (raw: Buffer | string) => {
      const m = decode<ClientMessage>(String(raw));
      if (!m) return;
      try {
        handle(client, m);
      } catch (e) {
        send(client, { t: 'refused', rid: 'rid' in m ? m.rid : undefined, error: (e as Error).message });
      }
    });
    socket.on('close', () => clients.delete(client));
    socket.on('error', () => clients.delete(client));
  });

  function handle(c: Client, m: ClientMessage): void {
    switch (m.t) {
      case 'ping':
        send(c, { t: 'pong' });
        return;
      case 'signup': {
        const made = store.signUp(m.name, m.password);
        if ('error' in made) {
          send(c, { t: 'refused', rid: m.rid, error: made.error });
          return;
        }
        open(c, made.account, m.rid);
        return;
      }
      case 'signin': {
        const account = store.signIn(m.name, m.password);
        if (!account) {
          send(c, { t: 'refused', rid: m.rid, error: 'bad-credentials' });
          return;
        }
        open(c, account, m.rid);
        return;
      }
      case 'auth': {
        const account = store.session(m.token);
        if (!account) {
          send(c, { t: 'refused', rid: m.rid, error: 'no-session' });
          return;
        }
        c.me = { id: account.id, name: account.name };
        c.token = m.token;
        send(c, { t: 'welcome', rid: m.rid, me: c.me });
        return;
      }
      case 'signout': {
        if (c.token) store.closeSession(c.token);
        c.token = null;
        c.me = null;
        c.watching.clear();
        return;
      }
    }
    const me = c.me;
    if (!me) {
      send(c, { t: 'refused', rid: 'rid' in m ? m.rid : undefined, error: 'sign-in-first' });
      return;
    }
    switch (m.t) {
      case 'create': {
        const table = hall.create(me, m.name, m.options, m.color);
        c.watching.add(table.code);
        send(c, { t: 'seated', rid: m.rid, table });
        return;
      }
      case 'join': {
        const code = normalizeCode(m.code);
        const table = hall.join(code, me, m.color);
        c.watching.add(code);
        send(c, { t: 'seated', rid: m.rid, table });
        pushGame(c, code);
        return;
      }
      case 'watch': {
        const code = normalizeCode(m.code);
        c.watching.add(code);
        pushTable(c, code);
        pushGame(c, code);
        return;
      }
      case 'leave': {
        const code = normalizeCode(m.code);
        c.watching.delete(code);
        hall.leave(code, me.id);
        return;
      }
      case 'table': {
        const { error } = hall.rewrite(m.code, me.id, m.table);
        /* refused: the client's optimistic copy is wrong — hand back the truth */
        if (error) pushTable(c, m.code);
        return;
      }
      case 'act': {
        const error = hall.act(m.code, me.id, m.action);
        /* put the board right first, then say why: the reason must land
           after the state, or the state's arrival would wipe it away */
        if (error) {
          pushGame(c, m.code);
          send(c, { t: 'rejected', code: m.code, error });
        }
        return;
      }
      case 'undo': {
        const error = hall.undo(m.code, me.id);
        if (error) {
          pushGame(c, m.code);
          send(c, { t: 'rejected', code: m.code, error });
        }
        return;
      }
    }
  }

  /** signed in: a fresh token, and the socket speaks for the account */
  function open(c: Client, account: { id: string; name: string }, rid: number): void {
    c.me = { id: account.id, name: account.name };
    c.token = store.openSession(account.id);
    send(c, { t: 'session', rid, token: c.token, me: c.me });
  }

  const every = options.sweepEvery ?? 15 * 60 * 1000;
  const janitor = every > 0 ? setInterval(() => hall.sweep(STALE_MS), every) : null;

  return new Promise((resolve) => {
    http.listen(options.port ?? 8787, options.host ?? '0.0.0.0', () => {
      const address = http.address();
      resolve({
        port: typeof address === 'object' && address ? address.port : (options.port ?? 8787),
        hall,
        store,
        close: () =>
          new Promise<void>((done) => {
            if (janitor) clearInterval(janitor);
            hall.dispose();
            for (const c of clients) c.socket.terminate();
            wss.close(() =>
              http.close(() => {
                store.close();
                done();
              }),
            );
          }),
      });
    });
  });
}
