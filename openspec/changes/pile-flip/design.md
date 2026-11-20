# Design

## Context

- `flipZone` in `shared/src/reducer.ts` computes one target face: the action's `face`, or "up unless every card is already up". It assigns that face to every card in `z.cards`, keeps the order, records a `flip` animation for all cards, and logs "turned {zone} face up/down".
- Pile order: `cards[0]` is the top (see `Zone.cards` in `shared/src/table.ts`), and the `Pile` component shows `cards[0]`.
- Undo restores the previous state snapshot (`TableEngine`), so any reducer change is undone in full.
- **The only client caller** is the zone sheet's "Flip all", which sends `{ type: 'flipZone', zone }` without `face` and without an optimistic prediction. The server's patch carries the new order and faces.

## Goals / Non-Goals

**Goals:**
- A pile turned over reverses its order and toggles each card.

**Non-Goals:**
- Changing how spreads, columns or free zones flip.
- Changing single-card flips, selection flips or the pile double tap.
- Adding an optimistic prediction for `flipZone`. It would be nice, but the round trip is fast and today's behavior has none either.

## Decisions

**D1. Pile branch in `flipZone`.** When the zone's layout is `pile` and the action has no explicit `face`:
- `z.cards.reverse()`;
- toggle `faceUp` on each card;
- add every card to `touched`;
- push a `flip` animation with the new order;
- log `"{who} turned {zone} over"`.
- Every other layout, and any action with an explicit `face`, keeps today's "set every card to the target face in place" code.
- *Alternative rejected:* reversing in every layout. Turning a spread or column over card by card is what a player does physically, and reversing a row would surprise players.

**D2. Explicit `face` keeps its meaning.** `{ face: 'up' | 'down' }` stays "make every card this face, in place" for every layout. It is a state assignment, not a turn-over, and keeping it unchanged avoids breaking scripted use or tests.

**D3. Visibility.** Reversing a pile reveals nothing new. The order of face-down cards is not shown to anyone, and after the turn-over the cards that are face up are visible to everyone as usual. Peek marks (`peekedBy`) and copy numbers travel with each card, since only the array order changes.

## Risks / Trade-offs

- [Players used to "Flip all" on a pile meaning "show all"] → For an all-face-down pile, the result shows the same cards face up, now in the physically correct order, so nothing is lost. A mixed pile now inverts, which matches real cards.
- [Log wording changes for piles] → "turned {zone} over" describes the action better than "face up".
