import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import crypto from 'node:crypto';
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
import { Images, MAX_UPLOAD_BYTES, UPLOAD_RULES } from './images.js';
import { DeckIO } from './deckio.js';
import multipart from '@fastify/multipart';
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
  images: Images;
  deckio: DeckIO;
  http: FastifyInstance;
  /** Player id → the table they are seated at or watching. */
  playerTables = new Map<string, string>();
  closing = false;
  /** Server action-to-broadcast timings (ms), most recent 5000. */
  metrics = {
    actionMs: [] as number[],
    record(ms: number) {
      this.actionMs.push(ms);
      if (this.actionMs.length > 5000) this.actionMs.shift();
    },
  };
  private secret!: Buffer;
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
    const secretFile = path.join(this.opts.dataDir, 'secret.key');
    if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32), { mode: 0o600 });
    this.secret = fs.readFileSync(secretFile);
    this.players = new Players(this.db);
    this.chat = new Chat(this);
    this.hub = new Hub(this);
    this.tables = new Tables(this);
    this.decks = new Decks(this);
    this.images = new Images(this);
    this.deckio = new DeckIO(this);
    this.http = Fastify({ bodyLimit: 12 * 1024 * 1024 });
  }

  log(msg: string) {
    if (!this.opts.quiet) console.log(msg);
  }

  async init() {
    this.chat.purge();
    this.purgeTimer = setInterval(() => {
      this.chat.purge();
      this.images.gc();
    }, 3600_000);
    this.purgeTimer.unref();
    this.deckio.seedBuiltIns();
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

  async loadDeckOntoTable(s: TableSession, pid: string, deckId: string, shareToken?: string): Promise<void> {
    await this.decks.loadOntoTable(s, pid, deckId, shareToken);
  }

  async reloadDeckOnTable(s: TableSession, tableDeckId: string): Promise<void> {
    await this.decks.reloadOnTable(s, tableDeckId);
  }

  /** Per-player key for image URLs (<img> cannot send headers; cookies are shared across tabs). */
  imageKey(pid: string): string {
    return `${pid}.${crypto.createHmac('sha256', this.secret).update(pid).digest('base64url').slice(0, 22)}`;
  }

  playerFromImageKey(k: string | undefined): string | null {
    if (!k) return null;
    const pid = k.slice(0, k.lastIndexOf('.'));
    const a = Buffer.from(this.imageKey(pid));
    const b = Buffer.from(k);
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? pid : null;
  }

  /** Resolves the bearer token on a request. */
  auth(req: FastifyRequest, required = true): Player | null {
    const h = req.headers.authorization;
    const cookie = /(?:^|;\s*)vct=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
    const token = h?.startsWith('Bearer ') ? h.slice(7) : cookie ? decodeURIComponent(cookie) : undefined;
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
      return { token, player: { id: player.id, name: player.name, color: player.color }, imageKey: this.imageKey(player.id) };
    });

    app.get('/api/me', async (req) => {
      const p = this.auth(req)!;
      return { player: { id: p.id, name: p.name, color: p.color }, tableId: this.playerTables.get(p.id) ?? null, imageKey: this.imageKey(p.id) };
    });

    app.get('/api/tables/:id', async (req) => {
      const s = this.tables.get((req.params as any).id);
      if (!s) throw new HttpError(404, 'NO_TABLE', 'That table no longer exists');
      return { table: s.summary() };
    });

    // Cookie used only so <img> requests can be authorized (images are access-controlled).
    app.post('/api/session', async (req, reply) => {
      const h = req.headers.authorization;
      const token = h?.startsWith('Bearer ') ? h.slice(7) : '';
      if (!this.players.byToken(token)) throw new HttpError(401, 'UNAUTHORIZED', 'Sign in first');
      reply.header('set-cookie', `vct=${encodeURIComponent(token)}; Path=/api/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
      return { ok: true };
    });

    await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
    app.post('/api/images', async (req) => {
      const me = this.auth(req)!;
      const file = await req.file();
      if (!file) throw new HttpError(400, 'NO_FILE', `Attach an image: ${UPLOAD_RULES}`);
      let buf: Buffer;
      try {
        buf = await file.toBuffer();
      } catch {
        throw new HttpError(413, 'TOO_LARGE', `Upload rejected: use ${UPLOAD_RULES}`);
      }
      if (file.file.truncated) throw new HttpError(413, 'TOO_LARGE', `Upload rejected: use ${UPLOAD_RULES}`);
      return this.images.ingest(buf, me.id);
    });
    app.get('/api/images/:file', async (req, reply) => {
      const m = /^([a-f0-9]{64})(\.thumb)?\.webp$/.exec((req.params as any).file);
      if (!m) throw new HttpError(404, 'NOT_FOUND', 'Not found');
      const pid = this.auth(req, false)?.id ?? this.playerFromImageKey((req.query as any).k);
      if (!this.images.exists(m[1]) || !this.images.canFetch(m[1], pid, (req.query as any).share))
        throw new HttpError(404, 'NOT_FOUND', 'Not found');
      reply.header('cache-control', 'private, max-age=31536000, immutable');
      return reply.type('image/webp').send(fs.createReadStream(this.images.file(m[1], !!m[2])));
    });

    await this.decks.routes(app);
    await this.deckio.routes();

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

  tableChannel(id: string) {
    return tableChannel(id);
  }
}

export async function createApp(opts: Partial<AppOptions> & { dataDir: string }) {
  const app = new App(opts);
  await app.init();
  return app;
}
