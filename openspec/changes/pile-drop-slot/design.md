## Context

A held drag opens a zone in place after about 300 ms (`dwellTick` in `drag.ts`), but only a fit-width spread can open (`openable`). The drop position comes from a resolver each zone registers in `dropRegistry`, and a spread draws its gap from the drag's `over.index`. Piles register a drop target but no resolver, so `move` gets no `index` and the card lands on top. Scrubbing a pile already fans it out in place (`pileScrub`, the `.pile-fan` overlay) and moves through its cards by finger travel with a speed-dependent gain (`RelativeScrub`).

## Goals / Non-Goals

**Goals:** choose the depth of a drop into a pile, with the same feel as scrubbing a pile.
**Non-Goals:** changing spreads, hands or columns; a separate setting; server changes (`move` already accepts an `index`).

## Decisions

- **Which zones open.** `openable` also accepts a pile that has cards, so the existing 300 ms dwell sets `openZone` for it. An empty pile does not open and keeps dropping on top.
- **The fan.** While a drag holds over an open pile, the same fan overlay as scrubbing is drawn, and the drag's `over.index` makes its row draw the gap, as it does for a spread. The overlay is driven by the open zone rather than only by a scrub, so one overlay serves both.
- **The slot.** The pile registers a drop resolver. Before the zone has opened it returns no index (drop on top). Once open, it holds a `RelativeScrub` (from `scrubGain.ts`) that starts at slot 0 at the moment of opening and is fed the finger's x on every resolve; it returns the slot as the insertion `index`. Slot 0 is the top, so releasing without moving drops on top as today. The finger has to stay over the zone for the drop to land in the pile, so its fast gain is sized for a sweep of about two fifths of the screen width (instead of the full width used for scrubbing): a fast sweep from the middle of the zone to its edge covers the pile.
- **Counting.** Slots are positions in the pile with any carried cards removed, as for spreads: `endDrag` already subtracts the carried cards that sit before the index when the drop is into the zone they came from.
- **Closing.** A drop or a cancel closes the zone as for any held drag; the resolver's state is dropped with it. Moving away from the pile for more than the exit margin closes it and the slot state resets.

## Risks / Trade-offs

- The slot follows travel, not position, so the gap is not under the finger; the fan's focus and the gap make the chosen slot visible.
- The resolver is called on every move and on the drop, so its travel state must advance only on moves (the drop's final sample is the same point as the last move).
- A pile carried to its own zone opens too, and the carried cards are hidden from the fan while dragged (as for spreads).
