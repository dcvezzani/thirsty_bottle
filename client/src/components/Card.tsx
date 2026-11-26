import type { CSSProperties } from 'react';
import type { CardDef, CardView, TableDeckView } from '@vct/shared';
import { imageUrl } from '../lib/api';
import { rotationTransform } from '../table/rotation';

const SUIT: Record<string, { sym: string; red: boolean }> = {
  Spades: { sym: '♠', red: false },
  Hearts: { sym: '♥', red: true },
  Diamonds: { sym: '♦', red: true },
  Clubs: { sym: '♣', red: false },
  Joker: { sym: '★', red: true },
};

/** Generated face for cards without artwork: name plus key metadata. */
export function TextFace({ def }: { def: Pick<CardDef, 'name' | 'metadata'> }) {
  const md = def.metadata ?? {};
  const suit = typeof md.suit === 'string' ? SUIT[md.suit] : undefined;
  const corner = typeof md.rankLabel === 'string' ? md.rankLabel : undefined;
  const keys = Object.entries(md)
    .filter(([k]) => !['suit', 'rank', 'rankLabel', 'color'].includes(k))
    .slice(0, 3);
  return (
    <div className={`text-face ${suit?.red ? 'red' : ''}`}>
      {corner && suit ? (
        <>
          <span className="corner tl">
            {corner}
            <br />
            {suit.sym}
          </span>
          <span className="pip">{suit.sym}</span>
          <span className="corner br">
            {corner}
            <br />
            {suit.sym}
          </span>
        </>
      ) : (
        <>
          <span className="tf-name">{def.name}</span>
          {keys.map(([k, v]) => (
            <span key={k} className="tf-meta">
              {k}: {Array.isArray(v) ? v.join(', ') : String(v)}
            </span>
          ))}
        </>
      )}
      <span className="sr-only">{def.name}</span>
    </div>
  );
}

export function CardBack({ imageId, share }: { imageId?: string; share?: string }) {
  if (imageId) return <img className="card-img" src={imageUrl(imageId, true, share)} alt="" draggable={false} />;
  return <div className="gen-back" aria-hidden />;
}

export function findDef(decks: TableDeckView[], c: CardView): CardDef | undefined {
  if (!c.known) return undefined;
  return decks.find((d) => d.id === c.deck)?.defs.find((x) => x.id === c.def);
}

/** A card as rendered on the table. */
export function CardFace({
  card,
  decks,
  style,
  className = '',
  large = false,
  upright = false,
  turnFit,
  turnShift,
  decorative = false,
}: {
  card: CardView;
  decks: TableDeckView[];
  style?: CSSProperties;
  className?: string;
  large?: boolean;
  /** card-rotation: draw the card upright whatever its rotation (the card details, the loupe's Card and Details views). */
  upright?: boolean;
  /** card-rotation: a scale for the rotated card; only the loupe's True full view uses one, to fit its fixed box. */
  turnFit?: number;
  /** pile-corner-stack: moves a rotated card (fractions of the card width) before it turns about its own centre. */
  turnShift?: { dx: number; dy: number };
  /** pile-shows-turned: a card drawn only to be seen beneath another: no handle, no label, no marks, not announced or tappable. */
  decorative?: boolean;
}) {
  const def = findDef(decks, card);
  const turn = upright ? undefined : rotationTransform(card.rot, turnFit, turnShift);
  const showFace = card.known && (card.faceUp || !!def);
  // A known card that is face down (e.g. my hand, peeked) shows its face dimmed with a "face down" mark.
  const content =
    showFace && def ? (
      def.frontImageId ? (
        <img className="card-img" src={imageUrl(def.frontImageId, !large)} alt="" draggable={false} />
      ) : (
        <TextFace def={def} />
      )
    ) : (
      <CardBack imageId={card.back} />
    );
  const label = def ? (card.copyOf && card.copyOf > 1 ? `${def.name} #${card.copyNo}` : def.name) : 'Face-down card';
  return (
    <div
      className={`card ${showFace ? 'face' : 'back'} ${card.known && !card.faceUp ? 'known-down' : ''} ${turn ? 'rotated' : ''} ${className}`}
      style={style}
      {...(decorative ? { 'aria-hidden': true } : { 'data-h': card.h, 'aria-label': label, role: 'img' })}
    >
      {/* card-rotation: a rotated card turns as a whole (border and shadow too) at its normal size; its zone makes room */}
      {turn ? (
        <div className="card-turn" style={{ transform: turn }} data-testid="card-turn" data-rot={card.rot}>
          {content}
        </div>
      ) : (
        content
      )}
      {!decorative && showFace && card.copyOf !== undefined && card.copyOf > 1 && (
        <span className="copy-badge" data-testid="copy-badge">
          {card.copyNo}/{card.copyOf}
        </span>
      )}
      {!decorative && card.shownTo && <span className="mark shown" title="Shown">👁</span>}
      {!decorative && card.peeked && <span className="mark peek" title="Peeking">🔍</span>}
    </div>
  );
}

/** Card preview for deck editing/browsing (definition, not instance). */
export function DefCard({ def, back, style }: { def: Pick<CardDef, 'name' | 'metadata' | 'frontImageId'>; back?: string; style?: CSSProperties }) {
  void back;
  return (
    <div className="card face" style={style} role="img" aria-label={def.name}>
      {def.frontImageId ? <img className="card-img" src={imageUrl(def.frontImageId, true)} alt="" draggable={false} /> : <TextFace def={def} />}
    </div>
  );
}
