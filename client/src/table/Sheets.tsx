import { useEffect, useMemo, useState } from 'react';
import type { CardView, TableView, ZoneView } from '@vct/shared';
import { Sheet } from '../components/ui';
import { CardFace, findDef } from '../components/Card';
import { useTable } from '../store/table';
import { getSocket, useApp } from '../store/app';
import { predictFlip } from '../store/predict';
import { api, imageUrl } from '../lib/api';
import { MetaList } from '../pages/DeckEditor';
import { findCard, orderedSelection, useUI, zoneLabel } from './ui';
import { moveCards } from './drag';
import { CardRow } from './CardRow';

const send = (a: any, predict?: any) => useTable.getState().send(a, predict);

/** Destinations for "Move to…", recent ones first. */
function destinations(view: TableView, exclude: string | null) {
  const recent = useUI.getState().recent;
  const all = view.zones
    .filter((z) => z.id !== exclude && (z.kind === 'shared' || z.seatId === view.me.seatId || view.seats.find((s) => s.id === z.seatId)?.playerId))
    .map((z) => ({ id: z.id, label: z.kind === 'hand' && z.seatId !== view.me.seatId ? `Pass to ${zoneLabel(view, z).replace("'s hand", '')}` : zoneLabel(view, z) }));
  const rec = recent.map((r) => all.find((a) => a.id === r)).filter((x): x is { id: string; label: string } => !!x);
  return { recent: rec, rest: all.filter((a) => !recent.includes(a.id)) };
}

// ---------------------------------------------------------------------------------------------- selection

export function SelectionBar({ view }: { view: TableView }) {
  const selZone = useUI((s) => s.selZone);
  const selected = useUI((s) => s.selected);
  const faceDown = useUI((s) => s.faceDown);
  const recent = useUI((s) => s.recent);
  const handles = orderedSelection(view, selZone, selected);
  if (!handles.length || view.me.spectator) return null;
  const last = recent.find((r) => r !== selZone && view.zones.some((z) => z.id === r));
  const lastZone = view.zones.find((z) => z.id === last);
  const zone = view.zones.find((z) => z.id === selZone)!;
  return (
    <div className="selection-bar" role="toolbar" aria-label="Selected cards">
      <strong data-testid="selection-count">{handles.length} selected</strong>
      <button className="small" onClick={() => useUI.getState().select(selZone!, zone.cards.map((c) => c.h))}>
        Select all
      </button>
      <button className="small" onClick={() => useUI.getState().clear()}>
        Clear
      </button>
      {lastZone && (
        <button className="small primary" onClick={() => moveCards(handles, selZone!, lastZone.id)} title={`Send to ${zoneLabel(view, lastZone)}`}>
          Send again → {zoneLabel(view, lastZone)}
        </button>
      )}
      <label className="row small-text" style={{ margin: 0 }}>
        <input type="checkbox" style={{ width: 18, minHeight: 18 }} checked={faceDown} onChange={(e) => useUI.setState({ faceDown: e.target.checked })} />
        Face down
      </label>
      <button className="small" onClick={() => useUI.getState().setSheet({ kind: 'cards' })}>
        Actions…
      </button>
    </div>
  );
}

export function CardsSheet({ view, onClose }: { view: TableView; onClose: () => void }) {
  const selZone = useUI((s) => s.selZone);
  const selected = useUI((s) => s.selected);
  const handles = orderedSelection(view, selZone, selected);
  const zone = view.zones.find((z) => z.id === selZone);
  const [mode, setMode] = useState<'main' | 'move' | 'show'>('main');
  if (!zone || !handles.length) return null;
  const cards = zone.cards.filter((c) => handles.includes(c.h));
  const allKnown = cards.every((c) => c.known);
  const inOthersHand = zone.kind === 'hand' && zone.seatId !== view.me.seatId;
  const shownByMe = cards.some((c) => c.shownTo?.length);
  const players = view.seats.filter((s) => s.playerId && s.playerId !== view.me.playerId);
  const { recent, rest } = destinations(view, zone.id);
  const done = () => {
    // any action taken on the selection ends it, so the next tap starts a fresh selection
    useUI.getState().clear();
    onClose();
  };
  const title = `${handles.length} card${handles.length === 1 ? '' : 's'} · ${zoneLabel(view, zone)}`;

  if (mode === 'move')
    return (
      <Sheet title="Move to…" onClose={onClose}>
        {recent.length > 0 && <h4 style={{ margin: '4px 0' }}>Recent</h4>}
        <div className="actions">
          {recent.map((d) => (
            <button key={d.id} className="primary" onClick={() => (moveCards(handles, zone.id, d.id), done())}>
              {d.label}
            </button>
          ))}
        </div>
        <div className="actions">
          {rest.map((d) => (
            <button key={d.id} onClick={() => (moveCards(handles, zone.id, d.id), done())}>
              {d.label}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="small" onClick={() => setMode('main')}>
            Back
          </button>
          <span className="small-text muted">Face: {useUI.getState().faceDown ? 'down' : 'as is / up from hand'}</span>
        </div>
      </Sheet>
    );

  if (mode === 'show')
    return (
      <Sheet title="Show to…" onClose={onClose}>
        <div className="actions">
          <button className="primary" onClick={() => (send({ type: 'show', cards: handles, to: 'all' }), done())}>
            Everyone
          </button>
          {players.map((p) => (
            <button key={p.id} onClick={() => (send({ type: 'show', cards: handles, to: [p.playerId!] }), done())}>
              {p.name}
            </button>
          ))}
        </div>
      </Sheet>
    );

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="row" style={{ gap: 4, overflowX: 'auto' }}>
        {cards.slice(0, 8).map((c) => (
          <CardFace key={c.h} card={c} decks={view.decks} style={{ ['--card-w' as any]: '44px' }} />
        ))}
      </div>
      <div className="actions">
        {inOthersHand ? (
          <button className="primary" onClick={() => (moveCards(handles, zone.id, `hand:${view.me.seatId}`), done())}>
            Ask to take
          </button>
        ) : (
          <>
            <button onClick={() => setMode('move')}>Move to…</button>
            <button onClick={() => (send({ type: 'flip', cards: handles }, (v: TableView) => predictFlip(v, handles)), useUI.getState().clear(), done())}>Flip</button>
            {players.length > 0 && zone.kind === 'hand' && (
              <>
                {players.map((p) => (
                  <button key={p.id} onClick={() => (moveCards(handles, zone.id, `hand:${p.id}`), done())}>
                    Pass to {p.name}
                  </button>
                ))}
              </>
            )}
            {allKnown && <button onClick={() => setMode('show')}>Show to…</button>}
            {shownByMe && <button onClick={() => (send({ type: 'unshow', cards: handles }), done())}>Stop showing</button>}
            {!allKnown && <button onClick={() => (send({ type: 'peek', cards: handles }), done())}>Peek</button>}
            {cards.some((c) => c.peeked) && <button onClick={() => (send({ type: 'unpeek', cards: handles }), done())}>Stop peeking</button>}
            {zone.kind === 'hand' && zone.seatId === view.me.seatId && view.zones.find((z) => z.name === 'Table') && (
              <button className="primary" onClick={() => (moveCards(handles, zone.id, view.zones.find((z) => z.name === 'Table')!.id), done())}>
                Play to Table
              </button>
            )}
          </>
        )}
        {handles.length === 1 && <button onClick={() => useUI.getState().setSheet({ kind: 'info', h: handles[0] })}>Card info</button>}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------- zones

export function ZoneSheet({ view, zoneId, onClose }: { view: TableView; zoneId: string; onClose: () => void }) {
  const zone = view.zones.find((z) => z.id === zoneId);
  const [peekN, setPeekN] = useState(1);
  const [cutDepth, setCutDepth] = useState('');
  const [rename, setRename] = useState('');
  if (!zone) return null;
  const host = view.me.isHost;
  const spectator = view.me.spectator;
  const n = zone.cards.length;
  const others = view.zones.filter((z) => z.kind === 'shared' && z.id !== zone.id);
  const act = (a: any) => {
    send(a);
    onClose();
  };
  return (
    <Sheet title={`${zone.name} · ${n} card${n === 1 ? '' : 's'}`} onClose={onClose}>
      {!spectator && (
        <div className="actions">
          {n > 0 && (
            <button className="primary" onClick={() => act({ type: 'draw', zone: zone.id, count: 1, from: 'top' })}>
              Draw 1
            </button>
          )}
          {n > 0 && <button onClick={() => useUI.getState().setSheet({ kind: 'draw', zone: zone.id })}>Draw…</button>}
          {n > 1 && <button onClick={() => act({ type: 'shuffle', zone: zone.id })}>Shuffle</button>}
          {n > 1 && <button onClick={() => act({ type: 'cut', zone: zone.id, mode: 'complete' })}>Cut (random)</button>}
          {n > 0 && <button onClick={() => useUI.getState().setSheet({ kind: 'deal', zone: zone.id })}>Deal…</button>}
          <button onClick={() => act({ type: 'gather', zones: 'all', to: zone.id })}>Gather all here</button>
          {n > 0 && <button onClick={() => act({ type: 'flipZone', zone: zone.id })}>Flip all</button>}
          {n > 0 && <button onClick={() => useUI.getState().setSheet({ kind: 'fanout', zone: zone.id })}>Fan out</button>}
          {n > 0 && zone.layout !== 'pile' && <button onClick={() => (useUI.getState().select(zone.id, zone.cards.map((c) => c.h)), onClose())}>Select all</button>}
        </div>
      )}
      {!spectator && n > 1 && (
        <>
          <div className="row" style={{ marginTop: 10 }}>
            <label className="grow" style={{ margin: 0 }}>
              Peek at top
            </label>
            <input aria-label="Peek count" type="number" min={1} max={n} value={peekN} style={{ width: 80 }} onChange={(e) => setPeekN(Number(e.target.value))} />
            <button onClick={() => act({ type: 'peek', zone: zone.id, count: Math.max(1, Math.min(n, peekN)) })}>Peek</button>
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <label className="grow" style={{ margin: 0 }}>
              Cut at depth
            </label>
            <input aria-label="Cut depth" type="number" min={1} max={n - 1} value={cutDepth} placeholder={`1–${n - 1}`} style={{ width: 80 }} onChange={(e) => setCutDepth(e.target.value)} />
            <button disabled={!cutDepth} onClick={() => act({ type: 'cut', zone: zone.id, depth: Number(cutDepth), mode: 'complete' })}>
              Cut
            </button>
            <button disabled={!cutDepth} onClick={() => act({ type: 'cut', zone: zone.id, depth: Number(cutDepth), mode: 'split' })}>
              Split
            </button>
          </div>
        </>
      )}
      {host && zone.kind === 'shared' && (
        <>
          <h4 style={{ margin: '14px 0 4px' }}>Host</h4>
          <div className="row">
            <input aria-label="Rename zone" placeholder={zone.name} value={rename} onChange={(e) => setRename(e.target.value)} />
            <button disabled={!rename.trim()} onClick={() => act({ type: 'zoneUpdate', zone: zone.id, name: rename.trim() })}>
              Rename
            </button>
          </div>
          <div className="row wrap" style={{ marginTop: 6 }}>
            <select aria-label="Layout" value={zone.layout} style={{ width: 'auto' }} onChange={(e) => act({ type: 'zoneUpdate', zone: zone.id, layout: e.target.value })}>
              <option value="pile">Pile</option>
              <option value="spread">Spread</option>
              <option value="free">Free</option>
            </select>
            <input aria-label="Zone color" type="color" value={zone.color} style={{ width: 60, padding: 2 }} onChange={(e) => send({ type: 'zoneUpdate', zone: zone.id, color: e.target.value })} />
            <button className="small" onClick={() => send({ type: 'zoneUpdate', zone: zone.id, y: Math.max(0, zone.y - 0.1) })}>
              ↑
            </button>
            <button className="small" onClick={() => send({ type: 'zoneUpdate', zone: zone.id, y: Math.min(1, zone.y + 0.1) })}>
              ↓
            </button>
            <button className="small" onClick={() => send({ type: 'zoneUpdate', zone: zone.id, x: Math.max(0, zone.x - 0.1) })}>
              ←
            </button>
            <button className="small" onClick={() => send({ type: 'zoneUpdate', zone: zone.id, x: Math.min(1, zone.x + 0.1) })}>
              →
            </button>
          </div>
          <RemoveZone zone={zone} others={others} onDone={onClose} />
        </>
      )}
    </Sheet>
  );
}

function RemoveZone({ zone, others, onDone }: { zone: ZoneView; others: ZoneView[]; onDone: () => void }) {
  const [to, setTo] = useState(others[0]?.id ?? '');
  const needs = zone.cards.length > 0;
  return (
    <div className="row" style={{ marginTop: 6 }}>
      {needs && (
        <select aria-label="Move its cards to" value={to} onChange={(e) => setTo(e.target.value)}>
          {others.map((z) => (
            <option key={z.id} value={z.id}>
              Move cards to {z.name}
            </option>
          ))}
        </select>
      )}
      <button
        disabled={needs && !to}
        onClick={async () => {
          const r = await send({ type: 'zoneRemove', zone: zone.id, ...(needs || to ? { moveTo: to || undefined } : {}) });
          if (r.ok) onDone();
        }}
      >
        Remove zone
      </button>
    </div>
  );
}

export function DrawSheet({ view, zoneId, onClose }: { view: TableView; zoneId: string; onClose: () => void }) {
  const zone = view.zones.find((z) => z.id === zoneId);
  const [count, setCount] = useState(1);
  const [from, setFrom] = useState<'top' | 'bottom' | 'random'>('top');
  const [to, setTo] = useState(`hand:${view.me.seatId}`);
  if (!zone) return null;
  return (
    <Sheet title={`Draw from ${zone.name}`} onClose={onClose}>
      <label htmlFor="dcount">How many</label>
      <input id="dcount" type="number" min={1} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value)))} />
      <label>From</label>
      <div className="row">
        {(['top', 'bottom', 'random'] as const).map((f) => (
          <button key={f} className={from === f ? 'primary grow' : 'grow'} onClick={() => setFrom(f)} aria-pressed={from === f}>
            {f}
          </button>
        ))}
      </div>
      <label htmlFor="dto">Into</label>
      <select id="dto" value={to} onChange={(e) => setTo(e.target.value)}>
        {view.zones
          .filter((z) => z.id !== zone.id && (z.kind === 'shared' || z.seatId === view.me.seatId))
          .map((z) => (
            <option key={z.id} value={z.id}>
              {zoneLabel(view, z)}
            </option>
          ))}
      </select>
      <button
        className="primary"
        style={{ width: '100%', marginTop: 12 }}
        onClick={() => {
          send({ type: 'draw', zone: zone.id, count, from, to });
          onClose();
        }}
      >
        Draw {count}
      </button>
    </Sheet>
  );
}

export function DealSheet({ view, zoneId, onClose }: { view: TableView; zoneId: string; onClose: () => void }) {
  const zone = view.zones.find((z) => z.id === zoneId);
  const occupied = view.seats.filter((s) => s.playerId);
  const [count, setCount] = useState(Math.max(1, Math.floor((zone?.cards.length ?? 0) / Math.max(1, occupied.length))));
  const [seats, setSeats] = useState<string[]>(occupied.map((s) => s.id));
  const [start, setStart] = useState(occupied[0]?.id ?? '');
  const [face, setFace] = useState<'down' | 'up'>('down');
  if (!zone) return null;
  return (
    <Sheet title={`Deal from ${zone.name}`} onClose={onClose}>
      <label htmlFor="dealn">Cards to each seat</label>
      <input id="dealn" type="number" min={1} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value)))} />
      <label>Seats</label>
      {view.seats.map((s) => (
        <label key={s.id} className="row" style={{ margin: '4px 0', color: 'var(--ink)' }}>
          <input type="checkbox" style={{ width: 20 }} checked={seats.includes(s.id)} onChange={(e) => setSeats(e.target.checked ? [...seats, s.id] : seats.filter((x) => x !== s.id))} />
          {s.playerId ? s.name : `Empty seat ${s.index + 1}`}
        </label>
      ))}
      <label htmlFor="dstart">Start with</label>
      <select id="dstart" value={start} onChange={(e) => setStart(e.target.value)}>
        {view.seats
          .filter((s) => seats.includes(s.id))
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name || `Seat ${s.index + 1}`}
            </option>
          ))}
      </select>
      <label>Face</label>
      <div className="row">
        <button className={face === 'down' ? 'primary grow' : 'grow'} onClick={() => setFace('down')}>
          Face down
        </button>
        <button className={face === 'up' ? 'primary grow' : 'grow'} onClick={() => setFace('up')}>
          Face up
        </button>
      </div>
      <button
        className="primary"
        style={{ width: '100%', marginTop: 12 }}
        disabled={!seats.length}
        onClick={() => {
          send({ type: 'deal', zone: zone.id, count, seats, startSeat: seats.includes(start) ? start : undefined, face });
          onClose();
        }}
      >
        Deal {count} to {seats.length} seat{seats.length === 1 ? '' : 's'}
      </button>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------- card info

export function CardInfoSheet({ view, h, onClose }: { view: TableView; h: string; onClose: () => void }) {
  const found = findCard(view, h);
  if (!found) return null;
  const { card, zone, index } = found;
  const def = findDef(view.decks, card);
  const deck = view.decks.find((d) => d.id === card.deck);
  const ambiguous = def && view.decks.some((d) => d.id !== deck?.id && d.defs.some((x) => x.name === def.name));
  const shownBy = card.shownBy ? view.seats.find((s) => s.playerId === card.shownBy)?.name : null;
  if (!card.known || !def) {
    const where = zone.kind === 'hand' ? (zone.seatId === view.me.seatId ? 'In your hand' : `In ${zoneLabel(view, zone).replace("'s hand", '')}'s hand`) : `${zone.name}, card ${index + 1} of ${zone.cards.length}`;
    return (
      <Sheet title="Face-down card" onClose={onClose}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <CardFace card={card} decks={view.decks} style={{ ['--card-w' as any]: '140px' }} large />
          <p data-testid="hidden-info">{where}</p>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet title={def.name} onClose={onClose}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="card face" style={{ ['--card-w' as any]: '170px' }}>
          {def.frontImageId ? <img className="card-img" src={imageUrl(def.frontImageId)} alt={def.name} /> : <CardFace card={{ ...card, faceUp: true }} decks={view.decks} style={{ ['--card-w' as any]: '170px' }} />}
        </div>
        <div className="grow" data-testid="card-info">
          <p style={{ marginTop: 0 }}>
            <strong data-testid="copy-of">
              Copy {card.copyNo} of {card.copyOf}
            </strong>
            {ambiguous && <span className="muted"> · from {deck?.name}</span>}
          </p>
          {def.description && <p>{def.description}</p>}
          <MetaList def={def} />
          <p className="small-text muted">
            {zoneLabel(view, zone)}
            {!card.faceUp && ' · face down'}
            {shownBy && ` · shown by ${shownBy}`}
            {card.peeked && ' · you are peeking'}
          </p>
        </div>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------- fan out

export function FanOutSheet({ view, zoneId, onClose }: { view: TableView; zoneId: string; onClose: () => void }) {
  const zone = view.zones.find((z) => z.id === zoneId);
  if (!zone) return null;
  return (
    <Sheet title={`${zone.name} (fanned out)`} onClose={onClose}>
      <p className="small-text muted">Slide along the cards to preview them. Tap to select. Order and faces are unchanged for everyone.</p>
      <div style={{ ['--card-w' as any]: '72px', padding: '40px 0 8px' }}>
        <CardRow zone={{ ...zone, layout: 'spread' }} decks={view.decks} interactive={!view.me.spectator} draggable={false} onInfo={(h) => useUI.getState().setSheet({ kind: 'info', h })} />
      </div>
      <SelectionBar view={view} />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------- seats & host

export function SeatSheet({ view, seatId, onClose }: { view: TableView; seatId: string; onClose: () => void }) {
  const seat = view.seats.find((s) => s.id === seatId);
  const selZone = useUI((s) => s.selZone);
  const selected = useUI((s) => s.selected);
  if (!seat) return null;
  const host = view.me.isHost;
  const handles = orderedSelection(view, selZone, selected);
  const tid = view.id;
  const act = (a: any) => {
    send(a);
    onClose();
  };
  return (
    <Sheet title={seat.playerId ? seat.name : `Empty seat ${seat.index + 1}`} onClose={onClose}>
      <p className="small-text muted">
        {seat.handCount} cards in hand{seat.disconnected ? ' · disconnected' : ''}
        {view.hostId === seat.playerId ? ' · host' : ''}
      </p>
      <div className="actions">
        {handles.length > 0 && seat.id !== view.me.seatId && selZone && (
          <button className="primary" onClick={() => (moveCards(handles, selZone, `hand:${seat.id}`), onClose())}>
            Pass {handles.length} selected card{handles.length === 1 ? '' : 's'}
          </button>
        )}
        {seat.playerId && seat.handCount > 0 && !view.me.spectator && (
          <button onClick={() => act({ type: 'draw', zone: `hand:${seat.id}`, count: 1, from: 'random' })}>Take a random card</button>
        )}
        {host && seat.playerId && seat.playerId !== view.me.playerId && (
          <>
            <button disabled={!seat.connected} onClick={() => act({ type: 'setHost', playerId: seat.playerId })}>
              Make host
            </button>
            <button
              onClick={async () => {
                if (!confirm(`Remove ${seat.name} from the table?`)) return;
                await getSocket()?.request({ t: 'table.kick', tableId: tid, playerId: seat.playerId! });
                onClose();
              }}
            >
              Kick
            </button>
            <button onClick={() => getSocket()?.request({ t: 'chat.roomMute', tableId: tid, playerId: seat.playerId!, muted: true }).then(() => useApp.getState().toast(`${seat.name} muted in room chat`))}>
              Mute in room
            </button>
          </>
        )}
        {host && view.mode === 'turn' && seat.playerId && <button onClick={() => act({ type: 'setActive', seat: seat.id })}>Give the turn</button>}
        {host && (
          <>
            <button disabled={seat.index === 0} onClick={() => act({ type: 'moveSeat', seat: seat.id, toIndex: seat.index - 1 })}>
              Move seat left
            </button>
            <button disabled={seat.index === view.seats.length - 1} onClick={() => act({ type: 'moveSeat', seat: seat.id, toIndex: seat.index + 1 })}>
              Move seat right
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

export function DecksSheet({ view, onClose }: { view: TableView; onClose: () => void }) {
  const toast = useApp((s) => s.toast);
  const [mine, setMine] = useState<any[]>([]);
  const [deckId, setDeckId] = useState('');
  const [open, setOpen] = useState<string | null>(view.decks[0]?.id ?? null);
  useEffect(() => {
    if (!view.me.isHost) return;
    Promise.all([api('GET', '/api/decks'), api('GET', '/api/gallery?limit=50')]).then(([m, g]) => setMine([...m.builtIn, ...m.decks, ...g.decks].filter((d, i, a) => a.findIndex((x) => x.id === d.id) === i)));
  }, [view.me.isHost]);
  const deck = view.decks.find((d) => d.id === open);
  return (
    <Sheet title="Decks at this table" onClose={onClose}>
      <div className="row wrap">
        {view.decks.map((d) => (
          <button key={d.id} className={open === d.id ? 'primary small' : 'small'} onClick={() => setOpen(d.id)}>
            {d.name}
          </button>
        ))}
        {!view.decks.length && <span className="muted">No deck loaded yet.</span>}
      </div>
      {deck && (
        <>
          <div className="row wrap" style={{ marginTop: 8 }}>
            <button
              className="small"
              onClick={async () => {
                const d = await api('POST', `/api/tables/${view.id}/decks/${deck.id}/clone`);
                toast(`"${d.name}" cloned to your library`);
              }}
            >
              Clone to my library
            </button>
            {view.me.isHost && deck.newerVersion && (
              <button className="small primary" onClick={() => getSocket()?.request({ t: 'table.reloadDeck', tableId: view.id, tableDeckId: deck.id })}>
                Newer version: reload
              </button>
            )}
            {view.me.isHost && (
              <button className="small" onClick={() => confirm(`Remove ${deck.name} and all its cards from the table?`) && send({ type: 'unloadDeck', deck: deck.id })}>
                Unload
              </button>
            )}
          </div>
          <DeckReference view={view} deckId={deck.id} />
        </>
      )}
      {view.me.isHost && (
        <>
          <h4 style={{ margin: '14px 0 4px' }}>Load a deck</h4>
          <div className="row">
            <select aria-label="Deck to load" value={deckId} onChange={(e) => setDeckId(e.target.value)}>
              <option value="">Choose…</option>
              {mine.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.ownerName ? ` (${d.ownerName})` : ''}
                </option>
              ))}
            </select>
            <button disabled={!deckId} onClick={() => getSocket()?.request({ t: 'table.loadDeck', tableId: view.id, deckId }).then(() => toast('Deck loaded'), (e) => toast(e.message, 'error'))}>
              Load
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

function DeckReference({ view, deckId }: { view: TableView; deckId: string }) {
  const deck = view.decks.find((d) => d.id === deckId)!;
  const [open, setOpen] = useState<string | null>(null);
  const def = deck.defs.find((d) => d.id === open);
  return (
    <>
      <div className="grid-cards" style={{ marginTop: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))' }}>
        {deck.defs.map((d) => (
          <button key={d.id} className="card-tile" style={{ height: 'auto', padding: 6 }} onClick={() => setOpen(d.id === open ? null : d.id)}>
            <CardFace card={{ h: d.id, faceUp: true, known: true, deck: deck.id, def: d.id }} decks={view.decks} style={{ ['--card-w' as any]: '100%' }} />
            <div className="small-text">
              {d.name} ×{d.count}
            </div>
          </button>
        ))}
      </div>
      {def && (
        <div className="card-tile" style={{ marginTop: 8 }}>
          <strong>{def.name}</strong>
          {def.description && <p>{def.description}</p>}
          <MetaList def={def} />
        </div>
      )}
    </>
  );
}

export function SettingsSheet({ view, onClose }: { view: TableView; onClose: () => void }) {
  const st = view.settings;
  const [name, setName] = useState(st.name);
  const [pw, setPw] = useState('');
  const [zoneName, setZoneName] = useState('');
  const [zoneLayout, setZoneLayout] = useState<'pile' | 'spread' | 'free'>('spread');
  const toast = useApp((s) => s.toast);
  const invite = `${location.origin}/t/${view.id}`;
  const host = view.me.isHost;
  const seated = view.seats.filter((s) => s.playerId).length;
  return (
    <Sheet title="Table" onClose={onClose}>
      <label>Invite link</label>
      <div className="row">
        <input readOnly aria-label="Invite link" value={invite} />
        <button
          onClick={() => {
            navigator.clipboard?.writeText(invite);
            toast('Invite link copied');
          }}
        >
          Copy
        </button>
      </div>
      {!host && <p className="small-text muted">Only the host can change table settings.</p>}
      {host && (
        <>
          <label htmlFor="sname">Name</label>
          <div className="row">
            <input id="sname" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            <button onClick={() => send({ type: 'settings', name })}>Save</button>
          </div>
          <label htmlFor="sseats">Seats</label>
          <select id="sseats" value={st.seatLimit ?? ''} onChange={(e) => send({ type: 'settings', seatLimit: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Open seating</option>
            {Array.from({ length: 12 }, (_, i) => i + 1)
              .filter((n) => n >= seated)
              .map((n) => (
                <option key={n} value={n}>
                  {n} seats
                </option>
              ))}
          </select>
          <label htmlFor="spw">Password {st.hasPassword ? '(set)' : '(none)'}</label>
          <div className="row">
            <input id="spw" type="password" value={pw} autoComplete="new-password" placeholder={st.hasPassword ? 'New password' : 'Set a password'} onChange={(e) => setPw(e.target.value)} />
            <button disabled={!pw} onClick={() => getSocket()?.request({ t: 'table.password', tableId: view.id, password: pw }).then(() => (setPw(''), toast('Password set')))}>
              Set
            </button>
            {st.hasPassword && <button onClick={() => getSocket()?.request({ t: 'table.password', tableId: view.id, password: null }).then(() => toast('Password removed'))}>Remove</button>}
          </div>
          {(
            [
              ['locked', 'Locked: no new players can sit down'],
              ['spectatorsAllowed', 'Allow spectators'],
              ['openHands', 'Open hands: take cards from hands without asking'],
              ['playersMaySwitchMode', 'Any player may switch real-time / turn-based'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="row" style={{ color: 'var(--ink)' }}>
              <input type="checkbox" style={{ width: 20 }} checked={!!st[k]} onChange={(e) => send({ type: 'settings', [k]: e.target.checked })} />
              {label}
            </label>
          ))}
          <label htmlFor="svis">Visibility</label>
          <select id="svis" value={st.visibility} onChange={(e) => send({ type: 'settings', visibility: e.target.value })}>
            <option value="public">Public</option>
            <option value="private">Private (invite link)</option>
          </select>
          <h4 style={{ margin: '14px 0 4px' }}>Add a zone</h4>
          <div className="row">
            <input aria-label="New zone name" placeholder="e.g. Discard" value={zoneName} maxLength={40} onChange={(e) => setZoneName(e.target.value)} />
            <select aria-label="New zone layout" value={zoneLayout} style={{ width: 'auto' }} onChange={(e) => setZoneLayout(e.target.value as any)}>
              <option value="pile">Pile</option>
              <option value="spread">Spread</option>
              <option value="free">Free</option>
            </select>
            <button disabled={!zoneName.trim()} onClick={() => (send({ type: 'zoneAdd', name: zoneName.trim(), layout: zoneLayout, x: 0.1, y: 0.9 }), setZoneName(''))}>
              Add
            </button>
          </div>
          <div className="actions">
            <button onClick={() => useUI.getState().setSheet({ kind: 'decks' })}>Decks…</button>
            <button onClick={() => confirm('Reset the table? All cards return to their decks face down.') && (send({ type: 'reset' }), onClose())}>Reset table</button>
            <button onClick={() => confirm('Close the table for everyone?') && getSocket()?.request({ t: 'table.close', tableId: view.id })}>Close table</button>
          </div>
        </>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------- prompts

export function Prompts({ view }: { view: TableView }) {
  const incoming = view.requests.filter((r) => r.dir === 'incoming');
  const outgoing = view.requests.filter((r) => r.dir === 'outgoing');
  const [returnTo, setReturnTo] = useState<string>('');
  const shared = useMemo(() => view.zones.filter((z) => z.kind === 'shared'), [view.zones]);
  return (
    <>
      {incoming[0] && (
        <div className="overlay" style={{ alignItems: 'center' }}>
          <div className="sheet" role="alertdialog" aria-label="Card request">
            <h2>
              {incoming[0].fromName} wants {incoming[0].count} card{incoming[0].count === 1 ? '' : 's'} from your hand
            </h2>
            <div className="row">
              <button className="primary grow" onClick={() => send({ type: 'respondTake', requestId: incoming[0].id, approve: true })}>
                Allow
              </button>
              <button className="grow" onClick={() => send({ type: 'respondTake', requestId: incoming[0].id, approve: false })}>
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
      {outgoing.length > 0 && <div className="banner">Waiting for {view.seats.find((s) => s.id === outgoing[0].seatId)?.name ?? 'the player'} to allow your request…</div>}
      {view.vacated.map((v) => (
        <div key={v.seatId} className="banner" role="alert">
          {v.playerName} left with cards in hand.{' '}
          <select aria-label="Return hand to" value={returnTo} style={{ width: 'auto', minHeight: 32 }} onChange={(e) => setReturnTo(e.target.value)}>
            <option value="">Return to…</option>
            {shared.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>{' '}
          <button className="small" disabled={!returnTo} onClick={() => send({ type: 'resolveVacated', seat: v.seatId, returnTo })}>
            Return
          </button>{' '}
          <button className="small" onClick={() => send({ type: 'resolveVacated', seat: v.seatId, returnTo: 'keep' })}>
            Keep for a new player
          </button>
        </div>
      ))}
    </>
  );
}

export type { CardView };
