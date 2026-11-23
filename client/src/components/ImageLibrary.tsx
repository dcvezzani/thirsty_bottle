import { useEffect, useMemo, useState } from 'react';
import type { LibraryImage } from '@vct/shared';
import { imageUrl } from '../lib/api';
import { deckImageIds, deleteImage, fetchLibrary, importFiles, renameImage, usageText, withDeckUsage, type ImportResult, type LibraryDeck } from '../lib/library';
import { Sheet } from './ui';

/** Picks several image files at once and imports them into the library, a few at a time. */
export function ImportImages({ onDone }: { onDone: (r: ImportResult) => void }) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const run = async (files: File[]) => {
    if (!files.length) return;
    setResult(null);
    const r = await importFiles(files, (done, total) => setProgress({ done, total }));
    setProgress(null);
    setResult(r);
    onDone(r);
  };
  return (
    <div>
      <label className="pill" style={{ cursor: progress ? 'default' : 'pointer', padding: '8px 12px', margin: 0, display: 'inline-block' }}>
        + Import images…
        <input
          type="file"
          multiple
          aria-label="Import images"
          accept="image/png,image/jpeg,image/webp"
          disabled={!!progress}
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            run(files);
          }}
        />
      </label>
      {progress && (
        <p className="small-text" role="status">
          Importing {progress.done} of {progress.total}…
        </p>
      )}
      {result && (
        <div className="small-text" role="status" data-testid="import-result">
          {result.ok.length > 0 && <p style={{ margin: '6px 0' }}>Imported {result.ok.length} image{result.ok.length === 1 ? '' : 's'}.</p>}
          {result.failed.length > 0 && (
            <ul className="err" role="alert" style={{ margin: '6px 0', paddingLeft: 18 }}>
              {result.failed.map((f, i) => (
                <li key={i}>
                  {f.name}: {f.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Rename, see where it is used, or delete one library image. */
function ImageDetail({ img, onClose, onChanged }: { img: LibraryImage; onClose: () => void; onChanged: () => void }) {
  const [name, setName] = useState(img.name);
  const [err, setErr] = useState('');
  const used = img.uses.cards + img.uses.deckBacks > 0;
  return (
    <Sheet title={img.name} label="Image details" onClose={onClose}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="card" style={{ ['--card-w' as any]: '120px' }}>
          <img className="card-img" src={imageUrl(img.id, true)} alt={img.name} />
        </div>
        <div className="grow">
          <label htmlFor="imgname">Name</label>
          <input id="imgname" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
          <p className="small-text muted">{used ? `Used by ${usageText(img.uses)} in ${img.uses.decks} deck${img.uses.decks === 1 ? '' : 's'}` : 'Not used by any of your decks'}</p>
        </div>
      </div>
      {err && (
        <p className="err" role="alert">
          {err}
        </p>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button
          disabled={used}
          title={used ? 'Remove it from your cards first' : undefined}
          onClick={async () => {
            try {
              await deleteImage(img.id);
              onChanged();
              onClose();
            } catch (e: any) {
              setErr(e.message);
            }
          }}
        >
          Delete
        </button>
        <span className="grow" />
        <button onClick={onClose}>Cancel</button>
        <button
          className="primary"
          disabled={!name.trim() || name.trim() === img.name}
          onClick={async () => {
            try {
              await renameImage(img.id, name.trim());
              onChanged();
              onClose();
            } catch (e: any) {
              setErr(e.message);
            }
          }}
        >
          Save
        </button>
      </div>
    </Sheet>
  );
}

/**
 * The player's image library: import, search, and either manage (rename/delete), pick one,
 * or select several to create cards. `deck` (the open deck, live) adds a "This deck" view and exact use counts.
 */
export function ImageLibrary({
  mode,
  deck,
  defaultView = 'deck',
  onPick,
  onCreateCards,
}: {
  mode: 'manage' | 'pick';
  deck?: LibraryDeck;
  defaultView?: 'deck' | 'all';
  onPick?: (img: LibraryImage) => void;
  onCreateCards?: (imgs: LibraryImage[]) => void;
}) {
  const [fetched, setImages] = useState<LibraryImage[] | null>(null);
  const deckIds = useMemo(() => (deck ? deckImageIds(deck.content) : undefined), [deck]);
  const images = useMemo(() => (fetched ? withDeckUsage(fetched, deck) : null), [fetched, deck]);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'deck' | 'all'>(deckIds ? defaultView : 'all');
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [detail, setDetail] = useState<LibraryImage | null>(null);

  const load = () =>
    fetchLibrary(deck?.id)
      .then(setImages)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (images ?? []).filter((i) => (view === 'all' || !deckIds || deckIds.has(i.id)) && (!needle || i.name.toLowerCase().includes(needle)));
  }, [images, q, view, deckIds]);

  const tap = (img: LibraryImage) => {
    if (selecting) setPicked((p) => (p.includes(img.id) ? p.filter((x) => x !== img.id) : [...p, img.id]));
    else if (mode === 'pick') onPick?.(img);
    else setDetail(img);
  };

  return (
    <div className="image-library">
      <div className="row wrap" style={{ marginBottom: 8 }}>
        <ImportImages onDone={() => load()} />
        <span className="grow" />
        {onCreateCards && !selecting && (
          <button className="small" disabled={!images?.length} onClick={() => setSelecting(true)}>
            Create cards…
          </button>
        )}
      </div>
      {deckIds && (
        <div className="row" role="group" aria-label="Which images" style={{ gap: 6, marginBottom: 6 }}>
          {(['deck', 'all'] as const).map((v) => (
            <button key={v} className={`small${view === v ? ' primary' : ''}`} aria-pressed={view === v} onClick={() => setView(v)}>
              {v === 'deck' ? 'This deck' : 'All'}
            </button>
          ))}
        </div>
      )}
      <input aria-label="Search images" placeholder="Search images" value={q} onChange={(e) => setQ(e.target.value)} />
      {selecting && (
        <div className="row wrap card-tile" style={{ marginTop: 8 }} aria-label="Create cards from images">
          <span className="grow small-text">Tap images in the order you want the cards. Selected: {picked.length}</span>
          <button
            className="small"
            onClick={() => {
              setSelecting(false);
              setPicked([]);
            }}
          >
            Cancel
          </button>
          <button
            className="small primary"
            disabled={!picked.length}
            onClick={() => {
              const byId = new Map((images ?? []).map((i) => [i.id, i]));
              onCreateCards?.(picked.map((id) => byId.get(id)!).filter(Boolean));
              setSelecting(false);
              setPicked([]);
              load();
            }}
          >
            Create {picked.length} card{picked.length === 1 ? '' : 's'}
          </button>
        </div>
      )}
      {err && (
        <p className="err" role="alert">
          {err}
        </p>
      )}
      {images === null ? (
        <p className="muted small-text">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="empty small-text">{images.length === 0 ? 'No images yet. Import some to get started.' : view === 'deck' && !q ? 'This deck uses none of your images yet.' : 'No images match.'}</p>
      ) : (
        <ul className="img-grid" aria-label="Images">
          {shown.map((img) => {
            const order = picked.indexOf(img.id);
            return (
              <li key={img.id}>
                <button
                  className={`img-tile${order >= 0 ? ' picked' : ''}`}
                  aria-label={selecting ? `Select ${img.name}` : mode === 'pick' ? `Use ${img.name}` : img.name}
                  aria-pressed={selecting ? order >= 0 : undefined}
                  onClick={() => tap(img)}
                >
                  <span className="card" style={{ ['--card-w' as any]: '100%' }}>
                    <img className="card-img" src={imageUrl(img.id, true)} alt="" loading="lazy" />
                    {order >= 0 && <span className="img-order">{order + 1}</span>}
                  </span>
                  <span className="img-name">{img.name}</span>
                  <span className="img-use small-text muted">{usageText(img.uses)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {detail && <ImageDetail img={detail} onClose={() => setDetail(null)} onChanged={load} />}
    </div>
  );
}
