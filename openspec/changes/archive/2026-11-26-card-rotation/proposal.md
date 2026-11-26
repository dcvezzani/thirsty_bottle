# Proposal

## Why

Some games need a card turned, not just flipped: a Monopoly Deal wild property is played with one end up, cards are tapped sideways, a card is set at an angle to mark it. The table can only flip cards face up or down, and it has no way to leave a card turned, show others that it is turned, or look at it turned.

## What Changes

- **Cards can be rotated, in eight 45° steps.** A card has a rotation (0°, 45°, 90° … 315°), upright by default and the same for every participant. It stays as it is until it is rotated again or gathered back. Moving, drawing, dealing and shuffling cards, and turning a pile over, do not change it.
- **Rotated cards are drawn rotated, scaled to fit.** In every zone, including hands, a rotated card is drawn rotated and shrunk so it stays inside its normal slot (100% at 0° and 180°, about 71% at 90° and 270°, about 59% at the diagonals). Layouts and tap areas do not change.
- **Controls.** A Rotate button on the selection toolbar (+45° per tap); the selection sheet and the zone sheet get ↺, ↻ and Upright (and Rotate all, Upright all for a zone).
- **Gestures.** While a card is shown in the loupe, a quick second-finger swipe right or left across the loupe rotates it +45° or −45° (the stay-open loupe has ↺ and ↻ buttons instead). While a card or selection is carried, a quick tap of a second finger adds 45° to the carried cards.
- **Gather resets it.** The gather actions put the gathered cards back upright, as they already turn them face down.
- **The loupe gets a third view.** Card and Details always show the card upright. **True full** shows it at full size with its current rotation. Tapping steps Card, Details, True full and back to Card; the stay-open loupe has a button for each. The chosen view is remembered for the session as before.
- **Same rules as flipping.** Rotating is logged ("Alex rotated 3 cards"), can be undone, and is refused for cards in someone else's zone.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `table-play`: new requirements "Card rotation" and "Rotating cards"; "Gather and reset" now also returns gathered cards to upright.
- `card-handling`: new requirements "Rotated cards fit their slot", "Rotation controls" and "Rotate with a second finger"; "Switch the loupe between card and details" and "Stay-open loupe" gain the True full view.

## Impact

- **Shared and server:** a rotation on every card instance (absent means upright), `rotate` and `rotateZone` actions, the rotation in each card's view, and the gather reset. Old saved tables and clients from before this change see every card upright.
- **Client:** drawing a rotated card inside its slot in rows, columns, piles, free zones, hands and the drag ghost; the loupe's third view; the controls; and the two gestures, one of which needs the two-finger board pan to treat a quick tap during a drag as a rotate, not a pan.
- **Tests:** reducer, projection and server tests; unit tests for the fit scale, the view cycle and the gesture rules; e2e for rotating, keeping it through moves, gather, the loupe views and both gestures; contrast for the new buttons.
