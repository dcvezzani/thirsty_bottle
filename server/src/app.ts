import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import {
  ActionError,
  DisplayNameSchema,
  DISCONNECTED_MARK_MS,
  EMPTY_TABLE_TTL_MS,
  PlayerColorSchema,
  RECONNECT_GRACE_MS,
  tableChannel,
} from '@vct/shared';
import { z } from 'zod';
import { openDb, type DB } from './db.js';
import { Players, type Player } from './players.js';
import { Tables, type TableSession } from './tables.js';
import { Chat } from './chat.js';
import { Hub } from './hub.js';
import { Decks } from './decks.js';
import { HttpError } from './util.js';

export interface AppOptions {
  dataDir: string;
  /** Reconnect grace period before a disconnected player loses their seat. */
  graceMs: number;
  /** Delay before a disconnected seat is shown as disconnected. */
  markMs: number;
  /** How long a table with nobody connected is kept. */
  emptyTtlMs: number;
  clientDir?: string;
  quiet?: boolean;
  /** Per-connection message rate limit (messages/second, burst). */
  rate: { perSecond: number; burst: number };
}

const here = path.dirname(fileURLToPath(import.meta.url));

export class App {
  opts: AppOptions;
  db: DB;
  players: Players;
  tables: Tables;
  chat: Chat;
  hub: Hub;
  decks: Decks;
  http: FastifyInstance;
  /** Player id → the table they are seated at or watching. */
  playerTables = new Map<string, string>();
  closing = false;
  private purgeTimer: NodeJS.Timeout | null = null;

  constructor(opts: Partial<AppOptions> & { dataDir: string }) {
    this.opts = {
      graceMs: RECONNECT_GRACE_MS,
      markMs: DISCONNECTED_MARK_MS,
      emptyTtlMs: EMPTY_TABLE_TTL_MS,
      rate: { perSecond: 20, burst: 40 },
      clientDir: path.resolve(here, '../../client/dist'),
      ...opts,
    };
    this.db = openDb(this.opts.dataDir);
    this.players = new Players(this.db);
    this.chat = new Chat(this);
    this.hub = new Hub(this);
    this.tables = new Tables(this);
    this.decks = new Decks(this);
    this.http = Fastify({ bodyLimit: 12 * 1024 * 1024 });
  }

  log(msg: string) {
    if (!this.opts.quiet) console.log(msg);
  }

  async init() {
    this.chat.purge();
    this.purgeTimer = setInterval(() => this.chat.purge(), 3600_000);
    this.purgeTimer.unref();
    this.tables.loadAll();
    await this.routes();
    this.http.server.on('upgrade', (req, socket, head) => {
      if (!req.url?.startsWith('/ws')) return socket.destroy();
      this.hub.wss.handleUpgrade(req, socket, head, (ws) => this.hub.wss.emit('connection', ws, req));
    });
  }

  async listen(port: number, host = '0.0.0.0') {
    await this.http.listen({ port, host });
    return (this.http.server.address() as AddressInfo).port;
  }

  async close() {
    this.closing = true;
    if (this.purgeTimer) clearInterval(this.purgeTimer);
    this.tables.shutdown();
    this.hub.close();
    await this.http.close();
    this.db.close();
  }

  // ------------------------------------------------------------------ helpers used by hub/tables

  lobbyChanged() {
    this.hub.lobbyChanged();
  }

  playerLeftTable(pid: string, tableId: string) {
    if (this.playerTables.get(pid) === tableId) this.playerTables.delete(pid);
    this.lobbyChanged();
  }

  /** Voluntary leave or kick. */
  leaveTable(pid: string, tableId: string, reason: 'left' | 'kicked') {
    const s = this.tables.get(tableId);
    if (s && s.isParticipant(pid)) {
      s.apply({ type: 'seatLeave', playerId: pid, reason }, null);
      s.detachViewer(pid);
    }
    this.playerLeftTable(pid, tableId);
    this.hub.send(pid, { t: 'table.left', tableId, reason });
    s?.checkEmpty();
  }

  async loadDeckOntoTable(_s: TableSession, _pid: string, _deckId: string, _shareToken?: string): Promise<void> {
    throw new ActionError('NO_DECK', 'Decks are not available yet');
  }

  async reloadDeckOnTable(_s: TableSession, _tableDeckId: string): Promise<void> {
    throw new ActionError('NO_DECK', 'Decks are not available yet');
  }

  /** Resolves the bearer token on a request. */
  auth(req: FastifyRequest, required = true): Player | null {
    const h = req.headers.authorization;
    const token = h?.startsWith('Bearer ') ? h.slice(7) : undefined;
    const p = this.players.byToken(token);
    if (!p && required) throw new HttpError(401, 'UNAUTHORIZED', 'Sign in first');
    return p;
  }

  // ------------------------------------------------------------------ HTTP

  private async routes() {
    const app = this.http;
    app.setErrorHandler((err: any, _req, reply) => {
      if (err instanceof HttpError) return reply.status(err.status).send({ code: err.code, error: err.message });
      if (err instanceof ActionError) return reply.status(400).send({ code: err.code, error: err.message });
      if (err instanceof z.ZodError)
        return reply.status(400).send({ code: 'BAD_REQUEST', error: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '), issues: err.issues });
      if (err.statusCode && err.statusCode < 500) return reply.status(err.statusCode).send({ code: err.code ?? 'BAD_REQUEST', error: err.message });
      this.log(err.stack);
      return reply.status(500).send({ code: 'SERVER', error: 'Something went wrong' });
    });

    app.get('/api/health', async () => ({ ok: true }));

    app.post('/api/players', async (req) => {
      const body = z.object({ name: DisplayNameSchema, color: PlayerColorSchema }).parse(req.body);
      const { token, player } = this.players.create(body.name, body.color);
      return { token, player: { id: player.id, name: player.name, color: player.color } };
    });

    app.get('/api/me', async (req) => {
      const p = this.auth(req)!;
      return { player: { id: p.id, name: p.name, color: p.color }, tableId: this.playerTables.get(p.id) ?? null };
    });

    app.get('/api/tables/:id', async (req) => {
      const s = this.tables.get((req.params as any).id);
      if (!s) throw new HttpError(404, 'NO_TABLE', 'That table no longer exists');
      return { table: s.summary() };
    });

    await this.decksRoutes();

    const clientDir = this.opts.clientDir!;
    if (fs.existsSync(clientDir)) {
      await app.register(fastifyStatic, { root: clientDir, wildcard: false });
      const index = fs.readFileSync(path.join(clientDir, 'index.html'), 'utf8');
      app.setNotFoundHandler((req, reply) => {
        if (req.url.startsWith('/api/') || req.method !== 'GET') return reply.status(404).send({ code: 'NOT_FOUND', error: 'Not found' });
        return reply.type('text/html').send(index);
      });
    }
  }

  protected async decksRoutes() {
    /* registered by the deck library */
  }

  tableChannel(id: string) {
    return tableChannel(id);
  }
}

export async function createApp(opts: Partial<AppOptions> & { dataDir: string }) {
  const app = new App(opts);
  await app.init();
  return app;
}
