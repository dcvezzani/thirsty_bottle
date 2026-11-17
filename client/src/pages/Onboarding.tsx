import { useState } from 'react';
import { api } from '../lib/api';
import { forgetIdentity, listIdentities, type Identity } from '../lib/identity';
import { PLAYER_COLORS } from '../components/ui';

/** First visit / new player: choose a display name and a color. */
export function Onboarding({ onDone, onBack }: { onDone: (token: string) => void; onBack?: () => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setErr('Enter a name');
    setBusy(true);
    try {
      const r = await api<{ token: string }>('POST', '/api/players', { name: n, color }, null);
      onDone(r.token);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  };
  return (
    <div className="center">
      <form className="onboard" onSubmit={submit}>
        <h1 style={{ marginTop: 0 }}>Card Table</h1>
        <p className="muted">Pick a name and a color to sit down. No password needed.</p>
        <label htmlFor="name">Display name</label>
        <input id="name" value={name} maxLength={24} autoFocus autoComplete="nickname" onChange={(e) => setName(e.target.value)} />
        <label>Color</label>
        <div className="colors" role="group" aria-label="Color">
          {PLAYER_COLORS.map((c) => (
            <button type="button" key={c} aria-label={`Color ${c}`} aria-pressed={c === color} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
        {err && <p className="err">{err}</p>}
        <div className="row" style={{ marginTop: 16 }}>
          {onBack && (
            <button type="button" onClick={onBack}>
              Back
            </button>
          )}
          <button className="primary grow" disabled={busy}>
            Enter the lobby
          </button>
        </div>
      </form>
    </div>
  );
}

/** A new window: continue as a player used before in this browser, or create a new one. */
export function IdentityPicker({ onPick, onNew, notice }: { onPick: (i: Identity) => void; onNew: () => void; notice?: string }) {
  const [list, setList] = useState(listIdentities());
  const [code, setCode] = useState('');
  return (
    <div className="center">
      <div className="onboard">
        <h1 style={{ marginTop: 0 }}>Who's playing?</h1>
        {notice && <p className="banner">{notice}</p>}
        <ul className="list">
          {list.map((i) => (
            <li key={i.token} className="row">
              <span className="dot" style={{ background: i.color }} />
              <button className="grow primary" style={{ textAlign: 'left' }} onClick={() => onPick(i)}>
                Continue as {i.name}
              </button>
              <button
                className="ghost small"
                aria-label={`Forget ${i.name}`}
                onClick={() => {
                  forgetIdentity(i.token);
                  setList(listIdentities());
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <button style={{ width: '100%', marginTop: 12 }} onClick={onNew}>
          New player
        </button>
        <details style={{ marginTop: 12 }}>
          <summary className="muted small-text">Continue with a recovery code</summary>
          <div className="row" style={{ marginTop: 8 }}>
            <input aria-label="Recovery code" value={code} onChange={(e) => setCode(e.target.value.trim())} />
            <button
              disabled={code.length < 16}
              onClick={async () => {
                try {
                  const me = await api('GET', '/api/me', undefined, code);
                  onPick({ token: code, id: me.player.id, name: me.player.name, color: me.player.color, lastUsed: Date.now() });
                } catch {
                  alert('Unknown recovery code');
                }
              }}
            >
              Go
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
