import type { CardView, TableView, ZoneView } from '@vct/shared';
import { boardSlots } from '@vct/shared';

/**
 * table-overview: everything public at the table, as plain data. Only what every participant can see is
 * face-up here; a card only the viewer can see (peeked at, shown just to them) is a back, and hands are counts.
 */
export interface OverviewZone {
  id: string;
  name: string;
  layout: ZoneView['layout'];
  /** Every card in the zone, as a public view (faces only where everyone can see them). */
  cards: CardView[];
  count: number;
  /** A pile shows only its top card. */
  top: CardView | null;
  /** The zone with its public cards, under an id of its own so the overview never shares selection or preview state with the table. */
  zone: ZoneView;
}

export interface OverviewPlayer {
  seatId: string;
  name: string;
  color: string;
  host: boolean;
  me: boolean;
  active: boolean;
  handCount: number;
  /** Hand cards their owner showed to everyone. */
  shown: CardView[];
  /** The shown cards as a zone for rendering (null when none). */
  shownZone: ZoneView | null;
  zones: OverviewZone[];
}

export interface Overview {
  /** Turn-based mode: whose turn it is (null in real-time mode). */
  turn: { seatId: string | null; name: string } | null;
  shared: OverviewZone[];
  players: OverviewPlayer[];
  counters: { id: string; label: string; value: number }[];
  notes: string;
}

/** A card as everyone sees it: the face only when it is public, otherwise a back. */
export function publicView(c: CardView): CardView {
  if (c.public && c.known) {
    const { shownTo: _s, shownBy: _b, peeked: _p, ...rest } = c;
    return rest;
  }
  return { h: c.h, faceUp: false, known: false, ...(c.back ? { back: c.back } : {}), ...(c.rot ? { rot: c.rot } : {}) };
}

function zoneOf(z: ZoneView): OverviewZone {
  const cards = z.cards.map(publicView);
  return { id: z.id, name: z.name, layout: z.layout, cards, count: cards.length, top: z.layout === 'pile' ? (cards[0] ?? null) : null, zone: { ...z, id: `ov:${z.id}`, cards } };
}

export function overviewSections(view: TableView): Overview {
  const shared = boardSlots(view.zones)
    .filter((z) => z.kind === 'shared')
    .map(zoneOf);
  const groups = boardSlots(view.zones)
    .filter((z) => z.kind === 'player')
    .map((z) => z.group);
  const players: OverviewPlayer[] = view.seats
    .filter((s) => s.playerId)
    .map((s) => {
      const hand = view.zones.find((z) => z.kind === 'hand' && z.seatId === s.id);
      const shown = (hand?.cards ?? []).filter((c) => c.public && c.known).map(publicView);
      const mine = (g: string | undefined) => view.zones.find((z) => z.kind === 'player' && z.group === g && z.seatId === s.id);
      return {
        seatId: s.id,
        name: s.name,
        color: s.color,
        host: view.hostId === s.playerId,
        me: s.id === view.me.seatId,
        active: view.mode === 'turn' && view.turn.active === s.id,
        handCount: s.handCount,
        shown,
        shownZone: shown.length && hand ? { ...hand, id: `ov:shown:${s.id}`, name: 'Shown to everyone', kind: 'shared', seatId: null, layout: 'spread', cards: shown } : null,
        zones: groups.map(mine).filter((z): z is ZoneView => !!z).map(zoneOf),
      };
    });
  const active = view.seats.find((s) => s.id === view.turn.active);
  return {
    turn: view.mode === 'turn' ? { seatId: active?.id ?? null, name: active?.name ?? 'Nobody' } : null,
    shared,
    players,
    counters: view.counters.map((c) => ({ id: c.id, label: c.label, value: c.value })),
    notes: view.notes,
  };
}
