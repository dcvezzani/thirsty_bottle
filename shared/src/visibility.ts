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

/** Owner player of a hand or per-player zone, or null for shared zones / empty seats. */
export function zoneOwner(state: TableState, zone: Zone): string | null {
  if (zone.kind === 'shared' || !zone.seatId) return null;
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
  // per-player zones follow the ordinary face rules, like shared zones
  return zone.kind !== 'hand' && card.faceUp;
}

export function perPlayerZoneId(group: string, seatId: string): string {
  return `${group}:${seatId}`;
}

/**
 * The board's slots in order: every shared zone, and each per-player group once (as its first copy).
 * Arranging indexes into this list on both server and client.
 */
export function boardSlots<Z extends { id: string; kind: string; group?: string }>(zones: Z[]): Z[] {
  const seen = new Set<string>();
  const out: Z[] = [];
  for (const z of zones) {
    if (z.kind === 'shared') out.push(z);
    else if (z.kind === 'player' && z.group && !seen.has(z.group)) {
      seen.add(z.group);
      out.push(z);
    }
  }
  return out;
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
