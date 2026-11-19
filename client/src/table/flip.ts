import type { TableView } from '@vct/shared';
import { useTable } from '../store/table';
import { predictFlip } from '../store/predict';
import { useUI } from './ui';

/** Flip these cards as one action, turning them at once (the server confirms or rolls back). */
export function flipCards(handles: string[]) {
  if (!handles.length) return Promise.resolve(null);
  return useTable.getState().send({ type: 'flip', cards: handles }, (v: TableView) => predictFlip(v, handles));
}

/** Flip the current selection and clear it (selection bar, Actions… sheet). */
export function flipSelection() {
  const st = useUI.getState();
  const handles = [...st.selected];
  st.clear();
  return flipCards(handles);
}

/**
 * card-handling "Quick flip": a double tap on card `h` in `zoneId` flips the whole selection when
 * the card is part of it (then clears it), otherwise just that card, leaving the selection alone.
 */
export function quickFlip(zoneId: string, h: string) {
  const st = useUI.getState();
  if (st.selZone === zoneId && st.selected.includes(h)) return flipSelection();
  return flipCards([h]);
}
