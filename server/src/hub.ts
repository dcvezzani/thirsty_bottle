import type { IncomingMessage } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  ActionError,
  ClientMessageSchema,
  MAX_MESSAGE_BYTES,
  tableChannel,
  type ClientMessage,
  type PlayerPublic,
  type ServerMessage,
} from '@vct/shared';
import argon2 from 'argon2';
import type { App } from './app.js';
import type { Player } from './players.js';
import { Bucket } from './util.js';
import { ChatError } from './chat.js';
import { HttpError } from './util.js';
import { Tables } from './tables.js';

interface Conn {
  ws: WebSocket;
  player: Player | null;
  bucket: Bucket;
  dragBucket: Bucket;
  connectedAt: number;
}

export class Hub {
  wss: WebSocketServer;
  private conns = new Map<string, Conn>(); // playerId → active connection
  private lobbyTimer: NodeJS.Timeout | null = null;

  constructor(private app: App) {
    // Allow larger frames at the transport level so oversized messages can be refused politely (connection stays open).
    this.wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
    this.wss.on('connection', (ws, req) => this.onConnection(ws, req));
  }

  isConnected(pid: string) {
    return this.conns.has(pid);
  }
  connectedIds() {
    return [...this.conns.keys()];
  }

  send(pid: string, msg: ServerMessage) {
    const c = this.conns.get(pid);
    if (c && c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(msg));
  }

  private raw(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  private onConnection(ws: WebSocket, _req: IncomingMessage) {
    const conn: Conn = {
      ws,
      player: null,
      bucket: new Bucket(this.app.opts.rate.perSecond, this.app.opts.rate.burst),
      dragBucket: new Bucket(30, 30),
      connectedAt: Date.now(),
    };
    const helloTimer = setTimeout(() => {
      if (!conn.player) ws.close(4000, 'hello required');
    }, 10_000);
    ws.on('message', (data, isBinary) => {
      const size = Array.isArray(data) ? data.reduce((n, b) => n + b.length, 0) : (data as Buffer).byteLength;
      if (isBinary || size > MAX_MESSAGE_BYTES) {
        this.raw(ws, { t: 'error', code: 'TOO_LARGE', error: `Messages are limited to ${MAX_MESSAGE_BYTES} bytes` });
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        this.raw(ws, { t: 'error', code: 'BAD_JSON', error: 'Message is not valid JSON' });
        return;
      }
      const r = ClientMessageSchema.safeParse(parsed);
      if (!r.success) {
        const rid = (parsed as any)?.rid;
        const error = `Invalid message: ${r.error.issues[0]?.path.join('.') || ''} ${r.error.issues[0]?.message ?? ''}`.trim();
        if (typeof rid === 'number') this.raw(ws, { t: 'reply', rid, ok: false, code: 'BAD_MESSAGE', error });
        else this.raw(ws, { t: 'error', code: 'BAD_MESSAGE', error });
        return;
      }
      const msg = r.data;
      if (msg.t === 'table.drag') {
        if (!conn.dragBucket.take()) return;
      } else if (!conn.bucket.take()) {
        this.reply(ws, msg, { ok: false, code: 'RATE_LIMIT', error: 'Too many actions, slow down' });
        return;
      }
      Promise.resolve(this.handle(conn, msg)).catch((e) => {
        if (e instanceof ActionError || e instanceof ChatError || e instanceof HttpError) {
          this.reply(ws, msg, { ok: false, code: e.code, error: e.message });
        } else {
          this.app.log(`ws error: ${(e as Error).stack}`);
          this.reply(ws, msg, { ok: false, code: 'SERVER', error: 'Something went wrong' });
        }
      });
    });
    ws.on('close', () => {
      clearTimeout(helloTimer);
      if (this.app.closing) return;
      const p = conn.player;
      if (p && this.conns.get(p.id) === conn) {
        this.conns.delete(p.id);
        this.app.players.touch(p.id);
        const tid = this.app.playerTables.get(p.id);
        if (tid) this.app.tables.get(tid)?.onDisconnected(p.id);
        this.lobbyChanged();
      }
    });
  }

  private reply(ws: WebSocket, msg: ClientMessage, r: { ok: boolean; code?: string; error?: string; data?: any }) {
    const rid = (msg as any).rid;
    if (typeof rid === 'number') {
      if (r.ok) this.raw(ws, { t: 'reply', rid, ok: true, data: r.data });
      else this.raw(ws, { t: 'reply', rid, ok: false, code: r.code ?? 'ERROR', error: r.error ?? 'Error' });
    } else if (!r.ok) this.raw(ws, { t: 'error', code: r.code ?? 'ERROR', error: r.error ?? 'Error' });
  }

  private async handle(conn: Conn, msg: ClientMessage) {
    const ok = (data?: any) => this.reply(conn.ws, msg, { ok: true, data });
    if (msg.t === 'ping') {
      this.raw(conn.ws, { t: 'pong' });
      return ok();
    }
    if (msg.t === 'hello') return this.hello(conn, msg.token, ok);
    const me = conn.player;
    if (!me) throw new ActionError('NO_HELLO', 'Say hello first');
    const app = this.app;
    switch (msg.t) {
      case 'profile': {
        app.players.update(me.id, msg.name, msg.color);
        const tid = app.playerTables.get(me.id);
        if (tid) app.tables.get(tid)?.system({ type: 'renamePlayer', playerId: me.id, name: msg.name, color: msg.color });
        this.lobbyChanged();
        return ok({ player: this.publicPlayer(me) });
      }
      case 'table.create': {
        const hash = msg.password ? await argon2.hash(msg.password) : null;
        const prev = app.playerTables.get(me.id);
        if (prev) app.leaveTable(me.id, prev, 'left');
        const s = app.tables.create(
          { playerId: me.id, name: me.name, color: me.color },
          {
            name: msg.name,
            seatLimit: msg.seatLimit ?? null,
            visibility: msg.visibility,
            passwordHash: hash,
            spectatorsAllowed: msg.spectatorsAllowed,
            layout: msg.layout,
          },
        );
        app.playerTables.set(me.id, s.id);
        if (msg.deckId && !msg.setupId) {
          try {
            await app.loadDeckOntoTable(s, me.id, msg.deckId, msg.shareToken);
          } catch (e) {
            app.log(`deck load on create failed: ${(e as Error).message}`);
          }
        }
        // table-setups: the table is created either way; a refused setup is reported, not fatal
        let setupError: string | undefined;
        if (msg.setupId) {
          try {
            app.setups.applyToTable(s, me.id, msg.setupId, msg.slots);
          } catch (e) {
            if (!(e instanceof ActionError)) throw e;
            setupError = e.message;
          }
        }
        this.lobbyChanged();
        return ok({ tableId: s.id, ...(setupError ? { setupError } : {}) });
      }
      case 'table.join': {
        const s = app.tables.get(msg.tableId);
        if (!s) throw new ActionError('NO_TABLE', 'That table no longer exists');
        const p = { playerId: me.id, name: me.name, color: me.color };
        if (!s.isParticipant(me.id)) {
          if (s.passwordHash) {
            if (!msg.password || !(await argon2.verify(s.passwordHash, msg.password)))
              throw new ActionError('BAD_PASSWORD', msg.password ? 'Incorrect password' : 'Password required');
          }
          const prev = app.playerTables.get(me.id);
          if (prev && prev !== s.id) app.leaveTable(me.id, prev, 'left');
          if (msg.spectate) {
            if (!s.state.settings.spectatorsAllowed) throw new ActionError('NO_SPECTATORS', 'Spectators are not allowed');
            s.apply({ type: 'spectate', player: p }, null);
          } else {
            if (s.state.settings.locked) throw new ActionError('LOCKED', 'The table is locked');
            if (!msg.seatId && !Tables.seatAvailable(s.state))
              throw new ActionError('TABLE_FULL', s.state.settings.spectatorsAllowed ? 'All seats are taken: you can watch instead' : 'All seats are taken');
            s.apply({ type: 'seatJoin', player: p, seatId: msg.seatId }, null);
          }
          app.playerTables.set(me.id, s.id);
        } else if (msg.seatId && !s.isSeated(me.id) && !msg.spectate) {
          // a spectator taking a seat
          if (s.state.settings.locked) throw new ActionError('LOCKED', 'The table is locked');
          s.apply({ type: 'seatJoin', player: p, seatId: msg.seatId }, null);
        }
        // otherwise: already at the table (e.g. reconnecting): just resend the snapshot
        s.attach(me.id);
        app.chat.sendHistory(tableChannel(s.id), me.id);
        this.lobbyChanged();
        return ok({ tableId: s.id });
      }
      case 'table.leave': {
        app.leaveTable(me.id, msg.tableId, 'left');
        return ok();
      }
      case 'table.snapshot': {
        const s = app.tables.get(msg.tableId);
        if (!s) throw new ActionError('NO_TABLE', 'That table no longer exists');
        s.attach(me.id);
        return ok();
      }
      case 'table.intent': {
        const s = app.tables.get(msg.tableId);
        if (!s) throw new ActionError('NO_TABLE', 'That table no longer exists');
        s.intent(me.id, msg.seq, msg.action);
        return ok();
      }
      case 'table.drag': {
        app.tables.get(msg.tableId)?.drag(me.id, msg);
        return;
      }
      case 'table.kick': {
        const s = this.hostSession(msg.tableId, me.id);
        if (msg.playerId === me.id) throw new ActionError('BAD_TARGET', 'You cannot kick yourself');
        if (!s.isParticipant(msg.playerId)) throw new ActionError('NOT_AT_TABLE', 'That player is not at the table');
        app.leaveTable(msg.playerId, s.id, 'kicked');
        return ok();
      }
      case 'table.password': {
        const s = this.hostSession(msg.tableId, me.id);
        s.passwordHash = msg.password ? await argon2.hash(msg.password) : null;
        app.db.prepare('UPDATE game_tables SET password_hash = ? WHERE id = ?').run(s.passwordHash, s.id);
        s.apply({ type: 'passwordChanged', hasPassword: !!s.passwordHash }, null);
        return ok();
      }
      case 'table.close': {
        const s = this.hostSession(msg.tableId, me.id);
        app.tables.close(s.id, 'closed');
        return ok();
      }
      case 'table.loadDeck': {
        const s = this.hostSession(msg.tableId, me.id);
        await app.loadDeckOntoTable(s, me.id, msg.deckId, msg.shareToken);
        return ok();
      }
      case 'table.applySetup': {
        const s = this.hostSession(msg.tableId, me.id);
        app.setups.applyToTable(s, me.id, msg.setupId, msg.slots);
        return ok();
      }
      case 'table.reloadDeck': {
        const s = this.hostSession(msg.tableId, me.id);
        await app.reloadDeckOnTable(s, msg.tableDeckId);
        return ok();
      }
      case 'chat.send': {
        app.chat.post(msg.channel, me.id, msg.text);
        return ok();
      }
      case 'chat.mute': {
        const muted = new Set(me.muted);
        if (msg.muted) muted.add(msg.playerId);
        else muted.delete(msg.playerId);
        app.players.setMuted(me.id, [...muted]);
        this.send(me.id, { t: 'chat.muted', muted: [...muted] });
        return ok();
      }
      case 'chat.roomMute': {
        const s = this.hostSession(msg.tableId, me.id);
        if (msg.muted) s.roomMuted.add(msg.playerId);
        else s.roomMuted.delete(msg.playerId);
        app.db.prepare('UPDATE game_tables SET room_muted = ? WHERE id = ?').run(JSON.stringify([...s.roomMuted]), s.id);
        return ok();
      }
    }
  }

  private hostSession(tableId: string, pid: string) {
    const s = this.app.tables.get(tableId);
    if (!s) throw new ActionError('NO_TABLE', 'That table no longer exists');
    if (s.state.hostId !== pid) throw new ActionError('NOT_HOST', 'Only the host can do that');
    return s;
  }

  private hello(conn: Conn, token: string, ok: (d?: any) => void) {
    const p = this.app.players.byToken(token);
    if (!p) throw new ActionError('BAD_TOKEN', 'Unknown player');
    const old = this.conns.get(p.id);
    if (old && old !== conn) {
      // One active socket per player: the newer connection wins.
      this.raw(old.ws, { t: 'session.replaced' });
      old.player = null; // so its close does not mark the player disconnected
      old.ws.close(4001, 'replaced');
    }
    conn.player = p;
    this.conns.set(p.id, conn);
    this.app.players.touch(p.id);
    this.raw(conn.ws, { t: 'welcome', player: this.publicPlayer(p), serverTime: Date.now() });
    this.raw(conn.ws, { t: 'chat.muted', muted: p.muted });
    this.app.chat.sendHistory('lobby', p.id);
    const tid = this.app.playerTables.get(p.id);
    if (tid) this.app.tables.get(tid)?.onConnected(p.id);
    this.lobbyChanged(true);
    ok({ player: this.publicPlayer(p), tableId: tid ?? null, imageKey: this.app.imageKey(p.id) });
  }

  // ------------------------------------------------------------------ lobby presence

  publicPlayer(p: Player): PlayerPublic {
    return this.presence().find((x) => x.id === p.id) ?? { id: p.id, name: p.name, color: p.color, suffix: '', status: 'offline' };
  }

  presence(): PlayerPublic[] {
    const list = [...this.conns.values()]
      .filter((c) => c.player)
      .sort((a, b) => a.connectedAt - b.connectedAt)
      .map((c) => c.player!);
    const seen = new Map<string, number>();
    return list.map((p) => {
      const key = p.name.toLowerCase();
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      const tid = this.app.playerTables.get(p.id);
      const s = tid ? this.app.tables.get(tid) : undefined;
      return {
        id: p.id,
        name: p.name,
        suffix: n > 1 ? `#${n}` : '',
        color: p.color,
        status: s ? 'table' : 'lobby',
        ...(s && s.state.settings.visibility === 'public' ? { tableId: s.id, tableName: s.state.settings.name } : {}),
        ...(s && s.state.settings.visibility === 'private' ? { tableName: 'a private table' } : {}),
      } as PlayerPublic;
    });
  }

  lobbyChanged(immediate = false) {
    if (immediate) {
      if (this.lobbyTimer) clearTimeout(this.lobbyTimer);
      this.lobbyTimer = null;
      this.sendLobby();
      return;
    }
    if (this.lobbyTimer) return;
    this.lobbyTimer = setTimeout(() => {
      this.lobbyTimer = null;
      this.sendLobby();
    }, 100);
  }

  private sendLobby() {
    const players = this.presence();
    const sessions = [...this.app.tables.sessions.values()];
    for (const [pid] of this.conns) {
      const tables = sessions
        .filter((s) => s.state.settings.visibility === 'public' || s.isParticipant(pid))
        .map((s) => s.summary());
      this.send(pid, { t: 'lobby', players, tables });
    }
  }

  close() {
    if (this.lobbyTimer) clearTimeout(this.lobbyTimer);
    for (const c of this.conns.values()) c.ws.terminate();
    this.wss.close();
  }
}
