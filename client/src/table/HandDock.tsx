import { useEffect, useRef, useState } from 'react';
import type { TableView, ZoneView } from '@vct/shared';
import { CardRow } from './CardRow';
import { handBadgeText, nextFocus, shownIncreased, viewedHandDisplay, type HandColumn } from './handFocus';
import { AskToSee, StopShowingHand } from './HandControls';
import { useUI } from './ui';
import { zonePad } from './rotation';

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

  const state = (col: HandColumn) => (!mine ? 'solo' : focus === col ? 'focused' : 'narrow');
  // card-rotation: the dock stays one constant height, tall enough for the more rotated of the two hands
  const roomY = Math.max(zonePad(viewed).y, mine ? zonePad(mine).y : 0);
  return (
    <div className="hand-dock" data-testid="hand-dock" style={{ ['--rot-room' as any]: `calc(var(--card-w) * ${2 * roomY})` }}>
      <section className={`hand-col viewed ${state('viewed')} ${pulse ? 'pulse' : ''}`} aria-label={`${name}'s hand`} data-drop-zone={viewed.id} data-testid="viewed-col">
        <div className="hand-top">
          <span className="hand-badge">{handBadgeText(name, d)}</span>
          <AskToSee view={view} seatId={viewed.seatId} />
        </div>
        <CardRow
          zone={{ ...viewed, cards: d.ordered }}
          decks={view.decks}
          arc
          dropId={viewed.id}
          onInfo={onInfo}
          testId="row-viewed-hand"
          emptyText={`${name}'s hand is empty`}
          onScrubStart={() => mine && focusHand(nextFocus(focus, { kind: 'scrub', column: 'viewed' }))}
        />
      </section>
      {mine && (
        <section className={`hand-col mine ${state('mine')}`} aria-label="Your hand" data-testid="mine-col">
          <div className="hand-top">
            <span className="hand-badge">You · {mine.cards.length}</span>
            <StopShowingHand hand={mine} />
          </div>
          <CardRow zone={mine} decks={view.decks} arc dropId={mine.id} onInfo={onInfo} emptyText="Your hand is empty" onScrubStart={() => focusHand(nextFocus(focus, { kind: 'scrub', column: 'mine' }))} />
        </section>
      )}
    </div>
  );
}
