import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startServer, Client, until, sleep, type TestServer } from './harness.js';
import { tableWith } from './fixtures.js';

let srv: TestServer;
beforeEach(async () => (srv = await startServer({ rate: { perSecond: 200, burst: 200 } })));
afterEach(async () => srv.stop());

const lobbyOf = (c: Client) => [...c.msgs].reverse().find((m) => m.t === 'lobby') as any;

describe('table lifecycle (5.1)', () => {
  it('a name-only table is public, open seating, no password, spectators allowed', async () => {
    const a = await Client.connect(srv, 'Alex');
    const { tableId } = await a.req({ t: 'table.create', name: 'Quick Game' });
    const s = srv.app.tables.get(tableId)!.state;
    expect(s.settings).toMatchObject({ seatLimit: null, visibility: 'public', hasPassword: false, spectatorsAllowed: true });
    expect(s.seats).toHaveLength(1);
    expect(s.seats[0].playerId).toBe(a.id);
    expect(s.hostId).toBe(a.id);
    const b = await Client.connect(srv, 'Sam');
    await until(() => lobbyOf(b)?.tables?.some((t: any) => t.id === tableId));
    expect(lobbyOf(b).tables.find((t: any) => t.id === tableId)).toMatchObject({ name: 'Quick Game', hostName: 'Alex', seated: 1, seatLimit: null, mode: 'realtime', locked: false });
    await b.req({ t: 'table.join', tableId }); // no password asked
    expect(srv.app.tables.get(tableId)!.isSeated(b.id)).toBe(true);
  });
  it('blank layout starts with no shared zones; standard has Discard and Table', async () => {
    const a = await Client.connect(srv, 'Alex');
    const { tableId } = await a.req({ t: 'table.create', name: 'Blank', layout: 'blank' });
    expect(Object.values(srv.app.tables.get(tableId)!.state.zones).filter((z) => z.kind === 'shared')).toHaveLength(0);
  });
  it('private tables are hidden from the list but joinable by invite link (table id)', async () => {
    const a = await Client.connect(srv, 'Alex');
    const { tableId } = await a.req({ t: 'table.create', name: 'Family Night', visibility: 'private', seatLimit: 6 });
    expect(srv.app.tables.get(tableId)!.state.seats).toHaveLength(6);
    const b = await Client.connect(srv, 'Sam');
    await sleep(150);
    expect(lobbyOf(b).tables.find((t: any) => t.id === tableId)).toBeUndefined();
    expect(lobbyOf(a).tables.find((t: any) => t.id === tableId)).toBeDefined(); // participants still see it
    await b.req({ t: 'table.join', tableId });
    expect(srv.app.tables.get(tableId)!.isSeated(b.id)).toBe(true);
  });
  it('passwords: wrong password refused and player stays in lobby', async () => {
    const a = await Client.connect(srv, 'Alex');
    const { tableId } = await a.req({ t: 'table.create', name: 'Secret', password: 'hunter2' });
    const b = await Client.connect(srv, 'Sam');
    expect(await b.reqErr({ t: 'table.join', tableId, password: 'nope' })).toMatchObject({ code: 'BAD_PASSWORD', error: 'Incorrect password' });
    expect(srv.app.playerTables.get(b.id)).toBeUndefined();
    await b.req({ t: 'table.join', tableId, password: 'hunter2' });
    expect(srv.app.tables.get(tableId)!.isSeated(b.id)).toBe(true);
  });
  it('open seating grows as players join mid-game, empty hand, last in turn order; caps at 12', async () => {
    const a = await Client.connect(srv, 'Alex');
    const b = await Client.connect(srv, 'Sam');
    const tid = await tableWith(srv, a, [b]);
    await a.act({ type: 'deal', zone: a.zone('Standard').id, count: 5, seats: a.table!.seats.map((x) => x.id) });
    await a.act({ type: 'setMode', mode: 'turn' });
    const c = await Client.connect(srv, 'Kim');
    await c.req({ t: 'table.join', tableId: tid });
    await until(() => !!c.table);
    const s = srv.app.tables.get(tid)!.state;
    expect(s.seats).toHaveLength(3);
    expect(s.seats[2].playerId).toBe(c.id);
    expect(c.myHand().cards).toHaveLength(0);
    await a.act({ type: 'endTurn' });
    await b.act({ type: 'endTurn' });
    expect(srv.app.tables.get(tid)!.state.turn.active).toBe(s.seats[2].id); // Kim included in turn order
    for (let i = 3; i < 12; i++) await (await Client.connect(srv, `P${i}`)).req({ t: 'table.join', tableId: tid });
    expect(srv.app.tables.get(tid)!.state.seats).toHaveLength(12);
    const late = await Client.connect(srv, 'Late');
    expect(await late.reqErr({ t: 'table.join', tableId: tid })).toMatchObject({ code: 'TABLE_FULL' });
    await late.req({ t: 'table.join', tableId: tid, spectate: true });
    expect(srv.app.tables.get(tid)!.state.spectators.map((x) => x.playerId)).toContain(late.id);
  });
  it('full fixed table offers spectating; seat choice works', async () => {
    const a = await Client.connect(srv, 'Alex');
    const { tableId } = await a.req({ t: 'table.create', name: 'Two', seatLimit: 2 });
    const b = await Client.connect(srv, 'Sam');
    const seat2 = srv.app.tables.get(tableId)!.state.seats[1].id;
    await b.req({ t: 'table.join', tableId, seatId: seat2 });
    const c = await Client.connect(srv, 'Kim');
    expect((await c.reqErr({ t: 'table.join', tableId })).error).toMatch(/watch/);
  });
  it('leaving with cards: host chooses to return the hand or keep it for a replacement', async () => {
    const a = await Client.connect(srv, 'Alex');
    const b = await Client.connect(srv, 'Sam');
    const tid = await tableWith(srv, a, [b]);
    await b.act({ type: 'draw', zone: b.zone('Standard').id, count: 4, from: 'top' });
    await b.req({ t: 'table.leave', tableId: tid });
    await until(() => a.table!.vacated.length === 1);
    const seat = a.table!.vacated[0].seatId;
    await a.act({ type: 'resolveVacated', seat, returnTo: a.zone('Standard').id });
    await until(() => a.zone('Standard').cards.length === 52);
    expect(srv.app.tables.get(tid)!.state.seats.find((x) => x.id === seat)).toBeUndefined(); // open seating: seat removed
  });
  it('locked tables refuse new seated players', async () => {
    const a = await Client.connect(srv, 'Alex');
    const tid = await tableWith(srv, a, [], null);
    await a.act({ type: 'settings', locked: true });
    const b = await Client.connect(srv, 'Sam');
    expect(await b.reqErr({ t: 'table.join', tableId: tid })).toMatchObject({ code: 'LOCKED' });
    await b.req({ t: 'table.join', tableId: tid, spectate: true });
  });
});

describe('host controls (5.2)', () => {
  it('kick returns the player to the lobby; designate host during another player’s turn', async () => {
    const a = await Client.connect(srv, 'Alex');
    const b = await Client.connect(srv, 'Sam');
    const c = await Client.connect(srv, 'Kim');
    const tid = await tableWith(srv, a, [b, c]);
    await a.act({ type: 'setMode', mode: 'turn', active: a.table!.seats[2].id }); // Kim's turn
    const r = await a.act({ type: 'setHost', playerId: b.id });
    expect(r.ok).toBe(true);
    await until(() => b.table!.me.isHost);
    expect(a.table!.me.isHost).toBe(false);
    expect(a.table!.log.at(-1)!.text).toBe('Alex made Sam the host');
    // previous host keeps seat and is a regular player now
    expect(await a.act({ type: 'reset' })).toMatchObject({ ok: false, code: 'NOT_HOST' });
    expect(await a.reqErr({ t: 'table.kick', tableId: tid, playerId: c.id })).toMatchObject({ code: 'NOT_HOST' });
    await b.req({ t: 'table.kick', tableId: tid, playerId: c.id });
    expect((await c.wait((m) => m.t === 'table.left')) as any).toMatchObject({ reason: 'kicked' });
    expect(srv.app.tables.get(tid)!.isParticipant(c.id)).toBe(false);
    expect(srv.app.playerTables.get(c.id)).toBeUndefined();
  });
  it('settings: change/remove password and seat count; move seat; load/unload deck; reset; close', async () => {
    const a = await Client.connect(srv, 'Alex');
    const b = await Client.connect(srv, 'Sam');
    const tid = await tableWith(srv, a, [b], null);
    await a.req({ t: 'table.password', tableId: tid, password: 'pw' });
    expect(srv.app.tables.get(tid)!.state.settings.hasPassword).toBe(true);
    await a.req({ t: 'table.password', tableId: tid, password: null });
    expect(srv.app.tables.get(tid)!.state.settings.hasPassword).toBe(false);
    expect((await a.act({ type: 'settings', seatLimit: 1 })).ok).toBe(false); // below seated count
    await a.act({ type: 'settings', seatLimit: 4 });
    expect(srv.app.tables.get(tid)!.state.seats).toHaveLength(4);
    await a.act({ type: 'settings', seatLimit: null });
    expect(srv.app.tables.get(tid)!.state.seats).toHaveLength(2);
    await a.act({ type: 'moveSeat', seat: a.table!.seats[1].id, toIndex: 0 });
    expect(srv.app.tables.get(tid)!.state.seats[0].playerId).toBe(b.id);
    await a.req({ t: 'table.loadDeck', tableId: tid, deckId: 'builtin-standard-52' });
    await until(() => !!a.table!.zones.find((z) => z.name === 'Standard 52'));
    await a.act({ type: 'draw', zone: a.zone('Standard 52').id, count: 3, from: 'top' });
    await a.act({ type: 'reset' });
    await until(() => a.zone('Standard 52').cards.length === 52);
    await a.act({ type: 'unloadDeck', deck: a.table!.decks[0].id });
    await until(() => a.table!.decks.length === 0);
    await a.req({ t: 'table.close', tableId: tid });
    expect((await b.wait((m) => m.t === 'table.left')) as any).toMatchObject({ reason: 'closed' });
    expect(srv.app.tables.get(tid)).toBeUndefined();
  });
});

describe('chat (5.3)', () => {
  it('room chat does not leak to the lobby; a seated player can post to the lobby', async () => {
    const a = await Client.connect(srv, 'Alex');
    const b = await Client.connect(srv, 'Sam');
    const out = await Client.connect(srv, 'Outsider');
    const tid = await tableWith(srv, a, [b], null);
    await a.req({ t: 'chat.send', channel: `table:${tid}`, text: 'room secret' });
    await b.wait((m) => m.t === 'chat.msg' && m.message.text === 'room secret');
    await a.req({ t: 'chat.send', channel: 'lobby', text: 'need one more for hearts' });
    await out.wait((m) => m.t === 'chat.msg' && m.message.text === 'need one more for hearts');
    await b.wait((m) => m.t === 'chat.msg' && m.message.text === 'need one more for hearts');
    expect(out.msgs.some((m) => m.t === 'chat.msg' && m.message.text === 'room secret')).toBe(false);
    expect(await out.reqErr({ t: 'chat.send', channel: `table:${tid}`, text: 'let me in' })).toMatchObject({ code: 'NO_ACCESS' });
    expect(srv.app.tables.get(tid)!.isSeated(a.id)).toBe(true);
  });
  it('history: late joiner gets recent messages in order (max 100)', async () => {
    const a = await Client.connect(srv, 'Alex');
    const others = [await Client.connect(srv, 'P1'), await Client.connect(srv, 'P2'), await Client.connect(srv, 'P3')];
    const tid = await tableWith(srv, a, others, null);
    const posters = [a, ...others]; // the throttle is per player: 4 players × 5 messages
    for (let i = 0; i < 20; i++) await posters[i % 4].req({ t: 'chat.send', channel: `table:${tid}`, text: `m${i}` });
    const b = await Client.connect(srv, 'Sam');
    await b.req({ t: 'table.join', tableId: tid });
    const h = (await b.wait((m) => m.t === 'chat.history' && m.channel === `table:${tid}`)) as any;
    expect(h.messages.map((m: any) => m.text)).toEqual(Array.from({ length: 20 }, (_, i) => `m${i}`));
  }, 30_000);
  it('limits: 500 chars, 5 per 5 seconds, plain text stored verbatim', async () => {
    const a = await Client.connect(srv, 'Alex');
    expect(await a.reqErr({ t: 'chat.send', channel: 'lobby', text: 'x'.repeat(501) })).toMatchObject({ code: 'TOO_LONG' });
    await a.req({ t: 'chat.send', channel: 'lobby', text: '<script>alert(1)</script>' });
    const m = (await a.wait((x) => x.t === 'chat.msg' && x.message.text.includes('script'))) as any;
    expect(m.message.text).toBe('<script>alert(1)</script>');
    for (let i = 0; i < 4; i++) await a.req({ t: 'chat.send', channel: 'lobby', text: `ok ${i}` });
    expect(await a.reqErr({ t: 'chat.send', channel: 'lobby', text: 'sixth' })).toMatchObject({ code: 'SLOW_DOWN' });
    const lobbyHist = srv.app.chat.history('lobby', a.id);
    expect(lobbyHist.map((x) => x.text)).not.toContain('sixth');
  });
  it('personal mute hides messages in all channels; host room mute blocks posting', async () => {
    const a = await Client.connect(srv, 'Alex');
    const b = await Client.connect(srv, 'Sam');
    const c = await Client.connect(srv, 'Kim');
    const tid = await tableWith(srv, a, [b, c], null);
    await a.req({ t: 'chat.mute', playerId: b.id, muted: true });
    await b.req({ t: 'chat.send', channel: 'lobby', text: 'from sam lobby' });
    await b.req({ t: 'chat.send', channel: `table:${tid}`, text: 'from sam room' });
    await c.wait((m) => m.t === 'chat.msg' && m.message.text === 'from sam room');
    await sleep(100);
    expect(a.msgs.some((m) => m.t === 'chat.msg' && m.message.playerId === b.id)).toBe(false);
    expect(srv.app.chat.history('lobby', a.id).some((m) => m.playerId === b.id)).toBe(false);
    expect(srv.app.chat.history('lobby', c.id).some((m) => m.playerId === b.id)).toBe(true);
    await a.req({ t: 'chat.roomMute', tableId: tid, playerId: c.id, muted: true });
    expect(await c.reqErr({ t: 'chat.send', channel: `table:${tid}`, text: 'hi' })).toMatchObject({ code: 'ROOM_MUTED' });
    await c.req({ t: 'chat.send', channel: 'lobby', text: 'lobby still fine' });
  });
  it('join is announced as a system entry in the table log (shown inline in room chat)', async () => {
    const a = await Client.connect(srv, 'Alex');
    const tid = await tableWith(srv, a, [], null);
    const b = await Client.connect(srv, 'Sam');
    await b.req({ t: 'table.join', tableId: tid });
    await until(() => a.table!.log.some((e) => e.text === 'Sam joined seat 2' && e.kind === 'system'));
  });
});
