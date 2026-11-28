import { useEffect, useMemo, useRef } from 'react';
import type { TableView, ZoneView } from '@vct/shared';
import { ZoneBox } from './Zones';
import { flowRows } from './flow';
import { overviewSections } from './overview';
import { zonePad } from './rotation';
import { useBoardSize } from './useBoardSize';
import { useUI } from './ui';

const onInfo = (h: string) => useUI.getState().setSheet({ kind: 'info', h });

/** The zones as the table draws them: each in its own layout and width, wrapped into rows to fit, read-only. */
function ZoneRows({ zones, w, cardW, view }: { zones: ZoneView[]; w: number; cardW: number; view: TableView }) {
  const rows = flowRows(zones.map((z) => ({ id: z.id, layout: z.layout, width: z.width, newRow: z.newRow, padX: zonePad(z).x })), w, cardW);
  const byId = new Map(zones.map((z) => [z.id, z]));
  return (
    <>
      {rows.map((row) => (
        <div className="zone-row" key={row[0].id}>
          {row.map((it) => (
            <ZoneBox key={it.id} view={view} zone={byId.get(it.id)!} onInfo={onInfo} flow={it} readOnly />
          ))}
        </div>
      ))}
    </>
  );
}

/** table-overview: everything public at the table on one scrolling page, read-only, over the table. */
export function OverviewLayer({ view }: { view: TableView }) {
  const open = useUI((s) => s.overview);
  return open ? <OverviewPage view={view} /> : null;
}

function OverviewPage({ view }: { view: TableView }) {
  const ref = useRef<HTMLDivElement>(null);
  const zoom = useUI((s) => s.zoom);
  const size = useBoardSize(ref, zoom);
  const close = () => useUI.setState({ overview: false, preview: null, loupe: null, viewed: null });
  const o = useMemo(() => overviewSections(view), [view]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !useUI.getState().sheet) close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const w = size?.w ?? 0;
  const cardW = size?.cardW ?? 64;
  const playerW = Math.max(120, w - 16); // a player's block has a stripe and padding on its left
  return (
    <div className="overview" ref={ref} role="dialog" aria-label="Table overview" data-testid="overview">
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
        {!o.shared.length && <p className="muted">No zones yet.</p>}
        {size && <ZoneRows zones={o.shared.map((z) => z.zone)} w={w} cardW={cardW} view={view} />}
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
            {size && <ZoneRows zones={[...(p.shownZone ? [p.shownZone] : []), ...p.zones.map((z) => z.zone)]} w={playerW} cardW={cardW} view={view} />}
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
