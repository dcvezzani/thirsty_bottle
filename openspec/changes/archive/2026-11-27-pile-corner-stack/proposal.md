# Proposal

## Why

A pile draws differently turned cards beneath its top card, but every card is turned about its own centre, so a card of another outline is centred behind the top one and shows only as thin slivers on two opposite sides. The face of the nested card is hard to recognise. Lining the cards up by a shared corner makes the part that sticks out one connected area on a known side.

## What Changes

- **Mixed piles line up at the bottom-left corner.** When a pile draws cards of more than one outline (the top card and the differently turned cards beneath it), the rotated outline of every drawn card, the top card included, is placed with its bottom-left corner at the bottom-left corner of the pile's slot. A larger outline then sticks out along the top and the right, so the exposed part forms an L, and each differently turned card has its own visible strip. A landscape card behind an upright one shows on the right; a diagonal one shows along the right and the top; an upright card behind a landscape top card shows above it.
- **A pile whose drawn cards share one outline stays centred**, as today.
- **The pile reserves room where the cards stick out.** To the right and above, as much as the largest outline needs; nothing below or to the left. Its zone is wider by that amount in a row of fit-width zones, and the pile's tap area covers the whole L.
- **Unchanged.** Which cards a pile draws, that the cards beneath are decoration, columns, spreads, hands and free zones.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `card-handling`: new requirement "Mixed piles line up at the bottom-left corner"; "Piles show turned cards beneath" and "Room follows the rotations of drawn cards" are updated to match (where the cards stick out, where the room is).

## Impact

- **Client only.** A pure function for a pile's arrangement (whether it is corner-aligned, where each card goes, the room on the right and above), the card drawing taking an offset for a rotated card, the pile placing its cards and margins from it, the board flow taking the pile's width from it, and the pile's tap area covering the room. No server, shared-rules or protocol change.
- **Tests:** unit tests for the arrangement and the room (outlines, offsets, single-outline piles); e2e that a mixed pile's cards share a bottom-left corner, the exposed part is an L, the pile's box and zone grow to the right and above only, and a single-outline pile is as before.
