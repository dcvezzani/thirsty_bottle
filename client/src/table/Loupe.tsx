import type { TableView } from '@vct/shared';
import { CardFace, findDef } from '../components/Card';
import { MetaList } from '../pages/DeckEditor';
import { findCard, useUI, zoneLabel } from './ui';
import { isQuickTap, showsDetails } from './loupeView';
import { useRef } from 'react';

/** Where a hidden card is, as the card details view says it. */
function whereText(view: TableView, zone: ReturnType<typeof findCard> & {}) {
  const z = zone.zone;
  if (z.kind === 'hand') return z.seatId === view.me.seatId ? 'In your hand' : `In ${zoneLabel(view, z).replace("'s hand", '')}'s hand`;
  return `${z.name}, card ${zone.index + 1} of ${z.cards.length}`;
}

/**
 * scrub-loupe: the card under the scrubbing finger, large, in a fixed box that never covers the zone being scrubbed.
 * A pause turns it into the full details. Not interactive.
 */
export function Loupe({ view }: { view: TableView }) {
  const loupe = useUI((s) => s.loupe);
  const preview = useUI((s) => s.preview);
  const viewed = useUI((s) => s.viewed);
  const face = useUI((s) => s.loupeFace);
  const tap = useRef<{ id: number; t: number; x: number; y: number } | null>(null);
  const shownH = preview?.h ?? viewed?.h;
  if (!loupe || !shownH) return null;
  const found = findCard(view, shownH);
  if (!found) return null;
  const { card, zone } = found;
  const def = findDef(view.decks, card);
  const known = card.known && !!def;
  const ambiguous = def && view.decks.some((d) => d.id !== card.deck && d.defs.some((x) => x.name === def.name));
  const where = zoneLabel(view, zone);
  const title = loupe.row ? `${loupe.row}` : where;
  const capH = 44;
  const cardW = Math.min(Math.floor((loupe.h - capH) / 1.4), 200);
  const stay = !!viewed && !preview; // released in 'stay' mode: the loupe has buttons
  const showDetails = showsDetails(face, loupe.details);
  return (
    <div
      className={`loupe ${stay ? 'stay' : 'scrubbing'}`}
      data-testid="loupe"
      data-side={loupe.side}
      style={{ top: loupe.y, height: loupe.h }}
      role={stay ? 'dialog' : 'img'}
      aria-label={known ? def!.name : 'Face-down card'}
      // second-finger mode: a quick tap of another finger on the loupe switches its view while a scrub carries on
      onPointerDown={(e) => {
        if (stay) return;
        tap.current = { id: e.pointerId, t: performance.now(), x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const d = tap.current;
        tap.current = null;
        if (!stay && d && d.id === e.pointerId && isQuickTap(d, { t: performance.now(), x: e.clientX, y: e.clientY })) useUI.getState().flipLoupe();
      }}
      onPointerCancel={() => (tap.current = null)}
    >
      {stay && (
        <div className="loupe-controls" role="group" aria-label="Loupe view">
          <button className={`small${!showDetails ? ' primary' : ''}`} aria-pressed={!showDetails} onClick={() => useUI.getState().chooseFace('card')}>
            Card
          </button>
          <button className={`small${showDetails ? ' primary' : ''}`} aria-pressed={showDetails} onClick={() => useUI.getState().chooseFace('details')}>
            Details
          </button>
          <span className="grow" />
          <button className="small icon" aria-label="Close loupe" onClick={() => useUI.setState({ viewed: null, loupe: null, preview: null })}>
            ✕
          </button>
        </div>
      )}
      <div className={`loupe-body ${showDetails ? 'details' : ''}`}>
        <CardFace card={card} decks={view.decks} large style={{ ['--card-w' as any]: `${showDetails ? Math.floor(cardW * 0.7) : cardW}px` }} />
        {showDetails && (
          <div className="loupe-text" data-testid="loupe-details">
            {known ? (
              <>
                <strong>{def!.name}</strong>
                <div className="small-text muted">
                  Copy {card.copyNo} of {card.copyOf}
                  {ambiguous && ` · from ${view.decks.find((d) => d.id === card.deck)?.name}`}
                </div>
                {def!.description && <p>{def!.description}</p>}
                <MetaList def={def!} />
              </>
            ) : (
              <>
                <strong>Face-down card</strong>
                <p data-testid="loupe-hidden">{whereText(view, found)}</p>
              </>
            )}
          </div>
        )}
      </div>
      <div className="loupe-cap small-text">{title}</div>
    </div>
  );
}
