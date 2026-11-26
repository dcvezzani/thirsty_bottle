import { z } from 'zod';
import { CardDefSchema, ImageIdSchema, type CardDef } from './cards.js';
import type { Plan } from './setups.js';

export const MAX_SEATS = 12;
export const UNDO_WINDOW_MS = 10_000;

export type TableMode = 'realtime' | 'turn';
export type ZoneLayout = 'pile' | 'spread' | 'column' | 'free';
export type ZoneWidth = 'fit' | 'half' | 'full';
const LAYOUTS = ['pile', 'spread', 'column', 'free'] as const;
const WIDTHS = ['fit', 'half', 'full'] as const;

/** Width a zone takes in the board's flow when the host has not chosen one (zone-arrangement). */
export function defaultZoneWidth(layout: ZoneLayout): ZoneWidth {
  return layout === 'pile' || layout === 'column' ? 'fit' : 'full';
}
/** shared: one zone for everyone; hand: a seat's private hand; player: one copy per seat of a per-player zone. */
export type ZoneKind = 'shared' | 'hand' | 'player';

/** A deck snapshot loaded onto a table. Never changes after load (until reload). */
export interface TableDeck {
  id: string;
  sourceDeckId: string | null;
  versionId: string | null;
  name: string;
  backImageId?: string;
  defs: CardDef[];
  /** Zone the deck's cards start in on load/reset. */
  homeZoneId: string;
}

export interface CardInst {
  id: string;
  deckId: string;
  defId: string;
  copyNo: number;
  copyOf: number;
  faceUp: boolean;
  /** card-rotation: steps of 45° clockwise, 1..7; absent = upright. Public, like faceUp. */
  rot?: number;
  /** Player ids the card is currently shown to; '*' = everyone. */
  shownTo: string[];
  shownBy: string | null;
  peekedBy: string[];
}

export interface Zone {
  id: string;
  name: string;
  kind: ZoneKind;
  /** For hand and per-player zones: the seat id that owns it. */
  seatId: string | null;
  /** For per-player zones: the definition shared by every seat's copy (copy id = `<group>:<seatId>`). */
  group?: string;
  layout: ZoneLayout;
  color: string;
  x: number;
  y: number;
  /** Ordered instance ids; index 0 is the top of a pile / leftmost in a spread. */
  cards: string[];
  /** Positions of cards in free layout, 0..1 relative to the zone. */
  pos: Record<string, { x: number; y: number }>;
  /** Width in the board's flow; missing = derived from the layout (defaultZoneWidth). */
  width?: ZoneWidth;
  /** Start a new row in the board's flow. */
  newRow?: boolean;
}

export interface Seat {
  id: string;
  playerId: string | null;
  name: string;
  color: string;
}

export interface Participant {
  playerId: string;
  name: string;
  color: string;
}

export interface Counter {
  id: string;
  label: string;
  value: number;
}

export interface LogEntry {
  id: number;
  at: number;
  actor: string | null;
  text: string;
  /** Per-player alternative text revealing details only that player may know. */
  privateText?: Record<string, string>;
  kind: 'action' | 'system' | 'turn';
  /** Card-action entries can be hidden by players who turn off card-action messages in room chat. */
  cardAction?: boolean;
}

/** card-rotation: a card turns in eight 45° steps. */
export const ROT_STEPS = 8;
export const rotNorm = (n: number) => ((Math.trunc(n) % ROT_STEPS) + ROT_STEPS) % ROT_STEPS;

/** request-expiry: how long a request to take cards or to see a hand waits for an answer. */
export const REQUEST_TTL_MS = 5000;

/** request-hand-view: a seated player asks to see another player's whole hand; allowing shows the hand's cards. */
export interface SeeRequest {
  id: string;
  from: string; // asking player
  seatId: string; // hand owner seat
  at: number;
}

export interface TakeRequest {
  id: string;
  from: string; // requesting player
  seatId: string; // hand owner seat
  /** Zone the cards are taken from; missing = the seat's hand. */
  zone?: string;
  cards: string[];
  to: string; // destination zone
  at: number;
}

export interface Vacated {
  seatId: string;
  playerId: string;
  playerName: string;
}

export interface TableSettings {
  name: string;
  seatLimit: number | null;
  visibility: 'public' | 'private';
  spectatorsAllowed: boolean;
  openHands: boolean;
  playersMaySwitchMode: boolean;
  locked: boolean;
  hasPassword: boolean;
}

export interface TableState {
  id: string;
  createdAt: number;
  hostId: string;
  settings: TableSettings;
  mode: TableMode;
  turn: { active: string | null; direction: 1 | -1 };
  seats: Seat[];
  spectators: Participant[];
  zones: Record<string, Zone>;
  zoneOrder: string[];
  cards: Record<string, CardInst>;
  decks: Record<string, TableDeck>;
  counters: Counter[];
  notes: string;
  log: LogEntry[];
  logSeq: number;
  requests: TakeRequest[];
  vacated: Vacated[];
  /** Monotonic id source for zones, seats, counters etc. (deterministic across replay). */
  idSeq: number;
  /** Seat ids in the order players first sat, used for host auto-transfer. */
  seatedOrder: string[];
  /** The setup last applied to this table (table-setups: Play again). */
  lastSetup?: { id: string; versionId: string; name: string; slots?: Record<string, string> };
  /** request-hand-view: pending asks to see a hand (defaults to empty for older stored tables). */
  seeRequests: SeeRequest[];
  /** 1 once zoneOrder (not x/y) drives the board layout; see migrateState. */
  zoneLayoutVersion?: number;
}

// ---------------------------------------------------------------------------
// Actions (the same shape on the wire, with card references as opaque handles,
// and inside the reducer, with card references resolved to instance ids).
// ---------------------------------------------------------------------------

const id = z.string().min(1).max(100);
const cardList = z.array(id).min(1).max(600);
const zoneColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const TableDeckSchema = z.object({
  id,
  sourceDeckId: z.string().nullable(),
  versionId: z.string().nullable(),
  name: z.string().max(100),
  backImageId: ImageIdSchema.optional(),
  defs: z.array(CardDefSchema),
  homeZoneId: id,
});

export const ActionSchema = z.discriminatedUnion('type', [
  // --- cards
  z.object({
    type: z.literal('move'),
    cards: cardList,
    to: id,
    index: z.number().int().min(0).optional(),
    face: z.enum(['up', 'down']).optional(),
    pos: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
  }),
  z.object({ type: z.literal('flip'), cards: cardList }),
  z.object({ type: z.literal('flipZone'), zone: id, face: z.enum(['up', 'down']).optional() }),
  // card-rotation: exactly one of `by` (steps of 45° clockwise, may be negative) or `to` (0..7, 0 = upright)
  z.object({ type: z.literal('rotate'), cards: cardList, by: z.number().int().min(-7).max(7).optional(), to: z.number().int().min(0).max(7).optional() }),
  z.object({ type: z.literal('rotateZone'), zone: id, by: z.number().int().min(-7).max(7).optional(), to: z.number().int().min(0).max(7).optional() }),
  z.object({ type: z.literal('shuffle'), zone: id }),
  z.object({
    type: z.literal('cut'),
    zone: id,
    depth: z.number().int().min(1).optional(),
    mode: z.enum(['complete', 'split']).default('complete'),
  }),
  z.object({
    type: z.literal('draw'),
    zone: id,
    count: z.number().int().min(1).max(500),
    from: z.enum(['top', 'bottom', 'random']),
    to: id.optional(),
    face: z.enum(['up', 'down']).optional(),
  }),
  z.object({
    type: z.literal('deal'),
    zone: id,
    count: z.number().int().min(1).max(500),
    seats: z.array(id).min(1).max(12),
    startSeat: id.optional(),
    face: z.enum(['up', 'down']).default('down'),
  }),
  z.object({ type: z.literal('show'), cards: cardList, to: z.union([z.literal('all'), z.array(id).min(1)]) }),
  z.object({ type: z.literal('unshow'), cards: cardList }),
  z.object({
    type: z.literal('peek'),
    cards: cardList.optional(),
    zone: id.optional(),
    count: z.number().int().min(1).max(500).optional(),
  }),
  z.object({ type: z.literal('unpeek'), cards: cardList.optional() }),
  /** `deck` (gather-by-deck): only that loaded deck's cards are gathered. */
  z.object({ type: z.literal('gather'), zones: z.union([z.literal('all'), z.array(id).min(1)]), to: id, deck: id.optional() }),
  z.object({ type: z.literal('respondTake'), requestId: id, approve: z.boolean() }),
  // --- request-hand-view
  z.object({ type: z.literal('seeAsk'), seat: id }),
  z.object({ type: z.literal('seeRespond'), requestId: id, approve: z.boolean() }),
  z.object({ type: z.literal('seeCancel'), requestId: id }),
  // --- zones
  z.object({
    type: z.literal('zoneAdd'),
    name: z.string().min(1).max(40),
    layout: z.enum(LAYOUTS),
    color: zoneColor.optional(),
    width: z.enum(WIDTHS).optional(),
    newRow: z.boolean().optional(),
    /** One copy of the zone for every seat (per-player zone). */
    perPlayer: z.boolean().optional(),
    x: z.number().min(0).max(1).optional(),
    y: z.number().min(0).max(1).optional(),
  }),
  z.object({
    type: z.literal('zoneUpdate'),
    zone: id,
    name: z.string().min(1).max(40).optional(),
    layout: z.enum(LAYOUTS).optional(),
    color: zoneColor.optional(),
    /** null returns to the layout's default width. */
    width: z.enum(WIDTHS).nullable().optional(),
    newRow: z.boolean().optional(),
    x: z.number().min(0).max(1).optional(),
    y: z.number().min(0).max(1).optional(),
  }),
  z.object({ type: z.literal('zoneRemove'), zone: id, moveTo: id.optional() }),
  /** Place a shared zone at `index` among the shared zones (hand zones keep their slots). */
  z.object({ type: z.literal('zoneMove'), zone: id, index: z.number().int().min(0) }),
  // --- counters & notes
  z.object({ type: z.literal('counterAdd'), label: z.string().min(1).max(40), value: z.number().int().default(0) }),
  z.object({ type: z.literal('counterChange'), counter: id, delta: z.number().int() }),
  z.object({ type: z.literal('counterSet'), counter: id, value: z.number().int(), label: z.string().max(40).optional() }),
  z.object({ type: z.literal('counterRemove'), counter: id }),
  z.object({ type: z.literal('setNotes'), notes: z.string().max(5000) }),
  // --- turns
  z.object({ type: z.literal('setMode'), mode: z.enum(['realtime', 'turn']), active: id.optional() }),
  z.object({ type: z.literal('endTurn') }),
  z.object({ type: z.literal('reverse') }),
  z.object({ type: z.literal('skip') }),
  z.object({ type: z.literal('setActive'), seat: id }),
  // --- undo
  z.object({ type: z.literal('undo') }),
  // --- host / seating
  z.object({ type: z.literal('setHost'), playerId: id }),
  z.object({
    type: z.literal('settings'),
    name: z.string().min(1).max(60).optional(),
    seatLimit: z.number().int().min(1).max(12).nullable().optional(),
    visibility: z.enum(['public', 'private']).optional(),
    spectatorsAllowed: z.boolean().optional(),
    openHands: z.boolean().optional(),
    playersMaySwitchMode: z.boolean().optional(),
    locked: z.boolean().optional(),
  }),
  z.object({ type: z.literal('moveSeat'), seat: id, toIndex: z.number().int().min(0) }),
  z.object({ type: z.literal('resolveVacated'), seat: id, returnTo: z.union([z.literal('keep'), id]) }),
  z.object({ type: z.literal('reset') }),
  z.object({ type: z.literal('unloadDeck'), deck: id }),
]);
export type Action = z.infer<typeof ActionSchema>;
export type ActionType = Action['type'];

/** Actions only the server issues (seating changes, deck loading); never accepted from clients. */
export type SystemAction =
  | { type: 'seatJoin'; player: Participant; seatId?: string }
  | { type: 'spectate'; player: Participant }
  | { type: 'seatLeave'; playerId: string; reason: 'left' | 'kicked' | 'expired' }
  | { type: 'loadDeck'; deck: z.infer<typeof TableDeckSchema>; zone?: string }
  | { type: 'reloadDeck'; deckId: string; deck: z.infer<typeof TableDeckSchema> }
  | { type: 'autoHost'; playerId: string }
  | { type: 'autoPass' }
  /** request-hand-view: the asker stopped viewing that table, so their pending asks end (except the seat now viewed). */
  | { type: 'seeDrop'; from: string; except?: string }
  /** request-expiry: a take request or a see request went unanswered for REQUEST_TTL_MS. */
  | { type: 'requestExpire'; id: string }
  | { type: 'passwordChanged'; hasPassword: boolean }
  | { type: 'renamePlayer'; playerId: string; name: string; color: string }
  /** table-setups: replace zones, cards and counters with an expanded setup (built by the server). */
  | {
      type: 'applySetup';
      /** `slots`: the source deck used for each slot, so Play again can reuse the host's choices. */
      setup: { id: string; versionId: string; name: string; slots?: Record<string, string> };
      decks: { slot: string; deck: z.infer<typeof TableDeckSchema> }[];
      plan: Plan;
    };

export type AnyAction = Action | SystemAction;

/** Card actions that the take-from-hand / turn gates and undo apply to. */
export const UNDOABLE: ReadonlySet<string> = new Set([
  'applySetup',
  'move',
  'flip',
  'flipZone',
  'rotate',
  'rotateZone',
  'shuffle',
  'cut',
  'draw',
  'deal',
  'show',
  'unshow',
  'peek',
  'unpeek',
  'gather',
  'counterAdd',
  'counterChange',
  'counterSet',
  'counterRemove',
  'setNotes',
  'respondTake',
]);
