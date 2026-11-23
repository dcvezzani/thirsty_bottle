import type { TableView } from '@vct/shared';
import { CardFace } from '../components/Card';
import { useUI } from './ui';

/** Other players around the table: name, hand count, connection, turn, host. Drop cards here to pass them. */
export function SeatBar({ view, shown = view.me.seatId }: { view: TableView; shown?: string | null }) {
  const setSheet = useUI((s) => s.setSheet);
  const over = useUI((s) => s.drag?.over);
  // player-views: everyone but the seat whose table is shown (so I appear when viewing someone else)
  const others = view.seats.filter((s) => s.id !== shown);
  /** "viewing Sam" / "viewing you" for a player looking at another table. */
  const viewingLabel = (playerId: string | null) => {
    const v = playerId ? (view.viewers ?? []).find((x) => x.playerId === playerId) : undefined;
    if (!v) return null;
    if (v.seat === view.me.seatId) return 'viewing you';
    const target = view.seats.find((x) => x.id === v.seat);
    return target ? `viewing ${target.name}` : null;
  };
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
            aria-label={`${s.playerId ? s.name : `Empty seat ${s.index + 1}`}${active ? ', their turn' : ''}${s.disconnected ? ', disconnected' : ''}${viewingLabel(s.playerId) ? `, ${viewingLabel(s.playerId)}` : ''}: ${s.handCount} cards${(s.zoneCounts ?? []).map((z) => `, ${z.name} ${z.count}`).join('')}`}
          >
            <span className="seat-name">
              {view.hostId === s.playerId && <span title="Host">👑 </span>}
              {s.playerId ? s.name : `Seat ${s.index + 1}`}
              {s.id === view.me.seatId && ' (you)'}
            </span>
            {viewingLabel(s.playerId) && <span className="seat-viewing small-text">👁 {viewingLabel(s.playerId)}</span>}
            <span className="seat-hand">
              <span className="mini-backs" aria-hidden>
                {Array.from({ length: Math.min(5, s.handCount) }, (_, i) => (
                  <span key={i} className="mini-back" />
                ))}
              </span>
              <span className="seat-count">{s.handCount}</span>
            </span>
            {/* per-player-zones: a count for each of the player's per-player zones */}
            {(s.zoneCounts ?? []).map((z) => (
              <span key={z.zone} className="seat-zone-count small-text">
                {z.name} {z.count}
              </span>
            ))}
            {s.disconnected && <span className="seat-status">disconnected</span>}
            {!s.connected && !s.disconnected && s.playerId && <span className="seat-status">…</span>}
            {visible.length > 0 && s.id !== view.me.seatId && (
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
