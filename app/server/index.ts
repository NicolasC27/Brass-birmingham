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

/* ------------------------------------------------------------------ */
/* The switchboard.                                                    */
/*                                                                     */
/* One socket per player, one frame per message, and no game logic at  */
/* all: it turns frames into calls on the hall, and every change the   */
/* hall announces into one frame per listener — each seat getting the  */
/* view it is entitled to. Reconnecting is just watching again.        */
/* ------------------------------------------------------------------ */

interface Client {
  socket: WebSocket;
  me: Identity;
  /** the table codes this socket follows */
  watching: Set<string>;
}

export interface ServeOptions {
  port?: number;
  host?: string;
  pace?: Pace;
  /** how often stale tables are swept (0 = never) */
  sweepEvery?: number;
}

export interface Serving {
  readonly port: number;
  readonly hall: Hall;
  close(): Promise<void>;
}

export function serve(options: ServeOptions = {}): Promise<Serving> {
  const hall = new Hall(options.pace ?? DEFAULT_PACE);
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
    if (game) send(c, { t: 'game', view: game.view(c.me.id) });
  };

  hall.onChange((code, what) => {
    for (const c of watchers(code)) {
      if (what === 'table') pushTable(c, code);
      else pushGame(c, code);
    }
  });

  wss.on('connection', (socket: WebSocket) => {
    const client: Client = { socket, me: { id: '', name: '' }, watching: new Set() };
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
      case 'hello':
        c.me = { id: m.id, name: m.name };
        send(c, { t: 'welcome', id: m.id });
        return;
      case 'ping':
        send(c, { t: 'pong' });
        return;
    }
    if (!c.me.id) {
      send(c, { t: 'refused', rid: 'rid' in m ? m.rid : undefined, error: 'Say hello first' });
      return;
    }
    switch (m.t) {
      case 'create': {
        const table = hall.create(c.me, m.name, m.options, m.color);
        c.watching.add(table.code);
        send(c, { t: 'seated', rid: m.rid, table });
        return;
      }
      case 'join': {
        const code = normalizeCode(m.code);
        const table = hall.join(code, c.me, m.color);
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
        hall.leave(code, c.me.id);
        return;
      }
      case 'table': {
        const { error } = hall.rewrite(m.code, c.me.id, m.table);
        /* refused: the client's optimistic copy is wrong — hand back the truth */
        if (error) pushTable(c, m.code);
        return;
      }
      case 'act': {
        const error = hall.act(m.code, c.me.id, m.action);
        if (error) {
          send(c, { t: 'rejected', code: m.code, error });
          pushGame(c, m.code);
        }
        return;
      }
      case 'undo': {
        const error = hall.undo(m.code, c.me.id);
        if (error) {
          send(c, { t: 'rejected', code: m.code, error });
          pushGame(c, m.code);
        }
        return;
      }
    }
  }

  const every = options.sweepEvery ?? 15 * 60 * 1000;
  const janitor = every > 0 ? setInterval(() => hall.sweep(STALE_MS), every) : null;

  return new Promise((resolve) => {
    http.listen(options.port ?? 8787, options.host ?? '0.0.0.0', () => {
      const address = http.address();
      resolve({
        port: typeof address === 'object' && address ? address.port : (options.port ?? 8787),
        hall,
        close: () =>
          new Promise<void>((done) => {
            if (janitor) clearInterval(janitor);
            for (const code of hall.codes()) hall.close(code);
            for (const c of clients) c.socket.terminate();
            wss.close(() => http.close(() => done()));
          }),
      });
    });
  });
}
