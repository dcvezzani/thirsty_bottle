import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ActionError,
  CardDefSchema,
  DeckContentSchema,
  totalInstances,
  type CardDef,
  type DeckContent,
  type DeckDetail,
  type DeckSummary,
  type DeckVisibility,
  type TableDeck,
} from '@vct/shared';
import type { App } from './app.js';
import type { TableSession } from './tables.js';
import { HttpError, randomId } from './util.js';

export interface DeckRow {
  id: string;
  owner_id: string | null;
  built_in: number;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  archived_at: number | null;
  visibility: DeckVisibility;
  share_token: string | null;
  cloned_from_deck_id: string | null;
  cloned_from_label: string | null;
  current_version_id: string;
  clone_count: number;
  hidden: number;
  created_at: number;
  updated_at: number;
}

/** How a viewer came to see a deck. */
export type Access = 'owner' | 'builtin' | 'public' | 'link' | 'table';

const notFound = () => new HttpError(404, 'NO_DECK', 'Deck not found');

export const DraftOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add'), card: CardDefSchema.omit({ id: true }).partial({ metadata: true }) }),
  z.object({ op: z.literal('update'), cardId: z.string(), card: CardDefSchema.omit({ id: true }).partial() }),
  z.object({ op: z.literal('duplicate'), cardId: z.string() }),
  z.object({ op: z.literal('remove'), cardIds: z.array(z.string()).min(1) }),
  z.object({ op: z.literal('reorder'), cardId: z.string(), toIndex: z.number().int().min(0) }),
  z.object({ op: z.literal('bulkCount'), cardIds: z.array(z.string()).min(1), count: z.number().int() }),
  z.object({
    op: z.literal('copyFrom'),
    deckId: z.string(),
    cardIds: z.array(z.string()).min(1),
    shareToken: z.string().optional(),
  }),
  z.object({
    op: z.literal('meta'),
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(4000).optional(),
    backImageId: z.string().nullable().optional(),
    propertyTemplate: DeckContentSchema.innerType().shape.propertyTemplate.optional(),
  }),
]);
export type DraftOp = z.infer<typeof DraftOpSchema>;

export function newCardId() {
  return 'c_' + randomId(6);
}

export class Decks {
  constructor(private app: App) {}

  private get db() {
    return this.app.db;
  }

  row(id: string): DeckRow | undefined {
    return this.db.prepare('SELECT * FROM decks WHERE id = ?').get(id) as DeckRow | undefined;
  }

  versionContent(versionId: string): DeckContent {
    const r = this.db.prepare('SELECT content FROM deck_versions WHERE id = ?').get(versionId) as any;
    return JSON.parse(r.content);
  }

  draftContent(deckId: string): DeckContent | null {
    const r = this.db.prepare('SELECT content FROM deck_drafts WHERE deck_id = ?').get(deckId) as any;
    return r ? JSON.parse(r.content) : null;
  }

  private ownerName(ownerId: string | null): string | null {
    if (!ownerId) return null;
    return this.app.players.get(ownerId)?.name ?? null;
  }

  /** The single access check (design D7a). Returns how the player may view it, or null. */
  canView(deckId: string, playerId: string | null, shareToken?: string): Access | null {
    const d = this.row(deckId);
    if (!d) return null;
    if (playerId && d.owner_id === playerId) return 'owner';
    if (d.status !== 'active') return null;
    if (d.built_in) return 'builtin';
    if (d.visibility === 'public' && !d.hidden) return 'public';
    if ((d.visibility === 'link' || d.visibility === 'public') && shareToken && d.share_token === shareToken) return 'link';
    if (playerId && this.tableDeckFor(playerId, deckId)) return 'table';
    return null;
  }

  /** The table snapshot of `deckId` on the table the player is at, if any. */
  tableDeckFor(playerId: string, deckId: string): TableDeck | null {
    const tid = this.app.playerTables.get(playerId);
    if (!tid) return null;
    const r = this.db
      .prepare('SELECT content FROM table_decks WHERE table_id = ? AND source_deck_id = ? ORDER BY rowid DESC LIMIT 1')
      .get(tid, deckId) as any;
    return r ? JSON.parse(r.content) : null;
  }

  summary(d: DeckRow, content: DeckContent, forPlayer: string | null): DeckSummary {
    const cover = content.cards.find((c) => c.frontImageId)?.frontImageId ?? content.backImageId ?? null;
    const s: DeckSummary = {
      id: d.id,
      ownerId: d.owner_id,
      ownerName: this.ownerName(d.owner_id),
      name: content.name,
      status: d.status,
      visibility: d.visibility,
      builtIn: !!d.built_in,
      clonedFromLabel: d.cloned_from_label,
      cloneCount: d.clone_count,
      cardCount: totalInstances(content),
      definitionCount: content.cards.length,
      coverImageId: cover,
      currentVersionId: d.current_version_id,
      updatedAt: d.updated_at,
      archivedAt: d.archived_at,
    };
    if (content.description) s.description = content.description;
    if (forPlayer && d.owner_id === forPlayer) {
      s.shareToken = d.share_token;
      s.hasDraft = !!this.db.prepare('SELECT 1 FROM deck_drafts WHERE deck_id = ?').get(d.id);
    }
    return s;
  }

  detail(deckId: string, playerId: string | null, shareToken?: string): DeckDetail {
    const access = this.canView(deckId, playerId, shareToken);
    if (!access) throw notFound();
    const d = this.row(deckId)!;
    if (access === 'table') {
      // served from the table snapshot
      const td = this.tableDeckFor(playerId!, deckId)!;
      const content: DeckContent = { name: td.name, backImageId: td.backImageId, propertyTemplate: [], cards: td.defs };
      return { ...this.summary(d, content, playerId), content };
    }
    const content = this.versionContent(d.current_version_id);
    const out: DeckDetail = { ...this.summary(d, content, playerId), content };
    if (access === 'owner') out.draft = this.draftContent(d.id);
    return out;
  }

  // ------------------------------------------------------------------ mutations

  private writeVersion(deckId: string, content: DeckContent): string {
    const vid = 'v_' + randomId(9);
    this.db.prepare('INSERT INTO deck_versions (id, deck_id, content, created_at) VALUES (?, ?, ?, ?)').run(
      vid,
      deckId,
      JSON.stringify(content),
      Date.now(),
    );
    return vid;
  }

  private indexFts(deckId: string) {
    const d = this.row(deckId);
    this.db.prepare('DELETE FROM decks_fts WHERE deck_id = ?').run(deckId);
    if (!d) return;
    this.db.prepare('INSERT INTO decks_fts (deck_id, name, owner_name) VALUES (?, ?, ?)').run(
      deckId,
      d.name,
      this.ownerName(d.owner_id) ?? '',
    );
  }

  create(
    ownerId: string | null,
    content: DeckContent,
    extra: Partial<Pick<DeckRow, 'built_in' | 'cloned_from_deck_id' | 'cloned_from_label' | 'visibility'>> & { id?: string } = {},
  ): string {
    const parsed = DeckContentSchema.parse(content);
    const id = extra.id ?? 'd_' + randomId(9);
    const now = Date.now();
    this.db.transaction(() => {
      const vid = this.writeVersion(id, parsed);
      this.db
        .prepare(
          `INSERT INTO decks (id, owner_id, built_in, name, description, visibility, cloned_from_deck_id, cloned_from_label,
            current_version_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          ownerId,
          extra.built_in ?? 0,
          parsed.name,
          parsed.description ?? null,
          extra.visibility ?? 'private',
          extra.cloned_from_deck_id ?? null,
          extra.cloned_from_label ?? null,
          vid,
          now,
          now,
        );
      this.indexFts(id);
    })();
    return id;
  }

  private ownedActive(deckId: string, playerId: string): DeckRow {
    const d = this.row(deckId);
    if (!d || d.owner_id !== playerId) throw notFound();
    if (d.status !== 'active') throw new HttpError(409, 'ARCHIVED', 'Restore the deck before editing it');
    return d;
  }

  writeDraft(deckId: string, playerId: string, content: unknown): DeckContent {
    this.ownedActive(deckId, playerId);
    const parsed = DeckContentSchema.parse(content);
    this.db
      .prepare(
        'INSERT INTO deck_drafts (deck_id, content, updated_at) VALUES (?, ?, ?) ON CONFLICT(deck_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at',
      )
      .run(deckId, JSON.stringify(parsed), Date.now());
    return parsed;
  }

  applyOps(deckId: string, playerId: string, ops: DraftOp[]): DeckContent {
    const d = this.ownedActive(deckId, playerId);
    const content: DeckContent = structuredClone(this.draftContent(deckId) ?? this.versionContent(d.current_version_id));
    const idx = (cardId: string) => {
      const i = content.cards.findIndex((c) => c.id === cardId);
      if (i < 0) throw new HttpError(404, 'NO_CARD', 'Card not found');
      return i;
    };
    for (const op of ops) {
      switch (op.op) {
        case 'add':
          content.cards.push({ metadata: {}, ...op.card, id: newCardId() } as CardDef);
          break;
        case 'update': {
          const i = idx(op.cardId);
          content.cards[i] = { ...content.cards[i], ...op.card, id: op.cardId } as CardDef;
          for (const k of ['description', 'frontImageId', 'backImageId'] as const)
            if ((content.cards[i] as any)[k] === null) delete (content.cards[i] as any)[k];
          break;
        }
        case 'duplicate': {
          const i = idx(op.cardId);
          const c = structuredClone(content.cards[i]);
          content.cards.splice(i + 1, 0, { ...c, id: newCardId(), name: `${c.name} (copy)`.slice(0, 100) });
          break;
        }
        case 'remove':
          content.cards = content.cards.filter((c) => !op.cardIds.includes(c.id));
          break;
        case 'reorder': {
          const i = idx(op.cardId);
          const [c] = content.cards.splice(i, 1);
          content.cards.splice(Math.min(op.toIndex, content.cards.length), 0, c);
          break;
        }
        case 'bulkCount':
          if (op.count < 1) throw new HttpError(400, 'BAD_COUNT', 'Instance count must be at least 1');
          for (const id of op.cardIds) content.cards[idx(id)].count = op.count;
          break;
        case 'copyFrom': {
          const src = this.detail(op.deckId, playerId, op.shareToken);
          for (const cid of op.cardIds) {
            const c = src.content.cards.find((x) => x.id === cid);
            if (!c) throw new HttpError(404, 'NO_CARD', 'Card not found in source deck');
            content.cards.push({ ...structuredClone(c), id: newCardId() });
          }
          break;
        }
        case 'meta':
          if (op.name !== undefined) content.name = op.name;
          if (op.description !== undefined) content.description = op.description || undefined;
          if (op.backImageId !== undefined) {
            if (op.backImageId) content.backImageId = op.backImageId;
            else delete content.backImageId;
          }
          if (op.propertyTemplate) content.propertyTemplate = op.propertyTemplate;
          break;
      }
    }
    return this.writeDraft(deckId, playerId, content);
  }

  save(deckId: string, playerId: string, content?: unknown): DeckDetail {
    const d = this.ownedActive(deckId, playerId);
    const src = content ?? this.draftContent(deckId);
    if (!src) throw new HttpError(400, 'NO_CHANGES', 'Nothing to save');
    const parsed = DeckContentSchema.parse(src);
    this.db.transaction(() => {
      const vid = this.writeVersion(deckId, parsed);
      this.db
        .prepare('UPDATE decks SET current_version_id = ?, name = ?, description = ?, updated_at = ? WHERE id = ?')
        .run(vid, parsed.name, parsed.description ?? null, Date.now(), d.id);
      this.db.prepare('DELETE FROM deck_drafts WHERE deck_id = ?').run(deckId);
      this.indexFts(deckId);
    })();
    return this.detail(deckId, playerId);
  }

  discard(deckId: string, playerId: string) {
    const d = this.row(deckId);
    if (!d || d.owner_id !== playerId) throw notFound();
    this.db.prepare('DELETE FROM deck_drafts WHERE deck_id = ?').run(deckId);
  }

  archive(deckId: string, playerId: string, archived: boolean) {
    const d = this.row(deckId);
    if (!d || d.owner_id !== playerId) throw notFound();
    this.db
      .prepare('UPDATE decks SET status = ?, archived_at = ?, updated_at = ? WHERE id = ?')
      .run(archived ? 'archived' : 'active', archived ? Date.now() : null, Date.now(), deckId);
  }

  /**
   * Deletes saved versions older than maxAgeMs that are neither a deck's current version nor
   * referenced by a table snapshot (deck-library: prune unreferenced old versions). Drafts are separate rows.
   */
  pruneVersions(maxAgeMs = 30 * 24 * 3600_000): number {
    const r = this.db
      .prepare(
        `DELETE FROM deck_versions WHERE created_at < ?
           AND id NOT IN (SELECT current_version_id FROM decks)
           AND id NOT IN (SELECT version_id FROM table_decks WHERE version_id IS NOT NULL)`,
      )
      .run(Date.now() - maxAgeMs);
    return r.changes;
  }

  remove(deckId: string, playerId: string) {
    const d = this.row(deckId);
    if (!d || d.owner_id !== playerId) throw notFound();
    if (d.status !== 'archived') throw new HttpError(409, 'NOT_ARCHIVED', 'Archive the deck before deleting it');
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM deck_versions WHERE deck_id = ?').run(deckId);
      this.db.prepare('DELETE FROM deck_drafts WHERE deck_id = ?').run(deckId);
      this.db.prepare('DELETE FROM deck_reports WHERE deck_id = ?').run(deckId);
      this.db.prepare('DELETE FROM decks WHERE id = ?').run(deckId);
      this.db.prepare('DELETE FROM decks_fts WHERE deck_id = ?').run(deckId);
    })();
    this.app.images.gc(0);
  }

  setVisibility(deckId: string, playerId: string, visibility: DeckVisibility): DeckRow {
    const d = this.row(deckId);
    if (!d || d.owner_id !== playerId) throw notFound();
    const token = visibility === 'private' ? d.share_token : (d.share_token ?? randomId(12));
    this.db.prepare('UPDATE decks SET visibility = ?, share_token = ?, updated_at = ? WHERE id = ?').run(visibility, token, Date.now(), deckId);
    return this.row(deckId)!;
  }

  clone(deckId: string, playerId: string, shareToken?: string): string {
    const access = this.canView(deckId, playerId, shareToken);
    if (!access) throw notFound();
    const src = this.detail(deckId, playerId, shareToken);
    const d = this.row(deckId)!;
    const mine = d.owner_id === playerId;
    const owner = d.built_in ? 'Card Table' : (this.ownerName(d.owner_id) ?? 'someone');
    const content: DeckContent = structuredClone(src.content);
    if (mine) content.name = `${content.name} (copy)`.slice(0, 100);
    const id = this.create(playerId, content, {
      cloned_from_deck_id: deckId,
      cloned_from_label: mine ? null : `Cloned from ${src.content.name} by ${owner}`,
    });
    if (!mine) this.db.prepare('UPDATE decks SET clone_count = clone_count + 1 WHERE id = ?').run(deckId);
    return id;
  }

  cloneFromTable(tableId: string, tableDeckId: string, playerId: string): string {
    const s = this.app.tables.get(tableId);
    if (!s || !s.isParticipant(playerId)) throw new HttpError(404, 'NO_TABLE', 'You are not at that table');
    const r = this.db.prepare('SELECT * FROM table_decks WHERE table_id = ? AND table_deck_id = ?').get(tableId, tableDeckId) as any;
    if (!r) throw notFound();
    const td = JSON.parse(r.content) as TableDeck & { ownerName?: string };
    const srcRow = td.sourceDeckId ? this.row(td.sourceDeckId) : undefined;
    const mine = srcRow?.owner_id === playerId;
    const content: DeckContent = { name: td.name, backImageId: td.backImageId, propertyTemplate: [], cards: structuredClone(td.defs) };
    const owner = td.ownerName ?? (srcRow?.built_in ? 'Card Table' : 'someone');
    const id = this.create(playerId, content, {
      cloned_from_deck_id: td.sourceDeckId,
      cloned_from_label: mine ? null : `Cloned from ${td.name} by ${owner}`,
    });
    if (srcRow && !mine) this.db.prepare('UPDATE decks SET clone_count = clone_count + 1 WHERE id = ?').run(srcRow.id);
    return id;
  }

  report(deckId: string, playerId: string, reason?: string) {
    if (!this.canView(deckId, playerId)) throw notFound();
    this.db.prepare('INSERT OR IGNORE INTO deck_reports (deck_id, reporter_id, reason, at) VALUES (?, ?, ?, ?)').run(deckId, playerId, reason ?? null, Date.now());
    this.db.prepare('UPDATE decks SET hidden = 1 WHERE id = ? AND built_in = 0').run(deckId);
  }

  listMine(playerId: string, status: 'active' | 'archived'): DeckSummary[] {
    const rows = this.db.prepare('SELECT * FROM decks WHERE owner_id = ? AND status = ? ORDER BY updated_at DESC').all(playerId, status) as DeckRow[];
    return rows.map((d) => this.summary(d, this.versionContent(d.current_version_id), playerId));
  }

  listBuiltIn(): DeckSummary[] {
    const rows = this.db.prepare('SELECT * FROM decks WHERE built_in = 1 ORDER BY name').all() as DeckRow[];
    return rows.map((d) => this.summary(d, this.versionContent(d.current_version_id), null));
  }

  gallery(q: string, sort: 'newest' | 'cloned', offset: number, limit: number) {
    const order = sort === 'cloned' ? 'd.clone_count DESC, d.updated_at DESC' : 'd.updated_at DESC';
    const where = "d.visibility = 'public' AND d.status = 'active' AND d.hidden = 0 AND d.built_in = 0";
    let rows: DeckRow[];
    let total: number;
    const terms = q
      .split(/\s+/)
      .map((t) => t.replace(/["*^():]/g, ''))
      .filter(Boolean);
    if (terms.length) {
      const match = terms.map((t) => `"${t}"*`).join(' ');
      rows = this.db
        .prepare(`SELECT d.* FROM decks d JOIN decks_fts f ON f.deck_id = d.id WHERE ${where} AND decks_fts MATCH ? ORDER BY ${order} LIMIT ? OFFSET ?`)
        .all(match, limit, offset) as DeckRow[];
      total = (this.db.prepare(`SELECT COUNT(*) n FROM decks d JOIN decks_fts f ON f.deck_id = d.id WHERE ${where} AND decks_fts MATCH ?`).get(match) as any).n;
    } else {
      rows = this.db.prepare(`SELECT d.* FROM decks d WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`).all(limit, offset) as DeckRow[];
      total = (this.db.prepare(`SELECT COUNT(*) n FROM decks d WHERE ${where}`).get() as any).n;
    }
    return { total, decks: rows.map((d) => this.summary(d, this.versionContent(d.current_version_id), null)) };
  }

  // ------------------------------------------------------------------ tables

  /** Builds the snapshot that a table plays from. */
  tableDeck(deckId: string, playerId: string, shareToken: string | undefined, tableDeckId: string): TableDeck & { ownerName?: string } {
    const access = this.canView(deckId, playerId, shareToken);
    if (!access || access === 'table') throw new ActionError('NO_DECK', 'You cannot load that deck');
    const d = this.row(deckId)!;
    const content = this.versionContent(d.current_version_id);
    const td: TableDeck & { ownerName?: string } = {
      id: tableDeckId,
      sourceDeckId: d.id,
      versionId: d.current_version_id,
      name: content.name,
      defs: content.cards,
      homeZoneId: '',
    };
    if (content.backImageId) td.backImageId = content.backImageId;
    const owner = d.built_in ? 'Card Table' : this.ownerName(d.owner_id);
    if (owner) td.ownerName = owner;
    return td;
  }

  hasNewerVersion(d: TableDeck | undefined): boolean {
    if (!d?.sourceDeckId) return false;
    const r = this.row(d.sourceDeckId);
    return !!r && r.status === 'active' && r.current_version_id !== d.versionId;
  }

  async loadOntoTable(s: TableSession, pid: string, deckId: string, shareToken?: string) {
    const n = Object.keys(s.state.decks).length;
    let tdId = `td${n + 1}`;
    while (s.state.decks[tdId]) tdId += 'x';
    const td = this.tableDeck(deckId, pid, shareToken, tdId);
    this.app.tables.recordDeck(s.id, td);
    const { ownerName: _o, ...deck } = td;
    s.apply({ type: 'loadDeck', deck }, null);
  }

  async reloadOnTable(s: TableSession, tableDeckId: string) {
    const cur = s.state.decks[tableDeckId];
    if (!cur?.sourceDeckId) throw new ActionError('NO_DECK', 'That deck cannot be reloaded');
    const td = this.tableDeck(cur.sourceDeckId, s.state.hostId, undefined, tableDeckId);
    this.app.tables.recordDeck(s.id, td);
    const { ownerName: _o, ...deck } = td;
    s.apply({ type: 'reloadDeck', deckId: tableDeckId, deck }, null);
  }

  // ------------------------------------------------------------------ routes

  async routes(http: FastifyInstance) {
    const auth = (req: any) => this.app.auth(req)!;
    const share = (req: any) => (req.query?.share as string | undefined) || undefined;

    http.get('/api/decks', async (req) => {
      const me = auth(req);
      const status = (req.query as any).status === 'archived' ? 'archived' : 'active';
      return { decks: this.listMine(me.id, status), builtIn: status === 'active' ? this.listBuiltIn() : [] };
    });

    http.post('/api/decks', async (req) => {
      const me = auth(req);
      const body = z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(4000).optional() }).parse(req.body);
      const id = this.create(me.id, { name: body.name, description: body.description, propertyTemplate: [], cards: [] });
      return this.detail(id, me.id);
    });

    http.get('/api/decks/:id', async (req) => {
      const me = this.app.auth(req, false);
      return this.detail((req.params as any).id, me?.id ?? null, share(req));
    });

    http.get('/api/share/:token', async (req) => {
      const me = this.app.auth(req, false);
      const token = (req.params as any).token;
      const d = this.db.prepare('SELECT id FROM decks WHERE share_token = ?').get(token) as any;
      if (!d) throw new HttpError(404, 'NO_DECK', 'This deck is unavailable');
      try {
        return this.detail(d.id, me?.id ?? null, token);
      } catch {
        throw new HttpError(404, 'NO_DECK', 'This deck is unavailable');
      }
    });

    http.put('/api/decks/:id/draft', async (req) => {
      const me = auth(req);
      const content = this.writeDraft((req.params as any).id, me.id, (req.body as any)?.content);
      return { draft: content };
    });

    http.post('/api/decks/:id/draft/ops', async (req) => {
      const me = auth(req);
      const body = z.object({ ops: z.array(DraftOpSchema).min(1).max(100) }).parse(req.body);
      return { draft: this.applyOps((req.params as any).id, me.id, body.ops) };
    });

    http.delete('/api/decks/:id/draft', async (req) => {
      const me = auth(req);
      this.discard((req.params as any).id, me.id);
      return this.detail((req.params as any).id, me.id);
    });

    http.post('/api/decks/:id/save', async (req) => {
      const me = auth(req);
      return this.save((req.params as any).id, me.id, (req.body as any)?.content);
    });

    http.post('/api/decks/:id/archive', async (req) => {
      const me = auth(req);
      this.archive((req.params as any).id, me.id, true);
      return this.detail((req.params as any).id, me.id);
    });

    http.post('/api/decks/:id/restore', async (req) => {
      const me = auth(req);
      this.archive((req.params as any).id, me.id, false);
      return this.detail((req.params as any).id, me.id);
    });

    http.delete('/api/decks/:id', async (req) => {
      const me = auth(req);
      const body = z.object({ confirm: z.literal(true) }).safeParse(req.body ?? {});
      if (!body.success) throw new HttpError(400, 'CONFIRM', 'Confirm permanent deletion');
      this.remove((req.params as any).id, me.id);
      return { ok: true };
    });

    http.put('/api/decks/:id/visibility', async (req) => {
      const me = auth(req);
      const body = z.object({ visibility: z.enum(['private', 'link', 'public']) }).parse(req.body);
      this.setVisibility((req.params as any).id, me.id, body.visibility);
      return this.detail((req.params as any).id, me.id);
    });

    http.post('/api/decks/:id/clone', async (req) => {
      const me = auth(req);
      const id = this.clone((req.params as any).id, me.id, share(req));
      return this.detail(id, me.id);
    });

    http.post('/api/tables/:tid/decks/:tdid/clone', async (req) => {
      const me = auth(req);
      const p = req.params as any;
      const id = this.cloneFromTable(p.tid, p.tdid, me.id);
      return this.detail(id, me.id);
    });

    http.post('/api/decks/:id/report', async (req) => {
      const me = auth(req);
      this.report((req.params as any).id, me.id, (req.body as any)?.reason);
      return { ok: true };
    });

    http.get('/api/gallery', async (req) => {
      const q = z
        .object({
          q: z.string().max(100).default(''),
          sort: z.enum(['newest', 'cloned']).default('newest'),
          offset: z.coerce.number().int().min(0).default(0),
          limit: z.coerce.number().int().min(1).max(100).default(24),
        })
        .parse(req.query);
      return this.gallery(q.q, q.sort, q.offset, q.limit);
    });
  }
}
