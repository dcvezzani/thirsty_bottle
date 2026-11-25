# Design

## Context

- **Showing today:** the `show` action marks cards `shownTo` the chosen players (`shownBy` the owner). The projection sends those cards as `known` to those players only. A show ends when the cards move (`clearReveal`) or the owner calls `unshow`. `show` and `unshow` are in `ALWAYS_ALLOWED`, so they work out of turn.
- **Take requests today:** `TakeRequest`s live in the table state (`requests`), are created by a move out of another player's hand, and are answered by `respondTake`. They are dropped when a player leaves their seat and on reset. The client shows an incoming request as an alert dialog and an outgoing one as a "Waiting for…" banner.
- **Presence:** `Table.view()` keeps who is viewing whom in server memory; it is not table state.

## Goals / Non-Goals

**Goals:**
- A viewer-initiated, owner-approved way to see a whole hand, built from what already exists.

**Non-Goals:**
- A standing permission that follows the hand live (cards drawn later stay hidden).
- Letting spectators ask, or any setting that auto-approves requests.

## Decisions

**D1. A separate request type.**
- `SeeRequest { id, from, seatId, at }` in `TableState.seeRequests`, alongside `requests`. Both default to empty, so older stored states load unchanged.
- Alternative considered: a `TakeRequest` with no cards. Rejected, because take requests carry a destination and zone, and `respondTake` moves cards.

**D2. Actions.**
- `seeAsk { seat }` (actor asks): refused unless the actor is seated, the seat belongs to another seated player, and no request from this actor for that seat is pending. Logs "<asker> asked to see <owner>'s hand".
- `seeRespond { requestId, approve }` (actor is the owner): removes the request; on approve, runs the same effect as `show` for every card in the owner's hand, with the asker as the only target; on decline logs "<owner> declined <asker>'s request".
- `seeCancel { requestId }` (actor is the asker) removes it.
- All three are in `ALWAYS_ALLOWED`.
- Clean-up: leaving a seat drops requests from or to that seat, and reset and applying a setup clear them, next to `requests` today. The server also issues a system `seeCancel` for a player whose viewing changes, through `Table.view`.

**D3. Approval is exactly a show.**
- The approval loops the hand's cards and applies the same update `show` makes (`shownTo` gains the asker, `shownBy` is the owner). No new visibility rule is needed: the projection already sends such cards to the asker as known, so the fan renders fronts and scrubbing previews them.
- Log: a public line "<owner> showed <asker> their hand" with no names, plus private text for the asker naming the cards, as `show` does.
- Cards drawn later have no `shownTo` and stay hidden; a move clears the reveal (existing `clearReveal`).

**D3b. Stopping.**
- "Stop showing my hand" sends the existing `unshow` with every handle in the owner's hand. No new action.

**D4. Projection.**
- `RequestView` gains `kind: 'take' | 'see'`. An incoming see-request goes to the owner and an outgoing one to the asker; take-request fields (count, destination) are ignored for `see`.

**D5. Client.**
- **Ask control:** in the viewed column, a button at the top-right "Ask to see hand" (44 px hit area), shown when I am seated, the hand has hidden cards, and I have no pending request for that seat. While pending it reads "Asked…". The seat sheet offers the same action.
- **Waiting banner:** "Waiting for George to let you see their hand…" with Cancel.
- **Owner's prompt:** the existing alert dialog, with "Dave asks to see your hand". Take requests and see-requests queue in arrival order.
- **Stop showing my hand:** a button in the owner's hand (the dock's own column, and the plain hand area) while any of their cards has `shownTo`.

## Risks / Trade-offs

- [A request prompt interrupts the owner] → The same overlay as take requests; one tap to decline.
- [Repeated asking] → One pending request per pair at a time; a decline is immediate and final for that request.
- [The reveal is a snapshot, so a new card is a surprise back] → The badge shows "6 shown" of 7, which makes it clear.

## Migration Plan

Table state gains an optional field that defaults to empty. No migration is needed, and old clients ignore the new request kind after the update banner moves them to the new build.
