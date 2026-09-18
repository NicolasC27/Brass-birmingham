import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { decode, encode } from '@/online/protocol';
import { PING_SHOWER, PING_WINDOW_MS, TELEGRAM_COOLDOWN_MS, isTelegramKey } from '@/game/telegrams';
import { LINKS, MERCHANT_BY_ID, TOWN_BY_ID } from '@/game/data';
import type { ClientMessage, ServerMessage } from '@/online/protocol';
import type { Me } from '@/online/table';
import { normalizeCode } from '@/online/table';
import { Hall, STALE_MS } from './hall';
import { DEFAULT_PACE } from './game';
import type { Pace } from './game';
import type { Waits } from './queue';
import { letters, mailerFromEnv } from './mail';
import type { Mailer } from './mail';
import { Store } from './store';
import { BODY_MAX, BODY_MIN, MODS_OPEN, POSTS_PER_HOUR, POST_COOLDOWN_MS, REPORT_MAX, THREAD_COOLDOWN_MS, TITLE_MAX, TITLE_MIN, isBoard, isLang, isModAction, isReason } from '@/forum/types';
import { claudeTranslator, costOf } from './translate';
import type { Translator } from './translate';
import type { BoardKey, ForumError, Lang } from '@/forum/types';
import { offends } from '@/forum/words';
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
  /** where the socket comes from, for the counters kept per address */
  ip: string;
  me: Me | null;
  /** the session token this socket presented, if any */
  token: string | null;
  /** the table codes this socket follows */
  watching: Set<string>;
  /** when this socket last asked for the register of tables (0: never) */
  askedTables: number;
  /** the last round trip measured on this socket, in ms */
  latency: number | null;
  pingAt: number;
  /** when the register was last sent, and the push waiting to go */
  tablesAt: number;
  tablesTimer: ReturnType<typeof setTimeout> | null;
  /** how much this socket may still say, and how often it has been told no */
  words: Bucket;
  claims: Bucket;
  refused: number;
}

/* ------------------------- how much may be said ------------------------ */

/** a bucket of tokens: one per message, refilled at a steady rate */
interface Bucket {
  tokens: number;
  at: number;
}
const bucket = (size: number): Bucket => ({ tokens: size, at: Date.now() });
/** take one, or say there was none */
function drip(b: Bucket, size: number, perSecond: number): boolean {
  const now = Date.now();
  b.tokens = Math.min(size, b.tokens + ((now - b.at) / 1000) * perSecond);
  b.at = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}
/** thirty frames at once, then six a second */
const WORDS = { size: 30, perSecond: 6 };
/** the verbs that cost a key derivation or a letter: five a minute a socket, twenty an address */
const CLAIMS = { size: 5, perSecond: 5 / 60 };
const CLAIMS_PER_IP = { size: 20, perSecond: 20 / 60 };
const isClaim = (t: ClientMessage['t']): boolean => t === 'signin' || t === 'signup' || t === 'forgot' || t === 'reset' || t === 'resend';
/** after this many refusals the socket is simply closed */
const PATIENCE = 60;
/** ideas and bugs: five an hour an account */
const NOTES_PER_HOUR = 5;
/** the register of tables keeps coming to whoever asked for it this recently */
const REGISTER_FOLLOW_MS = 2 * 60 * 1000;
/** and never more than once a second a socket */
const REGISTER_PUSH_MS = 1000;
/** how often the office looks down the queues */
const QUEUE_EVERY_MS = 5000;

/** the counter's own reading of the letters and the box: only from this machine */
const loopback = (req: IncomingMessage): boolean => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');
const sameToken = (a: string, b: string): boolean => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/* ----------------------- the office, per account ---------------------- */

/** what the office remembers of an account across its sockets: when it
 *  last wired a telegram, the marks of the last while, and the strikes —
 *  a strike is a warning, the second silence; a new tab is no clean slate */
interface Office {
  lastTelegram: number;
  marks: number[];
  strikes: number;
  seenAt: number;
}
const offices = new Map<string, Office>();
const OFFICE_IDLE_MS = 60 * 60 * 1000;
function officeOf(accountId: string): Office {
  const now = Date.now();
  for (const [id, o] of offices) if (now - o.seenAt > OFFICE_IDLE_MS) offices.delete(id);
  let o = offices.get(accountId);
  if (!o) offices.set(accountId, (o = { lastTelegram: 0, marks: [], strikes: 0, seenAt: now }));
  o.seenAt = now;
  return o;
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
  /** the members who keep the forum, by name (BLACKRAIL_MODERATORS, comma-separated) */
  moderators?: string[];
  /** the forum's interpreter (Claude with ANTHROPIC_API_KEY by default; null for none) */
  translator?: Translator | null;
  /** dollars the interpreter may spend, all time (TRANSLATE_BUDGET_USD, 10 by default) */
  translateBudget?: number;
  /** the clock the queues wait by, and how long they wait — for the tests */
  clock?: () => number;
  waits?: Partial<Waits>;
  /** how often the queues are looked down (0 = only on a join) */
  queueEvery?: number;
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

/** a name as the register folds it, to know a moderator by it */
const foldName = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, ' ');
/** a post's text as it is kept: unix lines, no control characters, trimmed */
const tidy = (s: unknown, oneLine = false): string => {
  const text = String(s ?? '')
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .trim();
  return oneLine ? text.replace(/\s*\n\s*/g, ' ') : text;
};
/** why a text may not go up on the forum, or null */
const wording = (text: string, min: number, max: number): ForumError | null => (text.length < min ? 'forum-too-short' : text.length > max ? 'forum-too-long' : offends(text) ? 'forum-words' : null);

export function serve(options: ServeOptions = {}): Promise<Serving> {
  const store = new Store(options.file ?? 'brassworks.db');
  const hall = new Hall(store, options.pace ?? DEFAULT_PACE, { now: options.clock, waits: options.waits });
  const post = options.mailer ?? mailerFromEnv();
  const letter = letters(options.appUrl ?? process.env.APP_URL ?? 'http://localhost:3000');
  const feedbackTo = (options.feedbackTo ?? process.env.FEEDBACK_TO ?? '').trim();
  const file = options.file ?? 'brassworks.db';
  const feedbackFile = options.feedbackFile === undefined ? (process.env.FEEDBACK_FILE ?? (file === ':memory:' ? null : path.join(path.dirname(file), 'feedback.md'))) : options.feedbackFile;
  const clients = new Set<Client>();
  const moderators = new Set((options.moderators ?? (process.env.BLACKRAIL_MODERATORS ?? '').split(',')).map(foldName).filter(Boolean));
  const isMod = (a: { name: string }): boolean => moderators.has(foldName(a.name));
  const translator = options.translator === undefined ? claudeTranslator() : options.translator;
  const translateBudget = options.translateBudget ?? Number(process.env.TRANSLATE_BUDGET_USD ?? 10);
  /** the interpreter works while the house has a key and the budget is not spent */
  const interpreting = (): boolean => !!translator && store.forumRenderingSpend() < translateBudget;
  /** renderings under way, so a page asking twice does not pay twice */
  const rendering = new Set<string>();
  /** render what a page lacks, in the background; the thread's readers are told when it is done */
  const renderLater = (board: BoardKey, thread: string, jobs: { subject: 'post' | 'thread'; id: string; text: string; from: Lang; to: Lang }[]) => {
    const t = translator;
    if (!t) return;
    const mine = jobs.filter((j) => !rendering.has(`${j.subject}:${j.id}:${j.to}`));
    for (const j of mine) rendering.add(`${j.subject}:${j.id}:${j.to}`);
    if (!mine.length) return;
    void (async () => {
      /* four at a time: a long thread on first reading is not a storm */
      const queue = [...mine];
      const worker = async () => {
        for (let j = queue.shift(); j; j = queue.shift()) {
          try {
            if (!interpreting()) break;
            const r = await t.translate(j.text, j.from, j.to);
            store.forumKeepRendering(j.subject, j.id, j.to, r.text, t.model, r.tokensIn, r.tokensOut, costOf(t.model, r.tokensIn, r.tokensOut));
          } catch (e) {
            console.error(`interpreter: ${j.subject} ${j.id} to ${j.to}: ${e instanceof Error ? e.message : e}`);
          } finally {
            rendering.delete(`${j.subject}:${j.id}:${j.to}`);
          }
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      tellForum(board, thread);
    })();
  };
  const me = (a: Account): Me => ({ id: a.id, name: a.name, email: a.email, verified: a.verified, motto: a.motto, favoriteColor: a.favoriteColor, createdAt: a.createdAt, moderator: isMod(a) });
  /** something moved on the forum: every signed-in socket hears it, the pages that show it ask again */
  const tellForum = (board: BoardKey, thread: string | null) => {
    for (const k of clients) if (k.me) send(k, { t: 'forum', board, thread });
  };
  /** the claims made from each address of late */
  const claimsByIp = new Map<string, Bucket>();
  /* the counter's pages are for the developer's own machine: a house that
     forgets, or one told DEV_LETTERS=1, and only from this very machine */
  const dev = file === ':memory:' || process.env.DEV_LETTERS === '1';
  const feedbackToken = (process.env.FEEDBACK_TOKEN ?? '').trim();
  const http = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://blackrail');
    const own = dev && loopback(req);
    /* the counter: with no real post, the letters can be read here */
    if (url.pathname === '/letters') {
      if (!own || !post.kept) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('Not found\n');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(post.kept.length ? post.kept.map((m) => `To: ${m.to}\nSubject: ${m.subject}\n\n${m.text}\n\n${'─'.repeat(60)}\n`).join('\n') : 'No letter yet.\n');
      return;
    }
    /* the suggestion box, as a page: every idea and bug, newest first —
       from this machine, or with the token FEEDBACK_TOKEN names */
    if (url.pathname === '/feedback') {
      const shown = own || (feedbackToken !== '' && sameToken(url.searchParams.get('token') ?? '', feedbackToken));
      if (!shown) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('Not found\n');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      const notes = store.feedbackList();
      res.end(notes.length ? notes.map((n) => noteText(n)).join('\n') : 'No idea yet.\n');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('blackrail\n');
  });
  const wss = new WebSocketServer({ server: http, maxPayload: 64 * 1024 });

  const send = (c: Client, m: ServerMessage) => {
    if (c.socket.readyState === 1) c.socket.send(encode(m));
  };
  const watchers = (code: string) => [...clients].filter((c) => c.watching.has(code));
  const socketsOf = (accountId: string) => [...clients].filter((c) => c.me?.id === accountId);
  hall.presence({
    count: () => new Set([...clients].filter((c) => c.me).map((c) => c.me!.id)).size,
    has: (accountId) => socketsOf(accountId).length > 0,
    watchers: (code) => watchers(code).length,
  });

  const pushTable = (c: Client, code: string) => send(c, { t: 'table', code, table: hall.table(code) });
  /** the line of each seat at a table: the best of the account's sockets */
  const linesOf = (code: string): (number | null)[] | null => {
    const game = hall.game(code);
    if (!game || game.over) return null;
    return game.seatIds.map((id) => {
      if (id.startsWith('bot-')) return null;
      const mine = socketsOf(id).map((s) => s.latency).filter((l): l is number => l !== null);
      return mine.length ? Math.min(...mine) : null;
    });
  };
  /** the seats' lines, to one watcher or to all of them */
  const pulse = (code: string, only?: Client) => {
    const latency = linesOf(code);
    if (!latency) return;
    for (const w of only ? [only] : watchers(code)) send(w, { t: 'pulse', code, latency });
  };
  const pushGame = (c: Client, code: string) => {
    const game = hall.game(code);
    if (game && c.me) send(c, { t: 'game', view: game.view(c.me.id) });
  };
  const pushDesk = (c: Client, rid?: number) => {
    if (!c.me) return;
    const desk = hall.desk(c.me.id);
    /* a friend is online when a socket of theirs is open */
    desk.friends = desk.friends.map((f) => ({ ...f, online: socketsOf(f.account.id).length > 0, playing: hall.playingOf(f.account.id) }));
    send(c, { t: 'desk', rid, desk });
  };
  /** this account came or went: its friends' desks show it */
  const tellFriends = (accountId: string) => {
    for (const id of hall.friendsToTell(accountId)) for (const c of socketsOf(id)) pushDesk(c);
  };
  /** the register of tables, to a socket that asked for it of late — at
   *  most once a second, the changes in between folded into one push */
  const pushTables = (c: Client) => {
    if (c.tablesTimer || Date.now() - c.askedTables > REGISTER_FOLLOW_MS) return;
    c.tablesTimer = setTimeout(
      () => {
        c.tablesTimer = null;
        c.tablesAt = Date.now();
        send(c, { t: 'tables', tables: hall.register() });
      },
      Math.max(0, REGISTER_PUSH_MS - (Date.now() - c.tablesAt)),
    );
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
    for (const c of clients) pushTables(c);
    /* the game is over: what the office held against its players is forgotten */
    const game = what === 'game' ? hall.game(code) : null;
    if (game?.over) for (const id of game.seatIds) offices.delete(id);
  });
  hall.onDesk((accountId) => {
    for (const c of socketsOf(accountId)) pushDesk(c);
  });
  hall.onQueue((accountId, state) => {
    for (const c of socketsOf(accountId)) send(c, { t: 'queue', state });
  });
  /* dealt from a queue: every socket of theirs sits down at the table */
  hall.onDealt((accountIds, table) => {
    for (const id of accountIds) {
      for (const c of socketsOf(id)) {
        c.watching.add(table.code);
        send(c, { t: 'seated', rid: 0, table });
      }
    }
  });

  /** a letter on its way — a post that fails is logged, never thrown at the client */
  const mail = (kind: 'verify' | 'reset', account: Account) => {
    if (!account.email) return;
    const token = store.writeLetter(account.id, kind);
    const m = kind === 'verify' ? letter.verify(account.email, account.name, token) : letter.reset(account.email, account.name, token);
    post.send(m).catch((e: unknown) => console.error(`mail to ${account.email} failed:`, (e as Error).message));
  };

  /** a claim from this address: its bucket, the stale ones swept on the way */
  const claimFrom = (ip: string): boolean => {
    const now = Date.now();
    for (const [at, b] of claimsByIp) if (now - b.at > 60_000) claimsByIp.delete(at);
    let b = claimsByIp.get(ip);
    if (!b) claimsByIp.set(ip, (b = bucket(CLAIMS_PER_IP.size)));
    return drip(b, CLAIMS_PER_IP.size, CLAIMS_PER_IP.perSecond);
  };

  wss.on('connection', (socket: WebSocket, req: IncomingMessage) => {
    const client: Client = { socket, ip: req.socket.remoteAddress ?? '', me: null, token: null, watching: new Set(), askedTables: 0, latency: null, pingAt: 0, tablesAt: 0, tablesTimer: null, words: bucket(WORDS.size), claims: bucket(CLAIMS.size), refused: 0 };
    clients.add(client);
    /* one frame after another, in the order they came, even across a wait */
    let queue: Promise<void> = Promise.resolve();
    socket.on('pong', () => {
      if (client.pingAt) client.latency = Date.now() - client.pingAt;
    });
    socket.on('message', (raw: Buffer | string) => {
      const m = decode<ClientMessage>(String(raw));
      if (!m) return;
      const rid = 'rid' in m ? m.rid : undefined;
      /* too much, too fast: the frame is dropped, and after a while the socket */
      const allowed = drip(client.words, WORDS.size, WORDS.perSecond) && (!isClaim(m.t) || (drip(client.claims, CLAIMS.size, CLAIMS.perSecond) && claimFrom(client.ip)));
      if (!allowed) {
        if (rid !== undefined) send(client, { t: 'refused', rid, error: 'refused' });
        if (++client.refused >= PATIENCE) socket.close(1008, 'too many messages');
        return;
      }
      queue = queue
        .then(() => handle(client, m))
        .catch((e: unknown) => send(client, { t: 'refused', rid, error: (e as Error).message }));
    });
    const gone = () => {
      clients.delete(client);
      if (client.tablesTimer) clearTimeout(client.tablesTimer);
      client.tablesTimer = null;
      if (client.me) tellFriends(client.me.id);
    };
    socket.on('close', gone);
    socket.on('error', gone);
  });

  /** the account's other sockets are shown the door (their sessions are gone);
   *  with `token`, only those that held that very session */
  function evict(accountId: string, except: Client, token?: string): void {
    for (const c of socketsOf(accountId)) {
      if (c === except || (token !== undefined && c.token !== token)) continue;
      c.me = null;
      c.token = null;
      c.watching.clear();
      c.socket.close(4001, 'signed out');
    }
  }

  async function handle(c: Client, m: ClientMessage): Promise<void> {
    switch (m.t) {
      case 'ping':
        send(c, { t: 'pong' });
        return;
      case 'signup': {
        const made = await store.signUpAsync(m.name, m.email, m.password);
        if ('error' in made) {
          send(c, { t: 'refused', rid: m.rid, error: made.error });
          return;
        }
        mail('verify', made.account);
        open(c, made.account, m.rid);
        return;
      }
      case 'signin': {
        const account = await store.signInAsync(m.name, m.password);
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
        /* the session is closed: any other tab that held it goes with it */
        if (c.token) store.closeSession(c.token);
        if (c.me && c.token) evict(c.me.id, c, c.token);
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
        evict(r.id, c);
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
        evict(who.id, c);
        c.token = store.openSession(who.id);
        send(c, { t: 'session', rid: m.rid, token: c.token, me: who });
        return;
      }
      case 'desk':
        pushDesk(c, m.rid);
        return;
      case 'tables':
        /* asked for once, the register keeps coming for a while */
        c.askedTables = Date.now();
        c.tablesAt = c.askedTables;
        send(c, { t: 'tables', rid: m.rid, tables: hall.register() });
        return;
      case 'leaderboard':
        send(c, { t: 'leaderboard', rid: m.rid, board: hall.leaderboard(who.id) });
        return;
      case 'queue':
        /* the queues are for verified accounts, and say nothing to the others */
        if (who.verified && (m.mode === 'quick' || m.mode === 'ranked')) hall.queue(who.id, m.mode, !!m.on);
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
        if (!m.text.trim() || store.feedbackSince(who.id, Date.now() - 60 * 60 * 1000) >= NOTES_PER_HOUR) {
          send(c, { t: 'refused', rid: m.rid, error: 'refused' });
          return;
        }
        const note = store.feedback(who.id, m.page, m.kind, m.text);
        console.log(`feedback (${note.kind}) from ${who.name} on ${note.page}: ${note.text.slice(0, 200)}`);
        send(c, { t: 'done', rid: m.rid });
        /* the book and the post follow; neither holds the player up */
        const text = noteText({ ...note, name: who.name });
        if (feedbackFile) void appendFile(feedbackFile, text + '\n').catch((e) => console.error(`feedback book: ${e}`));
        if (feedbackTo) void post.send({ to: feedbackTo, subject: `Blackrail — ${note.kind === 'bug' ? 'a bug' : 'an idea'} from ${who.name}`, text }).catch((e) => console.error(`feedback post: ${e}`));
        return;
      }
      /* ------------------------------ the forum ------------------------------ */
      case 'forum.boards':
        send(c, { t: 'forum.boards', rid: m.rid, boards: store.forumBoards(who.id) });
        return;
      case 'forum.threads': {
        if (!isBoard(m.board)) {
          send(c, { t: 'refused', rid: m.rid, error: 'forum-board' });
          return;
        }
        const r = store.forumThreads(m.board, Number(m.page) || 1, who.id, isMod(who));
        send(c, { t: 'forum.threads', rid: m.rid, board: m.board, page: r.page, pages: r.pages, threads: r.threads });
        return;
      }
      case 'forum.thread': {
        const view = store.forumThread(String(m.id), Number(m.page) || 0, who.id, isMod(who));
        if (!view) send(c, { t: 'refused', rid: m.rid, error: 'forum-not-found' });
        else send(c, { t: 'forum.thread', rid: m.rid, view });
        return;
      }
      case 'forum.open': {
        const title = tidy(m.title, true);
        const body = tidy(m.body);
        const pace = store.forumPace(who.id, Date.now() - 60 * 60 * 1000);
        const error: ForumError | null = !isBoard(m.board)
          ? 'forum-board'
          : !who.verified
            ? 'forum-verified'
            : MODS_OPEN.includes(m.board) && !isMod(who)
              ? 'forum-mods-only'
              : (wording(title, TITLE_MIN, TITLE_MAX) ?? wording(body, BODY_MIN, BODY_MAX)) ??
                (!isMod(who) && (Date.now() - pace.lastThreadAt < THREAD_COOLDOWN_MS || pace.posts >= POSTS_PER_HOUR) ? 'forum-cooldown' : null);
        if (error || !isBoard(m.board)) {
          send(c, { t: 'refused', rid: m.rid, error: error ?? 'forum-board' });
          return;
        }
        const id = store.forumOpen(who.id, m.board, title, body, isLang(m.lang) ? m.lang : 'en');
        console.log(`forum: ${who.name} opens "${title}" on ${m.board}`);
        send(c, { t: 'forum.opened', rid: m.rid, id });
        tellForum(m.board, id);
        return;
      }
      case 'forum.reply': {
        const body = tidy(m.body);
        const where = store.forumWhere(String(m.id));
        const pace = store.forumPace(who.id, Date.now() - 60 * 60 * 1000);
        const error: ForumError | null = !where || where.hidden
          ? 'forum-not-found'
          : !who.verified
            ? 'forum-verified'
            : where.locked && !isMod(who)
              ? 'forum-locked'
              : (wording(body, BODY_MIN, BODY_MAX) ?? (!isMod(who) && (Date.now() - pace.lastPostAt < POST_COOLDOWN_MS || pace.posts >= POSTS_PER_HOUR) ? 'forum-cooldown' : null));
        if (error || !where) {
          send(c, { t: 'refused', rid: m.rid, error: error ?? 'forum-not-found' });
          return;
        }
        /* a moderator may still answer on a locked thread: the lock is lifted for the reply alone */
        if (where.locked) store.forumMod(who.id, 'unlock', String(m.id));
        const r = store.forumReply(who.id, String(m.id), body, isLang(m.lang) ? m.lang : 'en');
        if (where.locked) store.forumMod(who.id, 'lock', String(m.id));
        if (typeof r === 'string') {
          send(c, { t: 'refused', rid: m.rid, error: r });
          return;
        }
        send(c, { t: 'forum.posted', rid: m.rid, post: r.post, page: r.page });
        tellForum(where.board, String(m.id));
        return;
      }
      case 'forum.edit': {
        const body = tidy(m.body);
        const post = store.forumPostWhere(String(m.post));
        const error = !post ? 'forum-not-found' : wording(body, BODY_MIN, BODY_MAX);
        if (error || !post) {
          send(c, { t: 'refused', rid: m.rid, error: error ?? 'forum-not-found' });
          return;
        }
        const r = store.forumEdit(who.id, String(m.post), body, isMod(who), isLang(m.lang) ? m.lang : undefined);
        if (r) send(c, { t: 'refused', rid: m.rid, error: r });
        else {
          send(c, { t: 'done', rid: m.rid });
          tellForum(post.board, post.threadId);
        }
        return;
      }
      case 'forum.report': {
        const text = tidy(m.text, true).slice(0, REPORT_MAX);
        if (!isReason(m.reason) || offends(text)) {
          send(c, { t: 'refused', rid: m.rid, error: 'forum-words' });
          return;
        }
        const r = store.forumReport(who.id, String(m.post), m.reason, text);
        if (r) send(c, { t: 'refused', rid: m.rid, error: r });
        else {
          console.log(`forum: ${who.name} reports post ${String(m.post)} (${m.reason})`);
          send(c, { t: 'done', rid: m.rid });
          /* the moderators' queue is a page too: it asks again */
          const post = store.forumPostWhere(String(m.post));
          if (post) for (const k of clients) if (k.me && isMod(k.me)) send(k, { t: 'forum', board: post.board, thread: post.threadId });
        }
        return;
      }
      case 'forum.mod': {
        if (!isMod(who)) {
          send(c, { t: 'refused', rid: m.rid, error: 'forum-not-mod' });
          return;
        }
        if (!isModAction(m.action)) {
          send(c, { t: 'refused', rid: m.rid, error: 'forum-not-found' });
          return;
        }
        const id = String(m.id);
        const post = m.action === 'hide' || m.action === 'unhide' ? store.forumPostWhere(id) : null;
        const thread = post ? post.threadId : m.action === 'resolve' ? null : id;
        const r = store.forumMod(who.id, m.action, id);
        if (r) {
          send(c, { t: 'refused', rid: m.rid, error: r });
          return;
        }
        console.log(`forum: ${who.name} ${m.action} ${id}`);
        send(c, { t: 'done', rid: m.rid });
        const where = thread ? store.forumWhere(thread) : null;
        if (where && thread) tellForum(where.board, thread);
        else for (const k of clients) if (k.me && isMod(k.me)) send(k, { t: 'forum', board: 'atelier', thread: null });
        return;
      }
      case 'forum.reports': {
        if (!isMod(who)) {
          send(c, { t: 'refused', rid: m.rid, error: 'forum-not-mod' });
          return;
        }
        send(c, { t: 'forum.reports', rid: m.rid, reports: store.forumReports(), translation: { spent: store.forumRenderingSpend(), budget: translateBudget, on: !!translator } });
        return;
      }
      case 'forum.translate': {
        const view = store.forumThread(String(m.id), Number(m.page) || 0, who.id, isMod(who));
        if (!view || !isLang(m.lang)) {
          send(c, { t: 'refused', rid: m.rid, error: 'forum-not-found' });
          return;
        }
        const to = m.lang;
        const jobs: { subject: 'post' | 'thread'; id: string; text: string; from: Lang; to: Lang }[] = [];
        let title: string | null = null;
        if (view.thread.lang !== to) {
          title = store.forumRendering('thread', view.thread.id, to);
          if (title === null) jobs.push({ subject: 'thread', id: view.thread.id, text: view.thread.title, from: view.thread.lang, to });
        }
        const posts: Record<string, string> = {};
        for (const p of view.posts) {
          if (p.lang === to || p.hidden || !p.body) continue;
          const kept = store.forumRendering('post', p.id, to);
          if (kept !== null) posts[p.id] = kept;
          else jobs.push({ subject: 'post', id: p.id, text: p.body, from: p.lang, to });
        }
        const on = interpreting();
        send(c, { t: 'forum.translated', rid: m.rid, id: view.thread.id, page: view.page, lang: to, rendered: { title, posts, pending: on ? jobs.length : 0, on } });
        if (on && jobs.length) renderLater(view.thread.board, view.thread.id, jobs);
        return;
      }
      case 'forum.seen':
        if (store.forumWhere(String(m.id))) store.forumSeen(who.id, String(m.id));
        return;
    }
    /* from here on, the tables: an address must have answered its letter */
    if (!who.verified) {
      send(c, { t: 'refused', rid: 'rid' in m ? m.rid : undefined, error: 'verify-first' });
      return;
    }
    switch (m.t) {
      case 'create': {
        const table = hall.create(who, m.options, m.color);
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
      case 'buy': {
        const error = typeof m.item === 'string' ? store.buy(who.id, m.item) : 'refused';
        if (error) {
          send(c, { t: 'refused', rid: m.rid, error });
          return;
        }
        send(c, { t: 'done', rid: m.rid });
        for (const s of socketsOf(who.id)) pushDesk(s);
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
        pulse(code, c);
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
        const office = officeOf(who.id);
        if (now - office.lastTelegram < TELEGRAM_COOLDOWN_MS - 500) return;
        office.lastTelegram = now;
        for (const w of watchers(m.code)) send(w, { t: 'telegram', code: m.code, from, key: m.key, at: now });
        return;
      }
      case 'mark': {
        /* a place on the board only, from a seat at the table, not too often */
        const table = hall.table(m.code);
        const from = table?.seats.findIndex((s) => s.id === who.id) ?? -1;
        const known = typeof m.key === 'string' && (!!TOWN_BY_ID[m.key] || !!MERCHANT_BY_ID[m.key] || LINKS.some((l) => l.id === m.key));
        const office = officeOf(who.id);
        if (from < 0 || !known || office.strikes >= 2) return;
        const now = Date.now();
        office.marks = office.marks.filter((at) => now - at < PING_WINDOW_MS);
        office.marks.push(now);
        if (office.marks.length > PING_SHOWER) {
          office.strikes += 1;
          office.marks = [];
          send(c, { t: 'warned', code: m.code, about: 'marks', muted: office.strikes >= 2 });
          return;
        }
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
  const queueEvery = options.queueEvery ?? QUEUE_EVERY_MS;
  const usher = queueEvery > 0 ? setInterval(() => hall.matchQueues(), queueEvery) : null;
  /* the pulse: every socket is pinged, and each table in play hears its seats' lines */
  const pulses = setInterval(() => {
    const codes = new Set<string>();
    for (const c of clients) {
      if (c.socket.readyState !== c.socket.OPEN) continue;
      c.pingAt = Date.now();
      c.socket.ping();
      for (const code of c.watching) codes.add(code);
    }
    setTimeout(() => {
      for (const code of codes) pulse(code);
    }, 1500);
  }, 10_000);

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
            if (usher) clearInterval(usher);
            clearInterval(pulses);
            hall.dispose();
            for (const c of clients) {
              if (c.tablesTimer) clearTimeout(c.tablesTimer);
              c.socket.terminate();
            }
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
