# Proposal

## Why

Rotated cards are drawn shrunk so they stay inside the slot of an upright card, to about 71% at 90° and about 59% at the diagonals. A rotated card is therefore smaller than the cards around it, which reads badly and makes a diagonal card hard to see. A rotated card should be drawn at its normal size, and the zone should make room for it.

## What Changes

- **Rotated cards keep their size.** A card at any rotation is drawn at its normal size, rotated about its centre, in every kind of zone, in hands and while carried. Nothing is scaled down.
- **Zones make room.** Each zone reserves, on each side, the extra room the most rotated card in it needs beyond an upright card (up to 0.35 card widths sideways and 0.15 up and down at 45°; sideways only at 90°). A spread or a hand becomes wider and taller around its fan, a column wider, a pile bigger (only its top card counts, since that is the card shown), and a zone in a row of fit-width zones wider, so its row-mates shrink or wrap as they already do. The room goes away when cards are made upright or gathered.
- **Unchanged.** Slots, fan spacing and tap areas stay as they are: a rotated card can overlap its neighbours, and tapping the part that sticks out reaches the neighbour. Rotation rules, controls, gestures and the loupe's views do not change; the loupe's True full view still shows the card at the largest size that fits the loupe.
- **The earlier fit-to-slot requirement is removed.**

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `card-handling`: "Rotated cards fit their slot" is removed; "Rotated cards keep their size", "Zones make room for rotated cards" and "Room follows the rotations" are added.

## Impact

- **Client only.** The card drawing loses its scale; rows, hands, columns, piles and the board flow gain padding from a pure function of the rotations in a zone. No server, shared-rules or protocol change.
- **Tests:** unit tests for the room function and the flow widths; e2e that a rotated card is drawn at full size, that a zone grows and shrinks back, and that the existing rotation tests still pass (the one that checked a rotated card is smaller than its slot changes).
