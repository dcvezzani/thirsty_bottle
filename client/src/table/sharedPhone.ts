import { create } from 'zustand';
import type { TableView } from '@vct/shared';
import type { Person } from '../lib/guests';

/**
 * pass-and-play: what the phone shows instead of the table while people share it.
 * 'pass' = "Pass the phone to X", tap to reveal; 'wait' = a player on another device has the turn;
 * 'pick' = the real-time "Who's playing" list.
 */
export type Cover = { kind: 'pass'; personId: string } | { kind: 'wait'; name: string } | { kind: 'pick' };

export interface Decision {
  cover: Cover | null;
  /** Connect as this person now (so the previous person's hand leaves the device). */
  switchTo?: Person;
}

/**
 * The rules for the covers, from the turn and the people on this phone.
 * `people` is empty when nobody shares the phone, and then nothing is ever covered.
 */
export function decide(view: Pick<TableView, 'mode' | 'turn' | 'seats' | 'me'>, people: Person[], current: Cover | null, prevActive: string | null): Decision {
  if (people.length < 2) return { cover: null };
  if (view.mode !== 'turn') return { cover: current?.kind === 'wait' ? null : current };
  const seat = view.seats.find((s) => s.id === view.turn.active);
  const who = seat?.playerId ?? null;
  if (!seat || !who) return { cover: current?.kind === 'wait' ? null : current };
  const meId = view.me.playerId;
  const changed = prevActive !== view.turn.active;
  if (who === meId) {
    if (current?.kind === 'pass' && current.personId === meId) return { cover: current };
    // the turn came round to the person connected (or to a waiting phone): hand it over with a cover
    // (a turn that merely starts on the connected person, when turn-based play begins, needs no handoff)
    if ((changed && prevActive !== null) || current?.kind === 'wait') return { cover: { kind: 'pass', personId: meId } };
    return { cover: current };
  }
  const local = people.find((p) => p.id === who);
  if (local) return { cover: { kind: 'pass', personId: local.id }, switchTo: local };
  return { cover: { kind: 'wait', name: seat.name } };
}

interface SharedState {
  cover: Cover | null;
  setCover(c: Cover | null): void;
}
export const useShared = create<SharedState>((set) => ({
  cover: null,
  setCover: (cover) => set({ cover }),
}));
