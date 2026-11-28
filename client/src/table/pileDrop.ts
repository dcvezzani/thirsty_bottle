/**
 * pile-drop-slot: choosing where in a pile a carried card goes. The gap is a slot among the cards that are not being carried
 * (slot 0 = on top, the pile's first card); the move takes an insertion index into the pile's full list, which still holds
 * the carried cards, and `endDrag` subtracts the carried ones before that index.
 */
export function slotCount(cards: { h: string }[], carried: ReadonlySet<string>): number {
  return cards.filter((c) => !carried.has(c.h)).length + 1;
}

export function slotToIndex(cards: { h: string }[], carried: ReadonlySet<string>, slot: number): number {
  if (slot <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < cards.length; i++) {
    if (carried.has(cards[i].h)) continue;
    seen += 1;
    if (seen === slot) return i + 1;
  }
  return cards.length;
}
