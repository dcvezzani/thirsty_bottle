# Proposal

## Why

The seat bar's chips have grown one line per feature: hand count, a line for each per-player zone's count, shown-card thumbnails, a "disconnected" line and a "viewing" line. At a table with seven per-player zones, one chip becomes taller than a row of zones and pushes the board down on a phone. Players asked for the chip to show only who the player is and how many cards they hold, leaving the rest of the screen to the table.

## What Changes

- **One-line seat chips.** A seat chip shows only the player's name (with the host crown) and their hand count, on one line. Per-zone counts, shown-card thumbnails, the disconnected status and the viewing label are removed from the chip. The full status stays in the chip's accessible name. Styling that adds no height stays: the active-turn highlight, the drop-target highlight while dragging a card to pass, and dimming for an empty seat.
- **The seat sheet carries the details.**
  - status line: host, disconnected, and "viewing Sam" or "viewing you"
  - hand count
  - cards shown to you
  - each per-player zone with its count and cards, as now
- **Who is viewing whom.** The viewed player keeps the eye pill in the top bar. The "viewing Sam" label moves from the viewer's seat chip into their seat sheet. **(Modifies the player-views requirement.)**
- **Per-player zone counts.** These are no longer in the seat bar. They show on the owner's board and in the seat sheet. **(Modifies the per-player-zones requirement.)**
- **Own per-player copies show just the zone name.** On your own board a per-player zone is labelled with its name ("P1.1"), not "Your P1.1", so narrow zones stop shortening it to "Y…". Other players' copies, seen while viewing their table, keep the owner's name ("Sam's P1.1").

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `table-play`: adds the one-line seat chip requirement, and modifies "Seeing other players' per-player zones", "Who is viewing whom" and "Per-player zone placement".

## Impact

- **Client:**
  - `client/src/table/Seats.tsx`: the chip markup and accessible name
  - `client/src/table/Sheets.tsx`: the seat sheet status line and shown cards
  - `client/src/table/ui.ts`: the `zoneLabel` for own per-player copies
  - `client/src/styles.css`: the one-line chip
- **Tests:** e2e tests that read counts or "viewing" from seat chips move to the seat sheet or the accessible name (`per-player-zones`, `player-views`, `contrast`). Any test reading "Your <zone>" labels changes too.
- **No server or protocol changes:** `zoneCounts` stays in the seat view for the sheet and accessibility.
