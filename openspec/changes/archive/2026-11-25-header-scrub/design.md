# Design

## Context

- **The strip today** (scrub-loupe): `StripRun` (`scrubStrip.ts`) walks the card-row zones in reading order, wrapping rows with a `shift`; each `CardRow` registers a handle (`extent`, `indexAt`, `show`). It starts from a card scrub, so only spreads take part.
- **Why columns and piles do not:** a sideways slide on a column card picks up a run, and piles have no scrubbing, so the card area cannot also mean "next zone".
- **Zone headers:** `ZoneBox` (`Zones.tsx`) renders a `.zone-label` button. A tap opens the zone sheet; for the host a 500 ms still hold (`useArrangeLongPress`) starts arrange mode and the following click is swallowed. The button is 26 to 30 px tall.
- **Card gestures:** `ZoneGesture` is the per-zone recognizer. It starts from `down` and locks the axis after the slop; there is no way to start it already scrubbing.
- **The loupe** shows `useUI.preview` (a handle and its zone) and reads `useUI.loupe` for side, height, details and the row label.

## Goals / Non-Goals

**Goals:** move between any two zones in one stroke from their headers; see the card that represents a zone; carry on into that zone's cards; no conflict with picking cards up.

**Non-Goals:** no change to the spread hand-over or to tapping; no server or protocol change; no widening of piles and columns (there is nothing to show in them).

## Decisions

**D1. The header owns a small gesture.**
- A `useHeaderScrub` hook on `.zone-label` replaces the current ad hoc handlers and also hosts the arrange still hold, so one object decides between tap, still hold and slide.
- States: `pressed` → after 8 px of mostly-sideways movement, `scrub`; a still hold of 500 ms by the host, `arrange` (unchanged); release below slop, a tap. A slide cancels the hold timer and marks the following click as consumed, as `consumeFired` does now.
- The pointer is captured by the header for the stroke.

**D2. The header strip is its own run, `HeaderStripRun`.**
- It groups the board's zones that have cards into their rows. Within a row the finger picks the header under it (`zoneAtX`: the nearest zone over a gap or beside the row), so there is no running-off-the-end rule to get wrong. The strip handle's `show` previews the zone's focus card.
- Wrapping a row by sliding past its end does not work for headers: a zone at the end of a row sits almost at the screen edge, so a finger that has crossed it has nowhere left to slide. Instead, holding the finger within 14 px of the left or right edge for 0.35 s steps to the next or previous row (and again every 0.35 s while it keeps pushing); the run is ticked from the clock so a still finger works. After a step the finger picks the header under it in the new row. Rows with nothing to show are passed over.
- `zoneFocusCard(zone)` (pure): a pile's top card, a column's last card, otherwise the first card.
- The loupe side is chosen at the press as for card scrubs (the header is inside the zone's box), and a row label is shown as in `scrub-loupe`.

**D3. Entering the cards.**
- When the finger moves down past the header into the same zone's card area, the header scrub ends and the zone is asked to take over at that point: rows and columns register `enter(clientX, clientY, pointerId)` handles. The zone captures the pointer and starts its own `ZoneGesture` already scrubbing (`ZoneGesture.beginScrub(sample)`, new): the state is `scrub`, the scrub index is the card nearest the point, and `onScrubStart` runs.
- Sliding down onto a column therefore scrubs it vertically from the header, and onto a row it scrubs sideways; nothing is picked up because pickup needs a pull-out or a sideways move on a column, which only a new press can start.
- Piles and free zones have no scrub; sliding down into them keeps the header scrub's loupe on their focus card.

**D4. Press area.** The label gets an invisible `::before` extending 8 px above (into the zone's own padding and the gap between rows) and 4 px below, so the pressable height is 34 to 42 px, with no layout change. It does not reach further, so it never covers a neighbouring zone's header or more than a sliver of the cards below; 44 px would have needed to overlap them.

**D5. Hand-over from spreads is untouched.** The card strip and the header strip are separate runs; neither is started by the other.

## Risks / Trade-offs

- **Narrow headers:** fit-width zones are only a few characters wide, so a slide crosses them quickly. The tick and the loupe's zone name keep it readable; the pause shows details.
- **Down into cards vs vertical page scroll:** on the board a vertical drag scrolls it. A header press is on a button, so it does not scroll while a header scrub is in progress (the pointer is captured, and the header sets `touch-action: none`).
- **Handing the pointer over:** capture can move between elements while the pointer is down. The e2e test for entering a row and a column guards it.
- **Hidden information:** the focus card follows the same visibility rules as everywhere else: a face-down pile shows its back and the zone name only.
