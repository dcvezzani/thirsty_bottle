# Design

## Context

- **Today:** `pickLoupe(zone, board)` (`loupe.ts`) returns the side, the top `y` and a height `h` of at most 300 px, from the zone's and the board's boxes; `placeLoupe` (`CardRow.tsx`) measures the board; `.loupe` is `position: fixed`, `width: min(92vw, 360px)`; `Loupe.tsx` makes the card `min((h − 44) / 1.4, 200)` px wide.
- **The loupe's states** (`useUI.loupe`: `y`, `h`, `side`, `details`, `row`) are read by the loupe component, the stay-open view and the tests.

## Goals / Non-Goals

**Goals:** a loupe that uses the room: edge to edge, as tall as the zone allows, with a card that fills it; the same side rule and behaviours.

**Non-Goals:** no change to the views, the gestures, the stay-open behaviour, the header scrub, or what the loupe shows.

## Decisions

**D1. Placement from the view (pure).**
- `pickLoupe(zone, view, opts)`: `view` is the usable viewport box (`top`/`bottom` already moved in by the safe-area insets). Free room is `zone.top − view.top − 2·MARGIN` above and `view.bottom − zone.bottom − 2·MARGIN` below. The side is the larger, the top on a tie. The height is that room clamped to `[0.35 · viewHeight, 0.6 · viewHeight]`; when the room is below the minimum the loupe takes the larger side at the minimum (and may overlap the zone, as it could before).
- The result is `{ side, y, h }` as now, so the stored loupe state keeps its shape.

**D2. Width and safe areas.**
- `.loupe` is `width: min(calc(100vw − 16px), 720px)`, centred. The safe-area insets (`env(safe-area-inset-top)` and `-bottom`) are measured once through a hidden probe element and passed to `pickLoupe`, so `y` already clears the notch and the home indicator.

**D3. Sizing the contents.**
- `loupeSizes(h, width, stay)` (pure): the caption is 44 px and the stay-open controls 44 px; `room = h − 44 − (stay ? 44 : 0) − padding`. Card view: card width `min(room / 1.4, width − 24)`. Details: the card takes `min(room / 1.4, 0.42 · width)` and the text the rest. True full: a square of side `min(room, width − 24)` with the card scaled to fit by the existing `fitInBox`. The 200 px cap goes.

**D4. Callers.** `placeLoupe` measures the viewport (`innerHeight`, safe insets) and the pressed zone, and passes them to `pickLoupe`; the header scrub uses the same function, so it follows.

**D5. Tests.** `pickLoupe` over: a zone low on the screen (top side, tall), a zone high up (bottom side), a tie (top), a zone in the middle (the larger side at a reduced height, never below the minimum), the 60% cap, safe-area insets, a short screen; `loupeSizes` for each view and for stay-open. E2e: the loupe spans the viewport's width and is flush at an edge (within the margin and the safe areas), covers the header when at the top, is no more than 60% of the height, does not cover the zone, shows a card wider than 220 px on a phone, Details has the card left of its text, True full is square; the earlier loupe tests that assume a box inside the board are updated.

## Risks / Trade-offs

- **More of the view is covered**, including the header while scrubbing and while a card is viewed in Stay open; the loupe's close button is inside it, and the header's back button is behind it. This is intended.
- **A zone near the middle** gets a smaller loupe, and may be partly covered if neither side has the minimum; the side is still fixed for the whole gesture.
