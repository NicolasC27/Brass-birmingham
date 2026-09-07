import { decode, encode } from './protocol';
import type { ClientMessage, ServerMessage } from './protocol';
import type { Desk, Me } from './table';

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

  send(m: ClientMessage): void {
    this.post(m, false);
  }

  /** send a request and wait for the frame that answers it. `asStranger`
   *  is for the two things a socket may say before it is known. */
  ask(make: (rid: number) => ClientMessage, asStranger = false): Promise<ServerMessage> {
    const rid = ++this.rid;
    return new Promise<ServerMessage>((ok, ko) => {
      const timer = window.setTimeout(() => {
        this.waiting.delete(rid);
        ko(new Error('offline'));
      }, ANSWER_MS);
      this.waiting.set(rid, { ok, ko, timer });
      this.post(make(rid), asStranger);
    });
  }

  /** out on the wire now, or held until the socket is known */
  private post(m: ClientMessage, asStranger: boolean): void {
    if ((this.known || asStranger) && this.socket?.readyState === WebSocket.OPEN) this.socket.send(encode(m));
    else {
      this.outbox.push(m);
      this.open();
    }
  }

  /* ---------------------------- accounts --------------------------- */

  async signUp(name: string, email: string, password: string): Promise<Me> {
    return this.enter(await this.ask((rid) => ({ t: 'signup', rid, name, email, password }), true));
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
