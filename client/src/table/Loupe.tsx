import type { TableView } from '@vct/shared';
import { CardFace, findDef } from '../components/Card';
import { MetaList } from '../pages/DeckEditor';
import { findCard, useUI, zoneLabel } from './ui';

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
  if (!loupe || !preview) return null;
  const found = findCard(view, preview.h);
  if (!found) return null;
  const { card, zone } = found;
  const def = findDef(view.decks, card);
  const known = card.known && !!def;
  const ambiguous = def && view.decks.some((d) => d.id !== card.deck && d.defs.some((x) => x.name === def.name));
  const where = zoneLabel(view, zone);
  const title = loupe.row ? `${loupe.row}` : where;
  const capH = 44;
  const cardW = Math.min(Math.floor((loupe.h - capH) / 1.4), 200);
  const showDetails = loupe.details;
  return (
    <div className="loupe" data-testid="loupe" data-side={loupe.side} style={{ top: loupe.y, height: loupe.h }} role="img" aria-label={known ? def!.name : 'Face-down card'}>
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
