import WebSocket from 'ws';
import { decode, encode } from '@/online/protocol';
import type { ClientMessage, GameView, ServerMessage } from '@/online/protocol';
import type { Desk, Leaderboard, Me, PublicTable, QueueState, Table } from '@/online/table';
import type { Mail, Mailer } from '../mail';

/* ------------------------------------------------------------------ */
/* A player at the far end of a socket, for the tests: it keeps the    */
/* last of everything the server sent it, and waits for what it needs. */
/* ------------------------------------------------------------------ */

export const OPTIONS = { eraLength: 'short', marketTemper: 'standard', timerMinutes: null, fidelity: 'core' } as const;
export const PASSWORD = 'a-good-long-password';

/** the post, read by the tests: the last letter to each address */
export const letters = new Map<string, Mail>();
export const post: Mailer = {
  async send(mail) {
    letters.set(mail.to, mail);
  },
};
export const tokenIn = (mail: Mail | undefined, kind: 'verify' | 'reset'): string => mail?.text.match(new RegExp(`/account/${kind}/([a-f0-9]+)`))?.[1] ?? '';

export class Guest {
  readonly name: string;
  /** the account id, once the office has recognised it */
  id = '';
  token = '';
  private socket!: WebSocket;
  private rid = 0;
  table: Table | null = null;
  view: GameView | null = null;
  me: Me | null = null;
  desk: Desk | null = null;
  /** the last word on the queue (undefined: never told) */
  queue: QueueState | null | undefined = undefined;
  tables: PublicTable[] | null = null;
  board: Leaderboard | null = null;
  /** the rids answered with a plain `done` */
  done: number[] = [];
  rejected: string[] = [];
  /** the server hung up (the code it gave) */
  closedWith: number | null = null;
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
    this.socket.on('close', (code: number) => {
      this.closedWith = code;
    });
    this.socket.on('message', (raw: Buffer) => {
      const m = decode<ServerMessage>(String(raw));
      if (!m) return;
      this.trace.push(m.t);
      if (m.t === 'table') this.table = m.table;
      if (m.t === 'seated') this.table = m.table;
      if (m.t === 'me') this.me = m.me;
      if (m.t === 'desk') this.desk = m.desk;
      if (m.t === 'queue') this.queue = m.state;
      if (m.t === 'tables') this.tables = m.tables;
      if (m.t === 'leaderboard') this.board = m.board;
      if (m.t === 'done') this.done.push(m.rid);
      if (m.t === 'session') {
        this.me = m.me;
        this.id = m.me.id;
        this.token = m.token;
      }
      if (m.t === 'welcome') {
        this.id = m.me.id;
        this.me = m.me;
      }
      if (m.t === 'game') {
        this.view = m.view;
        this.seen.push(m.view);
      }
      if (m.t === 'rejected' || m.t === 'refused') this.rejected.push(m.error);
    });
  }

  get email(): string {
    return `${this.name.toLowerCase()}@example.test`;
  }

  /** open an account, be signed in with it, and answer the letter */
  async signUp(verify = true): Promise<void> {
    this.send({ t: 'signup', rid: ++this.rid, name: this.name, email: this.email, password: PASSWORD });
    await this.until('a session', () => !!this.id);
    if (!verify) return;
    await this.until('the letter', () => letters.has(this.email));
    this.send({ t: 'verify', rid: ++this.rid, token: tokenIn(letters.get(this.email), 'verify') });
    await this.until('the address to be verified', () => this.me?.verified === true);
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
