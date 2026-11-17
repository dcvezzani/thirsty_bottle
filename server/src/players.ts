import crypto from 'node:crypto';
import type { DB } from './db.js';
import { randomId, sha256 } from './util.js';

export interface Player {
  id: string;
  name: string;
  color: string;
  muted: string[];
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
    const p = { id: row.id, name: row.name, color: row.color, muted: JSON.parse(row.muted) };
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
