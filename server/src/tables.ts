import {
  ActionError,
  ActionSchema,
  createTableState,
  migrateState,
  MAX_SEATS,
  TableEngine,
  type Action,
  type AnyAction,
  type Ctx,
  type Participant,
  type ReduceResult,
  type TableDeck,
  type TableState,
  type TableSummary,
  type UndoInfo,
} from '@vct/shared';
import type { App } from './app.js';
import { Viewer, type ProjectionExtras } from './projection.js';
import { RecordingRng, ReplayRng, randomId } from './util.js';

/** setTimeout cannot wait longer than 2^31-1 ms; long waits go in chunks of this size. */
export const MAX_TIMER_MS = 24 * 86_400_000;
const SNAPSHOT_EVERY = 50;

interface RecordedCtx {
  now: number;
  draws: number[];
  connected: string[];
}

/** Card references inside wire actions that must be translated from handles to instance ids. */
function mapCardRefs(a: Action, f: (h: string) => string): Action {
  const b: any = { ...a };
  if ('cards' in b && Array.isArray(b.cards)) b.cards = b.cards.map(f);
  return b as Action;
}

export class TableSession {
  engine: TableEngine;
  version: number;
  passwordHash: string | null;
  roomMuted: Set<string>;
  closed = false;
  private viewers = new Map<string, Viewer>();
  /** player-views: playerId -> seat id they are looking at (memory only). */
  private looking = new Map<string, string>();
  private marked = new Set<string>();
  private timers = new Map<string, NodeJS.Timeout[]>();
  private emptyTimer: NodeJS.Timeout | null = null;
  /** async-turns: when the table last had an action, and the timer that closes it when idle. */
  lastActionAt: number;
  private idleTimer: NodeJS.Timeout | null = null;
  private sinceSnapshot = 0;

  constructor(
    private app: App,
    state: TableState,
    version: number,
    opts: { passwordHash: string | null; roomMuted?: string[]; undo?: UndoInfo | null; lastActionAt?: number },
  ) {
    this.lastActionAt = opts.lastActionAt ?? Date.now();
    this.engine = new TableEngine(state);
    this.engine.undo = opts.undo ?? null;
    this.version = version;
    this.passwordHash = opts.passwordHash;
    this.roomMuted = new Set(opts.roomMuted ?? []);
  }

  get id() {
    return this.engine.state.id;
  }
  get state() {
    return this.engine.state;
  }

  participants(): string[] {
    const s = this.state;
    return s.seats
      .map((x) => x.playerId)
      .filter((p): p is string => !!p)
      .concat(s.spectators.map((x) => x.playerId));
  }
  isParticipant(pid: string) {
    return this.participants().includes(pid);
  }
  isSeated(pid: string) {
    return this.state.seats.some((x) => x.playerId === pid);
  }

  private connectedSet(): Set<string> {
    return new Set(this.participants().filter((p) => this.app.hub.isConnected(p)));
  }

  private extras(): ProjectionExtras {
    const now = Date.now();
    return {
      version: this.version,
      connected: this.connectedSet(),
      markedDisconnected: this.marked,
      undoFor: (pid) =>
        this.engine.undo && this.engine.undo.actor === pid ? Math.max(0, 10_000 - (now - this.engine.undo.at)) : 0,
      newerVersion: (deckId) => this.app.decks?.hasNewerVersion(this.state.decks[deckId]) ?? false,
      viewers: this.viewerList(),
      requestTtlMs: this.app.opts.requestTtlMs,
      now,
    };
  }

  // ------------------------------------------------------------------ viewers

  /** A participant's client asks for the full state (on join, reconnect or version gap). */
  attach(pid: string) {
    if (!this.isParticipant(pid)) throw new ActionError('NOT_AT_TABLE', 'You are not at this table');
    const v = new Viewer(pid);
    this.viewers.set(pid, v);
    this.onConnected(pid);
    this.app.hub.send(pid, { t: 'table.snapshot', table: v.snapshot(this.state, this.extras()) });
  }

  detachViewer(pid: string) {
    this.viewers.delete(pid);
    this.clearLooking(pid);
  }

  // ------------------------------------------------------------------ player-views presence (memory only)

  /** Which seat's table a participant is looking at; null = their own. Never saved. */
  view(pid: string, seat: string | null) {
    if (!this.isParticipant(pid)) return;
    if (seat !== null && !this.state.seats.some((x) => x.id === seat)) throw new ActionError('NO_SEAT', 'That seat no longer exists');
    const own = this.state.seats.find((x) => x.playerId === pid)?.id ?? null;
    const next = seat === own ? null : seat;
    if ((this.looking.get(pid) ?? null) === next) return;
    if (next) this.looking.set(pid, next);
    else this.looking.delete(pid);
    this.broadcastViewers();
    this.dropSeeRequests(pid, next); // request-hand-view: an ask belongs to the table being viewed
  }

  /** The asker stopped viewing that table (or went away): their pending asks to see a hand end, except for the seat now viewed. */
  private dropSeeRequests(pid: string, keepSeat: string | null = null) {
    if (this.state.seeRequests?.some((r) => r.from === pid && r.seatId !== keepSeat))
      this.system({ type: 'seeDrop', from: pid, ...(keepSeat ? { except: keepSeat } : {}) });
  }

  private viewerList() {
    return [...this.looking].map(([playerId, seat]) => ({ playerId, seat }));
  }

  private broadcastViewers() {
    const viewers = this.viewerList();
    for (const pid of this.viewers.keys()) this.app.hub.send(pid, { t: 'table.viewers', tableId: this.id, viewers });
  }

  private clearLooking(pid: string) {
    if (this.looking.delete(pid)) this.broadcastViewers();
    this.dropSeeRequests(pid);
  }

  /** Drop entries for participants who left, seats that are gone, or a seat that became the viewer's own. */
  private pruneLooking() {
    let changed = false;
    for (const [pid, seat] of this.looking) {
      const seatObj = this.state.seats.find((x) => x.id === seat);
      if (!this.isParticipant(pid) || !seatObj || seatObj.playerId === pid) {
        this.looking.delete(pid);
        changed = true;
      }
    }
    if (changed) this.broadcastViewers();
  }

  /** Socket for a participant came up. */
  onConnected(pid: string) {
    for (const t of this.timers.get(pid) ?? []) clearTimeout(t);
    this.timers.delete(pid);
    const wasMarked = this.marked.delete(pid);
    if (this.emptyTimer) {
      clearTimeout(this.emptyTimer);
      this.emptyTimer = null;
      this.app.db.prepare('UPDATE game_tables SET empty_since = NULL WHERE id = ?').run(this.id);
    }
    if (wasMarked) this.broadcastPresence();
    else this.broadcastPresence();
  }

  /** Socket for a participant went away: start the reconnect grace period. */
  onDisconnected(pid: string) {
    this.viewers.delete(pid);
    this.clearLooking(pid);
    if (!this.isParticipant(pid)) return;
    for (const t of this.timers.get(pid) ?? []) clearTimeout(t);
    const { markMs, graceMs } = this.app.opts;
    const mark = setTimeout(() => {
      this.marked.add(pid);
      this.broadcastPresence();
    }, markMs);
    const expire = setTimeout(() => {
      if (this.state.mode === 'turn') return; // async-turns: seats are kept in turn-based mode
      if (this.state.guests.includes(pid)) return; // pass-and-play: a guest's seat stays until the host removes it
      this.timers.delete(pid);
      this.marked.delete(pid);
      if (!this.closed && this.isParticipant(pid) && !this.app.hub.isConnected(pid)) {
        this.system({ type: 'seatLeave', playerId: pid, reason: 'expired' });
        this.app.playerLeftTable(pid, this.id);
      }
    }, graceMs);
    this.timers.set(pid, [mark, expire]);
    this.broadcastPresence();
    this.checkEmpty();
  }

  checkEmpty() {
    if (this.closed || this.emptyTimer) return;
    if (this.state.mode === 'turn') return; // async-turns: an idle turn-based table closes by its own lifetime instead
    if (this.connectedSet().size > 0) return;
    this.app.db.prepare('UPDATE game_tables SET empty_since = ? WHERE id = ?').run(Date.now(), this.id);
    this.emptyTimer = setTimeout(() => this.app.tables.close(this.id, 'expired'), this.app.opts.emptyTtlMs);
  }


  // ------------------------------------------------------------------ async-turns: idle lifetime

  /** A player acted: remember when, durably, and restart the idle countdown. */
  private touchActivity(now: number) {
    this.lastActionAt = now;
    this.app.db.prepare('UPDATE game_tables SET last_action_at = ? WHERE id = ?').run(now, this.id);
    this.armIdle();
  }

  /** When an idle turn-based table closes. */
  idleDeadline() {
    return this.lastActionAt + this.state.settings.idleDays * 86_400_000;
  }

  /**
   * One timer per turn-based table, aimed at the deadline derived from the saved last-action time (never from time spent
   * running, so a spin-down and restart keep it). setTimeout overflows above ~24.8 days, so it waits in chunks and re-checks.
   */
  armIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (this.closed || this.state.mode !== 'turn') return;
    const wait = Math.min(Math.max(0, this.idleDeadline() - Date.now()), MAX_TIMER_MS);
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.closed || this.state.mode !== 'turn') return;
      if (Date.now() >= this.idleDeadline()) this.app.tables.close(this.id, 'expired');
      else this.armIdle();
    }, wait);
  }

  /** The table switched mode: each mode has its own closing and seat rules. */
  private onModeChanged() {
    if (this.emptyTimer) {
      clearTimeout(this.emptyTimer);
      this.emptyTimer = null;
      this.app.db.prepare('UPDATE game_tables SET empty_since = NULL WHERE id = ?').run(this.id);
    }
    if (this.state.mode === 'realtime') {
      for (const pid of this.participants()) if (!this.app.hub.isConnected(pid)) this.onDisconnected(pid); // real-time grace starts now
      this.checkEmpty();
    }
    this.armIdle();
  }

  /** request-expiry: one timer per pending request, armed from its start time so a restart keeps the remaining time. */
  private expiry = new Map<string, NodeJS.Timeout>();
  armRequestTimers() {
    if (this.closed) return;
    const live = new Set<string>();
    for (const r of [...this.state.requests, ...(this.state.seeRequests ?? [])]) {
      live.add(r.id);
      if (this.expiry.has(r.id)) continue;
      const wait = Math.max(0, r.at + this.app.opts.requestTtlMs - Date.now());
      this.expiry.set(
        r.id,
        setTimeout(() => {
          this.expiry.delete(r.id);
          const asker = [...this.state.requests, ...(this.state.seeRequests ?? [])].find((q) => q.id === r.id)?.from;
          const res = this.system({ type: 'requestExpire', id: r.id });
          if (res && asker) this.app.hub.send(asker, { t: 'table.notice', tableId: this.id, text: this.expiryNotice(r.id) } as any);
        }, wait),
      );
    }
    for (const [id, t] of this.expiry) {
      if (live.has(id)) continue;
      clearTimeout(t);
      this.expiry.delete(id);
    }
  }
  private expiryNotice(_id: string) {
    const e = this.state.log.at(-1)?.text ?? '';
    const m = / to (?:see|take cards from) (.+?)(?:'s .*)? expired$/.exec(e);
    return m ? `${m[1]} didn't answer in time` : "Your request wasn't answered in time";
  }

  /** Arm grace timers for everyone (after a server restart nobody is connected yet). */
  armAllGrace() {
    for (const pid of this.participants()) if (!this.app.hub.isConnected(pid)) this.onDisconnected(pid);
    this.checkEmpty();
  }

  // ------------------------------------------------------------------ actions

  private ctx(rec?: RecordedCtx): { ctx: Ctx; rng?: RecordingRng } {
    if (rec) return { ctx: { now: rec.now, rng: new ReplayRng(rec.draws), connected: new Set(rec.connected) } };
    const rng = new RecordingRng();
    return { ctx: { now: Date.now(), rng, connected: this.connectedSet() }, rng };
  }

  /** Apply an action (validated & resolved) and broadcast. Throws ActionError on refusal. */
  apply(action: AnyAction, actor: string | null): ReduceResult {
    if (this.closed) throw new ActionError('CLOSED', 'This table is closed');
    const t0 = performance.now();
    const { ctx, rng } = this.ctx();
    const res = this.engine.dispatch(action, actor, ctx);
    this.version += 1;
    this.persist(action, actor, { now: ctx.now, draws: rng!.draws, connected: [...ctx.connected] });
    this.broadcast(res);
    this.armRequestTimers();
    if (actor !== null || action.type === 'seatJoin') this.touchActivity(ctx.now);
    if (action.type === 'setMode') this.onModeChanged();
    else if (action.type === 'settings') this.armIdle();
    this.pruneLooking();
    this.app.lobbyChanged();
    this.app.metrics.record(performance.now() - t0);
    return res;
  }

  system(action: AnyAction): ReduceResult | null {
    try {
      return this.apply(action, null);
    } catch (e) {
      if (e instanceof ActionError) return null;
      throw e;
    }
  }

  /** A client intent: translate handles, apply, ack. */
  intent(pid: string, seq: number, wire: Action) {
    const viewer = this.viewers.get(pid);
    const ack = (ok: boolean, extra: Record<string, unknown> = {}) =>
      this.app.hub.send(pid, { t: 'table.ack', tableId: this.id, seq, ok, ...extra } as any);
    try {
      if (!viewer) throw new ActionError('NO_VIEW', 'Reload the table');
      const parsed = ActionSchema.parse(wire);
      const action = mapCardRefs(parsed, (h) => {
        const inst = viewer.resolve(h);
        if (!inst) throw new ActionError('STALE', 'That card has moved');
        return inst;
      });
      const res = this.apply(action, pid);
      ack(true, res.notice ? { notice: res.notice } : {});
    } catch (e) {
      if (e instanceof ActionError) ack(false, { code: e.code, error: e.message });
      else if ((e as any)?.issues) ack(false, { code: 'BAD_ACTION', error: 'Malformed action' });
      else throw e;
    }
  }

  drag(pid: string, msg: { handles: string[]; x: number; y: number; end?: boolean }) {
    const from = this.viewers.get(pid);
    if (!from || !this.isSeated(pid)) return;
    const insts = msg.handles.map((h) => from.resolve(h)).filter((i): i is string => !!i);
    const color = this.state.seats.find((s) => s.playerId === pid)?.color ?? '#888888';
    for (const [other, v] of this.viewers) {
      if (other === pid) continue;
      const handles = insts.map((i) => v.handleOf(i)).filter((h): h is string => !!h);
      this.app.hub.send(other, {
        t: 'table.drag',
        tableId: this.id,
        playerId: pid,
        color,
        handles,
        x: msg.x,
        y: msg.y,
        end: msg.end,
      });
    }
  }

  private broadcast(res: ReduceResult) {
    const x = this.extras();
    for (const [pid, v] of this.viewers) {
      if (!this.isParticipant(pid)) {
        this.viewers.delete(pid);
        continue;
      }
      const patch = v.patch(this.state, x, res.touched, res.anims);
      if (patch) this.app.hub.send(pid, { t: 'table.patch', tableId: this.id, patch });
    }
  }

  /** Presence-only update (connection status); does not bump the version. */
  broadcastPresence() {
    const x = this.extras();
    for (const [pid, v] of this.viewers) {
      const patch = v.patch(this.state, x, new Set(), []);
      if (patch) this.app.hub.send(pid, { t: 'table.patch', tableId: this.id, patch });
    }
    this.app.lobbyChanged();
  }

  // ------------------------------------------------------------------ persistence

  private persist(action: AnyAction, actor: string | null, rec: RecordedCtx) {
    const db = this.app.db;
    db.prepare('INSERT INTO table_actions (table_id, version, actor, action, ctx) VALUES (?, ?, ?, ?, ?)').run(
      this.id,
      this.version,
      actor,
      JSON.stringify(action),
      JSON.stringify(rec),
    );
    this.sinceSnapshot += 1;
    if (this.sinceSnapshot >= SNAPSHOT_EVERY) this.snapshot();
  }

  snapshot() {
    const db = this.app.db;
    db.transaction(() => {
      db.prepare('UPDATE game_tables SET state = ?, undo = ?, version = ? WHERE id = ?').run(
        JSON.stringify(this.state),
        this.engine.undo ? JSON.stringify(this.engine.undo) : null,
        this.version,
        this.id,
      );
      db.prepare('DELETE FROM table_actions WHERE table_id = ? AND version <= ?').run(this.id, this.version);
    })();
    this.sinceSnapshot = 0;
  }

  /** Re-apply logged actions after the last snapshot (server restart). */
  replay(rows: { version: number; actor: string | null; action: string; ctx: string }[]) {
    for (const r of rows) {
      const action = JSON.parse(r.action) as AnyAction;
      const { ctx } = this.ctx(JSON.parse(r.ctx));
      this.engine.dispatch(action, r.actor, ctx);
      this.version = r.version;
      this.sinceSnapshot += 1;
    }
  }

  stopTimers() {
    for (const ts of this.timers.values()) for (const t of ts) clearTimeout(t);
    this.timers.clear();
    for (const t of this.expiry.values()) clearTimeout(t);
    this.expiry.clear();
    if (this.emptyTimer) clearTimeout(this.emptyTimer);
    this.emptyTimer = null;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  summary(): TableSummary {
    const s = this.state;
    const host = s.seats.find((x) => x.playerId === s.hostId);
    return {
      id: s.id,
      name: s.settings.name,
      hostName: host?.name ?? '',
      seated: s.seats.filter((x) => x.playerId).length,
      seatLimit: s.settings.seatLimit,
      mode: s.mode,
      decks: Object.values(s.decks).map((d) => d.name),
      locked: s.settings.locked,
      visibility: s.settings.visibility,
      hasPassword: s.settings.hasPassword,
      spectatorsAllowed: s.settings.spectatorsAllowed,
      spectators: s.spectators.length,
    };
  }
}

export interface CreateTableInput {
  name: string;
  seatLimit?: number | null;
  visibility: 'public' | 'private';
  passwordHash: string | null;
  spectatorsAllowed: boolean;
  layout?: 'standard' | 'blank';
}

export class Tables {
  sessions = new Map<string, TableSession>();
  constructor(private app: App) {}

  loadAll() {
    const rows = this.app.db.prepare('SELECT * FROM game_tables WHERE closed_at IS NULL').all() as any[];
    for (const row of rows) {
      const session = new TableSession(this.app, migrateState(JSON.parse(row.state)), row.version, {
        passwordHash: row.password_hash,
        roomMuted: JSON.parse(row.room_muted),
        undo: row.undo ? JSON.parse(row.undo) : null,
        lastActionAt: row.last_action_at ?? Date.now(),
      });
      const actions = this.app.db
        .prepare('SELECT * FROM table_actions WHERE table_id = ? ORDER BY version')
        .all(row.id) as any[];
      try {
        session.replay(actions);
      } catch (e) {
        this.app.log(`replay failed for table ${row.id}: ${(e as Error).message}`);
      }
      this.sessions.set(row.id, session);
      for (const pid of session.participants()) this.app.playerTables.set(pid, row.id);
      session.armAllGrace();
      session.armRequestTimers();
      session.armIdle();
    }
  }

  get(id: string) {
    return this.sessions.get(id);
  }

  create(host: Participant, input: CreateTableInput): TableSession {
    const id = randomId(9);
    const now = Date.now();
    const state = createTableState({
      id,
      name: input.name,
      host,
      seatLimit: input.seatLimit ?? null,
      visibility: input.visibility,
      spectatorsAllowed: input.spectatorsAllowed,
      hasPassword: !!input.passwordHash,
      now,
      layout: input.layout,
    });
    this.app.db
      .prepare('INSERT INTO game_tables (id, state, version, password_hash, created_at, last_action_at) VALUES (?, ?, 0, ?, ?, ?)')
      .run(id, JSON.stringify(state), input.passwordHash, now, now);
    const session = new TableSession(this.app, state, 0, { passwordHash: input.passwordHash });
    this.sessions.set(id, session);
    return session;
  }

  /** Deck snapshot loaded onto a table, remembered for access checks and image GC. */
  recordDeck(tableId: string, deck: TableDeck) {
    this.app.db
      .prepare(
        'INSERT OR REPLACE INTO table_decks (table_id, table_deck_id, source_deck_id, version_id, content) VALUES (?, ?, ?, ?, ?)',
      )
      .run(tableId, deck.id, deck.sourceDeckId, deck.versionId, JSON.stringify(deck));
  }

  close(id: string, reason: 'closed' | 'expired') {
    const s = this.sessions.get(id);
    if (!s || s.closed) return;
    s.snapshot();
    s.closed = true;
    s.stopTimers();
    for (const pid of s.participants()) {
      this.app.hub.send(pid, { t: 'table.left', tableId: id, reason });
      this.app.playerLeftTable(pid, id);
    }
    this.app.db.prepare('UPDATE game_tables SET closed_at = ? WHERE id = ?').run(Date.now(), id);
    for (const g of this.app.players.guestsOfTable(id)) this.app.players.deleteGuest(g); // pass-and-play
    this.app.db.prepare('DELETE FROM table_decks WHERE table_id = ?').run(id);
    this.app.chat.deleteChannel(`table:${id}`);
    this.sessions.delete(id);
    this.app.lobbyChanged();
  }

  shutdown() {
    for (const s of this.sessions.values()) {
      s.snapshot();
      s.stopTimers();
    }
  }

  static seatAvailable(s: TableState): boolean {
    if (s.seats.some((x) => !x.playerId)) return true;
    return s.seats.length < Math.min(s.settings.seatLimit ?? MAX_SEATS, MAX_SEATS);
  }
}
