import type { CardView, TableView } from '@vct/shared';

/** Optimistic prediction of a move of cards the player can see (design D4). */
export function predictMove(
  v: TableView,
  handles: string[],
  to: string,
  index?: number,
  face?: 'up' | 'down',
): TableView {
  const set = new Set(handles);
  const moving: CardView[] = [];
  // stack-order-to-pile: where each moving card sits in its source zone, for the order a group takes onto a pile
  const sourceOf = new Map<string, { zone: string; index: number; layout: string }>();
  for (const z of v.zones) z.cards.forEach((c, i) => set.has(c.h) && sourceOf.set(c.h, { zone: z.id, index: i, layout: z.layout }));
  const zones = v.zones.map((z) => {
    const keep: CardView[] = [];
    for (const c of z.cards) (set.has(c.h) ? moving : keep).push(c);
    return keep.length === z.cards.length ? z : { ...z, cards: keep };
  });
  if (!moving.length) return v;
  moving.sort((a, b) => handles.indexOf(a.h) - handles.indexOf(b.h));
  const target = zones.find((z) => z.id === to);
  if (!target) return v;
  // a group from one hand, spread, column or free zone lands on a pile with its last card on top, as the server decides
  if (target.layout === 'pile' && index === undefined && moving.length > 1) {
    const srcs = new Set(moving.map((c) => sourceOf.get(c.h)?.zone));
    const first = sourceOf.get(moving[0].h);
    if (srcs.size === 1 && first && first.layout !== 'pile') moving.sort((a, b) => (sourceOf.get(b.h)?.index ?? 0) - (sourceOf.get(a.h)?.index ?? 0));
  }
  const myHand = target.kind === 'hand' && target.seatId === v.me.seatId;
  const othersHand = target.kind === 'hand' && !myHand;
  const placed = moving.map((c) => {
    const faceUp = face ? face === 'up' : c.faceUp;
    const n: CardView = { ...c, faceUp, shownTo: undefined, shownBy: undefined, peeked: undefined };
    if (othersHand || (target.kind !== 'hand' && !faceUp)) {
      // will be hidden from me after the move
      return { h: c.h, faceUp, known: false, ...(c.back ? { back: c.back } : {}) } as CardView;
    }
    return n;
  });
  const at = index === undefined ? (target.layout === 'pile' ? 0 : target.cards.length) : Math.min(index, target.cards.length);
  const cards = target.cards.slice();
  cards.splice(at, 0, ...placed);
  return { ...v, zones: zones.map((z) => (z.id === to ? { ...z, cards } : z)) };
}

export function predictFlip(v: TableView, handles: string[]): TableView {
  const set = new Set(handles);
  return {
    ...v,
    zones: v.zones.map((z) =>
      z.cards.some((c) => set.has(c.h))
        ? {
            ...z,
            cards: z.cards.map((c) => {
              if (!set.has(c.h)) return c;
              const faceUp = !c.faceUp;
              // flipping a face-up card face down outside a hand hides it from me (shared and per-player zones)
              if (z.kind !== 'hand' && !faceUp && !c.shownTo && !c.peeked) return { h: c.h, faceUp, known: false, ...(c.back ? { back: c.back } : {}) };
              return { ...c, faceUp };
            }),
          }
        : z,
    ),
  };
}
