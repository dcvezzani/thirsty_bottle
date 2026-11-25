# Proposal

## Why

The loupe shows a card large while a finger scrubs, then disappears on release. It also shows full details after a pause, but only for as long as the finger stays still, and moving on hides them again. A player who wants to read a card's details while scrubbing has no way to say "details" without holding still, and a player who wants to keep looking at a card after lifting the finger has no way to do so. Different devices and hands suit different answers: a phone held in two hands can tap with a second finger, while someone with one free finger or a mouse cannot.

## What Changes

- **A preference, "Card loupe", per device** with two modes:
  - **Second finger:** release dismisses the loupe as it does now. While a finger scrubs, a quick tap of a second finger on the loupe flips it between the large card and the details, and each card scrubbed after that shows in the chosen view.
  - **Stay open:** release leaves the last scrubbed card viewed, with a soft outline that is not the selection outline, and the loupe stays up with a Card/Details toggle button and a close button.
- **Defaults.** Second finger on a touch device that reports two or more touch points, Stay open otherwise (a mouse-only desktop has the hover preview and the stay-open loupe). The preference lives in the browser and is changed from the table settings.
- **Ending a stay-open view:** the close button, starting another scrub or a drag, tapping a card to select it, tapping the viewed card again, a tap on empty felt, opening a sheet or drawer, or Escape. Panning the board does not end it.
- **The chosen view is remembered** for the rest of the session, so choosing Details once makes the following scrubs show details; a pause still peeks at details while the large card is chosen.
- **The viewed look** is a different outline from a selection, and viewing never selects, shows the selection toolbar, or enables card actions.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `card-handling`: "Scrub to preview" no longer says releasing always changes nothing (the loupe may stay open by preference, the cards and selection are still unchanged); new requirements "Switch the loupe between card and details", "Loupe mode preference", "Stay-open loupe" and "Ending a stay-open view".

## Impact

- **Client only.** A per-device preference store, the loupe's two views and its second-finger tap, the stay-open state with its outline, close rules and Escape, and a setting in the table settings sheet. No server, shared-rules or protocol change.
- **Order with other changes:** `header-scrub` is captured but not built; this change works on the same loupe and `header-scrub` reuses it, so they can be applied in either order.
- **Tests:** unit tests for the preference default and storage, the loupe view logic and the dismissal rules; e2e for the second-finger tap (while a scrub continues), the stay-open view and each way it ends; contrast for the loupe controls and the viewed outline.
