# Design

## Context

- **Card state:** a card instance (`CardInst`, shared) carries `faceUp`, the reveal fields and nothing about orientation. `flip`, `flipZone`, `gather` and `move` act on it in the pure reducer; `UNDOABLE` lists the actions the undo window covers; `isOthersOwned`/`othersZoneError` guard actions on another player's zone.
- **Projection:** each viewer receives `CardView` with `faceUp`, the identity if known, reveal fields; patches carry the touched cards.
- **Rendering:** `CardFace` draws a card inside a `.card` box whose `transform` is set by the zone (fan positions and tilt in a hand, strips in a column, magnify while scrubbing); the drag ghost and the loupe use `CardFace` too.
- **Loupe:** `loupeFace` is `'auto' | 'card' | 'details'`, `toggleView` flips it, `showsDetails` decides what shows; the loupe takes touches during a scrub (second-finger tap) and its buttons after release (stay open).
- **Board pan:** `useBoardPan` treats a second touch pointer on the board as a two-finger pan, and cancels the card gestures.

## Goals / Non-Goals

**Goals:** a public, persistent per-card rotation in 45° steps, drawn in every zone without changing layouts; controls and two gestures to set it; a True full loupe view.

**Non-Goals:** no free angles; no rotation of zones or tokens; no change to what is hidden from whom (rotation is public, like face state); no new permission rules.

## Decisions

**D1. State and actions (shared).**
- `CardInst.rot` is an integer 0 to 7 (steps of 45°); absent means 0, so saved tables and replays need no migration. `rotNorm(n)` reduces any integer to 0..7.
- Two actions: `rotate { cards, by?, to? }` and `rotateZone { zone, by?, to? }`, exactly one of `by` (a non-zero integer, positive clockwise) or `to` (0..7; 0 is Upright). Both follow the flip permission rules (`isOthersOwned` and `openHands`), log a card action ("Alex rotated 3 cards" / "set 3 cards upright"), mark the cards touched, and are in `UNDOABLE`.
- `move`, `draw`, `deal`, `shuffle`, `cut` and the pile turn-over do not touch `rot`. `gather` sets `rot = 0` on the in-scope cards (every card, or the gathered deck's), beside the existing face reset.

**D2. Projection and protocol.**
- `CardView.rot` is sent for every card the viewer can see in a zone, omitted when 0, for hidden cards too: it is public like `faceUp`. Patches already carry touched cards; no new message types. A client from before this change ignores the field and shows cards upright.

**D3. Drawing a rotated card.**
- `rotationFit(rot, aspect = 1.4)` (pure) gives the scale at which the rotated card's bounding box fits the upright slot: `min(1 / (|cos| + aspect·|sin|), aspect / (|sin| + aspect·|cos|), 1)`, which is 1 at 0° and 180°, about 0.71 at 90° and 270°, and about 0.59 at the diagonals.
- `CardFace` draws the card's content (image or generated face or back) inside an inner element with `transform: rotate(rot * 45deg) scale(fit)`, so the outer `.card` keeps the transform its zone gives it (fan tilt, magnify, column strips) and its box and hit area never change. Badges and marks stay on the outer box. The drag ghost passes the rotation, so a carried card shows it.

**D4. The loupe's views.**
- `loupeFace` becomes `'auto' | 'card' | 'details' | 'true'`. `showsDetails` is unchanged (details only for `'details'`, or a pause in `'auto'`); a new `showsTrue` is `face === 'true'`. `toggleView` steps card, details, true, card; from `'auto'` or a peek, what is on screen counts (a peek is details), so the next view follows it.
- The loupe draws the card upright in Card and Details, and in True full draws it at full size with `rot`, scaled by `rotationFit` to the loupe's card box. The stored session choice accepts `'true'`; an old stored value still reads.
- The stay-open loupe has Card, Details and True full buttons, ↺ and ↻ rotate buttons and the close button.

**D5. Controls.**
- The selection toolbar gets a Rotate button (`rotate { by: 1 }`), the selection sheet ↺, ↻ and Upright, and a zone's sheet Rotate all and Upright all (`rotateZone`). Each is disabled where the player may not flip.

**D6. Second-finger swipe on the loupe.**
- The loupe's existing pointer handler already tells a quick tap (under 250 ms and 10 px) from anything else. A pointer that moves at least 24 px mostly sideways within 500 ms is a swipe: right sends `rotate { by: 1 }`, left `by: -1`, for the card in the loupe, with a haptic tick. A swipe on a card the player may not rotate does nothing. A second finger on the loupe is outside the board, so it does not start a pan.

**D7. Second-finger tap while carrying.**
- While a drag is in progress, a second touch pointer on the board is no longer an immediate pan. `useBoardPan` holds it as pending: if it lifts within 250 ms having moved under 10 px, it is a tap and sends `rotate { by: 1 }` for the carried cards (they are still in their source zone until the drop, so the action is accepted and the ghost shows it at once); if it moves past the slop first, it becomes the pan as today and cancels the drag. The pending state also lasts only while a drag exists, so with no drag a second finger pans immediately.

**D8. Tests and fixtures.** Reducer tests (rotate by and to, wrap, permissions, undo, gather reset for all and for one deck, moves keep it); projection tests (public, omitted at 0); `rotationFit` values; `toggleView` over four states; the swipe and tap classifiers as pure functions; e2e for the controls, the views and both gestures.

## Risks / Trade-offs

- **Small cards at the diagonals (59%):** by design; the loupe's True full view is the way to read them.
- **Two-finger pan during a drag:** the pending-pointer rule changes a long-standing gesture. It applies only while a drag exists, and a moving second finger behaves as before. An e2e test pins both outcomes.
- **Rotation of cards you cannot see:** it is public, so a rotated hidden card is visible as rotated; this reveals nothing about its face.
- **Old clients:** a stale client shows cards upright and cannot rotate; it keeps working otherwise.
