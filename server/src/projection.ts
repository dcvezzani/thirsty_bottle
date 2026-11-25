import crypto from 'node:crypto';
import {
  canSee,
  defaultZoneWidth,
  handZoneId,
  locate,
  type AnimView,
  type Anim,
  type CardInst,
  type CardView,
  type LogView,
  type SeatView,
  type TableDeckView,
  type TablePatch,
  type TableState,
  type TableView,
  type Zone,
  type ZoneView,
  type ViewerPresence,
} from '@vct/shared';

let handleCounter = 0;
/** Fresh, never-reused opaque handle. */
function newHandle(): string {
  handleCounter = (handleCounter + 1) % 1_000_000;
  return crypto.randomBytes(6).toString('base64url') + handleCounter.toString(36);
}

export interface ProjectionExtras {
  version: number;
  connected: ReadonlySet<string>;
  /** Players disconnected long enough to be marked as disconnected. */
  markedDisconnected: ReadonlySet<string>;
  undoFor: (playerId: string) => number; // ms left, 0 if none
  newerVersion: (deckId: string) => boolean;
  /** player-views: live viewing presence. */
  viewers: ViewerPresence[];
  /** request-expiry */
  requestTtlMs: number;
  now: number;
}

/** Per-recipient projection state: handle maps and what was last sent. */
export class Viewer {
  h2i = new Map<string, string>();
  i2h = new Map<string, string>();
  private sentZones = new Map<string, string>();
  private sentOrder = '';
  private sentMeta = new Map<string, string>();
  private lastLog = 0;

  constructor(public playerId: string) {}

  resolve(handle: string): string | undefined {
    return this.h2i.get(handle);
  }

  handleOf(inst: string): string | undefined {
    return this.i2h.get(inst);
  }

  private assign(inst: string): string {
    const old = this.i2h.get(inst);
    if (old) this.h2i.delete(old);
    const h = newHandle();
    this.i2h.set(inst, h);
    this.h2i.set(h, inst);
    return h;
  }

  /**
   * Updates handles after a change. A card the viewer cannot see that was touched (moved, shuffled,
   * flipped) gets a fresh handle so it cannot be followed. Returns old handles of renamed cards.
   */
  refreshHandles(s: TableState, touched: ReadonlySet<string>, loc: Map<string, string>): Map<string, string> {
    const renamed = new Map<string, string>();
    for (const [inst, h] of this.i2h) {
      if (!s.cards[inst]) {
        this.i2h.delete(inst);
        this.h2i.delete(h);
      }
    }
    for (const c of Object.values(s.cards)) {
      const zid = loc.get(c.id);
      if (!zid) continue;
      const old = this.i2h.get(c.id);
      if (!old) {
        this.assign(c.id);
        continue;
      }
      if (touched.has(c.id) && !canSee(s, this.playerId, c, s.zones[zid])) {
        renamed.set(c.id, old);
        this.assign(c.id);
      }
    }
    return renamed;
  }

  cardView(s: TableState, c: CardInst, zone: Zone): CardView {
    const known = canSee(s, this.playerId, c, zone);
    const deck = s.decks[c.deckId];
    const def = deck?.defs.find((d) => d.id === c.defId);
    const v: CardView = { h: this.i2h.get(c.id) ?? this.assign(c.id), faceUp: c.faceUp, known };
    const back = def?.backImageId ?? deck?.backImageId;
    if (back) v.back = back;
    if (known) {
      v.deck = c.deckId;
      v.def = c.defId;
      v.copyNo = c.copyNo;
      v.copyOf = c.copyOf;
    }
    const isHolder = c.shownBy === this.playerId;
    if (isHolder && c.shownTo.length) v.shownTo = [...c.shownTo];
    if (!isHolder && c.shownBy && (c.shownTo.includes('*') || c.shownTo.includes(this.playerId))) v.shownBy = c.shownBy;
    if (c.peekedBy.includes(this.playerId)) v.peeked = true;
    const p = zone.pos[c.id];
    if (p) {
      v.x = p.x;
      v.y = p.y;
    }
    return v;
  }

  zoneView(s: TableState, z: Zone): ZoneView {
    return {
      id: z.id,
      name: z.name,
      kind: z.kind,
      seatId: z.seatId,
      layout: z.layout,
      color: z.color,
      x: z.x,
      y: z.y,
      width: z.width ?? defaultZoneWidth(z.layout),
      newRow: !!z.newRow,
      ...(z.group ? { group: z.group } : {}),
      cards: z.cards.map((id) => this.cardView(s, s.cards[id], z)),
    };
  }

  logView(e: TableState['log'][number]): LogView {
    const text = e.privateText?.[this.playerId] ?? e.text;
    const v: LogView = { id: e.id, at: e.at, actor: e.actor, text, kind: e.kind };
    if (e.cardAction) v.cardAction = true;
    return v;
  }

  meta(s: TableState, x: ProjectionExtras): Omit<TableView, 'zones' | 'log' | 'version'> {
    const me = this.playerId;
    const mySeat = s.seats.find((st) => st.playerId === me) ?? null;
    const isHost = s.hostId === me;
    const seats: SeatView[] = s.seats.map((st, index) => ({
      id: st.id,
      index,
      playerId: st.playerId,
      name: st.name,
      color: st.color,
      connected: !!st.playerId && x.connected.has(st.playerId),
      disconnected: !!st.playerId && x.markedDisconnected.has(st.playerId),
      handCount: s.zones[handZoneId(st.id)]?.cards.length ?? 0,
      zoneCounts: s.zoneOrder
        .map((id) => s.zones[id])
        .filter((z) => z?.kind === 'player' && z.seatId === st.id)
        .map((z) => ({ zone: z.id, name: z.name, count: z.cards.length })),
    }));
    const decks: TableDeckView[] = Object.values(s.decks).map((d) => {
      const v: TableDeckView = {
        id: d.id,
        sourceDeckId: d.sourceDeckId,
        versionId: d.versionId,
        name: d.name,
        defs: d.defs,
        homeZoneId: d.homeZoneId,
      };
      if (d.backImageId) v.backImageId = d.backImageId;
      if (isHost && x.newerVersion(d.id)) v.newerVersion = true;
      return v;
    });
    const nameOf = (pid: string) =>
      s.seats.find((st) => st.playerId === pid)?.name ?? s.spectators.find((p) => p.playerId === pid)?.name ?? '?';
    const seeRequests = (s.seeRequests ?? [])
      .filter((r) => r.from === me || (mySeat && r.seatId === mySeat.id))
      .map((r) => ({
        id: r.id,
        from: r.from,
        fromName: nameOf(r.from),
        seatId: r.seatId,
        count: 0,
        to: '',
        kind: 'see' as const,
        dir: (r.from === me ? 'outgoing' : 'incoming') as 'incoming' | 'outgoing',
        msLeft: Math.max(0, r.at + x.requestTtlMs - x.now),
      }));
    const requests = s.requests
      .filter((r) => r.from === me || (mySeat && r.seatId === mySeat.id))
      .map((r) => ({
        id: r.id,
        kind: 'take' as const,
        from: r.from,
        fromName: nameOf(r.from),
        seatId: r.seatId,
        count: r.cards.length,
        to: r.to,
        ...(r.zone && s.zones[r.zone] ? { zoneName: s.zones[r.zone].name } : {}),
        dir: (r.from === me ? 'outgoing' : 'incoming') as 'incoming' | 'outgoing',
        msLeft: Math.max(0, r.at + x.requestTtlMs - x.now),
      }));
    const undoMs = x.undoFor(me);
    return {
      id: s.id,
      settings: s.settings,
      mode: s.mode,
      turn: s.turn,
      hostId: s.hostId,
      seats,
      spectators: s.spectators,
      decks,
      counters: s.counters,
      notes: s.notes,
      requests: [...requests, ...seeRequests],
      vacated: isHost ? s.vacated : [],
      viewers: x.viewers,
      me: { playerId: me, seatId: mySeat?.id ?? null, isHost, spectator: !mySeat },
      canUndo: undoMs > 0,
      undoMsLeft: undoMs,
      lastSetup: s.lastSetup ?? null,
    };
  }

  snapshot(s: TableState, x: ProjectionExtras): TableView {
    const loc = locate(s);
    this.refreshHandles(s, new Set(), loc);
    const zones = s.zoneOrder.map((zid) => this.zoneView(s, s.zones[zid]));
    const meta = this.meta(s, x);
    this.sentZones = new Map(zones.map((z) => [z.id, JSON.stringify(z)]));
    this.sentOrder = s.zoneOrder.join(',');
    this.sentMeta = new Map(Object.entries(meta).map(([k, v]) => [k, JSON.stringify(v)]));
    const log = s.log.slice(-200).map((e) => this.logView(e));
    this.lastLog = s.logSeq;
    return { ...meta, version: x.version, zones, log };
  }

  /** Incremental patch after a change. Returns null if nothing visible changed for this viewer. */
  patch(s: TableState, x: ProjectionExtras, touched: ReadonlySet<string>, anims: Anim[]): TablePatch | null {
    const loc = locate(s);
    const renamed = this.refreshHandles(s, touched, loc);
    const out: TablePatch = { version: x.version };
    const zones: ZoneView[] = [];
    for (const zid of s.zoneOrder) {
      const zv = this.zoneView(s, s.zones[zid]);
      const j = JSON.stringify(zv);
      if (this.sentZones.get(zid) !== j) {
        zones.push(zv);
        this.sentZones.set(zid, j);
      }
    }
    for (const zid of [...this.sentZones.keys()]) if (!s.zones[zid]) this.sentZones.delete(zid);
    if (zones.length) out.zones = zones;
    const order = s.zoneOrder.join(',');
    if (order !== this.sentOrder) {
      out.zoneOrder = [...s.zoneOrder];
      this.sentOrder = order;
    }
    const meta = this.meta(s, x) as Record<string, unknown>;
    const changed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(meta)) {
      const j = JSON.stringify(v);
      if (this.sentMeta.get(k) !== j) {
        changed[k] = v;
        this.sentMeta.set(k, j);
      }
    }
    if (Object.keys(changed).length) out.meta = changed as TablePatch['meta'];
    const newLog = s.log.filter((e) => e.id > this.lastLog).map((e) => this.logView(e));
    this.lastLog = s.logSeq;
    if (newLog.length) out.log = newLog;
    const av = this.anims(anims, renamed);
    if (av.length) out.anims = av;
    if (!out.zones && !out.zoneOrder && !out.meta && !out.log && !out.anims) return null;
    return out;
  }

  private anims(anims: Anim[], renamed: Map<string, string>): AnimView[] {
    const out: AnimView[] = [];
    for (const a of anims) {
      if (a.kind === 'shuffle') out.push(a);
      else if (a.kind === 'flip') {
        const handles = a.cards.map((c) => this.i2h.get(c)).filter((h): h is string => !!h);
        if (handles.length) out.push({ kind: 'flip', actor: a.actor, handles });
      } else {
        const items = a.items
          .map((it) => {
            const toH = this.i2h.get(it.card);
            if (!toH) return null;
            const fromH = renamed.get(it.card) ?? toH;
            return { from: it.from, to: it.to, fromH, toH };
          })
          .filter((i): i is NonNullable<typeof i> => !!i);
        if (items.length) out.push({ kind: a.kind, actor: a.actor, items });
      }
    }
    return out;
  }
}
