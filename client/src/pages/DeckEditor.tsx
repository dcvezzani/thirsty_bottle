import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Ability, CardDef, DeckContent, DeckDetail, DeckSummary, MetaType, MetaValue } from '@vct/shared';
import { api, download, imageUrl } from '../lib/api';
import { useApp } from '../store/app';
import { Sheet } from '../components/ui';
import { DefCard, TextFace } from '../components/Card';

const newId = () => 'c_' + Math.random().toString(36).slice(2, 10);

export function ShareLinkPage() {
  const { token } = useParams();
  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api('GET', `/api/share/${token}`).then(setDeck).catch((e) => setErr(e.message));
  }, [token]);
  if (err)
    return (
      <div className="page">
        <header className="topbar">
          <Link to="/">
            <button aria-label="Back">←</button>
          </Link>
          <h1>Shared deck</h1>
        </header>
        <div className="content empty" role="alert">
          {err}
        </div>
      </div>
    );
  if (!deck) return null;
  return <DeckViewer deck={deck} share={token} />;
}

export function DeckPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const share = sp.get('share') ?? undefined;
  const me = useApp((s) => s.me);
  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [err, setErr] = useState('');
  const reload = useCallback(() => {
    api('GET', `/api/decks/${id}${share ? `?share=${share}` : ''}`)
      .then(setDeck)
      .catch((e) => setErr(e.message));
  }, [id, share]);
  useEffect(reload, [reload]);
  if (err)
    return (
      <div className="page">
        <header className="topbar">
          <Link to="/decks">
            <button aria-label="Back">←</button>
          </Link>
          <h1>Deck</h1>
        </header>
        <div className="content empty">{err}</div>
      </div>
    );
  if (!deck || !me) return null;
  if (deck.ownerId === me.id) return <DeckEditor key={deck.id + deck.currentVersionId + deck.status} deck={deck} reload={reload} />;
  return <DeckViewer deck={deck} share={share} />;
}

/** Read-only browsing of someone else's (or a built-in) deck, with Clone. */
function DeckViewer({ deck, share }: { deck: DeckDetail; share?: string }) {
  const nav = useNavigate();
  const toast = useApp((s) => s.toast);
  const [info, setInfo] = useState<CardDef | null>(null);
  const clone = async () => {
    const d = await api('POST', `/api/decks/${deck.id}/clone${share ? `?share=${share}` : ''}`);
    toast(`Cloned "${d.name}" to your library`);
    nav(`/decks/${d.id}`);
  };
  return (
    <div className="page">
      <header className="topbar">
        <Link to="/decks">
          <button aria-label="Back">←</button>
        </Link>
        <h1>{deck.content.name}</h1>
        <button onClick={clone}>Clone</button>
      </header>
      <div className="content">
        <p className="muted small-text">
          {deck.cardCount} cards · {deck.builtIn ? 'built-in' : `by ${deck.ownerName ?? 'someone'}`}
          {deck.clonedFromLabel ? ` · ${deck.clonedFromLabel}` : ''}
        </p>
        {deck.content.description && <p>{deck.content.description}</p>}
        <div className="row wrap">
          <button className="small" onClick={() => download(`/api/decks/${deck.id}/export?format=zip${share ? `&share=${share}` : ''}`, 'deck.zip')}>
            Export .zip
          </button>
          <button className="small" onClick={() => download(`/api/decks/${deck.id}/export?format=json${share ? `&share=${share}` : ''}`, 'deck.json')}>
            Export .json
          </button>
          {!deck.builtIn && (
            <button
              className="small ghost"
              onClick={async () => {
                if (!confirm('Report this deck? It will be hidden from the gallery pending review.')) return;
                await api('POST', `/api/decks/${deck.id}/report`, {});
                toast('Thanks: the deck was reported');
              }}
            >
              Report
            </button>
          )}
        </div>
        <div className="grid-cards" style={{ marginTop: 12 }}>
          {deck.content.cards.map((c) => (
            <button key={c.id} className="card-tile" style={{ textAlign: 'left', height: 'auto' }} onClick={() => setInfo(c)}>
              <DefCard def={c} style={{ ['--card-w' as any]: '100%' }} />
              <div className="small-text" style={{ marginTop: 6 }}>
                <strong>{c.name}</strong> ×{c.count}
              </div>
            </button>
          ))}
        </div>
      </div>
      {info && <DefInfo def={info} onClose={() => setInfo(null)} />}
    </div>
  );
}

export function DefInfo({ def, onClose, extra }: { def: CardDef; onClose: () => void; extra?: React.ReactNode }) {
  return (
    <Sheet title={def.name} onClose={onClose}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <DefCard def={def} style={{ ['--card-w' as any]: '140px' }} />
        <div className="grow">
          {def.description && <p style={{ marginTop: 0 }}>{def.description}</p>}
          <MetaList def={def} />
          {extra}
        </div>
      </div>
    </Sheet>
  );
}

export function MetaList({ def }: { def: CardDef }) {
  const md = Object.entries(def.metadata ?? {});
  return (
    <>
      <dl className="kv">
        <dt>Copies</dt>
        <dd>{def.count}</dd>
        {md.map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt>{k}</dt>
            <dd>{Array.isArray(v) ? v.join(', ') : String(v)}</dd>
          </div>
        ))}
      </dl>
      {def.abilities?.length ? (
        <>
          <h4 style={{ margin: '10px 0 4px' }}>Abilities</h4>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {def.abilities.map((a, i) => (
              <li key={i} className="small-text">
                <strong>{a.trigger}</strong>: {a.effect}
                {a.value !== undefined && a.value !== '' ? ` ${a.value}` : ''} → {a.target}
              </li>
            ))}
          </ul>
          <p className="small-text muted">Abilities are descriptive: play them out yourselves.</p>
        </>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

function DeckEditor({ deck, reload }: { deck: DeckDetail; reload: () => void }) {
  const nav = useNavigate();
  const toast = useApp((s) => s.toast);
  const [content, setContent] = useState<DeckContent>(deck.content);
  const [dirty, setDirty] = useState(false);
  const [resumePrompt, setResumePrompt] = useState(!!deck.draft);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<CardDef | 'new' | null>(null);
  const [settings, setSettings] = useState(false);
  const [copying, setCopying] = useState(false);
  const [bulk, setBulk] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const archived = deck.status === 'archived';

  const update = (f: (c: DeckContent) => DeckContent) => {
    setContent((prev) => {
      const next = f(structuredClone(prev));
      setDirty(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        api('PUT', `/api/decks/${deck.id}/draft`, { content: next }).catch((e) => toast(e.message, 'error'));
      }, 300);
      return next;
    });
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const flush = async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const save = async () => {
    await flush();
    try {
      await api('POST', `/api/decks/${deck.id}/save`, { content });
      setDirty(false);
      toast('Deck saved');
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  const discard = async () => {
    await flush();
    await api('DELETE', `/api/decks/${deck.id}/draft`);
    setContent(deck.content);
    setDirty(false);
    setResumePrompt(false);
    toast('Changes discarded');
    reload();
  };

  const sel = [...selected];
  const toggle = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  };
  const move = (id: string, d: number) =>
    update((c) => {
      const i = c.cards.findIndex((x) => x.id === id);
      const j = Math.max(0, Math.min(c.cards.length - 1, i + d));
      const [x] = c.cards.splice(i, 1);
      c.cards.splice(j, 0, x);
      return c;
    });

  return (
    <div className="page">
      <header className="topbar">
        <Link to="/decks">
          <button aria-label="Back">←</button>
        </Link>
        <h1>{content.name}</h1>
        {(dirty || deck.draft) && !resumePrompt && (
          <span className="pill warn" data-testid="unsaved">
            Unsaved
          </span>
        )}
        <button aria-label="Deck settings" onClick={() => setSettings(true)}>
          ⚙
        </button>
      </header>
      {archived && (
        <div className="banner">
          This deck is archived.{' '}
          <button
            className="small"
            onClick={async () => {
              await api('POST', `/api/decks/${deck.id}/restore`);
              reload();
            }}
          >
            Restore
          </button>
        </div>
      )}
      {resumePrompt && deck.draft && (
        <div className="banner" role="alert">
          You have unsaved changes from earlier.{' '}
          <button
            className="small"
            onClick={() => {
              setContent(deck.draft!);
              setDirty(true);
              setResumePrompt(false);
            }}
          >
            Resume
          </button>{' '}
          <button className="small" onClick={discard}>
            Discard
          </button>
        </div>
      )}
      <div className="content">
        {deck.clonedFromLabel && <p className="small-text muted">{deck.clonedFromLabel}</p>}
        <div className="row wrap">
          <button className="primary" disabled={archived || resumePrompt} onClick={() => setEditing('new')}>
            + Add card
          </button>
          <button disabled={archived || resumePrompt} onClick={() => setCopying(true)}>
            Copy cards from…
          </button>
          <span className="grow" />
          <button disabled={!dirty} onClick={discard}>
            Discard
          </button>
          <button className="primary" disabled={(!dirty && !deck.draft) || archived || resumePrompt} onClick={save}>
            Save
          </button>
        </div>
        {sel.length > 0 && (
          <div className="row wrap card-tile" style={{ marginTop: 10 }} aria-label="Selection actions">
            <strong>{sel.length} selected</strong>
            <input aria-label="Count for selected" type="number" min={1} style={{ width: 90 }} value={bulk} onChange={(e) => setBulk(e.target.value)} />
            <button
              className="small"
              onClick={() => {
                const n = Number(bulk);
                if (!Number.isInteger(n) || n < 1) return toast('Instance count must be at least 1', 'error');
                update((c) => ({ ...c, cards: c.cards.map((x) => (selected.has(x.id) ? { ...x, count: n } : x)) }));
              }}
            >
              Set count
            </button>
            <button
              className="small"
              onClick={() => {
                update((c) => ({ ...c, cards: c.cards.filter((x) => !selected.has(x.id)) }));
                setSelected(new Set());
              }}
            >
              Remove
            </button>
            <button className="small ghost" onClick={() => setSelected(new Set(content.cards.map((c) => c.id)))}>
              Select all
            </button>
            <button className="small ghost" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        )}
        <p className="small-text muted">
          {content.cards.length} definitions · {content.cards.reduce((n, c) => n + c.count, 0)} cards
        </p>
        <ul className="list" aria-label="Cards">
          {content.cards.length === 0 && <li className="empty">No cards yet: add one.</li>}
          {content.cards.map((c, i) => (
            <li key={c.id} className="row" data-testid="card-row">
              <input type="checkbox" aria-label={`Select ${c.name}`} style={{ width: 22, minHeight: 22 }} checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
              <DefCard def={c} style={{ ['--card-w' as any]: '40px' }} />
              <button className="ghost grow" style={{ textAlign: 'left' }} onClick={() => setEditing(c)} disabled={archived || resumePrompt}>
                <strong>{c.name}</strong> <span className="muted">×{c.count}</span>
                <div className="small-text muted">
                  {Object.entries(c.metadata ?? {})
                    .slice(0, 3)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('/') : v}`)
                    .join(' · ')}
                </div>
              </button>
              <button className="small ghost" aria-label={`Move ${c.name} up`} disabled={i === 0 || archived} onClick={() => move(c.id, -1)}>
                ↑
              </button>
              <button className="small ghost" aria-label={`Move ${c.name} down`} disabled={i === content.cards.length - 1 || archived} onClick={() => move(c.id, 1)}>
                ↓
              </button>
              <button
                className="small ghost"
                aria-label={`Duplicate ${c.name}`}
                disabled={archived}
                onClick={() =>
                  update((d) => {
                    d.cards.splice(i + 1, 0, { ...structuredClone(c), id: newId(), name: `${c.name} (copy)`.slice(0, 100) });
                    return d;
                  })
                }
              >
                ⧉
              </button>
            </li>
          ))}
        </ul>
      </div>
      {editing && (
        <CardForm
          card={editing === 'new' ? null : editing}
          template={content.propertyTemplate ?? []}
          onClose={() => setEditing(null)}
          onSave={(card) => {
            update((c) => {
              const i = c.cards.findIndex((x) => x.id === card.id);
              if (i >= 0) c.cards[i] = card;
              else c.cards.push(card);
              return c;
            });
            setEditing(null);
          }}
          onRemove={(id) => {
            update((c) => ({ ...c, cards: c.cards.filter((x) => x.id !== id) }));
            setEditing(null);
          }}
        />
      )}
      {copying && (
        <CopyFrom
          exclude={deck.id}
          onClose={() => setCopying(false)}
          onCopy={(cards) => {
            update((c) => ({ ...c, cards: [...c.cards, ...cards.map((x) => ({ ...structuredClone(x), id: newId() }))] }));
            setCopying(false);
            toast(`Copied ${cards.length} card${cards.length === 1 ? '' : 's'}`);
          }}
        />
      )}
      {settings && (
        <DeckSettings
          deck={deck}
          content={content}
          onChange={(f) => update(f)}
          onClose={() => setSettings(false)}
          onReload={reload}
          onGone={() => nav('/decks')}
        />
      )}
    </div>
  );
}

function DeckSettings({
  deck,
  content,
  onChange,
  onClose,
  onReload,
  onGone,
}: {
  deck: DeckDetail;
  content: DeckContent;
  onChange: (f: (c: DeckContent) => DeckContent) => void;
  onClose: () => void;
  onReload: () => void;
  onGone: () => void;
}) {
  const toast = useApp((s) => s.toast);
  const [tmplKey, setTmplKey] = useState('');
  const [tmplType, setTmplType] = useState<MetaType>('text');
  const link = deck.shareToken ? `${location.origin}/d/${deck.shareToken}` : '';
  const archived = deck.status === 'archived';
  return (
    <Sheet title="Deck settings" onClose={onClose}>
      <label htmlFor="dname">Name</label>
      <input id="dname" value={content.name} maxLength={100} disabled={archived} onChange={(e) => onChange((c) => ({ ...c, name: e.target.value || c.name }))} />
      <label htmlFor="ddesc">Description</label>
      <textarea id="ddesc" value={content.description ?? ''} disabled={archived} onChange={(e) => onChange((c) => ({ ...c, description: e.target.value || undefined }))} />
      <label>Default card back</label>
      <ImagePicker value={content.backImageId} disabled={archived} onChange={(id) => onChange((c) => ({ ...c, backImageId: id }))} />
      <label>Suggested properties for every card</label>
      <div className="row wrap">
        {(content.propertyTemplate ?? []).map((t) => (
          <span key={t.key} className="pill">
            {t.key} ({t.type}){' '}
            <button className="ghost small" style={{ minHeight: 20 }} aria-label={`Remove property ${t.key}`} onClick={() => onChange((c) => ({ ...c, propertyTemplate: c.propertyTemplate.filter((x) => x.key !== t.key) }))}>
              ✕
            </button>
          </span>
        ))}
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <input aria-label="Property key" placeholder="e.g. suit" value={tmplKey} onChange={(e) => setTmplKey(e.target.value)} />
        <select aria-label="Property type" value={tmplType} style={{ width: 'auto' }} onChange={(e) => setTmplType(e.target.value as MetaType)}>
          <option value="text">text</option>
          <option value="number">number</option>
          <option value="boolean">yes/no</option>
          <option value="list">list</option>
        </select>
        <button
          disabled={!tmplKey.trim() || archived}
          onClick={() => {
            onChange((c) => ({ ...c, propertyTemplate: [...(c.propertyTemplate ?? []).filter((x) => x.key !== tmplKey.trim()), { key: tmplKey.trim(), type: tmplType }] }));
            setTmplKey('');
          }}
        >
          Add
        </button>
      </div>
      <p className="small-text muted">Name, description and properties are part of the draft: press Save to publish them.</p>
      <label htmlFor="dvis">Visibility</label>
      <select
        id="dvis"
        value={deck.visibility}
        onChange={async (e) => {
          await api('PUT', `/api/decks/${deck.id}/visibility`, { visibility: e.target.value });
          onReload();
        }}
      >
        <option value="private">Private: only you (and tables you load it on)</option>
        <option value="link">Link: anyone with the link</option>
        <option value="public">Public: listed in the gallery</option>
      </select>
      {deck.visibility !== 'private' && link && (
        <div className="row" style={{ marginTop: 6 }}>
          <input readOnly aria-label="Share link" value={link} />
          <button
            onClick={() => {
              navigator.clipboard?.writeText(link);
              toast('Link copied');
            }}
          >
            Copy
          </button>
        </div>
      )}
      <div className="actions">
        <button onClick={() => download(`/api/decks/${deck.id}/export?format=zip`, 'deck.zip')}>Export .zip</button>
        <button onClick={() => download(`/api/decks/${deck.id}/export?format=json`, 'deck.json')}>Export .json</button>
        <button
          onClick={async () => {
            const d = await api('POST', `/api/decks/${deck.id}/clone`);
            toast(`Cloned as "${d.name}"`);
            onGone();
          }}
        >
          Clone
        </button>
        {!archived ? (
          <button
            onClick={async () => {
              await api('POST', `/api/decks/${deck.id}/archive`);
              toast('Deck archived');
              onClose();
              onReload();
            }}
          >
            Archive
          </button>
        ) : (
          <>
            <button
              onClick={async () => {
                await api('POST', `/api/decks/${deck.id}/restore`);
                onClose();
                onReload();
              }}
            >
              Restore
            </button>
            <button
              onClick={async () => {
                if (!confirm(`Permanently delete "${deck.name}"? This cannot be undone.`)) return;
                await api('DELETE', `/api/decks/${deck.id}`, { confirm: true });
                toast('Deck deleted');
                onGone();
              }}
            >
              Delete permanently
            </button>
          </>
        )}
      </div>
      {!archived && <p className="small-text muted">Only archived decks can be deleted permanently.</p>}
    </Sheet>
  );
}

function CopyFrom({ exclude, onClose, onCopy }: { exclude: string; onClose: () => void; onCopy: (c: CardDef[]) => void }) {
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [src, setSrc] = useState<DeckDetail | null>(null);
  const [pick, setPick] = useState<Set<string>>(new Set());
  useEffect(() => {
    Promise.all([api('GET', '/api/decks'), api('GET', '/api/gallery?limit=50')]).then(([mine, g]) => {
      const all = [...mine.decks, ...mine.builtIn, ...g.decks].filter((d: DeckSummary) => d.id !== exclude);
      setDecks(all.filter((d, i) => all.findIndex((x) => x.id === d.id) === i));
    });
  }, [exclude]);
  return (
    <Sheet title={src ? `Copy from ${src.content.name}` : 'Copy cards from…'} onClose={onClose}>
      {!src ? (
        <ul className="list">
          {decks.map((d) => (
            <li key={d.id}>
              <button className="ghost" style={{ width: '100%', textAlign: 'left' }} onClick={() => api('GET', `/api/decks/${d.id}`).then(setSrc)}>
                {d.name} <span className="muted small-text">{d.ownerName ? `by ${d.ownerName}` : d.builtIn ? 'built-in' : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <ul className="list">
            {src.content.cards.map((c) => (
              <li key={c.id} className="row">
                <input
                  type="checkbox"
                  aria-label={`Pick ${c.name}`}
                  style={{ width: 22, minHeight: 22 }}
                  checked={pick.has(c.id)}
                  onChange={() => {
                    const s = new Set(pick);
                    if (s.has(c.id)) s.delete(c.id);
                    else s.add(c.id);
                    setPick(s);
                  }}
                />
                <DefCard def={c} style={{ ['--card-w' as any]: '36px' }} />
                <span className="grow">
                  {c.name} ×{c.count}
                </span>
              </li>
            ))}
          </ul>
          <button className="primary" style={{ width: '100%', marginTop: 8 }} disabled={!pick.size} onClick={() => onCopy(src.content.cards.filter((c) => pick.has(c.id)))}>
            Copy {pick.size} card{pick.size === 1 ? '' : 's'}
          </button>
        </>
      )}
    </Sheet>
  );
}

/** Upload with a preview in the 2.5:3.5 card frame before it is used. */
export function ImagePicker({ value, onChange, disabled, label = 'image' }: { value?: string; onChange: (id: string | undefined) => void; disabled?: boolean; label?: string }) {
  const [preview, setPreview] = useState<{ url: string; file: File } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const pickFile = (f: File | undefined) => {
    setErr('');
    if (!f) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) return setErr('Use PNG, JPEG or WebP images up to 10 MB');
    if (f.size > 10 * 1024 * 1024) return setErr('Use PNG, JPEG or WebP images up to 10 MB');
    setPreview({ url: URL.createObjectURL(f), file: f });
  };
  const accept = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', preview.file);
      const r = await api('POST', '/api/images', fd);
      onChange(r.id);
      setPreview(null);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="card" style={{ ['--card-w' as any]: '84px', background: 'var(--panel-2)' }}>
        {preview ? (
          <img className="card-img" style={{ objectFit: 'contain' }} src={preview.url} alt={`${label} preview`} />
        ) : value ? (
          <img className="card-img" src={imageUrl(value, true)} alt={label} />
        ) : (
          <div className="empty small-text">None</div>
        )}
      </div>
      <div className="grow">
        {preview ? (
          <div className="row wrap">
            <button className="primary small" disabled={busy} onClick={accept}>
              Use this {label}
            </button>
            <button className="small" onClick={() => setPreview(null)}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="row wrap">
            <label className="pill" style={{ cursor: disabled ? 'default' : 'pointer', padding: '8px 12px', margin: 0 }}>
              Choose {label}…
              <input type="file" aria-label={`Upload ${label}`} accept="image/png,image/jpeg,image/webp" disabled={disabled} style={{ display: 'none' }} onChange={(e) => pickFile(e.target.files?.[0])} />
            </label>
            {value && (
              <button className="small ghost" disabled={disabled} onClick={() => onChange(undefined)}>
                Remove
              </button>
            )}
          </div>
        )}
        {preview && <p className="small-text muted">Preview in the card frame (2.5 : 3.5). Images are fitted without distortion.</p>}
        {err && <p className="err">{err}</p>}
      </div>
    </div>
  );
}

type MetaRow = { key: string; type: MetaType; value: string };

function toRows(md: Record<string, MetaValue>): MetaRow[] {
  return Object.entries(md).map(([key, v]) => ({
    key,
    type: Array.isArray(v) ? 'list' : typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'text',
    value: Array.isArray(v) ? v.join(', ') : String(v),
  }));
}

function fromRows(rows: MetaRow[]): { md: Record<string, MetaValue>; err?: string } {
  const md: Record<string, MetaValue> = {};
  for (const r of rows) {
    const k = r.key.trim();
    if (!k) continue;
    if (r.type === 'number') {
      const n = Number(r.value);
      if (r.value.trim() === '' || !Number.isFinite(n)) return { md, err: `"${k}" must be a number` };
      md[k] = n;
    } else if (r.type === 'boolean') md[k] = r.value === 'true';
    else if (r.type === 'list') md[k] = r.value.split(',').map((s) => s.trim()).filter(Boolean);
    else md[k] = r.value;
  }
  return { md };
}

function CardForm({
  card,
  template,
  onClose,
  onSave,
  onRemove,
}: {
  card: CardDef | null;
  template: { key: string; type: MetaType }[];
  onClose: () => void;
  onSave: (c: CardDef) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState(card?.name ?? '');
  const [description, setDescription] = useState(card?.description ?? '');
  const [count, setCount] = useState(String(card?.count ?? 1));
  const [front, setFront] = useState<string | undefined>(card?.frontImageId);
  const [back, setBack] = useState<string | undefined>(card?.backImageId);
  const [rows, setRows] = useState<MetaRow[]>(() => {
    const r = toRows(card?.metadata ?? {});
    for (const t of template) if (!r.some((x) => x.key === t.key)) r.push({ key: t.key, type: t.type, value: t.type === 'boolean' ? 'false' : '' });
    return r;
  });
  const [abilities, setAbilities] = useState<Ability[]>(card?.abilities ?? []);
  const [err, setErr] = useState('');

  const submit = () => {
    const n = Number(count);
    if (!name.trim()) return setErr('Name is required');
    if (!Number.isInteger(n) || n < 1) return setErr('Instance count must be at least 1');
    const { md, err: e } = fromRows(rows.filter((r) => r.value.trim() !== '' || r.type === 'boolean'));
    if (e) return setErr(e);
    const c: CardDef = { id: card?.id ?? newId(), name: name.trim(), count: n, metadata: md };
    if (description.trim()) c.description = description.trim();
    if (front) c.frontImageId = front;
    if (back) c.backImageId = back;
    const ab = abilities.filter((a) => a.trigger || a.effect);
    if (ab.length) c.abilities = ab;
    onSave(c);
  };

  return (
    <Sheet title={card ? `Edit ${card.name}` : 'New card'} onClose={onClose}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <label htmlFor="cname">Name</label>
          <input id="cname" value={name} maxLength={100} autoFocus onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ width: 100 }}>
          <label htmlFor="ccount">Copies</label>
          <input id="ccount" type="number" min={1} max={500} value={count} onChange={(e) => setCount(e.target.value)} />
        </div>
      </div>
      <label htmlFor="cdesc">Description</label>
      <textarea id="cdesc" value={description} onChange={(e) => setDescription(e.target.value)} />
      <label>Front artwork</label>
      <ImagePicker value={front} onChange={setFront} label="front" />
      {!front && (
        <div className="row small-text muted" style={{ marginTop: 4 }}>
          No artwork: a text face is generated.
          <div className="card" style={{ ['--card-w' as any]: '50px' }}>
            <TextFace def={{ name: name || 'Card', metadata: fromRows(rows).md }} />
          </div>
        </div>
      )}
      <label>Back artwork (optional, overrides the deck back)</label>
      <ImagePicker value={back} onChange={setBack} label="back" />
      <label>Properties</label>
      {rows.map((r, i) => (
        <div key={i} className="row" style={{ marginBottom: 6 }} data-testid="meta-row">
          <input aria-label="Property name" placeholder="name" value={r.key} style={{ flex: 1 }} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
          <select aria-label="Property type" value={r.type} style={{ width: 'auto' }} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, type: e.target.value as MetaType } : x)))}>
            <option value="text">text</option>
            <option value="number">number</option>
            <option value="boolean">yes/no</option>
            <option value="list">list</option>
          </select>
          {r.type === 'boolean' ? (
            <select aria-label="Property value" value={r.value} style={{ flex: 1 }} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}>
              <option value="true">yes</option>
              <option value="false">no</option>
            </select>
          ) : (
            <input aria-label="Property value" placeholder={r.type === 'list' ? 'a, b, c' : 'value'} value={r.value} style={{ flex: 1 }} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
          )}
          <button className="ghost small" aria-label="Remove property" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button className="small" onClick={() => setRows([...rows, { key: '', type: 'text', value: '' }])}>
        + Property
      </button>
      <label>Abilities (descriptive only)</label>
      {abilities.map((a, i) => (
        <div key={i} className="row wrap" style={{ marginBottom: 6 }} data-testid="ability-row">
          {(['trigger', 'effect', 'value', 'target'] as const).map((k) => (
            <input
              key={k}
              aria-label={`Ability ${k}`}
              placeholder={k === 'trigger' ? 'On Play' : k === 'effect' ? 'Draw Card' : k === 'value' ? '2' : 'Self'}
              value={a[k] === undefined ? '' : String(a[k])}
              style={{ flex: 1, minWidth: 80 }}
              onChange={(e) =>
                setAbilities(
                  abilities.map((x, j) => {
                    if (j !== i) return x;
                    if (k === 'value') {
                      const v = e.target.value;
                      return { ...x, value: v === '' ? undefined : Number.isFinite(Number(v)) ? Number(v) : v };
                    }
                    return { ...x, [k]: e.target.value };
                  }),
                )
              }
            />
          ))}
          <button className="ghost small" aria-label="Remove ability" onClick={() => setAbilities(abilities.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button className="small" onClick={() => setAbilities([...abilities, { trigger: '', effect: '', target: '' }])}>
        + Ability
      </button>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row" style={{ marginTop: 14 }}>
        {card && (
          <button onClick={() => onRemove(card.id)} aria-label="Remove card">
            Remove
          </button>
        )}
        <span className="grow" />
        <button onClick={onClose}>Cancel</button>
        <button className="primary" onClick={submit}>
          Done
        </button>
      </div>
    </Sheet>
  );
}
