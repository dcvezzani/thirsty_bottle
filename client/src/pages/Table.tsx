import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { TableSummary, TableView } from '@vct/shared';
import { useTable } from '../store/table';
import { useApp } from '../store/app';
import { api } from '../lib/api';
import { Chat } from '../components/Chat';
import { CardFace } from '../components/Card';
import { JoinTable } from './Lobby';
import { CardRow } from '../table/CardRow';
import { ZoneBox } from '../table/Zones';
import { SeatBar } from '../table/Seats';
import { useUI, findCard, type DrawerTab } from '../table/ui';
import { setBoardElement } from '../table/drag';
import { useBoardPan } from '../table/useBoardPan';
import { CardInfoSheet, CardsSheet, DealSheet, DecksSheet, DrawSheet, FanOutSheet, Prompts, SeatSheet, SelectionBar, SettingsSheet, ZoneSheet } from '../table/Sheets';
import { useFlip, inkOn } from '../table/anim';
import { flowRows } from '../table/flow';
import { ArrangeBar, ArrangeBoard } from '../table/Arrange';
import { ApplySetupSheet, SaveSetupSheet } from '../table/SetupSheets';

export function TablePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const status = useApp((s) => s.status);
  const view = useTable((s) => s.view);
  const tableId = useTable((s) => s.tableId);
  const left = useTable((s) => s.left);
  const [summary, setSummary] = useState<TableSummary | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (left) nav('/');
  }, [left, nav]);

  useEffect(() => {
    if (status !== 'online' || !id) return;
    if (tableId === id && view) return;
    // already a participant? rejoin (reconnect / reload) — otherwise show the join sheet
    useTable
      .getState()
      .join(id)
      .catch(async (e) => {
        if (e.code === 'NO_TABLE') return setErr('That table no longer exists.');
        try {
          setSummary((await api('GET', `/api/tables/${id}`)).table);
        } catch {
          setErr('That table no longer exists.');
        }
      });
  }, [status, id]);

  if (err)
    return (
      <div className="page">
        <div className="content empty" role="alert">
          {err} <button onClick={() => nav('/')}>Back to lobby</button>
        </div>
      </div>
    );
  if (!view || view.id !== id)
    return (
      <div className="table-screen">
        <div className="center" style={{ color: '#fff' }}>
          {summary ? null : 'Loading table…'}
        </div>
        {summary && <JoinTable table={summary} direct onClose={() => (useTable.getState().tableId ? setSummary(null) : nav('/'))} />}
      </div>
    );
  return <TableScreen view={view} />;
}

/** Board content width (inside its padding) and the table's base card width at the current zoom. */
function useBoardSize(ref: RefObject<HTMLDivElement>, zoom: number) {
  const [size, setSize] = useState<{ w: number; cardW: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const base = parseFloat(cs.getPropertyValue('--base-card-w')) || 64;
      const next = { w: Math.floor(w), cardW: Math.round(base * zoom * 10) / 10 };
      setSize((cur) => (cur && cur.w === next.w && cur.cardW === next.cardW ? cur : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, zoom]);
  return size;
}

function TableScreen({ view }: { view: TableView }) {
  const nav = useNavigate();
  const sheet = useUI((s) => s.sheet);
  const setSheet = useUI((s) => s.setSheet);
  const drawer = useUI((s) => s.drawer);
  const zoom = useUI((s) => s.zoom);
  const unreadLobby = useApp((s) => s.unread.lobby ?? 0);
  const unreadRoom = useApp((s) => s.unread[`table:${view.id}`] ?? 0);
  const boardRef = useRef<HTMLDivElement>(null);
  const closeSheet = useCallback(() => setSheet(null), [setSheet]);
  const onInfo = useCallback((h: string) => setSheet({ kind: 'info', h }), [setSheet]);
  useFlip(view);

  useBoardPan(boardRef);
  useLayoutEffect(() => {
    setBoardElement(boardRef.current);
    return () => setBoardElement(null);
  }, []);

  // drop stale selection (cards that moved away)
  useEffect(() => {
    const st = useUI.getState();
    if (!st.selZone) return;
    const z = view.zones.find((x) => x.id === st.selZone);
    const keep = st.selected.filter((h) => z?.cards.some((c) => c.h === h));
    if (keep.length !== st.selected.length) st.select(st.selZone, keep);
  }, [view]);

  useEffect(() => () => useUI.setState({ sheet: null, drag: null, preview: null, selZone: null, selected: [], arranging: false }), []);

  const myHand = view.zones.find((z) => z.kind === 'hand' && z.seatId === view.me.seatId);
  // zone-arrangement: the server's zone order drives the board; each device wraps it into rows
  const shared = view.zones.filter((z) => z.kind === 'shared');
  const boardSize = useBoardSize(boardRef, zoom);
  const arranging = useUI((s) => s.arranging) && view.me.isHost;
  const rows = boardSize ? flowRows(shared, boardSize.w, boardSize.cardW) : [];
  const zoneById = new Map(shared.map((z) => [z.id, z]));
  const active = view.seats.find((s) => s.id === view.turn.active);
  const myTurn = view.mode === 'turn' && view.turn.active === view.me.seatId;
  const canSwitch = view.me.isHost || (view.settings.playersMaySwitchMode && !view.me.spectator);
  const send = useTable.getState().send;

  return (
    <div className="table-screen" style={{ ['--card-w' as any]: `calc(var(--base-card-w) * ${zoom})` }}>
      <header className="topbar table-top">
        <button aria-label="Back to lobby" onClick={() => nav('/')}>
          ←
        </button>
        <h1 title={view.settings.name}>{view.settings.name}</h1>
        <button
          className={`mode-chip ${view.mode}`}
          aria-label={`Mode: ${view.mode === 'turn' ? 'turn-based' : 'real-time'}${canSwitch ? ' (tap to switch)' : ''}`}
          disabled={!canSwitch}
          onClick={() => send({ type: 'setMode', mode: view.mode === 'turn' ? 'realtime' : 'turn' })}
          data-testid="mode-chip"
        >
          {view.mode === 'turn' ? 'Turns' : 'Real-time'}
        </button>
        {view.canUndo && <UndoButton ms={view.undoMsLeft} version={view.version} />}
        <button aria-label="Table settings" onClick={() => setSheet({ kind: 'settings' })}>
          ⚙
        </button>
      </header>
      {view.mode === 'turn' && (
        <div className={`turn-bar ${myTurn ? 'mine' : ''}`} role="status" data-testid="turn-bar">
          {myTurn ? 'Your turn' : `${active?.name ?? 'Nobody'}'s turn`}
          {myTurn && (
            <button className="small primary" onClick={() => send({ type: 'endTurn' })}>
              End turn
            </button>
          )}
          {view.me.isHost && !myTurn && (
            <button className="small" onClick={() => send({ type: 'skip' })}>
              Skip
            </button>
          )}
          {view.me.isHost && (
            <button className="small" aria-label="Reverse direction" onClick={() => send({ type: 'reverse' })}>
              {view.turn.direction === 1 ? '↻' : '↺'}
            </button>
          )}
        </div>
      )}
      <Prompts view={view} />
      <SeatBar view={view} />
      {arranging && <ArrangeBar />}
      <div className="board" ref={boardRef}>
        {arranging && boardSize ? (
          <ArrangeBoard view={view} boardRef={boardRef} boardW={boardSize.w} />
        ) : (
          rows.map((row) => (
          <div className="zone-row" key={row[0].id}>
            {row.map((it) => (
              <ZoneBox key={it.id} view={view} zone={zoneById.get(it.id)!} onInfo={onInfo} flow={it} />
            ))}
          </div>
          ))
        )}
        {!shared.length && <div className="empty" style={{ color: '#fff' }}>No zones yet. {view.me.isHost ? 'Add zones and load a deck in ⚙.' : 'Waiting for the host.'}</div>}
        {view.decks.length === 0 && view.me.isHost && (
          <button className="primary" style={{ margin: 12 }} onClick={() => setSheet({ kind: 'decks' })}>
            Load a deck
          </button>
        )}
        <CountersPanel view={view} />
        <OthersDrags view={view} />
      </div>
      <SelectionBar view={view} />
      {myHand && (
        <div className="hand-area" aria-label="Your hand">
          <CardRow zone={myHand} decks={view.decks} arc dropId={myHand.id} onInfo={onInfo} />
        </div>
      )}
      {view.me.spectator && <div className="banner">You are watching. Hands stay hidden.</div>}
      <nav className="drawer-tabs" aria-label="Panels">
        {(
          [
            ['room', 'Room', unreadRoom],
            ['lobby', 'Lobby', unreadLobby],
            ['log', 'Log', 0],
            ['info', 'Info', 0],
          ] as [DrawerTab, string, number][]
        ).map(([id, label, badge]) => (
          <button key={id} aria-pressed={drawer === id} onClick={() => useUI.setState({ drawer: drawer === id ? null : id })}>
            {label}
            {badge && drawer !== id ? <span className="badge">{badge}</span> : null}
          </button>
        ))}
        <button aria-label="Zoom out" onClick={() => useUI.setState({ zoom: Math.max(0.6, zoom - 0.15) })}>
          −
        </button>
        <button aria-label="Zoom in" onClick={() => useUI.setState({ zoom: Math.min(1.8, zoom + 0.15) })}>
          +
        </button>
      </nav>
      {drawer && <Drawer view={view} tab={drawer} />}
      <DragGhost view={view} />
      {sheet?.kind === 'cards' && <CardsSheet view={view} onClose={closeSheet} />}
      {sheet?.kind === 'zone' && <ZoneSheet view={view} zoneId={sheet.zone} onClose={closeSheet} />}
      {sheet?.kind === 'draw' && <DrawSheet view={view} zoneId={sheet.zone} onClose={closeSheet} />}
      {sheet?.kind === 'deal' && <DealSheet view={view} zoneId={sheet.zone} onClose={closeSheet} />}
      {sheet?.kind === 'info' && <CardInfoSheet view={view} h={sheet.h} onClose={closeSheet} />}
      {sheet?.kind === 'fanout' && <FanOutSheet view={view} zoneId={sheet.zone} onClose={closeSheet} />}
      {sheet?.kind === 'seat' && <SeatSheet view={view} seatId={sheet.seat} onClose={closeSheet} />}
      {sheet?.kind === 'settings' && <SettingsSheet view={view} onClose={closeSheet} />}
      {sheet?.kind === 'applySetup' && <ApplySetupSheet view={view} onClose={closeSheet} />}
      {sheet?.kind === 'saveSetup' && <SaveSetupSheet view={view} onClose={closeSheet} />}
      {sheet?.kind === 'decks' && <DecksSheet view={view} onClose={closeSheet} />}
    </div>
  );
}

function UndoButton({ ms, version }: { ms: number; version: number }) {
  const [left, setLeft] = useState(ms);
  useEffect(() => {
    const end = Date.now() + ms;
    setLeft(ms);
    const t = setInterval(() => setLeft(Math.max(0, end - Date.now())), 250);
    return () => clearInterval(t);
  }, [ms, version]);
  if (left <= 0) return null;
  return (
    <button aria-label="Undo" onClick={() => useTable.getState().send({ type: 'undo' })}>
      ↶ {Math.ceil(left / 1000)}
    </button>
  );
}

function Drawer({ view, tab }: { view: TableView; tab: DrawerTab }) {
  return (
    <div className="drawer" role="region" aria-label={`${tab} panel`}>
      {tab === 'room' && <Chat channel={`table:${view.id}`} log={view.log.filter((e) => e.kind !== 'action' || e.cardAction)} title="Room chat" />}
      {tab === 'lobby' && <Chat channel="lobby" title="Lobby chat" />}
      {tab === 'log' && (
        <ol className="log-list" aria-label="Table log">
          {view.log
            .slice()
            .reverse()
            .map((e) => (
              <li key={e.id} className={e.kind}>
                <span className="muted small-text">{new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> {e.text}
              </li>
            ))}
        </ol>
      )}
      {tab === 'info' && (
        <div className="content">
          <dl className="kv">
            <dt>Host</dt>
            <dd>{view.seats.find((s) => s.playerId === view.hostId)?.name}</dd>
            <dt>Seats</dt>
            <dd>{view.settings.seatLimit ? `${view.settings.seatLimit} seats` : 'Open seating'}</dd>
            <dt>Mode</dt>
            <dd>{view.mode === 'turn' ? 'Turn-based' : 'Real-time'}</dd>
          </dl>
          <div className="actions">
            <button onClick={() => useUI.getState().setSheet({ kind: 'decks' })}>Decks & card reference</button>
            <button onClick={() => useUI.getState().setSheet({ kind: 'settings' })}>Table settings & invite</button>
            {!view.me.spectator && (
              <button
                onClick={async () => {
                  if (confirm('Leave this table?')) await useTable.getState().leave();
                }}
              >
                Leave table
              </button>
            )}
          </div>
          <NotesPanel view={view} />
        </div>
      )}
    </div>
  );
}

function CountersPanel({ view }: { view: TableView }) {
  const send = useTable.getState().send;
  const [label, setLabel] = useState('');
  const [open, setOpen] = useState(false);
  if (!view.counters.length && !open)
    return view.me.spectator ? null : (
      <button className="small ghost counters-add" onClick={() => setOpen(true)}>
        + Counter
      </button>
    );
  return (
    <div className="counters" aria-label="Counters">
      {view.counters.map((c) => (
        <div key={c.id} className="counter">
          <span className="grow">{c.label}</span>
          {!view.me.spectator && (
            <button className="small" aria-label={`Decrease ${c.label}`} onClick={() => send({ type: 'counterChange', counter: c.id, delta: -1 })}>
              −
            </button>
          )}
          <strong data-testid={`counter-${c.label}`}>{c.value}</strong>
          {!view.me.spectator && (
            <>
              <button className="small" aria-label={`Increase ${c.label}`} onClick={() => send({ type: 'counterChange', counter: c.id, delta: 1 })}>
                +
              </button>
              <button
                className="small ghost"
                aria-label={`Set ${c.label}`}
                onClick={() => {
                  const v = prompt(`Set ${c.label} to`, String(c.value));
                  if (v !== null && Number.isFinite(Number(v))) send({ type: 'counterSet', counter: c.id, value: Math.round(Number(v)) });
                }}
              >
                ✎
              </button>
              <button className="small ghost" aria-label={`Remove ${c.label}`} onClick={() => send({ type: 'counterRemove', counter: c.id })}>
                ✕
              </button>
            </>
          )}
        </div>
      ))}
      {!view.me.spectator && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim()) return;
            send({ type: 'counterAdd', label: label.trim(), value: 0 });
            setLabel('');
          }}
        >
          <input aria-label="New counter" placeholder="New counter (e.g. Alex score)" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
          <button className="small">Add</button>
        </form>
      )}
    </div>
  );
}

function NotesPanel({ view }: { view: TableView }) {
  const [notes, setNotes] = useState(view.notes);
  useEffect(() => setNotes(view.notes), [view.notes]);
  return (
    <>
      <label htmlFor="notes">Shared notes</label>
      <textarea id="notes" value={notes} disabled={view.me.spectator} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== view.notes && useTable.getState().send({ type: 'setNotes', notes })} />
    </>
  );
}

/** The stack following my finger while dragging. */
function DragGhost({ view }: { view: TableView }) {
  const drag = useUI((s) => s.drag);
  if (!drag) return null;
  const cards = drag.handles.map((h) => findCard(view, h)?.card).filter(Boolean);
  return (
    <div className="drag-ghost" style={{ transform: `translate(${drag.x - 30}px, ${drag.y - 50}px)` }} aria-hidden>
      {cards.slice(0, 5).map((c, i) => (
        <CardFace key={c!.h} card={c!} decks={view.decks} style={{ position: 'absolute', transform: `translate(${i * 4}px, ${i * 3}px)` }} />
      ))}
      {drag.handles.length > 1 && <span className="drag-count">{drag.handles.length}</span>}
    </div>
  );
}

/** Live previews of other players' drags, interpolated by CSS transitions. */
function OthersDrags({ view }: { view: TableView }) {
  const drags = useTable((s) => s.drags);
  return (
    <>
      {Object.values(drags).map((d) => {
        const c = d.handles.map((h) => findCard(view, h)?.card).find(Boolean);
        const name = view.seats.find((s) => s.playerId === d.playerId)?.name ?? '';
        return (
          <div key={d.playerId} className="other-drag" style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%`, ['--seat-color' as any]: d.color }} data-testid="other-drag">
            {c ? <CardFace card={c} decks={view.decks} /> : <div className="card back"><div className="gen-back" /></div>}
            <span className="actor-tag" style={{ color: inkOn(d.color) }}>{name}</span>
          </div>
        );
      })}
    </>
  );
}
