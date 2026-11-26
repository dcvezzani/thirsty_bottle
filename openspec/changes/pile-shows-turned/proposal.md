# Proposal

## Why

A pile draws its top card for real and, under it, a few identical generic backs for thickness. When the top card is turned, or when a card under it is turned differently, the part of that real card that sticks out should show, but only generic backs are there: a face-up card under a turned top card, or a turned card under an upright one, cannot be seen at all.

## What Changes

- **A pile draws differently turned cards beneath its top card.** Below the top card, a pile draws the first card of each outline that no card above it has, as it really is (face up, or its back, with its rotation), so that a card turned differently sticks out and can be seen. The outline of a card is its rotation modulo 180° (0°/180°, 45°/225°, 90°/270°, 135°/315°), so at most three extra cards are drawn. Cards with the same outline as one already drawn are not drawn.
- **They are decoration.** The cards beneath are not tappable, not draggable, not counted as cards in the zone and not announced; only the top card acts, as now. The generic edge slivers stay for thickness.
- **The pile reserves room for what it draws.** The room around a pile is the largest any drawn card needs (it was the top card's only).
- **Unchanged.** Columns, spreads, hands and free zones.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `card-handling`: "Room follows the rotations" is replaced by a version where a pile counts the cards it draws; "Piles show turned cards beneath" is added.

## Impact

- **Client only.** A pure function that picks the cards a pile draws, the pile component drawing them, a decorative mode for `CardFace` (no handle, no label), and the room function using the same pick.
- **Tests:** unit tests for the pick and the pile's room; e2e that a differently turned card under the top card is visible, a same-outline card is not drawn, and the zone's card count and the top card's behaviour are unchanged.
