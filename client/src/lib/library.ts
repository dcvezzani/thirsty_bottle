import type { CardDef, DeckContent, LibraryImage, MetaType } from '@vct/shared';
import { api } from './api';
import { fromRows, prefill, type CardPins } from './cardPins';

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const UPLOAD_RULES = 'Use PNG, JPEG or WebP images up to 10 MB';

/** The library; `exceptDeck` leaves that deck out of the use counts (an editor adds its live counts). */
export const fetchLibrary = (exceptDeck?: string) => api<LibraryImage[]>('GET', `/api/library/images${exceptDeck ? `?exceptDeck=${encodeURIComponent(exceptDeck)}` : ''}`);

/** The deck open in the editor: its id and live (possibly unsaved) content. */
export type LibraryDeck = { id: string; content: Pick<DeckContent, 'cards' | 'backImageId'> };

/** How one deck's content uses each image (a card using an image twice counts once). */
export function deckUsage(c: LibraryDeck['content']): Map<string, LibraryImage['uses']> {
  const m = new Map<string, LibraryImage['uses']>();
  const get = (id: string) => m.get(id) ?? (m.set(id, { cards: 0, deckBacks: 0, decks: 1 }), m.get(id)!);
  for (const card of c.cards) for (const id of new Set([card.frontImageId, card.backImageId].filter(Boolean) as string[])) get(id).cards++;
  if (c.backImageId) get(c.backImageId).deckBacks++;
  return m;
}

/** Server counts (without the open deck) plus the open deck's live counts. */
export function withDeckUsage(images: LibraryImage[], deck?: LibraryDeck): LibraryImage[] {
  if (!deck) return images;
  const local = deckUsage(deck.content);
  return images.map((i) => {
    const l = local.get(i.id);
    return l ? { ...i, uses: { cards: i.uses.cards + l.cards, deckBacks: i.uses.deckBacks + l.deckBacks, decks: i.uses.decks + 1 } } : i;
  });
}
export const renameImage = (id: string, name: string) => api('PATCH', `/api/library/images/${id}`, { name });
export const deleteImage = (id: string) => api('DELETE', `/api/library/images/${id}`);

/** Client-side check before uploading (the server checks again). */
export function checkImageFile(f: File): string | null {
  if (!IMAGE_TYPES.includes(f.type) || f.size > MAX_IMAGE_BYTES) return UPLOAD_RULES;
  return null;
}

/** Uploads one image; it joins the library named after the file. */
export async function uploadImage(f: File): Promise<{ id: string }> {
  const fd = new FormData();
  fd.append('file', f, f.name);
  return api('POST', '/api/images', fd);
}

export type ImportResult = { ok: string[]; failed: { name: string; error: string }[] };

/** Imports files a few at a time. A failed file is reported and the rest still import. */
export async function importFiles(files: File[], onProgress: (done: number, total: number) => void, upload = uploadImage, concurrency = 2): Promise<ImportResult> {
  const res: ImportResult = { ok: [], failed: [] };
  let next = 0;
  let done = 0;
  onProgress(0, files.length);
  const worker = async () => {
    while (next < files.length) {
      const f = files[next++];
      const bad = checkImageFile(f);
      if (bad) res.failed.push({ name: f.name, error: bad });
      else {
        try {
          res.ok.push((await upload(f)).id);
        } catch (e: any) {
          res.failed.push({ name: f.name, error: e?.message ?? 'Upload failed' });
        }
      }
      onProgress(++done, files.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  return res;
}

/** Image ids a deck's content uses (card fronts and backs, deck back). */
export function deckImageIds(c: Pick<DeckContent, 'cards' | 'backImageId'>): Set<string> {
  const ids = new Set<string>();
  for (const card of c.cards) {
    if (card.frontImageId) ids.add(card.frontImageId);
    if (card.backImageId) ids.add(card.backImageId);
  }
  if (c.backImageId) ids.add(c.backImageId);
  return ids;
}

/**
 * One card per image: named after the image, with it as the front. Other fields come from the deck's
 * pinned new-card values (card-form-remember); otherwise copies 1 and the property template.
 */
export function cardsFromImages(images: { id: string; name: string }[], pins: CardPins, template: { key: string; type: MetaType }[], newId: () => string): CardDef[] {
  const p = prefill(pins, template);
  const n = Number(p.count);
  const count = Number.isInteger(n) && n >= 1 && n <= 500 ? n : 1;
  const rows = p.rows.filter((r) => r.type === 'boolean' || (r.value.trim() !== '' && (r.type !== 'number' || Number.isFinite(Number(r.value)))));
  const metadata = fromRows(rows).md;
  const abilities = p.abilities.filter((a) => a.trigger || a.effect);
  return images.map((img) => {
    const c: CardDef = { id: newId(), name: img.name.slice(0, 100), count, metadata: structuredClone(metadata), frontImageId: img.id };
    if (p.description.trim()) c.description = p.description.trim();
    if (p.back) c.backImageId = p.back;
    if (abilities.length) c.abilities = structuredClone(abilities);
    return c;
  });
}

/** "3 cards · 1 deck back" or "Unused". */
export function usageText(u: LibraryImage['uses']): string {
  const parts = [u.cards && `${u.cards} card${u.cards === 1 ? '' : 's'}`, u.deckBacks && `${u.deckBacks} deck back${u.deckBacks === 1 ? '' : 's'}`].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Unused';
}
