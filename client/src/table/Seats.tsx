import type { TableView } from '@vct/shared';
import { CardFace } from '../components/Card';
import { useUI } from './ui';

/** Other players around the table: name, hand count, connection, turn, host. Drop cards here to pass them. */
export function SeatBar({ view }: { view: TableView }) {
  const setSheet = useUI((s) => s.setSheet);
  const over = useUI((s) => s.drag?.over);
  const others = view.seats.filter((s) => s.id !== view.me.seatId);
  if (!others.length) return null;
  return (
    <div className="seat-bar" aria-label="Seats">
      {others.map((s) => {
        const hand = view.zones.find((z) => z.kind === 'hand' && z.seatId === s.id);
        const visible = hand?.cards.filter((c) => c.known) ?? [];
        const active = view.mode === 'turn' && view.turn.active === s.id;
        const isOver = over?.kind === 'seat' && over.seat === s.id;
        return (
          <button
            key={s.id}
            className={`seat ${active ? 'active' : ''} ${s.disconnected ? 'away' : ''} ${!s.playerId ? 'empty' : ''} ${isOver ? 'drop-over' : ''}`}
            style={{ ['--seat-color' as any]: s.color }}
            data-drop-seat={s.playerId || hand?.cards.length !== undefined ? s.id : undefined}
            data-seat-zone={hand?.id}
            data-testid={`seat-${s.name || s.index + 1}`}
            onClick={() => setSheet({ kind: 'seat', seat: s.id })}
            aria-label={`${s.playerId ? s.name : `Empty seat ${s.index + 1}`}${active ? ', their turn' : ''}${s.disconnected ? ', disconnected' : ''}: ${s.handCount} cards`}
          >
            <span className="seat-name">
              {view.hostId === s.playerId && <span title="Host">👑 </span>}
              {s.playerId ? s.name : `Seat ${s.index + 1}`}
            </span>
            <span className="seat-hand">
              <span className="mini-backs" aria-hidden>
                {Array.from({ length: Math.min(5, s.handCount) }, (_, i) => (
                  <span key={i} className="mini-back" />
                ))}
              </span>
              <span className="seat-count">{s.handCount}</span>
            </span>
            {s.disconnected && <span className="seat-status">disconnected</span>}
            {!s.connected && !s.disconnected && s.playerId && <span className="seat-status">…</span>}
            {visible.length > 0 && (
              <span className="seat-shown" aria-label="Cards shown to you">
                {visible.slice(0, 4).map((c) => (
                  <CardFace key={c.h} card={c} decks={view.decks} style={{ ['--card-w' as any]: '28px' }} />
                ))}
              </span>
            )}
          </button>
        );
      })}
      {view.spectators.length > 0 && <span className="pill">{view.spectators.length} watching</span>}
    </div>
  );
}
