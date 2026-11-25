# Proposal

## Why

On a phone the cards on the table are tiny. Reading one means pressing and holding it still, which is not smooth, and the scrub preview only enlarges a card a little. Zones are often a few millimetres wide, so choosing a card to select or a slot to drop into is a matter of luck, and a scrub stops dead at the edge of its zone. The aim is to see any card at a comfortable size without a press-and-hold, and to select and move cards precisely despite the small size.

## What Changes

- **A loupe while scrubbing.** Scrubbing shows the card under the finger large, in a fixed place at the top of the screen (or the bottom when the pressed zone is in the upper part of the board), never covering the zone being scrubbed. It chooses its side when the press starts and keeps it until the finger is lifted.
- **Pause to inspect.** Holding the finger still over a card for about 300 ms during a scrub shows the card's full details in the loupe. The old press-and-hold still works where a scrub has not started.
- **One continuous strip.** A sideways scrub carries on into the next zone in the row, then wraps to the next row (and back at the start). The loupe names the zone and row, and the device ticks at each zone crossing.
- **Zones open under a held drag.** While carrying a card, holding still over a small zone widens it in place so its cards can be aimed at; releasing drops the card at that slot and the zone closes.
- **Zones pinned open after a scrub.** Pausing over a zone while scrubbing or selecting widens it and it stays open after the finger lifts, so several cards can be tapped or painted. Tapping the felt, the header or other controls closes it without swallowing that tap; the selection is kept.
- **Desktop is unchanged.** The hover preview stays as it is.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `card-handling`: "Scrub to preview" changes from an enlargement above the finger to the loupe; new requirements "Pause to inspect while scrubbing", "Scrub across zones", "Zones open under a held drag" and "Zones pinned open".

## Impact

- **Client only.** The gesture recognizer gains a dwell notion and a hand-over between zones; a new loupe component; zone widening in the board layout; the drag overlay. No change to the server, the shared rules or the protocol.
- **Tests:** unit tests for the strip order, dwell and the pinned-open rules; e2e for the loupe, the cross-zone scrub, the held drag and the pinned zone; contrast for the loupe.
