import { useEffect, useMemo } from 'react';
import type { TableView } from '@vct/shared';
import { CardFace } from '../components/Card';
import { CardRow } from './CardRow';
import { overviewSections, type OverviewZone } from './overview';
import { useUI } from './ui';

function ZoneStrip({ z, view }: { z: OverviewZone; view: TableView }) {
  const onInfo = (h: string) => useUI.getState().setSheet({ kind: 'info', h });
  return (
    <div className="ov-zone" data-testid={`ov-zone-${z.name}`}>
      <h4>
        {z.name} <span className="ov-count">{z.count}</span>
      </h4>
      {z.layout === 'pile' ? (
        <div className="ov-pile" data-testid={`ov-pile-${z.name}`}>
          {z.top ? <CardFace card={z.top} decks={view.decks} /> : <div className="row-empty">Empty</div>}
          <span className="ov-count">{z.count} {z.count === 1 ? 'card' : 'cards'}</span>
        </div>
      ) : (
        <CardRow zone={z.zone} decks={view.decks} interactive={false} draggable={false} onInfo={onInfo} onTapCard={onInfo} testId={`ov-row-${z.name}`} emptyText="Empty" />
      )}
    </div>
  );
}

/** table-overview: everything public at the table on one scrolling page, read-only, over the table. */
export function OverviewLayer({ view }: { view: TableView }) {
  const open = useUI((s) => s.overview);
  const close = () => useUI.setState({ overview: false, preview: null, loupe: null, viewed: null });
  const o = useMemo(() => overviewSections(view), [view]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !useUI.getState().sheet) close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  if (!open) return null;
  return (
    <div className="overview" role="dialog" aria-label="Table overview" data-testid="overview">
      <header className="ov-top">
        <h2>Overview</h2>
        {o.turn && (
          <span className="pill" data-testid="ov-turn">
            {o.turn.name}'s turn
          </span>
        )}
        <span className="grow" />
        <button aria-label="Close overview" onClick={close}>
          ✕
        </button>
      </header>
      <section aria-label="On the table">
        <h3>On the table</h3>
        {o.shared.length ? o.shared.map((z) => <ZoneStrip key={z.id} z={z} view={view} />) : <p className="muted">No zones yet.</p>}
      </section>
      <section aria-label="Players">
        <h3>Players</h3>
        {o.players.map((p) => (
          <div key={p.seatId} className={`ov-player${p.active ? ' active' : ''}`} data-testid={`ov-player-${p.name}`} style={{ ['--seat-color' as any]: p.color }}>
            <h4>
              {p.host && <span title="Host">👑 </span>}
              {p.name}
              {p.me && ' (you)'}
              {p.active && <span className="ov-turn-mark"> · their turn</span>}
              <span className="ov-count" data-testid={`ov-hand-${p.name}`}>
                {p.handCount} in hand
              </span>
            </h4>
            {p.shownZone && (
              <div className="ov-zone">
                <h4>
                  Shown to everyone <span className="ov-count">{p.shown.length}</span>
                </h4>
                <CardRow zone={p.shownZone} decks={view.decks} interactive={false} draggable={false} onInfo={(h) => useUI.getState().setSheet({ kind: 'info', h })} onTapCard={(h) => useUI.getState().setSheet({ kind: 'info', h })} testId={`ov-shown-${p.name}`} />
              </div>
            )}
            {p.zones.map((z) => (
              <ZoneStrip key={z.id} z={z} view={view} />
            ))}
          </div>
        ))}
        {!o.players.length && <p className="muted">Nobody is seated.</p>}
      </section>
      <section aria-label="Counters">
        <h3>Counters</h3>
        {o.counters.length ? (
          <ul className="ov-counters">
            {o.counters.map((c) => (
              <li key={c.id}>
                <span>{c.label}</span> <strong>{c.value}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No counters.</p>
        )}
      </section>
      <section aria-label="Notes">
        <h3>Notes</h3>
        {o.notes.trim() ? <p className="ov-notes" data-testid="ov-notes">{o.notes}</p> : <p className="muted">No notes.</p>}
      </section>
    </div>
  );
}
