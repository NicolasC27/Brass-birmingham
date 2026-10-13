import { createServer } from 'node:http';
import { seasonAt, seasonById } from './rating';
import { WEEK_MS, WEEK0, weekOf } from '@/platform/almanac';
import { telegraphFromEnv } from './discord';
import type { Telegraph } from './discord';
import { dispatchLine, editionText, seasonText } from './edition';
import type { ServerResponse } from 'node:http';
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
import type { JudgeId } from '@/game/analysis';
import type { Me, TableQuery } from '@/online/table';
import { normalizeCode } from '@/online/table';
import { CAPS } from '@/game/analysisMerge';
import type { Facts } from '@/game/analysisMerge';
import { Readings, isJudge, isVersion } from './analysis';
import type { Id } from './analysis';
import { Hall, STALE_MS } from './hall';
import { Home } from './home';
import { DEFAULT_PACE } from './game';
import type { Pace } from './game';
import type { Waits } from './queue';
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
  /** this socket's own mark, for the slices of a reading it takes */
  mark: string;
  /** where the socket comes from, for the counters kept per address */
  ip: string;
  me: Me | null;
  /** the session token this socket presented, if any */
  token: string | null;
  /** the table codes this socket follows */
  watching: Set<string>;
  /** when this socket last asked for the register of tables (0: never), and how it asked */
  askedTables: number;
  tablesQuery: TableQuery | undefined;
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
const isClaim = (t: ClientMessage['t']): boolean => t === 'signin' || t === 'signup' || t === 'guest' || t === 'forgot' || t === 'reset' || t === 'resend';
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

/** the address a request comes from: the socket's, or the first one a trusted
 *  proxy forwarded (TRUST_PROXY=1 behind nginx or Caddy) */
const addressOf = (req: IncomingMessage, trustProxy: boolean): string => {
  if (trustProxy) {
    const fwd = req.headers['x-forwarded-for'];
    const first = (Array.isArray(fwd) ? fwd[0] : (fwd ?? '')).split(',')[0].trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? '';
};
/** the headers every answer of the counter carries: nothing sniffed, nothing framed, nothing told */
const headed = (res: ServerResponse, status: number, type: string): void => {
  res.writeHead(status, {
    'content-type': type,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'",
  });
};
/** sign-in attempts that failed, by address and name: after a few, the door waits */
const ATTEMPTS = { each: 8, all: 40, forMs: 15 * 60 * 1000 };
interface Attempts {
  n: number;
  at: number;
}
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
  /** the clock the queues wait by, and how long they wait — for the tests */
  clock?: () => number;
  waits?: Partial<Waits>;
  /** how often the queues are looked down (0 = only on a join) */
  queueEvery?: number;
  /** how often the house looks whether a Monday edition is due (0: never) */
  editionEvery?: number;
  /** the telegraph to the club's channel; the environment's when absent */
  telegraph?: Telegraph;
  /** the origins a browser may open a socket from (BLACKRAIL_ORIGINS, comma-separated;
   *  the app's own address, this machine and the desktop app are always let in) */
  origins?: string[];
  /** the addresses come from a trusted proxy's x-forwarded-for (TRUST_PROXY=1) */
  trustProxy?: boolean;
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

/** a name as the register folds it, to count the tries on it */
const foldName = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, ' ');

/** a table's name is a name, not a paragraph */
const MAX_TABLE_NAME = 60;
/** games at home one account may keep on the register at once */
const HOME_CAP = 200;

export function serve(options: ServeOptions = {}): Promise<Serving> {
  const store = new Store(options.file ?? 'brassworks.db');
  const hall = new Hall(store, options.pace ?? DEFAULT_PACE, { now: options.clock, waits: options.waits });
  /* the games played at home: no table, no seats, but the same log and the
     same engine reading every move before it is written */
  const home = new Home(store);
  /* the office's copy of what the tables have read of their games */
  const readings = new Readings(store, options.clock);
  let marks = 0;
  const post = options.mailer ?? mailerFromEnv();
  const letter = letters(options.appUrl ?? process.env.APP_URL ?? 'http://localhost:3000');
  const feedbackTo = (options.feedbackTo ?? process.env.FEEDBACK_TO ?? '').trim();
  const file = options.file ?? 'brassworks.db';
  const feedbackFile = options.feedbackFile === undefined ? (process.env.FEEDBACK_FILE ?? (file === ':memory:' ? null : path.join(path.dirname(file), 'feedback.md'))) : options.feedbackFile;
  const clients = new Set<Client>();
  const me = (a: Account): Me => ({ id: a.id, name: a.name, email: a.email, verified: a.verified, motto: a.motto, favoriteColor: a.favoriteColor, portrait: a.portrait, createdAt: a.createdAt, newsletter: a.newsletter, guest: a.guest });
  /** the claims made from each address of late */
  const claimsByIp = new Map<string, Bucket>();
  /* the counter's pages are for the developer's own machine: a house that
     forgets, or one told DEV_LETTERS=1, and only from this very machine */
  const dev = file === ':memory:' || process.env.DEV_LETTERS === '1';
  const feedbackToken = (process.env.FEEDBACK_TOKEN ?? '').trim();
  const trustProxy = options.trustProxy ?? process.env.TRUST_PROXY === '1';
  /* the origins a browser may speak from: a page elsewhere gets no socket */
  const origins = new Set<string>();
  for (const o of [...(options.origins ?? (process.env.BLACKRAIL_ORIGINS ?? '').split(',')), options.appUrl ?? process.env.APP_URL ?? '']) {
    try {
      if (o.trim()) origins.add(new URL(o.trim()).origin);
    } catch {
      console.error(`origins: not an address: ${o}`);
    }
  }
  const originAllowed = (origin: string | undefined): boolean => {
    if (!origin) return true; /* not a browser: no page to protect */
    if (origins.has(origin)) return true;
    try {
      const u = new URL(origin);
      return ['localhost', '127.0.0.1', '[::1]', 'tauri.localhost'].includes(u.hostname) || u.protocol === 'tauri:';
    } catch {
      return false;
    }
  };
  const failures = new Map<string, Attempts>();
  /** one more failure from this key */
  const failed = (key: string): void => {
    const now = Date.now();
    for (const [k, a] of failures) if (now - a.at > ATTEMPTS.forMs) failures.delete(k);
    const a = failures.get(key) ?? { n: 0, at: now };
    a.n += 1;
    a.at = now;
    failures.set(key, a);
  };
  /** the door waits for this key: too many failures, too recently */
  const waiting = (key: string, limit: number): boolean => {
    const a = failures.get(key);
    return !!a && a.n >= limit && Date.now() - a.at < ATTEMPTS.forMs;
  };
  const faultTimes = new WeakMap<object, number[]>();
  const http = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://blackrail');
    const own = dev && loopback(req);
    /* a member's likeness, by account id: the picture itself, or nothing */
    if (url.pathname.startsWith('/portrait/')) {
      const id = decodeURIComponent(url.pathname.slice('/portrait/'.length));
      const data = store.account(id)?.portrait ?? null;
      const m = data && /^data:(image\/[a-z]+);base64,(.+)$/.exec(data);
      if (!m) {
        headed(res, 404, 'text/plain');
        res.end('Not found\n');
        return;
      }
      res.writeHead(200, { 'content-type': m[1], 'cache-control': 'public, max-age=120', 'access-control-allow-origin': '*' });
      res.end(Buffer.from(m[2], 'base64'));
      return;
    }
    /* the counter: with no real post, the letters can be read here */
    if (url.pathname === '/letters') {
      if (!own || !post.kept) {
        headed(res, 404, 'text/plain');
        res.end('Not found\n');
        return;
      }
      headed(res, 200, 'text/plain; charset=utf-8');
      res.end(post.kept.length ? post.kept.map((m) => `To: ${m.to}\nSubject: ${m.subject}\n\n${m.text}\n\n${'─'.repeat(60)}\n`).join('\n') : 'No letter yet.\n');
      return;
    }
    /* the watch's marks, as a page: who was noted, for what, where —
       from this machine, or with the token FEEDBACK_TOKEN names */
    if (url.pathname === '/flags') {
      const shown = own || (feedbackToken !== '' && sameToken(url.searchParams.get('token') ?? '', feedbackToken));
      if (!shown) {
        headed(res, 404, 'text/plain');
        res.end('Not found\n');
        return;
      }
      headed(res, 200, 'text/plain; charset=utf-8');
      const flags = store.flags();
      res.end(flags.length ? flags.map((f) => `${new Date(f.at).toISOString()}  ${f.kind.padEnd(10)} ${f.name ?? f.accountId}${f.code ? ` @${f.code}` : ''} — ${f.detail}`).join('\n') + '\n' : 'Nothing noted.\n');
      return;
    }
    /* the suggestion box, as a page: every idea and bug, newest first —
       from this machine, or with the token FEEDBACK_TOKEN names */
    if (url.pathname === '/faults') {
      const shown = own || (feedbackToken !== '' && sameToken(url.searchParams.get('token') ?? '', feedbackToken));
      if (!shown) {
        headed(res, 404, 'text/plain');
        res.end('Not found\n');
        return;
      }
      headed(res, 200, 'text/plain; charset=utf-8');
      const faults = store.faults();
      res.end(faults.length ? faults.map((f) => `${new Date(f.seen).toISOString()}  ${f.page}  v${f.version}  ${f.name ?? f.accountId ?? 'stranger'}\n  ${f.message}\n  ${f.agent}\n${f.stack ? f.stack.replace(/^/gm, '    ') + '\n' : ''}`).join('\n') : 'No fault reported.\n');
      return;
    }
    if (url.pathname === '/feedback') {
      const shown = own || (feedbackToken !== '' && sameToken(url.searchParams.get('token') ?? '', feedbackToken));
      if (!shown) {
        headed(res, 404, 'text/plain');
        res.end('Not found\n');
        return;
      }
      headed(res, 200, 'text/plain; charset=utf-8');
      const notes = store.feedbackList();
      res.end(notes.length ? notes.map((n) => noteText(n)).join('\n') : 'No idea yet.\n');
      return;
    }
    headed(res, 200, 'text/plain');
    res.end('blackrail\n');
  });
  const wss = new WebSocketServer({ server: http, maxPayload: 64 * 1024, verifyClient: ({ origin }: { origin: string }) => originAllowed(origin || undefined) });

  const send = (c: Client, m: ServerMessage) => {
    if (c.socket.readyState === 1) c.socket.send(encode(m));
  };
  const watchers = (code: string) => [...clients].filter((c) => c.watching.has(code));
  const socketsOf = (accountId: string) => [...clients].filter((c) => c.me?.id === accountId);
  hall.presence({
    count: () => new Set([...clients].filter((c) => c.me).map((c) => c.me!.id)).size,
    has: (accountId) => socketsOf(accountId).length > 0,
    watchers: (code) => watchers(code).length,
    address: (accountId) => socketsOf(accountId)[0]?.ip ?? null,
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
  /** the register of games at home moved: every browser of this account
   *  hears it, so two tabs never disagree about what has been played */
  const tellHome = (accountId: string) => {
    const games = home.list(accountId);
    for (const s of socketsOf(accountId)) send(s, { t: 'home.register', games });
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
        send(c, { t: 'tables', page: hall.page(c.me?.id ?? null, c.tablesQuery) });
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

  /* the telegraph to the club's channel: each dispatch once, as it is wired */
  const telegraph = options.telegraph ?? telegraphFromEnv();
  const wiredAt = new Map<string, number>();
  hall.onChange((code, what) => {
    for (const c of watchers(code)) {
      if (what === 'table') pushTable(c, code);
      else pushGame(c, code);
    }
    for (const c of clients) pushTables(c);
    if (what === 'game') {
      const g = hall.game(code);
      const name = hall.table(code)?.name ?? code;
      const since = wiredAt.get(code) ?? 0;
      for (const d of [...(g?.dispatches ?? [])].reverse()) {
        if (d.at <= since) continue;
        telegraph.post(dispatchLine({ ...d, code, table: name }));
        wiredAt.set(code, d.at);
      }
    }
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
    const client: Client = { socket, mark: `s-${++marks}`, ip: addressOf(req, trustProxy), me: null, token: null, watching: new Set(), askedTables: 0, tablesQuery: undefined, latency: null, pingAt: 0, tablesAt: 0, tablesTimer: null, words: bucket(WORDS.size), claims: bucket(CLAIMS.size), refused: 0 };
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
      /* the stretches of a reading this socket had taken are free again */
      readings.release(client.mark);
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
        /* the charter and the policy are accepted before the register is signed: kept with the date */
        if (m.accept !== true) {
          send(c, { t: 'refused', rid: m.rid, error: 'must-accept' });
          return;
        }
        /* a guest signing up is not a second account: the one it has been
           playing under takes the name and the address, and keeps its games */
        const made = c.me?.guest ? store.promoteGuest(c.me.id, m.name, m.email, m.password, { ip: c.ip, accepted: true }) : await store.signUpAsync(m.name, m.email, m.password, { ip: c.ip, accepted: true });
        if ('error' in made) {
          send(c, { t: 'refused', rid: m.rid, error: made.error });
          return;
        }
        mail('verify', made.account);
        open(c, made.account, m.rid);
        return;
      }
      /* a browser with no session of its own: the office opens one, so the
         very first game has an account to be written under */
      case 'guest': {
        if (c.me) {
          send(c, { t: 'welcome', rid: m.rid, me: c.me });
          return;
        }
        open(c, store.enrolGuest({ ip: c.ip }), m.rid);
        return;
      }
      case 'signin': {
        /* a name tried too often, from here or from everywhere, waits a quarter of an hour */
        const name = foldName(String(m.name ?? ''));
        const keys: [string, number][] = [
          [`${c.ip}|${name}`, ATTEMPTS.each],
          [`*|${name}`, ATTEMPTS.all],
        ];
        if (keys.some(([k, limit]) => waiting(k, limit))) {
          send(c, { t: 'refused', rid: m.rid, error: 'too-many-attempts' });
          return;
        }
        const account = await store.signInAsync(m.name, m.password);
        if (!account) {
          for (const [k] of keys) failed(k);
          send(c, { t: 'refused', rid: m.rid, error: 'bad-credentials' });
          return;
        }
        for (const [k] of keys) failures.delete(k);
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
      case 'fault': {
        /* five a minute per socket, whatever the page believes it sent */
        const now = Date.now();
        const recent = (faultTimes.get(c) ?? []).filter((t) => now - t < 60_000);
        if (recent.length >= 5) return;
        faultTimes.set(c, [...recent, now]);
        const cut = (v: unknown, n: number) => (typeof v === 'string' ? v : '').slice(0, n);
        store.fault({ accountId: c.me?.id ?? null, message: cut(m.message, 500), stack: cut(m.stack, 2000), page: cut(m.page, 200), version: cut(m.version, 40), agent: cut(m.agent, 200), at: typeof m.at === 'number' ? m.at : now, seen: now });
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
        store.setProfile(who.id, { motto: m.motto, favoriteColor: m.favoriteColor, newsletter: typeof m.newsletter === 'boolean' ? m.newsletter : undefined, portrait: typeof m.portrait === 'string' || m.portrait === null ? m.portrait : undefined });
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
      case 'export': {
        const data = store.exportOf(who.id);
        if (!data) {
          send(c, { t: 'refused', rid: m.rid, error: 'no-session' });
          return;
        }
        send(c, { t: 'export', rid: m.rid, data });
        return;
      }
      case 'close': {
        const error = store.closeAccount(who.id, String(m.password ?? ''));
        if (error) {
          send(c, { t: 'refused', rid: m.rid, error: error === 'not-found' ? 'no-session' : error });
          return;
        }
        console.log(`account closed: ${who.id}`);
        for (const mode of ['quick', 'ranked'] as const) hall.queue(who.id, mode, false);
        send(c, { t: 'done', rid: m.rid });
        evict(who.id, c);
        c.me = null;
        c.token = null;
        c.watching.clear();
        return;
      }
      case 'desk':
        pushDesk(c, m.rid);
        return;
      case 'tables':
        /* asked for once, the register keeps coming for a while — the page asked for */
        c.askedTables = Date.now();
        c.tablesAt = c.askedTables;
        c.tablesQuery = m.query && typeof m.query === 'object' ? m.query : undefined;
        send(c, { t: 'tables', rid: m.rid, page: hall.page(who.id, c.tablesQuery) });
        return;
      case 'seatme': {
        const table = hall.seatMe(who, m.color);
        c.watching.add(table.code);
        send(c, { t: 'seated', rid: m.rid, table });
        pushGame(c, table.code);
        return;
      }
      case 'leaderboard':
        send(c, { t: 'leaderboard', rid: m.rid, board: hall.leaderboard(who.id) });
        return;
      case 'challenge':
        if (Number.isInteger(m.week) && m.week >= 0) send(c, { t: 'challenge', rid: m.rid, board: store.challengeBoard(m.week, who.id) });
        return;
      case 'papers':
        send(c, { t: 'papers', rid: m.rid, papers: store.papers(who.id) });
        return;
      case 'papers.put':
        if (typeof m.kind === 'string' && store.putPaper(who.id, m.kind, m.body)) send(c, { t: 'done', rid: m.rid });
        else send(c, { t: 'refused', rid: m.rid, error: 'refused' });
        return;

      /* ---------------------- the games at home ---------------------- */
      case 'home.list':
        send(c, { t: 'home.register', rid: m.rid, games: home.list(who.id) });
        return;
      case 'home.load':
        send(c, { t: 'home.save', rid: m.rid, save: typeof m.code === 'string' ? home.save(who.id, normalizeCode(m.code)) : null });
        return;
      case 'home.open': {
        const name = typeof m.name === 'string' ? m.name.trim().slice(0, MAX_TABLE_NAME) : '';
        if (!name || !Number.isInteger(m.seed) || m.seed < 0 || !m.setup) {
          send(c, { t: 'refused', rid: m.rid, error: 'refused' });
          return;
        }
        if (home.list(who.id).length >= HOME_CAP) {
          send(c, { t: 'refused', rid: m.rid, error: 'too-many-games' });
          return;
        }
        let table;
        try {
          table = home.deal(who.id, name, m.setup, m.seed);
        } catch (e) {
          /* a deal the engine will not have: nothing is written */
          send(c, { t: 'refused', rid: m.rid, error: (e as Error).message });
          return;
        }
        send(c, { t: 'home.dealt', rid: m.rid, table });
        tellHome(who.id);
        return;
      }
      case 'home.act': {
        const code = typeof m.code === 'string' ? normalizeCode(m.code) : '';
        const r = code && Number.isInteger(m.idx) && m.idx >= 0 && m.action ? home.act(who.id, code, m.idx, m.action) : ({ ok: false, error: 'refused' } as const);
        /* a browser that numbered its move is answered either way: a move
           written, or turned down. One that did not hears only a refusal —
           the position it played is already on its screen */
        const rid = 'rid' in m && typeof m.rid === 'number' ? m.rid : undefined;
        if (!r.ok) {
          /* the refusal frame first: whoever listens for refusals has heard
             it by the time the move's own answer comes back */
          send(c, { t: 'home.refused', code, at: Number(m.idx), error: r.error });
          if (rid !== undefined) send(c, { t: 'refused', rid, error: r.error });
          return;
        }
        if (rid !== undefined) send(c, { t: 'done', rid });
        if (r.over) {
          tellHome(who.id);
          /* a game played out is one more line of the history */
          for (const s of socketsOf(who.id)) pushDesk(s);
        }
        return;
      }
      case 'home.undo': {
        const code = typeof m.code === 'string' ? normalizeCode(m.code) : '';
        const r = code && Number.isInteger(m.at) ? home.undo(who.id, code, m.at) : ({ ok: false, error: 'refused' } as const);
        if (!r.ok) send(c, { t: 'refused', rid: m.rid, error: r.error });
        else {
          /* the judge's reading ran to moves the log no longer has: it is
             read again from the shorter game, not kept past its end */
          readings.forget(code);
          store.dropAnalyses(code);
          send(c, { t: 'done', rid: m.rid });
          tellHome(who.id);
        }
        return;
      }
      case 'analysis.get': {
        /* the reading the office keeps of this table, for anyone who may see
           it — a player at it or a spectator following it */
        const one = reading(c, m);
        send(c, { t: 'analysis', rid: m.rid, code: normalizeCode(m.code), v: m.v, judge: m.judge, reading: one ? readings.read(one.id) : null, readers: one ? readings.readers(one.id) : 0 });
        return;
      }
      case 'analysis.post': {
        /* figures read in a browser: checked against the game the office
           itself holds, folded into its copy, then passed round the table */
        const one = reading(c, m);
        if (!one) return;
        const part = readings.add(one.id, c.mark, m.part, one.facts);
        if (!part) return;
        const readers = readings.readers(one.id);
        for (const w of watchers(one.id.code)) if (w !== c) send(w, { t: 'analysis.add', code: one.id.code, v: one.id.v, judge: one.id.judge, part, readers });
        return;
      }
      case 'analysis.claim': {
        /* a stretch of the game to read: the office hands out what nobody
           else is reading, so several readers never read the same positions */
        const one = reading(c, m);
        const slice = one ? readings.claim(one.id, c.mark, m.want, one.facts) : { lo: 0, hi: 0 };
        send(c, { t: 'analysis.slice', rid: m.rid, code: normalizeCode(m.code), v: m.v, judge: m.judge, lo: slice.lo, hi: slice.hi, readers: one ? readings.readers(one.id) : 0 });
        return;
      }

      case 'notes.get':
        send(c, { t: 'notes', rid: m.rid, code: typeof m.code === 'string' ? m.code : '', body: typeof m.code === 'string' ? store.notes(who.id, normalizeCode(m.code)) : null });
        return;
      case 'notes.put':
        /* nothing comes back: a page written is the writer's own business */
        if (typeof m.code === 'string') store.putNotes(who.id, normalizeCode(m.code), m.body);
        return;
      case 'home.forget':
        if (typeof m.code === 'string') home.forget(who.id, normalizeCode(m.code));
        send(c, { t: 'done', rid: m.rid });
        tellHome(who.id);
        for (const s of socketsOf(who.id)) pushDesk(s);
        return;
      case 'companies':
        send(c, { t: 'companies', rid: m.rid, board: store.companies(seasonAt(), who.id) });
        return;
      case 'company.found':
      case 'company.join':
      case 'company.leave': {
        const error = m.t === 'company.found' ? (typeof m.name === 'string' ? store.foundCompany(who.id, m.name) : 'refused') : m.t === 'company.join' ? (typeof m.id === 'string' ? store.joinCompany(who.id, m.id) : 'refused') : (store.leaveCompany(who.id), null);
        if (error) {
          send(c, { t: 'refused', rid: m.rid, error });
          return;
        }
        send(c, { t: 'companies', rid: m.rid, board: store.companies(seasonAt(), who.id) });
        for (const s of socketsOf(who.id)) pushDesk(s);
        return;
      }
      case 'seasons':
        /* the running service is listed even before anyone is rated in it */
        send(c, { t: 'seasons', rid: m.rid, seasons: [...new Set([seasonAt().id, ...store.seasons()])].map((id) => seasonById(id)?.season).filter((s): s is NonNullable<typeof s> => !!s) });
        return;
      case 'season': {
        const found = typeof m.id === 'string' ? seasonById(m.id) : null;
        if (!found) {
          send(c, { t: 'refused', rid: m.rid, error: 'not-found' });
          return;
        }
        send(c, { t: 'season', rid: m.rid, review: store.seasonReview(found.season, found.from, found.to) });
        return;
      }
      case 'edition': {
        if (!Number.isInteger(m.week) || m.week < 0 || m.week > weekOf()) return;
        const from = WEEK0 + m.week * WEEK_MS;
        send(c, { t: 'edition', rid: m.rid, edition: store.editionOf(m.week, from, from + WEEK_MS) });
        return;
      }
      case 'challenge.post': {
        /* an attempt of this week or the last, in figures a game can make */
        const week = weekOf();
        const sane =
          Number.isInteger(m.week) && m.week <= week && m.week >= week - 1 && typeof m.id === 'string' && m.id.length <= 32 && Array.isArray(m.met) && m.met.length <= 8 && m.met.every((x) => typeof x === 'boolean') && Number.isInteger(m.points) && m.points >= 0 && m.points <= 500 && Number.isInteger(m.vp) && m.vp >= 0 && m.vp <= 400;
        if (!sane) {
          send(c, { t: 'refused', rid: m.rid, error: 'refused' });
          return;
        }
        const paid = store.postChallenge(who.id, m.week, m.id, m.points, m.vp, m.met);
        send(c, { t: 'challenge', rid: m.rid, board: store.challengeBoard(m.week, who.id) });
        if (paid > 0) for (const s of socketsOf(who.id)) pushDesk(s);
        return;
      }
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
      case 'review': {
        /* a seat reading the game again shows the table where it is looking:
           the move, the corner of the map its camera sits on and where its
           pointer is — figures only, nothing the office has to believe */
        const table = hall.table(m.code);
        const from = table?.seats.findIndex((s) => s.id === who.id) ?? -1;
        const at = m.at === null ? null : Math.max(0, Math.floor(m.at));
        if (from < 0 || (at !== null && !Number.isFinite(at))) return;
        const spot = (p: { wx: number; wy: number } | null | undefined) => (p && Number.isFinite(p.wx) && Number.isFinite(p.wy) ? { wx: Math.round(p.wx), wy: Math.round(p.wy) } : null);
        const look = m.look && Number.isFinite(m.look.k) ? { ...spot(m.look)!, k: Math.round(m.look.k * 100) / 100 } : undefined;
        const cursor = m.cursor === undefined ? undefined : spot(m.cursor);
        /* the seat being read and the line being explored ride along, so the
           table follows the whole reading and not only its cursor */
        const seat = typeof m.seat === 'number' && Number.isInteger(m.seat) && m.seat >= 0 && m.seat < (table?.seats.length ?? 0) ? m.seat : undefined;
        const line = m.line === undefined ? undefined : m.line && Array.isArray(m.line.moves) && m.line.moves.length <= 40 && Number.isFinite(m.line.from) ? { from: Math.max(0, Math.floor(m.line.from)), moves: m.line.moves } : null;
        for (const w of watchers(m.code)) send(w, { t: 'review', code: m.code, from, at, ...(look ? { look } : {}), ...(cursor !== undefined ? { cursor } : {}), ...(seat !== undefined ? { seat } : {}), ...(line !== undefined ? { line } : {}) });
        return;
      }
    }
  }

  /** the game a reading is of: the table's own, or the record of one played
   *  out at it — and null when this socket has no business reading it */
  function reading(c: Client, m: { code: string; v: number; judge: JudgeId }): { id: Id; facts: Facts } | null {
    const code = normalizeCode(m.code);
    if (!isJudge(m.judge) || !isVersion(m.v)) return null;
    /* a table this socket follows, or a game of its own played at home */
    if (!c.watching.has(code) && (!c.me || store.homeOwner(code) !== c.me.id)) return null;
    const game = hall.game(code);
    const facts = game ? { seed: game.seed, moves: game.state.actions.length, seats: game.state.players.length } : store.gameFacts(code);
    if (!facts || facts.moves < 1 || facts.moves > CAPS.moves || facts.seats < 2) return null;
    return { id: { code, seed: facts.seed, judge: m.judge, v: m.v }, facts: { moves: facts.moves, seats: facts.seats } };
  }

  /** signed in: a fresh token, and the socket speaks for the account */
  function open(c: Client, account: Account, rid: number): void {
    c.me = me(account);
    c.token = store.openSession(account.id);
    send(c, { t: 'session', rid, token: c.token, me: c.me });
    tellFriends(account.id);
  }

  const every = options.sweepEvery ?? 15 * 60 * 1000;
  const janitor =
    every > 0
      ? setInterval(() => {
          hall.sweep(STALE_MS);
          home.sweep();
          store.sweepPrivacy();
          store.sweepGuests();
          readings.sweep();
        }, every)
      : null;
  store.sweepPrivacy();
  /* the Monday edition: once a week, the week just closed goes out by
     post to those who asked, and to the club's channel */
  const monday = () => {
    const week = weekOf();
    if (week < 1 || !store.claimMailing(`edition:${week - 1}`)) return;
    const from = WEEK0 + (week - 1) * WEEK_MS;
    const { subject, text } = editionText(store.editionOf(week - 1, from, from + WEEK_MS), store.challengeBoard(week - 1, ''), letter.appUrl);
    void telegraph.send(text);
    for (const s of store.subscribers()) void post.send({ to: s.email, subject, text: `${s.name},\n\n${text}` }).catch((e) => console.warn('edition: a letter did not leave', e instanceof Error ? e.message : e));
    /* a service closed during that week: its review goes out once too */
    const before = seasonAt(from - 1);
    if (before.id !== seasonAt().id && store.claimMailing(`season:${before.id}`)) {
      const span = seasonById(before.id);
      if (span) {
        const r = seasonText(store.seasonReview(span.season, span.from, span.to), letter.appUrl);
        void telegraph.send(r.text);
        for (const s of store.subscribers()) void post.send({ to: s.email, subject: r.subject, text: `${s.name},\n\n${r.text}` }).catch(() => undefined);
      }
    }
  };
  const editionEvery = options.editionEvery ?? 10 * 60 * 1000;
  const postman = editionEvery > 0 ? setInterval(monday, editionEvery) : null;
  if (editionEvery > 0) monday();
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
            if (postman) clearInterval(postman);
            telegraph.close();
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
