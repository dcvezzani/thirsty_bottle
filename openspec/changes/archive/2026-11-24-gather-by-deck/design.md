# Design

## Context

- **Action:** `gather { zones: 'all' | ids, to }` in `shared/src/reducer.ts` collects the cards of the given zones (excluding `to`) into `to`, then turns every card in `to` face down and clears every card's reveal on the table.
- **Cards:** each `CardInst` has a `deckId`, and the client sees the deck in `CardView.deck` when the card is known.
- **Client:** the zone sheet sends `{ type: 'gather', zones: 'all', to }`.

## Goals / Non-Goals

**Goals:**
- Gather one deck without disturbing other decks.

**Non-Goals:**
- Gathering a deck to its home pile from the Decks sheet (possible later).
- Sorting gathered cards into deck order.

## Decisions

**D1. Add an optional `deck` to `gather`.**
- Schema: `deck: id.optional()`. With `deck`, the server selects cards where `s.cards[id].deckId === deck` from the chosen zones, and refuses an unknown deck (`NO_DECK`).
- The filter runs on the server, because the client cannot see the deck of face-down or hidden cards. This is why it is a parameter rather than a client-side card list.
- Alternative considered: send explicit card handles. Rejected, because hidden cards' decks are unknown to the client.

**D2. Limit side effects to the gathered deck.**
- Face down: only cards of `deck` in `to` (the gathered cards plus that deck's cards already there).
- Reveal clearing: only the cards of `deck`.
- "Gather all" keeps today's behavior unchanged.

**D3. Log the deck by name.**
- Format: `"<who> gathered <n> <deck name> card(s) into <zone>"`.
- The deck name is public table information, so no private text is needed.

**D4. Client buttons.**
- In `ZoneSheet`, when `view.decks.length > 1`, render one "Gather <deck.name> here" button per deck after "Gather all here", under the same `mine` condition (hidden on other players' zones).
- Each sends `{ type: 'gather', zones: 'all', to: zone.id, deck: d.id }`.

## Risks / Trade-offs

- [Long deck names in buttons] → The buttons wrap in the actions grid like other long labels.
- [Many decks loaded] → One button per deck. Tables rarely have more than three.
