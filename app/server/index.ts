import { createServer } from 'node:http';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { decode, encode } from '@/online/protocol';
import { PING_COOLDOWN_MS, TELEGRAM_COOLDOWN_MS, isTelegramKey } from '@/game/telegrams';
import { LINKS, MERCHANT_BY_ID, TOWN_BY_ID } from '@/game/data';
import type { ClientMessage, ServerMessage } from '@/online/protocol';
import type { Me } from '@/online/table';
import { normalizeCode } from '@/online/table';
import { Hall, STALE_MS } from './hall';
import { DEFAULT_PACE } from './game';
import type { Pace } from './game';
import { letters, mailerFromEnv } from './mail';
import type { Mailer } from './mail';
import { Store } from './store';
import type { Account } from './store';

/* ------------------------------------------------------------------ */
/* The switchboard.                                                    */
/*                                                                     */
/* One socket per player, one frame per message, and no game logic at  */
/* all: it turns frames into calls on the hall, and every change the   */
/* hall announces into one frame per listener — each seat getting the  */
/* view it is entitled to. Reconnecting is just watching again.        */
/*                                                                     */
/* A socket is nobody until it signs in or presents a session token;   */
/* until then the only things it may say are who it claims to be, and  */
/* the two letters anyone may answer. The tables open to an account    */
/* once its address has answered its letter.                           */
/* ------------------------------------------------------------------ */

interface Client {
  socket: WebSocket;
  me: Me | null;
  /** the session token this socket presented, if any */
  token: string | null;
  /** the table codes this socket follows */
  watching: Set<string>;
  /** when this socket last wired a telegram, last pointed at the map */
  lastTelegram: number;
  lastMark: number;
}

export interface ServeOptions {
  port?: number;
  host?: string;
  pace?: Pace;
  /** the register file (':memory:' for a house that forgets) */
  file?: string;
  /** how often stale tables are swept (0 = never) */
  sweepEvery?: number;
  /** where the letters go (the console, unless the environment says Resend) */
  mailer?: Mailer;
  /** the address the letters' links point at */
  appUrl?: string;
  /** where ideas and bugs are posted (FEEDBACK_TO; nowhere when unset) */
  feedbackTo?: string;
  /** the book ideas and bugs are written in (FEEDBACK_FILE; feedback.md
   *  next to the register by default, none for a house that forgets) */
  feedbackFile?: string | null;
}

export interface Serving {
  readonly port: number;
  readonly hall: Hall;
  readonly store: Store;
  close(): Promise<void>;
}

/** one idea or bug as it is written in the book, the page and the post */
const noteText = (n: { name: string; page: string; kind: string; text: string; createdAt: number }): string =>
  [`## ${n.kind === 'bug' ? 'Bug' : 'Idea'} — ${n.name} · ${new Date(n.createdAt).toISOString().slice(0, 16).replace('T', ' ')} · ${n.page}`, '', n.text, ''].join('\n');

const me = (a: Account): Me => ({ id: a.id, name: a.name, email: a.email, verified: a.verified, motto: a.motto, favoriteColor: a.favoriteColor, createdAt: a.createdAt });

export function serve(options: ServeOptions = {}): Promise<Serving> {
  const store = new Store(options.file ?? 'brassworks.db');
  const hall = new Hall(store, options.pace ?? DEFAULT_PACE);
  const post = options.mailer ?? mailerFromEnv();
  const letter = letters(options.appUrl ?? process.env.APP_URL ?? 'http://localhost:5173');
  const feedbackTo = (options.feedbackTo ?? process.env.FEEDBACK_TO ?? '').trim();
  const file = options.file ?? 'brassworks.db';
  const feedbackFile = options.feedbackFile === undefined ? (process.env.FEEDBACK_FILE ?? (file === ':memory:' ? null : path.join(path.dirname(file), 'feedback.md'))) : options.feedbackFile;
  const clients = new Set<Client>();
  const http = createServer((req, res) => {
    /* the counter: with no real post, the letters can be read here */
    if (req.url === '/letters' && post.kept) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(post.kept.length ? post.kept.map((m) => `To: ${m.to}\nSubject: ${m.subject}\n\n${m.text}\n\n${'─'.repeat(60)}\n`).join('\n') : 'No letter yet.\n');
      return;
    }
    /* the suggestion box, as a page: every idea and bug, newest first */
    if (req.url === '/feedback') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      const notes = store.feedbackList();
      res.end(notes.length ? notes.map((n) => noteText(n)).join('\n') : 'No idea yet.\n');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('brassworks\n');
  });
  const wss = new WebSocketServer({ server: http });

  const send = (c: Client, m: ServerMessage) => {
    if (c.socket.readyState === 1) c.socket.send(encode(m));
  };
  const watchers = (code: string) => [...clients].filter((c) => c.watching.has(code));
  const socketsOf = (accountId: string) => [...clients].filter((c) => c.me?.id === accountId);

  const pushTable = (c: Client, code: string) => send(c, { t: 'table', code, table: hall.table(code) });
  const pushGame = (c: Client, code: string) => {
    const game = hall.game(code);
    if (game && c.me) send(c, { t: 'game', view: game.view(c.me.id) });
  };
  const pushDesk = (c: Client, rid?: number) => {
    if (!c.me) return;
    const desk = hall.desk(c.me.id);
    /* a friend is online when a socket of theirs is open */
    desk.friends = desk.friends.map((f) => ({ ...f, online: socketsOf(f.account.id).length > 0 }));
    send(c, { t: 'desk', rid, desk });
  };
  /** this account came or went: its friends' desks show it */
  const tellFriends = (accountId: string) => {
    for (const id of hall.friendsToTell(accountId)) for (const c of socketsOf(id)) pushDesk(c);
  };
  /** the account changed: every socket it holds hears the new `me` */
  const pushMe = (accountId: string, rid?: number, to?: Client) => {
    const account = store.account(accountId);
    if (!account) return;
    for (const c of socketsOf(accountId)) {
      c.me = me(account);
      send(c, { t: 'me', rid: c === to ? rid : undefined, me: c.me });
    }
  };

  hall.onChange((code, what) => {
    for (const c of watchers(code)) {
      if (what === 'table') pushTable(c, code);
      else pushGame(c, code);
    }
  });
  hall.onDesk((accountId) => {
    for (const c of socketsOf(accountId)) pushDesk(c);
  });

  /** a letter on its way — a post that fails is logged, never thrown at the client */
  const mail = (kind: 'verify' | 'reset', account: Account) => {
    if (!account.email) return;
    const token = store.writeLetter(account.id, kind);
    const m = kind === 'verify' ? letter.verify(account.email, account.name, token) : letter.reset(account.email, account.name, token);
    post.send(m).catch((e: unknown) => console.error(`mail to ${account.email} failed:`, (e as Error).message));
  };

  wss.on('connection', (socket: WebSocket) => {
    const client: Client = { socket, me: null, token: null, watching: new Set(), lastTelegram: 0, lastMark: 0 };
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
    const gone = () => {
      clients.delete(client);
      if (client.me) tellFriends(client.me.id);
    };
    socket.on('close', gone);
    socket.on('error', gone);
  });

  function handle(c: Client, m: ClientMessage): void {
    switch (m.t) {
      case 'ping':
        send(c, { t: 'pong' });
        return;
      case 'signup': {
        const made = store.signUp(m.name, m.email, m.password);
        if ('error' in made) {
          send(c, { t: 'refused', rid: m.rid, error: made.error });
          return;
        }
        mail('verify', made.account);
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
        c.me = me(account);
        c.token = m.token;
        send(c, { t: 'welcome', rid: m.rid, me: c.me });
        tellFriends(account.id);
        return;
      }
      case 'signout': {
        if (c.token) store.closeSession(c.token);
        c.token = null;
        c.me = null;
        c.watching.clear();
        return;
      }
      /* the two letters anyone may answer, signed in or not */
      case 'verify': {
        const account = store.verify(m.token);
        if (!account) {
          send(c, { t: 'refused', rid: m.rid, error: 'bad-token' });
          return;
        }
        /* answered from a fresh browser: it is signed in as a courtesy */
        if (!c.me) open(c, account, m.rid);
        else send(c, { t: 'done', rid: m.rid });
        pushMe(account.id);
        return;
      }
      case 'forgot': {
        const account = store.accountByEmail(m.email);
        /* an unknown address gets the same answer: the letter is the only tell */
        if (account) mail('reset', account);
        send(c, { t: 'done', rid: m.rid });
        return;
      }
      case 'reset': {
        const r = store.resetPassword(m.token, m.password);
        if (r === 'weak-password' || r === null) {
          send(c, { t: 'refused', rid: m.rid, error: r ?? 'bad-token' });
          return;
        }
        open(c, r, m.rid);
        return;
      }
    }
    const who = c.me;
    if (!who) {
      send(c, { t: 'refused', rid: 'rid' in m ? m.rid : undefined, error: 'sign-in-first' });
      return;
    }
    switch (m.t) {
      case 'resend': {
        if (m.email !== undefined) {
          const error = store.setEmail(who.id, m.email);
          if (error) {
            send(c, { t: 'refused', rid: m.rid, error });
            return;
          }
        }
        const account = store.account(who.id);
        if (account && !account.verified) mail('verify', account);
        send(c, { t: 'done', rid: m.rid });
        pushMe(who.id);
        return;
      }
      case 'profile': {
        store.setProfile(who.id, { motto: m.motto, favoriteColor: m.favoriteColor });
        pushMe(who.id, m.rid, c);
        return;
      }
      case 'password': {
        const error = store.changePassword(who.id, m.current, m.next);
        if (error) {
          send(c, { t: 'refused', rid: m.rid, error });
          return;
        }
        /* every session was closed with the old password: this one is opened again */
        c.token = store.openSession(who.id);
        send(c, { t: 'session', rid: m.rid, token: c.token, me: who });
        return;
      }
      case 'desk':
        pushDesk(c, m.rid);
        return;
      case 'friend': {
        hall.befriend(who, m.name);
        send(c, { t: 'done', rid: m.rid });
        return;
      }
      case 'unfriend': {
        hall.unfriend(who, m.id);
        send(c, { t: 'done', rid: m.rid });
        return;
      }
      case 'feedback': {
        if (!m.text.trim()) {
          send(c, { t: 'refused', rid: m.rid, error: 'refused' });
          return;
        }
        const note = store.feedback(who.id, m.page, m.kind, m.text);
        console.log(`feedback (${note.kind}) from ${who.name} on ${note.page}: ${note.text.slice(0, 200)}`);
        send(c, { t: 'done', rid: m.rid });
        /* the book and the post follow; neither holds the player up */
        const text = noteText({ ...note, name: who.name });
        if (feedbackFile) void appendFile(feedbackFile, text + '\n').catch((e) => console.error(`feedback book: ${e}`));
        if (feedbackTo) void post.send({ to: feedbackTo, subject: `Brassworks — ${note.kind === 'bug' ? 'a bug' : 'an idea'} from ${who.name}`, text }).catch((e) => console.error(`feedback post: ${e}`));
        return;
      }
    }
    /* from here on, the tables: an address must have answered its letter */
    if (!who.verified) {
      send(c, { t: 'refused', rid: 'rid' in m ? m.rid : undefined, error: 'verify-first' });
      return;
    }
    switch (m.t) {
      case 'create': {
        const table = hall.create(who, m.name, m.options, m.color);
        c.watching.add(table.code);
        send(c, { t: 'seated', rid: m.rid, table });
        return;
      }
      case 'join': {
        const code = normalizeCode(m.code);
        const table = hall.join(code, who, m.color);
        c.watching.add(code);
        send(c, { t: 'seated', rid: m.rid, table });
        pushGame(c, code);
        return;
      }
      case 'invite': {
        hall.invite(normalizeCode(m.code), who, m.name);
        send(c, { t: 'done', rid: m.rid });
        return;
      }
      case 'answer': {
        const table = hall.answer(m.id, who, m.accept);
        if (table) {
          c.watching.add(table.code);
          send(c, { t: 'seated', rid: m.rid, table });
        } else send(c, { t: 'done', rid: m.rid });
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
        hall.leave(code, who.id);
        return;
      }
      case 'table': {
        const { error } = hall.rewrite(m.code, who.id, m.table);
        /* refused: the client's optimistic copy is wrong — hand back the truth */
        if (error) pushTable(c, m.code);
        return;
      }
      case 'act': {
        const error = hall.act(m.code, who.id, m.action);
        /* put the board right first, then say why: the reason must land
           after the state, or the state's arrival would wipe it away */
        if (error) {
          pushGame(c, m.code);
          send(c, { t: 'rejected', code: m.code, error });
        }
        return;
      }
      case 'undo': {
        const error = hall.undo(m.code, who.id);
        if (error) {
          pushGame(c, m.code);
          send(c, { t: 'rejected', code: m.code, error });
        }
        return;
      }
      case 'pause': {
        const error = hall.pause(m.code, who.id, m.want);
        if (error) send(c, { t: 'rejected', code: m.code, error });
        return;
      }
      case 'break': {
        const error = hall.takeBreak(m.code, who.id, m.on);
        if (error) send(c, { t: 'rejected', code: m.code, error });
        return;
      }
      case 'rollback': {
        const error = hall.rollback(m.code, who.id, m.want, m.to);
        if (error) send(c, { t: 'rejected', code: m.code, error });
        return;
      }
      case 'telegram': {
        /* a printed line only, from a seat at the table, not too often */
        const table = hall.table(m.code);
        const from = table?.seats.findIndex((s) => s.id === who.id) ?? -1;
        if (from < 0 || !isTelegramKey(m.key)) return;
        const now = Date.now();
        if (now - c.lastTelegram < TELEGRAM_COOLDOWN_MS - 500) return;
        c.lastTelegram = now;
        for (const w of watchers(m.code)) send(w, { t: 'telegram', code: m.code, from, key: m.key, at: now });
        return;
      }
      case 'mark': {
        /* a place on the board only, from a seat at the table, not too often */
        const table = hall.table(m.code);
        const from = table?.seats.findIndex((s) => s.id === who.id) ?? -1;
        const known = typeof m.key === 'string' && (!!TOWN_BY_ID[m.key] || !!MERCHANT_BY_ID[m.key] || LINKS.some((l) => l.id === m.key));
        if (from < 0 || !known) return;
        const now = Date.now();
        if (now - c.lastMark < PING_COOLDOWN_MS - 500) return;
        c.lastMark = now;
        for (const w of watchers(m.code)) send(w, { t: 'mark', code: m.code, from, key: m.key, at: now });
        return;
      }
    }
  }

  /** signed in: a fresh token, and the socket speaks for the account */
  function open(c: Client, account: Account, rid: number): void {
    c.me = me(account);
    c.token = store.openSession(account.id);
    send(c, { t: 'session', rid, token: c.token, me: c.me });
    tellFriends(account.id);
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
