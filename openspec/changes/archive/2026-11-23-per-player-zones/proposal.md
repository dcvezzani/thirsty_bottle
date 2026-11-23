# Proposal

## Why

Every zone on a table is either shared by everyone or a seat's hand. Many games give each player their own area: a personal tableau, a pile of tricks won, a reserve or a row of played cards. Today the host must create and name one zone per player by hand ("Alex's tableau", "Sam's tableau"), and the board fills with everyone's areas. Setups' "per seat" zones do the same at apply time, so a player who sits down later gets no area. A zone should be defined once and give each player their own copy, without cluttering anyone else's board.

## What Changes

- **Per-player zones.** A zone can be marked "one per player" when it is added, in table settings or in a setup. The table keeps one copy of it for every seat, including seats added later, and removes a seat's copy with the seat.
- **Placement.** The definition takes one slot in the shared zone order. Each player sees their own copy in that slot, labelled as theirs. Name, layout, width, new row and color are set on the definition and apply to every copy. Arranging moves the whole group.
- **Visibility.** Per-player zones follow ordinary face rules for everyone, including the owner. Face-up cards are visible to all players and spectators, and named in the log. Face-down cards are visible to no one, and the log does not name them.
- **Control (hand behavior).**
  - Taking cards from another player's copy needs their consent, unless "open hands" is on.
  - Other players can pass cards into someone's copy.
  - Only the owner flips, shuffles, peeks, arranges or draws within their copy.
- **Seeing others' copies.** Other players' copies are not drawn on your board. Each copy's card count shows in the seat bar, and a seat's sheet shows that player's per-player zones, with face-up cards visible, face-down cards as backs, and the hand actions (ask to take, pass).
- **Counts.** Every copy shows its card count: on its owner's board, in the seat bar, and in the seat sheet.
- **Setups.** A setup's "per seat" zone becomes a per-player zone when applied, and dealing fills each player's copy. Saving a table as a setup records a per-player zone as a per-seat zone.
- **Not in this change:** rotating through other players' table views. That is planned as a separate change that builds on this one.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `table-play`: adds per-player zones, covering their creation and copies, placement, visibility, control and counts.
- `table-setups`: per-seat zones in setups are applied as, and recorded from, per-player zones.

## Impact

- **Shared:**
  - `table.ts`: a new zone kind `player` with `seatId` and `group`, plus an action field for "per player" on add-zone
  - `reducer.ts`: creating copies on add-zone and add-seat, removing them with the seat, group-wide edits and arranging, and the hand-style take/pass/flip gates for other players' copies
  - `visibility.ts`: `isPublic` treats per-player zones like shared zones
  - `setups.ts`: per-seat zones expand into a per-player group, and recording maps a group back to a per-seat zone
- **Server:** projection and hello need no new rules beyond the zone kind; the seat summary gains per-zone counts.
- **Client:**
  - the board renders only your own copy in the group's slot
  - the seat bar shows counts, and the seat sheet lists per-player zones
  - table settings gain a "One per player" option
  - the zone sheet hides actions you can't take on another player's copy
- **Compatibility:** existing tables and setups are unchanged. Existing per-seat setup zones become per-player zones only when a setup is next applied.
