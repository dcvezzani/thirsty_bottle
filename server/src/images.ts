import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { App } from './app.js';
import { HttpError, sha256 } from './util.js';

export const CARD_W = 750;
export const CARD_H = 1050;
export const THUMB_W = 250;
export const THUMB_H = 350;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(['png', 'jpeg', 'webp']);
export const UPLOAD_RULES = 'PNG, JPEG or WebP images up to 10 MB';

export class Images {
  dir: string;
  constructor(private app: App) {
    this.dir = path.join(app.opts.dataDir, 'images');
    fs.mkdirSync(this.dir, { recursive: true });
  }

  file(id: string, thumb = false) {
    return path.join(this.dir, `${id}${thumb ? '.thumb' : ''}.webp`);
  }

  exists(id: string) {
    return fs.existsSync(this.file(id));
  }

  /** Validates, normalizes to a 750×1050 card frame (no distortion) and stores content-addressed. */
  async ingest(input: Buffer, ownerId: string | null): Promise<{ id: string; width: number; height: number }> {
    if (input.byteLength > MAX_UPLOAD_BYTES) throw new HttpError(413, 'TOO_LARGE', `Upload rejected: use ${UPLOAD_RULES}`);
    let meta: sharp.Metadata;
    try {
      meta = await sharp(input).metadata();
    } catch {
      throw new HttpError(400, 'BAD_IMAGE', `Not a readable image: use ${UPLOAD_RULES}`);
    }
    if (!meta.format || !ALLOWED.has(meta.format)) throw new HttpError(415, 'BAD_FORMAT', `Unsupported format: use ${UPLOAD_RULES}`);
    let out: Buffer;
    let thumb: Buffer;
    try {
      const base = sharp(input, { failOn: 'error' }).rotate();
      out = await base
        .clone()
        .resize(CARD_W, CARD_H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 86 })
        .toBuffer();
      thumb = await sharp(out).resize(THUMB_W, THUMB_H).webp({ quality: 80 }).toBuffer();
    } catch {
      throw new HttpError(400, 'BAD_IMAGE', `Could not decode image: use ${UPLOAD_RULES}`);
    }
    const id = sha256(out);
    if (!this.exists(id)) {
      fs.writeFileSync(this.file(id), out);
      fs.writeFileSync(this.file(id, true), thumb);
    }
    this.app.db
      .prepare('INSERT OR IGNORE INTO images (id, owner_id, width, height, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, ownerId, CARD_W, CARD_H, out.byteLength, Date.now());
    return { id, width: CARD_W, height: CARD_H };
  }

  /** Every image id referenced by any deck version, draft or table snapshot. */
  referenced(): Set<string> {
    const ids = new Set<string>();
    const scan = (json: string) => {
      for (const m of json.matchAll(/"(?:frontImageId|backImageId)":"([a-f0-9]{64})"/g)) ids.add(m[1]);
    };
    for (const r of this.app.db.prepare('SELECT content FROM deck_versions').iterate() as Iterable<any>) scan(r.content);
    for (const r of this.app.db.prepare('SELECT content FROM deck_drafts').iterate() as Iterable<any>) scan(r.content);
    for (const r of this.app.db.prepare('SELECT content FROM table_decks').iterate() as Iterable<any>) scan(r.content);
    return ids;
  }

  /** Removes image files nothing references any more (uploads younger than `graceMs` are kept). */
  gc(graceMs = 3600_000): number {
    const keep = this.referenced();
    const rows = this.app.db.prepare('SELECT id, created_at FROM images').all() as { id: string; created_at: number }[];
    let removed = 0;
    for (const r of rows) {
      if (keep.has(r.id) || Date.now() - r.created_at < graceMs) continue;
      fs.rmSync(this.file(r.id), { force: true });
      fs.rmSync(this.file(r.id, true), { force: true });
      this.app.db.prepare('DELETE FROM images WHERE id = ?').run(r.id);
      removed++;
    }
    return removed;
  }

  /** Can this player fetch the image? Uploader, or it belongs to a deck they can view or a table they are at. */
  canFetch(id: string, playerId: string | null, shareToken?: string): boolean {
    const row = this.app.db.prepare('SELECT owner_id FROM images WHERE id = ?').get(id) as any;
    if (row && playerId && row.owner_id === playerId) return true;
    const needle = `%${id}%`;
    if (playerId) {
      const tid = this.app.playerTables.get(playerId);
      if (tid && this.app.db.prepare('SELECT 1 FROM table_decks WHERE table_id = ? AND content LIKE ?').get(tid, needle)) return true;
    }
    const decks = this.app.db
      .prepare(
        `SELECT DISTINCT d.id FROM decks d
         LEFT JOIN deck_versions v ON v.id = d.current_version_id
         LEFT JOIN deck_drafts dr ON dr.deck_id = d.id
         WHERE v.content LIKE ? OR (dr.content LIKE ? AND d.owner_id = ?)`,
      )
      .all(needle, needle, playerId ?? '') as { id: string }[];
    return decks.some((d) => this.app.decks.canView(d.id, playerId, shareToken) !== null);
  }
}
