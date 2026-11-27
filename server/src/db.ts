import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export type DB = Database.Database;

/** Numbered migrations, applied in order at startup. Never edit an applied migration; add a new one. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE players (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    muted TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
  );

  CREATE TABLE images (
    id TEXT PRIMARY KEY,
    owner_id TEXT,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    bytes INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE decks (
    id TEXT PRIMARY KEY,
    owner_id TEXT,
    built_in INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    archived_at INTEGER,
    visibility TEXT NOT NULL DEFAULT 'private',
    share_token TEXT UNIQUE,
    cloned_from_deck_id TEXT,
    cloned_from_label TEXT,
    current_version_id TEXT NOT NULL,
    clone_count INTEGER NOT NULL DEFAULT 0,
    hidden INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX decks_owner ON decks(owner_id, status);
  CREATE INDEX decks_gallery ON decks(visibility, status, hidden);

  CREATE TABLE deck_versions (
    id TEXT PRIMARY KEY,
    deck_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX deck_versions_deck ON deck_versions(deck_id);

  CREATE TABLE deck_drafts (
    deck_id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE deck_reports (
    deck_id TEXT NOT NULL,
    reporter_id TEXT NOT NULL,
    reason TEXT,
    at INTEGER NOT NULL,
    PRIMARY KEY (deck_id, reporter_id)
  );

  CREATE VIRTUAL TABLE decks_fts USING fts5(deck_id UNINDEXED, name, owner_name, tokenize = 'unicode61');

  CREATE TABLE game_tables (
    id TEXT PRIMARY KEY,
    state TEXT NOT NULL,
    undo TEXT,
    version INTEGER NOT NULL,
    password_hash TEXT,
    room_muted TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL,
    closed_at INTEGER,
    empty_since INTEGER
  );

  CREATE TABLE table_actions (
    table_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    actor TEXT,
    action TEXT NOT NULL,
    ctx TEXT NOT NULL,
    PRIMARY KEY (table_id, version)
  );

  CREATE TABLE table_decks (
    table_id TEXT NOT NULL,
    table_deck_id TEXT NOT NULL,
    source_deck_id TEXT,
    version_id TEXT,
    content TEXT NOT NULL,
    PRIMARY KEY (table_id, table_deck_id)
  );
  CREATE INDEX table_decks_source ON table_decks(source_deck_id);

  CREATE TABLE chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,
    at INTEGER NOT NULL,
    player_id TEXT,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    text TEXT NOT NULL
  );
  CREATE INDEX chat_channel ON chat_messages(channel, id);
  `,
  // 2: table setups (table-setups), mirroring decks
  `
  CREATE TABLE setups (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    archived_at INTEGER,
    cloned_from_setup_id TEXT,
    current_version_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX setups_owner ON setups(owner_id, status);

  CREATE TABLE setup_versions (
    id TEXT PRIMARY KEY,
    setup_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX setup_versions_setup ON setup_versions(setup_id);

  CREATE TABLE setup_drafts (
    setup_id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  `,
  // 3: setup sharing (setup-sharing), mirroring the deck library
  `
  ALTER TABLE setups ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
  ALTER TABLE setups ADD COLUMN share_token TEXT;
  ALTER TABLE setups ADD COLUMN built_in INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE setups ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE setups ADD COLUMN clone_count INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE setups ADD COLUMN cloned_from_label TEXT;
  CREATE UNIQUE INDEX setups_share ON setups(share_token);
  CREATE INDEX setups_gallery ON setups(visibility, status, hidden);

  CREATE VIRTUAL TABLE setups_fts USING fts5(setup_id UNINDEXED, name, owner_name, tokenize = 'unicode61');

  CREATE TABLE setup_reports (
    setup_id TEXT NOT NULL,
    reporter_id TEXT NOT NULL,
    reason TEXT,
    at INTEGER NOT NULL,
    PRIMARY KEY (setup_id, reporter_id)
  );
  `,
  // 4: per-player image library (image-library); backfilled by POST_MIGRATION[4]
  `
  CREATE TABLE library_images (
    player_id TEXT NOT NULL,
    image_id TEXT NOT NULL,
    name TEXT NOT NULL,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, image_id)
  );
  CREATE INDEX library_images_image ON library_images(image_id);
  `,
  // 5: async-turns
  `
  -- async-turns: when a table last had an action, to close an idle turn-based table
  ALTER TABLE game_tables ADD COLUMN last_action_at INTEGER;
  UPDATE game_tables SET last_action_at = CAST(strftime('%s','now') AS INTEGER) * 1000;
  `,
  // 6: pass-and-play guests (a guest belongs to a host and to one table)
  `
  ALTER TABLE players ADD COLUMN guest_of TEXT;
  ALTER TABLE players ADD COLUMN guest_table TEXT;
  CREATE INDEX players_guest_table ON players(guest_table);
  `,
];

/** Image ids a deck's content uses, each with a readable name: "<card> (front)", "<card> (back)" or "Deck back". */
export function namedImagesOf(content: { backImageId?: string; cards?: { name?: string; frontImageId?: string; backImageId?: string }[] }) {
  const out: { id: string; name: string }[] = [];
  for (const c of content.cards ?? []) {
    if (c.frontImageId) out.push({ id: c.frontImageId, name: `${c.name ?? 'Card'} (front)`.slice(0, 100) });
    if (c.backImageId) out.push({ id: c.backImageId, name: `${c.name ?? 'Card'} (back)`.slice(0, 100) });
  }
  if (content.backImageId) out.push({ id: content.backImageId, name: 'Deck back' });
  return out;
}

/** Adds the images a deck's content uses to a player's library (first name wins; existing entries are kept). */
export function addContentToLibrary(db: DB, playerId: string, content: Parameters<typeof namedImagesOf>[0], at = Date.now()) {
  const ins = db.prepare('INSERT INTO library_images (player_id, image_id, name, added_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING');
  for (const { id, name } of namedImagesOf(content)) ins.run(playerId, id, name, at);
}

/** Data steps that run once, right after the numbered migration of the same version. Must be idempotent. */
const POST_MIGRATION: Record<number, (db: DB) => void> = {
  4: (db) => {
    const decks = db.prepare(
      `SELECT d.owner_id AS owner, v.content AS cur, dr.content AS draft FROM decks d
       JOIN deck_versions v ON v.id = d.current_version_id
       LEFT JOIN deck_drafts dr ON dr.deck_id = d.id
       WHERE d.owner_id IS NOT NULL AND d.built_in = 0 ORDER BY d.created_at`,
    ).all() as { owner: string; cur: string; draft: string | null }[];
    for (const d of decks) for (const json of [d.cur, d.draft]) if (json) addContentToLibrary(db, d.owner, JSON.parse(json));
    db.prepare(
      `INSERT INTO library_images (player_id, image_id, name, added_at)
       SELECT owner_id, id, 'Image', created_at FROM images WHERE owner_id IS NOT NULL ON CONFLICT DO NOTHING`,
    ).run();
  },
};

export function openDb(dataDir: string): DB {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, 'cardtable.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

/** Applies pending migrations, optionally only up to `target` (tests use this to build older databases). */
export function migrate(db: DB, target = MIGRATIONS.length) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)');
  const done = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version),
  );
  MIGRATIONS.forEach((sql, i) => {
    const v = i + 1;
    if (done.has(v) || v > target) return;
    db.transaction(() => {
      db.exec(sql);
      POST_MIGRATION[v]?.(db);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(v, Date.now());
    })();
  });
}
