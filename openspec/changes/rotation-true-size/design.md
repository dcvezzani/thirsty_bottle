# Design

## Context

- **Today:** `CardFace` draws a rotated card as a whole inside `.card-turn` with `rotate(r·45deg) scale(fit)`, where `rotationFit` shrinks it to stay inside the upright slot. Zones size themselves from upright cards: a spread's row is `cardW × 1.4` (plus the arc's extra) high and as wide as its zone; a column is `cardW` wide and its layout's height high; a pile is `cardW + 8` wide; `flowRows` gives fit-width zones `fitInner(layout, cardW) + chrome` of width.
- **Hit-testing** is computed from layout maths (fan strips, column strips), not from the DOM, and stays slot-based.

## Goals / Non-Goals

**Goals:** a rotated card at its normal size; zones that grow to hold it.

**Non-Goals:** no change to slots, fan spacing or tap areas; no variable-size slots (cards pushed apart); no change to the rules, controls, gestures or the loupe's views.

## Decisions

**D1. How much room.**
- `rotationPad(rots, aspect = 1.4)` (pure) returns `{ x, y }` as fractions of the card width: for each rotation `r` it takes the rotated card's box (`W = |cos|·1 + aspect·|sin|`, `H = |sin|·1 + aspect·|cos|` for a card of width 1) and the room needed on each side beyond an upright card, `max(0, (W − 1)/2)` and `max(0, (H − aspect)/2)`; it returns the largest over the rotations given. 45° gives about `{ 0.35, 0.15 }`, 90° `{ 0.20, 0 }`, 0° `{ 0, 0 }`.
- `zonePad(zone)` applies it to the cards in a zone (a pile: its top card only) and multiplies by the card width where used.

**D2. Drawing.** `rotationTransform` is `rotate(r·45deg)` with no scale; the loupe's True full view keeps passing an explicit fit (`fitInBox`) because the loupe's box is fixed. The slot (`.card`) keeps its size and `overflow: visible` while rotated, so the card overflows its slot into the room the zone reserved. `rotationFit` is no longer used on the table.

**D3. Each zone kind.**
- **Spread and hand rows (`CardRow`):** the row is `2·y·cardW` taller; cards sit `y·cardW` lower; the fan's edge padding is at least `x·cardW`, so the first and last cards' overhang stays inside the row. The hit-test already takes a top offset, which grows by `y·cardW`. The hand dock's constant-height columns include the extra height in their measured heights.
- **Columns (`ColumnZone`):** the column is `2·x·cardW` wider, cards sit `x·cardW` to the right, and it is `2·y·cardW` taller; the column hit-test subtracts the top offset.
- **Piles (`Pile`):** the pile's box grows by the room on each side from its top card's rotation.
- **Free zones:** a fixed area; rotated cards just overflow inside it. No change.
- **Board flow (`flowRows`):** `FlowZone` gets `padX` (the zone's `x`); a fit zone's inner width becomes `fitInner(layout, cardW) + 2·padX·cardW`, which is still linear in `cardW`, so the existing shrink-to-fit and wrapping rules apply unchanged.

**D4. Where it applies.** The drag ghost and every zone use the same `CardFace`, so all draw true size; only the zones listed above reserve room. The loupe's True full view is as before.

**D5. Tests.** `rotationPad` values (0°, 45°, 90°, 135°, 180° and the largest of several); flow widths with and without `padX`; e2e that a rotated card's turned box is as large as an upright card's, and that the zone's box grows when a card is rotated and returns when it is upright, for a spread, a column and a pile (top card only); the existing rotation e2e tests, with the check that a rotated card is smaller than its slot replaced.

## Risks / Trade-offs

- **Overlap and tap areas:** a rotated card's overhang is not tappable and overlaps neighbours, since hit areas stay slot-based. Variable slots would fix that at the cost of reworking every layout; they are left for later.
- **Crowded rows:** a zone that grows can make its row-mates shrink to the smallest cards or wrap to a new row, as any widening does.
- **Layout shift:** rotating a card changes its zone's size; the existing transitions soften it.
