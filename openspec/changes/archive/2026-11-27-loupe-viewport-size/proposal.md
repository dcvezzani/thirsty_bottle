# Proposal

## Why

The loupe is a small box (at most 360 px wide and 300 px high, with the card capped at 200 px) placed inside the board, between the header and the footer. On a phone that leaves most of the screen unused while the card, the one thing the player wants to read, is small. The original card details sheet used the full width and most of the height.

## What Changes

- **The loupe is docked at the top or the bottom edge of the view.** It is full width (with a small side margin, at most about 720 px on wide screens), flush with the edge and respecting the notch and home-indicator safe areas, and it may cover the header and the footer. It still never covers the zone being scrubbed.
- **The side is chosen from the whole view.** When the press starts, the loupe goes on the side with more free room beyond the pressed zone (the top on a tie) and stays there until it is dismissed.
- **It fills the room.** Its height is the free room on that side, up to 60% of the screen height; when neither side has about 35%, it takes the larger side at that minimum. The card fills the loupe's height (up to the width available), the 200 px cap goes, Details puts the card on the left and the text beside it, and True full uses a square box as tall as the loupe.
- **Unchanged.** The pause for details, the three views and the remembered choice, the second-finger tap and the rotate swipe, Stay open and its buttons, the caption, header scrub, and the hand dock.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `card-handling`: "Scrub to preview" now places the loupe at the top or bottom edge of the view; a new requirement "The loupe fills the room beyond the zone" sets its size.

## Impact

- **Client only.** The loupe's placement function takes the whole view instead of the board and returns a size cap; the loupe component sizes the card and the Details and True full layouts from its box; the CSS gives it the full width and safe-area offsets; the press handlers pass the view. No server, shared-rules or protocol change.
- **Tests:** unit tests for the placement and sizes (side, tie, middle zone, minimum, cap, safe areas, width cap); e2e that the loupe spans the view's width, sits flush at an edge, covers the header when at the top, stays under 60% of the height, never covers the zone, and shows a larger card; the existing loupe e2e tests change where they assume the old box.
