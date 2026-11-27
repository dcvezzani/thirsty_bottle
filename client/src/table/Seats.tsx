import type { SeatView, TableView } from '@vct/shared';
import { useUI, viewingOf } from './ui';

/** Other players around the table, one line each: name and hand count (details in the seat sheet). Drop cards here to pass them. */
export function SeatBar({ view, shown = view.me.seatId }: { view: TableView; shown?: string | null }) {
  const setSheet = useUI((s) => s.setSheet);
  const over = useUI((s) => s.drag?.over);
  // player-views: everyone but the seat whose table is shown (so I appear when viewing someone else)
  const others = view.seats.filter((s) => s.id !== shown);
  const viewingLabel = (playerId: string | null) => viewingOf(view, playerId);
  if (!others.length) return null;
  return (
    <div className="seat-bar" aria-label="Seats">
      {others.map((s) => {
        const hand = view.zones.find((z) => z.kind === 'hand' && z.seatId === s.id);
        const active = view.mode === 'turn' && view.turn.active === s.id;
        const isOver = over?.kind === 'seat' && over.seat === s.id;
        return (
          <button
            key={s.id}
            className={`seat ${active ? 'active' : ''} ${s.disconnected && !s.guest ? 'away' : ''} ${!s.playerId ? 'empty' : ''} ${isOver ? 'drop-over' : ''}`}
            style={{ ['--seat-color' as any]: s.color }}
            data-drop-seat={s.playerId || hand?.cards.length !== undefined ? s.id : undefined}
            data-seat-zone={hand?.id}
            data-testid={`seat-${s.name || s.index + 1}`}
            onClick={() => setSheet({ kind: 'seat', seat: s.id })}
            aria-label={seatStatus(view, s, viewingLabel(s.playerId), active)}
          >
            {/* compact-seat-chips: one line, name and hand count only; the rest is in the seat sheet */}
            <span className="seat-name">
              {view.hostId === s.playerId && <span title="Host">👑 </span>}
              {s.playerId ? s.name : `Seat ${s.index + 1}`}
              {s.id === view.me.seatId && ' (you)'}
            </span>
            <span className="seat-hand" aria-hidden>
              <span className="mini-back" />
              <span className="seat-count">{s.handCount}</span>
            </span>
          </button>
        );
      })}
      {view.spectators.length > 0 && <span className="pill">{view.spectators.length} watching</span>}
    </div>
  );
}

/** compact-seat-chips: the chip's accessible name carries the full status, e.g. "George, host, disconnected, viewing Sam: 1 card in hand". */
export function seatStatus(view: TableView, s: SeatView, viewing: string | null, active = false): string {
  const parts = [s.playerId ? s.name : `Empty seat ${s.index + 1}`];
  if (s.id === view.me.seatId) parts.push('you');
  if (s.playerId && view.hostId === s.playerId) parts.push('host');
  if (active) parts.push('their turn');
  if (s.guest && !s.connected) parts.push('on a shared phone');
  else if (s.disconnected) parts.push('disconnected');
  else if (s.playerId && !s.connected) parts.push('reconnecting');
  if (viewing) parts.push(viewing);
  return `${parts.join(', ')}: ${s.handCount} card${s.handCount === 1 ? '' : 's'} in hand`;
}
