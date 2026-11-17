import { z } from 'zod';
import { ActionSchema, type Counter, type LogEntry, type Participant, type TableMode, type TableSettings, type ZoneKind, type ZoneLayout } from './table.js';
import type { CardDef } from './cards.js';

export const MAX_MESSAGE_BYTES = 64 * 1024;
export const CHAT_MAX_CHARS = 500;
export const CHAT_HISTORY = 100;
export const RECONNECT_GRACE_MS = 120_000;
export const DISCONNECTED_MARK_MS = 5_000;
export const EMPTY_TABLE_TTL_MS = 30 * 60_000;

export const PlayerColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const DisplayNameSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1).max(24));

// ---------------------------------------------------------------------------
// Views (server → client, already filtered for the recipient)
// ---------------------------------------------------------------------------

export interface CardView {
  /** Opaque per-viewer handle. */
  h: string;
  faceUp: boolean;
  /** Back image for this card (card-specific or deck default); undefined = generated back. */
  back?: string;
  /** True when the viewer can see the face. Identity fields are present only then. */
  known: boolean;
  deck?: string;
  def?: string;
  copyNo?: number;
  copyOf?: number;
  /** For the holder/shower: players the card is shown to ('*' = everyone). */
  shownTo?: string[];
  /** For a recipient: who is showing it. */
  shownBy?: string;
  /** Viewer is privately peeking at it. */
  peeked?: boolean;
  x?: number;
  y?: number;
}

export interface ZoneView {
  id: string;
  name: string;
  kind: ZoneKind;
  seatId: string | null;
  layout: ZoneLayout;
  color: string;
  x: number;
  y: number;
  cards: CardView[];
}

export interface SeatView {
  id: string;
  index: number;
  playerId: string | null;
  name: string;
  color: string;
  connected: boolean;
  /** Disconnected for longer than the 5 s grace before marking. */
  disconnected: boolean;
  handCount: number;
}

export interface TableDeckView {
  id: string;
  sourceDeckId: string | null;
  versionId: string | null;
  name: string;
  backImageId?: string;
  defs: CardDef[];
  homeZoneId: string;
  /** Host-only hint: the source deck has a newer saved version. */
  newerVersion?: boolean;
}

export interface LogView {
  id: number;
  at: number;
  actor: string | null;
  text: string;
  kind: LogEntry['kind'];
  cardAction?: boolean;
}

export interface RequestView {
  id: string;
  from: string;
  fromName: string;
  seatId: string;
  count: number;
  to: string;
  /** 'incoming' = someone wants cards from my hand. */
  dir: 'incoming' | 'outgoing';
}

export interface TableView {
  id: string;
  version: number;
  settings: TableSettings;
  mode: TableMode;
  turn: { active: string | null; direction: 1 | -1 };
  hostId: string;
  seats: SeatView[];
  spectators: Participant[];
  zones: ZoneView[];
  decks: TableDeckView[];
  counters: Counter[];
  notes: string;
  log: LogView[];
  requests: RequestView[];
  vacated: { seatId: string; playerName: string }[];
  me: { playerId: string; seatId: string | null; isHost: boolean; spectator: boolean };
  canUndo: boolean;
  /** Milliseconds left in the undo window for my last action (approximate). */
  undoMsLeft: number;
}

export type AnimView =
  | { kind: 'move' | 'deal'; actor: string | null; items: { from: string; to: string; fromH?: string; toH: string }[] }
  | { kind: 'flip'; actor: string | null; handles: string[] }
  | { kind: 'shuffle'; actor: string | null; zone: string };

export interface TablePatch {
  version: number;
  zones?: ZoneView[];
  zoneOrder?: string[];
  meta?: Partial<Omit<TableView, 'zones' | 'log' | 'version'>>;
  log?: LogView[];
  anims?: AnimView[];
}

export interface PlayerPublic {
  id: string;
  name: string;
  /** Short suffix disambiguating colliding names, e.g. "#2". */
  suffix: string;
  color: string;
  status: 'lobby' | 'table' | 'offline';
  tableId?: string;
  tableName?: string;
}

export interface TableSummary {
  id: string;
  name: string;
  hostName: string;
  seated: number;
  seatLimit: number | null;
  mode: TableMode;
  decks: string[];
  locked: boolean;
  visibility: 'public' | 'private';
  hasPassword: boolean;
  spectatorsAllowed: boolean;
  spectators: number;
}

export interface ChatMessage {
  id: number;
  channel: string;
  at: number;
  playerId: string | null;
  name: string;
  color: string;
  text: string;
  system?: boolean;
  cardAction?: boolean;
}

// ---------------------------------------------------------------------------
// Client → server messages
// ---------------------------------------------------------------------------

const rid = z.number().int().nonnegative().optional();
const tableId = z.string().min(1).max(64);

export const ClientMessageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('hello'), rid, token: z.string().min(16).max(128) }),
  z.object({ t: z.literal('ping'), rid }),
  z.object({
    t: z.literal('table.create'),
    rid,
    name: z.string().trim().min(1).max(60),
    seatLimit: z.number().int().min(1).max(12).nullable().optional(),
    visibility: z.enum(['public', 'private']).default('public'),
    password: z.string().max(100).optional(),
    spectatorsAllowed: z.boolean().default(true),
    deckId: z.string().max(64).optional(),
    shareToken: z.string().max(64).optional(),
  }),
  z.object({
    t: z.literal('table.join'),
    rid,
    tableId,
    password: z.string().max(100).optional(),
    seatId: z.string().max(64).optional(),
    spectate: z.boolean().optional(),
  }),
  z.object({ t: z.literal('table.leave'), rid, tableId }),
  z.object({ t: z.literal('table.snapshot'), rid, tableId }),
  z.object({ t: z.literal('table.intent'), rid, tableId, seq: z.number().int().nonnegative(), action: ActionSchema }),
  z.object({
    t: z.literal('table.drag'),
    tableId,
    handles: z.array(z.string().max(64)).max(600),
    x: z.number(),
    y: z.number(),
    end: z.boolean().optional(),
  }),
  z.object({ t: z.literal('table.kick'), rid, tableId, playerId: z.string().max(64) }),
  z.object({ t: z.literal('table.password'), rid, tableId, password: z.string().max(100).nullable() }),
  z.object({ t: z.literal('table.close'), rid, tableId }),
  z.object({
    t: z.literal('table.loadDeck'),
    rid,
    tableId,
    deckId: z.string().max(64),
    shareToken: z.string().max(64).optional(),
  }),
  z.object({ t: z.literal('table.reloadDeck'), rid, tableId, tableDeckId: z.string().max(64) }),
  z.object({ t: z.literal('chat.send'), rid, channel: z.string().max(80), text: z.string().max(2000) }),
  z.object({ t: z.literal('chat.mute'), rid, playerId: z.string().max(64), muted: z.boolean() }),
  z.object({
    t: z.literal('chat.roomMute'),
    rid,
    tableId,
    playerId: z.string().max(64),
    muted: z.boolean(),
  }),
  z.object({ t: z.literal('profile'), rid, name: DisplayNameSchema, color: PlayerColorSchema }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ---------------------------------------------------------------------------
// Server → client messages
// ---------------------------------------------------------------------------

export type ServerMessage =
  | { t: 'welcome'; player: PlayerPublic; serverTime: number }
  | { t: 'reply'; rid: number; ok: true; data?: any }
  | { t: 'reply'; rid: number; ok: false; code: string; error: string }
  | { t: 'error'; code: string; error: string }
  | { t: 'pong' }
  | { t: 'lobby'; players: PlayerPublic[]; tables: TableSummary[] }
  | { t: 'table.snapshot'; table: TableView }
  | { t: 'table.patch'; tableId: string; patch: TablePatch }
  | { t: 'table.ack'; tableId: string; seq: number; ok: boolean; code?: string; error?: string; notice?: string }
  | { t: 'table.drag'; tableId: string; playerId: string; color: string; handles: string[]; x: number; y: number; end?: boolean }
  | { t: 'table.left'; tableId: string; reason: 'left' | 'kicked' | 'closed' | 'expired' }
  | { t: 'chat.history'; channel: string; messages: ChatMessage[] }
  | { t: 'chat.msg'; message: ChatMessage }
  | { t: 'chat.muted'; muted: string[] }
  | { t: 'session.replaced' }
  | { t: 'notice'; text: string };

export function tableChannel(tableId: string) {
  return `table:${tableId}`;
}
