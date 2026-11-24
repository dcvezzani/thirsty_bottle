# Design

## Context

- **Chip today:** `SeatBar` (`client/src/table/Seats.tsx`) renders the name line with the crown, then mini backs and a count, then one `.seat-zone-count` line per `zoneCounts` entry, then a "viewing …" line, then `.seat-status` text ("disconnected", "…"), then up to 4 "shown to you" thumbnails.
- **Seat sheet:** `SeatSheet` (`client/src/table/Sheets.tsx`) shows a "N cards in hand · disconnected · host" line and the per-player zone sections.
- **Labels:** `zoneLabel` (`client/src/table/ui.ts`) labels my per-player copy "Your <name>".

## Goals / Non-Goals

**Goals:**
- A fixed one-line chip height, whatever the number of per-player zones or the statuses.
- No information lost: everything moves to the seat sheet or the accessible name.

**Non-Goals:**
- Changing the seat bar's horizontal layout or scrolling.
- Changing the top-bar eye pill or the view banner.

## Decisions

**D1. The chip is one flex row.**
- Contents: `[crown] Name  <mini back> N`.
- The name truncates with an ellipsis. The count never truncates, following the zone-count-label rule.
- The CSS fixes the chip to a single line (`white-space: nowrap`, `min-height: var(--tap)`), so it keeps a 44 px target.
- Kept as styling only: the active-turn border, `.drop-over`, `.empty`, and an `.away` class for disconnected seats. The away styling is a dimmed opacity that keeps text contrast within the `ui-readability` limits, and adds no text.

**D2. The accessible name carries the status.**
- Format: "George, host, disconnected, viewing Sam: 1 card in hand".
- Per-zone counts are left out to keep it short; they are in the sheet.
- Tests that read status use `toHaveAttribute('aria-label', …)` or the seat sheet.

**D3. The seat sheet gains the details.**
- A status line: "host · disconnected · viewing Sam", or "viewing you".
- A "Shown to you" row of the known cards in that player's hand, when there are any.
- The per-player zone sections keep their "Name · N" headings, so counts stay visible there.

**D4. Own copies are labelled with the zone name.**
- `zoneLabel` returns `z.name` for my own per-player copy, `"<owner>'s <name>"` for others, and `"Seat N <name>"` for empty seats.
- The zone sheet title follows `zoneLabel`, so it reads "P1.1 · 0 cards", with the existing note "One per player…" explaining it.

## Risks / Trade-offs

- [Disconnected players are less visible] → The chip dims, and the sheet and accessible name say so. Turn mode already skips disconnected players.
- [Less at-a-glance awareness of per-player zones] → The owner's board shows counts. For others, the seat sheet is one tap away, and "View table" shows the whole thing.

## Migration Plan

Client-only. It ships with the normal update banner.
