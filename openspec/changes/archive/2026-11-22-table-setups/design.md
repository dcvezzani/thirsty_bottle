# Design

## Context

- **Decks are the pattern to follow.** `server/src/decks.ts` with the tables `decks`, `deck_versions` and `deck_drafts` (`server/src/db.ts`) gives:
  - owner, status (active or archived), current version, a draft with ops, explicit save that creates a version, clone, archive, delete when archived;
  - REST routes under `/api/decks`;
  - the client's `pages/Decks.tsx` (list, filters) and `pages/DeckEditor.tsx` (draft editing, save, discard).
- **Loading a deck onto a table:** `DeckService.tableDeck()` builds a `TableDeck` snapshot from a deck's current saved version, and `loadOntoTable` records it and applies `{ type: 'loadDeck', deck }`.
- **Table state** (`shared/src/table.ts`) holds:
  - `zones` plus `zoneOrder` (with width and new row from zone-arrangement);
  - `cards`, `decks` (snapshots), `counters` (label, value) and `seats`.
- **The reducer** (`shared/src/reducer.ts`) already has the building blocks: `addZone(place)`, `loadDeck`, `shuffle` with `ctx.rng`, round-robin `deal`, `reset`.
- **`TableEngine` undo** stores the previous state for the acting player for 10 seconds, for actions in `UNDOABLE`.
- **Persistence:** the table is snapshotted, actions are logged and replayed, and the server builds deck snapshots, never the client.

## Goals / Non-Goals

**Goals:**
- Record, edit, version and manage private setups.
- Apply a setup, as one undoable action, for N seated players, with swappable deck slots and fixed deals.
- Apply setup… and Play again.

**Non-Goals (this change):**
- Public setups, a gallery, share links, reports and built-in setups (next change, `setup-sharing`).
- Formulas for counts.
- Auto-dealing to players who join after a setup ran.
- Free-zone card positions beyond the zone itself (cards dealt to a free zone get default positions).

## Decisions

**D1. The `SetupContent` schema** (zod, in `shared/src/setups.ts`) is stored as version JSON like deck content:
- `players: { min, max }`
- `slots: { id, defaultDeckId, label }[]`
- `zones: { key, name, layout, width?, newRow?, color, perSeat?: boolean, from?: slotId, deal: Count }[]`. Each zone is either a deck's home pile (`from` set, receiving whatever remains) or receives its own deal.
- `Count = { down: N | ByPlayers, up: N | ByPlayers }`, where `N` is a number or `'rest'`, and `ByPlayers = { rule: { min, max, n }[] }`.
- `hands: { from: slotId, count: N | ByPlayers, face: 'down' | 'up' }` (per seat)
- `counters: { label, value, perSeat?: boolean }[]`
- `fixed?: { players: number; deckVersions: Record<slotId, versionId>; zones: Record<zoneKey, { defId, copyNo, faceUp }[]>; hands: { defId, copyNo, faceUp }[][] }`
- `{name}` in a per-seat zone name or counter label is replaced by each seated player's name.

**D2. Pure expansion.** `expandSetup(content, seats, decks) → Plan | refusal`, in `shared`, deterministic apart from the shuffle seed:
- **Player range:** checks the number of seated players against `players`.
- **Counts:** resolves each count for that number of players.
- **Per-seat elements:** expands per-seat zones and counters in seat order.
- **Deal:** computes the deal in a fixed order (zone deals in zone order, then hands round-robin from the host's seat), with `'rest'` taking what remains, and extras going to the first seats in deal order.
- **Refusals:** too few cards in a slot, a fixed deal for another player count, a missing version.
- **The `Plan`:** concrete zones (in order), counters, and per slot an ordered list of `(zoneKey | hand seatId, faceUp)` assignments. For fixed deals, an explicit card list instead.
- It is unit-tested without a server.

**D3. One table action: `applySetup`.**
- The server resolves slots into `TableDeck` snapshots, with the host's chosen decks, using `tableDeck()` so deck access rules apply. It runs `expandSetup`, then applies `{ type: 'applySetup', setupId, versionId, name, decks, plan }` with the host as actor.
- **The reducer:**
  - clears zones, cards, decks and counters (seats and hands' zone slots stay, emptied);
  - creates the plan's zones in order;
  - loads the deck snapshots, assigning homes per the plan;
  - shuffles each slot with `ctx.rng`, unless it is a fixed deal;
  - assigns cards per the plan;
  - creates counters;
  - sets `state.lastSetup = { id, versionId, name }`;
  - logs "{host} applied {name}".
- **Undo and replay:** `applySetup` joins `ADMIN` (host only) and `UNDOABLE`, so the existing undo restores the previous state. The plan and snapshots are in the action itself, so replay after a restart is exact.

**D4. Recording ("Save table as setup").**
- Server-side `recordSetup(state, hostId)` turns the live table into `SetupContent` (D1), following the spec's inference rules:
  - equal hands become a per-seat hand;
  - a counter starting with a seated player's name becomes a `{name}` per-seat counter;
  - the player range is set to the current count;
  - each loaded deck's source deck becomes a slot default, and a deck without a source has no default and must be chosen.
- The fixed-deal option is off unless the host ticks "Fixed deal" when saving the table. That records the current arrangement, home piles included, and the deck versions. A fixed deal can only be recorded from a live table, since it needs real cards; the editor can remove one.
- It creates a setup with a draft, owned by the host, and returns its id. The client opens the editor.

**D5. Storage and API mirror decks.**
- **Tables** `setups` (id, owner_id, status, current_version_id, created_at, updated_at, cloned_from), `setup_versions` and `setup_drafts`.
- **Routes:**
  - `GET/POST /api/setups`, `GET /api/setups/:id`;
  - `POST /api/setups/:id/draft` (replace the draft content);
  - `POST /api/setups/:id/save`, `/clone`, `/archive`, `/unarchive`;
  - `DELETE /api/setups/:id` (archived only);
  - `POST /api/tables/:tid/record-setup`.
- Unlike decks' fine-grained card ops, a draft stores whole-content replacement, because setups are small.
- Visibility is private only in this change. The schema leaves room for `visibility` in `setup-sharing`.

**D6. Table messages.**
- `table.applySetup { tableId, setupId, slots?: Record<slotId, deckId> }`, host only, used by the New table flow (right after create), Apply setup… and Play again (`setupId = lastSetup.id`).
- Refusals return an error the client shows. Nothing is applied on refusal.
- `table.create` gains an optional `setupId` (and `slots`), applied after the table is created, before the host is shown the table.

**D7. Client.**
- **Setups page:** reached from the lobby next to Decks, with list, filters (active or archived), New, clone, archive and delete, reusing the Decks page components and styles.
- **Setup editor:** sections for Players, Decks (slots with a default deck and home zone), Zones (rows with layout, width, new row, per seat, deal down/up), Each player's hand, and Counters with a per-seat option.
  - Counts are short text: "7", "rest", or by player count like "2:10, 3-4:7". This keeps counts by player count in one compact field instead of a separate rule list.
  - It has Save, Discard, Clone and Archive. A recorded fixed deal is shown with a Remove button.
- **On the table:** Settings → **Save table as setup** and **Apply setup…**, which opens a sheet listing your setups with their slots, swappable through the deck picker used by "Load deck".
- **Play again** sits in the Settings sheet's Setups section, next to Apply setup… and Save table as setup…, and appears once `lastSetup` exists. It asks for confirmation. It is not also in the top bar, which has no room on a phone.
- **New table dialog:** a "Setup" select (None or your setups), shown once you have setups. A chosen setup uses its default decks and hides the deck select; decks are swapped with Apply setup… on the table. A refused setup still creates the table and shows why.

## Risks / Trade-offs

- [Scope is large] → Split into tasks that each ship something testable: pure expansion, the table action, storage and API, recording, then the client pieces.
- [Inference while recording can guess wrong (a counter named "Sam's turn")] → It only suggests. The draft opens in the editor for review before saving.
- [Swapped decks with different card names break fixed deals] → Fixed-deal slots are locked to their version.
- [Applying is destructive] → Confirmation, one undo, and the log entry. The previous state is also in the server's history for the undo window.
- [A deck deleted after recording] → Its slot has no usable default, so applying asks for a deck and won't use a missing one.
