import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DeckSummary } from '@vct/shared';
import { api, imageUrl } from '../lib/api';
import { Tabs } from '../components/ui';
import { useApp } from '../store/app';

type Tab = 'mine' | 'archived' | 'gallery';

export function DeckTile({ d, onOpen, extra }: { d: DeckSummary; onOpen: () => void; extra?: React.ReactNode }) {
  return (
    <li className="deck-tile" data-testid="deck-row">
      <button className="ghost" style={{ padding: 0 }} aria-label={`Open ${d.name}`} onClick={onOpen}>
        {d.coverImageId ? (
          <img src={imageUrl(d.coverImageId, true)} alt="" style={{ width: 44, aspectRatio: '2.5/3.5', objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <div className="card" style={{ ['--card-w' as any]: '44px' }}>
            <div className="gen-back" />
          </div>
        )}
      </button>
      <div className="grow" onClick={onOpen} style={{ cursor: 'pointer' }}>
        <strong>{d.name}</strong>
        <div className="small-text muted">
          {d.cardCount} cards{d.ownerName ? ` · by ${d.ownerName}` : ''}
          {d.builtIn ? ' · built-in' : ''}
          {d.cloneCount ? ` · cloned ${d.cloneCount}×` : ''}
        </div>
        <div className="row wrap" style={{ gap: 4, marginTop: 2 }}>
          {d.visibility !== 'private' && !d.builtIn && <span className="pill">{d.visibility === 'public' ? 'Public' : 'Link'}</span>}
          {d.hasDraft && <span className="pill warn">Unsaved draft</span>}
          {d.clonedFromLabel && <span className="pill">{d.clonedFromLabel}</span>}
        </div>
      </div>
      {extra}
    </li>
  );
}

export function DecksPage() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('mine');
  const [mine, setMine] = useState<DeckSummary[]>([]);
  const [builtIn, setBuiltIn] = useState<DeckSummary[]>([]);
  const [archived, setArchived] = useState<DeckSummary[]>([]);
  const [gallery, setGallery] = useState<{ total: number; decks: DeckSummary[] }>({ total: 0, decks: [] });
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'newest' | 'cloned'>('newest');
  const [newName, setNewName] = useState('');
  const toast = useApp((s) => s.toast);

  const load = async () => {
    const r = await api('GET', '/api/decks');
    setMine(r.decks);
    setBuiltIn(r.builtIn);
    setArchived((await api('GET', '/api/decks?status=archived')).decks);
  };
  useEffect(() => {
    load().catch((e) => toast(e.message, 'error'));
  }, []);
  useEffect(() => {
    if (tab !== 'gallery') return;
    const t = setTimeout(() => api('GET', `/api/gallery?q=${encodeURIComponent(q)}&sort=${sort}`).then(setGallery), 200);
    return () => clearTimeout(t);
  }, [tab, q, sort]);

  const clone = async (id: string) => {
    const d = await api('POST', `/api/decks/${id}/clone`);
    toast(`Cloned "${d.name}" to your library`);
    nav(`/decks/${d.id}`);
  };

  const importFile = async (f: File) => {
    const fd = new FormData();
    fd.append('file', f);
    try {
      const d = await api('POST', '/api/decks/import', fd);
      toast(`Imported "${d.name}"`);
      nav(`/decks/${d.id}`);
    } catch (e: any) {
      toast(e.errors ? e.errors.map((x: any) => (x.card !== undefined ? `card ${x.card + 1}${x.name ? ` "${x.name}"` : ''}: ` : '') + x.message).join('\n') : e.message, 'error');
    }
  };

  return (
    <div className="page">
      <header className="topbar">
        <Link to="/">
          <button aria-label="Back to lobby">←</button>
        </Link>
        <h1>Decks</h1>
        <label className="small-text" style={{ margin: 0 }}>
          <span className="sr-only">Import deck</span>
          <input type="file" accept=".zip,.json,application/zip,application/json" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          <span role="button" className="pill" style={{ cursor: 'pointer', padding: '8px 12px' }}>
            Import
          </span>
        </label>
      </header>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'mine', label: 'My decks' },
          { id: 'archived', label: `Archived${archived.length ? ` (${archived.length})` : ''}` },
          { id: 'gallery', label: 'Gallery' },
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
                const d = await api('POST', '/api/decks', { name: newName.trim() });
                setNewName('');
                nav(`/decks/${d.id}`);
              }}
            >
              <input aria-label="New deck name" placeholder="New deck name" value={newName} maxLength={100} onChange={(e) => setNewName(e.target.value)} />
              <button className="primary">Create</button>
            </form>
            <ul className="list" aria-label="My decks">
              {mine.length === 0 && <li className="empty">No decks yet. Create one, import one, or clone one from the gallery.</li>}
              {mine.map((d) => (
                <DeckTile key={d.id} d={d} onOpen={() => nav(`/decks/${d.id}`)} />
              ))}
            </ul>
            <h3>Built-in</h3>
            <ul className="list" aria-label="Built-in decks">
              {builtIn.map((d) => (
                <DeckTile key={d.id} d={d} onOpen={() => nav(`/decks/${d.id}`)} extra={<button onClick={() => clone(d.id)}>Clone</button>} />
              ))}
            </ul>
          </>
        )}
        {tab === 'archived' && (
          <ul className="list" aria-label="Archived decks">
            {archived.length === 0 && <li className="empty">No archived decks.</li>}
            {archived.map((d) => (
              <DeckTile
                key={d.id}
                d={d}
                onOpen={() => nav(`/decks/${d.id}`)}
                extra={
                  <div className="row">
                    <button
                      onClick={async () => {
                        await api('POST', `/api/decks/${d.id}/restore`);
                        toast(`Restored "${d.name}"`);
                        load();
                      }}
                    >
                      Restore
                    </button>
                    <button
                      aria-label={`Delete ${d.name} permanently`}
                      onClick={async () => {
                        if (!confirm(`Permanently delete "${d.name}"? This cannot be undone.`)) return;
                        await api('DELETE', `/api/decks/${d.id}`, { confirm: true });
                        toast(`Deleted "${d.name}"`);
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
        {tab === 'gallery' && (
          <>
            <div className="row">
              <input aria-label="Search the gallery" placeholder="Search by deck or owner" value={q} onChange={(e) => setQ(e.target.value)} />
              <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as any)} style={{ width: 'auto' }}>
                <option value="newest">Newest</option>
                <option value="cloned">Most cloned</option>
              </select>
            </div>
            <ul className="list" aria-label="Gallery">
              {gallery.decks.length === 0 && <li className="empty">No public decks found.</li>}
              {gallery.decks.map((d) => (
                <DeckTile key={d.id} d={d} onOpen={() => nav(`/decks/${d.id}`)} extra={<button onClick={() => clone(d.id)}>Clone</button>} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
