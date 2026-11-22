import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ActionError,
  blankSetup,
  checkSetup,
  expandSetup,
  recordSetup,
  SetupContentSchema,
  totalInstances,
  type SetupContent,
  type SetupDetail,
  type SetupSummary,
  type SetupVisibility,
  type TableDeck,
} from '@vct/shared';
import { builtInSetups } from './builtinSetups.js';
import type { TableSession } from './tables.js';
import type { App } from './app.js';
import { HttpError, randomId } from './util.js';

/** table-setups / setup-sharing: setups with the deck library's lifecycle and sharing. */
export interface SetupRow {
  id: string;
  /** '' for built-in setups. */
  owner_id: string;
  name: string;
  status: 'active' | 'archived';
  archived_at: number | null;
  cloned_from_setup_id: string | null;
  current_version_id: string;
  created_at: number;
  updated_at: number;
  visibility: SetupVisibility;
  share_token: string | null;
  built_in: number;
  hidden: number;
  clone_count: number;
  cloned_from_label: string | null;
}

/** How a viewer came to see a setup (setup-sharing D2). */
export type SetupAccess = 'owner' | 'builtin' | 'public' | 'link' | 'table';

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

  /** Edits stay owner-only. */
  owned(id: string, playerId: string): SetupRow {
    const r = this.row(id);
    if (!r || r.built_in || r.owner_id !== playerId) throw notFound();
    return r;
  }

  /** The single read-access check (setup-sharing D2), mirroring decks. */
  canView(id: string, playerId: string | null, shareToken?: string): SetupAccess | null {
    const r = this.row(id);
    if (!r) return null;
    if (playerId && !r.built_in && r.owner_id === playerId) return 'owner';
    if (r.status !== 'active') return null;
    if (r.built_in) return 'builtin';
    if (r.visibility === 'public' && !r.hidden) return 'public';
    if (r.visibility !== 'private' && shareToken && r.share_token === shareToken) return 'link';
    if (playerId) {
      const tid = this.app.playerTables.get(playerId);
      const t = tid ? this.app.tables.get(tid) : undefined;
      if (t?.state.lastSetup?.id === id) return 'table';
    }
    return null;
  }

  private viewable(id: string, playerId: string | null, shareToken?: string): SetupRow {
    if (!this.canView(id, playerId, shareToken)) throw notFound();
    return this.row(id)!;
  }

  private ownerName(r: SetupRow): string | null {
    if (r.built_in) return 'Card Table';
    return this.app.players.get(r.owner_id)?.name ?? null;
  }

  private indexFts(id: string) {
    this.db.prepare('DELETE FROM setups_fts WHERE setup_id = ?').run(id);
    const r = this.row(id);
    if (r) this.db.prepare('INSERT INTO setups_fts (setup_id, name, owner_name) VALUES (?, ?, ?)').run(id, r.name, this.ownerName(r) ?? '');
  }

  private ownedActive(id: string, playerId: string): SetupRow {
    const r = this.owned(id, playerId);
    if (r.status !== 'active') throw new HttpError(409, 'ARCHIVED', 'Restore the setup before editing it');
    return r;
  }

  summary(r: SetupRow, content: SetupContent, viewer: string | null): SetupSummary {
    const mine = !!viewer && !r.built_in && r.owner_id === viewer;
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      ownerId: r.built_in ? null : r.owner_id,
      ownerName: this.ownerName(r),
      mine,
      builtIn: !!r.built_in,
      visibility: r.visibility,
      ...(mine ? { shareToken: r.share_token } : {}),
      clonedFromLabel: r.cloned_from_label,
      cloneCount: r.clone_count,
      players: content.players,
      zoneCount: content.zones.length,
      slots: content.slots.map((s) => {
        const d = s.defaultDeckId ? this.app.decks.row(s.defaultDeckId) : undefined;
        return {
          ...s,
          defaultDeckName: d?.name ?? null,
          defaultDeckShareable: !!d && d.status === 'active' && (!!d.built_in || d.visibility !== 'private'),
          defaultDeckUsable: !!d && !!viewer && this.app.decks.canView(d.id, viewer) !== null && this.app.decks.canView(d.id, viewer) !== 'table',
        };
      }),
      fixed: !!content.fixed,
      currentVersionId: r.current_version_id,
      hasDraft: mine && !!this.db.prepare('SELECT 1 FROM setup_drafts WHERE setup_id = ?').get(r.id),
      updatedAt: r.updated_at,
    };
  }

  detail(id: string, playerId: string | null, shareToken?: string): SetupDetail {
    const r = this.viewable(id, playerId, shareToken);
    const content = this.versionContent(r.current_version_id);
    const s = this.summary(r, content, playerId);
    return { ...s, content, draft: s.mine ? this.draftContent(id) : null };
  }

  listMine(playerId: string, status: 'active' | 'archived'): SetupSummary[] {
    const rows = this.db.prepare('SELECT * FROM setups WHERE owner_id = ? AND built_in = 0 AND status = ? ORDER BY updated_at DESC').all(playerId, status) as SetupRow[];
    return rows.map((r) => this.summary(r, this.versionContent(r.current_version_id), playerId));
  }

  listBuiltIn(viewer: string | null): SetupSummary[] {
    const rows = this.db.prepare("SELECT * FROM setups WHERE built_in = 1 AND status = 'active' ORDER BY name").all() as SetupRow[];
    return rows.map((r) => this.summary(r, this.versionContent(r.current_version_id), viewer));
  }

  /** setup-sharing D3: active public setups, not hidden, not built in; FTS prefix search on name and owner. */
  gallery(viewer: string | null, q: string, sort: 'newest' | 'cloned', offset: number, limit: number) {
    const order = sort === 'cloned' ? 's.clone_count DESC, s.updated_at DESC' : 's.updated_at DESC';
    const where = "s.visibility = 'public' AND s.status = 'active' AND s.hidden = 0 AND s.built_in = 0";
    const terms = q
      .split(/\s+/)
      .map((t) => t.replace(/["*^():]/g, ''))
      .filter(Boolean);
    let rows: SetupRow[];
    let total: number;
    if (terms.length) {
      const match = terms.map((t) => `"${t}"*`).join(' ');
      rows = this.db.prepare(`SELECT s.* FROM setups s JOIN setups_fts f ON f.setup_id = s.id WHERE ${where} AND setups_fts MATCH ? ORDER BY ${order} LIMIT ? OFFSET ?`).all(match, limit, offset) as SetupRow[];
      total = (this.db.prepare(`SELECT COUNT(*) n FROM setups s JOIN setups_fts f ON f.setup_id = s.id WHERE ${where} AND setups_fts MATCH ?`).get(match) as { n: number }).n;
    } else {
      rows = this.db.prepare(`SELECT s.* FROM setups s WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).all(limit, offset) as SetupRow[];
      total = (this.db.prepare(`SELECT COUNT(*) n FROM setups s WHERE ${where}`).get() as { n: number }).n;
    }
    return { total, setups: rows.map((r) => this.summary(r, this.versionContent(r.current_version_id), viewer)) };
  }

  setVisibility(id: string, playerId: string, visibility: SetupVisibility) {
    const r = this.owned(id, playerId);
    const token = visibility === 'private' ? r.share_token : (r.share_token ?? randomId(12));
    this.db.prepare('UPDATE setups SET visibility = ?, share_token = ?, updated_at = ? WHERE id = ?').run(visibility, token, Date.now(), id);
  }

  report(id: string, playerId: string, reason?: string) {
    const r = this.viewable(id, playerId);
    if (r.built_in || r.visibility !== 'public') return;
    this.db.prepare('INSERT OR IGNORE INTO setup_reports (setup_id, reporter_id, reason, at) VALUES (?, ?, ?, ?)').run(id, playerId, reason ?? null, Date.now());
    this.db.prepare('UPDATE setups SET hidden = 1 WHERE id = ? AND built_in = 0').run(id);
  }

  /** setup-sharing D7: built-in setups, created when missing and updated when their content changes. */
  seedBuiltIns() {
    for (const b of builtInSetups()) {
      const content = parseSetup(b.content, { strict: true });
      const r = this.row(b.id);
      if (!r) {
        this.create('', content, { id: b.id, builtIn: true });
        continue;
      }
      if (JSON.stringify(this.versionContent(r.current_version_id)) !== JSON.stringify(content)) {
        const vid = this.writeVersion(b.id, content);
        this.db.prepare('UPDATE setups SET current_version_id = ?, name = ?, updated_at = ? WHERE id = ?').run(vid, content.name, Date.now(), b.id);
        this.indexFts(b.id);
      }
    }
  }

  private writeVersion(id: string, content: SetupContent): string {
    const vid = 'sv_' + randomId(9);
    this.db.prepare('INSERT INTO setup_versions (id, setup_id, content, created_at) VALUES (?, ?, ?, ?)').run(vid, id, JSON.stringify(content), Date.now());
    return vid;
  }

  /** Creates a setup. With `asDraft`, the saved version is blank and the content opens as a draft. */
  create(ownerId: string, content: SetupContent, opts: { clonedFrom?: string; clonedFromLabel?: string; asDraft?: boolean; id?: string; builtIn?: boolean } = {}): string {
    const id = opts.id ?? 'st_' + randomId(9);
    const now = Date.now();
    this.db.transaction(() => {
      const saved = opts.asDraft ? blankSetup(content.name) : content;
      const vid = this.writeVersion(id, saved);
      this.db
        .prepare(
          `INSERT INTO setups (id, owner_id, name, cloned_from_setup_id, cloned_from_label, current_version_id, built_in, visibility, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id, ownerId, content.name, opts.clonedFrom ?? null, opts.clonedFromLabel ?? null, vid, opts.builtIn ? 1 : 0, opts.builtIn ? 'public' : 'private', now, now);
      if (opts.asDraft) this.db.prepare('INSERT INTO setup_drafts (setup_id, content, updated_at) VALUES (?, ?, ?)').run(id, JSON.stringify(content), now);
      this.indexFts(id);
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
      this.indexFts(id);
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
      this.db.prepare('DELETE FROM setup_reports WHERE setup_id = ?').run(id);
      this.db.prepare('DELETE FROM setups WHERE id = ?').run(id);
      this.db.prepare('DELETE FROM setups_fts WHERE setup_id = ?').run(id);
    })();
  }

  /** Clone anything you can view (setup-sharing D5); your own copy is "Name (copy)". */
  clone(id: string, playerId: string, shareToken?: string): string {
    const r = this.viewable(id, playerId, shareToken);
    const content = structuredClone(this.versionContent(r.current_version_id));
    const mine = !r.built_in && r.owner_id === playerId;
    if (mine) content.name = `${content.name} (copy)`.slice(0, 40);
    const newId = this.create(playerId, content, {
      clonedFrom: id,
      ...(mine ? {} : { clonedFromLabel: `Cloned from ${r.name} by ${this.ownerName(r) ?? 'someone'}` }),
    });
    if (!mine) this.db.prepare('UPDATE setups SET clone_count = clone_count + 1 WHERE id = ?').run(id);
    return newId;
  }

  /**
   * Applies a setup to a table as its host (D3, D6): resolves deck slots (defaults, the host's
   * choices, locked versions for fixed deals) through deck access rules, expands the setup for the
   * seated players and runs one undoable table action. Refusals change nothing.
   */
  applyToTable(s: TableSession, hostId: string, setupId: string, choices: Record<string, string> = {}, shareToken?: string) {
    const r = this.row(setupId);
    const access = r ? this.canView(setupId, hostId, shareToken) : null;
    if (!r || !access) throw new ActionError('NO_SETUP', 'That setup is no longer available');
    if (r.status !== 'active') throw new ActionError('NO_SETUP', `${r.name} is archived; restore it to use it`);
    const content = this.versionContent(r.current_version_id);
    const decks: { slot: string; deck: TableDeck }[] = [];
    const deckSizes: Record<string, number> = {};
    const deckVersions: Record<string, string | null> = {};
    const records: (TableDeck & { ownerName?: string })[] = [];
    const used: Record<string, string> = {};
    for (const slot of content.slots) {
      const lockedVersion = content.fixed?.deckVersions[slot.id];
      const deckId = lockedVersion ? slot.defaultDeckId : (choices[slot.id] ?? slot.defaultDeckId);
      if (!deckId) throw new ActionError('NO_DECK', `Choose a deck for "${slot.label}"`);
      used[slot.id] = deckId;
      const tdId = 'td' + randomId(6);
      let td;
      try {
        td = lockedVersion ? this.app.decks.tableDeckAtVersion(deckId, lockedVersion, hostId, tdId) : this.app.decks.tableDeck(deckId, hostId, undefined, tdId);
      } catch (e) {
        if (e instanceof ActionError && e.code === 'FIXED_DECK') throw e;
        if (lockedVersion) throw new ActionError('FIXED_DECK', `This setup's fixed deal needs ${this.ownerName(r) ?? 'its owner'}'s deck`);
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
    s.apply({ type: 'applySetup', setup: { id: r.id, versionId: r.current_version_id, name: content.name, slots: used }, decks, plan: res.plan }, hostId);
  }

  async routes(http: FastifyInstance) {
    const auth = (req: any) => this.app.auth(req)!;
    const pid = (req: any) => (req.params as { id: string }).id;

    http.get('/api/setups', async (req) => {
      const me = auth(req);
      const status = (req.query as any).status === 'archived' ? 'archived' : 'active';
      return { setups: this.listMine(me.id, status), builtIn: status === 'active' ? this.listBuiltIn(me.id) : [] };
    });
    http.get('/api/setup-gallery', async (req) => {
      const me = this.app.auth(req, false);
      const q = z
        .object({
          q: z.string().max(100).default(''),
          sort: z.enum(['newest', 'cloned']).default('newest'),
          offset: z.coerce.number().int().min(0).default(0),
          limit: z.coerce.number().int().min(1).max(100).default(24),
        })
        .parse(req.query);
      return this.gallery(me?.id ?? null, q.q, q.sort, q.offset, q.limit);
    });
    http.get('/api/setup-share/:token', async (req) => {
      const me = this.app.auth(req, false);
      const token = (req.params as { token: string }).token;
      const r = this.db.prepare('SELECT id FROM setups WHERE share_token = ?').get(token) as { id: string } | undefined;
      if (!r) throw new HttpError(404, 'NO_SETUP', 'This setup is unavailable');
      try {
        return this.detail(r.id, me?.id ?? null, token);
      } catch {
        throw new HttpError(404, 'NO_SETUP', 'This setup is unavailable');
      }
    });
    http.put('/api/setups/:id/visibility', async (req) => {
      const me = auth(req);
      const body = z.object({ visibility: z.enum(['private', 'link', 'public']) }).parse(req.body);
      this.setVisibility(pid(req), me.id, body.visibility);
      return this.detail(pid(req), me.id);
    });
    http.post('/api/setups/:id/report', async (req) => {
      const me = auth(req);
      const body = z.object({ reason: z.string().max(500).optional() }).parse(req.body ?? {});
      this.report(pid(req), me.id, body.reason);
      return { ok: true };
    });
    http.post('/api/setups', async (req) => {
      const me = auth(req);
      const body = z.object({ name: z.string().trim().min(1).max(40) }).parse(req.body);
      return this.detail(this.create(me.id, blankSetup(body.name)), me.id);
    });
    http.get('/api/setups/:id', async (req) => this.detail(pid(req), auth(req).id, (req.query as any)?.share || undefined));
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
      return this.detail(this.clone(pid(req), me.id, (req.query as any)?.share || undefined), me.id);
    });
  }
}
