# Proposal

## Why

Setting up a game by hand is slow and repetitive. The host has to:
- add and arrange the zones;
- load a deck;
- shuffle and deal the right counts into each zone;
- create the score counters.

All of that is repeated every time the group plays, or wants to play again. Hosts need to record a setup once and apply it in one step, for whatever number of players is seated.

## What Changes

- **Setups:** a saved recipe for a table. It holds:
  - zones (layout, width, new row, color, order);
  - deck slots;
  - how many cards each zone gets and which way they face;
  - per-seat hands, zones and counters;
  - counters with starting values;
  - a player range.
- **Save table as setup:** the host records the current table, and the result opens as a draft in a setup editor. Setups can also be built from scratch in the editor.
- **Card distribution:**
  - By default a setup records counts and faces ("2 face down + 1 face up"), and every apply shuffles and deals fresh.
  - A setup can opt in to a **fixed deal** that recreates exactly which cards go where, for the player count it was recorded with.
- **Deck slots:**
  - Each slot has a default deck, and the host can swap any slot for another deck when applying.
  - Slots used by a fixed deal are locked to the exact deck version they were recorded from.
  - If the chosen decks can't cover the deal, applying is refused before anything changes.
- **Player counts:**
  - per-seat elements (a hand of N, a zone or a counter for every seated player, named with `{name}`);
  - card counts that vary with the number of players, including "all remaining";
  - a player range outside which applying is refused.
- **Applying a setup:**
  - in the New table dialog;
  - with **Apply setup…** in the table settings;
  - with **Play again**, which reapplies the table's last setup.
  - Applying replaces zones, cards and counters, and keeps seats, players, chat, the log and settings. It asks for confirmation on an existing table, logs one entry, and can be undone once within the usual window.
- **Setup library (private, in this change):** a Setups page with draft/save, versions, clone, archive, and delete only when archived, following the deck library's patterns.
- **Out of scope here (next change, `setup-sharing`):** public setups, a gallery, share links, reports and built-in setups.

## Capabilities

### New Capabilities
- `table-setups`: recording, editing, managing and applying table setups, including deck slots, card distribution, player-count handling, Apply setup and Play again.

### Modified Capabilities
(none)

## Impact

- **Server:**
  - new storage for setups, their versions and drafts, mirroring decks;
  - a setups module with the same API shape as decks (list, get, create, draft operations, save, clone, archive, delete);
  - a table message to apply a setup, which resolves deck slots into snapshots, validates the deal and runs one table action.
- **Shared:**
  - a `SetupContent` schema;
  - a pure function that expands a setup for a given set of seats into concrete zones, deals and counters;
  - a new table action that replaces zones, cards and counters in one step and is undoable.
- **Client:**
  - a Setups page and setup editor, following the Decks page and deck editor;
  - Save table as setup, Apply setup… and Play again on the table;
  - a setup choice in the New table dialog.
- **Tests:**
  - unit tests for expansion (player counts, per-seat elements, all remaining, fixed deals, refusals);
  - server tests for storage and lifecycle, applying, undo and restart;
  - e2e tests for recording a Klondike-style table and applying it for 1 and 3 players, Play again, deck swap, refusal, and the library flows.
