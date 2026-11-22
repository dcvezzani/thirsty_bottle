import { create } from 'zustand';
import type { CardView, TableView, ZoneView } from '@vct/shared';

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
  | { kind: 'applySetup' }
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
  sheet: Sheet;
  faceDown: boolean;
  drawer: DrawerTab | null;
  zoom: number;
  /** Host arrange mode (zone-arrangement): zones shown as draggable tiles, cards locked. */
  arranging: boolean;
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
  sheet: null,
  faceDown: false,
  drawer: null,
  zoom: 1,
  arranging: false,
  recent: (() => {
    try {
      return JSON.parse(sessionStorage.getItem(RECENT_KEY) ?? '[]');
    } catch {
      return [];
    }
  })(),
  select(zone, handles) {
    set({ selZone: handles.length ? zone : null, selected: handles });
  },
  toggle(zone, h) {
    const st = get();
    const base = st.selZone === zone ? st.selected : [];
    const selected = base.includes(h) ? base.filter((x) => x !== h) : [...base, h];
    set({ selZone: selected.length ? zone : null, selected });
  },
  clear() {
    set({ selZone: null, selected: [] });
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
  if (z.kind !== 'hand') return z.name;
  if (z.seatId === view.me.seatId) return 'Your hand';
  const seat = view.seats.find((s) => s.id === z.seatId);
  return seat?.playerId ? `${seat.name}'s hand` : `Seat ${(seat?.index ?? 0) + 1} hand`;
}
