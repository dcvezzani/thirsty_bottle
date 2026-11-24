import type { TableView, ZoneView } from '@vct/shared';
import { CardBack } from '../components/Card';
import { CardRow } from './CardRow';
import { useUI } from './ui';
import { viewedHandDisplay, viewedHandText } from './viewedHand';

/**
 * viewed-hand-priority: another player's hand while viewing their table. Full hand size when something is
 * shown to me (shown cards first, hidden ones as one stack), otherwise one slim line. Drops pass cards to them.
 */
export function ViewedHand({ view, zone, name, onInfo, last }: { view: TableView; zone: ZoneView; name: string; onInfo: (h: string) => void; last: boolean }) {
  const d = viewedHandDisplay(zone.cards);
  const text = viewedHandText(name, d);
  const hiddenBack = zone.cards.find((c) => !c.known)?.back;
  const openSeat = () => zone.seatId && useUI.getState().setSheet({ kind: 'seat', seat: zone.seatId });
  const stack = d.hidden > 0 && (
    <button className="hidden-stack ghost" aria-label={`${d.hidden} hidden card${d.hidden === 1 ? '' : 's'}`} onClick={openSeat}>
      <span className="card back">
        <CardBack imageId={hiddenBack} />
      </span>
      <span className="hidden-count">+{d.hidden} hidden</span>
    </button>
  );
  if (d.shown.length === 0)
    return (
      <div className={`viewed-hand slim ${last ? 'hand-area' : ''}`} aria-label={`${name}'s hand`} data-drop-zone={zone.id} data-testid="row-viewed-hand">
        <span className="viewed-hand-line">{text}</span>
        {stack}
      </div>
    );
  return (
    <div className={`viewed-hand full ${last ? 'hand-area' : ''}`} aria-label={`${name}'s hand`} data-drop-zone={zone.id}>
      <span className="viewed-hand-label small-text">{text}</span>
      <div className="viewed-hand-body">
        <div className="viewed-hand-cards">
          <CardRow zone={{ ...zone, cards: d.shown }} decks={view.decks} arc dropId={zone.id} onInfo={onInfo} testId="row-viewed-hand" emptyText="Nothing shown" />
        </div>
        {stack}
      </div>
    </div>
  );
}
