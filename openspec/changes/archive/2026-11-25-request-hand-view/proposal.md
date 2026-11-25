# Proposal

## Why

Another player's hand shows only backs, however long you view their table. The only way to see their cards is for the owner to select them all, choose Show to…, and pick you, which they have to think of on their own. A player who wants to see a hand, to help a partner, check a count of a suit, or play open-handed with a friend, has no way to ask.

## What Changes

- **Ask to see a hand.** While viewing another player's table, a seated player can tap "Ask to see hand" in that player's column, or in their seat sheet. It is offered while some of that hand's cards are hidden from them. While waiting it reads "Asked…" with a way to cancel.
- **The owner decides.** The owner gets a prompt in the same place as take requests: "Dave asks to see your hand", with Allow and Decline.
- **Allow shows the hand as it is now.** Every card currently in the hand is shown to the asker, exactly as if the owner had selected them all and used Show to…. The asker's fan flips to fronts and can be scrubbed. A card drawn later stays a back, and a card that leaves the hand leaves the reveal.
- **The owner stays in control.** Eye marks show which cards are shown, the existing "Stop showing" works, and a new one-tap "Stop showing my hand" ends every show of their hand cards.
- **A public, name-free log:** "Dave asked to see George's hand", then "George showed Dave their hand" or "George declined Dave's request".
- **Out of turn, seated players only.** Asking and answering work in turn mode out of turn, as Show to… does. Spectators cannot ask.
- **Requests end** when answered, cancelled, when either player leaves their seat, or when the asker stops viewing that table.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `table-play`: new requirements "Requesting to see a hand" and "Showing a whole hand".

## Impact

- **Shared:** table state gains `seeRequests`; new actions `seeAsk`, `seeRespond` and `seeCancel`; the reducer applies an approval as a show of the hand's cards; requests are cleaned up on leaving, reset and applying a setup.
- **Server:** the projection reports see-requests in the request list; `Table.view` presence changes cancel the asker's pending request through a system action.
- **Client:** the ask control in the viewed column and the seat sheet, a waiting banner with Cancel, the owner's prompt, and "Stop showing my hand" in the owner's hand area.
- **Tests:** reducer, server wire flow, unit and e2e tests, and contrast.
