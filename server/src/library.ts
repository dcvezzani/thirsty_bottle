import type { FastifyInstance } from 'fastify';
import { RenameLibraryImage, type LibraryImage } from '@vct/shared';
import type { App } from './app.js';
import { HttpError } from './util.js';
import { addContentToLibrary } from './db.js';

type Uses = LibraryImage['uses'];

/** A player's private image library: membership + names over the content-addressed image store. */
export class Library {
  constructor(private app: App) {}

  /** Adds an image to a player's library. Re-adding keeps the existing entry and name. */
  add(playerId: string, imageId: string, name: string) {
    this.app.db
      .prepare('INSERT INTO library_images (player_id, image_id, name, added_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING')
      .run(playerId, imageId, name, Date.now());
  }

  /** Adds every image a deck's content uses (deck import, clone of own work), named after its cards. */
  addContent(playerId: string, content: Parameters<typeof addContentToLibrary>[2]) {
    addContentToLibrary(this.app.db, playerId, content);
  }

  holds(playerId: string, imageId: string) {
    return !!this.app.db.prepare('SELECT 1 FROM library_images WHERE player_id = ? AND image_id = ?').get(playerId, imageId);
  }

  /** How the player's own decks use each image: the unsaved draft when there is one, else the current version. */
  usage(playerId: string, exceptDeckId = ''): Map<string, Uses> {
    const rows = this.app.db
      .prepare(
        `SELECT d.id, COALESCE(dr.content, v.content) AS content FROM decks d
         JOIN deck_versions v ON v.id = d.current_version_id
         LEFT JOIN deck_drafts dr ON dr.deck_id = d.id
         WHERE d.owner_id = ? AND d.id != ?`,
      )
      .all(playerId, exceptDeckId) as { id: string; content: string }[];
    const map = new Map<string, Uses>();
    const get = (id: string) => {
      let u = map.get(id);
      if (!u) map.set(id, (u = { cards: 0, deckBacks: 0, decks: 0 }));
      return u;
    };
    for (const r of rows) {
      const c = JSON.parse(r.content) as { backImageId?: string; cards?: { frontImageId?: string; backImageId?: string }[] };
      const inDeck = new Set<string>();
      for (const card of c.cards ?? []) {
        const ids = new Set([card.frontImageId, card.backImageId].filter(Boolean) as string[]);
        for (const id of ids) {
          get(id).cards++;
          inDeck.add(id);
        }
      }
      if (c.backImageId) {
        get(c.backImageId).deckBacks++;
        inDeck.add(c.backImageId);
      }
      for (const id of inDeck) get(id).decks++;
    }
    return map;
  }

  /** `exceptDeckId` leaves out one deck, so an editor can add its own live counts. */
  list(playerId: string, exceptDeckId?: string): LibraryImage[] {
    const usage = this.usage(playerId, exceptDeckId);
    const rows = this.app.db
      .prepare('SELECT image_id AS id, name, added_at AS addedAt FROM library_images WHERE player_id = ? ORDER BY added_at DESC, name')
      .all(playerId) as { id: string; name: string; addedAt: number }[];
    return rows
      .filter((r) => this.app.images.exists(r.id))
      .map((r) => ({ ...r, uses: usage.get(r.id) ?? { cards: 0, deckBacks: 0, decks: 0 } }));
  }

  rename(playerId: string, imageId: string, name: string) {
    const r = this.app.db.prepare('UPDATE library_images SET name = ? WHERE player_id = ? AND image_id = ?').run(name, playerId, imageId);
    if (!r.changes) throw new HttpError(404, 'NOT_FOUND', 'Image not found in your library');
  }

  /** Removes an image the player's decks no longer use. The file stays while anything else still references it. */
  remove(playerId: string, imageId: string) {
    if (!this.holds(playerId, imageId)) throw new HttpError(404, 'NOT_FOUND', 'Image not found in your library');
    const u = this.usage(playerId).get(imageId);
    if (u && (u.cards || u.deckBacks)) {
      const parts = [u.cards && `${u.cards} card${u.cards === 1 ? '' : 's'}`, u.deckBacks && `${u.deckBacks} deck back${u.deckBacks === 1 ? '' : 's'}`].filter(Boolean);
      throw new HttpError(409, 'IN_USE', `Used by ${parts.join(' and ')} in ${u.decks} deck${u.decks === 1 ? '' : 's'}`);
    }
    this.app.db.prepare('DELETE FROM library_images WHERE player_id = ? AND image_id = ?').run(playerId, imageId);
    // Drop first-uploader ownership too, so the file can be collected once nothing references it.
    this.app.db.prepare('UPDATE images SET owner_id = NULL WHERE id = ? AND owner_id = ?').run(imageId, playerId);
    this.app.images.gc(0, imageId);
  }

  async routes(http: FastifyInstance) {
    const auth = (req: any) => this.app.auth(req)!;
    http.get('/api/library/images', async (req) => this.list(auth(req).id, String((req.query as any).exceptDeck ?? '') || undefined));
    http.patch('/api/library/images/:id', async (req) => {
      const me = auth(req);
      const p = RenameLibraryImage.safeParse(req.body);
      if (!p.success) throw new HttpError(400, 'BAD_NAME', 'Use a name of 1 to 100 characters');
      this.rename(me.id, (req.params as any).id, p.data.name);
      return { ok: true };
    });
    http.delete('/api/library/images/:id', async (req) => {
      this.remove(auth(req).id, (req.params as any).id);
      return { ok: true };
    });
  }
}
