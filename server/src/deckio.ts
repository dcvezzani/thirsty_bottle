import dns from 'node:dns/promises';
import net from 'node:net';
import fs from 'node:fs';
import JSZip from 'jszip';
import { z } from 'zod';
import { AbilitySchema, DeckContentSchema, MetaValueSchema, PropertyTemplateSchema, type CardDef, type DeckContent } from '@vct/shared';
import type { App } from './app.js';
import { newCardId } from './decks.js';
import { HttpError } from './util.js';

export const MANIFEST_FORMAT = 'card-table-deck';

/** Image reference in a manifest: a path inside the zip, a data: URL, or an http(s) URL. */
const ImageRef = z.string().max(15_000_000);

export const ManifestCardSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(4000).optional(),
  count: z.number().int().min(1).max(500).default(1),
  front: ImageRef.optional(),
  back: ImageRef.optional(),
  metadata: z.record(z.string().min(1).max(64), MetaValueSchema).default({}),
  abilities: z.array(AbilitySchema).max(20).optional(),
});

export const ManifestSchema = z.object({
  format: z.literal(MANIFEST_FORMAT),
  version: z.literal(1),
  name: z.string().min(1).max(100),
  description: z.string().max(4000).optional(),
  back: ImageRef.optional(),
  propertyTemplate: PropertyTemplateSchema.default([]),
  cards: z.array(z.unknown()).max(1000),
});

export interface ImportError {
  card?: number;
  name?: string;
  message: string;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const l = ip.toLowerCase();
  return l === '::1' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l === '::';
}

async function fetchImage(url: string): Promise<Buffer> {
  const u = new URL(url);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('only http(s) image URLs are allowed');
  const addrs = await dns.lookup(u.hostname, { all: true });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error('image URL points to a private address');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(u, { signal: ctrl.signal, redirect: 'error' });
    if (!res.ok) throw new Error(`image download failed (${res.status})`);
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > 10 * 1024 * 1024) throw new Error('image is larger than 10 MB');
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
}

export class DeckIO {
  constructor(private app: App) {}

  // ------------------------------------------------------------------ export

  async export(deckId: string, playerId: string | null, shareToken: string | undefined, format: 'zip' | 'json', baseUrl: string) {
    const d = this.app.decks.detail(deckId, playerId, shareToken);
    const c = d.content;
    const images = new Set<string>();
    const ref = (id: string | undefined) => {
      if (!id) return undefined;
      images.add(id);
      return format === 'zip' ? `images/${id}.webp` : `${baseUrl}/api/images/${id}.webp${shareToken ? `?share=${shareToken}` : ''}`;
    };
    const manifest = {
      format: MANIFEST_FORMAT,
      version: 1,
      name: c.name,
      ...(c.description ? { description: c.description } : {}),
      ...(c.backImageId ? { back: ref(c.backImageId) } : {}),
      propertyTemplate: c.propertyTemplate ?? [],
      cards: c.cards.map((card) => ({
        id: card.id,
        name: card.name,
        ...(card.description ? { description: card.description } : {}),
        count: card.count,
        ...(card.frontImageId ? { front: ref(card.frontImageId) } : {}),
        ...(card.backImageId ? { back: ref(card.backImageId) } : {}),
        metadata: card.metadata ?? {},
        ...(card.abilities?.length ? { abilities: card.abilities } : {}),
      })),
    };
    if (format === 'json') return { manifest, filename: `${slug(c.name)}.json` };
    const zip = new JSZip();
    zip.file('deck.json', JSON.stringify(manifest, null, 2));
    for (const id of images) {
      const f = this.app.images.file(id);
      if (fs.existsSync(f)) zip.file(`images/${id}.webp`, fs.readFileSync(f));
    }
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    return { zip: buf, filename: `${slug(c.name)}.zip` };
  }

  // ------------------------------------------------------------------ import

  /** Imports a manifest (optionally with a zip for images) as a new private deck. Throws with per-card errors. */
  async import(playerId: string, input: { zip?: Buffer; manifest?: unknown }): Promise<string> {
    let zip: JSZip | null = null;
    let manifestRaw = input.manifest;
    if (input.zip) {
      try {
        zip = await JSZip.loadAsync(input.zip);
      } catch {
        throw new HttpError(400, 'BAD_ARCHIVE', 'Not a valid .zip archive');
      }
      const entry = zip.file('deck.json');
      if (!entry) throw new HttpError(400, 'BAD_ARCHIVE', 'Archive has no deck.json');
      try {
        manifestRaw = JSON.parse(await entry.async('string'));
      } catch {
        throw new HttpError(400, 'BAD_MANIFEST', 'deck.json is not valid JSON');
      }
    }
    const top = ManifestSchema.safeParse(manifestRaw);
    if (!top.success) {
      const errors: ImportError[] = top.error.issues.map((i) => ({ message: `${i.path.join('.') || 'manifest'}: ${i.message}` }));
      throw Object.assign(new HttpError(400, 'BAD_MANIFEST', errors.map((e) => e.message).join('; ')), { errors });
    }
    const m = top.data;
    const errors: ImportError[] = [];
    const cards: z.infer<typeof ManifestCardSchema>[] = [];
    m.cards.forEach((raw, i) => {
      const r = ManifestCardSchema.safeParse(raw);
      const name = (raw as any)?.name;
      if (!r.success) {
        for (const iss of r.error.issues) errors.push({ card: i, name, message: `${iss.path.join('.')}: ${iss.message}` });
      } else cards.push(r.data);
    });
    if (errors.length) throw Object.assign(new HttpError(400, 'BAD_MANIFEST', `${errors.length} card error(s)`), { errors });

    const cache = new Map<string, string>();
    const resolve = async (ref: string | undefined, where: ImportError): Promise<string | undefined> => {
      if (!ref) return undefined;
      if (cache.has(ref)) return cache.get(ref);
      let buf: Buffer;
      try {
        if (ref.startsWith('data:')) {
          const mm = /^data:image\/[a-z+.-]+;base64,(.*)$/s.exec(ref);
          if (!mm) throw new Error('unsupported data URL');
          buf = Buffer.from(mm[1], 'base64');
        } else if (/^https?:\/\//.test(ref)) {
          buf = await fetchImage(ref);
        } else {
          const f = zip?.file(ref.replace(/^\.\//, ''));
          if (!f) throw new Error(`image "${ref}" not found in archive`);
          buf = await f.async('nodebuffer');
        }
        const { id } = await this.app.images.ingest(buf, playerId);
        cache.set(ref, id);
        return id;
      } catch (e) {
        errors.push({ ...where, message: (e as Error).message });
        return undefined;
      }
    };

    const backImageId = await resolve(m.back, { message: '' });
    const usedIds = new Set<string>();
    const defs: CardDef[] = [];
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const where = { card: i, name: c.name, message: '' };
      let id = c.id && !usedIds.has(c.id) ? c.id : newCardId();
      if (usedIds.has(id)) id = newCardId();
      usedIds.add(id);
      const def: CardDef = { id, name: c.name, count: c.count, metadata: c.metadata };
      if (c.description) def.description = c.description;
      const f = await resolve(c.front, where);
      if (f) def.frontImageId = f;
      const b = await resolve(c.back, where);
      if (b) def.backImageId = b;
      if (c.abilities?.length) def.abilities = c.abilities;
      defs.push(def);
    }
    if (errors.length) throw Object.assign(new HttpError(400, 'BAD_MANIFEST', `${errors.length} error(s)`), { errors });
    const content: DeckContent = { name: m.name, propertyTemplate: m.propertyTemplate, cards: defs };
    if (m.description) content.description = m.description;
    if (backImageId) content.backImageId = backImageId;
    const parsed = DeckContentSchema.safeParse(content);
    if (!parsed.success) {
      const errs = parsed.error.issues.map((i) => ({ card: typeof i.path[1] === 'number' ? i.path[1] : undefined, message: `${i.path.join('.')}: ${i.message}` }));
      throw Object.assign(new HttpError(400, 'BAD_MANIFEST', errs.map((e) => e.message).join('; ')), { errors: errs });
    }
    const deckId = this.app.decks.create(playerId, parsed.data);
    this.app.library.addContent(playerId, parsed.data); // imported artwork joins the importer's library
    return deckId;
  }

  // ------------------------------------------------------------------ built-in decks

  seedBuiltIns() {
    const suits = [
      { name: 'Spades', color: 'black' },
      { name: 'Hearts', color: 'red' },
      { name: 'Diamonds', color: 'red' },
      { name: 'Clubs', color: 'black' },
    ];
    const ranks = ['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];
    const short = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const cards: CardDef[] = suits.flatMap((s) =>
      ranks.map((r, i) => ({
        id: `${short[i]}${s.name[0]}`,
        name: `${r} of ${s.name}`,
        count: 1,
        metadata: { suit: s.name, rank: i + 1, rankLabel: short[i], color: s.color },
      })),
    );
    const tmpl = [
      { key: 'suit', type: 'text' as const },
      { key: 'rank', type: 'number' as const },
      { key: 'rankLabel', type: 'text' as const },
      { key: 'color', type: 'text' as const },
    ];
    const decks: { id: string; content: DeckContent }[] = [
      {
        id: 'builtin-standard-52',
        content: { name: 'Standard 52', description: 'A standard 52-card deck.', propertyTemplate: tmpl, cards },
      },
      {
        id: 'builtin-standard-54',
        content: {
          name: 'Standard 52 + Jokers',
          description: 'A standard 52-card deck with two jokers.',
          propertyTemplate: tmpl,
          cards: [...cards, { id: 'JKR', name: 'Joker', count: 2, metadata: { suit: 'Joker', rank: 0, rankLabel: '★', color: 'red' } }],
        },
      },
    ];
    for (const d of decks) {
      if (this.app.decks.row(d.id)) continue;
      this.app.decks.create(null, d.content, { id: d.id, built_in: 1, visibility: 'public' });
    }
  }

  async routes() {
    const http = this.app.http;
    http.get('/api/decks/:id/export', async (req, reply) => {
      const me = this.app.auth(req, false);
      const q = req.query as any;
      const format = q.format === 'json' ? 'json' : 'zip';
      const base = `${req.protocol}://${req.host}`;
      const r = await this.export((req.params as any).id, me?.id ?? null, q.share, format, base);
      reply.header('content-disposition', `attachment; filename="${r.filename}"`);
      if ('zip' in r) return reply.type('application/zip').send(r.zip);
      return reply.type('application/json').send(JSON.stringify(r.manifest, null, 2));
    });

    http.post('/api/decks/import', async (req, reply) => {
      const me = this.app.auth(req)!;
      let id: string;
      try {
        if (req.isMultipart()) {
          const file = await req.file();
          if (!file) throw new HttpError(400, 'NO_FILE', 'Attach a .zip or .json deck file');
          const buf = await file.toBuffer();
          const isZip = buf.subarray(0, 2).toString() === 'PK';
          if (isZip) id = await this.import(me.id, { zip: buf });
          else {
            let manifest: unknown;
            try {
              manifest = JSON.parse(buf.toString('utf8'));
            } catch {
              throw new HttpError(400, 'BAD_MANIFEST', 'File is neither a .zip archive nor valid JSON');
            }
            id = await this.import(me.id, { manifest });
          }
        } else id = await this.import(me.id, { manifest: req.body });
      } catch (e: any) {
        if (e instanceof HttpError && e.errors) return reply.status(400).send({ code: e.code, error: e.message, errors: e.errors });
        throw e;
      }
      return this.app.decks.detail(id, me.id);
    });
  }
}

declare module './util.js' {
  interface HttpError {
    errors?: ImportError[];
  }
}

function slug(s: string) {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'deck';
}
