import { useEffect, useRef, useState } from 'react';
import type { TableView, ZoneView } from '@vct/shared';
import { CardBack } from '../components/Card';
import { CardRow } from './CardRow';
import { handBadgeText, nextFocus, shownIncreased, viewedHandDisplay, type HandColumn } from './handFocus';
import { useUI } from './ui';

/**
 * shared-hand-dock: while viewing another table the hand area is one dock of constant height, as tall as a lone
 * hand, in two columns: their hand (left) and mine (right). The focused column is wide; sliding along the narrow
 * one, or carrying cards over it, focuses it. A spectator has no hand of their own, so gets one full-width column.
 */
export function HandDock({ view, viewed, mine, name, onInfo }: { view: TableView; viewed: ZoneView; mine?: ZoneView; name: string; onInfo: (h: string) => void }) {
  const focus = useUI((s) => s.handFocus);
  const focusHand = useUI((s) => s.focusHand);
  const over = useUI((s) => (s.drag?.over?.kind === 'zone' ? s.drag.over.zone : null));
  const from = useUI((s) => s.drag?.fromZone ?? null);
  const d = viewedHandDisplay(viewed.cards);

  // carrying cards over the other column focuses it (not the column they came from)
  useEffect(() => {
    if (!mine || !over || over === from) return;
    const column: HandColumn | null = over === viewed.id ? 'viewed' : over === mine.id ? 'mine' : null;
    if (column) focusHand(nextFocus(focus, { kind: 'carry', column }));
  }, [over, from, mine?.id, viewed.id]);

  // a card newly shown to me pulses a narrow viewed column, without taking the focus
  const prevShown = useRef(d.shown.length);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const up = shownIncreased(prevShown.current, d.shown.length);
    prevShown.current = d.shown.length;
    if (!up || !mine || focus === 'viewed') return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 600);
    return () => clearTimeout(t);
  }, [d.shown.length]);

  const openSeat = () => viewed.seatId && useUI.getState().setSheet({ kind: 'seat', seat: viewed.seatId });
  const hiddenBack = viewed.cards.find((c) => !c.known)?.back;
  const state = (col: HandColumn) => (!mine ? 'solo' : focus === col ? 'focused' : 'narrow');
  return (
    <div className="hand-dock" data-testid="hand-dock">
      <section className={`hand-col viewed ${state('viewed')} ${pulse ? 'pulse' : ''}`} aria-label={`${name}'s hand`} data-drop-zone={viewed.id} data-testid="viewed-col">
        <span className="hand-badge">{handBadgeText(name, d)}</span>
        <div className="hand-col-body">
          <div className="hand-col-cards">
            <CardRow
              zone={{ ...viewed, cards: d.shown }}
              decks={view.decks}
              arc
              dropId={viewed.id}
              onInfo={onInfo}
              testId="row-viewed-hand"
              emptyText={d.total === 0 ? `${name}'s hand is empty` : ''}
              onScrubStart={() => mine && focusHand(nextFocus(focus, { kind: 'scrub', column: 'viewed' }))}
            />
          </div>
          {d.hidden > 0 && (
            <button className="hidden-stack ghost" aria-label={`${d.hidden} hidden card${d.hidden === 1 ? '' : 's'}`} onClick={openSeat}>
              <span className="card back">
                <CardBack imageId={hiddenBack} />
              </span>
              {/* the narrow column has little room: "+5" there, "+5 hidden" when focused (the full text stays in the label) */}
              <span className="hidden-count">+{d.hidden}{state('viewed') === 'narrow' ? '' : ' hidden'}</span>
            </button>
          )}
        </div>
      </section>
      {mine && (
        <section className={`hand-col mine ${state('mine')}`} aria-label="Your hand" data-testid="mine-col">
          <span className="hand-badge">You · {mine.cards.length}</span>
          <CardRow zone={mine} decks={view.decks} arc dropId={mine.id} onInfo={onInfo} emptyText="Your hand is empty" onScrubStart={() => focusHand(nextFocus(focus, { kind: 'scrub', column: 'mine' }))} />
        </section>
      )}
    </div>
  );
}
