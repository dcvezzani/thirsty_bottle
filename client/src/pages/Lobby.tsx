import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { TableSummary } from '@vct/shared';
import { getSocket, useApp } from '../store/app';
import { useTable } from '../store/table';
import { Chat } from '../components/Chat';
import { Sheet, Tabs } from '../components/ui';
import { api } from '../lib/api';
import { getTabToken } from '../lib/identity';

type Tab = 'tables' | 'players' | 'chat';

export function Lobby({ onSwitchPlayer }: { onSwitchPlayer: () => void }) {
  const [tab, setTab] = useState<Tab>('tables');
  const tables = useApp((s) => s.tables);
  const players = useApp((s) => s.players);
  const me = useApp((s) => s.me);
  const myTableId = useApp((s) => s.myTableId);
  const unread = useApp((s) => s.unread.lobby ?? 0);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState<TableSummary | null>(null);
  const [menu, setMenu] = useState(false);
  const nav = useNavigate();

  return (
    <div className="page">
      <header className="topbar">
        <h1>Card Table</h1>
        <Link to="/decks">
          <button>Decks</button>
        </Link>
        <button aria-label="Player menu" onClick={() => setMenu(true)}>
          <span className="dot" style={{ background: me?.color }} /> {me?.name}
        </button>
      </header>
      {myTableId && (
        <div className="banner">
          You're still at a table. <button className="small" onClick={() => nav(`/t/${myTableId}`)}>Return to table</button>
        </div>
      )}
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'tables', label: 'Tables' },
          { id: 'players', label: `Players (${players.length})` },
          { id: 'chat', label: 'Chat', badge: tab === 'chat' ? 0 : unread },
        ]}
      />
      {tab === 'tables' && (
        <div className="content">
          <button className="primary" style={{ width: '100%' }} onClick={() => setCreating(true)}>
            + New table
          </button>
          <ul className="list" aria-label="Tables" style={{ marginTop: 8 }}>
            {tables.length === 0 && <li className="empty">No open tables yet. Start one!</li>}
            {tables.map((t) => (
              <li key={t.id} data-testid="table-row">
                <div className="row">
                  <div className="grow">
                    <strong>{t.name}</strong>
                    <div className="small-text muted">
                      Host {t.hostName} · {t.seatLimit ? `${t.seated}/${t.seatLimit} seats` : `${t.seated} player${t.seated === 1 ? '' : 's'}, open seating`}
                      {t.decks.length ? ` · ${t.decks.join(', ')}` : ''}
                    </div>
                    <div className="row wrap" style={{ marginTop: 4, gap: 4 }}>
                      <span className="pill">{t.mode === 'turn' ? 'Turn-based' : 'Real-time'}</span>
                      {t.locked && <span className="pill warn">Locked</span>}
                      {t.hasPassword && <span className="pill">🔒 Password</span>}
                      {t.visibility === 'private' && <span className="pill">Private</span>}
                      {t.spectators > 0 && <span className="pill">{t.spectators} watching</span>}
                    </div>
                  </div>
                  <button onClick={() => (myTableId === t.id ? nav(`/t/${t.id}`) : setJoining(t))}>{myTableId === t.id ? 'Open' : 'Join'}</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {tab === 'players' && (
        <div className="content">
          <ul className="list" aria-label="Online players">
            {players.map((p) => (
              <li key={p.id} className="row">
                <span className="dot" style={{ background: p.color }} />
                <span className="grow">
                  {p.name}
                  {p.suffix && <span className="muted"> {p.suffix}</span>}
                  {p.id === me?.id && <span className="muted"> (you)</span>}
                </span>
                <span className="small-text muted">{p.status === 'table' ? `at ${p.tableName ?? 'a table'}` : 'in the lobby'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {tab === 'chat' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 110px)' }}>
          <Chat channel="lobby" />
        </div>
      )}
      {creating && <CreateTable onClose={() => setCreating(false)} />}
      {joining && <JoinTable table={joining} onClose={() => setJoining(null)} />}
      {menu && (
        <Sheet title="You" onClose={() => setMenu(false)}>
          <Profile />
          <div className="actions">
            <button onClick={onSwitchPlayer}>Switch player</button>
            <button onClick={() => window.open(`${location.origin}/?newPlayer`, '_blank')}>New player in new tab</button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(getTabToken() ?? '');
                useApp.getState().toast('Recovery code copied: keep it private');
              }}
            >
              Copy recovery code
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function Profile() {
  const me = useApp((s) => s.me);
  const [name, setName] = useState(me?.name ?? '');
  return (
    <form
      className="row"
      onSubmit={async (e) => {
        e.preventDefault();
        await getSocket()?.request({ t: 'profile', name, color: me!.color });
        useApp.getState().toast('Name updated');
      }}
    >
      <input aria-label="Display name" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
      <button>Save</button>
    </form>
  );
}

export function CreateTable({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [seats, setSeats] = useState('');
  const [password, setPassword] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [spectators, setSpectators] = useState(true);
  const [layout, setLayout] = useState<'standard' | 'blank'>('standard');
  const [deckId, setDeckId] = useState('');
  const [decks, setDecks] = useState<{ id: string; name: string; group: string }[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    api('GET', '/api/decks')
      .then((r) => setDecks([...r.builtIn.map((d: any) => ({ id: d.id, name: d.name, group: 'Built-in' })), ...r.decks.map((d: any) => ({ id: d.id, name: d.name, group: 'My decks' }))]))
      .catch(() => {});
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      const r = await getSocket()!.request({
        t: 'table.create',
        name: name.trim() || 'Card table',
        seatLimit: seats ? Number(seats) : null,
        visibility,
        password: password || undefined,
        spectatorsAllowed: spectators,
        layout,
        deckId: deckId || undefined,
      });
      await useTable.getState().join(r.tableId);
      nav(`/t/${r.tableId}`);
    } catch (e: any) {
      setErr(e.message);
    }
  };
  return (
    <Sheet title="New table" onClose={onClose}>
      <form onSubmit={submit}>
        <label htmlFor="tname">Table name</label>
        <input id="tname" required value={name} maxLength={60} autoFocus onChange={(e) => setName(e.target.value)} />
        <label htmlFor="tseats">Seats (optional)</label>
        <select id="tseats" value={seats} onChange={(e) => setSeats(e.target.value)}>
          <option value="">Open seating: players can join any time</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1} seat{i ? 's' : ''}
            </option>
          ))}
        </select>
        <label htmlFor="tpw">Password (optional)</label>
        <input id="tpw" type="password" value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
        <label htmlFor="tdeck">Deck (optional)</label>
        <select id="tdeck" value={deckId} onChange={(e) => setDeckId(e.target.value)}>
          <option value="">No deck yet</option>
          {decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.group}: {d.name}
            </option>
          ))}
        </select>
        <details>
          <summary className="muted small-text" style={{ marginTop: 10 }}>More options</summary>
          <label htmlFor="tvis">Visibility</label>
          <select id="tvis" value={visibility} onChange={(e) => setVisibility(e.target.value as any)}>
            <option value="public">Public: listed in the lobby</option>
            <option value="private">Private: invite link only</option>
          </select>
          <label htmlFor="tlayout">Starting layout</label>
          <select id="tlayout" value={layout} onChange={(e) => setLayout(e.target.value as any)}>
            <option value="standard">Standard: Discard pile + Table area</option>
            <option value="blank">Blank</option>
          </select>
          <label className="row">
            <input type="checkbox" style={{ width: 20 }} checked={spectators} onChange={(e) => setSpectators(e.target.checked)} /> Allow spectators
          </label>
        </details>
        {err && <p className="err">{err}</p>}
        <button className="primary" style={{ width: '100%', marginTop: 12 }}>
          Create and sit down
        </button>
      </form>
    </Sheet>
  );
}

export function JoinTable({ table, onClose, direct }: { table: TableSummary; onClose: () => void; direct?: boolean }) {
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [full, setFull] = useState(false);
  const join = async (spectate = false) => {
    setErr('');
    try {
      await useTable.getState().join(table.id, { password: password || undefined, spectate });
      onClose();
      if (!direct) nav(`/t/${table.id}`);
    } catch (e: any) {
      if (e.code === 'TABLE_FULL') setFull(true);
      setErr(e.message);
    }
  };
  return (
    <Sheet title={`Join ${table.name}`} onClose={onClose}>
      <p className="muted small-text">
        Host {table.hostName} · {table.seatLimit ? `${table.seated}/${table.seatLimit} seats` : `${table.seated} players, open seating`}
      </p>
      {table.hasPassword && (
        <>
          <label htmlFor="jpw">Password</label>
          <input id="jpw" type="password" value={password} autoFocus onChange={(e) => setPassword(e.target.value)} />
        </>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      <div className="actions">
        {!full && !table.locked && (
          <button className="primary" onClick={() => join(false)}>
            Take a seat
          </button>
        )}
        {table.spectatorsAllowed && <button onClick={() => join(true)}>Watch</button>}
      </div>
    </Sheet>
  );
}
