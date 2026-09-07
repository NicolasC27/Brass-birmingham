import { decode, encode } from './protocol';
import type { ClientMessage, ServerMessage } from './protocol';
import type { Identity } from './table';

/* ------------------------------------------------------------------ */
/* The wire — one socket to the table server, kept alive.              */
/*                                                                     */
/* Everything online rides on it: the lobby client and the game store   */
/* both listen here. It says hello on every connection, follows again   */
/* the tables it was following, and holds what could not be sent until  */
/* the line is back, so a dropped connection costs a reconnection and   */
/* nothing else — the server still has the log.                        */
/* ------------------------------------------------------------------ */

export type WireStatus = 'offline' | 'connecting' | 'online';

const MAX_BACKOFF = 8000;

export class Wire {
  readonly url: string;
  me: Identity;
  status: WireStatus = 'offline';
  private socket: WebSocket | null = null;
  private outbox: ClientMessage[] = [];
  private frames = new Set<(m: ServerMessage) => void>();
  private states = new Set<() => void>();
  private watching = new Set<string>();
  private attempt = 0;
  private timer: number | null = null;

  constructor(url: string, me: Identity) {
    this.url = url;
    this.me = me;
    this.open();
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

  send(m: ClientMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.send(encode(m));
    else {
      this.outbox.push(m);
      this.open();
    }
  }

  /** follow a table: the server pushes every change of it, reconnections included */
  watch(code: string): void {
    this.watching.add(code);
    this.send({ t: 'watch', code });
  }

  unwatch(code: string): void {
    this.watching.delete(code);
  }

  setName(name: string): void {
    this.me = { ...this.me, name };
    this.send({ t: 'hello', id: this.me.id, name });
  }

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
      socket.send(encode({ t: 'hello', id: this.me.id, name: this.me.name }));
      for (const code of this.watching) socket.send(encode({ t: 'watch', code }));
      const held = this.outbox;
      this.outbox = [];
      for (const m of held) socket.send(encode(m));
    };
    socket.onmessage = (e: MessageEvent<string>) => {
      const m = decode<ServerMessage>(String(e.data));
      if (m) for (const cb of this.frames) cb(m);
    };
    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      this.setStatus('offline');
      this.retry();
    };
    socket.onerror = () => socket.close();
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
}
