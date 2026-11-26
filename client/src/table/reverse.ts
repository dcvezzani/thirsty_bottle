import { useTable } from '../store/table';

/** reverse-order: reverse the order of these cards among the places they occupy in their zone. One action; faces and rotations do not change. */
export function reverseCards(handles: string[]) {
  if (handles.length < 2) return Promise.resolve(null);
  return useTable.getState().send({ type: 'reverseCards', cards: handles });
}

/** Reverse every card in a zone, as one action. */
export function reverseZone(zoneId: string) {
  return useTable.getState().send({ type: 'reverseZone', zone: zoneId });
}
