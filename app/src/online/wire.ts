import { decode, encode } from './protocol';
import type { ClientMessage, ServerMessage } from './protocol';
import type { CompanyBoard, HomeSave, HomeTable, Paper, Season, SeasonReview, Edition, ChallengeBoard, Desk, Me, Leaderboard, TableQuery, TablesPage } from './table';
import type { Audience, WaitBook } from './waitlist';
import type { GameAction } from '@/game/actions';
import type { SetupPayload } from '@/game/types';

/* ------------------------------------------------------------------ */
/* The wire — one socket to the table server, kept alive.              */
/*                                                                     */
/* Everything online rides on it: the office, the room and the game.   */
/* It holds the session token, presents it again on every connection,  */
/* follows again the tables it was following, and keeps what could not */
/* be sent until the line is back — so a dropped connection costs a    */
/* reconnection and nothing else. The server still has the log.        */
/* ------------------------------------------------------------------ */

export type WireStatus = 'offline' | 'connecting' | 'online';

const MAX_BACKOFF = 8000;
const TOKEN_KEY = 'brassworks.session.v1';
/** how long a request waits for the office to answer */
const ANSWER_MS = 8000;
/** the word a request gives up with when no answer came in time */
const OFFLINE = 'offline';

/** what became of a move at home sent to the office: written, turned down,
 *  or not known — the line went quiet before the office had read it */
export type HomeHeard = 'kept' | 'refused' | 'offline';

interface Waiting {
  ok: (m: ServerMessage) => void;
  ko: (e: Error) => void;
  timer: number;
}

export class Wire {
  readonly url: string;
  status: WireStatus = 'offline';
  /** the account this socket speaks for, null until it is signed in */
  session: Me | null = null;
  /** the desk as the server last sent it (null until asked) */
  desk: Desk | null = null;
  private desks = new Set<() => void>();
  /** the register of tables in play, a page at a time, the roll of honour: asked for, then pushed */
  tables: TablesPage | null = null;
  board: Leaderboard | null = null;
  /** the week's boards of the challenge notice, by week: asked for, then kept */
  challenges = new Map<number, ChallengeBoard>();
  /** the club's editions, by week: asked for, then kept */
  editions = new Map<number, Edition>();
  /** the services closed so far, and each review asked for */
  seasons: Season[] | null = null;
  reviews = new Map<string, SeasonReview>();
  /** the companies and their honours: asked for, then kept */
  companies: CompanyBoard | null = null;
  /** the table the office just dealt me from a queue, until the page takes me there */
  dealt: string | null = null;
  /** the register of games played at home, as the office last told it */
  home: HomeTable[] | null = null;
  private homes = new Set<() => void>();
  private refusals = new Set<(r: { code: string; at: number; error: string }) => void>();
  private halls = new Set<() => void>();
  private token: string | null = null;
  private socket: WebSocket | null = null;
  private outbox: ClientMessage[] = [];
  private frames = new Set<(m: ServerMessage) => void>();
  private states = new Set<() => void>();
  private sessions = new Set<() => void>();
  private watching = new Set<string>();
  private waiting = new Map<number, Waiting>();
  private rid = 0;
  private attempt = 0;
  private timer: number | null = null;
  /** the socket has presented its token and been recognised */
  private known = false;

  constructor(url: string) {
    this.url = url;
    try {
      this.token = localStorage.getItem(TOKEN_KEY);
    } catch {
      /* private mode: this browser signs in every time */
    }
    this.open();
  }

  /** nobody has signed the book, and no token is waiting to be presented:
   *  a socket in this state will never become anyone on its own */
  get stranger(): boolean {
    return !this.token && !this.session;
  }

  /** every frame the server sends */
  on(cb: (m: ServerMessage) => void): () => void {
    this.frames.add(cb);
    return () => this.frames.delete(cb);
  }

  /** the line went up or down */
  onStatus(cb: () => void): () => void {
    this.states.add(cb);
    return () => this.states.delete(cb);
  }

  /** somebody signed in or out, or the account changed */
  onSession(cb: () => void): () => void {
    this.sessions.add(cb);
    return () => this.sessions.delete(cb);
  }

  /** the desk changed */
  onDesk(cb: () => void): () => void {
    this.desks.add(cb);
    return () => this.desks.delete(cb);
  }

  /** ask for the desk: it comes back as a frame, and again whenever it changes */
  askDesk(): void {
    this.send({ t: 'desk' });
  }

  /** the register or the roll changed */
  onHall(cb: () => void): () => void {
    this.halls.add(cb);
    return () => this.halls.delete(cb);
  }

  /** the register of tables: pushed again for a while after the asking */
  askTables(query: TableQuery = {}): void {
    void this.ask((rid) => ({ t: 'tables', rid, query })).catch(() => undefined);
  }

  askLeaderboard(): void {
    void this.ask((rid) => ({ t: 'leaderboard', rid })).catch(() => undefined);
  }

  /** the papers the office keeps for me */
  async askPapers(): Promise<Record<string, Paper>> {
    const m = await this.ask((rid) => ({ t: 'papers', rid }));
    return m.t === 'papers' ? m.papers : {};
  }

  async putPaper(kind: string, body: unknown): Promise<void> {
    await this.ask((rid) => ({ t: 'papers.put', rid, kind, body }));
  }

  /* ------------------------ games at home ------------------------ */

  /** the register of games at home changed */
  onHome(cb: () => void): () => void {
    this.homes.add(cb);
    return () => this.homes.delete(cb);
  }

  /** the office turned a move at home down */
  onHomeRefused(cb: (r: { code: string; at: number; error: string }) => void): () => void {
    this.refusals.add(cb);
    return () => this.refusals.delete(cb);
  }

  /** an account to play under, whatever it takes: the one in hand, or one
   *  the office opens for this browser so a first game has somewhere to go */
  async need(): Promise<Me> {
    if (this.session) return this.session;
    /* a token is being presented: its answer is on its way */
    if (this.token) {
      const me = await this.settled();
      if (me) return me;
    }
    const m = await this.ask((rid) => ({ t: 'guest', rid }), true);
    if (m.t === 'session') return this.enter(m);
    if (m.t === 'welcome') {
      this.setSession(m.me);
      return m.me;
    }
    throw new Error('offline');
  }

  /** the register of games at home */
  async askHome(): Promise<HomeTable[]> {
    const m = await this.ask((rid) => ({ t: 'home.list', rid }));
    return m.t === 'home.register' ? m.games : [];
  }

  /** a new game at home: the office deals it its code */
  async openHome(name: string, seed: number, setup: SetupPayload): Promise<HomeTable> {
    await this.need();
    const m = await this.ask((rid) => ({ t: 'home.open', rid, name, seed, setup }));
    if (m.t !== 'home.dealt') throw new Error('refused');
    return m.table;
  }

  /** one game at home whole, deal and log */
  async loadHome(code: string): Promise<HomeSave | null> {
    const m = await this.ask((rid) => ({ t: 'home.load', rid, code }));
    return m.t === 'home.save' ? m.save : null;
  }

  /** one move, at its place in the log, and the office's word on it:
   *  written, turned down — the refusal is heard by `onHomeRefused` too, and
   *  first — or not heard in time. A move not answered stays in the outbox
   *  and goes out with the line: whether it stands is the office's to say
   *  then. Never throws */
  async actHome(code: string, idx: number, action: GameAction): Promise<HomeHeard> {
    try {
      await this.ask((rid) => ({ t: 'home.act', rid, code, idx, action }), false, true);
      return 'kept';
    } catch (e) {
      return (e as Error).message === OFFLINE ? 'offline' : 'refused';
    }
  }

  async undoHome(code: string, at: number): Promise<void> {
    await this.ask((rid) => ({ t: 'home.undo', rid, code, at }));
  }

  async forgetHome(code: string): Promise<void> {
    await this.ask((rid) => ({ t: 'home.forget', rid, code }));
  }

  /** what I wrote beside a game of mine */
  async askNotes(code: string): Promise<unknown> {
    const m = await this.ask((rid) => ({ t: 'notes.get', rid, code }));
    return m.t === 'notes' ? m.body : null;
  }

  putNotes(code: string, body: unknown): void {
    this.send({ t: 'notes.put', code, body });
  }

  /** the line is up — or it was not within `ms`, and the office is taken for
   *  unreachable rather than waited on until every request has timed out */
  ready(ms = 5000): Promise<boolean> {
    if (this.status === 'online') return Promise.resolve(true);
    return new Promise((ok) => {
      const timer = window.setTimeout(() => {
        off();
        ok(false);
      }, ms);
      const off = this.onStatus(() => {
        if (this.status !== 'online') return;
        window.clearTimeout(timer);
        off();
        ok(true);
      });
    });
  }

  /** the session as it settles, or null when the office does not answer */
  private settled(): Promise<Me | null> {
    if (this.session) return Promise.resolve(this.session);
    return new Promise((ok) => {
      const timer = window.setTimeout(() => {
        off();
        ok(null);
      }, ANSWER_MS);
      const off = this.onSession(() => {
        window.clearTimeout(timer);
        off();
        ok(this.session);
      });
    });
  }

  askSeasons(): void {
    void this.ask((rid) => ({ t: 'seasons', rid })).catch(() => undefined);
  }

  askSeason(id: string): void {
    void this.ask((rid) => ({ t: 'season', rid, id })).catch(() => undefined);
  }

  askCompanies(): void {
    void this.ask((rid) => ({ t: 'companies', rid })).catch(() => undefined);
  }

  async foundCompany(name: string): Promise<void> {
    await this.ask((rid) => ({ t: 'company.found', rid, name }));
  }

  async joinCompany(id: string): Promise<void> {
    await this.ask((rid) => ({ t: 'company.join', rid, id }));
  }

  async leaveCompany(): Promise<void> {
    await this.ask((rid) => ({ t: 'company.leave', rid }));
  }

  askEdition(week: number): void {
    void this.ask((rid) => ({ t: 'edition', rid, week })).catch(() => undefined);
  }

  askChallenge(week: number): void {
    void this.ask((rid) => ({ t: 'challenge', rid, week })).catch(() => undefined);
  }

  /** an attempt at the week's notice, for the office to keep and pay */
  postChallenge(a: { week: number; id: string; vp: number; rank: number; met: boolean[]; points: number }): void {
    void this.ask((rid) => ({ t: 'challenge.post', rid, week: a.week, id: a.id, vp: a.vp, rank: a.rank, met: a.met, points: a.points })).catch(() => undefined);
  }

  /** stand in the quick or the ranked queue, or step out of it */
  setQueue(mode: 'quick' | 'ranked', on: boolean): void {
    this.send({ t: 'queue', mode, on });
  }

  async buy(item: string): Promise<void> {
    await this.ask((rid) => ({ t: 'buy', rid, item }));
  }

  /* the direction's desk: each request answers with the waiting list whole */
  private async book(make: (rid: number) => ClientMessage): Promise<WaitBook> {
    const m = await this.ask(make);
    if (m.t !== 'admin.book') throw new Error('no-book');
    return m.book;
  }

  adminBook(): Promise<WaitBook> {
    return this.book((rid) => ({ t: 'admin.book', rid }));
  }

  adminStrike(id: string): Promise<WaitBook> {
    return this.book((rid) => ({ t: 'admin.strike', rid, id }));
  }

  adminStop(id: string): Promise<WaitBook> {
    return this.book((rid) => ({ t: 'admin.stop', rid, id }));
  }

  adminCircular(subject: string, body: string, audience: Audience): Promise<WaitBook> {
    return this.book((rid) => ({ t: 'admin.circular', rid, subject, body, audience }));
  }

  /** the circular as a proof, to the direction's own address only */
  async adminTrial(subject: string, body: string, audience: Audience): Promise<void> {
    await this.ask((rid) => ({ t: 'admin.circular', rid, subject, body, audience, trial: true }));
  }

  /** a fault of this page, for the office's log: goes even before sign-in,
   *  and waits in the outbox while the line is down */
  fault(f: Omit<Extract<ClientMessage, { t: 'fault' }>, 't'>): void {
    this.post({ t: 'fault', ...f }, true);
  }

  send(m: ClientMessage): void {
    this.post(m, false);
  }

  /** send a request and wait for the frame that answers it. `asStranger`
   *  is for the two things a socket may say before it is known; `held` for
   *  a request that must still go out once its answer is given up on. */
  ask(make: (rid: number) => ClientMessage, asStranger = false, held = false): Promise<ServerMessage> {
    const rid = ++this.rid;
    return new Promise<ServerMessage>((ok, ko) => {
      const timer = window.setTimeout(() => {
        this.waiting.delete(rid);
        /* an answer given up on must not go out later on its own — unless
           what it asked is worth saying late rather than never */
        if (!held) this.outbox = this.outbox.filter((m) => !('rid' in m) || m.rid !== rid);
        ko(new Error(OFFLINE));
      }, ANSWER_MS);
      this.waiting.set(rid, { ok, ko, timer });
      this.post(make(rid), asStranger);
    });
  }

  /** out on the wire now, or held until the socket is known */
  private post(m: ClientMessage, asStranger: boolean): void {
    if ((this.known || asStranger) && this.socket?.readyState === WebSocket.OPEN) this.socket.send(encode(m));
    else {
      /* a move or an undo is meant for the table as it stands now: held
         back, it would play on a table that has moved on — and so are the
         figures of a reading, which are read again rather than kept waiting */
      if (m.t !== 'act' && m.t !== 'undo' && m.t !== 'analysis.post' && m.t !== 'analysis.claim') this.outbox.push(m);
      this.open();
    }
  }

  /* ---------------------------- accounts --------------------------- */

  async signUp(name: string, email: string, password: string): Promise<Me> {
    return this.enter(await this.ask((rid) => ({ t: 'signup', rid, name, email, password, accept: true }), true));
  }

  async signIn(name: string, password: string): Promise<Me> {
    return this.enter(await this.ask((rid) => ({ t: 'signin', rid, name, password }), true));
  }

  /** the letter's link, followed: signed in as a courtesy when nobody was */
  async verify(token: string): Promise<void> {
    const m = await this.ask((rid) => ({ t: 'verify', rid, token }), true);
    if (m.t === 'session') this.enter(m);
  }

  async forgot(email: string): Promise<void> {
    await this.ask((rid) => ({ t: 'forgot', rid, email }), true);
  }

  async reset(token: string, password: string): Promise<Me> {
    return this.enter(await this.ask((rid) => ({ t: 'reset', rid, token, password }), true));
  }

  /** everything the register holds under my name */
  async exportData(): Promise<Record<string, unknown>> {
    const m = await this.ask((rid) => ({ t: 'export', rid }));
    return m.t === 'export' ? m.data : {};
  }

  /** the account closed for good: the office forgets me, and so does this socket */
  async closeAccount(password: string): Promise<void> {
    await this.ask((rid) => ({ t: 'close', rid, password }));
    this.signOut();
  }

  /** a new password: the office hands out a fresh session for it */
  async changePassword(current: string, next: string): Promise<void> {
    this.enter(await this.ask((rid) => ({ t: 'password', rid, current, next })));
  }

  signOut(): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(encode({ t: 'signout' }));
    this.token = null;
    this.known = false;
    this.outbox = [];
    this.watching.clear();
    /* nothing asked under the old session may be answered under the next */
    for (const [, w] of this.waiting) {
      window.clearTimeout(w.timer);
      w.ko(new Error('offline'));
    }
    this.waiting.clear();
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* non-fatal */
    }
    this.setSession(null);
  }

  private enter(m: ServerMessage): Me {
    if (m.t !== 'session') throw new Error('refused');
    this.token = m.token;
    try {
      localStorage.setItem(TOKEN_KEY, m.token);
    } catch {
      /* the session lasts as long as this page then */
    }
    this.known = true;
    this.setSession(m.me);
    this.flush();
    return m.me;
  }

  /* ----------------------------- tables ---------------------------- */

  /** follow a table: the server pushes every change of it, reconnections included */
  watch(code: string): void {
    this.watching.add(code);
    this.send({ t: 'watch', code });
  }

  unwatch(code: string): void {
    this.watching.delete(code);
  }

  /* --------------------------- the socket -------------------------- */

  private open(): void {
    if (this.socket || this.timer !== null) return;
    this.setStatus('connecting');
    let socket: WebSocket;
    try {
      socket = new WebSocket(this.url);
    } catch {
      this.setStatus('offline');
      this.retry();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      this.attempt = 0;
      this.setStatus('online');
      /* a socket is nobody until it presents its token */
      if (this.token) socket.send(encode({ t: 'auth', token: this.token }));
      else this.drain();
    };
    socket.onmessage = (e: MessageEvent<string>) => this.receive(decode<ServerMessage>(String(e.data)));
    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      this.known = false;
      this.setStatus('offline');
      this.retry();
    };
    socket.onerror = () => socket.close();
  }

  private receive(m: ServerMessage | null): void {
    if (!m) return;
    if (m.t === 'welcome') {
      this.known = true;
      this.setSession(m.me);
      this.flush();
    }
    /* the account changed (verified, a new motto): every page hears it */
    if (m.t === 'me') this.setSession(m.me);
    if (m.t === 'desk') {
      this.desk = m.desk;
      for (const cb of this.desks) cb();
    }
    /* dealt from a queue: the room is told, and the page goes to the table */
    if (m.t === 'seated' && m.rid === 0) {
      this.dealt = m.table.code;
      for (const cb of this.desks) cb();
    }
    if (m.t === 'tables') {
      this.tables = m.page;
      for (const cb of this.halls) cb();
    }
    if (m.t === 'leaderboard') {
      this.board = m.board;
      for (const cb of this.halls) cb();
    }
    if (m.t === 'challenge') {
      this.challenges.set(m.board.week, m.board);
      for (const cb of this.halls) cb();
    }
    if (m.t === 'edition') {
      this.editions.set(m.edition.week, m.edition);
      for (const cb of this.halls) cb();
    }
    if (m.t === 'seasons') {
      this.seasons = m.seasons;
      for (const cb of this.halls) cb();
    }
    if (m.t === 'season') {
      this.reviews.set(m.review.season.id, m.review);
      for (const cb of this.halls) cb();
    }
    if (m.t === 'companies') {
      this.companies = m.board;
      for (const cb of this.halls) cb();
    }
    /* the register of games at home: answered once, then pushed whenever it
       moves — two tabs of one account never disagree about what was played */
    if (m.t === 'home.register') {
      this.home = m.games;
      for (const cb of this.homes) cb();
    }
    if (m.t === 'home.refused') for (const cb of this.refusals) cb({ code: m.code, at: m.at, error: m.error });
    /* the queue moved: the desk says where I stand, so ask it again */
    if (m.t === 'queue' && this.desk) {
      this.desk = { ...this.desk, queue: m.state };
      for (const cb of this.desks) cb();
    }
    /* the token no longer stands for anyone: sign in again */
    if (m.t === 'refused' && m.error === 'no-session') {
      this.token = null;
      this.known = false;
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch {
        /* non-fatal */
      }
      this.setSession(null);
    }
    if ('rid' in m && typeof m.rid === 'number') {
      const w = this.waiting.get(m.rid);
      if (w) {
        window.clearTimeout(w.timer);
        this.waiting.delete(m.rid);
        if (m.t === 'refused') w.ko(new Error(m.error));
        else w.ok(m);
      }
    }
    for (const cb of this.frames) cb(m);
  }

  /** recognised at last: follow the tables again, then say what was held */
  private flush(): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    for (const code of this.watching) socket.send(encode({ t: 'watch', code }));
    /* the desk may have moved while the line was down */
    if (this.desk) socket.send(encode({ t: 'desk' }));
    /* and so may the register of games at home — another tab plays too */
    if (this.home) socket.send(encode({ t: 'home.list', rid: 0 }));
    this.drain();
  }

  private drain(): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const held = this.outbox;
    this.outbox = [];
    for (const m of held) socket.send(encode(m));
  }

  private retry(): void {
    if (this.timer !== null) return;
    const wait = Math.min(MAX_BACKOFF, 400 * 2 ** this.attempt++);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.open();
    }, wait);
  }

  private setStatus(status: WireStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const cb of this.states) cb();
  }

  private setSession(session: Me | null): void {
    this.session = session;
    if (!session) {
      this.desk = null;
      for (const cb of this.desks) cb();
    }
    for (const cb of this.sessions) cb();
  }
}
