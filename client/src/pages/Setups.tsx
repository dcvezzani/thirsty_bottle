import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { SetupContent, SetupDetail, SetupSummary, SetupZone } from '@vct/shared';
import { api } from '../lib/api';
import { Tabs } from '../components/ui';
import { useApp } from '../store/app';
import { formatCount, parseCount } from '../lib/setupCount';

/** table-setups: the setup library (D7), following the Decks page. */
type Tab = 'mine' | 'archived';

function SetupTile({ s, onOpen, extra }: { s: SetupSummary; onOpen: () => void; extra?: React.ReactNode }) {
  const players = s.players.min === s.players.max ? `${s.players.min}` : `${s.players.min}-${s.players.max}`;
  return (
    <li className="deck-tile" data-testid="setup-row">
      <div className="grow" onClick={onOpen} style={{ cursor: 'pointer' }}>
        <strong>{s.name}</strong>
        <div className="small-text muted">
          {players} player{s.players.max === 1 ? '' : 's'} · {s.zoneCount} zone{s.zoneCount === 1 ? '' : 's'}
          {s.slots.length ? ` · ${s.slots.map((x) => x.defaultDeckName ?? x.label).join(', ')}` : ''}
        </div>
        <div className="row wrap" style={{ gap: 4, marginTop: 2 }}>
          {s.fixed && <span className="pill">Fixed deal</span>}
          {s.hasDraft && <span className="pill warn">Unsaved draft</span>}
        </div>
      </div>
      {extra}
    </li>
  );
}

export function SetupsPage() {
  const nav = useNavigate();
  const toast = useApp((s) => s.toast);
  const [tab, setTab] = useState<Tab>('mine');
  const [mine, setMine] = useState<SetupSummary[]>([]);
  const [archived, setArchived] = useState<SetupSummary[]>([]);
  const [newName, setNewName] = useState('');
  const load = async () => {
    setMine((await api('GET', '/api/setups')).setups);
    setArchived((await api('GET', '/api/setups?status=archived')).setups);
  };
  useEffect(() => {
    load().catch((e) => toast(e.message, 'error'));
  }, []);
  return (
    <div className="page">
      <header className="topbar">
        <Link to="/">
          <button aria-label="Back to lobby">←</button>
        </Link>
        <h1>Setups</h1>
      </header>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'mine', label: 'My setups' },
          { id: 'archived', label: `Archived${archived.length ? ` (${archived.length})` : ''}` },
        ]}
      />
      <div className="content">
        {tab === 'mine' && (
          <>
            <form
              className="row"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newName.trim()) return;
                const s = await api('POST', '/api/setups', { name: newName.trim() });
                setNewName('');
                nav(`/setups/${s.id}`);
              }}
            >
              <input aria-label="New setup name" placeholder="New setup name" value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} />
              <button className="primary">Create</button>
            </form>
            <p className="small-text muted">Or set up a table by hand and use Save table as setup in its settings.</p>
            <ul className="list" aria-label="My setups">
              {mine.length === 0 && <li className="empty">No setups yet.</li>}
              {mine.map((s) => (
                <SetupTile key={s.id} s={s} onOpen={() => nav(`/setups/${s.id}`)} />
              ))}
            </ul>
          </>
        )}
        {tab === 'archived' && (
          <ul className="list" aria-label="Archived setups">
            {archived.length === 0 && <li className="empty">No archived setups.</li>}
            {archived.map((s) => (
              <SetupTile
                key={s.id}
                s={s}
                onOpen={() => nav(`/setups/${s.id}`)}
                extra={
                  <div className="row">
                    <button
                      onClick={async () => {
                        await api('POST', `/api/setups/${s.id}/restore`);
                        toast(`Restored "${s.name}"`);
                        load();
                      }}
                    >
                      Restore
                    </button>
                    <button
                      aria-label={`Delete ${s.name} permanently`}
                      onClick={async () => {
                        if (!confirm(`Permanently delete "${s.name}"? This cannot be undone.`)) return;
                        await api('DELETE', `/api/setups/${s.id}`, { confirm: true });
                        toast(`Deleted "${s.name}"`);
                        load();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                }
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function SetupPage() {
  const { id } = useParams();
  const toast = useApp((s) => s.toast);
  const [setup, setSetup] = useState<SetupDetail | null>(null);
  // every reload (save, discard, restore) remounts the editor from the server's copy
  const [loads, setLoads] = useState(0);
  const reload = () =>
    api('GET', `/api/setups/${id}`)
      .then((d) => {
        setSetup(d);
        setLoads((n) => n + 1);
      })
      .catch((e) => toast(e.message, 'error'));
  useEffect(() => {
    reload();
  }, [id]);
  if (!setup) return <div className="page"><div className="content">Loading…</div></div>;
  return <SetupEditor key={`${setup.id}:${loads}`} setup={setup} reload={reload} />;
}

/** A count field that accepts "7", "rest" or "2:10, 3-4:7". */
function CountText({ value, onChange, label, caption, wide }: { value: SetupZone['down']; onChange: (c: SetupZone['down']) => void; label: string; caption: string; wide?: boolean }) {
  const [text, setText] = useState(formatCount(value));
  const bad = parseCount(text) === null;
  return (
    <label className={`count-l ${wide ? 'wide' : ''}`}>
      <span>{caption}</span>
      <input
        className={`count-text ${bad ? 'bad' : ''}`}
        aria-label={label}
        aria-invalid={bad}
        value={text}
        placeholder="0"
        onChange={(e) => {
          setText(e.target.value);
          const c = parseCount(e.target.value);
          if (c !== null) onChange(c);
        }}
      />
    </label>
  );
}

function SetupEditor({ setup, reload }: { setup: SetupDetail; reload: () => void }) {
  const nav = useNavigate();
  const toast = useApp((s) => s.toast);
  const [content, setContent] = useState<SetupContent>(setup.draft ?? setup.content);
  const [dirty, setDirty] = useState(!!setup.draft);
  const [decks, setDecks] = useState<{ id: string; name: string }[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const archived = setup.status === 'archived';
  useEffect(() => {
    api('GET', '/api/decks')
      .then((r) => setDecks([...r.builtIn, ...r.decks].map((d: any) => ({ id: d.id, name: d.name }))))
      .catch(() => {});
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const update = (f: (c: SetupContent) => void) =>
    setContent((prev) => {
      const next = structuredClone(prev);
      f(next);
      setDirty(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => api('PUT', `/api/setups/${setup.id}/draft`, { content: next }).catch((e) => toast(e.message, 'error')), 300);
      return next;
    });
  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const save = async () => {
    flush();
    try {
      await api('POST', `/api/setups/${setup.id}/save`, { content });
      toast('Setup saved');
      setDirty(false);
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  const discard = async () => {
    flush();
    await api('DELETE', `/api/setups/${setup.id}/draft`);
    toast('Changes discarded');
    reload();
  };
  const nextKey = (prefix: string, taken: string[]) => {
    let i = taken.length + 1;
    while (taken.includes(`${prefix}${i}`)) i++;
    return `${prefix}${i}`;
  };
  const homeChoices = content.zones.filter((z) => !z.perSeat);
  const disabled = archived;

  return (
    <div className="page">
      <header className="topbar">
        <Link to="/setups">
          <button aria-label="Back">←</button>
        </Link>
        <h1>{content.name}</h1>
        {dirty && (
          <span className="pill warn" data-testid="unsaved">
            Unsaved
          </span>
        )}
      </header>
      {archived && (
        <div className="banner">
          This setup is archived.{' '}
          <button
            className="small"
            onClick={async () => {
              await api('POST', `/api/setups/${setup.id}/restore`);
              reload();
            }}
          >
            Restore
          </button>
        </div>
      )}
      <div className="content setup-editor">
        <div className="row wrap">
          <button disabled={!dirty} onClick={discard}>
            Discard
          </button>
          <button className="primary" disabled={!dirty || disabled} onClick={save}>
            Save
          </button>
          <span className="grow" />
          <button
            onClick={async () => {
              const c = await api('POST', `/api/setups/${setup.id}/clone`);
              toast(`Cloned "${c.name}"`);
              nav(`/setups/${c.id}`);
            }}
          >
            Clone
          </button>
          {!archived && (
            <button
              onClick={async () => {
                await api('POST', `/api/setups/${setup.id}/archive`);
                toast(`Archived "${setup.name}"`);
                nav('/setups');
              }}
            >
              Archive
            </button>
          )}
        </div>

        <label htmlFor="sname">Name</label>
        <input id="sname" value={content.name} maxLength={40} disabled={disabled} onChange={(e) => update((c) => void (c.name = e.target.value || ' '))} />

        <h3>Players</h3>
        <div className="row">
          <label className="row" style={{ margin: 0 }}>
            From
            <input aria-label="Fewest players" type="number" min={1} max={12} style={{ width: 70 }} value={content.players.min} disabled={disabled} onChange={(e) => update((c) => void (c.players.min = Math.max(1, Math.min(12, Number(e.target.value) || 1))))} />
          </label>
          <label className="row" style={{ margin: 0 }}>
            to
            <input aria-label="Most players" type="number" min={1} max={12} style={{ width: 70 }} value={content.players.max} disabled={disabled} onChange={(e) => update((c) => void (c.players.max = Math.max(1, Math.min(12, Number(e.target.value) || 1))))} />
          </label>
        </div>

        <h3>Decks</h3>
        <ul className="list" aria-label="Deck slots">
          {content.slots.map((s, i) => (
            <li key={s.id} className="setup-row">
              <input aria-label={`Deck slot ${i + 1} name`} value={s.label} maxLength={40} disabled={disabled} onChange={(e) => update((c) => void (c.slots[i].label = e.target.value || ' '))} />
              <select aria-label={`Deck slot ${i + 1} default deck`} value={s.defaultDeckId ?? ''} disabled={disabled} onChange={(e) => update((c) => void (c.slots[i].defaultDeckId = e.target.value || null))}>
                <option value="">Choose when applying</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select aria-label={`Deck slot ${i + 1} home zone`} value={content.homes[s.id] ?? ''} disabled={disabled} onChange={(e) => update((c) => void (c.homes[s.id] = e.target.value))}>
                <option value="">Home zone…</option>
                {homeChoices.map((z) => (
                  <option key={z.key} value={z.key}>
                    {z.name}
                  </option>
                ))}
              </select>
              <button
                className="small"
                aria-label={`Remove deck slot ${i + 1}`}
                disabled={disabled}
                onClick={() =>
                  update((c) => {
                    c.slots.splice(i, 1);
                    delete c.homes[s.id];
                  })
                }
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <button
          disabled={disabled}
          onClick={() =>
            update((c) => {
              const id = nextKey('s', c.slots.map((x) => x.id));
              c.slots.push({ id, label: 'Deck', defaultDeckId: decks[0]?.id ?? null });
              const pile = c.zones.find((z) => z.layout === 'pile' && !z.perSeat);
              if (pile) c.homes[id] = pile.key;
            })
          }
        >
          + Deck slot
        </button>

        <h3>Zones</h3>
        <p className="small-text muted">Cards each zone gets: a number, "rest", or by player count like "2:10, 3-4:7". A deck's home zone keeps whatever is left.</p>
        <ul className="list" aria-label="Zones">
          {content.zones.map((z, i) => (
            <li key={z.key} className="setup-row zone-edit">
              <input aria-label={`Zone ${i + 1} name`} value={z.name} maxLength={40} disabled={disabled} onChange={(e) => update((c) => void (c.zones[i].name = e.target.value || ' '))} />
              <select aria-label={`Zone ${i + 1} layout`} value={z.layout} disabled={disabled} onChange={(e) => update((c) => void (c.zones[i].layout = e.target.value as SetupZone['layout']))}>
                <option value="pile">Pile</option>
                <option value="spread">Spread</option>
                <option value="column">Column</option>
                <option value="free">Free</option>
              </select>
              <select aria-label={`Zone ${i + 1} width`} value={z.width ?? ''} disabled={disabled} onChange={(e) => update((c) => void (e.target.value ? (c.zones[i].width = e.target.value as 'fit') : delete c.zones[i].width))}>
                <option value="">Auto width</option>
                <option value="fit">Fit</option>
                <option value="half">Half</option>
                <option value="full">Full</option>
              </select>
              <CountText caption="Face down" label={`Zone ${i + 1} face down`} value={z.down} onChange={(v) => update((c) => void (c.zones[i].down = v))} />
              <CountText caption="Face up" label={`Zone ${i + 1} face up`} value={z.up} onChange={(v) => update((c) => void (c.zones[i].up = v))} />
              <label className="row small-text" style={{ margin: 0 }}>
                <input type="checkbox" style={{ width: 18, minHeight: 18 }} checked={!!z.newRow} disabled={disabled} onChange={(e) => update((c) => void (c.zones[i].newRow = e.target.checked || undefined))} />
                New row
              </label>
              <label className="row small-text" style={{ margin: 0 }}>
                <input type="checkbox" style={{ width: 18, minHeight: 18 }} checked={!!z.perSeat} disabled={disabled} onChange={(e) => update((c) => void (c.zones[i].perSeat = e.target.checked || undefined))} />
                Per seat
              </label>
              {content.slots.length > 1 && (
                <select aria-label={`Zone ${i + 1} deck`} value={z.slot ?? content.slots[0].id} disabled={disabled} onChange={(e) => update((c) => void (c.zones[i].slot = e.target.value))}>
                  {content.slots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              )}
              <span className="row" style={{ gap: 4 }}>
                <button className="small" aria-label={`Move zone ${i + 1} up`} disabled={disabled || i === 0} onClick={() => update((c) => void c.zones.splice(i - 1, 0, ...c.zones.splice(i, 1)))}>
                  ↑
                </button>
                <button className="small" aria-label={`Move zone ${i + 1} down`} disabled={disabled || i === content.zones.length - 1} onClick={() => update((c) => void c.zones.splice(i + 1, 0, ...c.zones.splice(i, 1)))}>
                  ↓
                </button>
                <button className="small" aria-label={`Remove zone ${i + 1}`} disabled={disabled} onClick={() => update((c) => void c.zones.splice(i, 1))}>
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
        <button disabled={disabled} onClick={() => update((c) => void c.zones.push({ key: nextKey('z', c.zones.map((x) => x.key)), name: `Zone ${c.zones.length + 1}`, layout: 'spread', down: 0, up: 0 }))}>
          + Zone
        </button>

        <h3>Each player's hand</h3>
        <div className="row wrap">
          <CountText caption="Cards" wide label="Cards in each hand" value={content.hands?.count ?? 0} onChange={(v) => update((c) => void (v === 0 ? delete c.hands : (c.hands = { ...(c.hands ?? { face: 'down' }), count: v })))} />
          <select aria-label="Hand cards face" value={content.hands?.face ?? 'down'} disabled={disabled || !content.hands} onChange={(e) => update((c) => void (c.hands && (c.hands.face = e.target.value as 'down')))} style={{ width: 'auto' }}>
            <option value="down">Face down</option>
            <option value="up">Face up</option>
          </select>
        </div>

        <h3>Counters</h3>
        <ul className="list" aria-label="Counters">
          {content.counters.map((k, i) => (
            <li key={i} className="setup-row">
              <input aria-label={`Counter ${i + 1} label`} value={k.label} maxLength={40} disabled={disabled} onChange={(e) => update((c) => void (c.counters[i].label = e.target.value || ' '))} />
              <input aria-label={`Counter ${i + 1} starting value`} type="number" style={{ width: 90 }} value={k.value} disabled={disabled} onChange={(e) => update((c) => void (c.counters[i].value = Math.trunc(Number(e.target.value) || 0)))} />
              <label className="row small-text" style={{ margin: 0 }}>
                <input type="checkbox" style={{ width: 18, minHeight: 18 }} checked={!!k.perSeat} disabled={disabled} onChange={(e) => update((c) => void (c.counters[i].perSeat = e.target.checked || undefined))} />
                Per seat
              </label>
              <button className="small" aria-label={`Remove counter ${i + 1}`} disabled={disabled} onClick={() => update((c) => void c.counters.splice(i, 1))}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <button disabled={disabled} onClick={() => update((c) => void c.counters.push({ label: '{name} score', value: 0, perSeat: true }))}>
          + Counter
        </button>
        <p className="small-text muted">In per-seat names, {'{name}'} becomes each player's name.</p>

        {content.fixed && (
          <>
            <h3>Fixed deal</h3>
            <p className="small-text">
              Recorded for {content.fixed.players} player{content.fixed.players === 1 ? '' : 's'}: every apply recreates exactly the recorded cards, and its decks are locked.
            </p>
            <button disabled={disabled} onClick={() => update((c) => void delete c.fixed)}>
              Remove fixed deal
            </button>
          </>
        )}
      </div>
    </div>
  );
}
