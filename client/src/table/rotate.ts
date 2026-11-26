import { useTable } from '../store/table';
import { isOthersZone, useUI } from './ui';
import type { TableView, ZoneView } from '@vct/shared';

/** card-rotation: turn these cards by `by` steps of 45° (clockwise when positive), or set them to `to` (0 = upright). One action. */
export function rotateCards(handles: string[], how: { by: number } | { to: number }) {
  if (!handles.length) return Promise.resolve(null);
  return useTable.getState().send({ type: 'rotate', cards: handles, ...how });
}

/** Every card in a zone, as one action. */
export function rotateZone(zoneId: string, how: { by: number } | { to: number }) {
  return useTable.getState().send({ type: 'rotateZone', zone: zoneId, ...how });
}

/** card-rotation: add 45° to the cards being carried (they are still in their source zone until the drop). */
export function rotateCarried() {
  const d = useUI.getState().drag;
  const view = useTable.getState().view;
  if (!d || !view) return;
  if (!canRotateIn(view, view.zones.find((z) => z.id === d.fromZone))) return;
  try {
    navigator.vibrate?.(10);
  } catch {
    /* unsupported */
  }
  return rotateCards(d.handles, { by: 1 });
}

/** Whether the player may rotate cards in this zone: the flip rules (not in another player's zone, not as a spectator). */
export function canRotateIn(view: TableView, zone: ZoneView | undefined): boolean {
  if (!zone || view.me.spectator) return false;
  return !isOthersZone(view, zone) || view.settings.openHands;
}
