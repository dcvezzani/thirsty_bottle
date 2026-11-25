# Proposal

## Why

Selecting a card makes the selection bar appear between the board and the hand. On a phone it wraps to three lines and is about 150 px tall, so the board shrinks by that much each time the selection starts, and grows back when it clears. A double tap is two selection changes within 300 ms, so the layout moves between the two taps: the second tap lands on the bar or bare felt instead of the card, and the quick flip never fires. The bar also hides the lower part of the board, including destination zones and often the selected card itself, and its top row (Select all, Clear, Send again) sits exactly where a stray second tap lands.

## What Changes

- **The selection toolbar replaces the bottom tabs row.** While any cards are selected, the row that holds Room, Lobby, Log, Info and the zoom buttons shows the selection toolbar in the same place and at the same height. When the selection clears, the tabs return. Selecting and deselecting therefore never move or cover the board.
- **One line:** `3 selected ✕ · Flip · → Discard · ⋯`.
  - ✕ clears the selection.
  - Flip works as today.
  - "→ Discard" is today's "Send again", shortened to the last destination.
  - ⋯ opens Actions….
- **Actions… gains** Select all, Clear and a Face down toggle. A small "face down" tag shows in the toolbar while that mode is on.
- **Starting a selection closes an open chat drawer,** which would otherwise be stuck open because the tabs that close it are replaced.
- **An unread dot** appears on the toolbar when there is unread chat, since the tab badges are hidden meanwhile.
- **Unchanged:** the selection still clears after a move, pass, play or flip; spectators never see the toolbar.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `card-handling`: "Selection controls" is modified, and a new requirement "Selecting never moves the board" is added.

## Impact

- **Client:**
  - `client/src/table/Sheets.tsx`: `SelectionBar` becomes a one-line toolbar, and `CardsSheet` gains Select all, Clear and Face down
  - `client/src/pages/Table.tsx`: the bottom row shows the toolbar or the tabs, and a selection closes the drawer
  - `client/src/styles.css`: the toolbar row
- **Tests:** `e2e/` tests that tap Select all, Clear, Flip or Face down on the selection bar move to the new places; a new e2e test double-taps cards and checks the layout does not move.
- **No server or protocol changes.**
