import type { TableView, ZoneView } from '@vct/shared';
import { useTable } from '../store/table';
import { useApp } from '../store/app';
import { isOthersZone, useUI } from './ui';

/**
 * pile-scrub: "See face-down" while scrubbing a pile. Turning it on peeks at every card of the pile that the player cannot
 * see (one peek, one log line for everyone); turning it off, or ending the scrub, clears the peek for exactly those cards.
 */

/** Whether the chip is offered: a pile with cards I cannot see (or one I already turned on), for a seated player, that I may peek at. */
export function canSeeFaceDown(view: TableView, zone: ZoneView, on: boolean): boolean {
  if (zone.layout !== 'pile' || view.me.spectator || isOthersZone(view, zone)) return false;
  return on || zone.cards.some((c) => !c.known);
}

export async function toggleFaceDown(view: TableView, zoneId: string) {
  const fd = useUI.getState().seeFaceDown;
  if (fd?.zone === zoneId) return endFaceDown();
  const zone = view.zones.find((z) => z.id === zoneId);
  if (!zone) return;
  const hidden = zone.cards.filter((c) => !c.known).map((c) => c.h);
  if (!hidden.length) return;
  useUI.setState({ seeFaceDown: { zone: zoneId, peeked: hidden } });
  const r = await useTable.getState().send({ type: 'peek', cards: hidden });
  if (!r.ok && useUI.getState().seeFaceDown?.zone === zoneId) {
    useUI.setState({ seeFaceDown: null });
    useApp.getState().toast(r.error ?? 'Could not look at the face-down cards', 'error');
  }
}

/** Clears the chip's peek (cards that have moved or gone since are left alone). */
export function endFaceDown() {
  const fd = useUI.getState().seeFaceDown;
  if (!fd) return;
  useUI.setState({ seeFaceDown: null });
  const view = useTable.getState().view;
  const present = new Set(view?.zones.flatMap((z) => z.cards.map((c) => c.h)) ?? []);
  const cards = fd.peeked.filter((h) => present.has(h));
  if (cards.length) void useTable.getState().send({ type: 'unpeek', cards });
}
