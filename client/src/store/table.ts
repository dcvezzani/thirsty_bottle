import { create } from 'zustand';
import type { Action, AnimView, ServerMessage, TablePatch, TableView } from '@vct/shared';
import { getSocket, useApp } from './app';

interface Pending {
  seq: number;
  predict?: (v: TableView) => TableView;
}

export interface DragGhost {
  playerId: string;
  color: string;
  handles: string[];
  x: number;
  y: number;
  at: number;
}

export interface Ack {
  ok: boolean;
  code?: string;
  error?: string;
  notice?: string;
}

interface TableState {
  tableId: string | null;
  server: TableView | null;
  view: TableView | null;
  pending: Pending[];
  drags: Record<string, DragGhost>;
  anims: { id: number; list: AnimView[] };
  left: { reason: string } | null;
  join(tableId: string, opts?: { password?: string; spectate?: boolean; seatId?: string }): Promise<void>;
  leave(): Promise<void>;
  send(action: Action, predict?: (v: TableView) => TableView): Promise<Ack>;
  onMessage(m: ServerMessage): void;
  onReconnected(): void;
  reset(): void;
}

export function applyPatch(t: TableView, p: TablePatch): TableView {
  const n: TableView = { ...t, version: p.version };
  if (p.zones) {
    const zones = t.zones.slice();
    for (const z of p.zones) {
      const i = zones.findIndex((x) => x.id === z.id);
      if (i >= 0) zones[i] = z;
      else zones.push(z);
    }
    n.zones = zones;
  }
  if (p.zoneOrder) {
    const byId = new Map(n.zones.map((z) => [z.id, z]));
    n.zones = p.zoneOrder.map((id) => byId.get(id)!).filter(Boolean);
  }
  if (p.meta) Object.assign(n, p.meta);
  if (p.log) n.log = n.log.concat(p.log).slice(-300);
  return n;
}

/**
 * Decides what to do with an incoming patch given the version we hold.
 * 'apply' = next version (or presence-only at same version); 'gap' = missed updates → snapshot; 'stale' = ignore.
 */
export function classifyPatch(held: number, incoming: number): 'apply' | 'gap' | 'stale' {
  if (incoming === held + 1 || incoming === held) return 'apply';
  if (incoming > held + 1) return 'gap';
  return 'stale';
}

let seq = 0;
let animId = 0;
const ackWaiters = new Map<number, (a: Ack) => void>();

function display(server: TableView | null, pending: Pending[]): TableView | null {
  if (!server) return null;
  return pending.reduce((v, p) => (p.predict ? p.predict(v) : v), server);
}

export const useTable = create<TableState>((set, get) => ({
  tableId: null,
  server: null,
  view: null,
  pending: [],
  drags: {},
  anims: { id: 0, list: [] },
  left: null,

  async join(tableId, opts = {}) {
    set({ tableId, left: null });
    const s = getSocket();
    if (!s) throw new Error('offline');
    try {
      await s.request({ t: 'table.join', tableId, ...opts });
      useApp.setState({ myTableId: tableId });
    } catch (e) {
      set({ tableId: null });
      throw e;
    }
  },

  async leave() {
    const id = get().tableId;
    if (!id) return;
    await getSocket()?.request({ t: 'table.leave', tableId: id });
    set({ tableId: null, server: null, view: null, pending: [] });
    useApp.setState({ myTableId: null });
  },

  send(action, predict) {
    const st = get();
    const s = getSocket();
    if (!st.tableId || !s) return Promise.resolve({ ok: false, error: 'Not connected' });
    const mySeq = ++seq;
    const pending = predict ? [...st.pending, { seq: mySeq, predict }] : st.pending;
    set({ pending, view: display(st.server, pending) });
    return new Promise<Ack>((resolve) => {
      ackWaiters.set(mySeq, resolve);
      s.request({ t: 'table.intent', tableId: st.tableId!, seq: mySeq, action }).catch((e) => {
        ackWaiters.delete(mySeq);
        const p = get().pending.filter((x) => x.seq !== mySeq);
        set({ pending: p, view: display(get().server, p) });
        resolve({ ok: false, code: e.code, error: e.message });
      });
    });
  },

  onMessage(m) {
    const st = get();
    switch (m.t) {
      case 'table.snapshot':
        if (st.tableId && m.table.id !== st.tableId) return;
        set({ tableId: m.table.id, server: m.table, view: display(m.table, st.pending), left: null });
        break;
      case 'table.patch': {
        if (!st.server || m.tableId !== st.server.id) return;
        const c = classifyPatch(st.server.version, m.patch.version);
        if (c === 'stale') return;
        if (c === 'gap') {
          getSocket()?.send({ t: 'table.snapshot', tableId: m.tableId });
          return;
        }
        const server = applyPatch(st.server, m.patch);
        const anims = m.patch.anims?.length ? { id: ++animId, list: m.patch.anims } : st.anims;
        // turn notification
        const me = server.me.seatId;
        if (server.mode === 'turn' && server.turn.active === me && me && st.server.turn.active !== me) {
          useApp.getState().toast('Your turn', 'turn');
          try {
            navigator.vibrate?.(200);
          } catch {
            /* unsupported */
          }
        }
        set({ server, view: display(server, st.pending), anims });
        break;
      }
      case 'table.ack': {
        const w = ackWaiters.get(m.seq);
        ackWaiters.delete(m.seq);
        const pending = st.pending.filter((p) => p.seq !== m.seq);
        set({ pending, view: display(st.server, pending) });
        if (!m.ok && m.error) useApp.getState().toast(m.error, 'error');
        else if (m.notice) useApp.getState().toast(m.notice);
        w?.({ ok: m.ok, code: m.code, error: m.error, notice: m.notice });
        break;
      }
      case 'table.drag': {
        const drags = { ...st.drags };
        if (m.end) delete drags[m.playerId];
        else drags[m.playerId] = { playerId: m.playerId, color: m.color, handles: m.handles, x: m.x, y: m.y, at: Date.now() };
        set({ drags });
        break;
      }
      case 'table.viewers': {
        // player-views: live presence, outside the version sequence (like drags)
        if (m.tableId !== st.tableId || !st.server) break;
        const server = { ...st.server, viewers: m.viewers };
        set({ server, view: st.view ? { ...st.view, viewers: m.viewers } : st.view });
        break;
      }
      case 'table.left':
        if (m.tableId === st.tableId) {
          set({ tableId: null, server: null, view: null, pending: [], left: { reason: m.reason } });
          useApp.setState({ myTableId: null });
          if (m.reason === 'kicked') useApp.getState().toast('You were removed from the table', 'error');
          if (m.reason === 'closed') useApp.getState().toast('The host closed the table');
        }
        break;
    }
  },

  onReconnected() {
    const id = get().tableId;
    if (id) getSocket()?.request({ t: 'table.join', tableId: id }).catch(() => set({ tableId: null, server: null, view: null }));
  },

  reset() {
    set({ tableId: null, server: null, view: null, pending: [], drags: {}, left: null });
  },
}));
