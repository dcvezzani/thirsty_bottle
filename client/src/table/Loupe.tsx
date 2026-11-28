import type { TableView } from '@vct/shared';
import { CardFace, findDef } from '../components/Card';
import { MetaList } from '../pages/DeckEditor';
import { findCard, useUI, zoneLabel } from './ui';
import { isQuickTap, secondFingerGesture, showsDetails, showsTrue } from './loupeView';
import { fitInBox } from './rotation';
import { loupeSizes, loupeWidth } from './loupe';
import { canRotateIn, rotateCards } from './rotate';
import { useRef } from 'react';
import { canSeeFaceDown, toggleFaceDown } from './pileFaceDown';

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
  const chipTap = useRef<{ id: number; t: number; x: number; y: number } | null>(null);
  const seeFaceDown = useUI((s) => s.seeFaceDown);
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
  const stay = !!viewed && !preview; // released in 'stay' mode: the loupe has buttons
  const showDetails = showsDetails(face, loupe.details);
  // the true full view: the card at full size with its rotation, in a square box so a diagonal card is not shrunk to a portrait slot
  const trueView = showsTrue(face) && !showDetails;
  const sizes = loupeSizes(loupe.h, loupeWidth(window.innerWidth), stay);
  const cardW = trueView ? sizes.trueCard : showDetails ? sizes.details : sizes.card;
  const cardH = cardW * 1.4;
  const canRotate = canRotateIn(view, zone);
  // pile-scrub: the chip that lets the player see the faces of a pile's face-down cards without leaving the scrub
  const faceDownOn = seeFaceDown?.zone === zone.id;
  const showChip = canSeeFaceDown(view, zone, faceDownOn);
  const turnFit = fitInBox(card.rot ?? 0, cardW, cardH, cardH, cardH);
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
        try {
          e.currentTarget.setPointerCapture(e.pointerId); // a swipe may leave the loupe before it lifts
        } catch {
          /* ignore */
        }
      }}
      onPointerUp={(e) => {
        const d = tap.current;
        tap.current = null;
        if (stay || !d || d.id !== e.pointerId) return;
        // a quick tap switches the view; a quick sideways swipe rotates the card shown (when the player may)
        const g = secondFingerGesture(d, { t: performance.now(), x: e.clientX, y: e.clientY });
        if (g === 'tap') useUI.getState().flipLoupe();
        else if (g && canRotate) {
          try {
            navigator.vibrate?.(10);
          } catch {
            /* unsupported */
          }
          void rotateCards([card.h], { by: g === 'right' ? 1 : -1 });
        }
      }}
      onPointerCancel={() => (tap.current = null)}
    >
      {stay && (
        <div className="loupe-controls" role="group" aria-label="Loupe view">
          <button className={`small${!showDetails && !trueView ? ' primary' : ''}`} aria-pressed={!showDetails && !trueView} onClick={() => useUI.getState().chooseFace('card')}>
            Card
          </button>
          <button className={`small${showDetails ? ' primary' : ''}`} aria-pressed={showDetails} onClick={() => useUI.getState().chooseFace('details')}>
            Details
          </button>
          <button className={`small${trueView ? ' primary' : ''}`} aria-pressed={trueView} onClick={() => useUI.getState().chooseFace('true')}>
            True full
          </button>
          {showChip && (
            <button className={`small${faceDownOn ? ' primary' : ''}`} aria-pressed={faceDownOn} data-testid="see-face-down" onClick={() => void toggleFaceDown(view, zone.id)}>
              See face-down
            </button>
          )}
          <span className="grow" />
          <button className="small icon" aria-label="Rotate back 45°" disabled={!canRotate} onClick={() => rotateCards([card.h], { by: -1 })}>
            ↺
          </button>
          <button className="small icon" aria-label="Rotate 45°" disabled={!canRotate} onClick={() => rotateCards([card.h], { by: 1 })}>
            ↻
          </button>
          <button className="small icon" aria-label="Close loupe" onClick={() => useUI.setState({ viewed: null, loupe: null, preview: null })}>
            ✕
          </button>
        </div>
      )}
      {showChip && !stay && (
        <button
          className={`loupe-chip${faceDownOn ? ' on' : ''}`}
          aria-pressed={faceDownOn}
          data-testid="see-face-down"
          // a second finger taps it during a scrub; it handles its own tap so the loupe's view toggle does not also run
          onPointerDown={(e) => {
            e.stopPropagation();
            chipTap.current = { id: e.pointerId, t: performance.now(), x: e.clientX, y: e.clientY };
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            const d = chipTap.current;
            chipTap.current = null;
            if (d && d.id === e.pointerId && isQuickTap(d, { t: performance.now(), x: e.clientX, y: e.clientY })) void toggleFaceDown(view, zone.id);
          }}
          onPointerCancel={() => (chipTap.current = null)}
        >
          See face-down
        </button>
      )}
      <div className={`loupe-body ${showDetails ? 'details' : ''}`}>
        {trueView ? (
          <div className="loupe-true" data-testid="loupe-true" style={{ width: cardH, height: cardH }}>
            <CardFace card={card} decks={view.decks} large turnFit={turnFit} style={{ ['--card-w' as any]: `${cardW}px` }} />
          </div>
        ) : (
          <CardFace card={card} decks={view.decks} large upright style={{ ['--card-w' as any]: `${cardW}px` }} />
        )}
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
