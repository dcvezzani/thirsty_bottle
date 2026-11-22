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
];

export function openDb(dataDir: string): DB {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, 'cardtable.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

export function migrate(db: DB) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)');
  const done = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version),
  );
  MIGRATIONS.forEach((sql, i) => {
    const v = i + 1;
    if (done.has(v)) return;
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(v, Date.now());
    })();
  });
}
