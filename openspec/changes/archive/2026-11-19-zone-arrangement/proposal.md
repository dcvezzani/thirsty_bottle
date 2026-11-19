# Proposal

## Why

The board stacks every spread and free zone as its own full-width band, one card tall, even when the zone is empty. Zones store `x, y` positions, but the layout barely uses them: piles wrap in a row at the top and everything else stacks by `y`. The host can only nudge zones with arrow buttons. On a phone only a few zones fit on screen. A Solitaire-style table (stock, waste, four foundations, seven tableau piles) cannot fit at all, because tableau piles can only be horizontal spreads, each taking a full row.

## What Changes

- **Zones flow in one shared order.** Every device wraps that order to fit its own screen. All players see the same order, though not necessarily the same shape. The order replaces `x, y` as what drives the layout.
- **Zone width and row breaks.** Each zone has a width: Fit (one card wide), Half or Full. The default comes from the layout: piles and columns are Fit, spreads and free zones are Full. The host can change a zone's width and can make any zone start a new row.
- **Arrange mode (host only).** The host enters it by long-pressing a zone label or choosing "Arrange zones" in Settings. Zones become tiles that the host drags into place, with a gap opening where each will land. Each tile carries its width and new-row controls. Cards cannot be touched while arranging, the board scrolls when a tile is held near its edge, and other players see zones move live. **BREAKING (UI):** the zone sheet's ↑ ↓ ← → buttons are replaced by Move earlier, Move later, a width choice and a "Start a new row" option. These also serve keyboard and screen-reader users.
- **Column layout.** A new zone layout in which cards cascade downward and the zone is one card wide, so several columns sit side by side.
- **Column height control.** Face-down cards compress to thin slivers and face-up cards show their rank corner. The overlap tightens to keep a column within about 2.5 card heights, and a very long column grows rather than hide ranks.
- **Scrubbing columns.** Sliding along a column opens up the cards under the finger and springs back on release. Moving sideways picks up the card and everything below it, or the selection if the card is selected. Hold for info, tap to select and paint selection work as in rows. On desktop, hovering previews cards.
- **Slim empty zones.** An empty spread, column or free zone shrinks to a single tap-height bar (44px) and opens to full size while cards are dragged over it.
- **Shrink to fit a row.** A row of Fit zones too wide for the screen shrinks its cards, down to a minimum size, instead of wrapping or scrolling sideways.
- **Deferred:** a wallet-style stack of collapsed zones.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `table-play`: "Zones" gains the column layout and replaces "reposition" with order, width and row breaks. New requirements cover arrange mode ("Arranging zones"), the zone-sheet controls ("Arranging from the zone sheet"), and that only the host arranges zones.
- `card-handling`: "Gesture disambiguation" covers columns, where the axes are swapped. New requirements cover column height control, scrubbing a column, picking up from a column, slim empty zones, and fitting a row of zones on screen.

## Impact

- **Shared state and protocol:**
  - zones gain `width` and `newRow`;
  - a new `column` layout value;
  - a new host action to move a zone in the order;
  - `zoneUpdate` accepts width and new-row changes.
  - Existing tables are migrated once so their order matches today's visual order (sorted by `y`, then `x`). The `x, y` fields stay stored but no longer drive the layout.
- **Server:** the projection exposes the new zone fields. The zone actions remain host-only, so permission checks are unchanged.
- **Client:**
  - the board layout becomes a flowed, row-aware layout with per-row card sizing;
  - a column zone component with compression and a vertical fisheye scrub;
  - the gesture recognizer gains a vertical axis;
  - arrange mode UI;
  - updated zone sheet and Settings.
- **Tests:** reducer and migration unit tests, layout math unit tests, and phone e2e tests covering a Solitaire-style setup, arrange mode, column scrub and pick-up, slim empty zones, and the contrast check. Existing gesture, scrolling and table e2e tests must keep passing.
