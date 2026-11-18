# Design

## Context

- `.board` (`client/src/styles.css`) is the scroll container (`overflow: auto; touch-action: pan-x pan-y`). Inside it, `.card-row`, `.free-zone` and `.pile` set `touch-action: none` on their whole box, and their `onPointerDown` takes pointer capture and drives a `ZoneGesture` (`client/src/table/gestures.ts`). Because almost the whole board is inside zones, native touch scrolling has almost nowhere to start.
- Card elements are real hit targets (`.card` has no `pointer-events: none`). Rows find which card was hit by computing it from the layout (`hitIndexXY`), not from the DOM target.
- `client/src/table/drag.ts` knows the board element (`setBoardElement`) and receives every drag move (`moveDrag(x, y)`). It does not scroll today.
- e2e touch input uses CDP `Input.dispatchTouchEvent` (`touchPath` in `e2e/table-helpers.ts`), which supports several touch points.

## Goals / Non-Goals

**Goals:**
- Native one-finger scrolling from every non-card point on the board.
- Two-finger pan anywhere on the board.
- Edge auto-scroll while dragging.

**Non-Goals:**
- Pinch to zoom the cards. Zooming stays on the existing − / + controls. Two-finger *distance* changes are ignored, so a pinch neither zooms nor scrolls sideways unexpectedly.
- Changing the hand area, sheets, chat or lobby scrolling (those already scroll natively).
- A custom draggable scrollbar. Native indicators stay; on iOS they cannot be dragged, which is why the gestures above exist.

## Decisions

**D1. Move `touch-action: none` from zones to cards.** `.card-row`, `.free-zone` and the pile wrapper get `touch-action: pan-y` (and `pan-x pan-y` for the free zone). `.card` inside the board gets `touch-action: none`. A touch starting on a card therefore still reaches the gesture recognizer untouched. A touch starting on empty space lets the browser pan; the browser then sends `pointercancel`, which already calls `gesture.cancel()`, so nothing else changes. A tap on empty space never scrolls, so tap-to-clear-selection keeps working.
- *Alternative rejected:* keep `none` and emulate one-finger scrolling in JS when the hit test returns no card. That loses native momentum, overscroll and accessibility behavior and is more code.

**D2. Two-finger pan at the board level.** A `useBoardPan(boardRef)` hook adds capture-phase `pointerdown/move/up/cancel` listeners on `.board` for `pointerType === 'touch'`.
- When a second touch pointer goes down, it emits a `cancel-card-gestures` event. Zones subscribe and call `gesture.cancel()` and `cancelDrag()`, releasing pointer capture. Cancel never applies a move: `ZoneGesture.cancel` already discards the in-progress drag or scrub.
- While two pointers are down, the midpoint's vertical and horizontal movement scroll `.board` (`scrollTop -= dy`, `scrollLeft -= dx`). Velocity is tracked over the last 100 ms.
- On release it glides: velocity decays exponentially (about 0.95 per 16 ms frame) via `requestAnimationFrame`, and stops on the next touch.
- If the first finger started on empty space, the browser is already panning natively and the hook does nothing (it only acts while it saw both pointers go down on `touch-action: none` targets, detected because no `pointercancel` arrived).
- Pinch distance is ignored (non-goal).
- The pan and glide math lives in a pure module, `client/src/table/pan.ts`, so it can be unit-tested.

**D3. Edge auto-scroll in `drag.ts`.** The top and bottom edge bands are each 56px tall, measured inside the board's visible rectangle.
- When `moveDrag` reports a point inside a band, a 250 ms dwell timer starts. Leaving the band resets it.
- After the dwell, a `requestAnimationFrame` loop scrolls the board at `speed = 200 + 1000 × depth` px/s, where `depth` (0–1) is how far into the band the point is. The drop target under the pointer is re-evaluated each frame so the highlight follows.
- The loop stops on leaving the band, on drop, on cancel, or at the scroll limit.
- The dwell is what keeps a fast drag from the hand, which crosses the bottom band, from scrolling (scenario "passing through the edge band").

**D4. Zone labels.** `.zone-label` is a button with default `touch-action`, so after D1 it already pans natively. The browser does not fire `click` after a pan, so the actions sheet does not open.

## Risks / Trade-offs

- [Vertical movement on a card means "pick up" (gestures D11), so it must never become a scroll] → Cards keep `touch-action: none`, so the browser never pans from a card.
- [Fanned rows of many cards leave little empty space] → Zone labels and the gaps between zones always scroll, and two fingers work anywhere, so there is always a way.
- [A second finger cancels a drag the player meant to keep] → Two fingers on the board have no card meaning today, so the conflict is only theoretical. The cancel animates the cards back, as for a rejected drag.
- [Glide fights native scrolling on some browsers] → Glide only runs for the JS two-finger pan and is cancelled by any new touch.
