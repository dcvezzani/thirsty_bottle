import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ActionError, blankSetup, checkSetup, expandSetup, recordSetup, SetupContentSchema, totalInstances, type SetupContent, type SetupDetail, type SetupSummary, type TableDeck } from '@vct/shared';
import type { TableSession } from './tables.js';
import type { App } from './app.js';
import { HttpError, randomId } from './util.js';

/** table-setups: a private library of table setups with the deck library's lifecycle (D5). */
export interface SetupRow {
  id: string;
  owner_id: string;
  name: string;
  status: 'active' | 'archived';
  archived_at: number | null;
  cloned_from_setup_id: string | null;
  current_version_id: string;
  created_at: number;
  updated_at: number;
}

const notFound = () => new HttpError(404, 'NO_SETUP', 'Setup not found');

/** Parses setup content and runs the structural checks; a bad setup is a 400 with a readable message. */
export function parseSetup(raw: unknown, { strict }: { strict: boolean }): SetupContent {
  const r = SetupContentSchema.safeParse(raw);
  if (!r.success) throw new HttpError(400, 'BAD_SETUP', 'That setup is not valid');
  if (strict) {
    const bad = checkSetup(r.data);
    if (bad) throw new HttpError(400, 'BAD_SETUP', bad);
  }
  return r.data;
}

export class Setups {
  constructor(private app: App) {}

  private get db() {
    return this.app.db;
  }

  row(id: string): SetupRow | undefined {
    return this.db.prepare('SELECT * FROM setups WHERE id = ?').get(id) as SetupRow | undefined;
  }

  versionContent(versionId: string): SetupContent {
    const r = this.db.prepare('SELECT content FROM setup_versions WHERE id = ?').get(versionId) as { content: string };
    return JSON.parse(r.content);
  }

  draftContent(id: string): SetupContent | null {
    const r = this.db.prepare('SELECT content FROM setup_drafts WHERE setup_id = ?').get(id) as { content: string } | undefined;
    return r ? JSON.parse(r.content) : null;
  }

  /** Owner-only in this change (setup-sharing adds other access). */
  owned(id: string, playerId: string): SetupRow {
    const r = this.row(id);
    if (!r || r.owner_id !== playerId) throw notFound();
    return r;
  }

  private ownedActive(id: string, playerId: string): SetupRow {
    const r = this.owned(id, playerId);
    if (r.status !== 'active') throw new HttpError(409, 'ARCHIVED', 'Restore the setup before editing it');
    return r;
  }

  summary(r: SetupRow, content: SetupContent): SetupSummary {
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      players: content.players,
      zoneCount: content.zones.length,
      slots: content.slots.map((s) => ({ ...s, defaultDeckName: s.defaultDeckId ? (this.app.decks.row(s.defaultDeckId)?.name ?? null) : null })),
      fixed: !!content.fixed,
      currentVersionId: r.current_version_id,
      hasDraft: !!this.db.prepare('SELECT 1 FROM setup_drafts WHERE setup_id = ?').get(r.id),
      updatedAt: r.updated_at,
    };
  }

  detail(id: string, playerId: string): SetupDetail {
    const r = this.owned(id, playerId);
    const content = this.versionContent(r.current_version_id);
    return { ...this.summary(r, content), content, draft: this.draftContent(id) };
  }

  listMine(playerId: string, status: 'active' | 'archived'): SetupSummary[] {
    const rows = this.db.prepare('SELECT * FROM setups WHERE owner_id = ? AND status = ? ORDER BY updated_at DESC').all(playerId, status) as SetupRow[];
    return rows.map((r) => this.summary(r, this.versionContent(r.current_version_id)));
  }

  private writeVersion(id: string, content: SetupContent): string {
    const vid = 'sv_' + randomId(9);
    this.db.prepare('INSERT INTO setup_versions (id, setup_id, content, created_at) VALUES (?, ?, ?, ?)').run(vid, id, JSON.stringify(content), Date.now());
    return vid;
  }

  /** Creates a setup. With `draft`, the saved version is blank-ish and the content opens as a draft. */
  create(ownerId: string, content: SetupContent, opts: { clonedFrom?: string; asDraft?: boolean } = {}): string {
    const id = 'st_' + randomId(9);
    const now = Date.now();
    this.db.transaction(() => {
      const saved = opts.asDraft ? blankSetup(content.name) : content;
      const vid = this.writeVersion(id, saved);
      this.db
        .prepare('INSERT INTO setups (id, owner_id, name, cloned_from_setup_id, current_version_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, ownerId, content.name, opts.clonedFrom ?? null, vid, now, now);
      if (opts.asDraft) this.db.prepare('INSERT INTO setup_drafts (setup_id, content, updated_at) VALUES (?, ?, ?)').run(id, JSON.stringify(content), now);
    })();
    return id;
  }

  writeDraft(id: string, playerId: string, raw: unknown): SetupContent {
    this.ownedActive(id, playerId);
    const content = parseSetup(raw, { strict: false });
    this.db
      .prepare('INSERT INTO setup_drafts (setup_id, content, updated_at) VALUES (?, ?, ?) ON CONFLICT(setup_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at')
      .run(id, JSON.stringify(content), Date.now());
    return content;
  }

  discard(id: string, playerId: string) {
    this.owned(id, playerId);
    this.db.prepare('DELETE FROM setup_drafts WHERE setup_id = ?').run(id);
  }

  save(id: string, playerId: string, raw?: unknown): SetupDetail {
    const r = this.ownedActive(id, playerId);
    const src = raw ?? this.draftContent(id);
    if (!src) throw new HttpError(400, 'NO_CHANGES', 'Nothing to save');
    const content = parseSetup(src, { strict: true });
    this.db.transaction(() => {
      const vid = this.writeVersion(id, content);
      this.db.prepare('UPDATE setups SET current_version_id = ?, name = ?, updated_at = ? WHERE id = ?').run(vid, content.name, Date.now(), r.id);
      this.db.prepare('DELETE FROM setup_drafts WHERE setup_id = ?').run(id);
    })();
    return this.detail(id, playerId);
  }

  archive(id: string, playerId: string, archived: boolean) {
    this.owned(id, playerId);
    this.db.prepare('UPDATE setups SET status = ?, archived_at = ?, updated_at = ? WHERE id = ?').run(archived ? 'archived' : 'active', archived ? Date.now() : null, Date.now(), id);
  }

  remove(id: string, playerId: string) {
    const r = this.owned(id, playerId);
    if (r.status !== 'archived') throw new HttpError(409, 'NOT_ARCHIVED', 'Archive the setup before deleting it');
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM setup_versions WHERE setup_id = ?').run(id);
      this.db.prepare('DELETE FROM setup_drafts WHERE setup_id = ?').run(id);
      this.db.prepare('DELETE FROM setups WHERE id = ?').run(id);
    })();
  }

  /** Clone (deck pattern: your own copy is "Name (copy)"). */
  clone(id: string, playerId: string): string {
    const r = this.owned(id, playerId);
    const content = structuredClone(this.versionContent(r.current_version_id));
    content.name = `${content.name} (copy)`.slice(0, 40);
    return this.create(playerId, content, { clonedFrom: id });
  }

  /**
   * Applies a setup to a table as its host (D3, D6): resolves deck slots (defaults, the host's
   * choices, locked versions for fixed deals) through deck access rules, expands the setup for the
   * seated players and runs one undoable table action. Refusals change nothing.
   */
  applyToTable(s: TableSession, hostId: string, setupId: string, choices: Record<string, string> = {}) {
    const r = this.row(setupId);
    if (!r || r.owner_id !== hostId) throw new ActionError('NO_SETUP', 'That setup is not available');
    if (r.status !== 'active') throw new ActionError('NO_SETUP', `${r.name} is archived; restore it to use it`);
    const content = this.versionContent(r.current_version_id);
    const decks: { slot: string; deck: TableDeck }[] = [];
    const deckSizes: Record<string, number> = {};
    const deckVersions: Record<string, string | null> = {};
    const records: (TableDeck & { ownerName?: string })[] = [];
    for (const slot of content.slots) {
      const lockedVersion = content.fixed?.deckVersions[slot.id];
      const deckId = lockedVersion ? slot.defaultDeckId : (choices[slot.id] ?? slot.defaultDeckId);
      if (!deckId) throw new ActionError('NO_DECK', `Choose a deck for "${slot.label}"`);
      const tdId = 'td' + randomId(6);
      let td;
      try {
        td = lockedVersion ? this.app.decks.tableDeckAtVersion(deckId, lockedVersion, hostId, tdId) : this.app.decks.tableDeck(deckId, hostId, undefined, tdId);
      } catch (e) {
        if (e instanceof ActionError && e.code === 'FIXED_DECK') throw e;
        throw new ActionError('NO_DECK', `The deck for "${slot.label}" is not available; choose another`);
      }
      const { ownerName: _o, ...deck } = td;
      decks.push({ slot: slot.id, deck: { ...deck, homeZoneId: '' } });
      deckSizes[slot.id] = totalInstances({ cards: deck.defs });
      deckVersions[slot.id] = deck.versionId;
      records.push(td);
    }
    const st = s.state;
    const seated = st.seats.filter((x) => x.playerId);
    const hostAt = Math.max(0, seated.findIndex((x) => x.playerId === st.hostId));
    const order = seated.slice(hostAt).concat(seated.slice(0, hostAt));
    const res = expandSetup(content, { seats: order.map((x) => ({ name: x.name })), deckSizes, deckVersions });
    if (!res.ok) throw new ActionError(res.code, res.message);
    for (const td of records) this.app.tables.recordDeck(s.id, td);
    s.apply({ type: 'applySetup', setup: { id: r.id, versionId: r.current_version_id, name: content.name }, decks, plan: res.plan }, hostId);
  }

  async routes(http: FastifyInstance) {
    const auth = (req: any) => this.app.auth(req)!;
    const pid = (req: any) => (req.params as { id: string }).id;

    http.get('/api/setups', async (req) => {
      const me = auth(req);
      const status = (req.query as any).status === 'archived' ? 'archived' : 'active';
      return { setups: this.listMine(me.id, status) };
    });
    http.post('/api/setups', async (req) => {
      const me = auth(req);
      const body = z.object({ name: z.string().trim().min(1).max(40) }).parse(req.body);
      return this.detail(this.create(me.id, blankSetup(body.name)), me.id);
    });
    http.get('/api/setups/:id', async (req) => this.detail(pid(req), auth(req).id));
    http.put('/api/setups/:id/draft', async (req) => ({ draft: this.writeDraft(pid(req), auth(req).id, (req.body as any)?.content) }));
    http.delete('/api/setups/:id/draft', async (req) => {
      const me = auth(req);
      this.discard(pid(req), me.id);
      return this.detail(pid(req), me.id);
    });
    http.post('/api/setups/:id/save', async (req) => this.save(pid(req), auth(req).id, (req.body as any)?.content));
    http.post('/api/setups/:id/archive', async (req) => {
      const me = auth(req);
      this.archive(pid(req), me.id, true);
      return this.detail(pid(req), me.id);
    });
    http.post('/api/setups/:id/restore', async (req) => {
      const me = auth(req);
      this.archive(pid(req), me.id, false);
      return this.detail(pid(req), me.id);
    });
    http.delete('/api/setups/:id', async (req) => {
      const me = auth(req);
      const body = z.object({ confirm: z.literal(true) }).safeParse(req.body ?? {});
      if (!body.success) throw new HttpError(400, 'CONFIRM', 'Confirm permanent deletion');
      this.remove(pid(req), me.id);
      return { ok: true };
    });
    // "Save table as setup" (host): the recording opens as a draft in the setup editor
    http.post('/api/tables/:tid/record-setup', async (req) => {
      const me = auth(req);
      const s = this.app.tables.get((req.params as { tid: string }).tid);
      if (!s || !s.isParticipant(me.id)) throw new HttpError(404, 'NO_TABLE', 'You are not at that table');
      if (s.state.hostId !== me.id) throw new HttpError(403, 'NOT_HOST', 'Only the host can save the table as a setup');
      const body = z.object({ name: z.string().trim().min(1).max(40).optional(), fixed: z.boolean().optional() }).parse(req.body ?? {});
      const content = recordSetup(s.state, { name: body.name ?? s.state.settings.name, fixed: body.fixed });
      return this.detail(this.create(me.id, content, { asDraft: true }), me.id);
    });
    http.post('/api/setups/:id/clone', async (req) => {
      const me = auth(req);
      return this.detail(this.clone(pid(req), me.id), me.id);
    });
  }
}
