import { z } from 'zod';
import type { TableState, Zone, ZoneLayout, ZoneWidth } from './table.js';
import { boardSlots } from './visibility.js';

/**
 * Table setups (table-setups): a saved recipe for a table: zones, deck slots, the deal (counts and
 * faces, or an exact fixed deal), per-seat elements, counters and a player range. `expandSetup`
 * turns a setup into a concrete plan for the players seated when it is applied. Pure.
 */

const key = z.string().min(1).max(40);
const label = z.string().trim().min(1).max(40);

/** A card count: a number, 'rest' (whatever remains in the slot), or a number that depends on players. */
const N = z.union([z.number().int().min(0).max(1000), z.literal('rest')]);
export const SetupCountSchema = z.union([
  N,
  z.object({
    byPlayers: z
      .array(z.object({ min: z.number().int().min(1).max(12), max: z.number().int().min(1).max(12), n: N }))
      .max(12),
  }),
]);
export type SetupCount = z.infer<typeof SetupCountSchema>;

export const SetupSlotSchema = z.object({
  id: key,
  label: label,
  /** Deck used unless the host picks another when applying. */
  defaultDeckId: z.string().max(64).nullable(),
});

export const SetupZoneSchema = z.object({
  key,
  /** For per-seat zones, `{name}` is replaced by the player's name. */
  name: label,
  layout: z.enum(['pile', 'spread', 'column', 'free']),
  width: z.enum(['fit', 'half', 'full']).optional(),
  newRow: z.boolean().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  perSeat: z.boolean().optional(),
  /** Slot this zone's cards come from (defaults to the first slot). */
  slot: key.optional(),
  down: SetupCountSchema.default(0),
  up: SetupCountSchema.default(0),
});

const fixedCard = z.object({ slot: key, defId: z.string().max(100), copyNo: z.number().int().min(1), faceUp: z.boolean() });

export const SetupContentSchema = z.object({
  name: label,
  players: z.object({ min: z.number().int().min(1).max(12), max: z.number().int().min(1).max(12) }),
  slots: z.array(SetupSlotSchema).max(8),
  /** Zone that receives each slot's deck and whatever is left after the deal. */
  homes: z.record(key, key),
  zones: z.array(SetupZoneSchema).max(60),
  hands: z
    .object({ slot: key.optional(), count: SetupCountSchema, face: z.enum(['down', 'up']).default('down') })
    .optional(),
  counters: z.array(z.object({ label, value: z.number().int().min(-1_000_000).max(1_000_000).default(0), perSeat: z.boolean().optional() })).max(40),
  /** Opt-in exact arrangement, for the player count it was recorded with. */
  fixed: z
    .object({
      players: z.number().int().min(1).max(12),
      deckVersions: z.record(key, z.string().max(64)),
      /** Keyed by zone key; per-seat zones as `key#seatIndex`. Top of a pile / start of a row first. */
      zones: z.record(z.string().max(60), z.array(fixedCard)),
      hands: z.array(z.array(fixedCard)),
    })
    .optional(),
});
export type SetupContent = z.infer<typeof SetupContentSchema>;
export type SetupZone = z.infer<typeof SetupZoneSchema>;

// ------------------------------------------------------------------------------------- the plan

export interface PlanZone {
  key: string;
  name: string;
  layout: ZoneLayout;
  width?: ZoneWidth;
  newRow?: boolean;
  color?: string;
  /** One copy per seat (per-player zone); deals target `{ zone, seat }`. */
  perPlayer?: boolean;
}
export type PlanTarget = { zone: string } | { zone: string; seat: number } | { hand: number };
export interface PlanDeal {
  slot: string;
  to: PlanTarget;
  faceUp: boolean;
  count: number;
}
export interface Plan {
  zones: PlanZone[];
  /** slot id -> zone key that receives the deck and the leftovers. */
  homes: Record<string, string>;
  /** In order; each takes `count` cards from the top of the slot's shuffled deck. */
  deals: PlanDeal[];
  /** Fixed deal: exact cards, placed in this order (the slot's other cards go home, unshuffled). */
  fixed?: { slot: string; defId: string; copyNo: number; to: PlanTarget; faceUp: boolean }[];
  counters: { label: string; value: number }[];
}

export type ExpandResult = { ok: true; plan: Plan } | { ok: false; code: string; message: string };

export interface ExpandInput {
  /** Seated players in deal order (starting with the host's seat). */
  seats: { name: string }[];
  /** Cards in the deck chosen for each slot. */
  deckSizes: Record<string, number>;
  /** Saved version of the deck chosen for each slot (checked against a fixed deal). */
  deckVersions?: Record<string, string | null>;
}

const fail = (code: string, message: string): ExpandResult => ({ ok: false, code, message });

/** A per-seat zone's name without its "{name}" placeholder: "{name}'s Tableau" -> "Tableau". */
export function perPlayerName(name: string): string {
  return name.replace(/\{name\}('s)?\s*/g, '').trim() || 'Area';
}

/** Resolves a count for `players` seated players (no matching rule = 0). */
export function resolveCount(c: SetupCount, players: number): number | 'rest' {
  if (typeof c === 'number' || c === 'rest') return c;
  return c.byPlayers.find((r) => players >= r.min && players <= r.max)?.n ?? 0;
}

const named = (s: string, name: string) => s.replaceAll('{name}', name);

/** Structural checks a saved setup must pass (beyond the schema). Returns an error message or null. */
export function checkSetup(c: SetupContent): string | null {
  if (c.players.min > c.players.max) return 'The player range is backwards';
  const slots = new Set(c.slots.map((s) => s.id));
  const zones = new Map(c.zones.map((z) => [z.key, z]));
  if (zones.size !== c.zones.length) return 'Two zones share a key';
  for (const s of c.slots) {
    const h = c.homes[s.id];
    const z = h ? zones.get(h) : undefined;
    if (!z) return `Deck slot "${s.label}" needs a home zone`;
    if (z.perSeat) return `Deck slot "${s.label}" cannot live in a per-seat zone`;
  }
  for (const z of c.zones) if (z.slot && !slots.has(z.slot)) return `Zone "${z.name}" uses a missing deck slot`;
  if (c.hands?.slot && !slots.has(c.hands.slot)) return 'Hands use a missing deck slot';
  const deals = c.zones.some((z) => z.down !== 0 || z.up !== 0) || !!c.hands;
  if (deals && !c.slots.length) return 'Cards are dealt but the setup has no deck';
  return null;
}

/**
 * Expands a setup for the seated players. Deal order: zones in order (a pile gets its face-up
 * cards first so they end up on top; other layouts get face-down first so face-up cards are last),
 * per-seat zones per seat, then hands round-robin from the first seat. 'rest' takes what is left
 * after every fixed count of that slot; extra cards from a 'rest' deal go to the first seats.
 */
export function expandSetup(c: SetupContent, input: ExpandInput): ExpandResult {
  const n = input.seats.length;
  if (n < c.players.min || n > c.players.max) {
    const range = c.players.min === c.players.max ? `${c.players.min}` : `${c.players.min} to ${c.players.max}`;
    return fail('PLAYER_RANGE', `${c.name} is for ${range} player${c.players.max === 1 ? '' : 's'}; ${n} ${n === 1 ? 'is' : 'are'} seated`);
  }
  const bad = checkSetup(c);
  if (bad) return fail('BAD_SETUP', bad);
  const firstSlot = c.slots[0]?.id;
  for (const s of c.slots) if (input.deckSizes[s.id] === undefined) return fail('NO_DECK', `Choose a deck for "${s.label}"`);

  // zones; a per-seat zone becomes one per-player zone, dealt into each seat's copy
  const zones: PlanZone[] = [];
  const dealZones: { to: PlanTarget; z: SetupZone }[] = [];
  for (const z of c.zones) {
    const base = { layout: z.layout, ...(z.width ? { width: z.width } : {}), ...(z.color ? { color: z.color } : {}), ...(z.newRow ? { newRow: true } : {}) };
    if (z.perSeat) {
      zones.push({ key: z.key, name: perPlayerName(z.name), ...base, perPlayer: true });
      input.seats.forEach((_seat, i) => dealZones.push({ to: { zone: z.key, seat: i }, z }));
    } else {
      zones.push({ key: z.key, name: z.name, ...base });
      dealZones.push({ to: { zone: z.key }, z });
    }
  }
  const counters = c.counters.flatMap((k) =>
    k.perSeat ? input.seats.map((s) => ({ label: named(k.label, s.name), value: k.value })) : [{ label: k.label, value: k.value }],
  );

  if (c.fixed) {
    if (c.fixed.players !== n)
      return fail('FIXED_PLAYERS', `${c.name} has a fixed deal for ${c.fixed.players} player${c.fixed.players === 1 ? '' : 's'}; ${n} ${n === 1 ? 'is' : 'are'} seated`);
    for (const [slot, v] of Object.entries(c.fixed.deckVersions))
      if (input.deckVersions && input.deckVersions[slot] !== v) return fail('FIXED_DECK', `${c.name}'s fixed deal needs the deck version it was recorded with`);
    const fixed: NonNullable<Plan['fixed']> = [];
    for (const [k, cards] of Object.entries(c.fixed.zones)) {
      // a per-seat zone's copies are recorded as "<key>#<seat index>"
      const m = /^(.*)#(\d+)$/.exec(k);
      const to: PlanTarget = m ? { zone: m[1], seat: Number(m[2]) } : { zone: k };
      for (const card of cards) fixed.push({ ...card, to });
    }
    c.fixed.hands.forEach((cards, i) => cards.forEach((card) => fixed.push({ ...card, to: { hand: i } })));
    return { ok: true, plan: { zones, homes: { ...c.homes }, deals: [], fixed, counters } };
  }

  // fixed counts first (to know how much 'rest' gets), then emit deals in order
  type Req = { slot: string; to: PlanTarget; faceUp: boolean; count: number | 'rest' };
  const reqs: Req[] = [];
  for (const { to, z } of dealZones) {
    const slot = z.slot ?? firstSlot;
    const down = resolveCount(z.down, n);
    const up = resolveCount(z.up, n);
    const parts: Req[] = [
      { slot, to, faceUp: false, count: down },
      { slot, to, faceUp: true, count: up },
    ];
    if (z.layout === 'pile') parts.reverse();
    reqs.push(...parts.filter((p) => p.count !== 0));
  }
  const handCount = c.hands ? resolveCount(c.hands.count, n) : 0;
  const handSlot = c.hands?.slot ?? firstSlot;
  const handUp = c.hands?.face === 'up';

  const used: Record<string, number> = {};
  for (const r of reqs) if (r.count !== 'rest') used[r.slot] = (used[r.slot] ?? 0) + r.count;
  if (typeof handCount === 'number' && handCount > 0) used[handSlot] = (used[handSlot] ?? 0) + handCount * n;
  for (const s of c.slots) {
    const size = input.deckSizes[s.id];
    if ((used[s.id] ?? 0) > size)
      return fail('TOO_FEW_CARDS', `The deck for "${s.label}" has ${size} cards; this deal needs ${used[s.id]}`);
  }
  const restUsers = (slot: string) => reqs.filter((r) => r.slot === slot && r.count === 'rest').length + (handCount === 'rest' && handSlot === slot ? 1 : 0);
  for (const s of c.slots) if (restUsers(s.id) > 1) return fail('BAD_SETUP', `Only one deal can take all remaining cards of "${s.label}"`);
  const left = (slot: string) => input.deckSizes[slot] - (used[slot] ?? 0);

  const deals: PlanDeal[] = reqs.map((r) => ({ slot: r.slot, to: r.to, faceUp: r.faceUp, count: r.count === 'rest' ? left(r.slot) : r.count })).filter((d) => d.count > 0);
  if (c.hands && handSlot) {
    const total = handCount === 'rest' ? left(handSlot) : handCount * n;
    for (let k = 0; k < total; k++) deals.push({ slot: handSlot, to: { hand: k % n }, faceUp: handUp, count: 1 });
  }
  return { ok: true, plan: { zones, homes: { ...c.homes }, deals, counters } };
}

// --------------------------------------------------------------------------------- the library

export type SetupStatus = 'active' | 'archived';
export type SetupVisibility = 'private' | 'link' | 'public';
export interface SetupSummary {
  id: string;
  name: string;
  status: SetupStatus;
  ownerId: string | null;
  ownerName: string | null;
  /** True when the viewer owns it (can edit). */
  mine: boolean;
  builtIn: boolean;
  visibility: SetupVisibility;
  /** Owner only. */
  shareToken?: string | null;
  clonedFromLabel: string | null;
  cloneCount: number;
  players: { min: number; max: number };
  zoneCount: number;
  slots: {
    id: string;
    label: string;
    defaultDeckId: string | null;
    defaultDeckName: string | null;
    /** Other players can use the default deck (built-in, public or link). */
    defaultDeckShareable: boolean;
    /** The viewer can load the default deck. */
    defaultDeckUsable: boolean;
  }[];
  fixed: boolean;
  currentVersionId: string;
  hasDraft: boolean;
  updatedAt: number;
}
export interface SetupDetail extends SetupSummary {
  content: SetupContent;
  /** Owner only. */
  draft: SetupContent | null;
}

/** An empty setup to start editing from. */
export function blankSetup(name: string): SetupContent {
  return { name, players: { min: 1, max: 12 }, slots: [], homes: {}, zones: [], counters: [] };
}

// ------------------------------------------------------------------------- recording (D4)

/**
 * "Save table as setup": turns a live table into setup content. Zones keep their order, layout,
 * width, new row and color; each loaded deck becomes a slot (its source deck as the default);
 * zones record how many cards they hold face down and face up (a deck's home zone keeps the rest);
 * equal hands become a per-seat hand; counters named after a seated player become per-seat
 * "{name} …" counters. With `fixed`, the exact arrangement and deck versions are recorded too.
 */
export function recordSetup(state: TableState, opts: { name: string; fixed?: boolean }): SetupContent {
  // shared zones and each per-player group once (its first copy stands for the group)
  const sharedZones = boardSlots(state.zoneOrder.map((id) => state.zones[id]).filter(Boolean));
  const keyOf = new Map(sharedZones.map((z, i) => [z.id, `z${i + 1}`]));
  const decks = Object.values(state.decks);
  const slotOf = new Map(decks.map((d, i) => [d.id, `s${i + 1}`]));
  const slots = decks.map((d) => ({ id: slotOf.get(d.id)!, label: d.name.slice(0, 40), defaultDeckId: d.sourceDeckId ?? null }));
  const homes: Record<string, string> = {};
  for (const d of decks) homes[slotOf.get(d.id)!] = keyOf.get(d.homeZoneId) ?? keyOf.get(sharedZones.find((z) => z.layout === 'pile')?.id ?? '') ?? 'z1';
  const homeKeys = new Set(Object.values(homes));
  const majoritySlot = (cardIds: string[]) => {
    const tally = new Map<string, number>();
    for (const id of cardIds) {
      const sl = slotOf.get(state.cards[id]?.deckId ?? '');
      if (sl) tally.set(sl, (tally.get(sl) ?? 0) + 1);
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const firstSlot = slots[0]?.id;
  const seated = state.seats.filter((x) => x.playerId);
  const hostAt = Math.max(0, seated.findIndex((x) => x.playerId === state.hostId));
  const order = seated.slice(hostAt).concat(seated.slice(0, hostAt));
  /** A per-player group's copies for the seated players, in deal order. */
  const copiesFor = (z: Zone) => order.map((x) => state.zones[`${z.group}:${x.id}`]).filter(Boolean);
  const zones: SetupZone[] = sharedZones.map((z) => {
    const key = keyOf.get(z.id)!;
    const isHome = homeKeys.has(key);
    // per-player: the deal of the copies (all equal), else of the first copy
    const sample = z.kind === 'player' ? copiesFor(z)[0] ?? z : z;
    const down = isHome ? 0 : sample.cards.filter((c) => !state.cards[c].faceUp).length;
    const up = isHome ? 0 : sample.cards.length - down;
    const slot = majoritySlot(z.kind === 'player' ? copiesFor(z).flatMap((c) => c.cards) : z.cards);
    return {
      key,
      name: z.name.slice(0, 40),
      layout: z.layout,
      ...(z.width ? { width: z.width } : {}),
      ...(z.newRow ? { newRow: true } : {}),
      color: z.color,
      ...(z.kind === 'player' ? { perSeat: true } : {}),
      ...(slot && slot !== firstSlot ? { slot } : {}),
      down,
      up,
    };
  });
  const handCards = order.map((x) => state.zones[`hand:${x.id}`]?.cards ?? []);
  const sizes = new Set(handCards.map((h) => h.length));
  const all = handCards.flat();
  const hands =
    sizes.size === 1 && all.length > 0
      ? { count: handCards[0].length, face: (all.filter((c) => state.cards[c].faceUp).length > all.length / 2 ? 'up' : 'down') as 'up' | 'down', ...(majoritySlot(all) !== firstSlot ? { slot: majoritySlot(all) } : {}) }
      : undefined;
  const counters: SetupContent['counters'] = [];
  const seen = new Set<string>();
  for (const c of state.counters) {
    const who = order.find((x) => c.label.startsWith(x.name + ' ') || c.label.startsWith(x.name + "'"));
    const label = who ? `{name}${c.label.slice(who.name.length)}` : c.label;
    if (seen.has(label)) continue;
    seen.add(label);
    counters.push({ label: label.slice(0, 40), value: c.value, ...(who ? { perSeat: true } : {}) });
  }
  const n = Math.max(1, order.length);
  const content: SetupContent = { name: opts.name.slice(0, 40), players: { min: n, max: n }, slots, homes, zones, ...(hands ? { hands } : {}), counters };
  if (opts.fixed) {
    const card = (id: string) => {
      const c = state.cards[id];
      return { slot: slotOf.get(c.deckId)!, defId: c.defId, copyNo: c.copyNo, faceUp: c.faceUp };
    };
    content.fixed = {
      players: order.length,
      deckVersions: Object.fromEntries(decks.filter((d) => d.versionId).map((d) => [slotOf.get(d.id)!, d.versionId!])),
      // every zone, home piles included, so even the stock comes back in the recorded order
      zones: Object.fromEntries(
        sharedZones.flatMap((z) =>
          z.kind === 'player'
            ? copiesFor(z).map((c, i) => [`${keyOf.get(z.id)!}#${i}`, c.cards.map(card)])
            : [[keyOf.get(z.id)!, z.cards.map(card)]],
        ),
      ),
      hands: handCards.map((h) => h.map(card)),
    };
  }
  return content;
}
