import crypto from 'node:crypto';
import type { DB } from './db.js';
import { randomId, sha256 } from './util.js';

export interface Player {
  id: string;
  name: string;
  color: string;
  muted: string[];
  /** pass-and-play: set for a guest on a host's phone. */
  guestOf?: string;
  guestTable?: string;
}

export class Players {
  private cache = new Map<string, Player>();
  constructor(private db: DB) {}

  create(name: string, color: string): { token: string; player: Player } {
    const token = crypto.randomBytes(32).toString('base64url'); // 256-bit
    const id = 'p_' + randomId(9);
    const now = Date.now();
    this.db
      .prepare('INSERT INTO players (id, token_hash, name, color, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, sha256(token), name, color, now, now);
    const player = { id, name, color, muted: [] };
    this.cache.set(id, player);
    return { token, player };
  }

  /** pass-and-play: a guest belongs to one host and one table, and is deleted with them. */
  createGuest(name: string, color: string, guestOf: string, guestTable: string): { token: string; player: Player } {
    const { token, player } = this.create(name, color);
    this.db.prepare('UPDATE players SET guest_of = ?, guest_table = ? WHERE id = ?').run(guestOf, guestTable, player.id);
    player.guestOf = guestOf;
    player.guestTable = guestTable;
    return { token, player };
  }

  guestsOfTable(tableId: string): string[] {
    return (this.db.prepare('SELECT id FROM players WHERE guest_table = ?').all(tableId) as { id: string }[]).map((r) => r.id);
  }

  deleteGuest(id: string) {
    this.db.prepare('DELETE FROM players WHERE id = ? AND guest_table IS NOT NULL').run(id);
    this.cache.delete(id);
  }

  /** Guests whose table is closed or gone (after a restart, or a crash during close). */
  purgeOrphanGuests() {
    const rows = this.db
      .prepare('SELECT id FROM players WHERE guest_table IS NOT NULL AND guest_table NOT IN (SELECT id FROM game_tables WHERE closed_at IS NULL)')
      .all() as { id: string }[];
    for (const r of rows) this.deleteGuest(r.id);
  }

  byToken(token: string | undefined | null): Player | null {
    if (!token) return null;
    const row = this.db.prepare('SELECT * FROM players WHERE token_hash = ?').get(sha256(token)) as any;
    if (!row) return null;
    return this.fromRow(row);
  }

  get(id: string): Player | null {
    const c = this.cache.get(id);
    if (c) return c;
    const row = this.db.prepare('SELECT * FROM players WHERE id = ?').get(id) as any;
    return row ? this.fromRow(row) : null;
  }

  private fromRow(row: any): Player {
    const p: Player = { id: row.id, name: row.name, color: row.color, muted: JSON.parse(row.muted), ...(row.guest_table ? { guestOf: row.guest_of, guestTable: row.guest_table } : {}) };
    this.cache.set(p.id, p);
    return p;
  }

  update(id: string, name: string, color: string) {
    this.db.prepare('UPDATE players SET name = ?, color = ? WHERE id = ?').run(name, color, id);
    const p = this.get(id);
    if (p) {
      p.name = name;
      p.color = color;
    }
  }

  setMuted(id: string, muted: string[]) {
    this.db.prepare('UPDATE players SET muted = ? WHERE id = ?').run(JSON.stringify(muted), id);
    const p = this.get(id);
    if (p) p.muted = muted;
  }

  touch(id: string) {
    this.db.prepare('UPDATE players SET last_seen = ? WHERE id = ?').run(Date.now(), id);
  }
}
