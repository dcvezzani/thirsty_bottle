import type { TableView, ZoneView } from '@vct/shared';
import { useTable } from '../store/table';
import { canAskToSee, hasShownCards } from './seeHand';

/** request-hand-view: "Ask to see hand" on another player's hand ("Asked…" while waiting for their answer). */
export function AskToSee({ view, seatId }: { view: TableView; seatId: string | null }) {
  const state = canAskToSee(view, seatId);
  if (!state) return null;
  return (
    <button
      className="hand-action"
      aria-label={state === 'pending' ? 'Asked to see hand' : 'Ask to see hand'}
      disabled={state === 'pending'}
      onClick={() => useTable.getState().send({ type: 'seeAsk', seat: seatId! })}
    >
      {state === 'pending' ? 'Asked…' : 'Ask to see'}
    </button>
  );
}

/** request-hand-view: ends every show of my hand cards in one tap (offered while any of them is shown). */
export function StopShowingHand({ hand }: { hand: ZoneView }) {
  if (!hasShownCards(hand.cards)) return null;
  return (
    <button className="hand-action" aria-label="Stop showing my hand" onClick={() => useTable.getState().send({ type: 'unshow', cards: hand.cards.map((c) => c.h) })}>
      Stop showing
    </button>
  );
}
