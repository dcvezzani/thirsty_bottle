import { describe, expect, it } from 'vitest';
import { Socket, type SocketLike } from './socket';

class FakeWS implements SocketLike {
  static all: FakeWS[] = [];
  readyState = 0;
  sent: any[] = [];
  onopen: any = null;
  onclose: any = null;
  onmessage: any = null;
  onerror: any = null;
  constructor(public url: string) {
    FakeWS.all.push(this);
  }
  send(d: string) {
    this.sent.push(JSON.parse(d));
  }
  close() {
    this.readyState = 3;
    this.onclose?.({});
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  reply(rid: number, data: any = {}) {
    this.onmessage?.({ data: JSON.stringify({ t: 'reply', rid, ok: true, data }) });
  }
  push(m: any) {
    this.onmessage?.({ data: JSON.stringify(m) });
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  FakeWS.all = [];
  const timers: { f: () => void; ms: number }[] = [];
  const statuses: string[] = [];
  const hellos: any[] = [];
  const s = new Socket({
    url: 'ws://x/ws',
    token: 'tok-0123456789abcdef',
    create: (u) => new FakeWS(u),
    onStatus: (st) => statuses.push(st),
    onHello: (d) => hellos.push(d),
    setTimer: (f, ms) => (timers.push({ f, ms }), timers.length),
    clearTimer: () => {},
  });
  return { s, timers, statuses, hellos };
}

describe('connection store / socket (6.1)', () => {
  it('sends hello with the tab token on connect and becomes online on reply', async () => {
    const { s, statuses, hellos } = setup();
    s.start();
    const ws = FakeWS.all[0];
    ws.open();
    expect(ws.sent[0]).toMatchObject({ t: 'hello', token: 'tok-0123456789abcdef' });
    ws.reply(ws.sent[0].rid, { player: { id: 'p1' } });
    await flush();
    expect(statuses).toEqual(['connecting', 'online']);
    expect(hellos).toEqual([{ player: { id: 'p1' } }]);
  });

  it('reconnects with exponential backoff and re-sends hello', async () => {
    const { s, timers, statuses } = setup();
    s.start();
    FakeWS.all[0].open();
    FakeWS.all[0].reply(1);
    await flush();
    FakeWS.all[0].close();
    expect(statuses.at(-1)).toBe('offline');
    expect(timers.map((t) => t.ms)).toEqual([500]);
    timers[0].f();
    FakeWS.all[1].close(); // fails again
    expect(timers.map((t) => t.ms)).toEqual([500, 1000]);
    timers[1].f();
    const ws = FakeWS.all[2];
    ws.open();
    expect(ws.sent[0].t).toBe('hello');
    ws.reply(ws.sent[0].rid);
    await flush();
    expect(statuses.at(-1)).toBe('online');
    expect(Socket.backoff(10)).toBe(10_000); // capped
  });

  it('resolves requests by rid and rejects them when the connection drops', async () => {
    const { s } = setup();
    s.start();
    const ws = FakeWS.all[0];
    ws.open();
    ws.reply(1);
    await flush();
    const p = s.request({ t: 'ping' } as any);
    const rid = ws.sent[1].rid;
    ws.reply(rid, { ok: 1 });
    await expect(p).resolves.toEqual({ ok: 1 });
    const q = s.request({ t: 'ping' } as any);
    ws.close();
    await expect(q).rejects.toMatchObject({ code: 'OFFLINE' });
  });

  it('queues messages while offline and flushes after hello', async () => {
    const { s } = setup();
    s.start();
    s.send({ t: 'chat.send', channel: 'lobby', text: 'hi' } as any);
    const ws = FakeWS.all[0];
    ws.open();
    expect(ws.sent.map((m) => m.t)).toEqual(['hello']);
    ws.reply(ws.sent[0].rid);
    await flush();
    expect(ws.sent.map((m) => m.t)).toEqual(['hello', 'chat.send']);
  });

  it('stops reconnecting when the session is replaced by another window', async () => {
    const { s, timers, statuses } = setup();
    s.start();
    const ws = FakeWS.all[0];
    ws.open();
    ws.reply(1);
    await flush();
    ws.push({ t: 'session.replaced' });
    ws.close();
    expect(statuses.at(-1)).toBe('replaced');
    expect(timers).toHaveLength(0);
    s.reconnectNow(); // "take it back"
    expect(FakeWS.all).toHaveLength(2);
  });
});
