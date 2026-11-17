import type { ClientMessage, ServerMessage } from '@vct/shared';

type Listener = (m: ServerMessage) => void;
export type ConnStatus = 'connecting' | 'online' | 'offline' | 'replaced';

export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((ev: any) => void) | null;
  onclose: ((ev: any) => void) | null;
  onmessage: ((ev: { data: any }) => void) | null;
  onerror: ((ev: any) => void) | null;
}

export interface SocketOptions {
  url: string;
  token: string;
  create?: (url: string) => SocketLike;
  onStatus?: (s: ConnStatus) => void;
  onHello?: (data: any) => void;
  /** Backoff: base delay doubling up to max. */
  baseDelay?: number;
  maxDelay?: number;
  setTimer?: (f: () => void, ms: number) => any;
  clearTimer?: (t: any) => void;
}

/**
 * WebSocket client with automatic reconnect + exponential backoff, request/reply by rid,
 * and a hello handshake on every (re)connection using this tab's token.
 */
export class Socket {
  private ws: SocketLike | null = null;
  private listeners = new Set<Listener>();
  private pending = new Map<number, { resolve: (d: any) => void; reject: (e: any) => void }>();
  private rid = 0;
  private attempt = 0;
  private timer: any = null;
  private stopped = false;
  status: ConnStatus = 'connecting';
  private queue: string[] = [];

  constructor(private o: SocketOptions) {}

  start() {
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.timer) (this.o.clearTimer ?? clearTimeout)(this.timer);
    this.ws?.close();
  }

  private setStatus(s: ConnStatus) {
    this.status = s;
    this.o.onStatus?.(s);
  }

  private connect() {
    this.setStatus('connecting');
    const ws = (this.o.create ?? ((u) => new WebSocket(u) as any))(this.o.url);
    this.ws = ws;
    ws.onopen = () => {
      this.request({ t: 'hello', token: this.o.token } as ClientMessage, true)
        .then((data) => {
          this.attempt = 0;
          this.setStatus('online');
          const q = this.queue;
          this.queue = [];
          q.forEach((m) => ws.send(m));
          this.o.onHello?.(data);
        })
        .catch(() => {});
    };
    ws.onmessage = (ev: { data: any }) => {
      const m = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)) as ServerMessage;
      if (m.t === 'reply') {
        const p = this.pending.get(m.rid);
        if (p) {
          this.pending.delete(m.rid);
          if (m.ok) p.resolve(m.data);
          else p.reject(Object.assign(new Error(m.error), { code: m.code }));
        }
        return;
      }
      if (m.t === 'session.replaced') {
        this.stopped = true;
        this.setStatus('replaced');
      }
      this.listeners.forEach((l) => l(m));
    };
    ws.onclose = () => {
      for (const [, p] of this.pending) p.reject(Object.assign(new Error('Connection lost'), { code: 'OFFLINE' }));
      this.pending.clear();
      if (this.stopped) {
        if (this.status !== 'replaced') this.setStatus('offline');
        return;
      }
      this.setStatus('offline');
      this.scheduleReconnect();
    };
    ws.onerror = () => {};
  }

  /** Delay for the n-th reconnect attempt (exponential backoff with cap). */
  static backoff(attempt: number, base = 500, max = 10_000) {
    return Math.min(max, base * 2 ** attempt);
  }

  private scheduleReconnect() {
    const delay = Socket.backoff(this.attempt, this.o.baseDelay, this.o.maxDelay);
    this.attempt += 1;
    this.timer = (this.o.setTimer ?? setTimeout)(() => {
      this.timer = null;
      if (!this.stopped) this.connect();
    }, delay);
  }

  /** Reconnect immediately (e.g. the user pressed "take back" or the browser came online). */
  reconnectNow() {
    if (this.timer) (this.o.clearTimer ?? clearTimeout)(this.timer);
    this.timer = null;
    this.stopped = false;
    this.attempt = 0;
    if (this.ws && this.ws.readyState <= 1) this.ws.close();
    else this.connect();
  }

  on(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  send(m: ClientMessage, bypassQueue = false) {
    const s = JSON.stringify(m);
    if (this.ws && this.ws.readyState === 1 && (this.status === 'online' || bypassQueue)) this.ws.send(s);
    else if ((m as any).t !== 'table.drag') this.queue.push(s);
  }

  request<T = any>(m: ClientMessage, bypassQueue = false): Promise<T> {
    const rid = ++this.rid;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(rid, { resolve, reject });
      this.send({ ...(m as any), rid }, bypassQueue);
    });
  }
}
