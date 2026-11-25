import type { CardView, TableView } from '@vct/shared';

/**
 * request-hand-view: is the "Ask to see hand" control offered for this seat's hand?
 * 'ask' = offer it; 'pending' = I already asked (shows "Asked…"); null = not offered (not seated, my own hand,
 * an empty seat, or nothing of that hand is hidden from me).
 */
export function canAskToSee(view: TableView, seatId: string | null | undefined): 'ask' | 'pending' | null {
  if (!seatId || !view.me.seatId || view.me.spectator || seatId === view.me.seatId) return null;
  const seat = view.seats.find((s) => s.id === seatId);
  if (!seat?.playerId) return null;
  const hand = view.zones.find((z) => z.kind === 'hand' && z.seatId === seatId);
  if (!hand || !hand.cards.some((c) => !c.known)) return null;
  const pending = (view.requests ?? []).some((r) => r.kind === 'see' && r.dir === 'outgoing' && r.seatId === seatId);
  return pending ? 'pending' : 'ask';
}

/** Cards of my hand that I have shown to someone (the eye-marked ones): "Stop showing my hand" is offered while any exist. */
export const hasShownCards = (cards: CardView[]) => cards.some((c) => !!c.shownTo?.length);
