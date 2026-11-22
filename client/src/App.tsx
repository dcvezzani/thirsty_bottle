import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { checkDuplicateTab, getTabToken, listIdentities, setTabToken } from './lib/identity';
import { connect, getSocket, switchIdentity, useApp } from './store/app';
import { IdentityPicker, Onboarding } from './pages/Onboarding';
import { ConnectionBanner, Toasts } from './components/ui';
import { UpdateBar, UpdateGate } from './components/UpdateBar';
import { Lobby } from './pages/Lobby';
import { DecksPage } from './pages/Decks';
import { SetupPage, SetupsPage } from './pages/Setups';
import { DeckPage, ShareLinkPage } from './pages/DeckEditor';
import { TablePage } from './pages/Table';

type Gate = { kind: 'loading' } | { kind: 'onboard' } | { kind: 'pick'; notice?: string } | { kind: 'ready' };

export function App() {
  const [gate, setGate] = useState<Gate>({ kind: 'loading' });
  const status = useApp((s) => s.status);
  const me = useApp((s) => s.me);

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(location.search);
      if (params.has('newPlayer')) {
        params.delete('newPlayer');
        history.replaceState(null, '', location.pathname + (params.toString() ? `?${params}` : ''));
        setTabToken(null);
        return setGate({ kind: 'onboard' });
      }
      const token = getTabToken();
      if (token) {
        if (await checkDuplicateTab(token)) {
          setTabToken(null);
          return setGate({ kind: 'pick', notice: 'That player is already open in another window. Pick who plays here.' });
        }
        connect(token);
        return setGate({ kind: 'ready' });
      }
      setGate(listIdentities().length ? { kind: 'pick' } : { kind: 'onboard' });
    })();
  }, []);

  const start = (token: string) => {
    switchIdentity(token);
    connect(token);
    setGate({ kind: 'ready' });
  };

  if (gate.kind === 'loading') return null;
  if (gate.kind === 'onboard')
    return <Onboarding onDone={start} onBack={listIdentities().length ? () => setGate({ kind: 'pick' }) : undefined} />;
  if (gate.kind === 'pick') return <IdentityPicker notice={gate.notice} onPick={(i) => start(i.token)} onNew={() => setGate({ kind: 'onboard' })} />;

  return (
    <BrowserRouter>
      <ConnectionBanner />
      <UpdateBar />
      <UpdateGate />
      {status === 'replaced' && (
        <div className="overlay" style={{ alignItems: 'center' }}>
          <div className="sheet" role="alertdialog" aria-label="Open in another window">
            <h2>{me?.name ?? 'This player'} is open in another window</h2>
            <p className="muted">Only one window can play as the same player at a time.</p>
            <div className="row">
              <button className="primary grow" onClick={() => getSocket()?.reconnectNow()}>
                Take it back
              </button>
              <button className="grow" onClick={() => { switchIdentity(null); setGate({ kind: 'pick' }); }}>
                Switch player
              </button>
            </div>
          </div>
        </div>
      )}
      <Toasts />
      <Routes>
        <Route path="/" element={<Lobby onSwitchPlayer={() => { switchIdentity(null); setGate({ kind: 'pick' }); }} />} />
        <Route path="/decks" element={<DecksPage />} />
        <Route path="/decks/:id" element={<DeckPage />} />
        <Route path="/setups" element={<SetupsPage />} />
        <Route path="/setups/:id" element={<SetupPage />} />
        <Route path="/d/:token" element={<ShareLinkPage />} />
        <Route path="/t/:id" element={<TablePage />} />
      </Routes>
    </BrowserRouter>
  );
}
