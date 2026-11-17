import { cardLabel } from './cards.js';
import {
  MAX_SEATS,
  UNDO_WINDOW_MS,
  UNDOABLE,
  type AnyAction,
  type CardInst,
  type LogEntry,
  type Participant,
  type Seat,
  type TableDeck,
  type TableSettings,
  type TableState,
  type TakeRequest,
  type Zone,
} from './table.js';
import { canSee, handZoneId, isPublic, locate, playerName, seatOfPlayer, zoneOwner } from './visibility.js';

export interface Rng {
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}

export interface Ctx {
  now: number;
  rng: Rng;
  /** Player ids with a live connection (used for turn passing and host designation). */
  connected: ReadonlySet<string>;
}

export type Anim =
  | { kind: 'move'; actor: string | null; items: { card: string; from: string; to: string }[] }
  | { kind: 'flip'; actor: string | null; cards: string[] }
  | { kind: 'shuffle'; actor: string | null; zone: string }
  | { kind: 'deal'; actor: string | null; items: { card: string; from: string; to: string }[] };

export interface ReduceResult {
  state: TableState;
  /** Cards that moved, flipped or were reordered by randomness: hidden handles for these must be regenerated. */
  touched: Set<string>;
  anims: Anim[];
  /** A message for the acting player only (e.g. "Deck is empty"). */
  notice?: string;
  /** A consent request created instead of performing the action. */
  request?: TakeRequest;
}

export class ActionError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const fail = (code: string, message: string): never => {
  throw new ActionError(code, message);
};

const ZONE_COLORS = ['#2f6f4f', '#6b4f2f', '#2f4f6f', '#5f2f6f', '#6f2f3f', '#4f6f2f'];

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export interface CreateTableOptions {
  id: string;
  name: string;
  host: Participant;
  seatLimit: number | null;
  visibility: 'public' | 'private';
  spectatorsAllowed: boolean;
  hasPassword: boolean;
  now: number;
}

export function createTableState(o: CreateTableOptions): TableState {
  const settings: TableSettings = {
    name: o.name,
    seatLimit: o.seatLimit,
    visibility: o.visibility,
    spectatorsAllowed: o.spectatorsAllowed,
    openHands: false,
    playersMaySwitchMode: false,
    locked: false,
    hasPassword: o.hasPassword,
  };
  const s: TableState = {
    id: o.id,
    createdAt: o.now,
    hostId: o.host.playerId,
    settings,
    mode: 'realtime',
    turn: { active: null, direction: 1 },
    seats: [],
    spectators: [],
    zones: {},
    zoneOrder: [],
    cards: {},
    decks: {},
    counters: [],
    notes: '',
    log: [],
    logSeq: 0,
    requests: [],
    vacated: [],
    idSeq: 0,
    seatedOrder: [],
  };
  addZone(s, { name: 'Discard', layout: 'pile', x: 0.7, y: 0.1 });
  addZone(s, { name: 'Table', layout: 'spread', x: 0.05, y: 0.45 });
  const n = o.seatLimit ?? 1;
  for (let i = 0; i < n; i++) addSeat(s);
  s.seats[0].playerId = o.host.playerId;
  s.seats[0].name = o.host.name;
  s.seats[0].color = o.host.color;
  s.seatedOrder.push(o.host.playerId);
  log(s, o.now, o.host.playerId, `${o.host.name} created the table`, 'system');
  return s;
}

function nextId(s: TableState, prefix: string): string {
  s.idSeq += 1;
  return `${prefix}${s.idSeq}`;
}

function addSeat(s: TableState): Seat {
  const seat: Seat = { id: nextId(s, 's'), playerId: null, name: '', color: '#888888' };
  s.seats.push(seat);
  const zid = handZoneId(seat.id);
  s.zones[zid] = {
    id: zid,
    name: 'Hand',
    kind: 'hand',
    seatId: seat.id,
    layout: 'spread',
    color: '#333333',
    x: 0,
    y: 0,
    cards: [],
    pos: {},
  };
  s.zoneOrder.push(zid);
  return seat;
}

function removeSeat(s: TableState, seatId: string) {
  const zid = handZoneId(seatId);
  if (s.zones[zid]?.cards.length) fail('SEAT_HAS_CARDS', 'That seat still holds cards');
  s.seats = s.seats.filter((x) => x.id !== seatId);
  delete s.zones[zid];
  s.zoneOrder = s.zoneOrder.filter((z) => z !== zid);
  s.vacated = s.vacated.filter((v) => v.seatId !== seatId);
  if (s.turn.active === seatId) s.turn.active = null;
}

function addZone(
  s: TableState,
  o: { name: string; layout: Zone['layout']; color?: string; x?: number; y?: number },
): Zone {
  const id = nextId(s, 'z');
  const z: Zone = {
    id,
    name: o.name,
    kind: 'shared',
    seatId: null,
    layout: o.layout,
    color: o.color ?? ZONE_COLORS[s.idSeq % ZONE_COLORS.length],
    x: o.x ?? 0.1,
    y: o.y ?? 0.1,
    cards: [],
    pos: {},
  };
  s.zones[id] = z;
  s.zoneOrder.push(id);
  return z;
}

function log(
  s: TableState,
  at: number,
  actor: string | null,
  text: string,
  kind: LogEntry['kind'] = 'action',
  privateText?: Record<string, string>,
  cardAction = false,
) {
  s.logSeq += 1;
  const e: LogEntry = { id: s.logSeq, at, actor, text, kind };
  if (privateText && Object.keys(privateText).length) e.privateText = privateText;
  if (cardAction) e.cardAction = true;
  s.log.push(e);
  if (s.log.length > 500) s.log.splice(0, s.log.length - 500);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defOf(s: TableState, c: CardInst) {
  const d = s.decks[c.deckId]?.defs.find((x) => x.id === c.defId);
  return d ?? { name: 'Unknown card' };
}

export function nameOfCard(s: TableState, c: CardInst): string {
  return cardLabel(defOf(s, c), c.copyNo, c.copyOf);
}

function listNames(s: TableState, ids: string[]): string {
  const names = ids.map((i) => nameOfCard(s, s.cards[i]));
  if (names.length <= 4) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
}

function plural(n: number, word = 'card') {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Description of cards for the public log: names only if every card is public after the action. */
function publicDesc(s: TableState, ids: string[], loc: Map<string, string>): string {
  const allPublic = ids.every((i) => isPublic(s.cards[i], s.zones[loc.get(i)!]));
  return allPublic ? listNames(s, ids) : plural(ids.length);
}

/** Private log text for each participant who can see all of the cards but for whom they are not public. */
function privateDescs(
  s: TableState,
  ids: string[],
  loc: Map<string, string>,
  make: (viewer: string, names: string) => string,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (ids.every((i) => isPublic(s.cards[i], s.zones[loc.get(i)!]))) return out;
  const viewers = new Set<string>();
  for (const seat of s.seats) if (seat.playerId) viewers.add(seat.playerId);
  for (const v of viewers) {
    if (ids.every((i) => canSee(s, v, s.cards[i], s.zones[loc.get(i)!]))) out[v] = make(v, listNames(s, ids));
  }
  return out;
}

function zoneLabel(s: TableState, zone: Zone): string {
  if (zone.kind === 'hand') {
    const owner = zoneOwner(s, zone);
    if (owner) return `${playerName(s, owner)}'s hand`;
    const idx = s.seats.findIndex((x) => x.id === zone.seatId);
    return `seat ${idx + 1}'s hand`;
  }
  return zone.name;
}

function getZone(s: TableState, id: string): Zone {
  return s.zones[id] ?? fail('NO_ZONE', 'That zone no longer exists');
}

function clearReveal(c: CardInst) {
  c.shownTo = [];
  c.shownBy = null;
  c.peekedBy = [];
}

/** Removes cards from wherever they are. Returns their previous zone ids. */
function detach(s: TableState, ids: string[], loc: Map<string, string>): Map<string, string> {
  const from = new Map<string, string>();
  const set = new Set(ids);
  for (const id of ids) {
    const z = loc.get(id) ?? fail('NO_CARD', 'That card is no longer there');
    from.set(id, z);
  }
  for (const zid of new Set(from.values())) {
    const z = s.zones[zid];
    z.cards = z.cards.filter((c) => !set.has(c));
    for (const c of ids) delete z.pos[c];
  }
  for (const id of ids) loc.delete(id);
  return from;
}

function insert(s: TableState, zone: Zone, ids: string[], index: number | undefined, loc: Map<string, string>) {
  const at = index === undefined ? (zone.layout === 'pile' ? 0 : zone.cards.length) : Math.min(index, zone.cards.length);
  zone.cards.splice(at, 0, ...ids);
  for (const id of ids) loc.set(id, zone.id);
}

function resolveCards(s: TableState, ids: string[]): string[] {
  const uniq = [...new Set(ids)];
  for (const id of uniq) if (!s.cards[id]) fail('NO_CARD', 'That card is no longer there');
  return uniq;
}

function isOwnHand(s: TableState, zone: Zone, actor: string | null) {
  return zone.kind === 'hand' && actor !== null && zoneOwner(s, zone) === actor;
}

/** A hand zone owned by someone other than the actor (and actually occupied). */
function isOthersHand(s: TableState, zone: Zone, actor: string | null) {
  if (zone.kind !== 'hand') return false;
  const owner = zoneOwner(s, zone);
  return owner !== null && owner !== actor;
}

function nextSeat(s: TableState, from: string | null, connected: ReadonlySet<string>, steps = 1): string | null {
  const n = s.seats.length;
  if (!n) return null;
  let idx = from ? s.seats.findIndex((x) => x.id === from) : -1;
  if (idx < 0) idx = s.turn.direction === 1 ? -1 : 0;
  let remaining = steps;
  for (let i = 1; i <= n * (steps + 1); i++) {
    const cand = s.seats[(((idx + i * s.turn.direction) % n) + n) % n];
    if (cand.playerId && connected.has(cand.playerId)) {
      remaining -= 1;
      if (remaining === 0) return cand.id;
    }
  }
  return from;
}

function activePlayerName(s: TableState) {
  const seat = s.seats.find((x) => x.id === s.turn.active);
  return seat?.playerId ? seat.name : 'nobody';
}

function createInstances(s: TableState, deck: TableDeck): string[] {
  const ids: string[] = [];
  for (const def of deck.defs) {
    for (let n = 1; n <= def.count; n++) {
      const id = `${deck.id}:${def.id}:${n}`;
      s.cards[id] = {
        id,
        deckId: deck.id,
        defId: def.id,
        copyNo: n,
        copyOf: def.count,
        faceUp: false,
        shownTo: [],
        shownBy: null,
        peekedBy: [],
      };
      ids.push(id);
    }
  }
  return ids;
}

function removeDeckInstances(s: TableState, deckId: string) {
  const ids = new Set(Object.values(s.cards).filter((c) => c.deckId === deckId).map((c) => c.id));
  for (const z of Object.values(s.zones)) {
    z.cards = z.cards.filter((c) => !ids.has(c));
    for (const c of ids) delete z.pos[c];
  }
  for (const id of ids) delete s.cards[id];
  s.requests = s.requests
    .map((r) => ({ ...r, cards: r.cards.filter((c) => !ids.has(c)) }))
    .filter((r) => r.cards.length);
  return ids;
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

const ADMIN = new Set([
  'zoneAdd',
  'zoneUpdate',
  'zoneRemove',
  'reverse',
  'skip',
  'setActive',
  'setHost',
  'settings',
  'moveSeat',
  'resolveVacated',
  'reset',
  'unloadDeck',
]);

/** Out-of-turn safe actions: they change no shared zone and no other player's zone. */
const ALWAYS_ALLOWED = new Set([
  'show',
  'unshow',
  'peek',
  'unpeek',
  'respondTake',
  'counterAdd',
  'counterChange',
  'counterSet',
  'counterRemove',
  'setNotes',
  'undo',
]);

export function authorize(s: TableState, action: AnyAction, actor: string | null, loc: Map<string, string>) {
  if (actor === null) return; // system action
  const seat = seatOfPlayer(s, actor);
  const isHost = s.hostId === actor;
  if (!seat) fail('SPECTATOR', 'Spectators cannot change the table');
  if (ADMIN.has(action.type)) {
    if (!isHost) fail('NOT_HOST', 'Only the host can do that');
    return;
  }
  if (action.type === 'setMode') {
    if (!isHost && !s.settings.playersMaySwitchMode) fail('NOT_HOST', 'Only the host can switch the mode');
    return;
  }
  if (action.type === 'endTurn') {
    if (s.mode !== 'turn') fail('NOT_TURN_MODE', 'The table is in real-time mode');
    if (s.turn.active !== seat!.id) fail('NOT_YOUR_TURN', `It's ${activePlayerName(s)}'s turn`);
    return;
  }
  if (s.mode !== 'turn' || ALWAYS_ALLOWED.has(action.type) || s.turn.active === seat!.id) return;
  // Turn-based mode, not the active player: allow only changes confined to the actor's own hand.
  const own = (zid: string | undefined) => !!zid && !!s.zones[zid] && isOwnHand(s, s.zones[zid], actor);
  let confined = false;
  switch (action.type) {
    case 'move':
      confined = own(action.to) && action.cards.every((c) => own(loc.get(c)));
      break;
    case 'flip':
      confined = action.cards.every((c) => own(loc.get(c)));
      break;
    case 'flipZone':
    case 'shuffle':
    case 'cut':
      confined = own(action.zone) && !(action.type === 'cut' && action.mode === 'split');
      break;
    default:
      confined = false;
  }
  if (!confined) fail('NOT_YOUR_TURN', `It's ${activePlayerName(s)}'s turn`);
}

// ---------------------------------------------------------------------------
// The reducer
// ---------------------------------------------------------------------------

export function reduce(prev: TableState, action: AnyAction, actor: string | null, ctx: Ctx): ReduceResult {
  const s: TableState = structuredClone(prev);
  const loc = locate(s);
  const touched = new Set<string>();
  const anims: Anim[] = [];
  const res: ReduceResult = { state: s, touched, anims };
  const who = playerName(s, actor);
  const now = ctx.now;

  authorize(s, action, actor, loc);

  const doMove = (
    ids: string[],
    to: Zone,
    opts: { index?: number; face?: 'up' | 'down'; pos?: { x: number; y: number } },
  ) => {
    const from = detach(s, ids, loc);
    for (const id of ids) {
      const c = s.cards[id];
      clearReveal(c);
      if (opts.face) c.faceUp = opts.face === 'up';
      touched.add(id);
    }
    insert(s, to, ids, opts.index, loc);
    if (to.layout === 'free') {
      const base = opts.pos ?? { x: 0.1, y: 0.1 };
      ids.forEach((id, i) => {
        to.pos[id] = { x: Math.min(1, base.x + i * 0.03), y: Math.min(1, base.y + i * 0.01) };
      });
    }
    anims.push({ kind: 'move', actor, items: ids.map((card) => ({ card, from: from.get(card)!, to: to.id })) });
    return from;
  };

  /** Log a move in a way that reveals nothing hidden. */
  const logMove = (ids: string[], from: Map<string, string>, to: Zone, verb?: string) => {
    const fromZones = [...new Set(from.values())].map((z) => s.zones[z] ?? null);
    const desc = publicDesc(s, ids, loc);
    const toOther = isOthersHand(s, to, actor);
    const fromOwnHand = fromZones.every((z) => z && isOwnHand(s, z, actor));
    let text: string;
    let priv: Record<string, string>;
    if (toOther) {
      const target = playerName(s, zoneOwner(s, to));
      text = `${who} passed ${desc} to ${target}`;
      priv = privateDescs(s, ids, loc, (_v, names) => `${who} passed you ${names}`);
      const prevLoc = locate(prev);
      if (actor && ids.every((i) => canSee(prev, actor, prev.cards[i], prev.zones[prevLoc.get(i)!])))
        priv[actor] = `You passed ${listNames(s, ids)} to ${target}`;
    } else if (isOwnHand(s, to, actor) && fromZones.every((z) => z && isOwnHand(s, z, actor))) {
      text = `${who} rearranged their hand`;
      priv = {};
    } else {
      const v = verb ?? (fromOwnHand && to.kind === 'shared' ? 'played' : 'moved');
      const src = fromZones.length === 1 && fromZones[0] ? ` from ${zoneLabel(s, fromZones[0])}` : '';
      text = `${who} ${v} ${desc}${fromOwnHand ? '' : src} to ${zoneLabel(s, to)}`;
      priv = privateDescs(s, ids, loc, (v2, names) =>
        v2 === actor ? `You ${v} ${names}${fromOwnHand ? '' : src} to ${zoneLabel(s, to)}` : '',
      );
      for (const k of Object.keys(priv)) if (!priv[k]) delete priv[k];
    }
    log(s, now, actor, text, 'action', priv, true);
  };

  const needsConsent = (ids: string[]) => {
    if (actor === null || s.settings.openHands) return null;
    for (const id of ids) {
      const z = s.zones[loc.get(id)!];
      if (z && isOthersHand(s, z, actor)) return z;
    }
    return null;
  };

  const makeRequest = (ids: string[], hand: Zone, to: string) => {
    const req: TakeRequest = { id: nextId(s, 'r'), from: actor!, seatId: hand.seatId!, cards: ids, to, at: now };
    s.requests.push(req);
    const owner = playerName(s, zoneOwner(s, hand));
    log(s, now, actor, `${who} asked to take ${plural(ids.length)} from ${owner}'s hand`, 'action', undefined, true);
    res.request = req;
  };

  switch (action.type) {
    // ----------------------------------------------------------------- cards
    case 'move': {
      const ids = resolveCards(s, action.cards);
      const to = getZone(s, action.to);
      const hand = needsConsent(ids);
      if (hand) {
        makeRequest(ids, hand, to.id);
        break;
      }
      const from = doMove(ids, to, action);
      logMove(ids, from, to);
      break;
    }
    case 'flip': {
      const ids = resolveCards(s, action.cards);
      for (const id of ids) {
        const z = s.zones[loc.get(id)!];
        if (isOthersHand(s, z, actor) && !s.settings.openHands)
          fail('OTHERS_HAND', `That card is in ${playerName(s, zoneOwner(s, z))}'s hand`);
      }
      for (const id of ids) {
        s.cards[id].faceUp = !s.cards[id].faceUp;
        touched.add(id);
      }
      anims.push({ kind: 'flip', actor, cards: ids });
      const allUp = ids.every((i) => s.cards[i].faceUp);
      const desc = publicDesc(s, ids, loc);
      log(s, now, actor, `${who} flipped ${desc}${allUp ? ' face up' : ''}`, 'action', undefined, true);
      break;
    }
    case 'flipZone': {
      const z = getZone(s, action.zone);
      if (isOthersHand(s, z, actor) && !s.settings.openHands) fail('OTHERS_HAND', 'That is another player\'s hand');
      if (!z.cards.length) break;
      const target = action.face ? action.face === 'up' : !z.cards.every((c) => s.cards[c].faceUp);
      for (const id of z.cards) {
        s.cards[id].faceUp = target;
        touched.add(id);
      }
      anims.push({ kind: 'flip', actor, cards: [...z.cards] });
      log(s, now, actor, `${who} turned ${zoneLabel(s, z)} face ${target ? 'up' : 'down'}`, 'action', undefined, true);
      break;
    }
    case 'shuffle': {
      const z = getZone(s, action.zone);
      if (isOthersHand(s, z, actor) && !s.settings.openHands) fail('OTHERS_HAND', 'That is another player\'s hand');
      const a = z.cards;
      for (let i = a.length - 1; i > 0; i--) {
        const j = ctx.rng.int(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      for (const id of a) {
        clearReveal(s.cards[id]);
        touched.add(id);
      }
      z.pos = {};
      anims.push({ kind: 'shuffle', actor, zone: z.id });
      log(s, now, actor, `${who} shuffled ${zoneLabel(s, z)}`, 'action', undefined, true);
      break;
    }
    case 'cut': {
      const z = getZone(s, action.zone);
      const n = z.cards.length;
      if (n < 2) fail('TOO_FEW', 'Need at least 2 cards to cut');
      const depth = action.depth ?? 1 + ctx.rng.int(n - 1);
      if (depth >= n) fail('BAD_DEPTH', `Cut depth must be between 1 and ${n - 1}`);
      const top = z.cards.slice(0, depth);
      for (const id of z.cards) touched.add(id);
      if (action.mode === 'split') {
        const nz = addZone(s, { name: `${z.name} (cut)`, layout: 'pile', x: Math.min(0.9, z.x + 0.15), y: z.y });
        z.cards = z.cards.slice(depth);
        nz.cards = top;
        for (const id of top) loc.set(id, nz.id);
        anims.push({ kind: 'move', actor, items: top.map((card) => ({ card, from: z.id, to: nz.id })) });
        log(s, now, actor, `${who} cut ${zoneLabel(s, z)} into two piles (${depth} cards)`, 'action', undefined, true);
      } else {
        z.cards = z.cards.slice(depth).concat(top);
        anims.push({ kind: 'shuffle', actor, zone: z.id });
        log(s, now, actor, `${who} cut ${zoneLabel(s, z)} at ${depth}`, 'action', undefined, true);
      }
      break;
    }
    case 'draw': {
      const src = getZone(s, action.zone);
      const seat = seatOfPlayer(s, actor);
      const to = action.to ? getZone(s, action.to) : seat ? s.zones[handZoneId(seat.id)] : fail('NO_ZONE', 'No hand');
      const avail = src.cards.length;
      if (!avail) {
        res.notice = `${zoneLabel(s, src)} is empty`;
        throw new ActionError('EMPTY', res.notice);
      }
      const k = Math.min(action.count, avail);
      let picked: string[];
      if (action.from === 'top') picked = src.cards.slice(0, k);
      else if (action.from === 'bottom') picked = src.cards.slice(avail - k).reverse();
      else {
        const pool = [...src.cards];
        picked = [];
        for (let i = 0; i < k; i++) picked.push(pool.splice(ctx.rng.int(pool.length), 1)[0]);
      }
      if (isOthersHand(s, src, actor) && !s.settings.openHands && actor) {
        makeRequest(picked, src, to.id);
        break;
      }
      const from = doMove(picked, to, { face: action.face, index: to.layout === 'pile' ? 0 : undefined });
      const where = action.from === 'top' ? 'the top of' : action.from === 'bottom' ? 'the bottom of' : 'random from';
      const desc = publicDesc(s, picked, loc);
      const dest = isOwnHand(s, to, actor) ? '' : ` to ${zoneLabel(s, to)}`;
      const priv = privateDescs(s, picked, loc, (v, names) => (v === actor ? `You drew ${names}` : ''));
      for (const key of Object.keys(priv)) if (!priv[key]) delete priv[key];
      log(s, now, actor, `${who} drew ${desc} from ${where} ${zoneLabel(s, src)}${dest}`, 'action', priv, true);
      void from;
      if (k < action.count) res.notice = `${zoneLabel(s, src)} is empty: drew ${k} of ${action.count}`;
      else if (!src.cards.length) res.notice = `${zoneLabel(s, src)} is now empty`;
      break;
    }
    case 'deal': {
      const src = getZone(s, action.zone);
      const seats = action.seats.map(
        (id) => s.seats.find((x) => x.id === id) ?? fail('NO_SEAT', 'That seat no longer exists'),
      );
      // order seats by table order, rotating so dealing starts at startSeat
      const order = s.seats.filter((x) => seats.includes(x));
      const start = action.startSeat ? order.findIndex((x) => x.id === action.startSeat) : 0;
      const rot = start > 0 ? order.slice(start).concat(order.slice(0, start)) : order;
      const items: { card: string; from: string; to: string }[] = [];
      let dealt = 0;
      outer: for (let round = 0; round < action.count; round++) {
        for (const seat of rot) {
          const card = src.cards.shift();
          if (!card) break outer;
          const hz = s.zones[handZoneId(seat.id)];
          hz.cards.push(card);
          loc.set(card, hz.id);
          const c = s.cards[card];
          clearReveal(c);
          c.faceUp = action.face === 'up';
          touched.add(card);
          items.push({ card, from: src.id, to: hz.id });
          dealt++;
        }
      }
      anims.push({ kind: 'deal', actor, items });
      log(
        s,
        now,
        actor,
        `${who} dealt ${plural(action.count)} to each of ${rot.length} seat${rot.length === 1 ? '' : 's'} from ${zoneLabel(s, src)}`,
        'action',
        undefined,
        true,
      );
      if (dealt < action.count * rot.length) res.notice = `${zoneLabel(s, src)} ran out after ${dealt} cards`;
      break;
    }
    case 'show': {
      const ids = resolveCards(s, action.cards);
      for (const id of ids) {
        if (!canSee(s, actor, s.cards[id], s.zones[loc.get(id)!])) fail('CANNOT_SEE', 'You can only show cards you can see');
      }
      const targets = action.to === 'all' ? ['*'] : [...new Set(action.to.filter((p) => p !== actor))];
      for (const id of ids) {
        const c = s.cards[id];
        c.shownTo = targets.includes('*') ? ['*'] : [...new Set([...c.shownTo.filter((x) => x !== '*'), ...targets])];
        c.shownBy = actor;
      }
      if (targets.includes('*')) {
        log(s, now, actor, `${who} showed ${listNames(s, ids)} to everyone`, 'action', undefined, true);
      } else {
        const names = targets.map((t) => playerName(s, t)).join(', ');
        const priv: Record<string, string> = {};
        for (const t of targets) priv[t] = `${who} showed you ${listNames(s, ids)}`;
        if (actor) priv[actor] = `You showed ${listNames(s, ids)} to ${names}`;
        log(s, now, actor, `${who} showed ${plural(ids.length)} to ${names}`, 'action', priv, true);
      }
      break;
    }
    case 'unshow': {
      const ids = resolveCards(s, action.cards);
      for (const id of ids) {
        const c = s.cards[id];
        const z = s.zones[loc.get(id)!];
        if (c.shownBy !== actor && !isOwnHand(s, z, actor)) fail('NOT_YOURS', 'Only the player who showed it can stop showing');
        c.shownTo = [];
        c.shownBy = null;
      }
      log(s, now, actor, `${who} stopped showing ${plural(ids.length)}`, 'action', undefined, true);
      break;
    }
    case 'peek': {
      let ids: string[];
      if (action.cards) ids = resolveCards(s, action.cards);
      else if (action.zone) ids = getZone(s, action.zone).cards.slice(0, action.count ?? 1);
      else ids = fail('BAD_PEEK', 'Choose cards or a pile to peek at');
      if (!ids.length) fail('EMPTY', 'Nothing to peek at');
      for (const id of ids) {
        const z = s.zones[loc.get(id)!];
        if (isOthersHand(s, z, actor) && !s.settings.openHands) fail('OTHERS_HAND', 'You cannot peek into another player\'s hand');
        const c = s.cards[id];
        if (actor && !c.peekedBy.includes(actor)) c.peekedBy.push(actor);
      }
      const zones = [...new Set(ids.map((i) => loc.get(i)!))];
      const where = zones.length === 1 ? ` in ${zoneLabel(s, s.zones[zones[0]])}` : '';
      const priv: Record<string, string> = {};
      if (actor) priv[actor] = `You peeked at ${listNames(s, ids)}`;
      log(s, now, actor, `${who} peeked at ${plural(ids.length)}${where}`, 'action', priv, true);
      break;
    }
    case 'unpeek': {
      const ids = action.cards ? resolveCards(s, action.cards) : Object.keys(s.cards);
      for (const id of ids) s.cards[id].peekedBy = s.cards[id].peekedBy.filter((p) => p !== actor);
      break;
    }
    case 'gather': {
      const to = getZone(s, action.to);
      const zones =
        action.zones === 'all' ? s.zoneOrder.filter((z) => z !== to.id) : action.zones.filter((z) => z !== to.id);
      const ids: string[] = [];
      for (const zid of zones) {
        const z = getZone(s, zid);
        ids.push(...z.cards);
      }
      const from = ids.length ? detach(s, ids, loc) : new Map<string, string>();
      for (const id of ids) touched.add(id);
      for (const id of to.cards) touched.add(id);
      to.cards.push(...ids);
      to.pos = {};
      for (const id of ids) loc.set(id, to.id);
      for (const id of to.cards) s.cards[id].faceUp = false;
      // Gathering ends every show and peek on the table.
      for (const c of Object.values(s.cards)) clearReveal(c);
      if (ids.length) anims.push({ kind: 'move', actor, items: ids.map((card) => ({ card, from: from.get(card)!, to: to.id })) });
      log(s, now, actor, `${who} gathered ${plural(ids.length)} into ${zoneLabel(s, to)}`, 'action', undefined, true);
      break;
    }
    case 'respondTake': {
      const req = s.requests.find((r) => r.id === action.requestId) ?? fail('NO_REQUEST', 'That request has expired');
      const seat = s.seats.find((x) => x.id === req.seatId);
      if (!seat || seat.playerId !== actor) fail('NOT_YOURS', 'Only the hand owner can answer');
      s.requests = s.requests.filter((r) => r.id !== req.id);
      const requester = playerName(s, req.from);
      if (!action.approve) {
        log(s, now, actor, `${who} declined ${requester}'s request`, 'action', undefined, true);
        break;
      }
      const hand = handZoneId(req.seatId);
      const ids = req.cards.filter((c) => loc.get(c) === hand);
      const to = s.zones[req.to];
      if (!ids.length || !to) {
        log(s, now, actor, `${requester}'s request could no longer be completed`, 'action', undefined, true);
        break;
      }
      doMove(ids, to, {});
      const priv = privateDescs(s, ids, loc, (v, names) =>
        v === req.from ? `You took ${names} from ${who}` : v === actor ? `${requester} took ${names}` : '',
      );
      for (const key of Object.keys(priv)) if (!priv[key]) delete priv[key];
      log(
        s,
        now,
        actor,
        `${requester} took ${publicDesc(s, ids, loc)} from ${who}'s hand${to.kind === 'shared' ? ` to ${to.name}` : ''}`,
        'action',
        priv,
        true,
      );
      break;
    }
    // ----------------------------------------------------------------- zones
    case 'zoneAdd': {
      const z = addZone(s, action);
      log(s, now, actor, `${who} added ${z.name}`, 'system');
      break;
    }
    case 'zoneUpdate': {
      const z = getZone(s, action.zone);
      if (z.kind === 'hand' && (action.name || action.layout)) fail('HAND_ZONE', 'Hands cannot be renamed or relaid');
      if (action.name) z.name = action.name;
      if (action.layout) {
        z.layout = action.layout;
        z.pos = {};
      }
      if (action.color) z.color = action.color;
      if (action.x !== undefined) z.x = action.x;
      if (action.y !== undefined) z.y = action.y;
      break;
    }
    case 'zoneRemove': {
      const z = getZone(s, action.zone);
      if (z.kind === 'hand') fail('HAND_ZONE', 'Hands are removed with their seat');
      const homes = Object.values(s.decks).filter((d) => d.homeZoneId === z.id);
      if (z.cards.length || homes.length) {
        if (!action.moveTo) fail('ZONE_NOT_EMPTY', `${z.name} still has ${plural(z.cards.length)}: choose where to move them`);
        const dest = getZone(s, action.moveTo!);
        if (dest.id === z.id) fail('BAD_TARGET', 'Choose a different zone');
        if (z.cards.length) {
          const ids = [...z.cards];
          const from = doMove(ids, dest, {});
          void from;
        }
        for (const d of homes) d.homeZoneId = dest.id;
      }
      delete s.zones[z.id];
      s.zoneOrder = s.zoneOrder.filter((x) => x !== z.id);
      log(s, now, actor, `${who} removed ${z.name}`, 'system');
      break;
    }
    // ------------------------------------------------------- counters/notes
    case 'counterAdd': {
      const c = { id: nextId(s, 'c'), label: action.label, value: action.value ?? 0 };
      s.counters.push(c);
      log(s, now, actor, `${who} added counter ${c.label}: ${c.value}`, 'action');
      break;
    }
    case 'counterChange':
    case 'counterSet': {
      const c = s.counters.find((x) => x.id === action.counter) ?? fail('NO_COUNTER', 'That counter is gone');
      if (action.type === 'counterChange') c.value += action.delta;
      else {
        c.value = action.value;
        if (action.label) c.label = action.label;
      }
      log(s, now, actor, `${who} set ${c.label} to ${c.value}`, 'action');
      break;
    }
    case 'counterRemove': {
      const c = s.counters.find((x) => x.id === action.counter) ?? fail('NO_COUNTER', 'That counter is gone');
      s.counters = s.counters.filter((x) => x !== c);
      log(s, now, actor, `${who} removed counter ${c.label}`, 'action');
      break;
    }
    case 'setNotes':
      s.notes = action.notes;
      break;
    // ----------------------------------------------------------------- turns
    case 'setMode': {
      if (s.mode === action.mode && !action.active) break;
      s.mode = action.mode;
      if (action.mode === 'turn') {
        const hostSeat = seatOfPlayer(s, s.hostId);
        const chosen = action.active ? s.seats.find((x) => x.id === action.active && x.playerId) : undefined;
        if (action.active && !chosen) fail('NO_SEAT', 'Choose an occupied seat');
        s.turn.active = chosen?.id ?? hostSeat?.id ?? s.seats.find((x) => x.playerId)?.id ?? null;
        log(s, now, actor, `${who} switched to turn-based play: ${activePlayerName(s)}'s turn`, 'turn');
      } else {
        s.turn.active = null;
        log(s, now, actor, `${who} switched to real-time play`, 'turn');
      }
      break;
    }
    case 'endTurn':
    case 'autoPass': {
      if (s.mode !== 'turn') break;
      s.turn.active = nextSeat(s, s.turn.active, ctx.connected);
      log(s, now, actor, `${activePlayerName(s)}'s turn`, 'turn');
      break;
    }
    case 'reverse':
      s.turn.direction = s.turn.direction === 1 ? -1 : 1;
      log(s, now, actor, `${who} reversed the turn direction`, 'turn');
      break;
    case 'skip':
      if (s.mode !== 'turn') fail('NOT_TURN_MODE', 'The table is in real-time mode');
      s.turn.active = nextSeat(s, s.turn.active, ctx.connected, 2);
      log(s, now, actor, `${who} skipped a seat: ${activePlayerName(s)}'s turn`, 'turn');
      break;
    case 'setActive': {
      if (s.mode !== 'turn') fail('NOT_TURN_MODE', 'The table is in real-time mode');
      const seat = s.seats.find((x) => x.id === action.seat && x.playerId) ?? fail('NO_SEAT', 'Choose an occupied seat');
      s.turn.active = seat.id;
      log(s, now, actor, `${who} gave the turn to ${seat.name}`, 'turn');
      break;
    }
    case 'undo':
      fail('NO_UNDO', 'Nothing to undo'); // handled by TableEngine
      break;
    // ---------------------------------------------------------- host/seats
    case 'setHost':
    case 'autoHost': {
      const target = seatOfPlayer(s, action.playerId);
      if (!target) fail('NOT_SEATED', 'Only a seated player can be host');
      if (action.type === 'setHost') {
        if (action.playerId === actor) break;
        if (!ctx.connected.has(action.playerId)) fail('NOT_CONNECTED', `${target!.name} is not connected`);
      }
      s.hostId = action.playerId;
      log(
        s,
        now,
        actor,
        action.type === 'setHost' ? `${who} made ${target!.name} the host` : `${target!.name} is now the host`,
        'system',
      );
      break;
    }
    case 'settings': {
      const st = s.settings;
      if (action.seatLimit !== undefined && action.seatLimit !== st.seatLimit) applySeatLimit(s, action.seatLimit);
      if (action.name) st.name = action.name;
      if (action.visibility) st.visibility = action.visibility;
      if (action.spectatorsAllowed !== undefined) st.spectatorsAllowed = action.spectatorsAllowed;
      if (action.openHands !== undefined) st.openHands = action.openHands;
      if (action.playersMaySwitchMode !== undefined) st.playersMaySwitchMode = action.playersMaySwitchMode;
      if (action.locked !== undefined && action.locked !== st.locked) {
        st.locked = action.locked;
        log(s, now, actor, `${who} ${st.locked ? 'locked' : 'unlocked'} the table`, 'system');
      } else log(s, now, actor, `${who} changed the table settings`, 'system');
      break;
    }
    case 'passwordChanged':
      s.settings.hasPassword = action.hasPassword;
      log(s, now, actor, action.hasPassword ? 'The table now has a password' : 'The table password was removed', 'system');
      break;
    case 'moveSeat': {
      const i = s.seats.findIndex((x) => x.id === action.seat);
      if (i < 0) fail('NO_SEAT', 'That seat no longer exists');
      const [seat] = s.seats.splice(i, 1);
      s.seats.splice(Math.min(action.toIndex, s.seats.length), 0, seat);
      log(s, now, actor, `${who} moved ${seat.name || 'an empty seat'} to seat ${Math.min(action.toIndex, s.seats.length - 1) + 1}`, 'system');
      break;
    }
    case 'resolveVacated': {
      const v = s.vacated.find((x) => x.seatId === action.seat) ?? fail('NO_SEAT', 'Nothing to resolve for that seat');
      s.vacated = s.vacated.filter((x) => x !== v);
      const seat = s.seats.find((x) => x.id === v.seatId);
      if (!seat || action.returnTo === 'keep') {
        log(s, now, actor, `${who} kept ${v.playerName}'s hand at the empty seat`, 'system');
        break;
      }
      const hz = s.zones[handZoneId(seat.id)];
      const dest = getZone(s, action.returnTo);
      if (hz.cards.length) doMove([...hz.cards], dest, { face: 'down' });
      log(s, now, actor, `${who} returned ${v.playerName}'s hand to ${dest.name}`, 'system');
      if (s.settings.seatLimit === null && !seat.playerId) removeSeat(s, seat.id);
      break;
    }
    case 'reset': {
      for (const c of Object.values(s.cards)) {
        clearReveal(c);
        c.faceUp = false;
        touched.add(c.id);
      }
      for (const z of Object.values(s.zones)) {
        z.cards = [];
        z.pos = {};
      }
      for (const d of Object.values(s.decks)) {
        if (!s.zones[d.homeZoneId]) d.homeZoneId = addZone(s, { name: d.name, layout: 'pile', x: 0.1, y: 0.1 }).id;
        const ids = Object.values(s.cards)
          .filter((c) => c.deckId === d.id)
          .sort((a, b) => cardOrder(d, a) - cardOrder(d, b))
          .map((c) => c.id);
        s.zones[d.homeZoneId].cards.push(...ids);
      }
      for (const c of s.counters) c.value = 0;
      s.requests = [];
      if (s.mode === 'turn') s.turn.active = seatOfPlayer(s, s.hostId)?.id ?? null;
      log(s, now, actor, `${who} reset the table`, 'system');
      break;
    }
    case 'loadDeck': {
      if (s.decks[action.deck.id]) fail('DECK_LOADED', 'That deck is already loaded');
      let home: Zone;
      if (action.zone && s.zones[action.zone]) home = s.zones[action.zone];
      else {
        const piles = Object.values(s.decks).length;
        home = addZone(s, { name: action.deck.name, layout: 'pile', x: 0.1 + piles * 0.15, y: 0.1 });
      }
      const deck: TableDeck = { ...action.deck, homeZoneId: home.id };
      s.decks[deck.id] = deck;
      const ids = createInstances(s, deck);
      home.cards.push(...ids);
      log(s, now, actor, `${who} loaded ${deck.name} (${plural(ids.length)})`, 'system');
      break;
    }
    case 'reloadDeck': {
      const old = s.decks[action.deckId] ?? fail('NO_DECK', 'That deck is not loaded');
      removeDeckInstances(s, old.id).forEach((id) => touched.add(id));
      const home = s.zones[old.homeZoneId] ?? addZone(s, { name: action.deck.name, layout: 'pile' });
      const deck: TableDeck = { ...action.deck, id: old.id, homeZoneId: home.id };
      s.decks[deck.id] = deck;
      const ids = createInstances(s, deck);
      home.cards.push(...ids);
      log(s, now, actor, `${who} reloaded ${deck.name} (${plural(ids.length)})`, 'system');
      break;
    }
    case 'unloadDeck': {
      const d = s.decks[action.deck] ?? fail('NO_DECK', 'That deck is not loaded');
      removeDeckInstances(s, d.id).forEach((id) => touched.add(id));
      delete s.decks[d.id];
      log(s, now, actor, `${who} removed ${d.name} from the table`, 'system');
      break;
    }
    case 'seatJoin': {
      const p = action.player;
      if (seatOfPlayer(s, p.playerId)) break;
      let seat: Seat | undefined;
      if (action.seatId) {
        seat = s.seats.find((x) => x.id === action.seatId);
        if (!seat) fail('NO_SEAT', 'That seat no longer exists');
        if (seat!.playerId) fail('SEAT_TAKEN', 'That seat is taken');
      } else {
        seat = s.seats.find((x) => !x.playerId);
      }
      if (!seat) {
        const limit = Math.min(s.settings.seatLimit ?? MAX_SEATS, MAX_SEATS);
        if (s.seats.length >= limit) fail('TABLE_FULL', 'All seats are taken');
        seat = addSeat(s);
      }
      seat.playerId = p.playerId;
      seat.name = p.name;
      seat.color = p.color;
      s.vacated = s.vacated.filter((v) => v.seatId !== seat!.id);
      s.spectators = s.spectators.filter((x) => x.playerId !== p.playerId);
      s.seatedOrder = s.seatedOrder.filter((x) => x !== p.playerId).concat(p.playerId);
      log(s, now, p.playerId, `${p.name} joined seat ${s.seats.indexOf(seat) + 1}`, 'system');
      break;
    }
    case 'spectate': {
      const p = action.player;
      if (seatOfPlayer(s, p.playerId) || s.spectators.some((x) => x.playerId === p.playerId)) break;
      s.spectators.push(p);
      log(s, now, p.playerId, `${p.name} is watching`, 'system');
      break;
    }
    case 'seatLeave': {
      const pid = action.playerId;
      const spect = s.spectators.find((x) => x.playerId === pid);
      if (spect) {
        s.spectators = s.spectators.filter((x) => x !== spect);
        log(s, now, pid, `${spect.name} stopped watching`, 'system');
        break;
      }
      const seat = seatOfPlayer(s, pid);
      if (!seat) break;
      const name = seat.name;
      const wasActive = s.turn.active === seat.id;
      seat.playerId = null;
      s.seatedOrder = s.seatedOrder.filter((x) => x !== pid);
      s.requests = s.requests.filter((r) => r.from !== pid && r.seatId !== seat.id);
      for (const c of Object.values(s.cards)) {
        c.shownTo = c.shownTo.filter((x) => x !== pid);
        c.peekedBy = c.peekedBy.filter((x) => x !== pid);
        if (c.shownBy === pid) {
          c.shownTo = [];
          c.shownBy = null;
        }
      }
      const hz = s.zones[handZoneId(seat.id)];
      const verb = action.reason === 'kicked' ? 'was removed from the table' : 'left';
      log(s, now, pid, `${name} ${verb}`, 'system');
      if (hz.cards.length) s.vacated.push({ seatId: seat.id, playerName: name });
      else if (s.settings.seatLimit === null) removeSeat(s, seat.id);
      if (wasActive && s.mode === 'turn') {
        s.turn.active = nextSeat(s, seat.id, ctx.connected);
        if (s.turn.active === seat.id) s.turn.active = null;
        log(s, now, null, `${activePlayerName(s)}'s turn`, 'turn');
      }
      if (s.hostId === pid) {
        const next = s.seatedOrder.find((x) => ctx.connected.has(x)) ?? s.seatedOrder[0];
        if (next) {
          s.hostId = next;
          log(s, now, null, `${playerName(s, next)} is now the host`, 'system');
        }
      }
      break;
    }
    case 'renamePlayer': {
      const seat = seatOfPlayer(s, action.playerId);
      if (seat) {
        seat.name = action.name;
        seat.color = action.color;
      }
      const sp = s.spectators.find((x) => x.playerId === action.playerId);
      if (sp) {
        sp.name = action.name;
        sp.color = action.color;
      }
      break;
    }
    default: {
      const never: never = action;
      fail('BAD_ACTION', `Unknown action ${(never as any).type}`);
    }
  }
  return res;
}

function cardOrder(d: TableDeck, c: CardInst): number {
  const i = d.defs.findIndex((x) => x.id === c.defId);
  return i * 10000 + c.copyNo;
}

function applySeatLimit(s: TableState, limit: number | null) {
  const seated = s.seats.filter((x) => x.playerId).length;
  if (limit !== null && limit < seated) fail('TOO_FEW_SEATS', `There are already ${seated} seated players`);
  const removable = () =>
    [...s.seats].reverse().find((x) => !x.playerId && !s.zones[handZoneId(x.id)].cards.length);
  if (limit === null) {
    let r;
    while ((r = removable())) removeSeat(s, r.id);
  } else {
    while (s.seats.length < limit) addSeat(s);
    while (s.seats.length > limit) {
      const r = removable();
      if (!r) fail('TOO_FEW_SEATS', 'Empty seats still hold cards; resolve them first');
      removeSeat(s, r!.id);
    }
  }
  s.settings.seatLimit = limit;
}

// ---------------------------------------------------------------------------
// Engine with single-step undo
// ---------------------------------------------------------------------------

export interface UndoInfo {
  actor: string;
  at: number;
  prev: TableState;
}

export class TableEngine {
  undo: UndoInfo | null = null;
  constructor(public state: TableState) {}

  dispatch(action: AnyAction, actor: string | null, ctx: Ctx): ReduceResult {
    if (action.type === 'undo') return this.applyUndo(actor, ctx);
    const prev = this.state;
    const res = reduce(prev, action, actor, ctx);
    this.state = res.state;
    if (actor && UNDOABLE.has(action.type) && !res.request) this.undo = { actor, at: ctx.now, prev };
    else this.undo = null;
    return res;
  }

  canUndo(actor: string, now: number): boolean {
    return !!this.undo && this.undo.actor === actor && now - this.undo.at <= UNDO_WINDOW_MS;
  }

  private applyUndo(actor: string | null, ctx: Ctx): ReduceResult {
    if (!actor || !this.undo || this.undo.actor !== actor) throw new ActionError('NO_UNDO', 'Nothing to undo');
    if (ctx.now - this.undo.at > UNDO_WINDOW_MS) throw new ActionError('UNDO_EXPIRED', 'Too late to undo');
    if (!seatOfPlayer(this.state, actor)) throw new ActionError('SPECTATOR', 'Spectators cannot change the table');
    const cur = this.state;
    const restored: TableState = structuredClone(this.undo.prev);
    // Keep the history: the log and id sequence move forward.
    restored.log = structuredClone(cur.log);
    restored.logSeq = cur.logSeq;
    restored.idSeq = Math.max(restored.idSeq, cur.idSeq);
    // Membership may not be rolled back by an undo (it cannot have changed: any seat change clears undo).
    log(restored, ctx.now, actor, `${playerName(restored, actor)} undid their last action`, 'action', undefined, true);
    const touched = new Set([...Object.keys(cur.cards), ...Object.keys(restored.cards)]);
    const before = locate(cur);
    const after = locate(restored);
    const items = [...after.entries()]
      .filter(([c, z]) => before.get(c) !== z && before.has(c))
      .map(([card, to]) => ({ card, from: before.get(card)!, to }));
    this.state = restored;
    this.undo = null;
    return { state: restored, touched, anims: items.length ? [{ kind: 'move', actor, items }] : [] };
  }
}
