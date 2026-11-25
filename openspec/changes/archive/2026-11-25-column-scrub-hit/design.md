# Design

## Context

- **The column** (`ColumnZone.tsx`, `column.ts`): `columnLayout` gives the compressed layout `Lfull` (a y for each card, with face-down cards as thin slivers). While a card is previewed, `columnMagnify(L, focus)` returns the layout that is drawn: it opens the gap before and after the focused card (a card height times 0.75 next to it, 0.35 and 0.2 further away).
- **The hit test** that finds the scrubbed card is `columnHit(Lfull, y)`, the compressed layout. The drawn layout is `columnMagnify(...)`.
- **The mismatch:** every opened gap above the focus pushes the focused card and all cards below it down. The focused card is drawn about `0.75 + 0.35 + 0.2` card heights minus the original steps lower than where the hit test puts it (up to about 100 px for an inner card). The first cards have no gaps above, so they match.
- **A trap:** hit-testing the drawn layout is not enough. Each refocus would open new gaps above the new card and push it down again, so the card under a still finger would creep upwards as the scrub goes on.
- **Rows** do not have the problem: the focused card in a row keeps its position and only its neighbours move sideways.

## Goals / Non-Goals

**Goals:** the card under the finger is the card shown, throughout a scrub in both directions, for touch and for mouse hover.

**Non-Goals:** no change to the compressed column, to picking up from a column, to paint selection, or to rows.

## Decisions

**D1. Open only below the focused card.**
- `columnMagnify(l, focus)` opens the steps from the focused card downwards (`i >= focus`: 0.75, 0.35 and 0.2 card heights by distance) and leaves every step above the focus as in the compressed layout. The focused card's top is therefore exactly where it is in the compressed column, and so is everything above it.
- The card above the focus no longer opens; the loupe is how a card is read, and the cards below the finger open to help see what is coming.

**D2. Hit-test the drawn layout, with the focus held in a ref.**
- The column keeps the current focus index in a ref that is updated synchronously when the preview changes, and the hit test is `columnHit(columnMagnify(Lfull, focusRef), y)`, the layout the next render draws. Mouse hover uses the same function. At rest (no focus) it is the compressed layout, as now.

**D3. Why it is stable.**
- With D1 the focused card f is drawn over `[L_f, L_f + 0.75 H)` and the cards after it start below that. Moving down into card f+1 refocuses it; in the new layout f+1 starts at `L_{f+1}` (above where it was drawn) and its drawn region still contains the finger, so the shown card is f+1 and nothing jumps ahead. Moving up past `L_f` meets the sliver of card f-1, refocuses it, and its region (`[L_{f-1}, ...)`) contains the finger. In steady state the finger advances one card for each compressed step.
- A unit test simulates a finger path down and back up over a mixed column and checks, after every step, that the card the drawn layout puts at the finger is the focus, and that the focus never skips a card.

**D4. Tests.** The existing unit test that expects the card above the focus to open partway changes to expect it unchanged. The e2e test scrubs down a column of at least 10 mixed cards and compares, at each step, the loupe's card with the card at the finger's position (`elementFromPoint`).

## Risks / Trade-offs

- **The first step down is longer:** the focused card is drawn large, so leaving it downwards takes about three quarters of a card height; after that each step is one compressed step. This is what the finger sees, and matches "the card I touch is the card shown".
- **Less opened context above the finger:** the card above no longer opens; the loupe replaces it.
