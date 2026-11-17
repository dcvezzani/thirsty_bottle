import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { createApp, type App, type AppOptions } from '../src/app.js';
import type { ServerMessage, TableView, TablePatch } from '@vct/shared';

export interface TestServer {
  app: App;
  port: number;
  url: string;
  dataDir: string;
  stop(keepData?: boolean): Promise<void>;
}

export async function startServer(opts: Partial<AppOptions> = {}, dataDir?: string): Promise<TestServer> {
  const dir = dataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'vct-'));
  const app = await createApp({ dataDir: dir, quiet: true, clientDir: '/nonexistent', ...opts });
  const port = await app.listen(0, '127.0.0.1');
  return {
    app,
    port,
    url: `http://127.0.0.1:${port}`,
    dataDir: dir,
    async stop(keepData = false) {
      await app.close();
      if (!keepData) fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

export async function api(srv: TestServer, method: string, url: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = {};
  if (body !== undefined && !(body instanceof FormData)) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(srv.url + url, {
    method,
    headers,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const ct = res.headers.get('content-type') ?? '';
  const data = ct.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { status: res.status, data: data as any, headers: res.headers };
}

export async function newPlayer(srv: TestServer, name: string, color = '#336699') {
  const r = await api(srv, 'POST', '/api/players', { name, color });
  if (r.status !== 200) throw new Error(JSON.stringify(r.data));
  return r.data as { token: string; player: { id: string; name: string; color: string } };
}

/** A WebSocket test client that records every message and keeps a live table view. */
export class Client {
  ws!: WebSocket;
  msgs: ServerMessage[] = [];
  rawFrames: string[] = [];
  private rid = 0;
  private waiters: { pred: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];
  table: TableView | null = null;
  seq = 0;
  closed = false;

  constructor(
    public srv: TestServer,
    public token: string,
    public id: string,
    public name: string,
  ) {}

  static async connect(srv: TestServer, name: string) {
    const p = await newPlayer(srv, name);
    const c = new Client(srv, p.token, p.player.id, name);
    await c.open();
    return c;
  }

  async open() {
    this.closed = false;
    this.ws = new WebSocket(`ws://127.0.0.1:${this.srv.port}/ws`);
    this.ws.on('message', (d) => {
      const raw = d.toString();
      this.rawFrames.push(raw);
      const m = JSON.parse(raw) as ServerMessage;
      this.msgs.push(m);
      this.applyTable(m);
      this.waiters = this.waiters.filter((w) => {
        if (w.pred(m)) {
          w.resolve(m);
          return false;
        }
        return true;
      });
    });
    this.ws.on('close', () => (this.closed = true));
    await new Promise<void>((res, rej) => {
      this.ws.once('open', () => res());
      this.ws.once('error', rej);
    });
    await this.req({ t: 'hello', token: this.token });
  }

  private applyTable(m: ServerMessage) {
    if (m.t === 'table.snapshot') this.table = m.table;
    if (m.t === 'table.patch' && this.table && m.tableId === this.table.id) applyPatch(this.table, m.patch);
    if (m.t === 'table.left') this.table = null;
  }

  send(m: any) {
    this.ws.send(typeof m === 'string' ? m : JSON.stringify(m));
  }

  wait(pred: (m: ServerMessage) => boolean, timeout = 3000): Promise<ServerMessage> {
    const found = this.msgs.find(pred);
    if (found) return Promise.resolve(found);
    return new Promise((resolve, reject) => {
      const w = { pred, resolve };
      this.waiters.push(w);
      setTimeout(() => {
        this.waiters = this.waiters.filter((x) => x !== w);
        reject(new Error(`timeout waiting in ${this.name}; last: ${JSON.stringify(this.msgs.slice(-3)).slice(0, 500)}`));
      }, timeout);
    });
  }

  /** Waits for the *next* message matching pred (ignoring already received ones). */
  next(pred: (m: ServerMessage) => boolean, timeout = 3000): Promise<ServerMessage> {
    return new Promise((resolve, reject) => {
      const w = { pred, resolve };
      this.waiters.push(w);
      setTimeout(() => {
        this.waiters = this.waiters.filter((x) => x !== w);
        reject(new Error(`timeout (next) in ${this.name}`));
      }, timeout);
    });
  }

  async req(m: any): Promise<any> {
    const rid = ++this.rid;
    const p = this.next((x) => x.t === 'reply' && x.rid === rid);
    this.send({ ...m, rid });
    const r = (await p) as any;
    if (!r.ok) {
      const e = new Error(r.error) as any;
      e.code = r.code;
      throw e;
    }
    return r.data;
  }

  async reqErr(m: any): Promise<{ code: string; error: string }> {
    try {
      await this.req(m);
    } catch (e: any) {
      return { code: e.code, error: e.message };
    }
    throw new Error('expected failure');
  }

  /** Sends an intent and resolves with the ack. */
  async act(action: any): Promise<any> {
    const seq = ++this.seq;
    const ack = this.next((m) => m.t === 'table.ack' && m.seq === seq);
    await this.req({ t: 'table.intent', tableId: this.table!.id, seq, action });
    return ack;
  }

  zone(name: string) {
    return this.table!.zones.find((z) => z.name === name)!;
  }
  myHand() {
    return this.table!.zones.find((z) => z.kind === 'hand' && z.seatId === this.table!.me.seatId)!;
  }
  handOf(c: Client) {
    const seat = this.table!.seats.find((s) => s.playerId === c.id)!;
    return this.table!.zones.find((z) => z.kind === 'hand' && z.seatId === seat.id)!;
  }

  close() {
    this.ws.close();
  }
}

export function applyPatch(t: TableView, p: TablePatch) {
  t.version = p.version;
  if (p.zones) {
    for (const z of p.zones) {
      const i = t.zones.findIndex((x) => x.id === z.id);
      if (i >= 0) t.zones[i] = z;
      else t.zones.push(z);
    }
  }
  if (p.zoneOrder) {
    const byId = new Map(t.zones.map((z) => [z.id, z]));
    t.zones = p.zoneOrder.map((id) => byId.get(id)!).filter(Boolean);
  }
  if (p.meta) Object.assign(t, p.meta);
  if (p.log) t.log = t.log.concat(p.log);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function until(cond: () => boolean, timeout = 3000) {
  const end = Date.now() + timeout;
  while (!cond()) {
    if (Date.now() > end) throw new Error('until: timeout');
    await sleep(10);
  }
}
