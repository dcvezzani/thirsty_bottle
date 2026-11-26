# Design

## Context

- **Pile today** (`Pile` in `Zones.tsx`): draws `depth = min(4, ceil(n/10))` generic `pile-under` backs (a placeholder with a few pixels of offset) and the top card as a real `CardFace`. The pile's box is `cardW + 8` wide; `zonePad` reserves room for the top card's rotation only (rotation-true-size).
- **Cards in a pile** are all in the zone's card list for the viewer (`known` is true for face-up cards), so their face and rotation are available.
- **`CardFace`** puts a `data-h` handle and an `aria-label` on its card; the zone tests, the free-zone hit test and screen readers use them, so a second copy of a card must not carry them.

## Goals / Non-Goals

**Goals:** a differently turned card under the top card can be seen; nothing changes in how the pile behaves.

**Non-Goals:** no change to columns, spreads, hands or free zones; no change to how a pile is tapped, dragged or counted; no layout change beyond the room.

## Decisions

**D1. Which cards a pile draws (pure).**
- `outline(rot) = rot mod 4` (a card turned 180° has the outline it had before; 45° and 135° are different outlines).
- `pileShown(rots)` takes the rotations of a pile's cards from the top and returns the indices to draw: 0 (the top) and then, in order, the index of the first card whose outline is not the outline of any card already drawn. At most four indices, so at most three beneath the top.
- This gives the rule from the discussion: three alike cards on top followed by a differently turned card draws the latter; the cards between are not drawn.

**D2. Drawing them.**
- The `Pile` draws the chosen cards beneath the top card, deepest first, each as a decorative `CardFace` (face up or its back, with its rotation) offset by a few pixels per step like the generic slivers; the generic slivers stay behind them.
- `CardFace` gets a `decorative` prop: no `data-h`, `aria-hidden`, no label, no marks or badges, and `pointer-events: none`, so the cards beneath are not tappable, not counted by `[data-h]` queries, and not announced.

**D3. Room.** `zonePad` for a pile takes the rotations of the cards `pileShown` picks, so the pile reserves the room of the largest of them (a pile's width in the board flow follows, as `Table.tsx` already uses `zonePad`).

**D4. Tests.** `pileShown` over the cases in the specification (alike cards skipped, same outline skipped, 180° skipped, four outlines drawn, at most three beneath, an empty and a one-card pile); `zonePad` of a pile with a turned card beneath; e2e that a turned card under the top card is visible, that a same-outline card draws nothing extra, and that the zone's card count (`[data-h]`) is unchanged.

## Risks / Trade-offs

- **More to draw:** at most three extra cards per pile, only when cards beneath are turned.
- **Hidden under the top:** a card whose outline equals the top's is covered, so nothing is lost by not drawing it.
