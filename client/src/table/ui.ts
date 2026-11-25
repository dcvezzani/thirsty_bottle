import { create } from 'zustand';
import type { CardView, TableView, ZoneView } from '@vct/shared';
import { boardSlots } from '@vct/shared';
import { FOCUS_SETTLE_MS, type HandColumn } from './handFocus';
import { toggleView, type LoupeFace } from './loupeView';
import { getLoupeFace, setLoupeFace } from '../lib/loupePrefs';

export type Sheet =
  | { kind: 'cards' }
  | { kind: 'zone'; zone: string }
  | { kind: 'info'; h: string }
  | { kind: 'seat'; seat: string }
  | { kind: 'settings' }
  | { kind: 'fanout'; zone: string }
  | { kind: 'deal'; zone: string }
  | { kind: 'draw'; zone: string }
  | { kind: 'decks' }
  | { kind: 'applySetup'; preset?: { id: string; name: string; share?: string } }
  | { kind: 'saveSetup' }
  | null;

export type DropTarget = { kind: 'zone'; zone: string; index?: number; pos?: { x: number; y: number } } | { kind: 'seat'; seat: string } | null;

export interface DragState {
  handles: string[];
  fromZone: string;
  x: number;
  y: number;
  over: DropTarget;
}

export type DrawerTab = 'room' | 'lobby' | 'log' | 'info';

interface UIState {
  selZone: string | null;
  selected: string[];
  /** Handle being previewed (scrub / hover) and its zone. */
  preview: { h: string; zone: string } | null;
  drag: DragState | null;
  /** scrub-loupe: set while a touch scrub shows the loupe; `details` after a pause, `row` names the strip row. */
  /** scrub-loupe: the zone widened in place (while carrying cards, or pinned open after a pause). */
  openZone: { id: string; pinned: boolean } | null;
  loupe: { y: number; h: number; side: 'top' | 'bottom'; details: boolean; row: string | null } | null;
  /** loupe-view-modes: the chosen loupe view for this session, and (mode 'stay') the card left viewed after release. */
  loupeFace: LoupeFace;
  viewed: { h: string; zone: string } | null;
  flipLoupe(): void;
  /** Choose the loupe's view (and keep it for the session). */
  chooseFace(f: 'card' | 'details'): void;
  sheet: Sheet;
  faceDown: boolean;
  drawer: DrawerTab | null;
  zoom: number;
  /** Host arrange mode (zone-arrangement): zones shown as draggable tiles, cards locked. */
  arranging: boolean;
  /** player-views: the seat whose table is shown; null = my own. */
  viewSeat: string | null;
  /** shared-hand-dock: the wide column of the hand dock while viewing another table. */
  handFocus: HandColumn;
  /** Until this time (performance.now) scrub steps wait for the columns to finish resizing. */
  dockSettleUntil: number;
  focusHand(col: HandColumn): void;
  recent: string[];
  select(zone: string, handles: string[]): void;
  toggle(zone: string, h: string): void;
  clear(): void;
  setSheet(s: Sheet): void;
  pushRecent(dest: string): void;
}

const RECENT_KEY = 'vct.recent';

export const useUI = create<UIState>((set, get) => ({
  selZone: null,
  selected: [],
  preview: null,
  drag: null,
  loupe: null,
  loupeFace: getLoupeFace(),
  viewed: null,
  chooseFace(f) {
    setLoupeFace(f);
    set({ loupeFace: f });
  },
  flipLoupe() {
    const { loupeFace, loupe } = get();
    const next = toggleView(loupeFace, !!loupe?.details);
    setLoupeFace(next.face);
    set({ loupeFace: next.face, ...(loupe ? { loupe: { ...loupe, details: next.peek } } : {}) });
  },
  openZone: null,
  sheet: null,
  faceDown: false,
  drawer: null,
  zoom: 1,
  arranging: false,
  viewSeat: null,
  handFocus: 'viewed',
  dockSettleUntil: 0,
  focusHand(col) {
    if (get().handFocus === col) return;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    set({ handFocus: col, dockSettleUntil: reduce ? 0 : performance.now() + FOCUS_SETTLE_MS });
  },
  recent: (() => {
    try {
      return JSON.parse(sessionStorage.getItem(RECENT_KEY) ?? '[]');
    } catch {
      return [];
    }
  })(),
  select(zone, handles) {
    set({ selZone: handles.length ? zone : null, selected: handles, ...(handles.length ? { viewed: null, ...(get().viewed ? { loupe: null, preview: null } : {}) } : {}) });
  },
  toggle(zone, h) {
    const st = get();
    const base = st.selZone === zone ? st.selected : [];
    const selected = base.includes(h) ? base.filter((x) => x !== h) : [...base, h];
    set({ selZone: selected.length ? zone : null, selected, ...(selected.length && st.viewed ? { viewed: null, loupe: null, preview: null } : {}) });
  },
  clear() {
    const oz = get().openZone;
    set({ selZone: null, selected: [], ...(oz?.pinned ? { openZone: null } : {}) });
  },
  setSheet(sheet) {
    set({ sheet });
  },
  pushRecent(dest) {
    const recent = [dest, ...get().recent.filter((d) => d !== dest)].slice(0, 3);
    set({ recent });
    try {
      sessionStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    } catch {
      /* ignore */
    }
  },
}));

/** Selected handles in zone order (so group moves keep relative order). */
export function orderedSelection(view: TableView, zone: string | null, selected: string[]): string[] {
  if (!zone) return [];
  const z = view.zones.find((x) => x.id === zone);
  if (!z) return [];
  const set = new Set(selected);
  return z.cards.filter((c) => set.has(c.h)).map((c) => c.h);
}

export function findCard(view: TableView, h: string): { card: CardView; zone: ZoneView; index: number } | null {
  for (const zone of view.zones) {
    const index = zone.cards.findIndex((c) => c.h === h);
    if (index >= 0) return { card: zone.cards[index], zone, index };
  }
  return null;
}

export function zoneLabel(view: TableView, z: ZoneView): string {
  if (z.kind === 'player') {
    // compact-seat-chips: my own copy is labelled with just the zone name (narrow zones keep it readable)
    if (z.seatId === view.me.seatId) return z.name;
    const seat = view.seats.find((s) => s.id === z.seatId);
    return seat?.playerId ? `${seat.name}'s ${z.name}` : `Seat ${(seat?.index ?? 0) + 1} ${z.name}`;
  }
  if (z.kind !== 'hand') return z.name;
  if (z.seatId === view.me.seatId) return 'Your hand';
  const seat = view.seats.find((s) => s.id === z.seatId);
  return seat?.playerId ? `${seat.name}'s hand` : `Seat ${(seat?.index ?? 0) + 1} hand`;
}

/**
 * per-player-zones: the board's slots for this viewer. Each per-player zone shows as the viewer's own copy;
 * `forArrange` keeps a slot (as its first copy) even for a viewer without a copy, so indexes match the server.
 */
export function boardZones(view: TableView, forArrange = false, seat: string | null = view.me.seatId): ZoneView[] {
  const out: ZoneView[] = [];
  for (const z of boardSlots(view.zones)) {
    if (z.kind !== 'player') out.push(z);
    else {
      // player-views: `seat` is whose table is shown (my own by default)
      const mine = view.zones.find((x) => x.kind === 'player' && x.group === z.group && x.seatId === seat);
      if (mine) out.push(mine);
      else if (forArrange) out.push(z);
    }
  }
  return out;
}

/** player-views: "viewing Sam" / "viewing you" for a participant looking at another table, else null. */
export function viewingOf(view: TableView, playerId: string | null): string | null {
  const v = playerId ? (view.viewers ?? []).find((x) => x.playerId === playerId) : undefined;
  if (!v) return null;
  if (v.seat === view.me.seatId) return 'viewing you';
  const target = view.seats.find((x) => x.id === v.seat);
  return target ? `viewing ${target.name}` : null;
}

/** A hand or per-player zone of another player. */
export const isOthersZone = (view: TableView, z: ZoneView) => z.kind !== 'shared' && z.seatId !== view.me.seatId;

/** player-views: occupied seats in table order (the rotation). */
export function viewRotation(view: TableView): string[] {
  return view.seats.filter((x) => x.playerId).map((x) => x.id);
}

/** The next seat in the rotation (wrapping), from `from`; step -1 goes back. */
export function rotateSeat(view: TableView, from: string | null, step: 1 | -1): string | null {
  const order = viewRotation(view);
  if (!order.length) return null;
  const i = from ? order.indexOf(from) : -1;
  if (i < 0) return order[step === 1 ? 0 : order.length - 1];
  return order[(i + step + order.length) % order.length];
}

/** The seat whose table this viewer is looking at, falling back to their own (or the first seat for spectators). */
export function shownSeat(view: TableView, viewSeat: string | null): string | null {
  const order = viewRotation(view);
  if (viewSeat && order.includes(viewSeat)) return viewSeat;
  if (view.me.seatId) return view.me.seatId;
  return order[0] ?? null;
}
