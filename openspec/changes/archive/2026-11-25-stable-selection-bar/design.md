# Design

## Context

- **Today:** `SelectionBar` (`client/src/table/Sheets.tsx`) is a flex child of `.table-screen` placed between the board and the hand, with `flex: none`, so the board (`flex: 1`) gives up its height whenever it is present. On a 375 px phone its content wraps to three lines (about 150 px).
- **Bottom row:** `Table.tsx` renders `nav.drawer-tabs` (Room, Lobby, Log, Info, zoom out, zoom in) below the hand. It is a constant-height row. The chat drawer (`.drawer`, fixed, `bottom: 48px`) has no close control of its own; the tabs toggle it.
- **Selection state:** `useUI` holds `selZone` and `selected`; any card tap toggles it, and a double tap undoes the first toggle and then flips.
- **Actions sheet:** `CardsSheet` already holds Move to…, Show to… and the rest of the card actions.

## Goals / Non-Goals

**Goals:**
- Selecting and deselecting never move or cover the board.
- Everything the bar offered stays reachable, in at most one extra tap.

**Non-Goals:**
- Changing how selection, quick flip or drags work.
- Redesigning the Actions sheet beyond adding three controls.

## Decisions

**D1. Swap the bottom row instead of adding one.**
- The bottom row renders either the panel tabs (nothing selected) or the selection toolbar (something selected). Both have the same box, so the page's height budget is unchanged.
- The toolbar is only shown for a seated player, as today; a spectator keeps the tabs.
- Alternative considered: a floating bar over the board. Rejected, because it covers the cards and the zones the player is working with.

**D2. One line.**
- Content: `<count> ✕ · Flip · → <last destination> · ⋯`, plus a "face down" tag when that mode is on.
- ✕ calls `clear()`. Flip calls `flipSelection()`. "→ Discard" is today's Send again, shown only when there is a recent destination, with the zone name ellipsized. ⋯ opens the actions sheet.
- Each control keeps the 44 px touch size; the row scrolls sideways instead of wrapping if it ever overflows, so it stays one line.

**D3. Moved into the actions sheet.**
- `CardsSheet` gets "Select all" (all cards of the selection's zone), "Clear" and a "Face down" toggle (the same `useUI.faceDown`) at the top of its main view.
- The toolbar tag reads the same `faceDown` state, so the sticky setting is always visible while a selection exists.

**D4. The chat drawer.**
- When a selection starts (`selected` goes from empty to non-empty) and a drawer is open, `useUI.drawer` is set to null. The effect lives in `Table.tsx` next to the existing drawer state.
- The tabs' unread counts (`unread.lobby`, `unread[table:<id>]`) are summed into a single dot on the toolbar.

**D5. The zoom buttons** are hidden with the tabs while selecting and return when the selection clears.

## Risks / Trade-offs

- [Chat tabs are unavailable during a selection] → The selection is short-lived, ✕ is one tap, and the dot shows unread chat.
- [Select all and Clear need an extra tap through ⋯] → Clear is the ✕; Select all is rare and has no other effect on layout.
- [A hidden sticky Face down setting surprising a player] → The tag stays in the toolbar for as long as it is on and a selection exists, and the setting lives in the same sheet as the actions it affects.

## Migration Plan

Client-only. It ships with the normal update banner.
