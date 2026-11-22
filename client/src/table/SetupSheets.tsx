import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SetupSummary, TableView } from '@vct/shared';
import { Sheet } from '../components/ui';
import { api } from '../lib/api';
import { getSocket, useApp } from '../store/app';

/** table-setups on the table: Apply setup…, Play again, Save table as setup (D7). */

const REPLACE_WARNING = 'This replaces all zones, cards and counters. Seats and players stay.';

export async function applySetup(view: TableView, setupId: string, name: string, slots?: Record<string, string>, shareToken?: string) {
  if (!confirm(`Apply "${name}"? ${REPLACE_WARNING}`)) return false;
  try {
    await getSocket()?.request({ t: 'table.applySetup', tableId: view.id, setupId, ...(slots ? { slots } : {}), ...(shareToken ? { shareToken } : {}) });
    return true;
  } catch (e: any) {
    useApp.getState().toast(e.message, 'error');
    return false;
  }
}

export function playAgain(view: TableView) {
  // reuse the decks chosen last time (setup-sharing: Play again keeps working on others' setups)
  if (view.lastSetup) return applySetup(view, view.lastSetup.id, view.lastSetup.name, view.lastSetup.slots);
}

function SetupChoice({ s, seated, onChoose }: { s: SetupSummary; seated: number; onChoose: () => void }) {
  const fits = seated >= s.players.min && seated <= s.players.max;
  return (
    <li className="deck-tile">
      <div className="grow">
        <strong>{s.name}</strong>
        <div className="small-text muted">
          {s.players.min === s.players.max ? s.players.min : `${s.players.min}-${s.players.max}`} players{fits ? '' : ` (${seated} seated)`}
          {!s.mine && s.ownerName ? ` · by ${s.ownerName}` : ''}
        </div>
      </div>
      <button onClick={onChoose}>Choose</button>
    </li>
  );
}

/** Apply setup (setup-sharing D8): your setups, the built-ins, and the public gallery. */
export function ApplySetupSheet({ view, onClose, preset }: { view: TableView; onClose: () => void; preset?: { id: string; name: string; share?: string } }) {
  const [mine, setMine] = useState<SetupSummary[] | null>(null);
  const [builtIn, setBuiltIn] = useState<SetupSummary[]>([]);
  const [gallery, setGallery] = useState<SetupSummary[]>([]);
  const [q, setQ] = useState('');
  const [decks, setDecks] = useState<{ id: string; name: string }[]>([]);
  const [chosen, setChosen] = useState<SetupSummary | null>(null);
  const [share, setShare] = useState<string | undefined>(preset?.share);
  const [slots, setSlots] = useState<Record<string, string>>({});
  const toast = useApp((s) => s.toast);
  const choose = (s: SetupSummary, token?: string) => {
    setChosen(s);
    setShare(token);
    // pre-select only default decks this host can load; the others need a choice
    setSlots(Object.fromEntries(s.slots.filter((x) => x.defaultDeckId && x.defaultDeckUsable).map((x) => [x.id, x.defaultDeckId!])));
  };
  useEffect(() => {
    api('GET', '/api/setups')
      .then((r) => {
        setMine(r.setups);
        setBuiltIn(r.builtIn);
      })
      .catch((e) => toast(e.message, 'error'));
    api('GET', '/api/decks')
      .then((r) => setDecks([...r.builtIn, ...r.decks].map((d: any) => ({ id: d.id, name: d.name }))))
      .catch(() => {});
    if (preset)
      api('GET', `/api/setups/${preset.id}${preset.share ? `?share=${preset.share}` : ''}`)
        .then((d) => choose(d, preset.share))
        .catch((e) => toast(e.message, 'error'));
  }, []);
  useEffect(() => {
    const t = setTimeout(() => api('GET', `/api/setup-gallery?q=${encodeURIComponent(q)}`).then((r) => setGallery(r.setups)).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [q]);
  const seated = view.seats.filter((s) => s.playerId).length;
  return (
    <Sheet title="Apply setup" onClose={onClose}>
      {!chosen && (
        <>
          <h4 style={{ margin: '4px 0' }}>Your setups</h4>
          {mine === null && <p className="muted">Loading…</p>}
          {mine?.length === 0 && <p className="muted small-text">None yet. Set up a table and use Save table as setup, or create one on the Setups page.</p>}
          <ul className="list" aria-label="Your setups">
            {mine?.map((s) => <SetupChoice key={s.id} s={s} seated={seated} onChoose={() => choose(s)} />)}
          </ul>
          <h4 style={{ margin: '10px 0 4px' }}>Built-in</h4>
          <ul className="list" aria-label="Built-in setups">
            {builtIn.map((s) => <SetupChoice key={s.id} s={s} seated={seated} onChoose={() => choose(s)} />)}
          </ul>
          <h4 style={{ margin: '10px 0 4px' }}>Gallery</h4>
          <input aria-label="Search public setups" placeholder="Search public setups" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="list" aria-label="Public setups">
            {gallery.map((s) => <SetupChoice key={s.id} s={s} seated={seated} onChoose={() => choose(s)} />)}
          </ul>
        </>
      )}
      {chosen && (
        <>
          <h3 style={{ margin: '4px 0' }}>{chosen.name}</h3>
          {chosen.slots.map((s) => (
            <div key={s.id}>
              <label htmlFor={`slot-${s.id}`}>{s.label}</label>
              <select id={`slot-${s.id}`} value={slots[s.id] ?? ''} disabled={chosen.fixed} onChange={(e) => setSlots({ ...slots, [s.id]: e.target.value })}>
                <option value="">Choose a deck…</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {s.defaultDeckId && !s.defaultDeckUsable && !chosen.fixed && <p className="small-text muted">The setup's own deck isn't available to you; choose one.</p>}
            </div>
          ))}
          {chosen.fixed && <p className="small-text muted">This setup has a fixed deal, so its decks can't be changed.</p>}
          <div className="actions" style={{ marginTop: 10 }}>
            <button onClick={() => setChosen(null)}>Back</button>
            <button
              className="primary"
              disabled={!chosen.fixed && chosen.slots.some((s) => !slots[s.id])}
              onClick={async () => {
                if (await applySetup(view, chosen.id, chosen.name, chosen.fixed ? undefined : slots, share)) onClose();
              }}
            >
              Apply
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

export function SaveSetupSheet({ view, onClose }: { view: TableView; onClose: () => void }) {
  const nav = useNavigate();
  const toast = useApp((s) => s.toast);
  const [name, setName] = useState(view.lastSetup?.name ?? view.settings.name);
  const [fixed, setFixed] = useState(false);
  return (
    <Sheet title="Save table as setup" onClose={onClose}>
      <p className="small-text muted">Records the zones, the deal on the table now, the decks and the counters. You can review it before saving.</p>
      <label htmlFor="setup-name">Setup name</label>
      <input id="setup-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      <label className="row" style={{ color: 'var(--ink)' }}>
        <input type="checkbox" style={{ width: 20 }} checked={fixed} onChange={(e) => setFixed(e.target.checked)} />
        Fixed deal (recreate exactly these cards)
      </label>
      <div className="actions">
        <button
          className="primary"
          disabled={!name.trim()}
          onClick={async () => {
            try {
              const s = await api('POST', `/api/tables/${view.id}/record-setup`, { name: name.trim(), fixed });
              onClose();
              nav(`/setups/${s.id}`);
            } catch (e: any) {
              toast(e.message, 'error');
            }
          }}
        >
          Record and review
        </button>
      </div>
    </Sheet>
  );
}
