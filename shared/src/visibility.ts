import type { CardInst, TableState, Zone } from './table.js';

/** Index of instance id → zone id. */
export function locate(state: TableState): Map<string, string> {
  const m = new Map<string, string>();
  for (const zid of state.zoneOrder) for (const c of state.zones[zid].cards) m.set(c, zid);
  return m;
}

export function seatOfPlayer(state: TableState, playerId: string | null | undefined) {
  if (!playerId) return undefined;
  return state.seats.find((s) => s.playerId === playerId);
}

export function handZoneId(seatId: string): string {
  return `hand:${seatId}`;
}

/** Owner player of a hand zone, or null for shared zones / empty seats. */
export function zoneOwner(state: TableState, zone: Zone): string | null {
  if (zone.kind !== 'hand' || !zone.seatId) return null;
  return state.seats.find((s) => s.id === zone.seatId)?.playerId ?? null;
}

/** Can `viewer` see the face of card `card` that lies in `zone`? */
export function canSee(state: TableState, viewer: string | null, card: CardInst, zone: Zone): boolean {
  if (card.shownTo.includes('*')) return true;
  if (viewer && (card.shownTo.includes(viewer) || card.peekedBy.includes(viewer))) return true;
  if (zone.kind === 'hand') return viewer !== null && zoneOwner(state, zone) === viewer;
  return card.faceUp;
}

/** Visible to everyone at the table (including spectators)? */
export function isPublic(card: CardInst, zone: Zone): boolean {
  if (card.shownTo.includes('*')) return true;
  return zone.kind === 'shared' && card.faceUp;
}

export function playerName(state: TableState, playerId: string | null | undefined): string {
  if (!playerId) return 'Someone';
  const seat = state.seats.find((s) => s.playerId === playerId);
  if (seat) return seat.name;
  return state.spectators.find((s) => s.playerId === playerId)?.name ?? 'Someone';
}

/** All player ids currently at the table (seated + spectators). */
export function participants(state: TableState): string[] {
  const ids = state.seats.map((s) => s.playerId).filter((p): p is string => !!p);
  return ids.concat(state.spectators.map((s) => s.playerId));
}
